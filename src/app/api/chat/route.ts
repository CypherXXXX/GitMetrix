import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";
import { routeComplete, routeStream } from "@/lib/llm/llmRouter";
import { cohereRerank, isCohereAvailable } from "@/lib/llm/cohere";
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

const PRIORITY_PATHS = ["src/", "app/", "lib/", "core/", "packages/", "server/"];

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

function boostSimilarity(match: MatchResult): number {
    const isPriority = PRIORITY_PATHS.some((p) => match.file_path.startsWith(p));
    return isPriority ? match.similarity * 1.15 : match.similarity;
}

async function generateQueryVariations(query: string): Promise<string[]> {
    try {
        const { text } = await routeComplete(
            "query_expansion",
            [
                {
                    role: "system",
                    content: "Generate exactly 2 alternative search queries for a codebase search. Return ONLY the queries, one per line. No numbering, no explanations.",
                },
                {
                    role: "user",
                    content: query,
                },
            ],
            { temperature: 0.7, max_tokens: 100 }
        );

        const variations = text
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 5)
            .slice(0, 2);

        return [query, ...variations];
    } catch (_) {
        return [query];
    }
}

async function multiQuerySearch(
    queries: string[],
    repositoryId: string
): Promise<MatchResult[]> {
    const seen = new Map<string, MatchResult>();

    for (const query of queries) {
        const queryEmbedding = await generateEmbedding(query);

        const { data: matches } = await supabase
            .rpc("match_file_chunks", {
                query_embedding: JSON.stringify(queryEmbedding),
                target_repository_id: repositoryId,
                match_threshold: 0.15,
                match_count: 8,
            });

        if (matches) {
            for (const match of matches as MatchResult[]) {
                const key = `${match.file_path}:${match.chunk_index}`;
                const existing = seen.get(key);
                if (!existing || match.similarity > existing.similarity) {
                    seen.set(key, match);
                }
            }
        }
    }

    return Array.from(seen.values());
}

async function fullTextSearch(
    query: string,
    repositoryId: string
): Promise<MatchResult[]> {
    const searchTerms = query
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 5)
        .join(" & ");

    if (!searchTerms) return [];

    const { data } = await supabase
        .from("repository_files")
        .select("id, file_path, content, chunk_index, symbol_name, symbol_type, language, start_line, end_line")
        .eq("repository_id", repositoryId)
        .textSearch("content", searchTerms, { type: "plain" })
        .limit(5);

    if (!data) return [];

    return data.map((row) => ({
        ...row,
        similarity: 0.4,
    }));
}

async function fetchNeighborChunks(
    matches: MatchResult[],
    repositoryId: string
): Promise<MatchResult[]> {
    const existingKeys = new Set(matches.map((m) => `${m.file_path}:${m.chunk_index}`));
    const neighbors: MatchResult[] = [];

    const topMatches = matches
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

    const neighborQueries: Array<{ filePath: string; indices: number[] }> = [];
    for (const match of topMatches) {
        const indices: number[] = [];
        const prev = match.chunk_index - 1;
        const next = match.chunk_index + 1;
        if (prev >= 0 && !existingKeys.has(`${match.file_path}:${prev}`)) indices.push(prev);
        if (!existingKeys.has(`${match.file_path}:${next}`)) indices.push(next);
        if (indices.length > 0) neighborQueries.push({ filePath: match.file_path, indices });
    }

    for (const nq of neighborQueries) {
        const { data } = await supabase
            .from("repository_files")
            .select("id, file_path, content, chunk_index, symbol_name, symbol_type, language, start_line, end_line")
            .eq("repository_id", repositoryId)
            .eq("file_path", nq.filePath)
            .in("chunk_index", nq.indices);

        if (data) {
            for (const chunk of data) {
                const key = `${chunk.file_path}:${chunk.chunk_index}`;
                if (!existingKeys.has(key)) {
                    existingKeys.add(key);
                    neighbors.push({ ...chunk, similarity: 0.35 });
                }
            }
        }
    }

    return neighbors;
}

