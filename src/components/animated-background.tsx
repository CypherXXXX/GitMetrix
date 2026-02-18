"use client";

export function AnimatedBackground() {
    return (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="absolute inset-0 bg-[#050505]" />

            <div className="grid-background absolute inset-0" />

            <div className="absolute left-0 top-1/4 h-px w-full overflow-hidden">
                <div className="animate-beam-h h-full w-48 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
            </div>

            <div className="absolute left-1/3 top-0 h-full w-px overflow-hidden">
                <div
                    className="animate-beam-v h-48 w-full bg-gradient-to-b from-transparent via-purple-500/30 to-transparent"
                    style={{ animationDelay: "2s" }}
                />
            </div>

            <div className="absolute right-1/4 top-0 h-full w-px overflow-hidden">
                <div
                    className="animate-beam-v h-48 w-full bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent"
                    style={{ animationDelay: "5s" }}
                />
            </div>

            <div className="absolute left-0 top-2/3 h-px w-full overflow-hidden">
                <div
                    className="animate-beam-h h-full w-64 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent"
                    style={{ animationDelay: "4s" }}
                />
            </div>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="animate-pulse-glow h-[600px] w-[600px] rounded-full bg-gradient-to-r from-indigo-500/[0.07] to-purple-500/[0.07] blur-[120px]" />
            </div>

            <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-indigo-500/[0.03] blur-[100px]" />
            <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-purple-500/[0.03] blur-[100px]" />
        </div>
    );
}
