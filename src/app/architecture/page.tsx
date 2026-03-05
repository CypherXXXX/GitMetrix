"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { ArchitectureGraph } from "@/components/architecture-graph";
import { Layers, ChevronDown, Loader2 } from "lucide-react";

interface RepoOption {
    id: string;
    full_name: string;
    status: string;
}

function ArchitectureContent() {
    const [repos, setRepos] = useState<RepoOption[]>([]);
    const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    useEffect(() => {
        async function loadRepos() {
            try {
                const response = await fetch("/api/repos");
                if (response.ok) {
                    const data = await response.json();
                    const completed = (data.repositories || []).filter(
                        (r: RepoOption) => r.status === "completed"
                    );
                    setRepos(completed);
                    if (completed.length > 0) {
                        setSelectedRepo(completed[0].id);
                    }
                }
            } catch (_) { }
            setLoading(false);
        }
        loadRepos();
    }, []);

    const selectedRepoName = repos.find((r) => r.id === selectedRepo)?.full_name || "";

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            </div>
        );
    }

    if (repos.length === 0) {
        return (
            <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4">
                <div className="rounded-2xl border border-white/5 bg-white/2 p-4">
                    <Layers className="h-10 w-10 text-zinc-600" />
                </div>
                <div className="text-center">
                    <h2 className="text-lg font-semibold text-white">No Indexed Repositories</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                        Index a repository first to visualize its architecture
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-3.5rem)] flex-col">
            <div className="flex items-center justify-between border-b border-white/6 px-4 py-3 sm:px-6">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-indigo-500/10 p-1.5">
                        <Layers className="h-4 w-4 text-indigo-400" />
                    </div>
                    <h1 className="text-sm font-semibold text-white sm:text-base">
                        Architecture Visualizer
                    </h1>
                </div>
                <div className="relative">
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-white/5 sm:px-4 sm:text-sm"
                    >
                        <span className="max-w-[120px] truncate sm:max-w-[200px]">
                            {selectedRepoName}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                    </button>
                    {dropdownOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-white/8 bg-[#0a0a0a]/95 backdrop-blur-2xl"
                        >
                            {repos.map((repo) => (
                                <button
                                    key={repo.id}
                                    onClick={() => {
                                        setSelectedRepo(repo.id);
                                        setDropdownOpen(false);
                                    }}
                                    className={`w-full px-4 py-2.5 text-left text-xs transition-colors hover:bg-white/5 ${repo.id === selectedRepo
                                            ? "bg-indigo-500/10 text-indigo-300"
                                            : "text-zinc-400"
                                        }`}
                                >
                                    {repo.full_name}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {selectedRepo && <ArchitectureGraph repositoryId={selectedRepo} />}
            </div>
        </div>
    );
}

export default function ArchitecturePage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-screen items-center justify-center bg-void">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                </div>
            }
        >
            <ArchitectureContent />
        </Suspense>
    );
}
