# $DORI LP Tracker

A Robinhood-style fantasy trading platform built around a single League of Legends player's ranked performance. Track LP as a stock price, trade leveraged and inverse ETFs, compete on a leaderboard, and follow AI-generated meme news — all powered by live Riot API data.

---

## Overview

$DORI LP Tracker turns the ranked journey of **목도리 도마뱀** (#dori, NA server) into a full financial simulation. The player's LP is mapped to a stock price (`$DORI`), and users can register accounts, receive $200 in starting cash, and trade a family of five ETF tickers derived from that price. A background polling engine fetches live data from the Riot Games API every 15–20 minutes, updates prices, distributes match-based dividends, executes pending limit orders, and generates AI-powered satirical news articles.

The application is fully self-hostable with zero external dependencies beyond the Riot API. It uses SQLite for storage, JWT for authentication, and ships as a single Node.js process.

---

## Features

| Feature | Description |
|---------|-------------|
| **Live LP Tracking** | Polls Riot API for ranked stats, maps LP to a dollar price with tier-based pricing |
| **5 ETF Tickers** | `$DORI` (1x), `$DDRI` (2x leveraged), `$TDRI` (3x leveraged), `$SDRI` (2x inverse), `$XDRI` (3x inverse) |
| **Trading Engine** | Market buys/sells, short selling, limit orders, and stop-losses with real-time execution |
| **Dividends** | Automatic payouts on match wins ($0.50/share) and losses (-$0.25/share) for `$DORI` holders |
| **Portfolio Management** | Track holdings, P&L, cost basis, and trade history per user |
| **Leaderboard** | Ranked by total portfolio value (cash + holdings at current prices) |
| **AI Meme News** | LLM-generated satirical financial news articles based on match results (optional, requires OpenAI-compatible API) |
| **Sentiment Board** | Public comment feed with bullish/bearish/neutral sentiment tagging |
| **Interactive Charts** | Line and candlestick charts with 1W/1M/3M/6M/YTD/ALL time ranges |
| **Match History** | Full match details with champion, KDA, CS, damage, and win/loss |
| **Champion Pool Stats** | Aggregated win rates, KDA, and game counts per champion |
| **Win/Loss Streaks** | Visual streak bar showing recent match momentum |
| **Season History** | Current and past season rank placements |
| **Notifications** | In-app notification bell for dividends, order fills, and market events |
| **i18n** | English and Korean language support |
| **Dark/Light Theme** | Switchable theme with dark mode default |
| **Server + Client Caching** | Two-layer cache (30 min server TTL + 10 min client staleTime) with auto-invalidation on poll |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Recharts, TradingView Lightweight Charts, Framer Motion |
| Backend | Express 4, tRPC v11, TypeScript, Superjson |
| Database | SQLite via `@libsql/client` + Drizzle ORM |
| Auth | Email/password with bcrypt hashing + JWT session cookies |
| Polling | Background engine fetching Riot API every 15–20 minutes |
| Testing | Vitest (58 tests across 6 test files) |
| Build | Vite (frontend) + esbuild (server bundle) |

---

## Project Structure

```
lol-tracker/
├── client/                     # Frontend (React SPA)
│   ├── src/
│   │   ├── pages/              # Route-level pages
│   │   │   ├── Home.tsx        # Main dashboard with all widgets
│   │   │   ├── Portfolio.tsx   # User portfolio & trade history
│   │   │   ├── Ledger.tsx      # Global trade feed
│   │   │   ├── Leaderboard.tsx # Portfolio value rankings
│   │   │   ├── NewsFeed.tsx    # AI-generated meme news
│   │   │   ├── Sentiment.tsx   # Public comment board
│   │   │   ├── Login.tsx       # Email/password login
│   │   │   └── Register.tsx    # Account registration
│   │   ├── components/         # Reusable UI components
│   │   │   ├── PlayerHeader.tsx
│   │   │   ├── LPChart.tsx
│   │   │   ├── CandlestickChart.tsx
│   │   │   ├── TradingPanel.tsx
│   │   │   ├── ChampionCard.tsx
│   │   │   ├── MatchRow.tsx
│   │   │   ├── StreakBar.tsx
│   │   │   ├── RecentPerformance.tsx
│   │   │   ├── SeasonHistory.tsx
│   │   │   ├── PriceRankLegend.tsx
│   │   │   ├── NotificationBell.tsx
│   │   │   └── ui/             # shadcn/ui primitives
│   │   ├── i18n/               # Translations (en.ts, ko.ts)
│   │   ├── contexts/           # Theme, Language providers
│   │   ├── lib/                # Utilities, formatters, tRPC client
│   │   └── hooks/              # Custom React hooks
│   └── public/                 # Static assets (favicon, rank icons)
├── server/                     # Backend
│   ├── _core/                  # Framework plumbing (Express, tRPC, auth)
│   │   ├── index.ts            # Server entry point
│   │   ├── context.ts          # tRPC context (JWT session → user)
│   │   ├── sdk.ts              # JWT session management
│   │   ├── env.ts              # Environment variable config
│   │   ├── trpc.ts             # tRPC router/procedure factories
│   │   ├── llm.ts              # OpenAI-compatible LLM client (optional)
│   │   └── vite.ts             # Vite dev middleware bridge
│   ├── routers.ts              # All tRPC endpoints
│   ├── db.ts                   # Database query helpers
│   ├── pollEngine.ts           # Background Riot API polling engine
│   ├── riotApi.ts              # Riot API client
│   ├── etfPricing.ts           # ETF price computation logic
│   ├── cache.ts                # Server-side in-memory cache
│   └── *.test.ts               # Vitest test files
├── drizzle/                    # Database schema & migrations
│   └── schema.ts               # All 13 SQLite tables
├── shared/                     # Shared types & constants
├── SELF_HOSTING_GUIDE.md       # Full self-hosting documentation
└── todo.md                     # Development task tracker
```

---

## Database Schema

The application uses 13 SQLite tables managed by Drizzle ORM:

| Table | Purpose |
|-------|---------|
| `users` | User accounts (email, password hash, role, display name) |
| `portfolios` | Per-user cash balance and total dividends received |
| `holdings` | Per-user per-ticker share quantities and cost basis |
| `trades` | Complete trade history (buys, sells, shorts, covers) |
| `orders` | Pending limit orders and stop-losses |
| `priceHistory` | LP snapshots with tier, division, LP, and computed price |
| `matches` | Stored match results from Riot API |
| `news` | AI-generated meme news articles |
| `comments` | Sentiment board comments (bullish/bearish/neutral) |
| `dividends` | Dividend payment records per match per user |
| `marketStatus` | Market open/closed state |
| `portfolioSnapshots` | Periodic portfolio value snapshots for history charts |
| `notifications` | In-app notifications (dividends, order fills, etc.) |

---

## Getting Started

### Prerequisites

- **Node.js** 20+ (22 recommended)
- **pnpm** package manager
- **Riot Games API key** ([developer.riotgames.com](https://developer.riotgames.com))

### Installation

```bash
git clone <your-repo-url> lol-tracker
cd lol-tracker
pnpm install
```

### Configuration

Create a `.env` file in the project root:

```env
# Required
RIOT_API_KEY=RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
JWT_SECRET=your-secure-random-string-here

# Optional
DATABASE_PATH=./data/lol-tracker.db          # Default: ./data/lol-tracker.db
OPENAI_API_URL=https://api.openai.com/v1     # For AI news generation
OPENAI_API_KEY=sk-...                         # For AI news generation
```

### Database Setup

```bash
pnpm db:push
```

This generates and runs Drizzle migrations to create all 13 tables in the SQLite database.

### Development

```bash
pnpm dev
```

The dev server starts with hot reload on `http://localhost:3000`. The polling engine begins fetching Riot API data immediately.

### Production Build

```bash
pnpm build
pnpm start
```

The build step bundles the React frontend with Vite and the server with esbuild into `dist/`. The start command runs the production server.

### Running Tests

```bash
pnpm test
```

Runs all 58 Vitest tests across 6 test files covering auth, trading, stats, features, and Riot API integration.

---

## ETF Pricing Model

The core pricing model maps League of Legends LP to a dollar value using a tier-based system:

| Tier | Base LP | Price at 0 LP |
|------|---------|---------------|
| Iron IV | 0 | $1.00 |
| Bronze IV | 400 | $5.00 |
| Silver IV | 800 | $9.00 |
| Gold IV | 1200 | $13.00 |
| Platinum IV | 1600 | $17.00 |
| Emerald IV | 2000 | $21.00 |
| Diamond IV | 2400 | $25.00 |
| Master 0 LP | 2800 | $29.00 |

Each LP point adds $0.01 to the base price. The five ETF tickers apply leverage multipliers to the percentage change from the previous price snapshot:

- **$DORI** — 1x (tracks LP directly)
- **$DDRI** — 2x leveraged (doubles gains and losses)
- **$TDRI** — 3x leveraged (triples gains and losses)
- **$SDRI** — 2x inverse (profits when LP drops)
- **$XDRI** — 3x inverse (profits more when LP drops)

---

## Caching Strategy

The application uses a two-layer caching strategy to minimize database queries:

**Server-side** (`server/cache.ts`): An in-memory cache with 30-minute TTL wraps all public tRPC endpoints. The cache auto-invalidates after each polling engine cycle writes new data. Individual cache entries can also be invalidated on mutations (trades, comments, etc.).

**Client-side** (React Query): Global defaults set `staleTime` to 10 minutes and `gcTime` to 30 minutes. Window focus refetching is disabled. This means navigating between pages serves cached data instantly without network requests.

---

## Self-Hosting

See **[SELF_HOSTING_GUIDE.md](./SELF_HOSTING_GUIDE.md)** for complete deployment instructions including:

- Docker and Docker Compose setup
- Reverse proxy configuration (Nginx, Caddy)
- Systemd service files
- Environment variable reference
- Backup and restore procedures
- Tracking a different summoner

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RIOT_API_KEY` | Yes | — | Riot Games API key for fetching player data |
| `JWT_SECRET` | Yes | `change-me-in-production` | Secret for signing JWT session cookies |
| `DATABASE_PATH` | No | `./data/lol-tracker.db` | Path to the SQLite database file |
| `OPENAI_API_URL` | No | — | OpenAI-compatible API base URL for AI news |
| `OPENAI_API_KEY` | No | — | API key for the LLM service |
| `NODE_ENV` | No | — | Set to `production` for production builds |

---

## API Endpoints (tRPC)

All endpoints are served under `/api/trpc` and are fully type-safe via tRPC.

| Router | Procedure | Auth | Description |
|--------|-----------|------|-------------|
| `auth` | `me` | Public | Get current user session |
| `auth` | `login` | Public | Email/password login |
| `auth` | `register` | Public | Create new account |
| `auth` | `logout` | Protected | End session |
| `auth` | `updateDisplayName` | Protected | Change display name |
| `player` | `current` | Public | Live Riot API player data |
| `prices` | `latest` | Public | Most recent price snapshot |
| `prices` | `etfPrices` | Public | Current prices for all 5 tickers |
| `prices` | `history` | Public | Raw price snapshot history |
| `prices` | `etfHistory` | Public | Computed ETF price history for charts |
| `stats` | `championPool` | Public | Aggregated champion stats |
| `stats` | `streaks` | Public | Win/loss streak data |
| `stats` | `recentPerformance` | Public | 7-day champion win rates |
| `stats` | `avgKda` | Public | Average KDA over N games |
| `matches` | `stored` | Public | Stored match history |
| `trading` | `portfolio` | Protected | User portfolio with holdings |
| `trading` | `trade` | Protected | Execute buy/sell/short/cover |
| `trading` | `history` | Protected | User trade history |
| `trading` | `orders.*` | Protected | Limit order management |
| `leaderboard` | `rankings` | Public | Portfolio value leaderboard |
| `ledger` | `all` | Public | Global trade feed |
| `news` | `feed` | Public | AI-generated news articles |
| `comments` | `list` | Public | Sentiment board comments |
| `comments` | `post` | Protected | Post a comment |
| `notifications` | `*` | Protected | User notification management |
| `market` | `status` | Public | Market open/closed state |
| `market` | `toggleMarket` | Admin | Open/close the market |
| `system` | `pollNow` | Admin | Trigger immediate poll cycle |

---

## License

MIT
