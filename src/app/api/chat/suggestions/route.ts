import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { llmComplete } from "@/lib/llm/llmRouter";

export async function GET(request: NextRequest) {
    try {
        const repositoryId = request.nextUrl.searchParams.get("repositoryId");

        if (!repositoryId) {
            return NextResponse.json(
                { error: "repositoryId is required" },
                { status: 400 }
            );
        }

        const { data: repository } = await supabase
            .from("repositories")
            .select("id, full_name, status, file_count, languages_json")
            .eq("id", repositoryId)
            .single();

        if (!repository || repository.status !== "completed") {
            return NextResponse.json(
                { error: "Repository is not indexed" },
                { status: 400 }
            );
        }

        const { data: symbolSummary } = await supabase
            .from("repository_files")
            .select("file_path, symbol_name, symbol_type, language")
            .eq("repository_id", repositoryId)
            .not("symbol_name", "is", null)
            .limit(50);

        const uniquePaths = [...new Set((symbolSummary || []).map((f) => f.file_path))];
        const symbolNames = [...new Set((symbolSummary || []).filter((s) => s.symbol_name).map((s) => `${s.symbol_type}: ${s.symbol_name}`))];
        const languages = repository.languages_json ? Object.keys(repository.languages_json) : [];

        const fileSummary = uniquePaths.slice(0, 25).join("\n");
        const symbolList = symbolNames.slice(0, 20).join("\n");
        const langList = languages.join(", ");

        const prompt = `You are analyzing a GitHub repository called "${repository.full_name}".

Here are its key files:
${fileSummary}

Key symbols (functions, classes, interfaces):
${symbolList}

Languages used: ${langList}

Generate exactly 3 specific, insightful questions a developer would ask about THIS exact codebase. The questions must:
- Reference actual file names, function names, or patterns visible above
- Be specific to this repo (not generic)
- Cover different aspects: architecture, a specific feature/function, and code quality/patterns
- Be concise (under 15 words each)

Return ONLY a JSON array of 3 strings, nothing else. Example format:
["question 1", "question 2", "question 3"]`;

        const { text: raw } = await llmComplete(
            [{ role: "user", content: prompt }],
            { temperature: 0.8, max_tokens: 256 }
        );
        let suggestions: string[];

        try {
            const jsonMatch = raw.match(/\[[\s\S]*\]/);
            suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch {
            suggestions = [
                `How is ${repository.full_name} structured and what are the key modules?`,
                `What design patterns are used across the codebase?`,
                `Walk me through the main data flow in this application.`,
            ];
        }

        if (!Array.isArray(suggestions) || suggestions.length < 3) {
            suggestions = [
                `How is ${repository.full_name} structured and what are the key modules?`,
                `What design patterns are used across the codebase?`,
                `Walk me through the main data flow in this application.`,
            ];
        }

        return NextResponse.json({
            suggestions: suggestions.slice(0, 3),
            repoName: repository.full_name,
            fileCount: repository.file_count || uniquePaths.length,
        });
    } catch (error) {
        const repoId = request.nextUrl.searchParams.get("repositoryId");
        const fallback = [
            "What is the overall architecture of this codebase?",
            "What are the most critical files and their responsibilities?",
            "How does the data flow through the application?",
        ];
        return NextResponse.json({
            suggestions: fallback,
            repoName: repoId || "unknown",
            fileCount: 0,
            error: error instanceof Error ? error.message : "Failed to generate suggestions",
        });
    }
}
