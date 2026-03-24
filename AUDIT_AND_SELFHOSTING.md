# LoL LP Tracker — Full Audit & Self-Hosting Analysis

**Author:** Manus AI | **Date:** March 24, 2026

---

## 1. Executive Summary

This document answers three questions you raised:

1. **What is hardcoded, static, or not wired to real data?**
2. **Do transactions actually have proper effects?**
3. **What does it take to self-host this outside Manus, and do you really need a database for ~20 users?**

The short version: the backend trading system is **fully real and wired** — buys, sells, shorts, covers, limit orders, dividends, and leaderboard all read/write from the database and produce real side effects. However, the **chart and several homepage sections use simulated/static fallback data** that makes the site look more "complete" than the backend data alone would support. And the architecture has **5 Manus-specific dependencies** that need replacement for self-hosting, but the core app is a simple Node.js monolith that's very portable.

---

## 2. Audit: What Is Real vs. Hardcoded

### 2.1 Fully Real (Backend-Wired) Features

These features read from and write to the database through tRPC endpoints. Transactions have proper side effects (cash deducted, shares updated, records created).

| Feature | Backend Endpoint | Side Effects |
|---------|-----------------|--------------|
| **Buy/Sell trades** | `trading.trade` | Deducts/credits cash, updates share count, records trade row, recalculates avg cost basis |
| **Short selling** | `trading.short` | Locks 50% margin, credits sale proceeds, tracks short position + avg price |
| **Cover shorts** | `trading.cover` | Deducts buy-back cost, reduces short position |
| **Limit orders** | `trading.createOrder` | Persists pending order; poll engine fills when price crosses target |
| **Stop-loss orders** | `trading.createOrder` | Same as limit orders but triggered on price drop |
| **Cancel orders** | `trading.cancelOrder` | Updates order status to "cancelled" |
| **Dividends** | Auto-distributed by poll engine | Credits cash per share held; $0.50-$1.00/share depending on ticker and win/loss |
| **Portfolio balance** | `trading.portfolio` | Returns real cash + holdings from DB |
| **Trade history** | `trading.history` | Returns actual trade records |
| **Public ledger** | `ledger.all` | Returns all trades across all users |
| **Leaderboard** | `leaderboard.rankings` | Computes real portfolio values from DB holdings × current ETF prices |
| **Comments/Sentiment** | `comments.post/list` | Persists to DB with user attribution |
| **Notifications** | `notifications.*` | Real DB-backed notification system for order fills, dividends |
| **Display name** | `auth.updateDisplayName` | Updates user record in DB |
| **Player data (Riot API)** | `player.current` | Live fetch from Riot API every request |
| **Match history (stored)** | `matches.stored` | Returns matches stored by poll engine |
| **Stats (champion pool, streaks, 7-day, KDA)** | `stats.*` | Computed from stored match data in DB |
| **ETF prices** | `prices.etfPrices` | Computed from price history via compounding algorithm |
| **News feed** | `news.feed` | LLM-generated articles stored in DB |
| **Market status** | `market.status` | Tracks open/closed based on recent Riot API activity |
| **Price history** | `prices.history` | Real snapshots from poll engine |
| **Portfolio P&L history** | `portfolioHistory.history` | Periodic snapshots of portfolio value |

### 2.2 Static/Simulated Data (Fallbacks)

Every component that shows a "LIVE" badge is genuinely trying to fetch from the backend first. However, if the backend returns empty data (e.g., no matches stored yet, no price history), the frontend **silently falls back to hardcoded static data** from `client/src/lib/playerData.ts`. This means the site always looks populated even when the backend has no data.

