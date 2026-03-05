import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface GraphNode {
    id: string;
    label: string;
    directory: string;
    language: string | null;
    inDegree: number;
    outDegree: number;
    importance: number;
    isCircular: boolean;
}

interface GraphEdge {
    source: string;
    target: string;
    edgeType: string;
    specifiers: string[];
}

function detectCircularDependencies(
    adjacency: Record<string, string[]>
): Set<string> {
    const circularNodes = new Set<string>();
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function dfs(node: string, path: string[]): void {
        visited.add(node);
        recursionStack.add(node);

        const neighbors = adjacency[node] || [];
        for (const neighbor of neighbors) {
            if (recursionStack.has(neighbor)) {
                const cycleStart = path.indexOf(neighbor);
                if (cycleStart !== -1) {
                    for (let i = cycleStart; i < path.length; i++) {
                        circularNodes.add(path[i]);
                    }
                    circularNodes.add(neighbor);
                }
            } else if (!visited.has(neighbor)) {
                dfs(neighbor, [...path, neighbor]);
            }
        }

        recursionStack.delete(node);
    }

    for (const node of Object.keys(adjacency)) {
        if (!visited.has(node)) {
            dfs(node, [node]);
        }
    }

    return circularNodes;
}

function getDirectory(filePath: string): string {
    const parts = filePath.split("/");
    parts.pop();
    return parts.join("/") || "/";
}

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
            .select("id, status, full_name")
            .eq("id", repositoryId)
            .single();

        if (!repository || repository.status !== "completed") {
            return NextResponse.json(
                { error: "Repository is not indexed" },
                { status: 400 }
            );
        }

        const { data: edges } = await supabase
            .from("dependency_edges")
            .select("source_path, target_path, edge_type, specifiers")
            .eq("repository_id", repositoryId);

        if (!edges || edges.length === 0) {
            return NextResponse.json({
                nodes: [],
                edges: [],
                circularDependencies: [],
                stats: { totalFiles: 0, totalEdges: 0, circularCount: 0 },
            });
        }

        const adjacency: Record<string, string[]> = {};
        const inDegreeMap = new Map<string, number>();
        const outDegreeMap = new Map<string, number>();
        const allPaths = new Set<string>();
        const languageMap = new Map<string, string | null>();

        for (const edge of edges) {
            allPaths.add(edge.source_path);
            allPaths.add(edge.target_path);

            if (!adjacency[edge.source_path]) adjacency[edge.source_path] = [];
            adjacency[edge.source_path].push(edge.target_path);

            outDegreeMap.set(edge.source_path, (outDegreeMap.get(edge.source_path) || 0) + 1);
            inDegreeMap.set(edge.target_path, (inDegreeMap.get(edge.target_path) || 0) + 1);
        }

        const pathsList = Array.from(allPaths);
        for (let i = 0; i < pathsList.length; i += 50) {
            const batch = pathsList.slice(i, i + 50);
            const { data: files } = await supabase
                .from("repository_files")
                .select("file_path, language")
                .eq("repository_id", repositoryId)
                .in("file_path", batch)
                .limit(50);

            if (files) {
                for (const file of files) {
                    if (!languageMap.has(file.file_path)) {
                        languageMap.set(file.file_path, file.language);
                    }
                }
            }
        }

        const circularNodes = detectCircularDependencies(adjacency);

        const maxDegree = Math.max(
            1,
            ...Array.from(allPaths).map(
                (p) => (inDegreeMap.get(p) || 0) + (outDegreeMap.get(p) || 0)
            )
        );

        const nodes: GraphNode[] = Array.from(allPaths).map((path) => {
            const inDeg = inDegreeMap.get(path) || 0;
            const outDeg = outDegreeMap.get(path) || 0;
            const importance = (inDeg + outDeg) / maxDegree;

            return {
                id: path,
                label: path.split("/").pop() || path,
                directory: getDirectory(path),
                language: languageMap.get(path) || null,
                inDegree: inDeg,
                outDegree: outDeg,
                importance,
                isCircular: circularNodes.has(path),
            };
        });

        const graphEdges: GraphEdge[] = edges.map((e) => ({
            source: e.source_path,
            target: e.target_path,
            edgeType: e.edge_type,
            specifiers: e.specifiers || [],
        }));

        return NextResponse.json({
            nodes,
            edges: graphEdges,
            circularDependencies: Array.from(circularNodes),
            stats: {
                totalFiles: nodes.length,
                totalEdges: graphEdges.length,
                circularCount: circularNodes.size,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
