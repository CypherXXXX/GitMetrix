"use client";

import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import type { LanguageBreakdown } from "@/lib/types";

interface ActivityChartProps {
    data: Array<{ date: string; commits: number }>;
}

export function ActivityChart({ data }: ActivityChartProps) {
    return (
        <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient
                            id="activityStroke"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="0"
                        >
                            <stop offset="0%" stopColor="#6366F1" />
                            <stop offset="100%" stopColor="#A855F7" />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1a1a1e"
                        vertical={false}
                    />
                    <XAxis
                        dataKey="date"
                        tick={{ fill: "#52525b", fontSize: 10, fontFamily: "Inter" }}
                        tickFormatter={(v: string) => v.slice(5)}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        tick={{ fill: "#52525b", fontSize: 10, fontFamily: "Inter" }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "#0F0F0F",
                            border: "1px solid #27272A",
                            borderRadius: "12px",
                            color: "#fff",
                            fontFamily: "JetBrains Mono, monospace",
                            fontSize: "12px",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                        }}
                        labelFormatter={(label) => `${String(label)}`}
                        cursor={{ stroke: "#6366F1", strokeWidth: 1, strokeDasharray: "4 4" }}
                    />
                    <Area
                        type="monotone"
                        dataKey="commits"
                        stroke="url(#activityStroke)"
                        strokeWidth={2.5}
                        fill="url(#activityGradient)"
                        dot={false}
                        activeDot={{
                            r: 5,
                            fill: "#A855F7",
                            stroke: "#6366F1",
                            strokeWidth: 2,
                            filter: "drop-shadow(0 0 6px rgba(168, 85, 247, 0.6))",
                        }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

interface LanguagePieChartProps {
    languages: LanguageBreakdown[];
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

function PieTooltipContent({ active, payload }: { active?: boolean; payload?: Array<{ payload: LanguageBreakdown }> }) {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload;
    return (
        <div
            style={{
                backgroundColor: "#0F0F0F",
                border: "1px solid #27272A",
                borderRadius: "12px",
                padding: "10px 14px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <div
                    style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: data.color || "#6366F1",
                    }}
                />
                <span style={{ color: "#fff", fontSize: "12px", fontFamily: "Inter", fontWeight: 500 }}>
                    {data.name}
                </span>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "2px" }}>
                <span style={{ color: "#a1a1aa", fontSize: "11px", fontFamily: "JetBrains Mono, monospace" }}>
                    {data.percentage}%
                </span>
                <span style={{ color: "#52525b", fontSize: "11px", fontFamily: "JetBrains Mono, monospace" }}>
                    {formatBytes(data.value)}
                </span>
            </div>
        </div>
    );
}

export function LanguagePieChart({ languages }: LanguagePieChartProps) {
    return (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
            <div className="h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={languages}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                        >
                            {languages.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color || "#6366F1"}
                                />
                            ))}
                        </Pie>
                        <Tooltip content={<PieTooltipContent />} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2.5">
                {languages.map((lang) => (
                    <div key={lang.name} className="flex items-center gap-3">
                        <div
                            className="h-3 w-3 rounded-full ring-2 ring-white/5"
                            style={{ backgroundColor: lang.color || "#6366F1" }}
                        />
                        <span className="text-sm text-neutral-300">{lang.name}</span>
                        <span className="font-mono text-xs text-neutral-500">
                            {lang.percentage}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
