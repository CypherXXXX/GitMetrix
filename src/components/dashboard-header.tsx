"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";

interface DashboardHeaderProps {
    name: string;
    avatarUrl: string;
    username?: string;
}

export function DashboardHeader({ name, username }: DashboardHeaderProps) {
    return (
        <header className="sticky top-0 z-50 border-b border-[#27272A] bg-[#050505]/80 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
                <Link href="/" className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                        <Zap className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-lg font-bold text-white">GitMetrix</span>
                </Link>

                <div className="flex items-center gap-4">
                    <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="hidden items-center gap-2 sm:flex"
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
                                    "h-8 w-8 rounded-lg ring-2 ring-[#27272A] ring-offset-2 ring-offset-[#050505]",
                            },
                        }}
                    />
                </div>
            </div>
        </header>
    );
}
