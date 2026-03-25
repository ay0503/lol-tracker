# CLAUDE_CONTEXT.md — Full Project Context for $DORI LP Tracker

> This document gives an AI assistant (or new developer) complete context on the project's architecture, features, business logic, data model, and end-to-end flows. It is the single source of truth for understanding how the codebase works.

---

## 1. Product Concept

**$DORI LP Tracker** is a Robinhood-style fantasy stock trading platform where the "stock" tracks a real League of Legends player's ranked LP (League Points). The tracked player is **목도리 도마뱀 (dori)** on the NA server.

The core idea: LP goes up when the player wins, down when they lose. This LP is mapped to a stock price ($10–$100 range). Users register, get $200 virtual cash, and trade shares of $DORI and its derivative ETFs. There is a leaderboard, AI-generated meme news, a sentiment board, and an automated quant bot that trades alongside humans.

**This is NOT a real financial product.** All money is virtual. The app is a social/gaming experience built around watching one player's ranked climb.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS 4, shadcn/ui, wouter (routing) |
| Backend | Express 4, tRPC 11 (type-safe RPC), Node.js |
| Database | SQLite via libSQL + Drizzle ORM |
| Charts | Recharts (line/area chart), lightweight-charts v5 (candlestick chart) |
| Auth | Email/password with bcrypt + JWT session cookies |
| AI (optional) | OpenAI-compatible API for meme news generation and bot trading decisions |
| i18n | Static dictionaries (English + Korean), React context-based |
| Deployment | Single-process Node.js app; same-origin by default, optional split frontend/backend via `CORS_ORIGIN` |

---

## 3. Project Structure

```
lol-tracker/
├── client/                    # Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/             # Page-level components
│   │   │   ├── Home.tsx       # Main dashboard (chart, player header, trading panel, match history)
│   │   │   ├── Portfolio.tsx  # User's holdings, P&L chart, trade history
│   │   │   ├── Leaderboard.tsx # Ranked list of all traders by portfolio value
│   │   │   ├── Ledger.tsx     # Global trade feed (all users' trades)
│   │   │   ├── NewsFeed.tsx   # AI-generated meme news articles
│   │   │   ├── Sentiment.tsx  # StockTwits-style comment board with bull/bear sentiment
│   │   │   ├── Login.tsx      # Email/password login
│   │   │   ├── Register.tsx   # Email/password registration
│   │   │   ├── AdminDB.tsx    # Admin: DB browser with CRUD operations
│   │   │   ├── AdminSQL.tsx   # Admin: raw SQL query runner
│   │   │   └── NotFound.tsx   # 404 page
│   │   ├── components/        # Reusable UI components
│   │   │   ├── LPChart.tsx           # Area/line chart (Recharts) with compressed timeline
│   │   │   ├── CandlestickChart.tsx  # Candlestick chart (lightweight-charts) with compressed timeline
│   │   │   ├── TradingPanel.tsx      # Buy/sell/short/cover panel with order types
│   │   │   ├── PlayerHeader.tsx      # Player rank, stats, profile icon
│   │   │   ├── MatchRow.tsx          # Individual match result row
│   │   │   ├── StreakBar.tsx         # Win/loss streak visualization
│   │   │   ├── RecentPerformance.tsx # 7-day champion performance
│   │   │   ├── ChampionCard.tsx      # Champion pool stat card
│   │   │   ├── SeasonHistory.tsx     # Past season ranks
│   │   │   ├── PriceRankLegend.tsx   # Price-to-rank mapping legend
│   │   │   ├── NotificationBell.tsx  # Notification dropdown (order fills, stop-losses)
│   │   │   └── ErrorBoundary.tsx     # React error boundary
│   │   ├── contexts/
│   │   │   ├── LanguageContext.tsx    # i18n provider (en/ko)
│   │   │   └── ThemeContext.tsx       # Dark/light theme provider
│   │   ├── i18n/
│   │   │   ├── en.ts                 # English translations (~200 keys)
│   │   │   └── ko.ts                 # Korean translations (~200 keys)
│   │   ├── lib/
│   │   │   ├── trpc.ts              # tRPC React client binding
│   │   │   ├── formatters.ts        # Number/date/time formatting utilities
│   │   │   └── playerData.ts        # Static player data and ETF history computation
│   │   ├── _core/hooks/useAuth.ts   # Auth hook (login state, logout, redirect)
│   │   ├── const.ts                 # Login URL builder, app constants
│   │   ├── App.tsx                  # Route definitions + theme/provider wrappers
│   │   ├── main.tsx                 # React entry: tRPC client, QueryClient, providers
│   │   └── index.css                # Global styles, Tailwind theme, CSS variables
│   └── index.html                   # HTML shell with Google Fonts
├── server/                    # Backend (Express + tRPC)
│   ├── _core/                 # Framework plumbing (don't edit unless extending)
│   │   ├── index.ts           # Server bootstrap: migrations, Express, tRPC mount, polling start
│   │   ├── context.ts         # tRPC context builder (injects authenticated user)
│   │   ├── trpc.ts            # tRPC instance, publicProcedure, protectedProcedure, adminProcedure
│   │   ├── env.ts             # Environment variable normalization
│   │   ├── cookies.ts         # JWT session cookie helpers
│   │   ├── sdk.ts             # Auth SDK (JWT verification, session management)
│   │   ├── oauth.ts           # OAuth flow (unused in self-hosted; kept for Manus compatibility)
│   │   ├── llm.ts             # OpenAI-compatible LLM invocation helper
│   │   ├── notification.ts    # Owner notification helper (Manus-specific, unused self-hosted)
│   │   ├── vite.ts            # Vite dev middleware + static serving
│   │   └── systemRouter.ts    # System tRPC routes (health, etc.)
│   ├── routers.ts             # ALL tRPC procedures (auth, trading, market data, admin)
│   ├── db.ts                  # Database access layer (all queries and mutations)
│   ├── pollEngine.ts          # Background polling engine (2-min cycle)
│   ├── riotApi.ts             # Riot Games API client + LP-to-price conversion
│   ├── etfPricing.ts          # ETF price computation (leveraged/inverse compounding)
│   ├── botTrader.ts           # AI quant bot trader
│   └── cache.ts               # In-memory TTL cache
├── drizzle/                   # Database schema + migrations
│   ├── schema.ts              # All table definitions (13 tables)
│   ├── relations.ts           # Drizzle relation definitions
│   ├── meta/                  # Migration metadata
│   └── migrations/            # SQL migration files
├── shared/                    # Shared types and constants
│   ├── types.ts               # Shared TypeScript types
│   └── const.ts               # Shared constants (error messages)
├── data/                      # SQLite database file (gitignored)
│   └── lol-tracker.db
├── SELF_HOSTING_GUIDE.md      # Comprehensive self-hosting documentation
├── DEPLOYMENT_GUIDE.md        # Split deployment guide (Vercel + Railway)
└── todo.md                    # Feature tracking and audit history
```

