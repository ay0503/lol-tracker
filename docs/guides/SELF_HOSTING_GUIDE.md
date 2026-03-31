# $DORI LP Tracker — Self-Hosting Guide

This guide covers everything you need to deploy and run the $DORI LP Tracker on your own server. The application is fully self-contained with zero external service dependencies beyond the Riot Games API.

---

## Architecture Overview

The $DORI LP Tracker is a **single-process Node.js application** that serves both the frontend and backend from one binary. There is no separate database server — all data lives in a single SQLite file.

```
┌─────────────────────────────────────────────────┐
│                  Node.js Process                │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Vite    │  │  Express  │  │  Poll Engine │  │
│  │  (React) │  │  (tRPC)   │  │  (15 min)    │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│                      │                │         │
│                ┌─────┴─────┐   ┌──────┴──────┐  │
│                │  SQLite   │   │  Riot API   │  │
│                │  (file)   │   │  (external) │  │
│                └───────────┘   └─────────────┘  │
└─────────────────────────────────────────────────┘
```

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React 19, TailwindCSS 4, Recharts, TradingView Lightweight Charts | Robinhood-style trading UI |
| Backend | Express 4, tRPC v11, TypeScript | API layer with type-safe RPC |
| Database | SQLite via `@libsql/client` + Drizzle ORM | Single-file database at `./data/lol-tracker.db` |
| Auth | bcryptjs + jose (JWT) | Email/password signup and login |
| Polling | Built-in setInterval (15 min) | Fetches LP, matches, generates news, executes orders |
| AI News | Any OpenAI-compatible API (optional) | Generates meme financial news headlines |

---

## Prerequisites

You need the following installed on your server:

