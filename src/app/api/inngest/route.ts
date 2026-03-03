import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { indexGithubRepo } from "@/inngest/index-github-repo";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [indexGithubRepo],
});
