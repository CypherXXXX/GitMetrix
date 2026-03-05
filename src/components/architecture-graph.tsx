"use client";

import { useState, useCallback, useMemo, useEffect, memo } from "react";
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Handle,
    Position,
    type Node,
    type Edge,
    type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import {
    FileCode2,
    AlertTriangle,
    X,
    ArrowRight,
    ArrowLeft,
    Layers,
    CircleDot,
} from "lucide-react";

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

interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    circularDependencies: string[];
    stats: {
        totalFiles: number;
        totalEdges: number;
        circularCount: number;
    };
}

const IMPORTANCE_COLORS = [
    "#3B82F6",
    "#6366F1",
    "#8B5CF6",
    "#A855F7",
    "#D946EF",
    "#EC4899",
    "#EF4444",
];

function getNodeColor(importance: number, isCircular: boolean): string {
    if (isCircular) return "#EF4444";
    const index = Math.min(
        Math.floor(importance * IMPORTANCE_COLORS.length),
        IMPORTANCE_COLORS.length - 1
    );
    return IMPORTANCE_COLORS[index];
}

const LANGUAGE_COLORS: Record<string, string> = {
    typescript: "#3178C6",
    javascript: "#F7DF1E",
    python: "#3776AB",
    rust: "#DEA584",
    go: "#00ADD8",
    java: "#ED8B00",
    ruby: "#CC342D",
    php: "#777BB4",
    css: "#264DE4",
    html: "#E34F26",
};

function CustomNode({ data }: NodeProps) {
    const nodeData = data as unknown as {
        label: string;
        directory: string;
        language: string | null;
        importance: number;
        isCircular: boolean;
        inDegree: number;
        outDegree: number;
        onSelect: (id: string) => void;
        id: string;
    };

    const bgColor = getNodeColor(nodeData.importance, nodeData.isCircular);
    const langColor = nodeData.language
        ? LANGUAGE_COLORS[nodeData.language] || "#6366F1"
        : "#6366F1";
    const size = 28 + nodeData.importance * 32;

    return (
        <>
            <Handle type="target" position={Position.Left} className="bg-white/20! border-0! w-1.5! h-1.5!" />
            <div
                onClick={() => nodeData.onSelect(nodeData.id)}
                className="group relative cursor-pointer"
                style={{ width: size, height: size }}
            >
                <div
                    className="absolute inset-0 rounded-full opacity-30 blur-sm transition-opacity group-hover:opacity-60"
                    style={{ backgroundColor: bgColor }}
                />
                <div
                    className="absolute inset-0 rounded-full border-2 transition-all group-hover:scale-110"
                    style={{
                        backgroundColor: `${bgColor}33`,
                        borderColor: bgColor,
                    }}
                />
                {nodeData.isCircular && (
                    <div className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-red-500">
                        <AlertTriangle className="h-2 w-2 text-white" />
                    </div>
                )}
                <div
                    className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium opacity-70 group-hover:opacity-100"
                    style={{ color: langColor }}
                >
                    {nodeData.label}
                </div>
            </div>
            <Handle type="source" position={Position.Right} className="bg-white/20! border-0! w-1.5! h-1.5!" />
        </>
    );
}

const MemoizedCustomNode = memo(CustomNode);

const nodeTypes = { custom: MemoizedCustomNode };

function NodeDetailPanel({
    node,
    onClose,
}: {
    node: GraphNode;
    onClose: () => void;
}) {
    const color = getNodeColor(node.importance, node.isCircular);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-4 top-4 z-50 w-72 rounded-2xl border border-white/10 bg-[#0a0a0a]/95 p-4 backdrop-blur-2xl sm:w-80"
        >
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileCode2 className="h-4 w-4" style={{ color }} />
                    <span className="text-sm font-semibold text-white">
                        {node.label}
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="mb-3 rounded-xl bg-white/3 px-3 py-2 text-[11px] font-mono text-zinc-400">
                {node.id}
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/5 bg-white/2 p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                        <ArrowLeft className="h-3 w-3 text-blue-400" />
                        <span className="font-mono text-lg font-bold text-white">
                            {node.inDegree}
                        </span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Dependents</span>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/2 p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                        <ArrowRight className="h-3 w-3 text-purple-400" />
                        <span className="font-mono text-lg font-bold text-white">
                            {node.outDegree}
                        </span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Dependencies</span>
                </div>
            </div>

            <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Directory</span>
                    <span className="font-mono text-zinc-300">{node.directory || "/"}</span>
                </div>
                {node.language && (
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500">Language</span>
                        <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                                backgroundColor: `${LANGUAGE_COLORS[node.language] || "#6366F1"}20`,
                                color: LANGUAGE_COLORS[node.language] || "#6366F1",
                            }}
                        >
                            {node.language}
                        </span>
                    </div>
                )}
                <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Importance</span>
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/5">
                            <div
                                className="h-full rounded-full"
                                style={{
                                    width: `${node.importance * 100}%`,
                                    backgroundColor: color,
                                }}
                            />
                        </div>
                        <span className="font-mono text-zinc-300">
                            {Math.round(node.importance * 100)}%
                        </span>
                    </div>
                </div>
                {node.isCircular && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400">
                        <AlertTriangle className="h-3 w-3" />
                        Circular dependency detected
                    </div>
                )}
            </div>
        </motion.div>
    );
}

