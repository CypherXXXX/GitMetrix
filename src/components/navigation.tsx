"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    BarChart3,
    MessageSquareCode,
    Layers,
    GitPullRequest,
    Menu,
    X,
} from "lucide-react";

const NAV_ITEMS = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/chat", label: "Chat", icon: MessageSquareCode },
    { href: "/architecture", label: "Architecture", icon: Layers },
    { href: "/pr-review", label: "PR Review", icon: GitPullRequest },
];

export function Navigation() {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    const isActive = (href: string) => pathname?.startsWith(href);

    return (
        <>
            <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-white/6 bg-void/80 px-4 backdrop-blur-2xl sm:px-6">
                <Link
                    href="/"
                    className="flex items-center gap-2 transition-opacity hover:opacity-80"
                >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-purple-600">
                        <BarChart3 className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-sm font-bold text-white">
                        Git<span className="text-gradient-primary">Metrix</span>
                    </span>
                </Link>

                <div className="hidden items-center gap-1 sm:flex">
                    {NAV_ITEMS.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${active
                                        ? "text-white"
                                        : "text-zinc-500 hover:bg-white/3 hover:text-zinc-300"
                                    }`}
                            >
                                {active && (
                                    <motion.div
                                        layoutId="nav-active"
                                        className="absolute inset-0 rounded-lg bg-white/5 border border-white/8"
                                        transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                                    />
                                )}
                                <item.icon className="relative h-3.5 w-3.5" />
                                <span className="relative">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>

                <button
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white sm:hidden"
                >
                    {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>
            </nav>

            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border-b border-white/6 bg-void/95 backdrop-blur-2xl sm:hidden"
                    >
                        <div className="space-y-1 px-4 py-3">
                            {NAV_ITEMS.map((item) => {
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileOpen(false)}
                                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${active
                                                ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                                                : "text-zinc-400 hover:bg-white/3 hover:text-white"
                                            }`}
                                    >
                                        <item.icon className="h-4 w-4" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
