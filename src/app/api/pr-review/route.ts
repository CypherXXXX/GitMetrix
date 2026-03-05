import { NextRequest, NextResponse } from "next/server";
import { routeComplete } from "@/lib/llm/llmRouter";
import { Octokit } from "octokit";

interface ReviewFinding {
    file: string;
    line: number | null;
    severity: "critical" | "warning" | "info";
    message: string;
    suggestion: string;
}

interface ReviewResult {
    bugs: ReviewFinding[];
    optimizations: ReviewFinding[];
    security_issues: ReviewFinding[];
    suggestions: ReviewFinding[];
    overall_score: number;
    summary: string;
}

function parsePrUrl(url: string): { owner: string; repo: string; number: number } | null {
    const match = url.match(
        /github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)/
    );
    if (!match) return null;
    return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}

function splitDiffIntoPatches(diff: string): Array<{ filename: string; patch: string }> {
    const patches: Array<{ filename: string; patch: string }> = [];
    const fileSections = diff.split(/^diff --git /m).filter(Boolean);

    for (const section of fileSections) {
        const headerMatch = section.match(/a\/(.+?)\s+b\//);
        if (!headerMatch) continue;
        const filename = headerMatch[1];
        patches.push({ filename, patch: section.slice(0, 3000) });
    }

    return patches;
}

async function analyzePatch(
    filename: string,
    patch: string,
    prTitle: string
): Promise<Partial<ReviewResult>> {
    const prompt = `Analyze this code diff for a pull request titled "${prTitle}".

File: ${filename}
Diff:
${patch}

Return a JSON object with these arrays. Each item must have: file, line (number or null), severity ("critical"/"warning"/"info"), message, suggestion.

{
  "bugs": [],
  "optimizations": [],
  "security_issues": [],
  "suggestions": []
}

Only return valid JSON. No markdown, no explanations.`;

    try {
        const { text } = await routeComplete(
            "large_context",
            [
                { role: "system", content: "You are a senior code reviewer. Return only valid JSON." },
                { role: "user", content: prompt },
            ],
            { temperature: 0.1, max_tokens: 2048 }
        );

        const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        return JSON.parse(cleaned);
    } catch (_) {
        return { bugs: [], optimizations: [], security_issues: [], suggestions: [] };
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prUrl } = body;

        if (!prUrl || typeof prUrl !== "string") {
            return NextResponse.json(
                { error: "prUrl is required" },
                { status: 400 }
            );
        }

        const parsed = parsePrUrl(prUrl);
        if (!parsed) {
            return NextResponse.json(
                { error: "Invalid GitHub PR URL" },
                { status: 400 }
            );
        }

        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

        const { data: pr } = await octokit.rest.pulls.get({
            owner: parsed.owner,
            repo: parsed.repo,
            pull_number: parsed.number,
            mediaType: { format: "diff" },
        });

        const diff = pr as unknown as string;

        const { data: prInfo } = await octokit.rest.pulls.get({
            owner: parsed.owner,
            repo: parsed.repo,
            pull_number: parsed.number,
        });

        const patches = splitDiffIntoPatches(diff);

        if (patches.length === 0) {
            return NextResponse.json({
                bugs: [],
                optimizations: [],
                security_issues: [],
                suggestions: [],
                overall_score: 100,
                summary: "No code changes detected in this PR.",
            });
        }

        const batchSize = 5;
        const allResults: Partial<ReviewResult>[] = [];

        for (let i = 0; i < patches.length; i += batchSize) {
            const batch = patches.slice(i, i + batchSize);
            const results = await Promise.allSettled(
                batch.map((p) => analyzePatch(p.filename, p.patch, prInfo.title || ""))
            );

            for (const result of results) {
                if (result.status === "fulfilled") {
                    allResults.push(result.value);
                }
            }
        }

        const merged: ReviewResult = {
            bugs: [],
            optimizations: [],
            security_issues: [],
            suggestions: [],
            overall_score: 0,
            summary: "",
        };

        for (const result of allResults) {
            if (result.bugs) merged.bugs.push(...result.bugs);
            if (result.optimizations) merged.optimizations.push(...result.optimizations);
            if (result.security_issues) merged.security_issues.push(...result.security_issues);
            if (result.suggestions) merged.suggestions.push(...result.suggestions);
        }

        const criticalCount = merged.bugs.filter((b) => b.severity === "critical").length +
            merged.security_issues.filter((s) => s.severity === "critical").length;
        const warningCount = merged.bugs.filter((b) => b.severity === "warning").length +
            merged.optimizations.filter((o) => o.severity === "warning").length;

        merged.overall_score = Math.max(
            0,
            100 - criticalCount * 20 - warningCount * 5 - merged.suggestions.length * 2
        );

        const { text: summary } = await routeComplete(
            "deep_reasoning",
            [
                {
                    role: "system",
                    content: "Summarize this PR review in 2-3 sentences. Be concise and actionable.",
                },
                {
                    role: "user",
                    content: `PR: ${prInfo.title}\nBugs: ${merged.bugs.length}\nSecurity: ${merged.security_issues.length}\nOptimizations: ${merged.optimizations.length}\nSuggestions: ${merged.suggestions.length}\nScore: ${merged.overall_score}/100`,
                },
            ],
            { temperature: 0.3, max_tokens: 200 }
        );

        merged.summary = summary;

        return NextResponse.json(merged);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
