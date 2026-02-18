"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-2xl border border-[#27272A] bg-[#0F0F0F]",
                className
            )}
        />
    );
}

export function DashboardSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-6">
            <Skeleton className="h-52 md:col-span-1" />
            <Skeleton className="h-52 md:col-span-1" />
            <Skeleton className="h-52 md:col-span-2" />
            <Skeleton className="h-72 md:col-span-2" />
            <Skeleton className="h-72 md:col-span-2" />
            <Skeleton className="h-64 md:col-span-4" />
        </div>
    );
}
