# Deployment Guide: Vercel (Frontend) + Railway (Backend)

This guide walks through deploying the LoL LP Tracker as a split architecture: the React frontend on **Vercel** and the Express/tRPC backend on **Railway**. Both services talk to each other via CORS-enabled API calls, and authentication cookies work cross-origin with `SameSite=None; Secure`.

---

## Architecture Overview

```
┌─────────────────────┐         ┌──────────────────────────┐
│   Vercel (Frontend)  │  HTTPS  │   Railway (Backend)       │
│                      │ ──────► │                           │
│  React + Vite SPA    │         │  Express + tRPC + SQLite  │
│  Static files only   │         │  Riot API polling engine   │
│                      │ ◄────── │  JWT session cookies       │
│  VITE_API_URL ───────┼────────►│  CORS_ORIGIN ─────────────┤
└─────────────────────┘         └──────────────────────────┘
```

The frontend is a static SPA build served by Vercel's CDN. All API calls go to the Railway backend via the `VITE_API_URL` environment variable. The backend runs the Express server, tRPC API, SQLite database, and the Riot API polling engine.

---

## Part 1: Railway (Backend)

Deploy the backend first so you have the Railway URL to give to Vercel.

### Step 1: Create a Railway Project

1. Go to [railway.app](https://railway.app) and sign in.
2. Click **New Project** → **Deploy from GitHub Repo**.
3. Select the `ay0503/lol-tracker` repository.
4. Railway will auto-detect the `Dockerfile` and `railway.toml` in the repo.

### Step 2: Add a Persistent Volume

The SQLite database needs persistent storage that survives redeployments. Railway's ephemeral filesystem would wipe the DB on every deploy without this.

1. In your Railway service, go to **Settings** → **Volumes**.
2. Click **Add Volume**.
3. Set the **Mount Path** to `/app/data`.
4. This is already configured in `railway.toml`, but verify it shows up.

### Step 3: Set Environment Variables

In your Railway service, go to **Variables** and add these:

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | Yes |
| `PORT` | `3000` | Yes |
| `JWT_SECRET` | A random 32+ character string (e.g., `openssl rand -hex 32`) | Yes |
| `RIOT_API_KEY` | Your Riot Games API key | Yes |
| `CORS_ORIGIN` | Your Vercel frontend URL (set after Vercel deploy, e.g., `https://lol-tracker.vercel.app`) | Yes |
| `DATABASE_PATH` | `/app/data/lol-tracker.db` | Yes |
| `OPENAI_API_URL` | OpenAI-compatible API base URL (e.g., `https://api.openai.com/v1`) | No |
| `OPENAI_API_KEY` | API key for the LLM service | No |

**Important**: Set `DATABASE_PATH` to `/app/data/lol-tracker.db` so it writes to the persistent volume, not the ephemeral filesystem.

### Step 4: Deploy

Railway will automatically build using the `Dockerfile` and start the server. Check the deploy logs for:

```
Server running on http://localhost:3000/
[Poll] Starting polling engine...
```

### Step 5: Verify the Backend

Once deployed, Railway gives you a public URL like `https://lol-tracker-production.up.railway.app`. Test it:

```bash
curl https://lol-tracker-production.up.railway.app/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

Copy this URL — you'll need it for the Vercel setup.

### Railway Config Files (Already in Repo)

**`railway.toml`** — Railway reads this automatically:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node dist/index.js"
healthcheckPath = "/api/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5

[[mounts]]
mountPath = "/app/data"
```

**`Dockerfile`** — Multi-stage build for a lean production image:

```dockerfile
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build:server

FROM base AS production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/patches ./patches
COPY --from=build /app/drizzle.config.ts ./
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
# Default DATABASE_PATH to the persistent volume mount
ENV DATABASE_PATH=/app/data/lol-tracker.db
EXPOSE 3000
# Migrations run at startup so they target the volume-mounted DB
CMD ["sh", "-c", "DATABASE_PATH=/app/data/lol-tracker.db pnpm db:push && node dist/index.js"]
```

---

## Part 2: Vercel (Frontend)

### Step 1: Import the Project

1. Go to [vercel.com/new](https://vercel.com/new).
2. Click **Import Git Repository** and select `ay0503/lol-tracker`.
3. Vercel will auto-detect the `vercel.json` configuration.

### Step 2: Configure Build Settings

Vercel should auto-detect these from `vercel.json`, but verify them in the project settings:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Build Command** | `pnpm run build:frontend` |
| **Output Directory** | `dist/public` |
| **Install Command** | `pnpm install` |

### Step 3: Set Environment Variables

In your Vercel project, go to **Settings** → **Environment Variables** and add:

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_API_URL` | Your Railway backend URL (e.g., `https://lol-tracker-production.up.railway.app`) | Yes |

**No trailing slash** on the URL. The frontend will append `/api/trpc` to this base URL.

### Step 4: Deploy

Click **Deploy**. Vercel will run `pnpm run build:frontend` which builds only the React SPA (no server code). The `vercel.json` rewrites handle SPA routing so all paths serve `index.html`.

### Vercel Config File (Already in Repo)

**`vercel.json`**:

```json
{
  "buildCommand": "pnpm run build:frontend",
  "outputDirectory": "dist/public",
  "installCommand": "pnpm install",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## Part 3: Connect Frontend ↔ Backend

After both are deployed, you need to set the cross-references:

### 3a. Update Railway's CORS_ORIGIN

Go to your Railway service → **Variables** and set:

```
CORS_ORIGIN=https://your-app.vercel.app
```

Replace with your actual Vercel domain. Railway will auto-redeploy.

### 3b. Verify Vercel's VITE_API_URL

Go to your Vercel project → **Settings** → **Environment Variables** and confirm:

```
VITE_API_URL=https://lol-tracker-production.up.railway.app
```

Replace with your actual Railway domain. **Redeploy** the Vercel project after setting this (Vercel bakes `VITE_*` vars into the static build at build time, so you need a fresh deploy).

---

## Part 4: How Cross-Origin Auth Works

The app uses JWT session cookies for authentication. When the frontend and backend are on different domains, cookies need special handling:

1. **Backend sets cookies with `SameSite=None; Secure`** — This is already configured in `server/_core/cookies.ts`. The `SameSite=None` flag allows the cookie to be sent cross-origin, and `Secure` ensures it only works over HTTPS (which both Vercel and Railway provide by default).

2. **Frontend sends `credentials: "include"`** — The tRPC client in `client/src/main.tsx` already includes `credentials: "include"` in every fetch call, which tells the browser to attach cookies even for cross-origin requests.

3. **Backend enables CORS with credentials** — When `CORS_ORIGIN` is set, the Express server enables CORS with `credentials: true` for that specific origin.

This means login, registration, and all authenticated API calls work seamlessly across Vercel and Railway without any additional configuration.

---

## Part 5: Custom Domains (Optional)

### Vercel Custom Domain

1. Go to your Vercel project → **Settings** → **Domains**.
2. Add your custom domain (e.g., `lp.yourdomain.com`).
3. Follow Vercel's DNS instructions (add a CNAME record).
4. **Update Railway's `CORS_ORIGIN`** to match the new domain.

### Railway Custom Domain

1. Go to your Railway service → **Settings** → **Networking** → **Custom Domain**.
2. Add your custom domain (e.g., `api.yourdomain.com`).
3. Follow Railway's DNS instructions.
4. **Update Vercel's `VITE_API_URL`** to match the new domain and **redeploy**.

---

## Troubleshooting

### "CORS error" in browser console

The `CORS_ORIGIN` on Railway doesn't match the actual frontend URL. Check for:
- Trailing slash mismatch (`https://app.vercel.app` vs `https://app.vercel.app/`)
- HTTP vs HTTPS mismatch
- Wrong domain entirely

### Cookies not being sent / login doesn't persist

Both Vercel and Railway must serve over HTTPS (they do by default). If you're testing locally with `http://localhost`, cross-origin cookies won't work because `SameSite=None` requires `Secure`, which requires HTTPS. For local development, use `pnpm dev` which runs everything on the same origin.

### API calls return 404

Make sure `VITE_API_URL` has no trailing slash. The frontend appends `/api/trpc` to it. Correct: `https://my-app.up.railway.app`. Wrong: `https://my-app.up.railway.app/`.

### Database is empty after redeployment

The Railway volume mount at `/app/data` must be configured. Without it, SQLite writes to the ephemeral filesystem and gets wiped on every deploy. Verify the volume exists in Railway → **Settings** → **Volumes** and that `DATABASE_PATH` is set to `/app/data/lol-tracker.db`.

### Build fails on Vercel

Vercel only needs to build the frontend. If it's trying to build the server, check that the build command is `pnpm run build:frontend` (not `pnpm run build`). The `vercel.json` in the repo already sets this.

### "VITE_API_URL is not defined" or API calls go to same origin

`VITE_*` environment variables are baked into the static build at build time. If you add or change `VITE_API_URL` after deploying, you must **redeploy** the Vercel project for the change to take effect.

---

## Quick Reference

| Service | What It Runs | Key Env Vars | URL Pattern |
|---------|-------------|--------------|-------------|
| **Vercel** | React SPA (static files) | `VITE_API_URL` | `https://your-app.vercel.app` |
| **Railway** | Express + tRPC + SQLite + Polling | `JWT_SECRET`, `RIOT_API_KEY`, `CORS_ORIGIN`, `DATABASE_PATH` | `https://your-app.up.railway.app` |

| Build Script | What It Does |
|-------------|-------------|
| `pnpm build` | Builds both frontend + backend (single-process mode) |
| `pnpm build:frontend` | Builds only the React SPA (for Vercel) |
| `pnpm build:server` | Builds only the Express server (for Railway) |
| `pnpm dev` | Runs both together locally (single-process, same origin) |
