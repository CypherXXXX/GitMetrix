"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Search,
    Star,
    GitFork,
    Loader2,
    FolderGit2,
    AlertCircle,
    Clock,
    Lock,
} from "lucide-react";

interface Repo {
    name: string;
    fullName: string;
    description: string | null;
    url: string;
    language: string | null;
    stars: number;
    forks: number;
    updatedAt: string;
    isPrivate: boolean;
}

interface RepoSelectorProps {
    username: string;
    onSelectRepo: (repoUrl: string) => void;
}

const LANGUAGE_COLORS: Record<string, string> = {
    TypeScript: "#3178C6",
    JavaScript: "#F1E05A",
    Python: "#3572A5",
    Rust: "#DEA584",
    Go: "#00ADD8",
    Java: "#B07219",
    "C++": "#F34B7D",
    C: "#555555",
    Ruby: "#701516",
    PHP: "#4F5D95",
    Swift: "#F05138",
    Kotlin: "#A97BFF",
    Dart: "#00B4AB",
    HTML: "#E34C26",
    CSS: "#563D7C",
    Shell: "#89E051",
    Lua: "#000080",
};

function formatTimeAgo(dateStr: string): string {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diff = now - date;
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}

function RepoSkeleton() {
    return (
        <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
                <div
                    key={i}
                    className="flex items-center gap-4 rounded-xl border border-white/4 bg-white/2 px-4 py-3.5"
                    style={{ animationDelay: `${i * 0.1}s` }}
                >
                    <div className="flex flex-1 flex-col gap-2">
                        <div className="skeleton-shimmer h-4 w-32 rounded-md" />
                        <div className="skeleton-shimmer h-3 w-48 rounded-md" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="skeleton-shimmer h-3 w-3 rounded-full" />
                        <div className="skeleton-shimmer h-3 w-12 rounded-md" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function RepoSelector({ username, onSelectRepo }: RepoSelectorProps) {
    const [repos, setRepos] = useState<Repo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState("");

    useEffect(() => {
        let cancelled = false;
        async function fetchRepos() {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(
                    `/api/repos?username=${encodeURIComponent(username)}`
                );
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || "Failed to fetch repositories");
                }
                const data = await response.json();
                if (!cancelled) setRepos(data.repos || []);
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error ? err.message : "Failed to load repositories"
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchRepos();
        return () => { cancelled = true; };
    }, [username]);

    const filtered = repos.filter((repo) =>
        repo.name.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="flex flex-1 flex-col items-center px-4 pb-6 pt-6 sm:pt-10">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center gap-3 text-center"
            >
                <div className="animate-float rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-3.5">
                    <FolderGit2 className="h-8 w-8 text-indigo-400 sm:h-10 sm:w-10" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                    Your Repositories
                </h2>
                <p className="max-w-sm text-xs text-zinc-500 sm:max-w-md sm:text-sm">
                    Select a repository to chat with its codebase using AI
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="mt-5 w-full max-w-2xl sm:mt-6"
            >
                <div className="relative mb-3 sm:mb-4">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                    <input
                        type="text"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Filter repositories..."
                        className="h-10 w-full rounded-xl border border-white/6 bg-white/3 pl-10 pr-4 text-sm text-white placeholder-zinc-600 outline-none transition-all duration-200 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 sm:h-11"
                    />
                    {filter && (
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-zinc-600">
                            {filtered.length} found
                        </span>
                    )}
                </div>

                <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-0.5 chat-scrollbar sm:max-h-[50vh]">
                    {loading && <RepoSkeleton />}

                    {!loading && error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center gap-3 py-12"
                        >
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                                <AlertCircle className="h-6 w-6 text-red-400" />
                            </div>
                            <p className="text-sm text-red-400">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-1 rounded-lg border border-white/6 bg-white/3 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/6"
                            >
                                Try Again
                            </button>
                        </motion.div>
                    )}

                    {!loading && !error && filtered.length === 0 && (
                        <div className="flex flex-col items-center gap-2 py-12">
                            <Search className="h-6 w-6 text-zinc-700" />
                            <p className="text-sm text-zinc-600">
                                {filter ? "No matching repositories" : "No repositories found"}
                            </p>
                        </div>
                    )}

                    {!loading && !error && filtered.map((repo, idx) => (
                        <motion.button
                            key={repo.fullName}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.025, duration: 0.25 }}
                            onClick={() => onSelectRepo(repo.url)}
                            className="group flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/2 px-3.5 py-3 text-left transition-all duration-200 hover:border-indigo-500/25 hover:bg-indigo-500/5 sm:gap-4 sm:px-4 sm:py-3.5"
                        >
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-[13px] font-medium text-zinc-200 transition-colors group-hover:text-white sm:text-sm">
                                        {repo.name}
                                    </span>
                                    {repo.isPrivate && (
                                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
                                            <Lock className="h-2 w-2" />
                                            Private
                                        </span>
                                    )}
                                </div>
                                {repo.description && (
                                    <p className="truncate text-[11px] text-zinc-600 sm:text-xs">
                                        {repo.description}
                                    </p>
                                )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
                                {repo.language && (
                                    <div className="hidden items-center gap-1.5 xs:flex sm:flex">
                                        <div
                                            className="h-2.5 w-2.5 rounded-full ring-1 ring-white/10"
                                            style={{
                                                backgroundColor:
                                                    LANGUAGE_COLORS[repo.language] || "#6366F1",
                                            }}
                                        />
                                        <span className="text-[11px] text-zinc-500 sm:text-xs">
                                            {repo.language}
                                        </span>
                                    </div>
                                )}
                                {repo.stars > 0 && (
                                    <div className="flex items-center gap-1">
                                        <Star className="h-3 w-3 text-yellow-500/60" />
                                        <span className="font-mono text-[11px] text-zinc-500">
                                            {repo.stars}
                                        </span>
                                    </div>
                                )}
                                {repo.forks > 0 && (
                                    <div className="hidden items-center gap-1 sm:flex">
                                        <GitFork className="h-3 w-3 text-zinc-600" />
                                        <span className="font-mono text-[11px] text-zinc-500">
                                            {repo.forks}
                                        </span>
                                    </div>
                                )}
                                <div className="hidden items-center gap-1 md:flex">
                                    <Clock className="h-3 w-3 text-zinc-700" />
                                    <span className="text-[10px] text-zinc-600">
                                        {formatTimeAgo(repo.updatedAt)}
                                    </span>
                                </div>
                            </div>
                        </motion.button>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