---

## 4. Database Schema (13 Tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | `id`, `openId`, `email`, `passwordHash`, `displayName`, `role` (user/admin), `loginMethod` |
| `portfolios` | Cash balance per user | `userId`, `cashBalance` (default "200.00"), `totalDividends` |
| `holdings` | Shares per ticker per user | `userId`, `ticker`, `shares`, `avgCostBasis`, `shortShares`, `shortAvgPrice` |
| `trades` | Every transaction | `userId`, `ticker`, `type` (buy/sell/short/cover/dividend), `shares`, `pricePerShare`, `totalAmount` |
| `orders` | Pending limit orders & stop-losses | `userId`, `ticker`, `orderType` (limit_buy/limit_sell/stop_loss), `targetPrice`, `status` |
| `comments` | Sentiment board posts | `userId`, `ticker`, `content`, `sentiment` (bullish/bearish/neutral) |
| `news` | AI-generated meme articles | `headline`, `body`, `matchId`, `isWin`, `champion`, `kda`, `priceChange` |
| `dividends` | Dividend payout records | `userId`, `ticker`, `shares`, `dividendPerShare`, `totalPayout`, `matchId` |
| `matches` | Processed match results | `matchId`, `win`, `champion`, `kills`/`deaths`/`assists`, `cs`, `gameDuration`, `priceBefore`/`priceAfter` |
| `marketStatus` | Trading halt state | `isOpen`, `reason`, `lastActivity` |
| `priceHistory` | LP snapshots over time | `timestamp`, `tier`, `division`, `lp`, `totalLP`, `price` |
| `portfolioSnapshots` | Portfolio value over time | `userId`, `totalValue`, `cashBalance`, `holdingsValue`, `shortPnl`, `timestamp` |
| `notifications` | User notifications | `userId`, `type` (order_filled/stop_loss_triggered/dividend_received/system), `title`, `message`, `read` |

