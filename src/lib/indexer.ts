import { supabase } from "@/lib/supabase";
import { generateEmbeddings } from "@/lib/embeddings";
import { parseFile, detectLanguage } from "@/lib/parser";
import { chunkFile } from "@/lib/chunker";
import { buildDependencyGraph, serializeGraph } from "@/lib/dependency-graph";
import { Octokit } from "octokit";
import type { ParsedFile, CodeChunk, IngestionStats, RepoTreeFile } from "./types";

const EXCLUDED_EXTENSIONS = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".bmp", ".tiff",
    ".mp4", ".mp3", ".wav", ".ogg", ".avi", ".mov", ".flv", ".wmv",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".zip", ".tar", ".gz", ".rar", ".7z", ".bz2", ".xz",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".o", ".a", ".lib",
    ".lock", ".map", ".min.js", ".min.css",
    ".pyc", ".pyo", ".class", ".wasm",
    ".sqlite", ".db",
]);

const EXCLUDED_DIRECTORIES = new Set([
    "node_modules", ".git", ".next", "dist", "build", ".cache",
    "__pycache__", ".venv", "venv", "env", "vendor", "target",
    ".idea", ".vscode", ".vs", ".settings",
    "coverage", ".nyc_output", ".turbo", ".parcel-cache",
    ".terraform", ".gradle", ".maven",
    "out", "output", ".output",
    "tmp", "temp", ".tmp",
    "logs",
]);

const EXCLUDED_FILES = new Set([
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
    "composer.lock", "Gemfile.lock", "Cargo.lock", "go.sum",
    "poetry.lock", "Pipfile.lock",
    ".DS_Store", "Thumbs.db",
]);

const MAX_FILE_SIZE_BYTES = 200_000;

function shouldIncludeFile(path: string, size: number): boolean {
    if (size > MAX_FILE_SIZE_BYTES) return false;

    const parts = path.split("/");
    for (const part of parts) {
        if (EXCLUDED_DIRECTORIES.has(part)) return false;
    }

    const filename = parts[parts.length - 1].toLowerCase();
    if (EXCLUDED_FILES.has(filename)) return false;

    const dotIndex = path.lastIndexOf(".");
    if (dotIndex === -1) return true;
    const extension = path.slice(dotIndex).toLowerCase();
    if (EXCLUDED_EXTENSIONS.has(extension)) return false;

    if (filename.endsWith(".min.js") || filename.endsWith(".min.css")) return false;

    return true;
}

export async function fetchRepoTree(
    owner: string,
    name: string
): Promise<{ files: RepoTreeFile[]; truncated: boolean }> {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    const { data: repoData } = await octokit.rest.repos.get({
        owner,
        repo: name,
    });

    const defaultBranch = repoData.default_branch;

    const { data: branchData } = await octokit.rest.repos.getBranch({
        owner,
        repo: name,
        branch: defaultBranch,
    });

    const treeSha = branchData.commit.commit.tree.sha;

    const { data } = await octokit.rest.git.getTree({
        owner,
        repo: name,
        tree_sha: treeSha,
        recursive: "1",
    });

    const files: RepoTreeFile[] = (data.tree || [])
        .filter((item: { type?: string; path?: string; size?: number }) =>
            item.type === "blob" &&
            item.path &&
            shouldIncludeFile(item.path, item.size || 0)
        )
        .map((item: { path?: string; type?: string; size?: number; sha?: string }) => ({
            path: item.path!,
            type: item.type!,
            size: item.size || 0,
            sha: item.sha || "",
        }));

    return { files, truncated: data.truncated || false };
}