async function rerankResults(
    query: string,
    matches: MatchResult[]
): Promise<MatchResult[]> {
    if (!isCohereAvailable() || matches.length === 0) {
        return matches
            .map((m) => ({ ...m, similarity: boostSimilarity(m) }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 12);
    }

    try {
        const documents = matches.map((m) => {
            const symbolInfo = m.symbol_name ? `[${m.symbol_type}: ${m.symbol_name}]` : "";
            return `${m.file_path} ${symbolInfo}\n${m.content}`;
        });

        const reranked = await cohereRerank(query, documents, 12);

        return reranked
            .map((r) => ({
                ...matches[r.index],
                similarity: r.relevanceScore,
            }))
            .sort((a, b) => b.similarity - a.similarity);
    } catch (_) {
        return matches
            .map((m) => ({ ...m, similarity: boostSimilarity(m) }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 12);
    }
}

function detectQueryType(message: string): boolean {
    const architectureKeywords = [
        "architecture", "flow", "how does", "how do", "system design",
        "data flow", "pipeline", "authentication", "auth flow",
        "request flow", "lifecycle", "how is", "trace"
    ];
    const lower = message.toLowerCase();
    return architectureKeywords.some((kw) => lower.includes(kw));
}

async function fetchDependencyContext(
    repositoryId: string,
    filePaths: string[]
): Promise<string> {
    const { data: depEdges } = await supabase
        .from("dependency_edges")
        .select("source_path, target_path, edge_type, specifiers")
        .eq("repository_id", repositoryId)
        .limit(100);

    if (!depEdges || depEdges.length === 0) return "";

    const relevantPaths = new Set(filePaths);
    const relevantEdges = depEdges.filter(
        (e: { source_path: string; target_path: string }) =>
            relevantPaths.has(e.source_path) || relevantPaths.has(e.target_path)
    );

    if (relevantEdges.length === 0) return "";

    return "\n\nDependency relationships between files in context:\n" +
        relevantEdges
            .map((e: { source_path: string; target_path: string; edge_type: string }) =>
                `${e.source_path} --[${e.edge_type}]--> ${e.target_path}`)
            .join("\n");
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

        const queryVariations = await generateQueryVariations(message);

        const [vectorMatches, ftsMatches] = await Promise.all([
            multiQuerySearch(queryVariations, repositoryId),
            fullTextSearch(message, repositoryId),
        ]);

        const mergedMap = new Map<string, MatchResult>();
        for (const match of vectorMatches) {
            const key = `${match.file_path}:${match.chunk_index}`;
            mergedMap.set(key, match);
        }
        for (const match of ftsMatches) {
            const key = `${match.file_path}:${match.chunk_index}`;
            if (!mergedMap.has(key)) {
                mergedMap.set(key, match);
            }
        }

        const mergedMatches = Array.from(mergedMap.values());
        const neighborChunks = await fetchNeighborChunks(mergedMatches, repositoryId);
        const allMatches = [...mergedMatches, ...neighborChunks];

        const rankedMatches = await rerankResults(message, allMatches);

        const fileReferences = rankedMatches.map((match) => ({
            filePath: match.file_path,
            chunkContent: match.content.slice(0, 200),
            similarityScore: Math.round(match.similarity * 100) / 100,
            symbolName: match.symbol_name,
            symbolType: match.symbol_type,
        }));

        const contextBlock = rankedMatches
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

        const depInfo = await fetchDependencyContext(
            repositoryId,
            rankedMatches.map((m) => m.file_path)
        );

        const isArchitectureQuery = detectQueryType(message);

        let contextMessage: string;
        if (contextBlock) {
            const archHint = isArchitectureQuery
                ? "\n\nThis appears to be an architecture/flow question. Pay special attention to the dependency relationships and trace the code flow step by step through multiple files."
                : "";
            contextMessage = `Here is the relevant code context from the repository "${repository.full_name}". Analyze every line carefully:\n\n${contextBlock}${depInfo}${archHint}`;
        } else {
            contextMessage = `No relevant code context was found in the repository "${repository.full_name}" for this query. Let the user know and suggest they ask about specific files or features.`;
        }

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

        const { stream } = await routeStream("chat_stream", messages, { temperature: 0.2, max_tokens: 4096 });

        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
            async start(controller) {
                try {
                    const referencesPayload = JSON.stringify({ fileReferences });
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: "references", data: referencesPayload })}\n\n`)
                    );

                    for await (const chunk of stream) {
                        if (chunk.content) {
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ type: "content", data: chunk.content })}\n\n`)
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