**Important**: All monetary/share values are stored as **text strings** in SQLite (e.g., `"200.00"`, `"0.0000"`) and parsed/serialized in `db.ts` using `parseFloat()` / `.toFixed()`.

---

## 5. LP-to-Price Conversion Model

The stock price is derived from the player's ranked position using a linear mapping:

```
Total LP = (tierIndex - PLATINUM_INDEX) * 4 * 100 + divisionIndex * 100 + lp

Price = $10 + (totalLP / 1200) * $90
```

| Rank | Total LP | Price |
|------|----------|-------|
| Platinum IV 0 LP | 0 | $10.00 |
| Platinum I 100 LP | 400 | $40.00 |
| Emerald IV 0 LP | 400 | $40.00 |
| Emerald I 100 LP | 800 | $70.00 |
| Diamond IV 0 LP | 800 | $70.00 |
| Diamond I 100 LP | 1200 | $100.00 |

The conversion functions live in `server/riotApi.ts`: `tierToTotalLP()`, `totalLPToPrice()`, `tierToPrice()`, `priceToTierLabel()`.

---

## 6. ETF Ticker System

There are 5 tradeable tickers, all derived from the base $DORI price:

| Ticker | Type | Leverage | Description |
|--------|------|----------|-------------|
| `$DORI` | Base | 1x | Tracks LP directly |
| `$DDRI` | Leveraged Bull | 2x | Amplifies daily returns 2x |
| `$TDRI` | Leveraged Bull | 3x | Amplifies daily returns 3x |
| `$SDRI` | Inverse | -2x | Profits when LP drops (2x) |
| `$XDRI` | Inverse | -3x | Profits when LP drops (3x) |

**Pricing model** (in `server/etfPricing.ts`):
- `$DORI` = latest base price from LP conversion
- Leveraged/inverse ETFs: start at the same price as DORI on day 1, then **compound daily returns** with the leverage multiplier. For inverse tickers, the multiplier is negative.
- ETF prices are floored at `$0.01` to prevent negative values.
- The same compounding logic runs on both server (`etfPricing.ts`) and client (`playerData.ts`) to ensure consistency.

**Dividend system** (currently disabled in code but infrastructure exists):
- On a WIN: `$DORI` holders get $0.50/share, `$DDRI` $0.75/share, `$TDRI` $1.00/share
- Inverse tickers (`$SDRI`, `$XDRI`) never receive dividends
- Losses pay no dividends

---

## 7. Trading Engine

### Trade Types
- **Buy**: Spend cash to acquire shares. Updates `holdings.shares` and `holdings.avgCostBasis`.
- **Sell**: Sell owned shares for cash. Cannot sell more than owned.
- **Short**: Borrow and sell shares you don't own, betting the price will drop. Requires 50% margin collateral. Cash flow: `newCash = currentCash - marginRequired + totalAmount`.
- **Cover**: Buy back shorted shares to close the position. Returns locked margin. Cash flow: `newCash = currentCash - totalCost + marginReturn`.

### Order Types
- **Limit Buy**: Executes when price drops to or below target
- **Limit Sell**: Executes when price rises to or above target
- **Stop-Loss**: Executes when price drops to or below target (sells existing shares)

### Concurrency Control
A per-user mutex lock (`withUserLock` in `db.ts`) prevents duplicate concurrent trades from double-clicks or race conditions. Each user can only have one trade executing at a time.

### Trading Halt
When the tracked player is **in a live game**, trading is halted. The system uses **two-consecutive-confirmation** to prevent false toggles from API flickers — the confirmed in-game status only changes when two consecutive poll checks agree.

---

## 8. Polling Engine (`pollEngine.ts`)

Runs every **2 minutes**. Each cycle:

