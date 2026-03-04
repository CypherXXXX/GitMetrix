import { inngest } from "@/lib/inngest";
import { fetchRepoTree, fetchFilesBatch, indexRepository } from "@/lib/indexer";
import { supabase } from "@/lib/supabase";

export const indexGithubRepo = inngest.createFunction(
    {
        id: "index-github-repo",
        retries: 3,
        concurrency: [{ limit: 2 }],
    },
    { event: "repo/index.requested" },
    async ({ event, step }) => {
        const { owner, name, repositoryId } = event.data as {
            owner: string;
            name: string;
            repositoryId: string;
        };

        await step.run("validate-repository", async () => {
            const { data } = await supabase
                .from("repositories")
                .select("id, status")
                .eq("id", repositoryId)
                .single();

            if (!data) {
                throw new Error(`Repository ${repositoryId} not found`);
            }

            await supabase
                .from("repositories")
                .update({
                    status: "indexing",
                    error_message: null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", repositoryId);

            return { validated: true };
        });

        const treeResult = await step.run("fetch-repository-tree", async () => {
            const { files, truncated } = await fetchRepoTree(owner, name);
            await supabase
                .from("repositories")
                .update({
                    total_files_discovered: files.length,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", repositoryId);

            return {
                fileCount: files.length,
                truncated,
                filePaths: files.map((f) => f.path),
            };
        });

        const stats = await step.run("process-and-index-files", async () => {
            return await indexRepository(owner, name, repositoryId);
        });

        await step.run("finalize-indexing", async () => {
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
        });

        return {
            repositoryId,
            filesDiscovered: treeResult.fileCount,
            filesProcessed: stats.totalFilesFetched,
            filesParsed: stats.totalFilesParsed,
            filesIndexed: stats.totalFilesIndexed,
            chunksGenerated: stats.totalChunksGenerated,
            vectorsStored: stats.totalVectorsStored,
            languages: stats.languageBreakdown,
            errors: stats.errors.slice(0, 10),
            durationMs: (stats.completedAt || Date.now()) - stats.startedAt,
        };
    }
);
