import { inngest } from "@/lib/inngest";
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

async function markRepoFailed(repositoryId: string, errorMessage: string) {
    await supabase
        .from("repositories")
        .update({
            status: "failed",
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
        })
        .eq("id", repositoryId);
}

export const indexGithubRepo = inngest.createFunction(
    {
        id: "index-github-repo",
        retries: 2,
        concurrency: [{ limit: 3 }],
        onFailure: async ({ event }) => {
            const repositoryId = event.data.event?.data?.repositoryId;
            if (repositoryId) {
                const errorMsg =
                    event.data.error?.message || "Indexing failed after retries";
                await markRepoFailed(repositoryId, errorMsg);
            }
        },
    },
    { event: "repo/index.requested" },
    async ({ event, step }) => {
        const { owner, name, repositoryId } = event.data as {
            owner: string;
            name: string;
            repositoryId: string;
        };

        await step.run("mark-indexing", async () => {
            await supabase
                .from("repositories")
                .update({ status: "indexing", updated_at: new Date().toISOString() })
                .eq("id", repositoryId);
        });

        const filePaths = await step.run("fetch-repo-tree", async () => {
            const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

            const { data } = await octokit.rest.git.getTree({
                owner,
                repo: name,
                tree_sha: "HEAD",
                recursive: "1",
            });

            return (data.tree as GitHubTreeItem[])
                .filter(
                    (item) =>
                        item.type === "blob" &&
                        item.path &&
                        (item.size === undefined || item.size <= MAX_FILE_SIZE_BYTES) &&
                        shouldIncludeFile(item.path)
                )
                .map((item) => item.path as string);
        });

        const FILE_BATCH_SIZE = 5;
        const fileBatches: string[][] = [];
        for (let i = 0; i < filePaths.length; i += FILE_BATCH_SIZE) {
            fileBatches.push(filePaths.slice(i, i + FILE_BATCH_SIZE));
        }

        let totalChunksInserted = 0;

        for (let batchIndex = 0; batchIndex < fileBatches.length; batchIndex++) {
            const insertedCount = await step.run(
                `process-batch-${batchIndex}`,
                async () => {
                    const batch = fileBatches[batchIndex];
                    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

                    const fileContents: Array<{
                        path: string;
                        content: string;
                    }> = [];

                    for (const filePath of batch) {
                        try {
                            const { data } = await octokit.rest.repos.getContent({
                                owner,
                                repo: name,
                                path: filePath,
                            });

                            if (
                                "content" in data &&
                                typeof data.content === "string"
                            ) {
                                const decoded = Buffer.from(
                                    data.content,
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

                    if (allChunks.length === 0) return 0;

                    const EMBED_BATCH_SIZE = 4;
                    for (
                        let i = 0;
                        i < allChunks.length;
                        i += EMBED_BATCH_SIZE
                    ) {
                        const chunkBatch = allChunks.slice(
                            i,
                            i + EMBED_BATCH_SIZE
                        );
                        const texts = chunkBatch.map((c) => c.content);

                        let embeddings: number[][];
                        try {
                            embeddings = await generateEmbeddings(texts);
                        } catch {
                            continue;
                        }

                        if (embeddings.length !== chunkBatch.length) {
                            continue;
                        }

                        const rows = chunkBatch.map((chunk, idx) => ({
                            repository_id: repositoryId,
                            file_path: chunk.filePath,
                            content: chunk.content,
                            chunk_index: chunk.chunkIndex,
                            embedding: JSON.stringify(embeddings[idx]),
                        }));

                        const { error } = await supabase
                            .from("repository_files")
                            .insert(rows);

                        if (error) { }
                    }

                    return allChunks.length;
                }
            );

            totalChunksInserted += insertedCount;
        }

        await step.run("mark-complete", async () => {
            await supabase
                .from("repositories")
                .update({
                    status: "completed",
                    file_count: filePaths.length,
                    indexed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", repositoryId);
        });

        return {
            repositoryId,
            filesProcessed: filePaths.length,
            chunksInserted: totalChunksInserted,
        };
    }
);
