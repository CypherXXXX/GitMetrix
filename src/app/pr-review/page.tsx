"use client";

import { useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2,
    ArrowRight,
    Bug,
    Shield,
    Zap,
    Lightbulb,
    AlertTriangle,
    CheckCircle2,
    Info,
    GitPullRequest,
} from "lucide-react";

interface ReviewFinding {
    file: string;
    line: number | null;
    severity: "critical" | "warning" | "info";
    message: string;
    suggestion: string;
}

interface ReviewResult {
    bugs: ReviewFinding[];
    optimizations: ReviewFinding[];
    security_issues: ReviewFinding[];
    suggestions: ReviewFinding[];
    overall_score: number;
    summary: string;
}

const severityConfig = {
    critical: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: AlertTriangle },
    warning: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertTriangle },
    info: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: Info },
};

function ScoreGauge({ score }: { score: number }) {
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";

    return (
        <div className="relative h-32 w-32 sm:h-36 sm:w-36">
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
                <span className="text-[10px] text-zinc-500">/ 100</span>
            </div>
        </div>
    );
}

function FindingsSection({
    title,
    findings,
    icon: Icon,
    color,
}: {
    title: string;
    findings: ReviewFinding[];
    icon: React.FC<{ className?: string }>;
    color: string;
}) {
    if (findings.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/6 bg-white/2 p-4 sm:p-5"
        >
            <div className="mb-3 flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-sm font-semibold text-white">{title}</span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                    {findings.length}
                </span>
            </div>
            <div className="space-y-2">
                {findings.map((finding, idx) => {
                    const config = severityConfig[finding.severity];
                    const SevIcon = config.icon;
                    return (
                        <div
                            key={idx}
                            className={`rounded-xl border ${config.border} ${config.bg} p-3`}
                        >
                            <div className="mb-1 flex items-start gap-2">
                                <SevIcon className={`mt-0.5 h-3 w-3 shrink-0 ${config.color}`} />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] text-zinc-400">
                                            {finding.file}
                                            {finding.line ? `:${finding.line}` : ""}
                                        </span>
                                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase ${config.bg} ${config.color}`}>
                                            {finding.severity}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-zinc-300">{finding.message}</p>
                                    {finding.suggestion && (
                                        <p className="mt-1 text-[11px] text-zinc-500">
                                            → {finding.suggestion}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}

function PrReviewContent() {
    const [prUrl, setPrUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ReviewResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function handleReview() {
        if (!prUrl.trim()) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch("/api/pr-review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prUrl }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Review failed");
            }

            const data = await response.json();
            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Review failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 text-center"
            >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10">
                    <GitPullRequest className="h-7 w-7 text-indigo-400" />
                </div>
                <h1 className="text-xl font-bold text-white sm:text-2xl">
                    AI Pull Request Reviewer
                </h1>
                <p className="mt-2 text-xs text-zinc-500 sm:text-sm">
                    Paste a GitHub PR URL for automated code review
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-8"
            >
                <div className="relative">
                    <input
                        type="text"
                        value={prUrl}
                        onChange={(e) => setPrUrl(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleReview();
                        }}
                        placeholder="https://github.com/owner/repo/pull/123"
                        disabled={loading}
                        className="h-12 w-full rounded-xl border border-white/6 bg-white/3 pl-4 pr-14 text-sm text-white placeholder-zinc-600 backdrop-blur-xl outline-none transition-all focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-50 sm:h-14 sm:pl-5 sm:pr-16"
                    />
                    <button
                        onClick={handleReview}
                        disabled={!prUrl.trim() || loading}
                        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-linear-to-r from-indigo-500 to-purple-600 text-white transition-all hover:scale-105 disabled:opacity-30 disabled:hover:scale-100 sm:right-2 sm:h-10 sm:w-10"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <ArrowRight className="h-4 w-4" />
                        )}
                    </button>
                </div>
            </motion.div>

            {loading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4 py-16"
                >
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/20 border-t-indigo-500" />
                    <div className="text-center">
                        <p className="text-sm font-medium text-zinc-300">Analyzing pull request...</p>
                        <p className="mt-1 text-xs text-zinc-600">
                            Fetching diff, splitting patches, running AI analysis
                        </p>
                    </div>
                </motion.div>
            )}

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mb-6 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3"
                    >
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                        <span className="text-sm text-red-400">{error}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {result && (
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-5"
                >
                    <div className="flex flex-col items-center gap-5 rounded-2xl border border-white/6 bg-white/2 p-6 sm:flex-row sm:gap-8">
                        <ScoreGauge score={result.overall_score} />
                        <div className="flex-1 text-center sm:text-left">
                            <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                                {result.overall_score >= 80 ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                                ) : (
                                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                                )}
                                <span className="text-lg font-semibold text-white">
                                    {result.overall_score >= 80 ? "Good Quality" : result.overall_score >= 60 ? "Needs Attention" : "Critical Issues"}
                                </span>
                            </div>
                            <p className="text-sm text-zinc-400">{result.summary}</p>
                            <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
                                {[
                                    { label: "Bugs", count: result.bugs.length, color: "text-red-400" },
                                    { label: "Security", count: result.security_issues.length, color: "text-amber-400" },
                                    { label: "Performance", count: result.optimizations.length, color: "text-blue-400" },
                                    { label: "Suggestions", count: result.suggestions.length, color: "text-emerald-400" },
                                ].map((stat) => (
                                    <div key={stat.label} className="rounded-lg bg-white/3 px-3 py-1.5 text-center">
                                        <span className={`font-mono text-sm font-semibold ${stat.color}`}>
                                            {stat.count}
                                        </span>
                                        <span className="ml-1.5 text-[10px] text-zinc-500">{stat.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <FindingsSection title="Bugs" findings={result.bugs} icon={Bug} color="text-red-400" />
                    <FindingsSection title="Security Issues" findings={result.security_issues} icon={Shield} color="text-amber-400" />
                    <FindingsSection title="Optimizations" findings={result.optimizations} icon={Zap} color="text-blue-400" />
                    <FindingsSection title="Suggestions" findings={result.suggestions} icon={Lightbulb} color="text-emerald-400" />
                </motion.div>
            )}
        </div>
    );
}

export default function PrReviewPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-screen items-center justify-center bg-void">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                </div>
            }
        >
            <PrReviewContent />
        </Suspense>
    );
}
