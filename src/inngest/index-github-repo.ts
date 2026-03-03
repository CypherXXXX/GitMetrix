import { inngest } from "@/lib/inngest";
import { indexRepository } from "@/lib/indexer";

export const indexGithubRepo = inngest.createFunction(
    {
        id: "index-github-repo",
        retries: 2,
        concurrency: [{ limit: 3 }],
    },
    { event: "repo/index.requested" },
    async ({ event }) => {
        const { owner, name, repositoryId } = event.data as {
            owner: string;
            name: string;
            repositoryId: string;
        };

        return await indexRepository(owner, name, repositoryId);
    }
);
