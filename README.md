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

## 📂 Project Structure

A highly modular architecture designed for scalability and separation of concerns.

```
GitMetrix/
├── public/                 # Static assets (favicons, images)
├── src/
│   ├── app/                # Next.js 16 App Router
│   │   ├── dashboard/      # Protected dashboard route (Server Component)
│   │   ├── sign-in/        # Clerk sign-in page
│   │   ├── sign-up/        # Clerk sign-up page
│   │   ├── globals.css     # Tailwind v4 theme & base styles
│   │   ├── layout.tsx      # Root layout (ClerkProvider, Font setup)
│   │   └── page.tsx        # Landing Page (Client Component)
│   │
│   ├── components/         # React Components
│   │   ├── ui/             # Reusable UI primitives (Cards, Charts, Skeletons)
│   │   ├── animated-bg.tsx # Background animation engine
│   │   ├── dashboard-*.tsx # Bounded Context components (Header, Content)
│   │   └── username-search # Smart search bar with debounce & variants
│   │
│   ├── lib/                # Core Business Logic
│   │   ├── github.ts       # GitHub GraphQL Client & Data Transformation
│   │   ├── redis.ts        # Upstash Redis Client Singleton
│   │   ├── types.ts        # TypeScript Interfaces & Zod Schemas
│   │   └── utils.ts        # Tailwind Class Merger (cn)
│   │
│   └── middleware.ts       # Edge Middleware for Route Protection
├── .env.local              # Environment Secrets
├── next.config.ts          # Application Configuration
└── tailwind.config.ts      # Design System Tokens
```

---

## 🔄 How It Works

**1. Authentication & Entry**
Users sign in via **Clerk** (managed OAuth). If they lack a GitHub account, the **Middleware** redirects them. Alternatively, anyone can use the **Search Bar** to instantly audit *any* public GitHub profile without signing in, transforming the app into a public utility.

**2. Data Injection (Server-Side)**
The dashboard page (`src/app/dashboard/page.tsx`) acts as the data controller. It resolves the target username using a priority chain:
> `?username=URL_Param`  ➔  `GitHub OAuth Account`  ➔  `Clerk Username`

**3. The Edge Caching Layer**
Before hitting GitHub, the app checks **Upstash Redis**.
- **Cache Hit ( < 50ms ):** Returns pre-computed stats instantly.
- **Cache Miss:** Executes a single, optimized **GraphQL Query** to GitHub.

**4. Data Transformation Engine**
Raw GraphQL data is processed in `src/lib/github.ts`:
- **Commit History:** Aggregated into a 30-day time series.
- **Velocity Score:** Calculated using a weighted algorithm (Commits × 0.6 + PRs × 1.5).
- **Language DNA:** Byte-size analysis across all repositories.

**5. Visual Rendering**
The transformed data is passed to **Client Components**. **Framer Motion** orchestrates a staggered entrance for the bento grid, while **Recharts** renders the interactive data visualizations with a custom obsidian theme.

---

## 🎨 Design & UI Engineering

This project isn't just functional; it's designed to feel **alive**. Here are the specialized tools used to craft the experience:

### **1. Tailwind CSS v4** (`@theme`)
We use the latest **alpha** engine of Tailwind for zero-runtime CSS.
- **Why:** It allows us to define semantic tokens like `--color-void` and `--color-primary` directly in CSS variables, making the dark mode consistent and easy to maintain.
- **Role:** Handles 100% of the layout, typography, and "glassmorphism" effects (using `backdrop-blur-xl` and `bg-white/5`).

### **2. Framer Motion** (`<motion.div>`)
The animation engine that powers the "cinematic" feel.
- **Why:** CSS transitions aren't enough for complex orchestrated sequences.
- **Role:**
    - **Staggered Entry:** The bento grid cards load one by one (`staggerChildren: 0.08`).
    - **Velocity Gauge:** The radial dial animates from 0 to your score with a spring physics curve.
    - **Hero Text:** The "GitMetrix" title splits into characters that float up with a blur effect.

### **3. Recharts** (`<ResponsiveContainer>`)
The visualization library built on D3.js but optimized for React.
- **Why:** Most chart libraries are ugly by default. Recharts gives us full SVG control.
- **Role:**
    - **Gradient Areas:** usage of `<linearGradient>` to fade the chart fill into transparency.
    - **Custom Tooltips:** We entirely replaced the default tooltips with our own "Obsidian" styled React components.
    - **Glowing Dots:** We injected custom SVG filters to make the active data points "glow" when hovered.

### **4. Lucide React** (`<Icons>`)
A consistent, pixel-perfect icon set.
- **Why:** Consistency in stroke width (2px) and rounded corners.
- **Role:** Every icon (Zap, Flame, GitCommit) acts as a visual anchor for the data metrics.

---

<div align="center">
  <p>Built with ❤️</p>
</div>
