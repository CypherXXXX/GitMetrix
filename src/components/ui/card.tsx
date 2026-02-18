"use client";

import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";
import { type ReactNode } from "react";

interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> {
    children: ReactNode;
    className?: string;
    glowColor?: string;
}

export function Card({
    children,
    className,
    glowColor = "rgba(99, 102, 241, 0.15)",
    ...props
}: CardProps) {
    return (
        <motion.div
            whileHover={{
                boxShadow: `0 0 40px ${glowColor}, 0 0 80px ${glowColor.replace("0.15", "0.05")}`,
                borderColor: "rgba(99, 102, 241, 0.3)",
            }}
            transition={{ duration: 0.3 }}
            className={cn(
                "group relative overflow-hidden rounded-2xl border border-[#27272A] bg-[#0F0F0F]/80 p-6",
                "backdrop-blur-xl transition-colors duration-300",
                className
            )}
            {...props}
        >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative z-10">{children}</div>
        </motion.div>
    );
}