1. **Check live game status** via Riot Spectator API (two-consecutive-confirmation logic)
2. **Capture pre-game snapshot** when game starts (for post-game LP delta banner)
3. **Fetch current LP** from Riot API → compute price → store `priceHistory` snapshot
4. **Emit game-end event** when game ends (LP delta, price change, stored in cache for 10 min)
5. **Fetch new matches** from Riot Match API → store in `matches` table
6. **Generate AI meme news** for each new match (LLM with fallback headlines)
7. **Execute pending orders** (limit buys, limit sells, stop-losses) against current ETF prices
8. **Record portfolio snapshots** for all users (for P&L charting)
9. **Run AI bot trader** (only during live games)
10. **Update market status** based on recent activity
11. **Invalidate server-side cache** (preserves game-end event and live game status)

### LP Delta Calculation
When a game ends, `lpDelta` is calculated using `totalLP` (absolute LP across all tiers), NOT raw LP numbers. This correctly handles tier/division boundary changes (e.g., Emerald 2 10LP → Emerald 3 96LP = -14 LP, not +86).

---

## 9. AI Bot Trader (`botTrader.ts`)

**QuantBot 🤖** is an automated trading bot that:
- Is a regular `users` row (`role: "user"`, `loginMethod: "bot"`, `openId: "bot_quanttrader_001"`)
- Starts with $200 cash (same as human users)
- Appears on the leaderboard alongside humans
- Runs every poll cycle, but **only trades when a live game is detected**
- Uses LLM (OpenAI-compatible) with a detailed quant-style prompt including:
  - Current ETF prices and descriptions
  - Player rank, recent results, win rate, KDA
  - Price trends (short-term and medium-term)
  - Bot's current portfolio, holdings, and P&L
  - Trading rules (max 40% of cash per trade, 50% margin for shorts)
- Returns a structured JSON decision: `{ action, ticker, amount, reasoning, sentiment, confidence }`
- Falls back to a deterministic strategy when LLM is unavailable:
  - If player on win streak → buy DORI
  - If player on loss streak → buy SDRI (inverse)
  - Otherwise → hold
- Posts analytical sentiment comments explaining its reasoning (but is prevented from spamming the sentiment board)
- Executes trades using the same `executeTrade`/`executeShort`/`executeCover` functions as regular users

---

## 10. Server Bootstrap (`server/_core/index.ts`)

Startup sequence:
1. Load environment variables (`dotenv`)
2. Log startup diagnostics (DB path, CORS mode, API key status, JWT secret)
3. Run Drizzle migrations programmatically
4. Set up Express middleware: request logging, CORS (if split mode), JSON parsing
5. Mount `/api/health` endpoint
6. Mount tRPC at `/api/trpc`
7. In same-origin mode: mount Vite dev middleware (dev) or static file serving (prod)
8. Find available port (starting from 3000)
9. Initialize QuantBot user
10. Start polling engine

**Deployment modes:**
- **Same-origin** (default): Single process serves both API and frontend
- **Split** (when `CORS_ORIGIN` is set): Backend only, frontend served separately (e.g., Vercel + Railway)

---

## 11. Authentication Flow

### Registration
1. User submits email + password + display name to `auth.register`
2. Password is hashed with bcrypt (10 rounds)
3. User row created with `loginMethod: "email"`, `openId: "local_{uuid}"`
4. Portfolio created with $200 starting cash
5. JWT session cookie set

### Login
1. User submits email + password to `auth.login`
2. Password verified against stored bcrypt hash
3. JWT session cookie set (`app_session_id`, httpOnly, sameSite: lax, 30-day expiry)

### Session Verification
- Every tRPC request passes through `createContext()` which calls `sdk.authenticateRequest(req)`
- The SDK extracts the JWT from the `app_session_id` cookie and verifies it
- If valid, `ctx.user` is populated; if not, `ctx.user` is null
- `protectedProcedure` requires `ctx.user` to be non-null (throws `UNAUTHORIZED`)
- `adminProcedure` requires `ctx.user.role === "admin"` (throws `FORBIDDEN`)

### Frontend Auth
- `useAuth()` hook calls `trpc.auth.me.useQuery()` to get current user
- Global query/mutation cache listeners detect `UNAUTHED_ERR_MSG` errors and redirect to `/login`
- Login URL is built from `window.location.origin` (never hardcoded)

---

## 12. tRPC API Endpoints

### Auth Router (`auth.*`)
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `auth.me` | query | public | Get current user (null if not logged in) |
| `auth.login` | mutation | public | Email/password login |
| `auth.register` | mutation | public | Email/password registration |
| `auth.logout` | mutation | protected | Clear session cookie |
| `auth.updateDisplayName` | mutation | protected | Change display name |

