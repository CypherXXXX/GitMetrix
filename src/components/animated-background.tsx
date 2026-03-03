"use client";

export function AnimatedBackground() {
    return (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="absolute inset-0 bg-void" />

            <div className="grid-background absolute inset-0" />

            <div className="absolute left-0 top-1/4 h-px w-full overflow-hidden">
                <div className="animate-beam-h h-full w-48 bg-linear-to-r from-transparent via-indigo-400/50 to-transparent" />
            </div>

            <div className="absolute left-1/3 top-0 h-full w-px overflow-hidden">
                <div
                    className="animate-beam-v h-48 w-full bg-linear-to-b from-transparent via-purple-400/40 to-transparent"
                    style={{ animationDelay: "2s" }}
                />
            </div>

            <div className="absolute right-1/4 top-0 h-full w-px overflow-hidden">
                <div
                    className="animate-beam-v h-48 w-full bg-linear-to-b from-transparent via-indigo-400/30 to-transparent"
                    style={{ animationDelay: "5s" }}
                />
            </div>

            <div className="absolute left-0 top-2/3 h-px w-full overflow-hidden">
                <div
                    className="animate-beam-h h-full w-64 bg-linear-to-r from-transparent via-purple-400/30 to-transparent"
                    style={{ animationDelay: "4s" }}
                />
            </div>

            <div className="absolute left-[15%] top-[20%] h-px w-full overflow-hidden">
                <div
                    className="animate-beam-h h-full w-32 bg-linear-to-r from-transparent via-cyan-400/20 to-transparent"
                    style={{ animationDelay: "7s" }}
                />
            </div>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="animate-pulse-glow h-[700px] w-[700px] rounded-full bg-linear-to-r from-indigo-500/10 to-purple-500/10 blur-[120px]" />
            </div>

            <div className="absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-[120px]" />
            <div className="absolute bottom-0 left-0 h-[500px] w-[500px] rounded-full bg-purple-500/5 blur-[120px]" />
            <div className="absolute left-1/2 top-0 h-[300px] w-[400px] -translate-x-1/2 rounded-full bg-cyan-500/3 blur-[100px]" />
        </div>
    );
}
