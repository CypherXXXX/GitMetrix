import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { ChatInterface } from "@/components/chat-interface";
import { AnimatedBackground } from "@/components/animated-background";

export default async function SearchPage() {
    const user = await currentUser();

    if (!user) {
        redirect("/sign-in");
    }

    const githubAccount = user.externalAccounts?.find(
        (account) => account.provider === "github"
    );
    const detectedUsername =
        githubAccount?.username || user.username || undefined;

    return (
        <div className="flex min-h-screen flex-col bg-void">
            <AnimatedBackground />
            <DashboardHeader
                name={user.firstName || "User"}
                avatarUrl={user.imageUrl}
                username={detectedUsername}
            />
            <main className="relative z-10 flex-1">
                <ChatInterface />
            </main>
        </div>
    );
}