### Market Router (`market.*`)
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `market.currentPrice` | query | public | Current price, tier, LP, ETF prices, live game status, game-end event |
| `market.priceHistory` | query | public | Historical price snapshots with ETF history computation |
| `market.matches` | query | public | Recent match results |
| `market.status` | query | public | Market open/closed status |
| `market.liveGame` | query | public | Live game detection status |
| `market.gameEndEvent` | query | public | Post-game LP/price change event |
| `market.pollStatus` | query | public | Polling engine status |
| `market.recentPerformance` | query | public | 7-day champion performance stats |

### Trading Router (`trading.*`)
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `trading.buy` | mutation | protected | Buy shares (with live-game halt check) |
| `trading.sell` | mutation | protected | Sell shares |
| `trading.short` | mutation | protected | Short sell shares |
| `trading.cover` | mutation | protected | Cover short position |
| `trading.createOrder` | mutation | protected | Create limit order or stop-loss |
| `trading.cancelOrder` | mutation | protected | Cancel pending order |
| `trading.portfolio` | query | protected | Get user's portfolio + holdings + ETF prices |
| `trading.orders` | query | protected | Get user's orders |
| `trading.trades` | query | protected | Get user's trade history |
| `trading.allTrades` | query | public | Global trade feed (excludes admin trades) |

### Social Router (`social.*`)
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `social.postComment` | mutation | protected | Post sentiment comment |
| `social.comments` | query | public | Get recent comments |
| `social.news` | query | public | Get AI-generated news |

### Leaderboard Router (`leaderboard.*`)
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `leaderboard.rankings` | query | public | All users ranked by total portfolio value |

### Notifications Router (`notifications.*`)
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `notifications.list` | query | protected | Get user's notifications |
| `notifications.unreadCount` | query | protected | Count of unread notifications |
| `notifications.markRead` | mutation | protected | Mark single notification as read |
| `notifications.markAllRead` | mutation | protected | Mark all notifications as read |

### Portfolio History Router (`portfolioHistory.*`)
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `portfolioHistory.history` | query | protected | Portfolio value snapshots over time |

### Admin Router (`admin.*`)
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `admin.users` | query | admin | List all users |
| `admin.pollNow` | mutation | admin | Force immediate poll cycle |
| `admin.seedHistory` | mutation | admin | Seed historical price data |
| `admin.dbStatus` | query | admin | Database table stats |
| `admin.runBot` | mutation | admin | Force-run AI bot trader |
| `admin.tableSchema` | query | admin | Get table column info |
| `admin.tableRows` | query | admin | Browse table rows with pagination |
| `admin.updateRow` | mutation | admin | Update a row by ID |
| `admin.deleteRow` | mutation | admin | Delete a row by ID |
| `admin.insertRow` | mutation | admin | Insert a new row |
| `admin.resetUserCash` | mutation | admin | Reset a user's cash balance |

---

## 13. Frontend Architecture

### Provider Stack (outermost → innermost)
```
trpc.Provider → QueryClientProvider → LanguageProvider → ThemeProvider → TooltipProvider → Router
```

### Query Client Configuration
- `staleTime`: 10 minutes (data considered fresh for 10 min)
- `gcTime`: 30 minutes (cached data kept for 30 min)
- `refetchOnWindowFocus`: false
- Global error listeners redirect to `/login` on `UNAUTHED_ERR_MSG`

### Routing (wouter)
```
/              → Home (main dashboard)
/login         → Login
/register      → Register
/ledger        → Global trade feed
/portfolio     → User portfolio
/leaderboard   → Rankings
/news          → AI news feed
/sentiment     → Comment board
/admin         → Admin DB browser
/admin/sql     → Admin SQL runner
/404           → Not found
```

### Theme System
- Dark theme by default, switchable via toggle button
- CSS variables in `index.css` define semantic colors for both themes
- `ThemeProvider` toggles `dark` class on `document.documentElement`
- Stored in localStorage as `dori-theme`

### i18n System
- Two static dictionaries: `en.ts` (~200 keys) and `ko.ts` (~200 keys)
- `LanguageProvider` wraps the app, provides `{ language, setLanguage, t }` via React context
- `useTranslation()` hook returns the `t` object for accessing translations
- Language stored in localStorage as `dori-language`
- Admin pages are English-only by design

---

## 14. Chart System