| Data | Source File | What's Hardcoded | When It Shows |
|------|-------------|-----------------|---------------|
| **LP History chart (6 months)** | `playerData.ts` | 180 days of **simulated** LP data generated from waypoints + `Math.sin`/`Math.cos`/`Math.random` noise | Always used for the main area chart; backend price history is only used for ETF price computation, not for the chart itself |
| **Candlestick OHLC data** | `CandlestickChart.tsx` | High/Low/Volume are **fabricated** from single daily prices using deterministic pseudo-random math | Always — there is no real intraday data |
| **Player profile** | `playerData.ts` | `PLAYER` object: name, tag, region, level, ladder rank, ladder percent, profile icon | Falls back when `player.current` API fails |
| **Ranked stats** | `playerData.ts` | `RANKED_SOLO`, `RANKED_FLEX`: tier, division, LP, wins, losses, win rate, top tier | Falls back when `player.current` API fails |
| **Season history** | `playerData.ts` | `SEASON_HISTORY`: S2025, S2024 S3, S2024 S2, S2024 S1, S2023 S2 | Always static — no API for historical seasons |
| **Champion stats** | `playerData.ts` | `CHAMPION_STATS`: 5 champions with hardcoded KDA, win rates, CS | Falls back when `stats.championPool` returns empty |
| **Match history** | `playerData.ts` | `MATCH_HISTORY`: 15 hardcoded matches with English time strings | Falls back when `matches.stored` returns empty |
| **Win/Loss sequence** | `playerData.ts` | `WIN_LOSS_SEQUENCE`: 15-game static sequence | Falls back when `stats.streaks` returns empty |
| **7-day performance** | `playerData.ts` | `RECENT_7_DAYS`: 5 champions with static win rates | Falls back when `stats.recentPerformance` returns empty |
| **Emerald rank image** | `PlayerHeader.tsx` | Always shows Emerald rank icon regardless of actual rank | Hardcoded CDN URL |
| **Ticker descriptions** | `playerData.ts` + `routers.ts` | "1x LP Tracker", "2x Leveraged LP", etc. | Always static |
| **Starting balance** | `db.ts` | Every new user starts with exactly $200.00 | Hardcoded in `getOrCreatePortfolio()` |
| **Dividend rates** | `db.ts` | Fixed rates: DORI=$0.50, DDRI=$0.75, TDRI=$1.00, SDRI=$0.75, XDRI=$1.00 per share | Hardcoded in `distributeDividends()` |
| **Short margin** | `db.ts` | Fixed 50% margin requirement | Hardcoded in `executeShort()` |

### 2.3 Key Finding: The Chart Is Not What It Seems

The most significant finding is that **the main LP chart (both Area and Candlestick views) is entirely driven by static/simulated frontend data**, not by the backend price history. The backend `priceHistory` table is used only for ETF price computation and trading. The visual chart that users see is generated from `FULL_LP_HISTORY` which is:

- **Last 13 days**: Real data scraped from OP.GG on March 23, 2026
- **Previous 168 days**: Simulated data generated from waypoints with sinusoidal noise and random jitter

The candlestick chart adds another layer of simulation: since there's only one price per day, the OHLC values (Open, High, Low) and Volume are **fabricated using `Math.sin`-based pseudo-random functions** to create the appearance of intraday volatility.

### 2.4 Transactions Verdict

**Transactions are real and properly wired.** When you buy $DORI:

1. Cash is deducted from your portfolio (`portfolios.cashBalance -= totalAmount`)
2. Shares are added to your holdings (`holdings.shares += shares`)
3. Average cost basis is recalculated
4. A trade record is inserted into the `trades` table
5. The trade appears in your history and the public ledger
6. Your leaderboard ranking updates based on new portfolio value

The same applies to sells, shorts, covers, limit orders, and dividends. The only caveat is that **these are not wrapped in SQL transactions** — if the server crashes mid-trade, you could theoretically end up with inconsistent state (cash deducted but shares not credited). For 20 users this is an acceptable risk.

---

## 3. Do You Need a Database for ~20 Users?

### 3.1 What the Database Currently Stores

| Table | Row Count (Typical) | Growth Rate | Purpose |
|-------|-------------------|-------------|---------|
| `users` | ~20 | Slow | User profiles |
| `portfolios` | ~20 | Slow | Cash balance, total dividends |
| `holdings` | ~100 (20 users × 5 tickers) | Slow | Share positions per ticker |
| `trades` | ~500-2000 | Medium | Trade history |
| `orders` | ~100-500 | Medium | Limit orders, stop-losses |
| `dividends` | ~200-1000 | Medium | Dividend payment records |
| `priceHistory` | ~2000/year | Steady (1 per 20min poll) | LP snapshots for ETF pricing |
| `matches` | ~500-1000 | Steady | Stored match results |
| `news` | ~200-500 | Steady | LLM-generated articles |
| `comments` | ~100-500 | Medium | User sentiment posts |
| `marketStatus` | 1 | Static | Open/closed state |
| `notifications` | ~500-2000 | Medium | Order fills, dividend alerts |
| `portfolioSnapshots` | ~2000/year | Steady | P&L history |

**Total data volume for 20 users after 1 year: approximately 10,000-15,000 rows across all tables.** This is trivially small.

### 3.2 Could You Use In-Memory Data Structures Instead?

**Yes, absolutely.** For 20 users, the entire dataset would fit in roughly **2-5 MB of RAM**. Here's a realistic comparison:

