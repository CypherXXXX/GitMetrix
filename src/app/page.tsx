"use client";

import { motion } from "framer-motion";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { AnimatedBackground } from "@/components/animated-background";
import { ArrowRight, Activity, Zap, Shield } from "lucide-react";
import Link from "next/link";

const title = "GitMetrix";

const letterVariants = {
  hidden: { opacity: 0, y: 50, filter: "blur(12px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      delay: 0.5 + i * 0.08,
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

const fadeUp = (delay: number) => ({
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { delay, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
});

export default function LandingPage() {
  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 flex flex-col items-center gap-8 px-4">
        <motion.div
          variants={fadeUp(0.2)}
          initial="hidden"
          animate="visible"
          className="rounded-full border border-[#27272A] bg-[#0F0F0F]/60 px-5 py-2 backdrop-blur-xl"
        >
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-xs font-semibold tracking-widest text-transparent uppercase">
            Developer Velocity Dashboard
          </span>
        </motion.div>

        <h1 className="flex select-none">
          {title.split("").map((letter, i) => (
            <motion.span
              key={i}
              custom={i}
              variants={letterVariants}
              initial="hidden"
              animate="visible"
              className="text-gradient-white text-6xl font-black tracking-tighter sm:text-8xl md:text-9xl"
            >
              {letter}
            </motion.span>
          ))}
        </h1>

        <motion.p
          variants={fadeUp(1.5)}
          initial="hidden"
          animate="visible"
          className="max-w-xl text-center text-base leading-relaxed text-zinc-400 sm:text-lg"
        >
          Track your GitHub velocity, visualize contributions, and unlock
          deep insights into your development workflow.
        </motion.p>

        <motion.div
          variants={fadeUp(1.9)}
          initial="hidden"
          animate="visible"
        >
          <SignedOut>
            <SignInButton mode="modal">
              <button className="group relative flex cursor-pointer items-center gap-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/40 active:scale-95">
                <span>Analyze My GitHub</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-50" />
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <button className="group relative flex cursor-pointer items-center gap-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/40 active:scale-95">
                <span>Go to Dashboard</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-50" />
              </button>
            </Link>
          </SignedIn>
        </motion.div>

        <motion.div
          variants={fadeUp(2.4)}
          initial="hidden"
          animate="visible"
          className="mt-4"
        >
          <div className="flex items-center gap-8 text-xs text-zinc-600">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" />
              <span>Real-time Analytics</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5" />
              <span>Edge Cached</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              <span>GitHub Powered</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