### Area/Line Chart (`LPChart.tsx`)
- Built with **Recharts** (ResponsiveContainer, AreaChart, XAxis, YAxis, Tooltip, Area)
- **Compressed timeline**: For non-intraday views (1W, 1M, 3M, etc.), uses index-based X-axis spacing instead of timestamp-based, eliminating flat stretches during idle hours/days
- **Smart tick generation**: Only shows labels at meaningful change points (hour boundaries for intraday, day boundaries for weekly, evenly spaced for monthly, month boundaries for quarterly+)
- Time ranges: 3H, 6H, 1D (intraday, real timestamps), 1W, 1M, 3M, 6M, YTD, ALL (compressed)
- Supports all 5 ETF tickers with color-coded areas
- Gradient fill with opacity based on price direction

### Candlestick Chart (`CandlestickChart.tsx`)
- Built with **lightweight-charts v5** (createChart, CandlestickSeries)
- **Compressed timeline**: For non-intraday views, filters out flat/no-change candles and uses sequential timestamps
- Custom tick formatter maps sequential timestamps back to real dates
- Supports click-to-annotate (text markers on candles)
- Time range pills synchronized with the parent LPChart component
- Two-consecutive-confirmation suppression prevents time range feedback loops

### Chart Data Flow
1. `trpc.market.priceHistory.useQuery({ range })` fetches raw snapshots from server
2. Server computes ETF history via `computeETFHistoryFromSnapshots()` for the selected ticker
3. Client receives `{ timestamp, price, tier, division, lp, totalLP }[]`
4. LPChart processes into `ChartDataPoint[]` with formatting
5. CandlestickChart processes into OHLC candles (grouped by time bucket)

---

## 15. Caching Strategy

### Server-Side (`cache.ts`)
- In-memory TTL cache with 30-minute default TTL
- Used for: price data, leaderboard, market status, live game status
- **Invalidated entirely after each poll cycle** (except game-end event and live game status which are preserved)
- Key patterns: `player.liveGame.check`, `player.gameEndEvent`, `market.*`, `leaderboard.*`

### Client-Side (React Query)
- `staleTime: 10 minutes` — data considered fresh, no refetch
- `gcTime: 30 minutes` — cached data kept in memory
- `refetchOnWindowFocus: false` — no automatic refetch on tab focus
- Mutations use `trpc.useUtils().*.invalidate()` for cache busting after writes

---

## 16. Notification System

Notifications are created server-side and stored in the `notifications` table. Types:
- `order_filled`: When a limit buy/sell order executes
- `stop_loss_triggered`: When a stop-loss order triggers
- `dividend_received`: When dividends are paid (currently disabled)
- `system`: General system notifications

Frontend: `NotificationBell.tsx` polls `notifications.unreadCount` every 30 seconds, lazily loads full list when opened, and toasts when new notifications arrive.

---

## 17. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RIOT_API_KEY` | Yes | Riot Games API key for LP/match data |
| `JWT_SECRET` | Yes (prod) | Session cookie signing secret (defaults to insecure value) |
| `DATABASE_PATH` | No | SQLite file path (default: `./data/lol-tracker.db`) |
| `OPENAI_API_URL` | No | OpenAI-compatible API base URL (enables AI news + bot) |
| `OPENAI_API_KEY` | No | API key for the OpenAI-compatible service |
| `CORS_ORIGIN` | No | Frontend URL for split deployment (omit for same-origin) |
| `PORT` | No | Server port (default: 3000) |

---

## 18. Key Design Decisions

1. **SQLite over MySQL/Postgres**: Single-file database, zero-config, perfect for a single-process app. WAL mode enabled for concurrent reads.

2. **Text-based numeric storage**: All monetary values stored as text strings (`"200.00"`) to avoid floating-point precision issues in SQLite. Parsed/serialized in `db.ts`.

3. **Per-user trade mutex**: Prevents double-click race conditions without database-level locking.

4. **Two-consecutive-confirmation for live game**: Prevents false trading halts from Riot API flickers. Status only changes after two consecutive polls agree.

5. **Compressed chart timelines**: Since the player only plays a few games per day, raw timestamps create long flat stretches. Index-based spacing eliminates dead time.

6. **ETF compounding from full history**: Leveraged/inverse ETF prices are computed by compounding daily returns from the entire price history, matching real-world leveraged ETF behavior (path-dependent).

