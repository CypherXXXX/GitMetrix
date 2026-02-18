<div align="center">
  <br />
  <a href="https://git-metrix.vercel.app">
    <img src="public/logo.png" alt="GitMetrix Logo" width="100" height="auto" />
  </a>
  <br />

  # ⚡ GitMetrix

  **The Developer Velocity Dashboard**

  <p align="center">
    <a href="#features">Features</a> •
    <a href="#tech-stack">Stack</a> •
    <a href="#getting-started">Get Started</a> •
    <a href="#environment-variables">Env Setup</a>
  </p>

  <p align="center">
    Transform your GitHub activity into a stunning, real-time visualization. <br />
    Track streaks, analyze languages, and measure your impact with the <strong>Velocity Score</strong>.
  </p>

  ![GitMetrix Dashboard Preview](https://github.com/user-attachments/assets/placeholder-image-link)
</div>

<br />

## ✨ Features

- **⚡ Velocity Score** — A proprietary metric combining commit volume and PR impact into a single 0-100 rating.
- **🔥 Active Streak** — Never break the chain. Visualize your daily coding consistency.
- **📊 Interactive Analytics** — Smooth, gesture-controlled area charts powered by Recharts.
- **🔮 Language DNA** — See exactly what languages make up your engineering profile (byte-for-byte).
- **🔎 Universal Search** — Analyze *any* developer on GitHub instantly (e.g., `torvalds`, `shadcn`).
- **🎨 Obsidian UI** — A premium, high-contrast dark theme designed for focus and aesthetics.
- **🚀 Edge Performance** — Server-side rendering with Upstash Redis caching for instant loads.

---

## 🛠 Tech Stack

Built with the "bleeding edge" to ensure maximum performance and type safety.

| Layer | Technology |
|---|---|
| **Core** | [Next.js 16](https://nextjs.org/) (App Router & Turbopack) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (Strict Mode) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/) |
| **Data** | [GitHub GraphQL API](https://docs.github.com/en/graphql) |
| **Cache** | [Upstash Redis](https://upstash.com/) (Serverless) |
| **Auth** | [Clerk](https://clerk.com/) (OAuth) |

---

## 🚀 Getting Started

Clone the repo and start your own instance in seconds.

```bash
git clone https://github.com/CypherXXXX/GitMetrix.git
cd GitMetrix
npm install
npm run dev
```

### Environment Variables (.env.local)

You'll need these keys to connect the services.

```bash
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# GitHub Data
GITHUB_TOKEN=ghp_...  # Needs 'read:user' scope

# Upstash Redis (Caching)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

---

<div align="center">
  <p>Built with ❤️ for developers.</p>
</div>
