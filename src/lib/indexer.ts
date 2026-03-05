import { supabase } from "@/lib/supabase";
import { generateEmbeddings } from "@/lib/embeddings";
import { parseFile } from "@/lib/parser";
import { chunkFile } from "@/lib/chunker";
import { buildDependencyGraph, serializeGraph } from "@/lib/dependency-graph";
import { analyzeRepository } from "@/lib/static-analysis";
import { redis } from "@/lib/redis";
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
    "examples", "docs", "storybook", "playground",
    "benchmarks", "fixtures", "__tests__", "__mocks__",
    ".storybook", ".playwright", "e2e",
]);

const EXCLUDED_FILES = new Set([
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
    "composer.lock", "Gemfile.lock", "Cargo.lock", "go.sum",
    "poetry.lock", "Pipfile.lock",
    ".DS_Store", "Thumbs.db",
]);

const MAX_FILE_SIZE_BYTES = 200_000;
const MAX_FILES = 1500;
const FETCH_CONCURRENCY = 15;
const FILE_BATCH_SIZE = 30;
const EMBED_BATCH_SIZE = 32;
const DB_INSERT_BATCH_SIZE = 100;
const PROGRESS_UPDATE_INTERVAL = 30;
const REDIS_TREE_TTL = 3600;

const PRIORITY_DIRS = ["src/", "app/", "lib/", "packages/", "core/", "server/", "api/"];

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

function prioritizeFiles(files: RepoTreeFile[]): RepoTreeFile[] {
    const priority: RepoTreeFile[] = [];
    const rest: RepoTreeFile[] = [];

    for (const file of files) {
        const isPriority = PRIORITY_DIRS.some((dir) => file.path.startsWith(dir));
        if (isPriority) {
            priority.push(file);
        } else {
            rest.push(file);
        }
    }

    return [...priority, ...rest].slice(0, MAX_FILES);
}

export async function fetchRepoTree(
    owner: string,
    name: string
): Promise<{ files: RepoTreeFile[]; truncated: boolean }> {
    const cacheKey = `repo-tree:${owner}/${name}`;

    try {
        const cached = await redis.get<{ files: RepoTreeFile[]; truncated: boolean }>(cacheKey);
        if (cached && cached.files && cached.files.length > 0) {
            const filtered = cached.files.filter((f) => shouldIncludeFile(f.path, f.size));
            return { files: prioritizeFiles(filtered), truncated: cached.truncated };
        }
    } catch (_) { }

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

    const allFiles: RepoTreeFile[] = (data.tree || [])
        .filter((item: { type?: string; path?: string; size?: number }) =>
            item.type === "blob" && item.path
        )
        .map((item: { path?: string; type?: string; size?: number; sha?: string }) => ({
            path: item.path!,
            type: item.type!,
            size: item.size || 0,
            sha: item.sha || "",
        }));

    try {
        await redis.set(cacheKey, { files: allFiles, truncated: data.truncated || false }, { ex: REDIS_TREE_TTL });
    } catch (_) { }

    const filtered = allFiles.filter((f) => shouldIncludeFile(f.path, f.size));
    return { files: prioritizeFiles(filtered), truncated: data.truncated || false };
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

    for (let i = 0; i < paths.length; i += FETCH_CONCURRENCY) {
        const batch = paths.slice(i, i + FETCH_CONCURRENCY);
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

        await supabase
            .from("code_metrics")
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
        const pendingInsertRows: Array<Record<string, unknown>> = [];
        let filesSinceLastUpdate = 0;

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

                for (let k = 0; k < chunkBatch.length; k++) {
                    pendingInsertRows.push({
                        repository_id: repositoryId,
                        file_path: chunkBatch[k].filePath,
                        content: chunkBatch[k].content,
                        chunk_index: chunkBatch[k].chunkIndex,
                        symbol_name: chunkBatch[k].symbolName,
                        symbol_type: chunkBatch[k].symbolType,
                        language: chunkBatch[k].language,
                        start_line: chunkBatch[k].startLine,
                        end_line: chunkBatch[k].endLine,
                        metadata_json: chunkBatch[k].metadata,
                        embedding: JSON.stringify(embeddings[k]),
                    });
                }

                if (pendingInsertRows.length >= DB_INSERT_BATCH_SIZE) {
                    const toInsert = pendingInsertRows.splice(0, DB_INSERT_BATCH_SIZE);
                    try {
                        const { error } = await supabase.from("repository_files").insert(toInsert);
                        if (error) {
                            stats.errors.push(`Insert error: ${error.message}`);
                        } else {
                            stats.totalVectorsStored += toInsert.length;
                        }
                    } catch (err) {
                        stats.errors.push(`DB error: ${err instanceof Error ? err.message : String(err)}`);
                    }
                }
            }

            filesSinceLastUpdate += fetchedFiles.length;
            stats.totalFilesIndexed = new Set(allParsedFiles.map((f) => f.filePath)).size;

            if (filesSinceLastUpdate >= PROGRESS_UPDATE_INTERVAL) {
                filesSinceLastUpdate = 0;
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
        }

        if (pendingInsertRows.length > 0) {
            try {
                const { error } = await supabase.from("repository_files").insert(pendingInsertRows);
                if (error) {
                    stats.errors.push(`Final insert error: ${error.message}`);
                } else {
                    stats.totalVectorsStored += pendingInsertRows.length;
                }
            } catch (err) {
                stats.errors.push(`Final DB error: ${err instanceof Error ? err.message : String(err)}`);
            }
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

                for (let k = 0; k < edgeRows.length; k += DB_INSERT_BATCH_SIZE) {
                    const batch = edgeRows.slice(k, k + DB_INSERT_BATCH_SIZE);
                    await supabase.from("dependency_edges").insert(batch);
                }
            }
        } catch (err) {
            stats.errors.push(`Dependency graph error: ${err instanceof Error ? err.message : String(err)}`);
        }

        let healthScore = 100;

        try {
            const report = analyzeRepository(allParsedFiles);
            healthScore = report.healthScore;

            if (report.fileMetrics.length > 0) {
                const metricRows = report.fileMetrics.map((m) => ({
                    repository_id: repositoryId,
                    file_path: m.filePath,
                    language: m.language,
                    line_count: m.lineCount,
                    function_count: m.functionCount,
                    avg_function_length: m.avgFunctionLength,
                    max_function_length: m.maxFunctionLength,
                    max_cyclomatic_complexity: m.maxCyclomaticComplexity,
                    max_nesting_depth: m.maxNestingDepth,
                    import_count: m.importCount,
                    export_count: m.exportCount,
                    is_giant_file: m.isGiantFile,
                    risk_score: m.riskScore,
                }));

                for (let k = 0; k < metricRows.length; k += DB_INSERT_BATCH_SIZE) {
                    const batch = metricRows.slice(k, k + DB_INSERT_BATCH_SIZE);
                    const { error } = await supabase.from("code_metrics").insert(batch);
                    if (error) {
                        stats.errors.push(`Code metrics insert error: ${error.message}`);
                    }
                }
            }
        } catch (err) {
            stats.errors.push(`Static analysis error: ${err instanceof Error ? err.message : String(err)}`);
        }

        stats.completedAt = Date.now();
        stats.totalFilesIndexed = new Set(allParsedFiles.map((f) => f.filePath)).size;

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
                health_score: healthScore,
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
