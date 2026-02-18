<div align="center">
  <br />
  <h1>⚡ GitMetrix</h1>
  <h3>The Developer Velocity Dashboard</h3>

  <p align="center">
    Transform your GitHub activity into a stunning, real-time visualization. <br />
    Track streaks, analyze languages, and measure your impact with the <strong>Velocity Score</strong>.
  </p>

  <div align="center">
    <img src="https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/Clerk_Auth-6C47FF?style=for-the-badge&logo=clerk&logoColor=white" alt="Clerk" />
    <img src="https://img.shields.io/badge/Upstash_Redis-00E9A3?style=for-the-badge&logo=redis&logoColor=black" alt="Upstash" />
  </div>

  <br />

  <p align="center">
    <a href="#features">Features</a> •
    <a href="#getting-started">Get Started</a> •
    <a href="#environment-variables">Env Setup</a>
  </p>
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
