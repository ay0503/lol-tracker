# LoL LP Tracker — Full Stack Overview & Self-Hosting Guide

This document provides a complete breakdown of the LoL LP Tracker's technology stack, identifies every Manus-specific integration that would need replacement, and offers concrete guidance for deploying the application on external hosting platforms.

---

## 1. Architecture Overview

The LoL LP Tracker is a **monolithic full-stack application** that runs as a single Node.js process. That process serves three responsibilities simultaneously:

1. **Frontend**: A React 19 single-page application built with Vite, served as static files in production.
2. **API Server**: An Express 4 server exposing tRPC 11 endpoints under `/api/trpc` and an OAuth callback at `/api/oauth/callback`.
3. **Background Worker**: A polling engine (`pollEngine.ts`) that runs every 20 minutes inside the same process, fetching live data from the Riot Games API, computing ETF prices, executing pending orders, distributing dividends, and generating AI-powered meme news.

The build process produces two artifacts: a Vite-compiled `dist/public/` directory (the SPA) and an esbuild-bundled `dist/index.js` (the server). In production, the server serves the static files and handles all API traffic from a single port.

---

## 2. Technology Stack

### Frontend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React 19 | UI rendering |
| Routing | Wouter 3 | Client-side SPA routing |
| Styling | Tailwind CSS 4 + shadcn/ui (Radix primitives) | Design system and component library |
| Data Fetching | tRPC 11 + TanStack React Query 5 | Type-safe API calls with caching |
| Charts | Recharts 2 (line charts) + Lightweight Charts 5 (candlestick) | Financial data visualization |
| Animation | Framer Motion 12 | UI transitions and micro-interactions |
| i18n | Custom context-based system (`LanguageContext.tsx`) | English/Korean bilingual support |
| Theming | Custom context (`ThemeContext.tsx`) | Light/dark mode toggle |
| Serialization | SuperJSON | Preserves `Date` and other types across the wire |

### Backend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js 22 + TypeScript 5.9 | Server execution |
| HTTP Server | Express 4 | Request handling, middleware |
| API Layer | tRPC 11 | Type-safe RPC procedures |
| ORM | Drizzle ORM 0.44 | Database queries and schema management |
| Database | MySQL (TiDB on Manus) | Persistent data storage |
| Auth | JWT (jose library) + Manus OAuth | Session management |
| LLM | Manus Forge API (Gemini 2.5 Flash) | AI-generated meme news |
| Storage | Manus Forge Storage Proxy | File uploads (S3-backed) |
| External API | Riot Games API v5 | Live summoner data and match history |

### Database Schema (13 tables)

The application uses a MySQL database with the following tables, managed via Drizzle migrations:

| Table | Purpose |
|-------|---------|
| `users` | User accounts with roles (admin/user), OAuth profile data |
| `portfolios` | Per-user paper trading portfolio (cash balance) |
| `holdings` | Current stock positions per user per ticker |
| `trades` | Completed buy/sell transaction history |
| `orders` | Pending limit orders awaiting execution |
| `comments` | User sentiment/comments on tickers |
| `news` | AI-generated meme news articles |
| `dividends` | Dividend distribution records |
| `matches` | Stored match history from Riot API |
| `marketStatus` | Current player rank, price, and market state |
| `priceHistory` | Time-series price snapshots (the core LP→price data) |
| `portfolioSnapshots` | Periodic portfolio value snapshots for P&L tracking |
| `notifications` | In-app notification records |

### Dev Tooling

| Tool | Purpose |
|------|---------|
| pnpm 10 | Package manager |
| Vite 7 | Dev server + production bundler |
| esbuild | Server-side TypeScript bundling |
| Drizzle Kit | Database migration generation and execution |
| Vitest 2 | Unit testing |
| Prettier | Code formatting |
| tsx | TypeScript execution for development |

---

## 3. Manus-Specific Integrations (What to Replace)

The following components are tightly coupled to the Manus platform and must be replaced or removed for self-hosting. Everything else in the codebase is standard, portable Node.js/React code.

### 3.1 Authentication (OAuth)

**Current implementation**: Manus OAuth via `OAUTH_SERVER_URL` and `VITE_OAUTH_PORTAL_URL`. The frontend redirects users to Manus's login portal, which calls back to `/api/oauth/callback` with an authorization code. The server exchanges the code for user info via Manus's proprietary gRPC-style endpoints.

**Files affected**: `server/_core/sdk.ts`, `server/_core/oauth.ts`, `client/src/const.ts`, `client/src/main.tsx`

**Replacement options**:
- **NextAuth.js / Auth.js**: Drop-in OAuth provider supporting Google, GitHub, Discord, etc.
- **Lucia Auth**: Lightweight session-based auth library that works well with Drizzle.
- **Clerk / Supabase Auth**: Managed auth services with React SDKs.
- **Custom JWT**: Keep the existing JWT session logic in `sdk.ts` but replace the OAuth exchange with your own provider (e.g., Google OAuth2 directly).

The JWT session signing/verification logic (`signSession`, `verifySession`) is already self-contained using the `jose` library and `JWT_SECRET` — only the OAuth code exchange and user info fetching need replacement.

