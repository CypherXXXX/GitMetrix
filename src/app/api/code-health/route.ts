import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { routeComplete } from "@/lib/llm/llmRouter";
import { analyzeRepository } from "@/lib/static-analysis";
import type { ParsedFile } from "@/lib/types";

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

        if (metrics && metrics.length > 0) {
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
        }

        const { data: files } = await supabase
            .from("repository_files")
            .select("file_path, content, language, symbol_name, symbol_type, start_line, end_line")
            .eq("repository_id", repositoryId);

        if (!files || files.length === 0) {
            return NextResponse.json({
                healthScore: repository.health_score || 100,
                totalFiles: 0,
                topRisks: [],
                summary: { giantFiles: 0, highComplexity: 0, deepNesting: 0, avgRiskScore: 0 },
                recommendations: [],
            });
        }

        const fileMap = new Map<string, ParsedFile>();

        for (const row of files) {
            const existing = fileMap.get(row.file_path);
            if (existing) {
                existing.content += "\n" + row.content;
                existing.lineCount = existing.content.split("\n").length;
                if (row.symbol_name && row.symbol_type) {
                    existing.symbols.push({
                        name: row.symbol_name,
                        type: row.symbol_type,
                        startLine: row.start_line || 0,
                        endLine: row.end_line || 0,
                        language: row.language || "unknown",
                        parentSymbol: null,
                        content: row.content,
                    });
                }
            } else {
                const symbols = [];
                if (row.symbol_name && row.symbol_type) {
                    symbols.push({
                        name: row.symbol_name,
                        type: row.symbol_type,
                        startLine: row.start_line || 0,
                        endLine: row.end_line || 0,
                        language: row.language || "unknown",
                        parentSymbol: null,
                        content: row.content,
                    });
                }
                fileMap.set(row.file_path, {
                    filePath: row.file_path,
                    language: row.language || "unknown",
                    content: row.content,
                    symbols,
                    imports: [],
                    exports: [],
                    fileSize: row.content.length,
                    lineCount: row.content.split("\n").length,
                });
            }
        }

        const parsedFiles = Array.from(fileMap.values());
        const report = analyzeRepository(parsedFiles);

        return NextResponse.json({
            healthScore: repository.health_score || report.healthScore,
            totalFiles: report.totalFiles,
            topRisks: report.topRisks.map((m) => ({
                filePath: m.filePath,
                lineCount: m.lineCount,
                functionCount: m.functionCount,
                maxFunctionLength: m.maxFunctionLength,
                maxCyclomaticComplexity: m.maxCyclomaticComplexity,
                maxNestingDepth: m.maxNestingDepth,
                riskScore: m.riskScore,
                isGiantFile: m.isGiantFile,
            })),
            summary: report.summary,
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