| Aspect | MySQL (Current) | SQLite File | In-Memory + JSON File |
|--------|----------------|-------------|----------------------|
| **Setup complexity** | Need MySQL server or TiDB Cloud | Zero — single file | Zero — just Node.js |
| **Hosting cost** | $0-5/mo for managed DB | $0 (file on disk) | $0 |
| **Query speed** | ~1-5ms | ~0.1-1ms | ~0.01ms (instant) |
| **Data safety** | Durable | Durable | **Risk of data loss on crash** unless you persist to disk |
| **Concurrent writes** | Handled by DB | Handled by SQLite | Must handle yourself (but trivial with 20 users) |
| **Migration effort** | None (current) | Medium (swap Drizzle driver) | High (rewrite all db.ts) |

### 3.3 Recommended Approach for Self-Hosting

For 20 users, the **sweet spot is SQLite** — it gives you all the benefits of a real database (ACID transactions, SQL queries, Drizzle ORM compatibility) with zero infrastructure. Drizzle ORM supports SQLite via `better-sqlite3`, so the migration is:

1. Change `drizzle.config.ts` from `mysql2` to `better-sqlite3`
2. Update `server/db.ts` to use `drizzle(new Database('data.db'))` instead of `drizzle(process.env.DATABASE_URL)`
3. Adjust schema types (MySQL `serial` → SQLite `integer` primary key, `varchar` → `text`, `decimal` → `real`)
4. Run `pnpm db:push` to create the SQLite file

This eliminates the need for any external database service while keeping all your existing query logic intact.

**In-memory with JSON persistence** is also viable but requires rewriting all ~40 database functions in `db.ts`, which is significant effort for marginal benefit.

---

## 4. Manus-Specific Dependencies

These are the 5 things that tie the app to Manus infrastructure:

### 4.1 Authentication (OAuth + Session)

**Files:** `server/_core/sdk.ts`, `server/_core/oauth.ts`, `client/src/const.ts`

The entire auth flow depends on Manus OAuth endpoints:
- `/webdev.v1.WebDevAuthPublicService/ExchangeToken`
- `/webdev.v1.WebDevAuthPublicService/GetUserInfo`
- `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`