7. **Bot as regular user**: QuantBot is a normal database user with the same constraints as humans, ensuring fair leaderboard competition.

8. **Static i18n dictionaries**: No async loading, no ICU/plural rules — just a simple object lookup. Fast and sufficient for two languages.

9. **Same-origin default**: Frontend and backend served from the same process, eliminating CORS complexity for most deployments.

---

## 19. End-to-End Flows

### Flow: User Places a Buy Order
1. User enters shares + price in `TradingPanel.tsx`
2. Frontend calls `trpc.trading.buy.useMutation()`
3. Server checks: user authenticated? trading halted (live game)? cooldown elapsed?
4. `executeTrade()` acquires per-user lock
5. Validates sufficient cash
6. Deducts cash from `portfolios`, updates `holdings` (shares + avg cost basis)
7. Records trade in `trades` table
8. Returns updated portfolio + holding
9. Frontend invalidates `trading.portfolio` cache, shows success toast

### Flow: Poll Cycle Detects Game End
1. `pollNow()` runs on 2-min interval
2. Spectator API returns "not in game" for second consecutive check
3. `confirmedIsInGame` flips to `false`
4. System fetches current LP, computes price
5. `lpDelta = totalLP - preGameSnapshot.totalLP` (accounts for tier changes)
6. `GameEndEvent` stored in cache with 10-min TTL
7. Frontend polls `trpc.market.gameEndEvent.useQuery()` (refetches every 30s)
8. `PostGameBanner` renders with LP change, price change, tier transition

### Flow: AI News Generation
1. Poll engine detects new match (matchId not in `processedMatchIds`)
2. Calls `generateMemeNews()` with champion, KDA, price change
3. LLM generates funny Bloomberg-style headline + body
4. If LLM fails, falls back to template-based headlines
5. Stored in `news` table, `newsGenerated` flag set on match
6. Frontend fetches via `trpc.social.news.useQuery()`

### Flow: Bot Trading Decision
1. Poll engine calls `runBotTrader()` (only during live games)
2. Bot gathers market context: ETF prices, price history, recent matches, portfolio
3. Builds detailed quant-style prompt with all market data
4. LLM returns structured JSON: `{ action, ticker, amount, reasoning, sentiment, confidence }`
5. If confidence < 30 or amount < $1, bot holds
6. Otherwise executes trade via same `executeTrade`/`executeShort`/`executeCover` as humans
7. Posts analytical comment to sentiment board (prevented from spamming)

### Flow: Limit Order Execution
1. User creates limit order via `trpc.trading.createOrder`
2. Order stored in `orders` table with `status: "pending"`
3. Each poll cycle, `pollEngine` checks all pending orders against current ETF prices
4. If condition met (e.g., limit_buy and price ≤ target), executes trade
5. Order marked as `filled`, notification created for user
6. Frontend notification bell shows "Limit Buy Filled: $DORI"

---

## 20. Testing

- Framework: **Vitest** with `vitest.config.ts`
- Test files: `server/*.test.ts`
- Run: `pnpm test`
- Current: 81 tests passing across 6 test files
- Tests cover: auth flow, trading logic, order execution, bot trader, ETF pricing, cache behavior

---

## 21. Admin System

Admin users (`role: "admin"` in users table) have access to:
- `/admin` — Full database browser with table list, row pagination, CRUD operations
- `/admin/sql` — Raw SQL query runner
- Admin tRPC procedures: force poll, seed history, run bot, reset user cash, manage rows

To promote a user to admin:
```sql
UPDATE users SET role = 'admin' WHERE email = 'user@example.com';
```

---

## 22. Known Limitations & Future Work

- **Dividends are disabled**: The infrastructure exists but the dividend distribution is commented out in `pollEngine.ts`
- **No real-time WebSocket**: All data is polled (2-min server, 30s-10min client depending on endpoint)
- **Single tracked player**: The app is hardcoded to track "목도리 도마뱀#dori" on NA. Changing requires editing `pollEngine.ts` constants.
- **No password reset flow**: Users who forget their password need admin intervention
- **Admin pages are English-only**: By design, since admin is developer-facing
- **Bot badge**: QuantBot appears on leaderboard/ledger without a visual bot indicator (planned)
- **Admin nav link**: No conditional admin link in navbar for admin users (planned)
