import { supabase } from "@/lib/supabase";
import { generateEmbeddings } from "@/lib/embeddings";
import { chunkFileContent } from "@/lib/chunker";
import { Octokit } from "octokit";

const EXCLUDED_EXTENSIONS = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".bmp",
    ".mp4", ".mp3", ".wav", ".ogg", ".avi", ".mov",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".zip", ".tar", ".gz", ".rar", ".7z",
    ".exe", ".dll", ".so", ".dylib",
    ".lock", ".map",
]);

const EXCLUDED_DIRECTORIES = new Set([
    "node_modules", ".git", ".next", "dist", "build", ".cache",
    "__pycache__", ".venv", "vendor", "target", ".idea", ".vscode",
    "coverage", ".nyc_output", ".turbo",
]);

const MAX_FILE_SIZE_BYTES = 100_000;

function shouldIncludeFile(path: string): boolean {
    const parts = path.split("/");

    for (const part of parts) {
        if (EXCLUDED_DIRECTORIES.has(part)) return false;
    }

    const dotIndex = path.lastIndexOf(".");
    if (dotIndex === -1) return true;
    const extension = path.slice(dotIndex).toLowerCase();
    if (EXCLUDED_EXTENSIONS.has(extension)) return false;

    const filename = parts[parts.length - 1].toLowerCase();
    if (filename === "package-lock.json" || filename === "yarn.lock" || filename === "pnpm-lock.yaml") return false;

    return true;
}

interface GitHubTreeItem {
    path?: string;
    type?: string;
    size?: number;
}

export async function indexRepository(
    owner: string,
    name: string,
    repositoryId: string
): Promise<{ filesProcessed: number; chunksInserted: number }> {
    await supabase
        .from("repositories")
        .update({ status: "indexing", updated_at: new Date().toISOString() })
        .eq("id", repositoryId);

    try {
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

        const { data } = await octokit.rest.git.getTree({
            owner,
            repo: name,
            tree_sha: "HEAD",
            recursive: "1",
        });

        const filePaths = (data.tree as GitHubTreeItem[])
            .filter(
                (item) =>
                    item.type === "blob" &&
                    item.path &&
                    (item.size === undefined || item.size <= MAX_FILE_SIZE_BYTES) &&
                    shouldIncludeFile(item.path)
            )
            .map((item) => item.path as string);

        const FILE_BATCH_SIZE = 5;
        let totalChunksInserted = 0;

        for (let i = 0; i < filePaths.length; i += FILE_BATCH_SIZE) {
            const batch = filePaths.slice(i, i + FILE_BATCH_SIZE);

            const fileContents: Array<{ path: string; content: string }> = [];

            for (const filePath of batch) {
                try {
                    const { data: fileData } = await octokit.rest.repos.getContent({
                        owner,
                        repo: name,
                        path: filePath,
                    });

                    if (
                        "content" in fileData &&
                        typeof fileData.content === "string"
                    ) {
                        const decoded = Buffer.from(
                            fileData.content,
                            "base64"
                        ).toString("utf-8");

                        if (decoded.trim().length > 0) {
                            fileContents.push({ path: filePath, content: decoded });
                        }
                    }
                } catch {
                    continue;
                }
            }

            const allChunks: Array<{
                filePath: string;
                content: string;
                chunkIndex: number;
            }> = [];

            for (const file of fileContents) {
                try {
                    const chunks = chunkFileContent(file.content, file.path);
                    chunks.forEach((chunk, index) => {
                        allChunks.push({
                            filePath: file.path,
                            content: chunk,
                            chunkIndex: index,
                        });
                    });
                } catch {
                    continue;
                }
            }

            if (allChunks.length === 0) continue;

            const EMBED_BATCH_SIZE = 4;
            for (let j = 0; j < allChunks.length; j += EMBED_BATCH_SIZE) {
                const chunkBatch = allChunks.slice(j, j + EMBED_BATCH_SIZE);
                const texts = chunkBatch.map((c) => c.content);

                let embeddings: number[][];
                try {
                    embeddings = await generateEmbeddings(texts);
                } catch {
                    continue;
                }

                if (embeddings.length !== chunkBatch.length) continue;

                const rows = chunkBatch.map((chunk, idx) => ({
                    repository_id: repositoryId,
                    file_path: chunk.filePath,
                    content: chunk.content,
                    chunk_index: chunk.chunkIndex,
                    embedding: JSON.stringify(embeddings[idx]),
                }));

                await supabase.from("repository_files").insert(rows);
            }

            totalChunksInserted += allChunks.length;

            await supabase
                .from("repositories")
                .update({
                    file_count: Math.min(i + FILE_BATCH_SIZE, filePaths.length),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", repositoryId);
        }

        await supabase
            .from("repositories")
            .update({
                status: "completed",
                file_count: filePaths.length,
                indexed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", repositoryId);

        return { filesProcessed: filePaths.length, chunksInserted: totalChunksInserted };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Indexing failed";
        await supabase
            .from("repositories")
            .update({
                status: "failed",
                error_message: errorMessage,
                updated_at: new Date().toISOString(),
            })
            .eq("id", repositoryId);
        throw error;
    }
}
