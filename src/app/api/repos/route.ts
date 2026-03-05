import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "octokit";
import { supabase } from "@/lib/supabase";

interface GitHubRepo {
    name: string;
    full_name: string;
    description: string | null;
    html_url: string;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    updated_at: string;
    private: boolean;
}

export async function GET(request: NextRequest) {
    try {
        const username = request.nextUrl.searchParams.get("username");
        const owner = request.nextUrl.searchParams.get("owner");

        if (owner) {
            const { data: repo } = await supabase
                .from("repositories")
                .select("id, full_name")
                .eq("owner", owner)
                .eq("status", "completed")
                .order("indexed_at", { ascending: false })
                .limit(1)
                .single();

            if (repo) {
                return NextResponse.json({
                    repositoryId: repo.id,
                    fullName: repo.full_name,
                });
            }

            return NextResponse.json({ repositoryId: null });
        }

        if (!username) {
            return NextResponse.json(
                { error: "username or owner query parameter is required" },
                { status: 400 }
            );
        }

        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

        const { data: repos } = await octokit.rest.repos.listForUser({
            username,
            sort: "updated",
            direction: "desc",
            per_page: 30,
            type: "owner",
        });

        const mapped = (repos as GitHubRepo[]).map((repo) => ({
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description,
            url: repo.html_url,
            language: repo.language,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            updatedAt: repo.updated_at,
            isPrivate: repo.private,
        }));

        return NextResponse.json({ repos: mapped });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to fetch repositories";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
