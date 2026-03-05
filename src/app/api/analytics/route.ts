import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

interface ContributorStats {
    username: string;
    commits: number;
    additions: number;
    deletions: number;
}

interface AnalyticsResult {
    busFactor: number;
    influenceScores: Array<{ username: string; score: number }>;
    codeOwnership: Array<{ area: string; owner: string; percentage: number }>;
}

function calculateBusFactor(contributors: ContributorStats[]): number {
    if (contributors.length === 0) return 0;

    const totalCommits = contributors.reduce((a, b) => a + b.commits, 0);
    if (totalCommits === 0) return 0;

    const sorted = [...contributors].sort((a, b) => b.commits - a.commits);

    let cumulative = 0;
    let count = 0;
    for (const c of sorted) {
        cumulative += c.commits;
        count++;
        if (cumulative >= totalCommits * 0.5) break;
    }

    return count;
}

function calculateInfluenceScores(
    contributors: ContributorStats[]
): Array<{ username: string; score: number }> {
    const maxCommits = Math.max(1, ...contributors.map((c) => c.commits));
    const maxChanges = Math.max(
        1,
        ...contributors.map((c) => c.additions + c.deletions)
    );

    return contributors
        .map((c) => ({
            username: c.username,
            score: Math.round(
                ((c.commits / maxCommits) * 0.6 +
                    ((c.additions + c.deletions) / maxChanges) * 0.4) *
                100
            ),
        }))
        .sort((a, b) => b.score - a.score);
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const username = searchParams.get("username");
        const repo = searchParams.get("repo");

        if (!username) {
            return NextResponse.json(
                { error: "username is required" },
                { status: 400 }
            );
        }

        const cacheKey = `analytics:${username}:${repo || "all"}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }

        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            return NextResponse.json(
                { error: "GITHUB_TOKEN not configured" },
                { status: 500 }
            );
        }

        let repoName = repo;
        if (!repoName) {
            const reposResponse = await fetch(
                `https://api.github.com/users/${username}/repos?sort=pushed&per_page=5`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (reposResponse.ok) {
                const repos = await reposResponse.json();
                if (repos.length > 0) {
                    repoName = repos[0].name;
                }
            }
        }

        if (!repoName) {
            const result: AnalyticsResult = {
                busFactor: 1,
                influenceScores: [{ username, score: 100 }],
                codeOwnership: [],
            };
            return NextResponse.json(result);
        }

        const contributorsResponse = await fetch(
            `https://api.github.com/repos/${username}/${repoName}/contributors?per_page=20`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const contributors: ContributorStats[] = [];

        if (contributorsResponse.ok) {
            const data = await contributorsResponse.json();
            for (const c of data) {
                contributors.push({
                    username: c.login,
                    commits: c.contributions || 0,
                    additions: 0,
                    deletions: 0,
                });
            }
        }

        if (contributors.length === 0) {
            contributors.push({ username, commits: 1, additions: 0, deletions: 0 });
        }

        const result: AnalyticsResult = {
            busFactor: calculateBusFactor(contributors),
            influenceScores: calculateInfluenceScores(contributors),
            codeOwnership: [],
        };

        await redis.set(cacheKey, JSON.stringify(result), { ex: 3600 });

        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