export async function fetchFileContent(
    owner: string,
    name: string,
    filePath: string
): Promise<string | null> {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const { data, headers } = await octokit.rest.repos.getContent({
                owner,
                repo: name,
                path: filePath,
            });

            const remaining = parseInt(headers["x-ratelimit-remaining"] || "100", 10);
            if (remaining < 10) {
                const resetTime = parseInt(headers["x-ratelimit-reset"] || "0", 10) * 1000;
                const waitMs = Math.max(resetTime - Date.now(), 1000);
                await new Promise((r) => setTimeout(r, Math.min(waitMs, 60000)));
            }

            if ("content" in data && typeof data.content === "string") {
                const decoded = Buffer.from(data.content, "base64").toString("utf-8");
                if (decoded.trim().length === 0) return null;
                if (isBinaryContent(decoded)) return null;
                return decoded;
            }

            return null;
        } catch (err: unknown) {
            const status = (err as { status?: number }).status;
            if (status === 403 || status === 429) {
                const backoff = Math.pow(2, attempt + 1) * 2000;
                await new Promise((r) => setTimeout(r, backoff));
                continue;
            }
            return null;
        }
    }

    return null;
}

function isBinaryContent(content: string): boolean {
    const sample = content.slice(0, 1000);
    let nullCount = 0;
    for (let i = 0; i < sample.length; i++) {
        if (sample.charCodeAt(i) === 0) nullCount++;
    }
    return nullCount > 5;
}

export async function fetchFilesBatch(
    owner: string,
    name: string,
    paths: string[]
): Promise<Array<{ path: string; content: string }>> {
    const results: Array<{ path: string; content: string }> = [];
    const concurrency = 5;

    for (let i = 0; i < paths.length; i += concurrency) {
        const batch = paths.slice(i, i + concurrency);
        const promises = batch.map(async (filePath) => {
            const content = await fetchFileContent(owner, name, filePath);
            if (content) {
                return { path: filePath, content };
            }
            return null;
        });

        const batchResults = await Promise.all(promises);
        for (const result of batchResults) {
            if (result) results.push(result);
        }
    }

    return results;
}

