import { Octokit } from "octokit";
import { redis } from "./redis";
import type {
  GitHubResponse,
  DashboardData,
  LanguageBreakdown,
  TopRepo,
} from "./types";

const GITHUB_GRAPHQL_QUERY = `
query($username: String!) {
  user(login: $username) {
    login
    name
    avatarUrl
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalRepositoryContributions
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
          }
        }
      }
    }
    repositories(first: 20, orderBy: { field: STARGAZERS, direction: DESC }, ownerAffiliations: OWNER) {
      nodes {
        name
        stargazerCount
        forkCount
        primaryLanguage {
          name
          color
        }
        languages(first: 5, orderBy: { field: SIZE, direction: DESC }) {
          edges {
            size
            node {
              name
              color
            }
          }
        }
      }
    }
  }
}
`;

function calculateStreak(
  weeks: GitHubResponse["user"]["contributionsCollection"]["contributionCalendar"]["weeks"]
): number {
  const allDays = weeks.flatMap((w) => w.contributionDays).reverse();
  let streak = 0;
  for (const day of allDays) {
    if (day.contributionCount > 0) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function calculateVelocityScore(commits: number, prs: number): number {
  const raw = commits * 0.6 + prs * 1.5;
  return Math.min(Math.round(raw), 100);
}

function extractLanguages(
  repos: GitHubResponse["user"]["repositories"]["nodes"]
): LanguageBreakdown[] {
  const languageMap = new Map<string, { color: string; size: number }>();

  for (const repo of repos) {
    for (const edge of repo.languages.edges) {
      const existing = languageMap.get(edge.node.name);
      if (existing) {
        existing.size += edge.size;
      } else {
        languageMap.set(edge.node.name, {
          color: edge.node.color,
          size: edge.size,
        });
      }
    }
  }

  const totalSize = Array.from(languageMap.values()).reduce(
    (sum, l) => sum + l.size,
    0
  );

  return Array.from(languageMap.entries())
    .map(([name, data]) => ({
      name,
      color: data.color,
      value: data.size,
      percentage: Math.round((data.size / totalSize) * 100),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

function extractTopRepos(
  repos: GitHubResponse["user"]["repositories"]["nodes"]
): TopRepo[] {
  return repos.slice(0, 6).map((repo) => ({
    name: repo.name,
    stars: repo.stargazerCount,
    forks: repo.forkCount,
    language: repo.primaryLanguage?.name ?? "Unknown",
    languageColor: repo.primaryLanguage?.color ?? "#6366F1",
  }));
}

function getLast30DaysActivity(
  weeks: GitHubResponse["user"]["contributionsCollection"]["contributionCalendar"]["weeks"]
): Array<{ date: string; commits: number }> {
  const allDays = weeks.flatMap((w) =>
    w.contributionDays.map((d) => ({
      date: d.date,
      commits: d.contributionCount,
    }))
  );
  return allDays.slice(-30);
}

export async function fetchGitHubData(
  username: string
): Promise<DashboardData> {
  const cacheKey = `gitmetrix:cache:${username}`;

  try {
    const cached = await redis.get<DashboardData>(cacheKey);
    if (cached) {
      return cached;
    }
  } catch { }

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const response = await octokit.graphql<GitHubResponse>(
    GITHUB_GRAPHQL_QUERY,
    { username }
  );

  const { user } = response;
  const { contributionsCollection } = user;
  const { contributionCalendar } = contributionsCollection;

  const activeStreak = calculateStreak(contributionCalendar.weeks);
  const velocityScore = calculateVelocityScore(
    contributionsCollection.totalCommitContributions,
    contributionsCollection.totalPullRequestContributions
  );
  const languages = extractLanguages(user.repositories.nodes);
  const activityData = getLast30DaysActivity(contributionCalendar.weeks);
  const topRepos = extractTopRepos(user.repositories.nodes);

  const dashboardData: DashboardData = {
    username: user.login,
    name: user.name || user.login,
    avatarUrl: user.avatarUrl,
    velocityScore,
    activeStreak,
    totalContributions: contributionCalendar.totalContributions,
    languages,
    activityData,
    totalCommits: contributionsCollection.totalCommitContributions,
    totalPRs: contributionsCollection.totalPullRequestContributions,
    totalIssues: contributionsCollection.totalIssueContributions,
    totalRepos: contributionsCollection.totalRepositoryContributions,
    topRepos,
  };

  try {
    await redis.set(cacheKey, dashboardData, { ex: 3600 });
  } catch { }

  return dashboardData;
}