| Requirement | Minimum Version | Notes |
|-------------|----------------|-------|
| **Node.js** | 18.x or later | v22 recommended |
| **pnpm** | 10.x | Package manager (`npm install -g pnpm`) |
| **Riot API Key** | — | Get one at [developer.riotgames.com](https://developer.riotgames.com) |

No database server, Redis, or external auth provider is needed.

---

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url> lol-tracker
cd lol-tracker
pnpm install
```

### 2. Create Environment File

Create a `.env` file in the project root:

```env
# Required
JWT_SECRET=your-random-secret-key-at-least-32-chars
RIOT_API_KEY=RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Optional
PORT=3000
DATABASE_PATH=./data/lol-tracker.db

# Optional: AI meme news generation (any OpenAI-compatible API)
OPENAI_API_URL=https://api.openai.com
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Initialize Database

```bash
pnpm db:push
```

This creates the SQLite database file and runs all migrations. The database is stored at `./data/lol-tracker.db` by default.

### 4. Build and Run

```bash
# Build the frontend and bundle the server
pnpm build

# Start the production server
NODE_ENV=production node dist/index.js
```

The app will be available at `http://localhost:3000` (or whatever port you set).

### 5. Create Your Account

Visit `http://localhost:3000/register` to create the first user account. The first user can be promoted to admin by running:

```bash
# Using the sqlite3 CLI (install with: apt install sqlite3)
sqlite3 ./data/lol-tracker.db "UPDATE users SET role='admin' WHERE id=1;"
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes** | `change-me-in-production` | Secret key for signing JWT session cookies. Use a random 32+ character string. |
| `RIOT_API_KEY` | **Yes** | — | Riot Games API key for fetching player data. |
| `PORT` | No | `3000` | HTTP port the server listens on. |
| `DATABASE_PATH` | No | `./data/lol-tracker.db` | Path to the SQLite database file. |
| `OPENAI_API_URL` | No | — | Base URL for an OpenAI-compatible LLM API (e.g., `https://api.openai.com`). |
| `OPENAI_API_KEY` | No | — | API key for the LLM service. |
| `NODE_ENV` | No | — | Set to `production` for production builds. |

### About the Riot API Key

Riot provides two types of API keys:

- **Development Key**: Free, expires every 24 hours. Good for testing but requires manual renewal.
- **Production Key**: Requires a registered application. Apply at the [Riot Developer Portal](https://developer.riotgames.com). This is what you want for a persistent deployment.

The polling engine fetches data every 15 minutes. With a development key, you will need to update the `.env` file and restart the server daily.

### About the LLM Integration (Optional)

The AI meme news feature generates funny financial headlines when the tracked player finishes a match. If `OPENAI_API_URL` and `OPENAI_API_KEY` are not set, the system falls back to pre-written template headlines — the feature still works, just without AI-generated humor.

Any OpenAI-compatible API works, including:

| Provider | API URL | Notes |
|----------|---------|-------|
| OpenAI | `https://api.openai.com` | GPT-4o-mini recommended |
| Ollama (local) | `http://localhost:11434` | Free, runs on your machine |
| LM Studio | `http://localhost:1234` | Free, local GUI |
| Together AI | `https://api.together.xyz` | Cheap cloud option |
| OpenRouter | `https://openrouter.ai/api` | Multi-model gateway |

---

## Database

The application uses **SQLite** — a single file that lives at `./data/lol-tracker.db`. There is no database server to install, configure, or maintain.

### Schema (14 tables)

| Table | Purpose |
|-------|---------|
| `users` | User accounts with email/password auth |
| `portfolios` | Cash balance per user (starts at $200) |
| `holdings` | Share positions per ticker per user |
| `trades` | Transaction history (buy, sell, short, cover) |
| `orders` | Pending limit orders and stop-losses |
| `priceHistory` | LP price snapshots (one per poll cycle) |
| `matches` | Stored match results from Riot API |
| `comments` | User sentiment posts (bullish/bearish) |
| `news` | AI-generated meme news articles |
| `dividends` | Dividend distribution records |
| `marketStatus` | Whether the market is open/closed |
| `portfolioSnapshots` | Portfolio value history for P&L charts |
| `notifications` | Order fill notifications |

### Backup

To back up the database, simply copy the file:

```bash
cp ./data/lol-tracker.db ./data/lol-tracker.db.backup
```

For automated backups, add a cron job:

```bash
# Daily backup at 3 AM
0 3 * * * cp /path/to/lol-tracker/data/lol-tracker.db /path/to/backups/lol-tracker-$(date +\%Y\%m\%d).db
```

### Reset

To start fresh, delete the database file and re-run migrations:

```bash
rm ./data/lol-tracker.db
pnpm db:push
```

---

## Customizing the Tracked Player

By default, the app tracks the player **목도리 도마뱀#dori** on the NA server. To change this, edit two files:

### `server/pollEngine.ts`

```typescript
// Change these constants at the top of the file
const GAME_NAME = "YourPlayerName";
const TAG_LINE = "YourTag";
```

### `server/routers.ts`

Find the `player.current` endpoint and update the hardcoded values:

```typescript
const data = await fetchFullPlayerData("YourPlayerName", "YourTag");
```

### `server/riotApi.ts`

If the player is on a different region, update the API base URLs:

```typescript
// Change these for your region
const AMERICAS_BASE = "https://americas.api.riotgames.com";  // Americas
const NA_BASE = "https://na1.api.riotgames.com";             // NA server

// Other regions:
// Europe: https://europe.api.riotgames.com / https://euw1.api.riotgames.com
// Asia: https://asia.api.riotgames.com / https://kr.api.riotgames.com
```

### ETF Ticker Names

The 5 ETF tickers are derived from the player's tag. To rename them, edit `server/etfPricing.ts`:

```typescript
export const TICKERS = ["DORI", "DDRI", "TDRI", "SDRI", "XDRI"] as const;
```

---

## Deployment Options

### Option 1: Bare Metal / VPS (Recommended)

The simplest deployment — just run the Node.js process directly. This is ideal for a small group of ~20 friends.

```bash
# Build
pnpm build

# Run with environment variables
JWT_SECRET=your-secret RIOT_API_KEY=RGAPI-xxx NODE_ENV=production node dist/index.js
```

For process management, use **pm2**:

```bash
npm install -g pm2
pm2 start dist/index.js --name lol-tracker
pm2 save
pm2 startup  # auto-start on reboot
```

**Cost**: ~$4-6/month for a basic VPS (DigitalOcean, Hetzner, Linode).

### Option 2: Docker

Create a `Dockerfile` in the project root:

```dockerfile
FROM node:22-slim AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm db:push

FROM node:22-slim
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/client/public ./client/public
COPY drizzle.config.ts ./
VOLUME /app/data
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

And a `docker-compose.yml`:

```yaml
version: "3.8"
services:
  lol-tracker:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - JWT_SECRET=your-secret-key-here
      - RIOT_API_KEY=RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      - DATABASE_PATH=/app/data/lol-tracker.db
      # Optional: AI news generation
      # - OPENAI_API_URL=https://api.openai.com
      # - OPENAI_API_KEY=sk-xxx
    restart: unless-stopped
```

Run with:

```bash
docker compose up -d
```

### Option 3: Reverse Proxy (Nginx + HTTPS)

If you want HTTPS and a custom domain, put Nginx in front:

```nginx
server {
    listen 443 ssl;
    server_name dori.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/dori.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dori.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Use [Certbot](https://certbot.eff.org/) for free Let's Encrypt SSL certificates:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d dori.yourdomain.com
```

### Platforms to Avoid

**Vercel and Netlify** are not suitable because they are designed for serverless/edge functions and static sites. This application requires a persistent, always-on Node.js process for the background polling engine.

---

## Features Overview

### Trading System

Every new user starts with **$200 in virtual cash**. They can trade 5 ETF tickers:

| Ticker | Type | Description |
|--------|------|-------------|
| `$DORI` | 1x Base | Tracks LP directly (1 LP point ≈ price movement) |
| `$DDRI` | 2x Leveraged | Amplifies daily LP returns by 2x |
| `$TDRI` | 3x Leveraged | Amplifies daily LP returns by 3x |
| `$SDRI` | 2x Inverse | Profits when LP drops (2x inverse) |
| `$XDRI` | 3x Inverse | Profits when LP drops (3x inverse) |

Supported order types include market orders, limit orders, stop-losses, and short selling. Dividends are distributed automatically when the tracked player wins or loses games.

### Internationalization

The entire UI supports **Korean** and **English** with a toggle in the navigation bar. All dates, numbers, and times are formatted according to the selected locale.

### Themes

Dark and light themes are available via the toggle in the navigation bar. The dark theme uses a deep charcoal Robinhood-style aesthetic, while the light theme uses white backgrounds with glassmorphism effects.

---

## Development

To run in development mode with hot reload:

```bash
pnpm dev
```

This starts the Express server with Vite middleware for instant frontend updates.

### Running Tests

```bash
pnpm test
```

All 58 tests should pass. Tests cover authentication, trading logic, portfolio calculations, Riot API parsing, and more.

### Project Structure

```
server/
  _core/           ← Framework plumbing (auth, context, trpc, vite)
  db.ts            ← Database query helpers
  routers.ts       ← tRPC API endpoints
  pollEngine.ts    ← Background polling job
  riotApi.ts       ← Riot Games API client
  etfPricing.ts    ← ETF price calculation engine
client/
  src/
    pages/         ← Page components (Home, Portfolio, Ledger, etc.)
    components/    ← Reusable UI components
    contexts/      ← React contexts (Language, Theme)
    lib/           ← Utilities (trpc client, formatters, playerData)
    i18n/          ← Korean/English translations
drizzle/
  schema.ts        ← Database schema (14 tables)
shared/
  const.ts         ← Shared constants
data/
  lol-tracker.db   ← SQLite database (created on first run)
```

---

## Security Notes

For a deployment serving ~20 friends, the following are adequate:

- **JWT sessions** are signed with `JWT_SECRET` and stored as HTTP-only cookies. Use a strong, random secret in production.
- **Passwords** are hashed with bcryptjs (12 rounds). No plaintext passwords are stored.
- **CORS** is not an issue since the frontend and backend are served from the same origin.
- **Rate limiting** is not built in. If you expose the app to the public internet, consider adding `express-rate-limit` to the login and register endpoints.

---

## Troubleshooting

### "RIOT_API_KEY is not set"

Make sure your `.env` file exists in the project root and contains a valid `RIOT_API_KEY`. Development keys expire every 24 hours.

### Database locked errors

SQLite uses WAL mode for better concurrency, but if you see "database is locked" errors under heavy load, it means too many concurrent writes. For ~20 users this should never happen. If it does, ensure only one Node.js process is running.

### Polling engine not fetching data

Check the server logs for `[Poll]` messages. Common issues include expired Riot API keys or rate limiting (the development key has a low rate limit). The polling engine logs its status every cycle.

### Build fails with TypeScript errors

Run `pnpm check` to see all TypeScript errors. The project should have zero errors. If you see errors after pulling updates, try:

```bash
rm -rf node_modules
pnpm install
pnpm check
```

### AI news shows template headlines instead of generated ones

This means either `OPENAI_API_URL` or `OPENAI_API_KEY` is not set, or the LLM API returned an error. Check the server logs for `[News] LLM generation failed` messages. The app will continue to work with pre-written fallback headlines.

---

## What Was Removed (Manus Platform Dependencies)

The following Manus-specific integrations have been fully removed from the codebase. This section is kept for reference in case you encounter any mentions in git history.

| Removed Component | What It Was | Replacement |
|-------------------|-------------|-------------|
| Manus OAuth (`oauth.ts`) | External OAuth login flow | Local email/password auth (already built) |
| Forge LLM (`llm.ts` old version) | Manus-hosted Gemini API proxy | Any OpenAI-compatible API via env vars |
| Forge Storage (`storage.ts`) | S3 proxy for file uploads | Deleted (unused by the app) |
| Forge Notifications (`notification.ts`) | Push notifications to owner | Deleted (unused by the app) |
| Image Generation (`imageGeneration.ts`) | AI image generation proxy | Deleted (unused by the app) |
| Voice Transcription (`voiceTranscription.ts`) | Whisper API proxy | Deleted (unused by the app) |
| Data API (`dataApi.ts`) | External data API proxy | Deleted (unused by the app) |
| Map component (`Map.tsx`) | Google Maps proxy | Deleted (unused by the app) |
| Manus Vite plugins | Dev tooling and debug collector | Removed from `vite.config.ts` |
| CloudFront CDN assets | Hosted images (favicon, rank, bg) | Moved to `client/public/assets/` |
| Umami analytics | Page view tracking | Removed from `index.html` |
| ManusDialog component | OAuth login dialog | Deleted (unused) |
| DashboardLayout | Admin sidebar template | Deleted (unused) |
| AIChatBox | Chat UI template | Deleted (unused) |
| ComponentShowcase | Template demo page | Deleted (unused) |

---

*Last updated: March 24, 2026*
