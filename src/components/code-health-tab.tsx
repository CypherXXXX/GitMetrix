"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
    Shield,
    AlertTriangle,
    FileCode2,
    Layers,
    Activity,
    Loader2,
    Lightbulb,
    BarChart3,
} from "lucide-react";
import { Card } from "@/components/ui/card";

interface RiskFile {
    filePath: string;
    lineCount: number;
    functionCount: number;
    maxFunctionLength: number;
    riskScore: number;
    maxCyclomaticComplexity?: number;
    maxNestingDepth?: number;
    isGiantFile?: boolean;
}

interface HealthData {
    healthScore: number;
    totalFiles: number;
    topRisks: RiskFile[];
    summary: {
        giantFiles: number;
        highComplexity: number;
        deepNesting: number;
        avgRiskScore: number;
    };
    recommendations: string[];
}

function HealthGauge({ score }: { score: number }) {
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";
    const label = score >= 80 ? "Healthy" : score >= 60 ? "Fair" : "At Risk";

    return (
        <Card className="flex flex-col items-center justify-center p-6" glowColor={`${color}33`}>
            <div className="mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" style={{ color }} />
                <span className="text-sm font-medium text-zinc-400">Code Health</span>
            </div>
            <div className="relative h-32 w-32">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#27272A" strokeWidth="5" />
                    <circle
                        cx="50" cy="50" r="45" fill="none"
                        stroke={color} strokeWidth="5" strokeLinecap="round"
                        strokeDasharray={circumference} strokeDashoffset={offset}
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono text-3xl font-bold text-white">{score}</span>
                    <span className="text-[10px]" style={{ color }}>{label}</span>
                </div>
            </div>
        </Card>
    );
}

interface CodeHealthTabProps {
    repositoryId: string;
}

export function CodeHealthTab({ repositoryId }: CodeHealthTabProps) {
    const [data, setData] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [recommendations, setRecommendations] = useState<string[]>([]);
    const [loadingRecs, setLoadingRecs] = useState(false);

    useEffect(() => {
        async function loadHealthData() {
            setLoading(true);
            try {
                const response = await fetch(`/api/code-health?repositoryId=${repositoryId}`);
                if (response.ok) {
                    const result = await response.json();
                    setData(result);
                    if (result.recommendations?.length > 0) {
                        setRecommendations(result.recommendations);
                    }
                }
            } catch (_) { }
            setLoading(false);
        }
        loadHealthData();
    }, [repositoryId]);

    const loadRecommendations = useCallback(async () => {
        setLoadingRecs(true);
        try {
            const response = await fetch("/api/code-health", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ repositoryId }),
            });
            if (response.ok) {
                const result = await response.json();
                setRecommendations(result.recommendations || []);
            }
        } catch (_) { }
        setLoadingRecs(false);
    }, [repositoryId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
                <Shield className="h-8 w-8 text-zinc-600" />
                <span className="text-sm text-zinc-500">No health data available</span>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
        >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                <HealthGauge score={data.healthScore} />

                <Card className="p-4" glowColor="rgba(99, 102, 241, 0.15)">
                    <div className="mb-3 flex items-center gap-2">
                        <Layers className="h-4 w-4 text-indigo-400" />
                        <span className="text-xs font-medium text-zinc-400">Files Analyzed</span>
                    </div>
                    <span className="font-mono text-3xl font-bold text-white">{data.totalFiles}</span>
                </Card>

                <Card className="p-4" glowColor="rgba(245, 158, 11, 0.15)">
                    <div className="mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        <span className="text-xs font-medium text-zinc-400">Issues Found</span>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-500">Giant Files</span>
                            <span className="font-mono font-semibold text-amber-400">{data.summary.giantFiles}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-500">High Complexity</span>
                            <span className="font-mono font-semibold text-red-400">{data.summary.highComplexity}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-500">Deep Nesting</span>
                            <span className="font-mono font-semibold text-purple-400">{data.summary.deepNesting}</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-4" glowColor="rgba(168, 85, 247, 0.15)">
                    <div className="mb-3 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-purple-400" />
                        <span className="text-xs font-medium text-zinc-400">Avg Risk Score</span>
                    </div>
                    <span className="font-mono text-3xl font-bold text-white">{data.summary.avgRiskScore}</span>
                    <span className="ml-1 text-xs text-zinc-500">/ 100</span>
                </Card>
            </div>

            {data.topRisks.length > 0 && (
                <Card className="p-5" glowColor="rgba(239, 68, 68, 0.1)">
                    <div className="mb-4 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-red-400" />
                        <span className="text-sm font-semibold text-white">Highest Risk Files</span>
                    </div>
                    <div className="space-y-2">
                        {data.topRisks.map((file, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/2 px-3 py-2.5 sm:px-4"
                            >
                                <div className="flex items-center gap-3">
                                    <FileCode2 className="h-3.5 w-3.5 text-zinc-500" />
                                    <div>
                                        <span className="text-xs font-medium text-zinc-200 sm:text-sm">
                                            {file.filePath.split("/").pop()}
                                        </span>
                                        <div className="flex gap-2 text-[10px] text-zinc-600">
                                            <span>{file.lineCount} lines</span>
                                            <span>{file.functionCount} functions</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/5 sm:w-24">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${file.riskScore}%`,
                                                backgroundColor:
                                                    file.riskScore >= 60
                                                        ? "#EF4444"
                                                        : file.riskScore >= 30
                                                            ? "#F59E0B"
                                                            : "#10B981",
                                            }}
                                        />
                                    </div>
                                    <span className="w-8 text-right font-mono text-xs font-semibold text-zinc-300">
                                        {file.riskScore}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Card className="p-5" glowColor="rgba(16, 185, 129, 0.1)">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm font-semibold text-white">AI Recommendations</span>
                    </div>
                    <button
                        onClick={loadRecommendations}
                        disabled={loadingRecs}
                        className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/3 px-3 py-1.5 text-[11px] text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
                    >
                        {loadingRecs ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <Lightbulb className="h-3 w-3" />
                        )}
                        Generate
                    </button>
                </div>
                {recommendations.length > 0 ? (
                    <div className="space-y-2">
                        {recommendations.map((rec, idx) => (
                            <div
                                key={idx}
                                className="flex gap-2.5 rounded-xl border border-emerald-500/10 bg-emerald-500/5 px-3 py-2.5"
                            >
                                <span className="mt-0.5 font-mono text-[10px] text-emerald-400">
                                    {idx + 1}
                                </span>
                                <span className="text-xs text-zinc-300">{rec}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-zinc-600">
                        Click Generate to get AI-powered refactoring recommendations
                    </p>
                )}
            </Card>
        </motion.div>
    );
}
