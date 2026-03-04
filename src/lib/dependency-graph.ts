import type { ParsedFile, DependencyEdge, DependencyGraph } from "./types";

export function buildDependencyGraph(parsedFiles: ParsedFile[]): DependencyGraph {
    const edges: DependencyEdge[] = [];
    const adjacency = new Map<string, Set<string>>();
    const reverseAdjacency = new Map<string, Set<string>>();

    const filePathIndex = new Map<string, string>();
    for (const file of parsedFiles) {
        const normalized = normalizePath(file.filePath);
        filePathIndex.set(normalized, file.filePath);

        const withoutExt = removeExtension(normalized);
        if (!filePathIndex.has(withoutExt)) {
            filePathIndex.set(withoutExt, file.filePath);
        }

        const basename = normalized.split("/").pop() || "";
        const basenameNoExt = removeExtension(basename);
        if (!filePathIndex.has(basenameNoExt)) {
            filePathIndex.set(basenameNoExt, file.filePath);
        }
    }

    for (const file of parsedFiles) {
        const sourceDir = getDirectory(file.filePath);

        for (const imp of file.imports) {
            const resolved = resolveImportPath(imp.source, sourceDir, filePathIndex);
            if (resolved && resolved !== file.filePath) {
                const edge: DependencyEdge = {
                    sourcePath: file.filePath,
                    targetPath: resolved,
                    edgeType: "import",
                    specifiers: imp.specifiers,
                };
                edges.push(edge);

                if (!adjacency.has(file.filePath)) adjacency.set(file.filePath, new Set());
                adjacency.get(file.filePath)!.add(resolved);

                if (!reverseAdjacency.has(resolved)) reverseAdjacency.set(resolved, new Set());
                reverseAdjacency.get(resolved)!.add(file.filePath);
            }
        }

        for (const exp of file.exports) {
            if (exp.isDefault) continue;
            const reExportMatch = file.content.match(
                new RegExp(`export\\s+\\{[^}]*${exp.name}[^}]*\\}\\s+from\\s+["']([^"']+)["']`)
            );
            if (reExportMatch) {
                const resolved = resolveImportPath(reExportMatch[1], sourceDir, filePathIndex);
                if (resolved && resolved !== file.filePath) {
                    edges.push({
                        sourcePath: file.filePath,
                        targetPath: resolved,
                        edgeType: "re-export",
                        specifiers: [exp.name],
                    });

                    if (!adjacency.has(file.filePath)) adjacency.set(file.filePath, new Set());
                    adjacency.get(file.filePath)!.add(resolved);

                    if (!reverseAdjacency.has(resolved)) reverseAdjacency.set(resolved, new Set());
                    reverseAdjacency.get(resolved)!.add(file.filePath);
                }
            }
        }
    }

    return { edges, adjacency, reverseAdjacency };
}

export function getRelatedFiles(
    filePath: string,
    graph: DependencyGraph,
    depth: number = 2
): string[] {
    const visited = new Set<string>();
    const queue: Array<{ path: string; level: number }> = [{ path: filePath, level: 0 }];
    visited.add(filePath);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.level >= depth) continue;

        const forward = graph.adjacency.get(current.path);
        if (forward) {
            for (const neighbor of forward) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push({ path: neighbor, level: current.level + 1 });
                }
            }
        }

        const reverse = graph.reverseAdjacency.get(current.path);
        if (reverse) {
            for (const neighbor of reverse) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push({ path: neighbor, level: current.level + 1 });
                }
            }
        }
    }

    visited.delete(filePath);
    return Array.from(visited);
}

export function serializeGraph(graph: DependencyGraph): {
    edges: DependencyEdge[];
    adjacency: Record<string, string[]>;
} {
    const adj: Record<string, string[]> = {};
    for (const [key, val] of graph.adjacency) {
        adj[key] = Array.from(val);
    }
    return { edges: graph.edges, adjacency: adj };
}

function normalizePath(p: string): string {
    return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function removeExtension(p: string): string {
    const lastDot = p.lastIndexOf(".");
    const lastSlash = p.lastIndexOf("/");
    if (lastDot > lastSlash) {
        return p.slice(0, lastDot);
    }
    return p;
}

function getDirectory(filePath: string): string {
    const normalized = normalizePath(filePath);
    const lastSlash = normalized.lastIndexOf("/");
    if (lastSlash === -1) return "";
    return normalized.slice(0, lastSlash);
}

function resolveImportPath(
    importSource: string,
    sourceDir: string,
    fileIndex: Map<string, string>
): string | null {
    const normalized = normalizePath(importSource);

    if (!normalized.startsWith(".") && !normalized.startsWith("/")) {
        const direct = fileIndex.get(normalized);
        if (direct) return direct;
        return null;
    }

    let resolved: string;
    if (normalized.startsWith("/")) {
        resolved = normalized.slice(1);
    } else {
        const parts = sourceDir.split("/").filter(Boolean);
        const importParts = normalized.split("/");
        for (const part of importParts) {
            if (part === ".") continue;
            if (part === "..") {
                parts.pop();
            } else {
                parts.push(part);
            }
        }
        resolved = parts.join("/");
    }

    const exact = fileIndex.get(resolved);
    if (exact) return exact;

    const withoutExt = removeExtension(resolved);
    const tryExtensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java"];
    for (const ext of tryExtensions) {
        const candidate = fileIndex.get(withoutExt + ext) || fileIndex.get(resolved + ext);
        if (candidate) return candidate;
    }

    const indexCandidates = ["/index.ts", "/index.tsx", "/index.js", "/index.jsx"];
    for (const idx of indexCandidates) {
        const candidate = fileIndex.get(resolved + idx);
        if (candidate) return candidate;
    }

    const withoutExtKey = fileIndex.get(withoutExt);
    if (withoutExtKey) return withoutExtKey;

    return null;
}
