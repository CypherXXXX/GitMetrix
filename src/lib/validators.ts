import { z } from "zod";

const GITHUB_REPO_URL_PATTERN =
    /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/;

export const IndexRepositorySchema = z.object({
    repoUrl: z
        .string()
        .min(1, "Repository URL is required")
        .regex(GITHUB_REPO_URL_PATTERN, "Invalid GitHub repository URL format"),
});

export const ChatMessageSchema = z.object({
    repositoryId: z.string().uuid("Invalid repository ID"),
    message: z
        .string()
        .min(1, "Message cannot be empty")
        .max(2000, "Message must be under 2000 characters"),
    history: z
        .array(
            z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string(),
            })
        )
        .max(20)
        .optional()
        .default([]),
});

export const RepositoryStatusSchema = z.object({
    repositoryId: z.string().uuid("Invalid repository ID"),
});

export function parseRepoUrl(url: string): { owner: string; name: string } {
    const cleaned = url.replace(/\/+$/, "");
    const parts = cleaned.split("/");
    const name = parts.pop()!;
    const owner = parts.pop()!;
    return { owner, name };
}
