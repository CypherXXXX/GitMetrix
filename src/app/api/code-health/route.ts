import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { routeComplete } from "@/lib/llm/llmRouter";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const repositoryId = searchParams.get("repositoryId");

        if (!repositoryId) {
            return NextResponse.json(
                { error: "repositoryId is required" },
                { status: 400 }
            );
        }

        const { data: repository } = await supabase
            .from("repositories")
            .select("id, status, full_name, health_score")
            .eq("id", repositoryId)
            .single();

        if (!repository || repository.status !== "completed") {
            return NextResponse.json(
                { error: "Repository is not indexed" },
                { status: 400 }
            );
        }

        const { data: metrics } = await supabase
            .from("code_metrics")
            .select("*")
            .eq("repository_id", repositoryId)
            .order("risk_score", { ascending: false });

        if (!metrics || metrics.length === 0) {
            const { data: files } = await supabase
                .from("repository_files")
                .select("file_path, content, language, symbol_name, symbol_type, start_line, end_line")
                .eq("repository_id", repositoryId)
                .limit(200);

            if (!files || files.length === 0) {
                return NextResponse.json({
                    healthScore: 100,
                    totalFiles: 0,
                    topRisks: [],
                    summary: { giantFiles: 0, highComplexity: 0, deepNesting: 0, avgRiskScore: 0 },
                    recommendations: [],
                });
            }

            const fileMetrics = new Map<string, {
                lineCount: number;
                functionCount: number;
                maxFunctionLength: number;
                importCount: number;
            }>();

            for (const file of files) {
                const existing = fileMetrics.get(file.file_path);
                const lines = file.content.split("\n").length;
                const funcLength = file.start_line && file.end_line
                    ? file.end_line - file.start_line + 1
                    : 0;
                const isFunc = file.symbol_type === "function" || file.symbol_type === "method";

                if (existing) {
                    existing.lineCount = Math.max(existing.lineCount, lines);
                    if (isFunc) existing.functionCount++;
                    existing.maxFunctionLength = Math.max(existing.maxFunctionLength, funcLength);
                } else {
                    fileMetrics.set(file.file_path, {
                        lineCount: lines,
                        functionCount: isFunc ? 1 : 0,
                        maxFunctionLength: funcLength,
                        importCount: 0,
                    });
                }
            }

            const topRisks = Array.from(fileMetrics.entries())
                .map(([filePath, m]) => {
                    let risk = 0;
                    if (m.lineCount > 500) risk += 20;
                    if (m.maxFunctionLength > 100) risk += 15;
                    if (m.functionCount > 20) risk += 10;
                    return {
                        filePath,
                        lineCount: m.lineCount,
                        functionCount: m.functionCount,
                        maxFunctionLength: m.maxFunctionLength,
                        riskScore: Math.min(100, risk),
                    };
                })
                .sort((a, b) => b.riskScore - a.riskScore)
                .slice(0, 10);

            const avgRisk = topRisks.length > 0
                ? Math.round(topRisks.reduce((a, b) => a + b.riskScore, 0) / topRisks.length)
                : 0;

            return NextResponse.json({
                healthScore: Math.max(0, 100 - avgRisk),
                totalFiles: fileMetrics.size,
                topRisks,
                summary: {
                    giantFiles: Array.from(fileMetrics.values()).filter((m) => m.lineCount > 500).length,
                    highComplexity: 0,
                    deepNesting: 0,
                    avgRiskScore: avgRisk,
                },
                recommendations: [],
            });
        }

        const topRisks = metrics.slice(0, 10);
        const totalFiles = metrics.length;
        const avgRisk = Math.round(
            metrics.reduce(
                (a: number, b: { risk_score: number }) => a + (b.risk_score || 0),
                0
            ) / totalFiles
        );

        return NextResponse.json({
            healthScore: repository.health_score || Math.max(0, 100 - avgRisk),
            totalFiles,
            topRisks: topRisks.map((m: Record<string, unknown>) => ({
                filePath: m.file_path,
                lineCount: m.line_count,
                functionCount: m.function_count,
                maxFunctionLength: m.max_function_length,
                maxCyclomaticComplexity: m.max_cyclomatic_complexity,
                maxNestingDepth: m.max_nesting_depth,
                riskScore: m.risk_score,
                isGiantFile: m.is_giant_file,
            })),
            summary: {
                giantFiles: metrics.filter((m: { is_giant_file: boolean }) => m.is_giant_file).length,
                highComplexity: metrics.filter((m: { max_cyclomatic_complexity: number }) => (m.max_cyclomatic_complexity || 0) > 10).length,
                deepNesting: metrics.filter((m: { max_nesting_depth: number }) => (m.max_nesting_depth || 0) > 5).length,
                avgRiskScore: avgRisk,
            },
            recommendations: [],
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { repositoryId } = body;

        if (!repositoryId) {
            return NextResponse.json(
                { error: "repositoryId is required" },
                { status: 400 }
            );
        }

        const { data: metrics } = await supabase
            .from("code_metrics")
            .select("file_path, risk_score, is_giant_file, max_cyclomatic_complexity, max_nesting_depth")
            .eq("repository_id", repositoryId)
            .order("risk_score", { ascending: false })
            .limit(10);

        const topIssues = (metrics || [])
            .slice(0, 5)
            .map(
                (m: { file_path: string; risk_score: number }) =>
                    `${m.file_path} (risk: ${m.risk_score})`
            )
            .join("\n");

        const { text } = await routeComplete(
            "deep_reasoning",
            [
                {
                    role: "system",
                    content: "You are a senior architect. Provide 3-5 actionable refactoring recommendations based on the code health metrics. Be specific and practical. Return each recommendation on its own line.",
                },
                {
                    role: "user",
                    content: `Top risky files:\n${topIssues || "No high-risk files found."}`,
                },
            ],
            { temperature: 0.3, max_tokens: 500 }
        );

        const recommendations = text
            .split("\n")
            .map((l) => l.replace(/^\d+\.\s*/, "").trim())
            .filter((l) => l.length > 10)
            .slice(0, 5);

        return NextResponse.json({ recommendations });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
