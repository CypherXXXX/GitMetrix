import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";
import { groq, GROQ_MODEL } from "@/lib/groq";
import { ChatMessageSchema } from "@/lib/validators";

const SYSTEM_PROMPT = `You are GitMetrix AI, a senior software engineer and expert code analyst embedded in a developer tool. Your job is to deeply analyze GitHub repository codebases and provide precise, insightful answers.

ANALYSIS APPROACH:
- Read every line of the provided code context carefully before answering
- Trace imports, exports, and function calls to understand how modules connect
- Identify design patterns (MVC, pub-sub, middleware chains, hooks, HOCs, etc.)
- Understand the data flow: where data enters, how it transforms, where it goes
- Recognize the tech stack from imports and file patterns
- Notice code quality patterns: error handling, validation, typing, testing
- Use the symbol metadata (function names, class names, line ranges) provided in context blocks

RESPONSE FORMATTING:
- Use **bold** for file names, function names, class names, and key terms
- Use proper markdown headers (## and ###) to organize long answers
- Use bullet points and numbered lists for multiple items
- Use fenced code blocks with language tags for code examples
- Reference specific files using [file:path/to/file.ts] format so users can navigate
- Include line numbers when referencing specific code: [file:path/to/file.ts:L45-78]
- Keep paragraphs short (2-3 sentences max)
- Start answers directly — never repeat the question back
- Be thorough but well-organized

RESPONSE PATTERNS:
- Architecture questions → Map out components, their responsibilities, and connections using dependency information
- "How does X work?" → Step-by-step flow tracing through actual files with code references
- "Explain this file" → Purpose, key functions/classes, dependencies, who calls it
- Feature questions → Identify all files involved, the data flow, and key logic
- Code quality → Point out patterns, potential issues, and suggest improvements

CRITICAL RULES:
- Always reference actual file paths from the context — never make up file names
- If context is insufficient, clearly state what information is missing
- When showing code examples, use exact code from the context, not invented code
- Provide actionable insights, not just descriptions
- Connect the dots between files — show how they work together
- Use symbol names (function/class names) to provide precise references`;

interface MatchResult {
    id: string;
    file_path: string;
    content: string;
    chunk_index: number;
    similarity: number;
    symbol_name: string | null;
    symbol_type: string | null;
    language: string | null;
    start_line: number | null;
    end_line: number | null;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validation = ChatMessageSchema.safeParse(body);

