export interface ContributionDay {
    contributionCount: number;
    date: string;
}

export interface ContributionWeek {
    contributionDays: ContributionDay[];
}

export interface RepoStats {
    name: string;
    stargazerCount: number;
    forkCount: number;
    primaryLanguage: {
        name: string;
        color: string;
    } | null;
    languages: {
        edges: Array<{
            size: number;
            node: {
                name: string;
                color: string;
            };
        }>;
    };
}

export interface GitHubResponse {
    user: {
        login: string;
        name: string;
        avatarUrl: string;
        contributionsCollection: {
            totalCommitContributions: number;
            totalPullRequestContributions: number;
            totalIssueContributions: number;
            totalRepositoryContributions: number;
            contributionCalendar: {
                totalContributions: number;
                weeks: ContributionWeek[];
            };
        };
        repositories: {
            nodes: RepoStats[];
        };
    };
}

export interface LanguageBreakdown {
    name: string;
    color: string;
    value: number;
    percentage: number;
}

export interface TopRepo {
    name: string;
    stars: number;
    forks: number;
    language: string;
    languageColor: string;
}

export interface DashboardData {
    username: string;
    name: string;
    avatarUrl: string;
    velocityScore: number;
    activeStreak: number;
    totalContributions: number;
    languages: LanguageBreakdown[];
    activityData: Array<{
        date: string;
        commits: number;
    }>;
    totalCommits: number;
    totalPRs: number;
    totalIssues: number;
    totalRepos: number;
    topRepos: TopRepo[];
}
