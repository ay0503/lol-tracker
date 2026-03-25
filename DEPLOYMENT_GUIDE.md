# Deployment Guide: Vercel (Frontend) + Railway (Backend)

This guide walks through deploying the LoL LP Tracker as a split architecture: the React frontend on **Vercel** and the Express/tRPC backend on **Railway**. Vercel rewrites proxy all `/api/*` requests to Railway server-side, so the browser sees everything as same-origin — no CORS issues.

---

## Architecture Overview

```
┌─────────────────────────┐  server-side   ┌──────────────────────────┐
│   Vercel (Frontend)      │   rewrite      │   Railway (Backend)       │
│                          │  ──────────►   │                           │
│  React + Vite SPA        │  /api/* ──────►│  Express + tRPC + SQLite  │
│  Static files + proxy    │                │  Riot API polling engine   │
│                          │  ◄──────────   │  JWT session cookies       │
│  vercel.json rewrites    │   response     │                           │
└─────────────────────────┘                └──────────────────────────┘
```

The frontend is a static SPA build served by Vercel's CDN. All `/api/*` requests are proxied by Vercel to the Railway backend via rewrites (server-side, not browser-side). This eliminates CORS entirely since the browser only talks to Vercel's domain.

---

## Part 1: Railway (Backend)

Deploy the backend first so you have the Railway URL for the Vercel rewrite config.

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
| `DATABASE_PATH` | `/app/data/lol-tracker.db` | Yes |
| `OPENAI_API_URL` | OpenAI-compatible API base URL (e.g., `https://api.openai.com/v1`) | No |
| `OPENAI_API_KEY` | API key for the LLM service | No |

**Note**: `CORS_ORIGIN` is no longer needed. Since Vercel proxies requests server-side, the backend receives requests from Vercel's infrastructure (not from the browser), so CORS is not involved. You can leave `CORS_ORIGIN` unset or remove it.

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

Copy this URL — you'll need it for the Vercel rewrite configuration.

### Railway Config Files (Already in Repo)

**`railway.toml`** — Railway reads this automatically:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
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
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/lol-tracker.db
EXPOSE 3000

# Migrations run programmatically inside the Node.js app at startup
# This ensures they run AFTER the Railway volume is mounted
CMD ["node", "dist/index.js"]
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

### Step 3: No Environment Variables Needed

Unlike the previous cross-origin approach, no `VITE_API_URL` is needed. The frontend always calls `/api/*` on the same origin, and Vercel rewrites proxy those requests to Railway server-side.

The Railway backend URL is configured directly in `vercel.json` rewrites. If your Railway URL is different from the default, update the rewrite destination in `vercel.json` before deploying.

### Step 4: Deploy

Click **Deploy**. Vercel will run `pnpm run build:frontend` which builds only the React SPA (no server code).

### Vercel Config File (Already in Repo)

**`vercel.json`** — The key is the `/api/:path*` rewrite that proxies to Railway:

```json
{
  "buildCommand": "pnpm run build:frontend",
  "outputDirectory": "dist/public",
  "installCommand": "pnpm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://lol-tracker-production.up.railway.app/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Important**: Update the `destination` URL to match your Railway backend URL. The `/api/:path*` rewrite must come before the SPA catch-all `/(.*)`  rewrite.

---

## Part 3: How the Proxy Works

1. Browser requests `https://your-app.vercel.app/api/trpc/player.current` (same origin).
2. Vercel matches the `/api/:path*` rewrite rule.
3. Vercel's edge network proxies the request server-side to `https://your-railway-app.up.railway.app/api/trpc/player.current`.
4. Railway's Express server processes the request and returns JSON.
5. Vercel forwards the response back to the browser.

Since the browser only ever talks to `your-app.vercel.app`, there are no CORS issues. Cookies set by the backend are also same-origin, so `SameSite=Lax` works (more secure than the previous `SameSite=None` approach).

---

## Part 4: Custom Domains (Optional)

### Vercel Custom Domain

1. Go to your Vercel project → **Settings** → **Domains**.
2. Add your custom domain (e.g., `lp.yourdomain.com`).
3. Follow Vercel's DNS instructions (add a CNAME record).
4. No changes needed on Railway — the proxy still works through Vercel's rewrites.

### Railway Custom Domain (Optional)

You can add a custom domain to Railway for direct API access (e.g., for mobile apps or external integrations), but it's not required for the web frontend since everything goes through Vercel's proxy.

---

## Troubleshooting

### API calls return 404

Make sure the rewrite rules in `vercel.json` have the `/api/:path*` rule **before** the SPA catch-all `/(.*)`  rule. If the SPA rule is first, it will serve `index.html` for API paths.

### Cookies not being sent / login doesn't persist

Cookies are now same-origin (`SameSite=Lax`), so they should work in all browsers including Safari Private Browsing and Firefox Strict ETP. If login doesn't persist, check that:
- The backend is setting the `app_session_id` cookie (check Response headers in DevTools).
- The cookie's `Path` is `/` (it should be by default).

### Database is empty after redeployment

The Railway volume mount at `/app/data` must be configured. Without it, SQLite writes to the ephemeral filesystem and gets wiped on every deploy. Verify the volume exists in Railway → **Settings** → **Volumes** and that `DATABASE_PATH` is set to `/app/data/lol-tracker.db`.

### Build fails on Vercel

Vercel only needs to build the frontend. If it's trying to build the server, check that the build command is `pnpm run build:frontend` (not `pnpm run build`). The `vercel.json` in the repo already sets this.

### Vercel rewrite not working (getting HTML instead of JSON)

If `/api/health` returns HTML (the SPA index.html) instead of JSON, the rewrite rules are in the wrong order. The `/api/:path*` rule must be listed first in the `rewrites` array.

### Railway URL changed

If you redeploy Railway and the URL changes, update the `destination` in `vercel.json` and redeploy Vercel.

---

## Quick Reference

| Service | What It Runs | Key Env Vars | URL Pattern |
|---------|-------------|--------------|-------------|
| **Vercel** | React SPA + API proxy | (none required) | `https://your-app.vercel.app` |
| **Railway** | Express + tRPC + SQLite + Polling | `JWT_SECRET`, `RIOT_API_KEY`, `DATABASE_PATH` | `https://your-app.up.railway.app` |

| Build Script | What It Does |
|-------------|-------------|
| `pnpm build` | Builds both frontend + backend (single-process mode) |
| `pnpm build:frontend` | Builds only the React SPA (for Vercel) |
| `pnpm build:server` | Builds only the Express server (for Railway) |
| `pnpm dev` | Runs both together locally (single-process, same origin) |