        if (!validation.success) {
            return new Response(
                JSON.stringify({ error: validation.error.issues[0].message }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const { repositoryId, message, history } = validation.data;

        const { data: repository } = await supabase
            .from("repositories")
            .select("id, status, full_name")
            .eq("id", repositoryId)
            .single();

        if (!repository || repository.status !== "completed") {
            return new Response(
                JSON.stringify({ error: "Repository is not indexed yet" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const queryEmbedding = await generateEmbedding(message);

        const { data: matches, error: matchError } = await supabase
            .rpc("match_file_chunks", {
                query_embedding: JSON.stringify(queryEmbedding),
                target_repository_id: repositoryId,
                match_threshold: 0.15,
                match_count: 10,
            });

        if (matchError) {
            throw new Error(`Vector search failed: ${matchError.message}`);
        }

        const typedMatches = (matches as MatchResult[]) || [];

        const expandedContext = await expandContext(typedMatches, repositoryId);

        const fileReferences = expandedContext.map((match) => ({
            filePath: match.file_path,
            chunkContent: match.content.slice(0, 200),
            similarityScore: Math.round(match.similarity * 100) / 100,
            symbolName: match.symbol_name,
            symbolType: match.symbol_type,
        }));

        const contextBlock = expandedContext
            .map((match, i) => {
                const symbolInfo = match.symbol_name
                    ? `[${match.symbol_type}: ${match.symbol_name}]`
                    : "[file-section]";
                const lineInfo = match.start_line && match.end_line
                    ? ` (lines ${match.start_line}-${match.end_line})`
                    : "";
                return `--- Context ${i + 1} ${symbolInfo} [${match.file_path}]${lineInfo} (relevance: ${match.similarity.toFixed(3)}) ---\n${match.content}`;
            })
            .join("\n\n");

        const { data: depEdges } = await supabase
            .from("dependency_edges")
            .select("source_path, target_path, edge_type")
            .eq("repository_id", repositoryId)
            .limit(50);

        let depInfo = "";
        if (depEdges && depEdges.length > 0) {
            const relevantPaths = new Set(expandedContext.map((m) => m.file_path));
            const relevantEdges = depEdges.filter(
                (e: { source_path: string; target_path: string }) =>
                    relevantPaths.has(e.source_path) || relevantPaths.has(e.target_path)
            );
            if (relevantEdges.length > 0) {
                depInfo = "\n\nDependency relationships between files in context:\n" +
                    relevantEdges
                        .map((e: { source_path: string; target_path: string; edge_type: string }) =>
                            `${e.source_path} --[${e.edge_type}]--> ${e.target_path}`)
                        .join("\n");
            }
        }

        const contextMessage = contextBlock
            ? `Here is the relevant code context from the repository "${repository.full_name}". Analyze every line carefully:\n\n${contextBlock}${depInfo}`
            : `No relevant code context was found in the repository "${repository.full_name}" for this query. Let the user know and suggest they ask about specific files or features.`;

        const filteredHistory = (history || []).filter(
            (msg) => msg.content !== message
        );

        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "system", content: contextMessage },
        ];

        for (const msg of filteredHistory) {
            messages.push({
                role: msg.role as "user" | "assistant",
                content: msg.content,
            });
        }

        messages.push({ role: "user", content: message });

        const stream = await groq.chat.completions.create({
            model: GROQ_MODEL,
            messages,
            temperature: 0.2,
            max_tokens: 4096,
            stream: true,
        });

        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
            async start(controller) {
                try {
                    const referencesPayload = JSON.stringify({ fileReferences });
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: "references", data: referencesPayload })}\n\n`)
                    );

                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content;
                        if (content) {
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ type: "content", data: content })}\n\n`)
                            );
                        }
                    }

                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
                    );
                } catch (streamError) {
                    const errorMessage = streamError instanceof Error ? streamError.message : "Stream error";
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: "error", data: errorMessage })}\n\n`)
                    );
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(readableStream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Internal server error";
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

async function expandContext(
    initialMatches: MatchResult[],
    repositoryId: string
): Promise<MatchResult[]> {
    if (initialMatches.length === 0) return [];

    const contextMap = new Map<string, MatchResult>();
    for (const match of initialMatches) {
        const key = `${match.file_path}:${match.chunk_index}`;
        contextMap.set(key, match);
    }

    const matchedFiles = [...new Set(initialMatches.map((m) => m.file_path))];
    const topFiles = matchedFiles.slice(0, 3);

    for (const filePath of topFiles) {
        const { data: sameFileChunks } = await supabase
            .from("repository_files")
            .select("id, file_path, content, chunk_index, symbol_name, symbol_type, language, start_line, end_line")
            .eq("repository_id", repositoryId)
            .eq("file_path", filePath)
            .order("chunk_index", { ascending: true })
            .limit(5);

        if (sameFileChunks) {
            for (const chunk of sameFileChunks) {
                const key = `${chunk.file_path}:${chunk.chunk_index}`;
                if (!contextMap.has(key)) {
                    contextMap.set(key, {
                        ...chunk,
                        similarity: 0.5,
                    });
                }
            }
        }
    }

    const { data: depEdges } = await supabase
        .from("dependency_edges")
        .select("target_path")
        .eq("repository_id", repositoryId)
        .in("source_path", topFiles)
        .limit(10);

    if (depEdges && depEdges.length > 0) {
        const depPaths = [...new Set(depEdges.map((e: { target_path: string }) => e.target_path))].slice(0, 3);

        for (const depPath of depPaths) {
            const { data: depChunks } = await supabase
                .from("repository_files")
                .select("id, file_path, content, chunk_index, symbol_name, symbol_type, language, start_line, end_line")
                .eq("repository_id", repositoryId)
                .eq("file_path", depPath)
                .order("chunk_index", { ascending: true })
                .limit(2);

            if (depChunks) {
                for (const chunk of depChunks) {
                    const key = `${chunk.file_path}:${chunk.chunk_index}`;
                    if (!contextMap.has(key)) {
                        contextMap.set(key, {
                            ...chunk,
                            similarity: 0.3,
                        });
                    }
                }
            }
        }
    }

    const allChunks = Array.from(contextMap.values());
    allChunks.sort((a, b) => b.similarity - a.similarity);
    return allChunks.slice(0, 15);
}
