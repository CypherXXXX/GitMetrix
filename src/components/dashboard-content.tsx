"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { ActivityChart, LanguagePieChart } from "@/components/ui/charts";
import type { DashboardData } from "@/lib/types";
import {
    Zap,
    Flame,
    GitCommit,
    GitPullRequest,
    CircleDot,
    Code2,
    Star,
    GitFork,
    TrendingUp,
    BarChart3,
} from "lucide-react";

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 24, scale: 0.96 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
    },
};

function VelocityScore({ score }: { score: number }) {
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
        <Card
            className="flex h-full flex-col items-center justify-center"
            glowColor="rgba(99, 102, 241, 0.2)"
        >
            <div className="mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-indigo-400" />
                <span className="text-sm font-medium text-zinc-400">
                    Velocity Score
                </span>
            </div>
            <div className="relative h-36 w-36">
                <svg className="h-36 w-36 -rotate-90" viewBox="0 0 100 100">
                    <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#27272A"
                        strokeWidth="5"
                    />
                    <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="url(#velocityGrad)"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-1000 ease-out"
                    />
                    <defs>
                        <linearGradient
                            id="velocityGrad"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="0%"
                        >
                            <stop offset="0%" stopColor="#6366F1" />
                            <stop offset="100%" stopColor="#A855F7" />
                        </linearGradient>
                    </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono text-4xl font-bold text-white">
                        {score}
                    </span>
                    <span className="text-xs text-zinc-500">/ 100</span>
                </div>
            </div>
        </Card>
    );
}

function ActiveStreak({ streak }: { streak: number }) {
    return (
        <Card
            className="flex h-full flex-col items-center justify-center"
            glowColor="rgba(251, 146, 60, 0.2)"
        >
            <div className="mb-3 flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-medium text-zinc-400">
                    Active Streak
                </span>
            </div>
            <span className="font-mono text-5xl font-bold text-gradient-primary">
                {streak}
            </span>
            <span className="mt-2 text-sm text-zinc-500">consecutive days</span>
        </Card>
    );
}

function TotalOutput({
    total,
    commits,
    prs,
    issues,
}: {
    total: number;
    commits: number;
    prs: number;
    issues: number;
}) {
    const stats = [
        {
            label: "Commits",
            value: commits,
            icon: GitCommit,
            color: "text-indigo-400",
        },
        {
            label: "PRs Merged",
            value: prs,
            icon: GitPullRequest,
            color: "text-purple-400",
        },
        {
            label: "Issues",
            value: issues,
            icon: CircleDot,
            color: "text-emerald-400",
        },
    ];

    return (
        <Card className="h-full" glowColor="rgba(168, 85, 247, 0.15)">
            <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-zinc-400">Total Output</span>
            </div>
            <span className="font-mono text-5xl font-bold text-gradient-primary">
                {total.toLocaleString()}
            </span>
            <p className="mb-5 mt-1 text-sm text-zinc-500">
                contributions this year
            </p>
            <div className="grid grid-cols-3 gap-3">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="rounded-xl border border-[#27272A] bg-[#050505] p-3 text-center"
                    >
                        <stat.icon className={`mx-auto mb-1.5 h-3.5 w-3.5 ${stat.color}`} />
                        <div className="font-mono text-lg font-semibold text-white">
                            {stat.value.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-zinc-500">{stat.label}</div>
                    </div>
                ))}
            </div>
        </Card>
    );
}

function LanguagesCard({
    languages,
}: {
    languages: DashboardData["languages"];
}) {
    return (
        <Card className="h-full" glowColor="rgba(99, 102, 241, 0.15)">
            <div className="mb-4 flex items-center gap-2">
                <Code2 className="h-4 w-4 text-indigo-400" />
                <span className="text-sm font-medium text-zinc-400">
                    Language Breakdown
                </span>
            </div>
            <LanguagePieChart languages={languages} />
        </Card>
    );
}

function ActivityCard({ data }: { data: DashboardData["activityData"] }) {
    return (
        <Card className="h-full" glowColor="rgba(168, 85, 247, 0.12)">
            <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-zinc-400">
                    Activity — Last 30 Days
                </span>
            </div>
            <ActivityChart data={data} />
        </Card>
    );
}

function TopReposCard({ repos }: { repos: DashboardData["topRepos"] }) {
    return (
        <Card className="h-full" glowColor="rgba(16, 185, 129, 0.12)">
            <div className="mb-4 flex items-center gap-2">
                <Star className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium text-zinc-400">
                    Top Repositories
                </span>
            </div>
            <div className="space-y-3">
                {repos.slice(0, 6).map((repo) => (
                    <div
                        key={repo.name}
                        className="flex items-center justify-between rounded-xl border border-[#27272A] bg-[#050505] px-4 py-3 transition-colors hover:border-indigo-500/20"
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: repo.languageColor }}
                            />
                            <span className="text-sm font-medium text-white">
                                {repo.name}
                            </span>
                            <span className="text-xs text-zinc-500">{repo.language}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <Star className="h-3.5 w-3.5 text-yellow-500/70" />
                                <span className="font-mono text-xs text-zinc-400">
                                    {repo.stars}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <GitFork className="h-3.5 w-3.5 text-zinc-500" />
                                <span className="font-mono text-xs text-zinc-400">
                                    {repo.forks}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}

interface DashboardContentProps {
    data: DashboardData;
}

export function DashboardContent({ data }: DashboardContentProps) {
    return (
        <motion.div
            className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <motion.div variants={itemVariants} className="md:col-span-1">
                <VelocityScore score={data.velocityScore} />
            </motion.div>
            <motion.div variants={itemVariants} className="md:col-span-1">
                <ActiveStreak streak={data.activeStreak} />
            </motion.div>
            <motion.div variants={itemVariants} className="md:col-span-2">
                <TotalOutput
                    total={data.totalContributions}
                    commits={data.totalCommits}
                    prs={data.totalPRs}
                    issues={data.totalIssues}
                />
            </motion.div>
            <motion.div variants={itemVariants} className="md:col-span-2">
                <LanguagesCard languages={data.languages} />
            </motion.div>
            <motion.div variants={itemVariants} className="md:col-span-2">
                <ActivityCard data={data.activityData} />
            </motion.div>
            <motion.div variants={itemVariants} className="md:col-span-4">
                <TopReposCard repos={data.topRepos} />
            </motion.div>
        </motion.div>
    );
}
