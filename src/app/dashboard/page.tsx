import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchGitHubData } from "@/lib/github";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardContent } from "@/components/dashboard-content";
import { UsernameSearch } from "@/components/username-search";
import { AlertTriangle, Github, Search } from "lucide-react";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/ui/skeleton";

function UsernamePrompt() {
    return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-6">
            <div className="rounded-full border border-[#27272A] bg-[#0F0F0F] p-5">
                <Search className="h-10 w-10 text-indigo-400" />
            </div>
            <div className="text-center">
                <h2 className="text-xl font-semibold text-white">
                    Analyze Any Developer
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
                    Enter a GitHub username below to visualize their developer
                    velocity, contribution analytics, and language breakdown.
                </p>
            </div>
            <UsernameSearch placeholder="Enter a GitHub username to analyze..." />
        </div>
    );
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-6">
            <AlertTriangle className="h-12 w-12 text-amber-400" />
            <div className="text-center">
                <h2 className="text-xl font-semibold text-white">
                    Something went wrong
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
                    {message}
                </p>
            </div>
            <UsernameSearch placeholder="Try another username..." />
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

interface DashboardPageProps {
    searchParams: Promise<{ username?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
    const user = await currentUser();

    if (!user) {
        redirect("/sign-in");
    }

    const params = await searchParams;
    const searchedUsername = params.username?.trim() || null;

    const githubAccount = user.externalAccounts?.find(
        (account) => account.provider === "github"
    );
    const detectedUsername =
        githubAccount?.username || user.username || null;

    const activeUsername = searchedUsername || detectedUsername;

    if (!activeUsername) {
        return (
            <div className="min-h-screen bg-void">
                <DashboardHeader
                    name={user.firstName || "User"}
                    avatarUrl={user.imageUrl}
                />
                <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                    <UsernamePrompt />
                </main>
            </div>
        );
    }

    const isViewingOther = searchedUsername && searchedUsername !== detectedUsername;

    return (
        <div className="min-h-screen bg-void">
            <DashboardHeader
                name={isViewingOther ? activeUsername : (user.firstName || activeUsername)}
                avatarUrl={user.imageUrl}
                username={activeUsername}
            />
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                <Suspense fallback={<DashboardSkeleton />}>
                    <DashboardData username={activeUsername} />
                </Suspense>
            </main>
        </div>
    );
}
