"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, BarChart3, MessageSquareCode, SearchCode, Menu, X } from "lucide-react";
import { UsernameSearch } from "@/components/username-search";

interface DashboardHeaderProps {
    name: string;
    avatarUrl: string;
    username?: string;
}

export function DashboardHeader({ name, username }: DashboardHeaderProps) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    const navLinks = [
        { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
        { href: "/chat", label: "Chat", icon: MessageSquareCode },
        { href: "/search", label: "Search", icon: SearchCode },
    ];

    return (
        <>
            <header className="sticky top-0 z-50 border-b border-white/6 bg-void/60 backdrop-blur-2xl backdrop-saturate-150">
                <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6">
                    <div className="flex items-center gap-4 sm:gap-6">
                        <Link href="/" className="group flex items-center gap-2.5">
                            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 transition-shadow duration-300 group-hover:shadow-indigo-500/40">
                                <Zap className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-lg font-bold tracking-tight text-white">
                                GitMetrix
                            </span>
                        </Link>
                        <nav className="hidden items-center gap-0.5 sm:flex">
                            {navLinks.map((link) => {
                                const isActive = pathname.startsWith(link.href);
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className="relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors"
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="nav-pill"
                                                className="absolute inset-0 rounded-lg bg-white/8"
                                                transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                                            />
                                        )}
                                        <link.icon className={`relative h-3.5 w-3.5 transition-colors ${isActive ? "text-indigo-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
                                        <span className={`relative transition-colors ${isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                                            {link.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:block">
                            <UsernameSearch compact />
                        </div>
                        <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className="hidden items-center gap-2 lg:flex"
                        >
                            <span className="text-sm text-zinc-400">{name}</span>
                            {username && (
                                <span className="font-mono text-xs text-zinc-600">
                                    @{username}
                                </span>
                            )}
                        </motion.div>
                        <UserButton
                            appearance={{
                                elements: {
                                    avatarBox:
                                        "h-8 w-8 rounded-lg ring-2 ring-white/10 ring-offset-2 ring-offset-void",
                                },
                            }}
                        />
                        <button
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/6 bg-white/3 text-zinc-400 transition-colors hover:text-white sm:hidden"
                            aria-label="Toggle menu"
                        >
                            <AnimatePresence mode="wait" initial={false}>
                                {mobileOpen ? (
                                    <motion.div
                                        key="close"
                                        initial={{ rotate: -90, opacity: 0 }}
                                        animate={{ rotate: 0, opacity: 1 }}
                                        exit={{ rotate: 90, opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        <X className="h-4 w-4" />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="menu"
                                        initial={{ rotate: 90, opacity: 0 }}
                                        animate={{ rotate: 0, opacity: 1 }}
                                        exit={{ rotate: -90, opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        <Menu className="h-4 w-4" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </button>
                    </div>
                </div>
            </header>

            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="fixed inset-x-0 top-14 z-40 overflow-hidden border-b border-white/6 bg-void/95 backdrop-blur-2xl sm:hidden"
                    >
                        <nav className="flex flex-col gap-1 p-3">
                            {navLinks.map((link, idx) => {
                                const isActive = pathname.startsWith(link.href);
                                return (
                                    <motion.div
                                        key={link.href}
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05, duration: 0.2 }}
                                    >
                                        <Link
                                            href={link.href}
                                            onClick={() => setMobileOpen(false)}
                                            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${isActive
                                                ? "bg-indigo-500/10 text-indigo-400"
                                                : "text-zinc-400 hover:bg-white/3 hover:text-white"
                                                }`}
                                        >
                                            <link.icon className="h-4 w-4" />
                                            {link.label}
                                        </Link>
                                    </motion.div>
                                );
                            })}
                            <div className="mt-2 border-t border-white/6 pt-3">
                                <UsernameSearch compact />
                            </div>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
