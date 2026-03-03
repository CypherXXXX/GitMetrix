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

export interface Repository {
    id: string;
    owner: string;
    name: string;
    full_name: string;
    status: "pending" | "indexing" | "completed" | "failed";
    file_count: number;
    error_message: string | null;
    indexed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface RepositoryFile {
    id: string;
    repository_id: string;
    file_path: string;
    content: string;
    chunk_index: number;
    embedding: number[] | null;
    created_at: string;
}

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    fileReferences?: FileReference[];
}

export interface FileReference {
    filePath: string;
    chunkContent: string;
    similarityScore: number;
}

export interface IndexingStatus {
    status: Repository["status"];
    progress: number;
    fileCount: number;
    error: string | null;
    repositoryId: string;
}
