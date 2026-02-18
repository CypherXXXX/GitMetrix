import { SignIn } from "@clerk/nextjs";
import { AnimatedBackground } from "@/components/animated-background";

export default function SignInPage() {
    return (
        <div className="relative flex min-h-screen items-center justify-center">
            <AnimatedBackground />
            <div className="relative z-10">
                <SignIn
                    appearance={{
                        elements: {
                            rootBox: "mx-auto",
                            card: "bg-[#0F0F0F]/90 border border-[#27272A] backdrop-blur-xl shadow-2xl shadow-indigo-500/10",
                        },
                    }}
                />
            </div>
        </div>
    );
}