export async function indexRepository(
    owner: string,
    name: string,
    repositoryId: string
): Promise<IngestionStats> {
    const stats: IngestionStats = {
        totalFilesDiscovered: 0,
        totalFilesFetched: 0,
        totalFilesParsed: 0,
        totalFilesIndexed: 0,
        totalChunksGenerated: 0,
        totalVectorsStored: 0,
        languageBreakdown: {},
        errors: [],
        startedAt: Date.now(),
        completedAt: null,
    };

    await supabase
        .from("repositories")
        .update({ status: "indexing", updated_at: new Date().toISOString() })
        .eq("id", repositoryId);

    try {
        await supabase
            .from("repository_files")
            .delete()
            .eq("repository_id", repositoryId);

        await supabase
            .from("dependency_edges")
            .delete()
            .eq("repository_id", repositoryId);

        const { files } = await fetchRepoTree(owner, name);
        stats.totalFilesDiscovered = files.length;

        await supabase
            .from("repositories")
            .update({
                total_files_discovered: files.length,
                updated_at: new Date().toISOString(),
            })
            .eq("id", repositoryId);

        const allParsedFiles: ParsedFile[] = [];
        const FILE_BATCH_SIZE = 10;

        for (let i = 0; i < files.length; i += FILE_BATCH_SIZE) {
            const batchPaths = files.slice(i, i + FILE_BATCH_SIZE).map((f) => f.path);

            let fetchedFiles: Array<{ path: string; content: string }>;
            try {
                fetchedFiles = await fetchFilesBatch(owner, name, batchPaths);
            } catch (err) {
                stats.errors.push(`Fetch batch error at offset ${i}: ${err instanceof Error ? err.message : String(err)}`);
                continue;
            }
            stats.totalFilesFetched += fetchedFiles.length;

            const parsedFiles: ParsedFile[] = [];
            for (const file of fetchedFiles) {
                try {
                    const parsed = parseFile(file.content, file.path);
                    parsedFiles.push(parsed);

                    const lang = parsed.language;
                    stats.languageBreakdown[lang] = (stats.languageBreakdown[lang] || 0) + 1;
                } catch (err) {
                    stats.errors.push(`Parse error ${file.path}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            stats.totalFilesParsed += parsedFiles.length;
            allParsedFiles.push(...parsedFiles);

            const allChunks: CodeChunk[] = [];
            for (const parsed of parsedFiles) {
                try {
                    const chunks = chunkFile(parsed);
                    allChunks.push(...chunks);
                } catch (err) {
                    stats.errors.push(`Chunk error ${parsed.filePath}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            stats.totalChunksGenerated += allChunks.length;

            if (allChunks.length === 0) continue;

            const EMBED_BATCH_SIZE = 8;
            for (let j = 0; j < allChunks.length; j += EMBED_BATCH_SIZE) {
                const chunkBatch = allChunks.slice(j, j + EMBED_BATCH_SIZE);
                const texts = chunkBatch.map((c) => c.content);

                let embeddings: number[][];
                try {
                    embeddings = await generateEmbeddings(texts);
                } catch (err) {
                    stats.errors.push(`Embedding error batch ${j}: ${err instanceof Error ? err.message : String(err)}`);
                    continue;
                }

                if (embeddings.length !== chunkBatch.length) continue;

                const rows = chunkBatch.map((chunk, idx) => ({
                    repository_id: repositoryId,
                    file_path: chunk.filePath,
                    content: chunk.content,
                    chunk_index: chunk.chunkIndex,
                    symbol_name: chunk.symbolName,
                    symbol_type: chunk.symbolType,
                    language: chunk.language,
                    start_line: chunk.startLine,
                    end_line: chunk.endLine,
                    metadata_json: chunk.metadata,
                    embedding: JSON.stringify(embeddings[idx]),
                }));

                try {
                    const { error } = await supabase.from("repository_files").insert(rows);
                    if (error) {
                        stats.errors.push(`Insert error: ${error.message}`);
                    } else {
                        stats.totalVectorsStored += rows.length;
                        stats.totalFilesIndexed = new Set(
                            allParsedFiles.slice(0, i + FILE_BATCH_SIZE).map((f) => f.filePath)
                        ).size;
                    }
                } catch (err) {
                    stats.errors.push(`DB error: ${err instanceof Error ? err.message : String(err)}`);
                }
            }

            await supabase
                .from("repositories")
                .update({
                    file_count: stats.totalFilesIndexed,
                    total_files_processed: stats.totalFilesFetched,
                    total_chunks: stats.totalChunksGenerated,
                    total_vectors: stats.totalVectorsStored,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", repositoryId);
        }

        try {
            const graph = buildDependencyGraph(allParsedFiles);
            const serialized = serializeGraph(graph);

            if (serialized.edges.length > 0) {
                const edgeRows = serialized.edges.map((edge) => ({
                    repository_id: repositoryId,
                    source_path: edge.sourcePath,
                    target_path: edge.targetPath,
                    edge_type: edge.edgeType,
                    specifiers: edge.specifiers,
                }));

                const EDGE_BATCH = 50;
                for (let k = 0; k < edgeRows.length; k += EDGE_BATCH) {
                    const batch = edgeRows.slice(k, k + EDGE_BATCH);
                    await supabase.from("dependency_edges").insert(batch);
                }
            }

            await supabase
                .from("repositories")
                .update({
                    languages_json: stats.languageBreakdown,
                })
                .eq("id", repositoryId);
        } catch (err) {
            stats.errors.push(`Dependency graph error: ${err instanceof Error ? err.message : String(err)}`);
        }

        stats.completedAt = Date.now();

        await supabase
            .from("repositories")
            .update({
                status: "completed",
                file_count: stats.totalFilesIndexed,
                total_files_discovered: stats.totalFilesDiscovered,
                total_files_processed: stats.totalFilesFetched,
                total_chunks: stats.totalChunksGenerated,
                total_vectors: stats.totalVectorsStored,
                languages_json: stats.languageBreakdown,
                indexed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", repositoryId);

        return stats;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Indexing failed";
        stats.errors.push(errorMessage);

        await supabase
            .from("repositories")
            .update({
                status: "failed",
                error_message: errorMessage,
                total_files_discovered: stats.totalFilesDiscovered,
                total_files_processed: stats.totalFilesFetched,
                total_chunks: stats.totalChunksGenerated,
                total_vectors: stats.totalVectorsStored,
                updated_at: new Date().toISOString(),
            })
            .eq("id", repositoryId);

        throw error;
    }
}
