"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { BarChart3, Shield, TrendingUp, Loader2 } from "lucide-react";
import { DashboardContent } from "./dashboard-content";
import type { DashboardData } from "@/lib/types";

const CodeHealthTab = lazy(() =>
    import("./code-health-tab").then((m) => ({ default: m.CodeHealthTab }))
);

const AnalyticsTab = lazy(() =>
    import("./analytics-tab").then((m) => ({ default: m.AnalyticsTab }))
);

type TabType = "overview" | "health" | "analytics";

const TABS: Array<{ id: TabType; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "health", label: "Code Health", icon: Shield },
    { id: "analytics", label: "Advanced Analytics", icon: TrendingUp },
];

interface DashboardTabsProps {
    data: DashboardData;
    username: string;
}

export function DashboardTabs({ data, username }: DashboardTabsProps) {
    const [activeTab, setActiveTab] = useState<TabType>("overview");
    const [repositoryId, setRepositoryId] = useState<string | null>(null);
    const [repoLoading, setRepoLoading] = useState(true);

    useEffect(() => {
        async function fetchIndexedRepo() {
            setRepoLoading(true);
            try {
                const response = await fetch(`/api/repos?owner=${username}`);
                if (response.ok) {
                    const result = await response.json();
                    setRepositoryId(result.repositoryId || null);
                }
            } catch (_) { }
            setRepoLoading(false);
        }
        fetchIndexedRepo();
    }, [username]);

    return (
        <div className="space-y-6">
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/6 bg-white/2 p-1">
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-medium transition-all sm:text-sm ${isActive
                                ? "text-white"
                                : "text-zinc-500 hover:bg-white/3 hover:text-zinc-300"
                                }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="dashboard-tab"
                                    className="absolute inset-0 rounded-lg bg-white/5 border border-white/8"
                                    transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                                />
                            )}
                            <Icon className="relative h-3.5 w-3.5" />
                            <span className="relative">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {activeTab === "overview" && <DashboardContent data={data} />}

            {activeTab === "health" && (
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                        </div>
                    }
                >
                    {repoLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                        </div>
                    ) : repositoryId ? (
                        <CodeHealthTab repositoryId={repositoryId} />
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-3 py-20">
                            <Shield className="h-8 w-8 text-zinc-600" />
                            <span className="text-sm text-zinc-500">
                                Index a repository first to see code health metrics
                            </span>
                        </div>
                    )}
                </Suspense>
            )}

            {activeTab === "analytics" && (
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                        </div>
                    }
                >
                    <AnalyticsTab username={username} />
                </Suspense>
            )}
        </div>
    );
}
