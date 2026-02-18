<div align="center">
  <h1>⚡ GitMetrix</h1>
  <p><strong>Developer Velocity Dashboard</strong></p>
  <p>
    Track your GitHub velocity, visualize contributions, and unlock deep insights into your development workflow — all in a stunning, real-time dashboard.
  </p>

  <br />

  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#environment-variables">Environment Variables</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#deployment">Deployment</a>
</div>

---

## Overview

**GitMetrix** is a full-stack developer analytics dashboard that connects to the GitHub GraphQL API and presents your coding activity through a premium, dark-themed interface. It calculates a custom **Velocity Score**, tracks your **Active Streak**, visualizes your **Contribution Activity** over the last 30 days, breaks down your **Language Usage** across repositories, and highlights your **Top Repositories** — all in a single glance.

The application uses **Clerk** for GitHub OAuth authentication, **Upstash Redis** for edge-compatible caching (1-hour TTL), and **Framer Motion** for smooth, cinematic animations throughout the UI.

---

## Features

| Feature | Description |
|---|---|
| **Velocity Score** | A weighted composite metric (commits × 0.6 + PRs × 1.5) capped at 100, rendered as an animated radial gauge |
| **Active Streak** | Consecutive days with at least one contribution, calculated by walking the contribution calendar backwards |
| **Contribution Totals** | Year-to-date counts for commits, merged pull requests, and issues opened |
| **Activity Chart** | 30-day area chart with gradient fill, dashed grid, glowing active dots, and custom dark tooltip |
| **Language Breakdown** | Donut chart with interactive tooltip showing language name, percentage, and byte-size |
| **Top Repositories** | Sorted by stargazer count with language, stars, and fork indicators |
| **Username Search** | Search any GitHub username from the header or fallback prompt — demo any developer's stats instantly |
| **GitHub OAuth** | One-click sign-in via GitHub OAuth through Clerk with automatic username detection |
| **Edge Caching** | Dashboard data is cached for 1 hour in Upstash Redis to minimize GitHub API calls |
| **Animated Landing** | Per-character title animation, staggered fade-ins, light beams, and gradient glow effects |
| **Responsive Design** | Fully responsive bento grid layout adapting from 1 column on mobile to 4 columns on desktop |

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) | Server components, file-based routing, streaming with Suspense |
| **Language** | [TypeScript](https://typescriptlang.org/) | End-to-end type safety from API response to UI props |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Utility-first styling with `@theme` design tokens and zero runtime CSS |
| **Authentication** | [Clerk](https://clerk.com/) | Managed GitHub OAuth flow, session handling, and pre-built UI components |
| **Data Fetching** | [Octokit](https://github.com/octokit/octokit.js) (GitHub GraphQL API) | Single GraphQL query fetches all user stats in one round-trip |
| **Caching** | [Upstash Redis](https://upstash.com/) | Serverless, edge-compatible Redis with REST API — no persistent connections |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) | Declarative spring and keyframe animations for React |
| **Charts** | [Recharts](https://recharts.org/) | Composable, SVG-based charting library built on D3 |
| **Icons** | [Lucide React](https://lucide.dev/) | Tree-shakeable, consistent SVG icon set |
| **Utilities** | [clsx](https://github.com/lukeed/clsx) + [tailwind-merge](https://github.com/dcastil/tailwind-merge) | Conflict-free conditional class name composition |

---

## Architecture

```
Browser ──▶ Clerk Auth ──▶ Next.js App Router
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
              Landing Page           Dashboard (Protected)
              (Client Component)     (Server Component)
                                        │
                                        ▼
                                  fetchGitHubData()
                                        │
                              ┌─────────┴─────────┐
                              ▼                   ▼
                        Upstash Redis       GitHub GraphQL API
                        (Cache Layer)       (via Octokit)
                              │                   │
                              └─────────┬─────────┘
                                        ▼
                                  DashboardData
                                        │
                                        ▼
                              DashboardContent (Client)
                              ├── VelocityScore
                              ├── ActiveStreak
                              ├── TotalOutput
                              ├── LanguagesCard (PieChart)
                              ├── ActivityCard (AreaChart)
                              └── TopReposCard
```

**Data Flow:**

1. User signs in with GitHub via Clerk
2. The dashboard server component resolves the username via priority chain: `?username=` query param → GitHub OAuth → Clerk username → search bar prompt
3. `fetchGitHubData()` checks Upstash Redis for a cached result (TTL: 1 hour)
4. On cache miss, a single GraphQL query fetches contributions, repositories, and languages
5. Raw data is transformed into velocity score, streak count, language breakdown, and activity timeline
6. The result is cached in Redis and passed to client components for rendering
7. Framer Motion orchestrates staggered reveal animations on the bento grid

---

## Getting Started

### Prerequisites

- **Node.js** 18.17 or higher
- **npm** 9 or higher
- A **GitHub** account
- A **Clerk** account (free tier works)
- An **Upstash Redis** database (free tier works)

### Installation

```bash
# Clone the repository
git clone https://github.com/CypherXXXX/GitMetrix.git
cd GitMetrix

# Install dependencies
npm install

# Set up environment variables (see below)
cp .env.example .env.local

# Start the development server
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

| Variable | Description | How to Get |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend API key | [Clerk Dashboard](https://dashboard.clerk.com/) → API Keys |
| `CLERK_SECRET_KEY` | Clerk backend secret key | Same location as above |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Sign-in route | Set to `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Sign-up route | Set to `/sign-up` |
| `GITHUB_TOKEN` | GitHub Personal Access Token | [GitHub Settings](https://github.com/settings/tokens) → Generate new token (classic) with `read:user` scope |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint | [Upstash Console](https://console.upstash.com/) → Create database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST auth token | Same location as above |

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
GITHUB_TOKEN=ghp_...
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

> **Important:** The `GITHUB_TOKEN` needs the `read:user` scope to access public profile and contribution data via the GraphQL API. In Clerk, make sure to enable the **GitHub** social connection under **User & Authentication → Social Connections**.

---

## Project Structure

```
GitMetrix/
├── public/
│   └── favicon.ico                         # App favicon
│
├── src/
│   ├── app/                                # Next.js App Router
│   │   ├── dashboard/
│   │   │   └── page.tsx                    # Protected dashboard (server component)
│   │   ├── sign-in/
│   │   │   └── [[...sign-in]]/
│   │   │       └── page.tsx                # Clerk sign-in page
│   │   ├── sign-up/
│   │   │   └── [[...sign-up]]/
│   │   │       └── page.tsx                # Clerk sign-up page
│   │   ├── globals.css                     # Tailwind v4 theme, base styles, animations
│   │   ├── layout.tsx                      # Root layout with ClerkProvider & fonts
│   │   └── page.tsx                        # Landing page with animated hero
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── card.tsx                    # Glassmorphic card with hover glow effect
│   │   │   ├── charts.tsx                  # ActivityChart (area) & LanguagePieChart (donut)
│   │   │   └── skeleton.tsx                # Loading skeleton & DashboardSkeleton grid
│   │   ├── animated-background.tsx         # Full-screen animated grid with light beams
│   │   ├── dashboard-content.tsx           # Bento grid layout with all dashboard cards
│   │   ├── dashboard-header.tsx            # Sticky header with branding, search & UserButton
│   │   └── username-search.tsx             # GitHub username search (full & compact variants)
│   │
│   ├── lib/
│   │   ├── github.ts                       # GitHub GraphQL query, data transformation, caching
│   │   ├── redis.ts                        # Upstash Redis client instantiation
│   │   ├── types.ts                        # TypeScript interfaces for all data shapes
│   │   └── utils.ts                        # cn() utility for class name merging
│   │
│   └── middleware.ts                       # Clerk auth middleware protecting /dashboard
│
├── .env.local                              # Environment variables (git-ignored)
├── .gitignore                              # Git ignore rules
├── eslint.config.mjs                       # ESLint flat config with Next.js rules
├── next.config.ts                          # Next.js configuration
├── package.json                            # Dependencies and scripts
├── postcss.config.mjs                      # PostCSS config for Tailwind CSS v4
└── tsconfig.json                           # TypeScript configuration
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server with Turbopack |
| `npm run build` | Create an optimized production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint across the codebase |

---

## Deployment

### Vercel (Recommended)

1. Push the repository to GitHub
2. Import the project in [Vercel](https://vercel.com/new)
3. Add all environment variables from the table above
4. Deploy — Vercel auto-detects Next.js and handles everything

### Other Platforms

GitMetrix runs on any platform that supports Next.js 16:

- **Netlify** — Use the `@netlify/plugin-nextjs` adapter
- **Railway** — Auto-detected from `package.json`
- **Docker** — Use the official [Next.js Dockerfile](https://nextjs.org/docs/app/building-your-application/deploying#docker-image)

---

## Design System — Obsidian UI

The interface follows a custom dark theme called **Obsidian UI**:

| Token | Value | Usage |
|---|---|---|
| `--color-void` | `#050505` | Page background |
| `--color-surface` | `#0F0F0F` | Card backgrounds |
| `--color-border` | `#27272A` | Borders and dividers |
| `--color-primary` | `#6366F1` | Indigo accent (buttons, gradients) |
| `--color-primary-purple` | `#A855F7` | Purple accent (gradient endpoints) |

Typography uses **Inter** for body text and **JetBrains Mono** for numeric/data values, loaded from Google Fonts.

---

## License

This project is open source and available under the [MIT License](LICENSE).
