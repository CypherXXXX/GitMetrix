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
    total_files_discovered: number;
    total_files_processed: number;
    total_chunks: number;
    total_vectors: number;
    languages_json: Record<string, number> | null;
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
    symbol_name: string | null;
    symbol_type: SymbolType | null;
    language: string | null;
    start_line: number | null;
    end_line: number | null;
    metadata_json: Record<string, unknown> | null;
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
    totalFilesDiscovered: number;
    totalFilesProcessed: number;
    totalChunks: number;
    totalVectors: number;
    languages: Record<string, number>;
    error: string | null;
    repositoryId: string;
}

export type SymbolType =
    | "function"
    | "class"
    | "method"
    | "interface"
    | "type_alias"
    | "enum"
    | "import"
    | "export"
    | "struct"
    | "trait"
    | "module"
    | "namespace"
    | "constant"
    | "variable"
    | "decorator"
    | "unknown";

export interface CodeSymbol {
    name: string;
    type: SymbolType;
    startLine: number;
    endLine: number;
    language: string;
    parentSymbol: string | null;
    content: string;
}

export interface ParsedFile {
    filePath: string;
    language: string;
    content: string;
    symbols: CodeSymbol[];
    imports: ImportStatement[];
    exports: ExportStatement[];
    fileSize: number;
    lineCount: number;
}

export interface ImportStatement {
    source: string;
    specifiers: string[];
    line: number;
    isDefault: boolean;
    isNamespace: boolean;
}

export interface ExportStatement {
    name: string;
    line: number;
    isDefault: boolean;
}

export interface CodeChunk {
    content: string;
    filePath: string;
    symbolName: string | null;
    symbolType: SymbolType | null;
    chunkIndex: number;
    language: string;
    startLine: number;
    endLine: number;
    parentStructure: string | null;
    metadata: Record<string, unknown>;
}

export interface DependencyEdge {
    sourcePath: string;
    targetPath: string;
    edgeType: "import" | "re-export" | "inheritance" | "usage";
    specifiers: string[];
}

export interface DependencyGraph {
    edges: DependencyEdge[];
    adjacency: Map<string, Set<string>>;
    reverseAdjacency: Map<string, Set<string>>;
}

export interface IngestionStats {
    totalFilesDiscovered: number;
    totalFilesFetched: number;
    totalFilesParsed: number;
    totalFilesIndexed: number;
    totalChunksGenerated: number;
    totalVectorsStored: number;
    languageBreakdown: Record<string, number>;
    errors: string[];
    startedAt: number;
    completedAt: number | null;
}

export interface RepoTreeFile {
    path: string;
    type: string;
    size: number;
    sha: string;
}

export const SUPPORTED_EXTENSIONS: Record<string, string> = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "css",
    ".less": "css",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".md": "markdown",
    ".mdx": "markdown",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".scala": "scala",
    ".sh": "shell",
    ".bash": "shell",
    ".zsh": "shell",
    ".sql": "sql",
    ".graphql": "graphql",
    ".gql": "graphql",
    ".proto": "protobuf",
    ".toml": "toml",
    ".xml": "xml",
    ".vue": "vue",
    ".svelte": "svelte",
    ".dart": "dart",
    ".ex": "elixir",
    ".exs": "elixir",
    ".zig": "zig",
    ".lua": "lua",
    ".r": "r",
    ".R": "r",
    ".tf": "terraform",
    ".dockerfile": "dockerfile",
};
