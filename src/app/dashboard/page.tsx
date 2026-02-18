import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchGitHubData } from "@/lib/github";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardContent } from "@/components/dashboard-content";
import { AlertTriangle, Github } from "lucide-react";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/ui/skeleton";

function NoGitHubLinked() {
    return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
            <div className="rounded-full border border-[#27272A] bg-[#0F0F0F] p-5">
                <Github className="h-10 w-10 text-zinc-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">
                GitHub Account Not Linked
            </h2>
            <p className="max-w-md text-center text-sm text-zinc-400">
                Please sign in with your GitHub account to view your developer
                velocity dashboard. GitMetrix requires GitHub authentication to
                fetch your contribution data.
            </p>
        </div>
    );
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
            <AlertTriangle className="h-12 w-12 text-amber-400" />
            <h2 className="text-xl font-semibold text-white">
                Something went wrong
            </h2>
            <p className="max-w-md text-center text-sm text-zinc-400">{message}</p>
        </div>
    );
}

async function DashboardData({ username }: { username: string }) {
    try {
        const data = await fetchGitHubData(username);
        return <DashboardContent data={data} />;
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to fetch GitHub data";
        return <ErrorState message={message} />;
    }
}

export default async function DashboardPage() {
    const user = await currentUser();

    if (!user) {
        redirect("/sign-in");
    }

    const githubAccount = user.externalAccounts?.find(
        (account) => account.provider === "github"
    );
    const username =
        githubAccount?.username || user.username || null;

    if (!username) {
        return (
            <div className="min-h-screen bg-void">
                <DashboardHeader
                    name={user.firstName || "User"}
                    avatarUrl={user.imageUrl}
                />
                <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                    <NoGitHubLinked />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-void">
            <DashboardHeader
                name={user.firstName || username}
                avatarUrl={user.imageUrl}
                username={username}
            />
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                <Suspense fallback={<DashboardSkeleton />}>
                    <DashboardData username={username} />
                </Suspense>
            </main>
        </div>
    );
}
