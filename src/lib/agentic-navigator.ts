import { supabase } from "./supabase";
import { routeComplete } from "./llm/llmRouter";

interface NavigationResult {
    entryPoints: string[];
    traversalPath: string[];
    relatedFiles: Array<{ path: string; relevance: string }>;
    explanation: string;
}

async function detectEntryPoints(
    query: string,
    repositoryId: string
): Promise<string[]> {
    try {
        const { text } = await routeComplete(
            "query_expansion",
            [
                {
                    role: "system",
                    content: "Extract the key file names or module names from this code question. Return only file/module names, one per line. No explanations.",
                },
                { role: "user", content: query },
            ],
            { temperature: 0.1, max_tokens: 100 }
        );

        const terms = text
            .split("\n")
            .map((l) => l.trim().replace(/^[-*]\s*/, ""))
            .filter((l) => l.length > 1);

        const entryPoints: string[] = [];

        for (const term of terms.slice(0, 3)) {
            const { data } = await supabase
                .from("repository_files")
                .select("file_path")
                .eq("repository_id", repositoryId)
                .ilike("file_path", `%${term}%`)
                .limit(3);

            if (data) {
                for (const file of data) {
                    if (!entryPoints.includes(file.file_path)) {
                        entryPoints.push(file.file_path);
                    }
                }
            }
        }

        return entryPoints.slice(0, 5);
    } catch (_) {
        return [];
    }
}

async function traverseDependencyGraph(
    repositoryId: string,
    startPaths: string[],
    maxDepth: number = 3
): Promise<string[]> {
    const visited = new Set<string>(startPaths);
    let currentLevel = [...startPaths];

    for (let depth = 0; depth < maxDepth; depth++) {
        if (currentLevel.length === 0) break;

        const { data: edges } = await supabase
            .from("dependency_edges")
            .select("target_path")
            .eq("repository_id", repositoryId)
            .in("source_path", currentLevel);

        if (!edges || edges.length === 0) break;

        const nextLevel: string[] = [];
        for (const edge of edges) {
            if (!visited.has(edge.target_path)) {
                visited.add(edge.target_path);
                nextLevel.push(edge.target_path);
            }
        }

        currentLevel = nextLevel;
    }

    return Array.from(visited);
}

export async function navigateCodeFlow(
    query: string,
    repositoryId: string
): Promise<NavigationResult> {
    const entryPoints = await detectEntryPoints(query, repositoryId);

    if (entryPoints.length === 0) {
        return {
            entryPoints: [],
            traversalPath: [],
            relatedFiles: [],
            explanation: "Could not identify relevant entry points for this query.",
        };
    }

    const traversalPath = await traverseDependencyGraph(
        repositoryId,
        entryPoints
    );

    const relatedPaths = traversalPath.slice(0, 15);
    const relatedFiles: Array<{ path: string; relevance: string }> = [];

    for (const path of relatedPaths) {
        const isEntry = entryPoints.includes(path);
        relatedFiles.push({
            path,
            relevance: isEntry ? "entry_point" : "dependency",
        });
    }

    const fileList = relatedFiles
        .map((f) => `${f.path} (${f.relevance})`)
        .join("\n");

    const { text: explanation } = await routeComplete(
        "deep_reasoning",
        [
            {
                role: "system",
                content: "You are a code architect. Given the dependency traversal results, explain how the code flow works for the user's question. Reference specific files. Be concise but thorough.",
            },
            {
                role: "user",
                content: `Question: ${query}\n\nFiles found in dependency traversal:\n${fileList}`,
            },
        ],
        { temperature: 0.2, max_tokens: 1024 }
    );

    return {
        entryPoints,
        traversalPath,
        relatedFiles,
        explanation,
    };
}