interface ArchitectureGraphProps {
    repositoryId: string;
}

export function ArchitectureGraph({ repositoryId }: ArchitectureGraphProps) {
    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    const handleNodeSelect = useCallback(
        (nodeId: string) => {
            if (!graphData) return;
            const node = graphData.nodes.find((n) => n.id === nodeId) || null;
            setSelectedNode(node);
        },
        [graphData]
    );

    useEffect(() => {
        async function loadGraph() {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(
                    `/api/architecture/graph?repositoryId=${repositoryId}`
                );
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || "Failed to load graph");
                }
                const data: GraphData = await response.json();
                setGraphData(data);

                const directories = new Map<string, GraphNode[]>();
                for (const node of data.nodes) {
                    const dir = node.directory || "/";
                    if (!directories.has(dir)) directories.set(dir, []);
                    directories.get(dir)!.push(node);
                }

                let globalY = 0;
                const flowNodes: Node[] = [];
                const dirEntries = Array.from(directories.entries()).sort(
                    (a, b) => b[1].length - a[1].length
                );

                for (const [, dirNodes] of dirEntries) {
                    const sorted = dirNodes.sort((a, b) => b.importance - a.importance);
                    const cols = Math.ceil(Math.sqrt(sorted.length));

                    for (let i = 0; i < sorted.length; i++) {
                        const node = sorted[i];
                        const col = i % cols;
                        const row = Math.floor(i / cols);

                        flowNodes.push({
                            id: node.id,
                            type: "custom",
                            position: {
                                x: col * 160 + Math.random() * 20,
                                y: globalY + row * 100 + Math.random() * 20,
                            },
                            data: {
                                ...node,
                                onSelect: handleNodeSelect,
                            },
                        });
                    }

                    globalY += (Math.ceil(dirNodes.length / Math.ceil(Math.sqrt(dirNodes.length)))) * 100 + 80;
                }

                const flowEdges: Edge[] = data.edges.map((e, i) => ({
                    id: `e-${i}`,
                    source: e.source,
                    target: e.target,
                    animated: e.edgeType === "re-export",
                    style: {
                        stroke:
                            data.circularDependencies.includes(e.source) &&
                                data.circularDependencies.includes(e.target)
                                ? "#EF4444"
                                : "#ffffff15",
                        strokeWidth: 1,
                    },
                    type: "default",
                }));

                setNodes(flowNodes);
                setEdges(flowEdges);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load graph");
            } finally {
                setLoading(false);
            }
        }

        loadGraph();
    }, [repositoryId, handleNodeSelect, setNodes, setEdges]);

    const statsDisplay = useMemo(() => {
        if (!graphData) return null;
        return (
            <div className="absolute left-4 top-4 z-40 flex items-center gap-3 rounded-xl border border-white/8 bg-[#0a0a0a]/90 px-4 py-2.5 backdrop-blur-2xl">
                <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-xs text-zinc-400">
                        <span className="font-mono font-semibold text-white">{graphData.stats.totalFiles}</span> files
                    </span>
                </div>
                <div className="h-3 w-px bg-white/10" />
                <div className="flex items-center gap-1.5">
                    <CircleDot className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-xs text-zinc-400">
                        <span className="font-mono font-semibold text-white">{graphData.stats.totalEdges}</span> edges
                    </span>
                </div>
                {graphData.stats.circularCount > 0 && (
                    <>
                        <div className="h-3 w-px bg-white/10" />
                        <div className="flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                            <span className="text-xs text-red-400">
                                <span className="font-mono font-semibold">{graphData.stats.circularCount}</span> circular
                            </span>
                        </div>
                    </>
                )}
            </div>
        );
    }, [graphData]);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/20 border-t-indigo-500" />
                    <span className="text-sm text-zinc-500">Loading architecture graph...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center">
                    <AlertTriangle className="h-8 w-8 text-red-400" />
                    <span className="text-sm text-red-400">{error}</span>
                </div>
            </div>
        );
    }

    if (!graphData || graphData.nodes.length === 0) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center">
                    <Layers className="h-8 w-8 text-zinc-600" />
                    <span className="text-sm text-zinc-500">No dependency data available</span>
                    <span className="text-xs text-zinc-600">Index a repository first to see its architecture</span>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full">
            {statsDisplay}
            <AnimatePresence>
                {selectedNode && (
                    <NodeDetailPanel
                        node={selectedNode}
                        onClose={() => setSelectedNode(null)}
                    />
                )}
            </AnimatePresence>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.1}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
                className="bg-void"
            >
                <Background
                    gap={40}
                    size={1}
                    color="#ffffff06"
                />
                <Controls
                    className="bg-[#0a0a0a]/90! border-white/8! rounded-xl! [&>button]:bg-transparent! [&>button]:border-white/5! [&>button]:text-zinc-400! [&>button:hover]:bg-white/5! [&>button:hover]:text-white!"
                    showInteractive={false}
                />
                <MiniMap
                    className="bg-[#0a0a0a]/90! border-white/8! rounded-xl!"
                    nodeColor={(node) => {
                        const d = node.data as unknown as { importance: number; isCircular: boolean };
                        return getNodeColor(d?.importance || 0, d?.isCircular || false);
                    }}
                    maskColor="#00000080"
                />
            </ReactFlow>
        </div>
    );
}