### 3.2 LLM Integration (AI News Generation)

**Current implementation**: The polling engine calls `invokeLLM()` from `server/_core/llm.ts`, which sends requests to `BUILT_IN_FORGE_API_URL/v1/chat/completions` using the Forge API key. It uses the OpenAI-compatible chat completions format with the `gemini-2.5-flash` model.

**Files affected**: `server/_core/llm.ts`, `server/pollEngine.ts`

**Replacement options**:
- **OpenAI API**: Change the base URL to `https://api.openai.com/v1` and use `gpt-4o-mini` or `gpt-3.5-turbo`. The request format is already OpenAI-compatible.
- **Google Gemini API**: Use `@google/generative-ai` SDK directly.
- **Anthropic Claude**: Use the Anthropic SDK with minor message format adjustments.
- **Disable entirely**: Comment out the `generateMemeNews()` call in `pollEngine.ts` if you don't need AI news.

### 3.3 File Storage

**Current implementation**: `server/storage.ts` uploads/downloads files through Manus Forge's storage proxy (`v1/storage/upload`, `v1/storage/downloadUrl`), authenticated with `BUILT_IN_FORGE_API_KEY`.

**Files affected**: `server/storage.ts`

**Replacement options**:
- **AWS S3 directly**: The `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` packages are already installed. Rewrite `storagePut`/`storageGet` to use `PutObjectCommand`/`GetObjectCommand` with your own S3 bucket credentials.
- **Cloudflare R2**: S3-compatible API, same SDK works with a different endpoint.
- **Supabase Storage / Firebase Storage**: Managed alternatives with generous free tiers.

Note: The app currently makes minimal use of file storage (no user file uploads in the current feature set), so this replacement is low-priority unless you add file upload features.

### 3.4 Owner Notifications

**Current implementation**: `server/_core/notification.ts` sends notifications to the project owner via Manus Forge's notification service.

**Files affected**: `server/_core/notification.ts`, `server/_core/systemRouter.ts`

**Replacement options**:
- **Email (Resend / SendGrid / Nodemailer)**: Send email notifications instead.
- **Discord/Slack webhook**: Post notifications to a channel.
- **Remove entirely**: This is an optional operational feature, not user-facing.

### 3.5 Vite Plugins (Dev-Only)

**Current implementation**: `vite.config.ts` includes `vite-plugin-manus-runtime` and a custom `vitePluginManusDebugCollector()` that writes browser logs to `.manus-logs/`.

**Files affected**: `vite.config.ts`

**Action**: Remove both Manus-specific plugins from the `plugins` array. Also remove `@builder.io/vite-plugin-jsx-loc` (used for Manus visual editor). The core plugins you need are just `react()` and `tailwindcss()`. Update the `allowedHosts` in the dev server config to match your domain.

---

## 4. Environment Variables

### Required for Core Functionality

