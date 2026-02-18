"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, ArrowRight, Loader2 } from "lucide-react";

interface UsernameSearchProps {
    compact?: boolean;
    placeholder?: string;
}

export function UsernameSearch({
    compact = false,
    placeholder = "Enter a GitHub username...",
}: UsernameSearchProps) {
    const [username, setUsername] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = username.trim();
        if (!trimmed) return;
        setIsLoading(true);
        router.push(`/dashboard?username=${encodeURIComponent(trimmed)}`);
    }

    if (compact) {
        return (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Search user..."
                        className="h-8 w-40 rounded-lg border border-[#27272A] bg-[#0F0F0F] pl-9 pr-3 text-xs text-white placeholder-zinc-600 outline-none transition-all duration-300 focus:w-56 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                    />
                </div>
                {isLoading && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                )}
            </form>
        );
    }

    return (
        <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="w-full max-w-md"
        >
            <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={placeholder}
                    className="h-14 w-full rounded-2xl border border-[#27272A] bg-[#0F0F0F]/80 pl-12 pr-14 text-sm text-white placeholder-zinc-600 backdrop-blur-xl outline-none transition-all duration-300 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                    autoFocus
                />
                <button
                    type="submit"
                    disabled={!username.trim() || isLoading}
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-30 disabled:hover:scale-100"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <ArrowRight className="h-4 w-4" />
                    )}
                </button>
            </div>
            <p className="mt-3 text-center text-xs text-zinc-600">
                Try <button type="button" onClick={() => setUsername("torvalds")} className="text-indigo-400/70 hover:text-indigo-400 transition-colors">torvalds</button>
                {" · "}
                <button type="button" onClick={() => setUsername("leerob")} className="text-indigo-400/70 hover:text-indigo-400 transition-colors">leerob</button>
                {" · "}
                <button type="button" onClick={() => setUsername("shadcn")} className="text-indigo-400/70 hover:text-indigo-400 transition-colors">shadcn</button>
            </p>
        </motion.form>
    );
}
