"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Users,
    TrendingUp,
    Shield,
    Loader2,
    Crown,
    BarChart3,
} from "lucide-react";
import { Card } from "@/components/ui/card";

interface AnalyticsData {
    busFactor: number;
    influenceScores: Array<{ username: string; score: number }>;
    codeOwnership: Array<{ area: string; owner: string; percentage: number }>;
}

const INFLUENCE_COLORS = [
    "#6366F1", "#8B5CF6", "#A855F7", "#D946EF",
    "#EC4899", "#F43F5E", "#EF4444", "#F97316",
];

interface AnalyticsTabProps {
    username: string;
}

export function AnalyticsTab({ username }: AnalyticsTabProps) {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadAnalytics() {
            setLoading(true);
            try {
                const response = await fetch(`/api/analytics?username=${username}`);
                if (response.ok) {
                    const result = await response.json();
                    setData(result);
                }
            } catch (_) { }
            setLoading(false);
        }
        loadAnalytics();
    }, [username]);

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
                <BarChart3 className="h-8 w-8 text-zinc-600" />
                <span className="text-sm text-zinc-500">No analytics data available</span>
            </div>
        );
    }

    const busFactorColor =
        data.busFactor <= 1 ? "#EF4444" : data.busFactor <= 3 ? "#F59E0B" : "#10B981";
    const busFactorLabel =
        data.busFactor <= 1
            ? "High risk — single contributor dependency"
            : data.busFactor <= 3
                ? "Moderate risk — few key contributors"
                : "Healthy — well-distributed knowledge";

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
        >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card className="p-6" glowColor="rgba(239, 68, 68, 0.15)">
                    <div className="mb-4 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-red-400" />
                        <span className="text-sm font-medium text-zinc-400">Bus Factor</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="font-mono text-5xl font-bold text-gradient-primary">
                            {data.busFactor}
                        </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <div
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: busFactorColor }}
                        />
                        <span className="text-xs text-zinc-500">{busFactorLabel}</span>
                    </div>
                </Card>

                <Card className="p-6" glowColor="rgba(99, 102, 241, 0.15)">
                    <div className="mb-4 flex items-center gap-2">
                        <Users className="h-4 w-4 text-indigo-400" />
                        <span className="text-sm font-medium text-zinc-400">
                            Top Contributors
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="font-mono text-5xl font-bold text-white">
                            {data.influenceScores.length}
                        </span>
                    </div>
                    <p className="mt-3 text-xs text-zinc-500">active contributors</p>
                </Card>
            </div>

            {data.influenceScores.length > 0 && (
                <Card className="p-5" glowColor="rgba(168, 85, 247, 0.1)">
                    <div className="mb-4 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-purple-400" />
                        <span className="text-sm font-semibold text-white">
                            Contributor Influence
                        </span>
                    </div>
                    <div className="space-y-2.5">
                        {data.influenceScores.slice(0, 8).map((contributor, idx) => (
                            <div key={contributor.username} className="flex items-center gap-3">
                                <div className="flex w-5 items-center justify-center">
                                    {idx === 0 ? (
                                        <Crown className="h-3.5 w-3.5 text-amber-400" />
                                    ) : (
                                        <span className="font-mono text-[10px] text-zinc-600">
                                            {idx + 1}
                                        </span>
                                    )}
                                </div>
                                <span className="w-28 truncate text-xs font-medium text-zinc-300 sm:w-36">
                                    {contributor.username}
                                </span>
                                <div className="flex flex-1 items-center gap-2">
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${contributor.score}%` }}
                                            transition={{ duration: 0.8, delay: idx * 0.1 }}
                                            className="h-full rounded-full"
                                            style={{
                                                backgroundColor:
                                                    INFLUENCE_COLORS[idx % INFLUENCE_COLORS.length],
                                            }}
                                        />
                                    </div>
                                    <span className="w-8 text-right font-mono text-xs text-zinc-400">
                                        {contributor.score}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </motion.div>
    );
}