| Variable | Purpose | Self-Hosted Value |
|----------|---------|-------------------|
| `DATABASE_URL` | MySQL connection string | Your MySQL/PlanetScale/TiDB connection URL |
| `JWT_SECRET` | Session cookie signing key | Any random 256-bit string (e.g., `openssl rand -hex 32`) |
| `RIOT_API_KEY` | Riot Games API access | Get from [developer.riotgames.com](https://developer.riotgames.com) |
| `PORT` | Server port (optional, defaults to 3000) | Set by your hosting platform |
| `NODE_ENV` | Environment mode | `production` for deployed builds |

### Manus-Specific (Replace or Remove)

| Variable | Purpose | Action |
|----------|---------|--------|
| `VITE_APP_ID` | Manus OAuth app identifier | Replace with your OAuth provider's client ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend | Replace with your OAuth provider's token endpoint |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal | Replace with your OAuth provider's authorize URL |
| `OWNER_OPEN_ID` | Manus owner identifier | Replace with your admin user ID |
| `BUILT_IN_FORGE_API_URL` | Manus Forge services | Replace with OpenAI/Gemini API URL or remove |
| `BUILT_IN_FORGE_API_KEY` | Manus Forge auth token | Replace with your LLM API key or remove |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend Forge access | Remove (not used in core features) |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend Forge token | Remove (not used in core features) |
| `VITE_ANALYTICS_ENDPOINT` | Manus analytics | Remove |
| `VITE_ANALYTICS_WEBSITE_ID` | Manus analytics | Remove |

---

## 5. Build & Deploy Commands

The application builds and runs with standard Node.js tooling:

```bash
# Install dependencies
pnpm install

# Generate and run database migrations
DATABASE_URL="mysql://..." pnpm db:push

# Build for production (outputs dist/public + dist/index.js)
pnpm build

# Start production server
NODE_ENV=production DATABASE_URL="mysql://..." JWT_SECRET="..." RIOT_API_KEY="..." node dist/index.js
```

The production server is a single `node dist/index.js` process that serves both the static frontend and the API, and runs the background polling loop internally. There is no need for a separate worker process or cron job.

---

## 6. Hosting Platform Recommendations

### Option A: Railway (Recommended for Simplicity)

[Railway](https://railway.app) is the most straightforward option because it supports persistent Node.js processes with built-in MySQL.

1. Create a new Railway project and add a **MySQL** service.
2. Connect your GitHub repository.
3. Set the build command to `pnpm install && pnpm db:push && pnpm build`.
4. Set the start command to `node dist/index.js`.
5. Add environment variables (`DATABASE_URL` from the MySQL service, plus `JWT_SECRET`, `RIOT_API_KEY`, `NODE_ENV=production`).
6. Railway automatically assigns a `PORT` and provides a public URL.

**Cost**: ~$5/month for the Hobby plan (includes MySQL and always-on process).

### Option B: Render

[Render](https://render.com) offers a similar experience with a free tier (though free instances spin down after inactivity, which would interrupt the polling engine).

1. Create a **Web Service** from your GitHub repo.
2. Create a **MySQL** database (or use PlanetScale/TiDB Cloud for a managed MySQL).
3. Build command: `pnpm install && pnpm db:push && pnpm build`
4. Start command: `node dist/index.js`
5. Set environment variables in the dashboard.

**Important**: Use a paid instance ($7/month) to keep the process always-on for the polling engine.

### Option C: VPS (DigitalOcean, Hetzner, Linode)

For full control, deploy to a VPS with Docker or PM2:

```bash
# On your VPS
git clone <your-repo>
cd lol-tracker
pnpm install
pnpm build

# Use PM2 for process management
pm2 start dist/index.js --name lol-tracker
pm2 save
pm2 startup
```

Pair with a managed MySQL service (PlanetScale free tier, TiDB Cloud free tier, or self-hosted MySQL on the same VPS).

**Cost**: ~$4-6/month for a basic VPS + free managed MySQL tier.

### Option D: Fly.io

[Fly.io](https://fly.io) supports persistent processes and has good global distribution:

```toml
# fly.toml
[build]
  builder = "heroku/buildpacks:22"

[env]
  NODE_ENV = "production"

[[services]]
  internal_port = 3000
  protocol = "tcp"
  [services.concurrency]
    hard_limit = 25
    soft_limit = 20
```

### Platforms to Avoid

**Vercel and Netlify** are not suitable because they are designed for serverless/edge functions and static sites. This application requires a persistent, always-on Node.js process for the background polling engine. While you could theoretically split the app into a serverless API + external cron job, it would require significant refactoring.

---

## 7. Database Options

The application uses **MySQL** via Drizzle ORM. Compatible managed services include:

| Service | Free Tier | Notes |
|---------|-----------|-------|
| [TiDB Cloud](https://tidbcloud.com) | 5 GiB storage | MySQL-compatible, currently used on Manus |
| [PlanetScale](https://planetscale.com) | Hobby plan | MySQL-compatible, serverless scaling |
| [Aiven](https://aiven.io) | Free tier available | Managed MySQL |
| Self-hosted MySQL | N/A | Run on your VPS alongside the app |

The `DATABASE_URL` format is: `mysql://user:password@host:port/database?ssl={"rejectUnauthorized":true}`

Enable SSL for all cloud-hosted databases. The Drizzle config reads `DATABASE_URL` directly.

---

## 8. Migration Checklist

Use this checklist when migrating off Manus:

- [ ] **Database**: Provision a MySQL instance and set `DATABASE_URL`
- [ ] **Migrations**: Run `pnpm db:push` against the new database
- [ ] **Seed data**: Run `node seed-prices.mjs` to populate historical price data (requires `DATABASE_URL`)
- [ ] **Auth**: Replace Manus OAuth with your chosen auth provider (modify `sdk.ts`, `oauth.ts`, `const.ts`)
- [ ] **LLM**: Replace `invokeLLM()` with direct OpenAI/Gemini calls, or disable AI news
- [ ] **Storage**: Rewrite `storage.ts` to use direct S3/R2 if needed
- [ ] **Notifications**: Replace or remove `notification.ts`
- [ ] **Vite config**: Remove `vite-plugin-manus-runtime`, `vitePluginManusDebugCollector`, and `jsxLocPlugin` from `vite.config.ts`
- [ ] **Allowed hosts**: Update `server.allowedHosts` in `vite.config.ts` for your domain
- [ ] **Environment variables**: Set all required env vars on your hosting platform
- [ ] **Riot API key**: Obtain a production API key from Riot (dev keys have strict rate limits)
- [ ] **Build & deploy**: Run `pnpm build` and start with `node dist/index.js`
- [ ] **Verify polling**: Check server logs for `[Poll] Complete` messages every 20 minutes

---

## 9. Riot API Key Considerations

The application currently uses a **development API key** from Riot Games, which has strict rate limits (20 requests per second, 100 requests per 2 minutes) and expires every 24 hours.

For a production deployment, you should apply for a **production API key** through the [Riot Developer Portal](https://developer.riotgames.com). Production keys do not expire and have higher rate limits. The application's polling engine is already designed to be rate-limit-friendly (100ms delay between match detail requests, 20-minute polling interval).

---

*This guide was prepared based on the codebase as of March 24, 2026. The application version is `fd69d7d3`.*