**Replacement options:**
- **Simplest for 20 users**: Hardcode a list of allowed users with password hashes. Create a simple `/api/login` endpoint that checks credentials and issues a JWT. The JWT signing/verification code (`jose` library) is already in the codebase.
- **More robust**: Use [Lucia Auth](https://lucia-auth.com/) or [Better Auth](https://www.better-auth.com/) with Google OAuth or Discord OAuth (since your users likely have Discord accounts as gamers).

**Effort:** Medium (1-2 days). The session cookie and JWT infrastructure is already there — you only need to replace the token exchange and user info fetching.

### 4.2 LLM for News Generation

**File:** `server/_core/llm.ts`, `server/pollEngine.ts`

The `invokeLLM()` function calls `forge.manus.im/v1/chat/completions` with an API key. The format is **OpenAI-compatible**.

**Replacement:** Change the base URL and API key:
```typescript
// Current
const url = `${ENV.forgeApiUrl}/v1/chat/completions`;
const key = ENV.forgeApiKey;

// Self-hosted: just swap to OpenAI, Gemini, or any OpenAI-compatible provider
const url = "https://api.openai.com/v1/chat/completions";
const key = process.env.OPENAI_API_KEY;
```

**Effort:** Trivial (5 minutes). Or remove news generation entirely — the poll engine has a fallback that generates random headlines without LLM.

### 4.3 File Storage (S3 via Forge)

**File:** `server/storage.ts`

Uses Manus Forge storage proxy for `storagePut()` and `storageGet()`.

**Current usage:** The app does not appear to actively use file storage for any user-facing feature. It's scaffolding that's available but unused.

**Replacement:** If needed later, swap to direct AWS S3 (`@aws-sdk/client-s3` is already installed) or Cloudflare R2.

**Effort:** Trivial (not currently used).

### 4.4 Owner Notifications

**File:** `server/_core/notification.ts`

Sends push notifications to the Manus project owner via Forge API.

**Replacement:** Replace with Discord webhook, email (Resend/SendGrid), or just remove it. The in-app notification system (order fills, dividends) is separate and fully self-contained in the database.

**Effort:** Trivial.

### 4.5 Vite Dev Plugins

**File:** `vite.config.ts`

Three Manus-specific Vite plugins: `manusAnalyticsPlugin`, `manusMetaPlugin`, `manusDevToolsPlugin`.

**Replacement:** Delete the 3 plugin lines. They're dev/analytics tools that have no effect on the app's functionality.

**Effort:** Trivial (30 seconds).

---

## 5. Self-Hosting Architecture (Simplified)

### 5.1 Current Architecture

```
┌─────────────────────────────────────────┐
│           Single Node.js Process         │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  React   │  │  tRPC    │  │  Poll  │ │
│  │ Frontend │  │   API    │  │ Engine │ │
│  │ (Vite)   │  │          │  │ (20min)│ │
│  └──────────┘  └──────────┘  └────────┘ │
│                     │                    │
│              ┌──────┴──────┐             │
│              │   MySQL DB  │             │
│              │  (TiDB Cloud)│            │
│              └─────────────┘             │
│                     │                    │
│              ┌──────┴──────┐             │
│              │  Riot API   │             │
│              └─────────────┘             │
└─────────────────────────────────────────┘
```

### 5.2 Proposed Self-Hosted Architecture

```
┌─────────────────────────────────────────┐
│           Single Node.js Process         │
│           (Railway / VPS / PM2)          │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  React   │  │  tRPC    │  │  Poll  │ │
│  │ Frontend │  │   API    │  │ Engine │ │
│  │ (static) │  │          │  │ (20min)│ │
│  └──────────┘  └──────────┘  └────────┘ │
│                     │                    │
│              ┌──────┴──────┐             │
│              │   SQLite    │             │
│              │  (data.db)  │             │
│              └─────────────┘             │
│                     │                    │
│              ┌──────┴──────┐             │
│              │  Riot API   │             │
│              └─────────────┘             │
└─────────────────────────────────────────┘
```

**What changed:**
- MySQL → SQLite (single file, zero config)
- Manus OAuth → Simple JWT auth with hardcoded users or Discord OAuth
- Manus Forge LLM → OpenAI API directly (or remove news feature)
- Manus storage/notifications → Removed (unused)
- Manus Vite plugins → Removed

### 5.3 Environment Variables for Self-Hosting

| Variable | Current (Manus) | Self-Hosted |
|----------|----------------|-------------|
| `DATABASE_URL` | TiDB Cloud connection string | `./data.db` (SQLite path) |
| `JWT_SECRET` | Auto-injected | Any random 32+ char string |
| `RIOT_API_KEY` | User-provided | Same Riot API key |
| `OPENAI_API_KEY` | N/A (uses Forge) | Your OpenAI key (optional) |
| `OAUTH_SERVER_URL` | Manus OAuth URL | Remove (replace with local auth) |
| `VITE_APP_ID` | Manus app ID | Remove |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal | Remove (replace with `/login` route) |
| `PORT` | Auto-assigned | `3000` or any port |

### 5.4 Deployment Commands

```bash
# Build
pnpm install
pnpm build

# Run (production)
PORT=3000 JWT_SECRET=your-secret RIOT_API_KEY=your-key node dist/index.js

# Or with PM2 for auto-restart
pm2 start dist/index.js --name lol-tracker
```

---

## 6. Migration Checklist

Here is the ordered checklist for making this fully self-hostable:

| Step | Effort | Priority |
|------|--------|----------|
| 1. Replace Manus OAuth with simple JWT auth | 1-2 days | **Required** |
| 2. Swap MySQL → SQLite (change Drizzle config + schema types) | 4-6 hours | **Required** |
| 3. Delete Manus Vite plugins from `vite.config.ts` | 5 min | **Required** |
| 4. Replace `invokeLLM()` base URL with OpenAI (or remove news) | 30 min | Optional |
| 5. Remove `server/storage.ts` Forge references | 15 min | Optional |
| 6. Remove `server/_core/notification.ts` Forge references | 15 min | Optional |
| 7. Wire the LP chart to backend `priceHistory` instead of static data | 4-8 hours | **Recommended** |
| 8. Remove static fallback data from `playerData.ts` | 2-4 hours | **Recommended** |
| 9. Add proper rank icon selection based on actual tier | 30 min | Nice-to-have |

**Minimum viable self-hosting: Steps 1-3** (about 2-3 days of work). Everything else works as-is.

---

## 7. Summary

The trading system is genuinely functional — money moves, shares change hands, dividends pay out, orders fill. The main areas of "fakeness" are the historical LP chart (simulated), candlestick OHLC data (fabricated), and the static fallback data that shows when the backend hasn't accumulated enough match history yet. For self-hosting with 20 users, SQLite is the ideal database choice, and the migration from Manus infrastructure requires replacing the OAuth system and swapping a few API endpoints — the core app is already a simple, portable Node.js monolith.
