# DORI LP Tracker - Enhancement TODO

## Phase 1: Upgrade to Full-Stack
- [x] Run webdev_add_feature to add web-db-user (backend, DB, auth)
- [x] Review upgrade README and apply changes

## Phase 2: Rebrand to DORI
- [x] Change page title to "DORI | LP Tracker"
- [x] Update navbar branding to show "$DORI" ticker style
- [x] Rename references from "LP Tracker" to "DORI"

## Phase 3: Trading System
- [x] Create DB schema for users with cash balance ($200 default)
- [x] Create DB schema for trades/positions
- [x] Build API endpoints for: get balance, place trade, get positions
- [x] Build trading UI panel (buy/sell DORI with LP-based pricing)
- [x] Show portfolio value and P&L

## Phase 4: TradingView Candlestick Chart
- [x] Install lightweight-charts (TradingView open-source library)
- [x] Build candlestick chart component with LP data as OHLC
- [x] Add toggle between area chart and candlestick chart
- [x] Add annotation/drawing tools overlay
- [x] Support trend lines, horizontal lines, text annotations

## Phase 5: Test & Deliver
- [x] Full integration test
- [x] Save checkpoint and deliver

## Phase 6: LP-to-Stock Price Mapping
- [x] Define price mapping: Plat4 0LP = $10, Diamond1 100LP = $100 (linear scale across tiers)
- [x] Generate extended historical data for 1W, 1M, 3M, 6M, YTD from season history
- [x] Update playerData.ts with extended LP history and price conversion functions

## Phase 7: Leveraged & Inverse ETFs
- [x] Define 5 tickers: DORI (1x), DDRI (2x), TDRI (3x), SDRI (-2x inverse), XDRI (-3x inverse)
- [x] Update DB schema: trades table to include ticker field
- [x] Update trading API to support multiple tickers with leverage calculations
- [x] Generate price history for all 5 ETFs based on DORI base price

## Phase 8: Extended Chart Time Ranges
- [x] Add 1W, 1M, 3M, 6M, YTD time range selectors
- [x] Update area chart and candlestick chart to use new extended data
- [x] Show correct price (not raw LP) on chart axes

## Phase 9: Public Ledger Page
- [x] Create /ledger route
- [x] Build API endpoint to fetch all trades across all users
- [x] Display trades in a real-time feed style table with user, ticker, type, amount, price

## Phase 10: My Portfolio Page
- [x] Create /portfolio route
- [x] Show holdings breakdown by ticker with current value
- [x] Show total returns, P&L percentage, and P&L chart over time
- [x] Show full transaction history with filters

## Phase 11: Navigation & Polish
- [x] Add top navigation with links: Trade, Ledger, Portfolio
- [x] Write/update vitest tests for new features
- [x] Final integration testing

## Phase 12: Riot API Integration
- [x] Store Riot API key as secret
- [x] Create Riot API service module on server
- [x] Fetch summoner data (PUUID, summoner ID)
- [x] Fetch ranked data (tier, division, LP, wins, losses)
- [x] Fetch match history with match details
- [x] Store LP snapshots in DB for historical price tracking
- [x] Create DB table for LP price history
- [x] Build scheduled/on-demand data refresh endpoint

## Bug Fix: Candlestick Chart Data Cutoff
- [x] Reproduce data cutoff when switching time ranges in candlestick view
- [x] Fix chart not properly re-rendering with new data on time range change
- [x] Fix panning (translate left/right) showing empty space / cutoff data
- [x] Ensure fitContent is called after data updates
- [x] Test all time range transitions in candlestick mode

## Bug Fix: Chart Zoom Data Cutoff
- [x] Pass full dataset to chart, use time scale visible range to control view
- [x] Zooming out past 1M should reveal more data (not empty space)
- [x] Add visible range change listener to sync UI time range pills with zoom level
- [x] Zooming in from 3M to 1M-equivalent should update the active pill to 1M

## Feature: Favicon
- [x] Create a $DORI branded favicon
- [x] Add favicon to index.html

## Feature: Custom Display Name
- [x] Add displayName column to users table in DB schema
- [x] Add API endpoint to update display name
- [x] Add UI for users to set/edit their display name
- [x] Show display name in nav, ledger, and portfolio

## Bug Fix: Prevent Negative Trade Amounts
- [x] Add frontend validation to prevent negative or zero amounts
- [x] Backend validation z.number().positive() already in place - confirmed working

## Feature: Live LP Polling (20 min)
- [x] Create server-side polling job that runs every 20 minutes
- [x] Fetch current LP from Riot API and store price snapshot in DB
- [x] Auto-execute pending limit orders and stop-losses on price change
- [x] Auto-distribute dividends on wins
- [x] Generate AI meme news headlines on match results

## Feature: Limit Orders & Stop-Losses
- [x] Add orders table to DB schema (type: limit_buy, limit_sell, stop_loss; status: pending, filled, cancelled)
- [x] Build API endpoints: create order, cancel order, list orders
- [x] Order execution engine: check pending orders against current price on each poll
- [x] Frontend UI: order form with price target, pending orders list, order history

## Feature: Market Hours / Trading Sessions
- [x] Define market hours logic (e.g., trading open when player recently played or during set hours)
- [x] Add market status indicator to UI (Market Open / Market Closed)
- [x] Block trades during market closed hours (with override for limit orders)

## Feature: Short Selling
- [x] Add short positions tracking to holdings (negative shares or separate short table)
- [x] Implement borrow-and-sell flow: user borrows shares, sells at current price
- [x] Implement cover flow: user buys back shares to close short position
- [x] Calculate short P&L (profit when price drops)
- [x] Frontend UI: short sell button, short positions display

## Feature: Trade Comments / Sentiment Feed
- [x] Add comments table to DB schema (userId, text, ticker, sentiment, createdAt)
- [x] Build API endpoints: post comment, list comments
- [x] Frontend: StockTwits-style feed with bullish/bearish sentiment tags
- [x] Show on home page or dedicated feed tab

## Feature: AI Meme News Feed
- [x] Store match results in DB when polling
- [x] Use LLM to generate funny/memey news headlines from match data
- [x] Add news table to DB schema (headline, body, matchId, createdAt)
- [x] Frontend: scrolling news ticker and news feed section
- [x] Headlines should be absurdly funny (e.g. "BREAKING: $DORI CEO spotted inting bot lane")

## Feature: Dividend System
- [x] Add dividends table to DB (userId, amount, reason, createdAt)
- [x] On player win: distribute dividend to all DORI/DDRI/TDRI holders proportional to shares
- [x] On player loss: inverse ETF holders (SDRI/XDRI) get dividends
- [x] High dividend rates to punish inverse holders when player wins
- [x] Frontend: dividend history in portfolio, dividend announcements
- [x] Show dividend yield on ticker cards

## Feature: Trader Leaderboard
- [x] Build API endpoint to calculate all users' portfolio values
- [x] Rank by total portfolio value, daily P&L, best trade
- [x] Frontend: leaderboard page with filters (daily/weekly/all-time)
- [x] Show rank badges or trophies for top traders

## UI: Emphasize Stock Price Over LP/Rank
- [x] Make stock price ($62.28) the dominant hero element — large, bold, Robinhood-style
- [x] Move LP and rank to secondary/subtitle position below price
- [x] Show price change amount and percentage prominently next to price
- [x] Keep player name and rank badge but de-emphasize them

## Feature: Live Match History Updates
- [x] Wire match history display to use data from DB (populated by polling engine)
- [x] Store match results in DB during each poll cycle
- [x] Replace static MATCH_HISTORY with API-fetched data
- [x] Update match history section to show loading state and auto-refresh

## Bug Fix: Match History Not Updated
- [ ] Check if Riot API key is working
- [ ] Fetch latest matches (including Mel game)
- [ ] Update match history to show most recent games

## Feature: Real-Time Stats from API Polling
- [x] Backend: Add endpoint for live player stats (rank, LP, wins, losses, win rate)
- [x] Backend: Add endpoint for champion stats computed from stored matches
- [x] Backend: Add endpoint for win/loss streaks computed from stored matches
- [x] Backend: Add endpoint for 7-day performance computed from stored matches
- [x] Backend: Add endpoint for current stock price from latest price snapshot
- [x] Frontend: Wire PlayerHeader to use live rank/LP/price data
- [x] Frontend: Wire stat cards (Solo/Duo, Flex, Total Games, Avg KDA) to live data
- [x] Frontend: Wire StreakBar to use live match data
- [x] Frontend: Wire RecentPerformance (7-day) to use live match data
- [x] Frontend: Wire ChampionCard pool to use live match data
- [x] Frontend: Wire MatchRow history to use live match data (already done)
- [x] Frontend: Add auto-refresh (refetchInterval) to all live queries
- [x] Write vitest tests for stats endpoints (championPool, streaks, recentPerformance, avgKda)

## Bug Fix: Mel Champion Image Broken
- [x] Investigate why Mel's champion image URL is invalid on Data Dragon CDN
- [x] Fix champion image URL mapping for newer champions like Mel

## Audit: Transaction Features End-to-End
- [x] Audit backend: trading (buy/sell), limit orders, stop-losses, short selling endpoints
- [x] Audit backend: portfolio, holdings, dividends, P&L calculations
- [x] Audit frontend: trading panel UI and tRPC wiring — fixed static prices to use trpc.prices.etfPrices
- [x] Audit frontend: limit order/stop-loss UI and tRPC wiring
- [x] Audit frontend: short selling UI and tRPC wiring
- [x] Audit frontend: portfolio page and tRPC wiring — fixed static prices, added short positions display, added all trade type filters
- [x] Test all transaction flows in browser (market buy, limit buy, short sell all passed)
- [x] Fix issues: TradingPanel & Portfolio now use live backend prices instead of static LP_HISTORY

## Feature: Portfolio P&L Chart
- [x] Add DB table (portfolioSnapshots) to track portfolio value snapshots over time
- [x] Create tRPC endpoint (portfolioHistory.history) to return portfolio value history
- [x] Build line chart component on Portfolio page showing value over time
- [x] Auto-record portfolio snapshots during each poll cycle

## Feature: Order Fill Notifications
- [x] Add notifications table to DB schema (userId, message, type, read, createdAt)
- [x] Create notification when limit order or stop-loss is filled in polling engine
- [x] Add tRPC endpoints: list notifications, mark as read, unread count
- [x] Build notification bell icon in nav with unread badge
- [x] Build notification dropdown/panel with notification list
- [x] Show toast notification for recently filled orders

## Feature: Trade Confirmation Dialog
- [x] Add confirmation dialog component for trades over $50
- [x] Show trade summary (ticker, type, amount, shares, price) before execution
- [x] Add confirm/cancel buttons with clear labeling
- [x] Apply to all trade types: market buy/sell, short sell, cover
- [x] Write vitest tests for portfolio history, notifications, and confirmation threshold (12 tests)

## Feature: Dark/Light Theme Toggle
- [x] Audit current ThemeProvider and CSS variable setup
- [x] Define light theme CSS variables in index.css (:root for light, .dark for dark)
- [x] Enable switchable theme in ThemeProvider
- [x] Add theme toggle button (Sun/Moon icon) to nav bar
- [x] Replace 145 hardcoded text-white with text-foreground across 19 files
- [x] Restore intentional text-white on colored backgrounds (red sell, purple short, notification badge)
- [x] Replace text-black with text-primary-foreground on green/primary buttons
- [x] Test both themes in browser - all pages verified (Home, Portfolio, Leaderboard)

## Feature: Stock Price to Rank Legend
- [x] Review the LP-to-price mapping logic to extract tier/price breakpoints
- [x] Design and build PriceRankLegend component with tier bar, current price marker, and division breakdown
- [x] Integrate legend into the main page between LP chart and stats grid
- [x] Ensure legend works in both dark and light themes — verified
- [x] Test in browser and save checkpoint

## Feature: Charts for All ETF Tickers
- [x] Audit existing chart components and ETF price data
- [x] Add ticker selector to switch between DORI, DDRI, TDRI, SDRI, XDRI charts
- [x] Generate/fetch price history for all ETF tickers (getFullETFHistory in playerData.ts)
- [x] Update LPChart to support multi-ticker display with color-coded pills
- [x] Update CandlestickChart to support multi-ticker display with ticker-specific colors
- [x] Ensure price change summary updates per selected ticker
- [x] Test all ticker charts in browser (DORI, SDRI, TDRI verified in both Line and Candles view)

## Bug Fix: ETF Ticker Prices Not Aligned
- [x] Investigate how backend calculates ETF prices (prices.etfPrices endpoint)
- [x] Investigate how frontend chart calculates ETF prices (playerData.ts getFullETFHistory)
- [x] Compare the two calculation methods and identify discrepancy (3 different methods found)
- [x] Fix: Created unified etfPricing.ts module with compounding daily returns, replaced all 3 callers

## Feature: Korean/English i18n with Language Toggle
- [x] Create i18n context and hook (useTranslation)
- [x] Create English translation file (en.ts)
- [x] Create Korean translation file (ko.ts)
- [x] Add EN/KR language toggle button to nav bar
- [x] Translate all static text in Home page components
- [x] Translate Portfolio page
- [x] Translate Leaderboard page
- [x] Translate Ledger page
- [x] Translate News page
- [x] Translate Sentiment page
- [x] Translate TradingPanel component
- [x] Translate NotificationBell component
- [x] Translate PriceRankLegend component
- [x] Translate PlayerHeader, StreakBar, RecentPerformance, ChampionCard, MatchRow, SeasonHistory, LPChart
- [x] Persist language preference in localStorage
- [x] Test both languages in browser — all sections verified in Korean

## Fix: Missing Korean Translations
- [x] Translate WIN/LOSS → 승리/패배
- [x] Translate rank names: Emerald→에메랄드, Platinum→플래티넘, Diamond→다이아몬드
- [x] Translate time formats: 12h ago→12시간 전, 25m 36s→25분 36초
- [x] Translate date formats: Mar 6→3월 6일
- [x] Translate "Auto-updated from Riot API" and other remaining English strings
- [x] Keep champion names as-is (proper nouns)

## Feature: Collapsible Price → Rank Legend
- [x] Add expand/collapse toggle to the PriceRankLegend component
- [x] Default to collapsed state
- [x] Smooth animation on expand/collapse

## Fix: Light Theme White Background with Translucent Components
- [x] Change light theme background to white
- [x] Add glassmorphism/translucent effect to cards and components in light mode
- [x] Ensure text remains readable against white background

## Bug Fix: Price Stuck on Loading
- [x] Investigate why the stock price shows "loading" instead of actual value
- [x] Fix the price display issue (etfPrices was array, TradingPanel treated it as object - fixed getLivePrice to use .find())

## Feature: Translate Chart Date Labels to Korean
- [x] Translate X-axis date labels on Line chart (Feb 22 → 2월 22일)
- [x] Translate X-axis date labels on Candlestick chart
- [x] Translate tooltip dates

## Bug Fix: All ETF Tickers Show Same Price
- [x] Investigated: all 36 price history records had identical price ($57.925), no variation for ETF compounding
- [x] Fixed by seeding historical price data from static LP history (182 data points from Sep 2025 - Mar 2026)
- [x] Verified: DORI=$57.92, DDRI=$81.97 (2x leveraged), TDRI (3x), SDRI=$17.29 (2x inverse), XDRI (3x inverse)

## Bug Fix: tRPC API Returning HTML Instead of JSON
- [x] Investigated: 502 proxy error (PROXY_SANDBOX_NOT_FOUND) during sandbox hibernation at 09:21:03
- [x] Root cause: transient infrastructure issue, not a code bug — sandbox proxy returned HTML error page
- [x] Verified: all API calls returning 200 OK with valid JSON after sandbox resumed

## Feature: Replace Manus OAuth with Email+Password Auth
- [x] Add passwordHash column to users table in drizzle schema
- [x] Install bcryptjs for password hashing (pure JS, no native deps)
- [x] Create register tRPC endpoint (email + password + displayName)
- [x] Create login tRPC endpoint (email + password → JWT session cookie)
- [x] Build Login page with email/password form (Korean/English i18n)
- [x] Build Register page with email/password/displayName form (Korean/English i18n)
- [x] Update auth redirect logic to use /login instead of Manus OAuth
- [x] Keep Manus OAuth callback as optional fallback (backward compatible)
- [x] Update getLoginUrl() to point to local /login page
- [x] Test full register → login → protected routes → logout flow — VERIFIED in browser
- [x] Add 11 vitest tests for local auth (password hashing, user lookup, registration, login)

## Feature: Migrate MySQL to SQLite
- [x] Install @libsql/client (pure JS SQLite driver, no native compilation needed)
- [x] Rewrite drizzle/schema.ts from mysqlTable to sqliteTable (all 14 tables)
- [x] Update drizzle.config.ts to use SQLite dialect and local ./data/lol-tracker.db file
- [x] Update server/db.ts: change drizzle driver from mysql2 to @libsql/client with WAL mode
- [x] Update all db helpers for SQLite syntax (onConflictDoUpdate, text for decimals, ISO strings for dates)
- [x] No MySQL-specific patterns in routers.ts, pollEngine.ts, or riotApi.ts (all use db.ts helpers)
- [x] Remove mysql2 dependency from package.json
- [x] Update server/_core/env.ts: DATABASE_URL → DATABASE_PATH with default ./data/lol-tracker.db
- [x] Seed historical price data (182 data points) into SQLite
- [x] Run full test suite — 58 tests passed
- [x] Verified complete app flow in browser (live data, charts, trading panel, all pages working)

## Bug Fix: Register Page Not Showing Server Errors
- [x] Verified: Register page already catches and displays "Email already registered" in a red error banner
- [x] Verified: Login page already catches and displays "Invalid email or password" in a red error banner
- [x] The console error is from the global logger in main.tsx (expected behavior, not a bug)
- [x] No redirect occurs on login/register pages (main.tsx line 24 skips them)

## Bug Fix: OAuth Auto-Created Accounts Block Registration
- [x] Fix register endpoint: if user exists with same email but no passwordHash, update the record with a password instead of rejecting
- [x] Added setUserPassword() helper to db.ts
- [x] OAuth-created users can now "claim" their account by registering with the same email

## Bug Fix: Ledger Page Empty
- [ ] Investigate why the Ledger page shows no data

## Feature: Full Self-Hosting Independence (Remove All Manus Dependencies)
- [x] Audit all remaining Manus dependencies (OAuth, env vars, _core modules, CDN assets, etc.)
- [x] Remove/replace Manus OAuth system with standalone auth only
- [x] Remove Manus _core modules not needed for self-hosting (LLM, imageGen, notification, storage, etc.)
- [x] Replace Manus CDN asset URLs with local/self-hosted alternatives
- [x] Remove Manus-specific env vars and config
- [x] Clean up unused Manus packages from package.json
- [x] Update self-hosting guide (SELF_HOSTING_GUIDE.md) for SQLite + local auth
- [x] Add Dockerfile and docker-compose.yml instructions in self-hosting guide

## Audit: Wire All Components to Live Backend Data (Remove Stale Fallbacks)
- [x] Audit Home.tsx for static data imports (playerData.ts, hardcoded values)
- [x] Audit PlayerHeader for static fallbacks vs live tRPC data
- [x] Audit LPChart for static LP_HISTORY vs live price data
- [x] Audit ChampionCard / champion pool for static CHAMPION_STATS vs live data
- [x] Audit StreakBar for static data vs live match data
- [x] Audit RecentPerformance for static data vs live match data
- [x] Audit MatchRow / match history for static MATCH_HISTORY vs live data
- [x] Audit SeasonHistory for static data vs live data
- [x] Audit stat cards for hardcoded values vs live data
- [x] Audit TradingPanel for static prices vs live prices (already wired)
- [x] Audit Leaderboard page for static vs live data (already wired)
- [x] Audit News page for static vs live data (already wired)
- [x] Audit Sentiment page for static vs live data (already wired)
- [x] Remove or minimize playerData.ts static data usage
- [x] Ensure all components show loading states when backend data is pending

## Bug: Login query failure + components stuck loading
- [x] Fix "Failed query" error on login — caused by stale MySQL build, SQLite-only now
- [x] Fix all components stuck in loading state — same stale MySQL build issue

## Feature: Server + Client Caching
- [x] Build server-side in-memory cache module with TTL and invalidation
- [x] Wire cache into all public tRPC endpoints (player, prices, matches, stats, news, etc.)
- [x] Auto-invalidate cache when polling engine writes new data
- [x] Update client-side staleTime to 10 min, gcTime to 30 min
- [x] Disabled refetchOnWindowFocus, retry limited to 1
- [x] Production is SQLite-only, will work after next publish

## Documentation
- [x] Write comprehensive README.md for the project

## Feature: Vercel + Railway Split Deployment
- [x] Add VITE_API_URL env var for frontend to point to backend
- [x] Update tRPC client to use VITE_API_URL when set
- [x] Add CORS to Express server for cross-origin requests
- [x] Add vercel.json for SPA routing
- [x] Update vite build to output standalone frontend (build:frontend script)
- [x] Provide Vercel deployment guide (user will deploy via dashboard)
- [x] Write Dockerfile for Railway backend
- [x] Write railway.toml configuration
- [x] Write full Vercel + Railway deployment guide (DEPLOYMENT_GUIDE.md)
- [x] Add environment variable documentation for split deployment

## Bug: Line graph extends past current date
- [x] Fix LPChart line graph to stop at the current date with an endpoint marker
- [x] Ensure no data points are rendered beyond the current date

## Feature: Connection diagnostics logging
- [x] Add frontend logging: API URL, tRPC requests/responses, CORS errors, cookie status
- [x] Add backend logging: incoming origins, CORS decisions, auth flow, cookie presence

## Fix: Railway CORS Override — Use Vercel Proxy Instead
- [x] Railway proxy overrides Access-Control-Allow-Origin with 'https://railway.com' — bypass CORS entirely
- [x] Update vercel.json with rewrites to proxy /api/* requests to Railway backend
- [x] Update tRPC client to use same-origin /api/trpc path (no cross-origin needed)
- [x] Update frontend health check to use same-origin /api/health
- [x] Remove cross-origin cookie/credentials config (cookies now sameSite: lax)
- [x] Update DEPLOYMENT_GUIDE.md with Vercel rewrites instructions

## Feature: Admin SQL Console
- [x] Add admin-protected tRPC endpoint to execute arbitrary SQL queries
- [x] Build browser UI page at /admin/sql with query textarea, run button, and results table
- [x] Protect endpoint with admin role check (owner only)
- [x] Add /admin/sql route to App.tsx
- [x] Write vitest tests for the admin SQL endpoint (12 tests)

## Feature: Admin Seed Historical Data Endpoint
- [x] Add admin tRPC endpoint to seed historical price data from static LP history
- [x] Endpoint should insert ~190 historical data points (Sep 2025 - Mar 2026)
- [x] Skip duplicates (don't re-seed if data already exists, >20 check)
- [x] Return count of inserted rows

## Fix: Hide Admin User from Leaderboard and Ledger
- [x] Filter out admin users from leaderboard query
- [x] Filter out admin users from ledger (all trades) query

## Fix: Limit Sell Ticker Options to Held Stocks
- [x] Only show tickers the user holds shares in when selling

## Fix: Auto-switch ticker when entering sell mode
- [x] Auto-select first held ticker when switching to sell if current ticker is not held

## Feature: Live Game Alert Banner
- [x] Add Riot Spectator API call to detect if player is in an active game
- [x] Create backend endpoint to check live game status
- [x] Build alert banner component above the LP chart
- [x] Show game mode, live timer, and ranked warning in the alert

## Bug: Users only see DORI ticker despite buying different stocks
- [x] Audit auto-switch useEffect in TradingPanel for unintended ticker resets
- [x] Fix: replaced reactive useEffect with mode-transition-aware logic using useRef

## Bug: Inverse ticker candle charts are all red
- [x] Fix candle color logic for inverse tickers ($SDRI, $XDRI) - now uses standard green-up/red-down for all tickers

## Change: Reduce poll interval to 2 minutes
- [x] Change match/update polling interval from 20 min to 2 min

## Feature: Trading Halt During Live Games
- [x] Add server-side check to block trade/order execution when player is in a live game
- [x] Show "Market Halted" banner on frontend when player is in game
- [x] Disable trade buttons and show explanation during halt

## Fix: Dividends only for non-inverse tickers
- [x] Exclude inverse tickers ($SDRI, $XDRI) from dividend payouts — dividends only on wins for DORI/DDRI/TDRI

## Enhancement: Poll live game status in polling engine
- [x] Add live game check to pollEngine so trade block cache is always fresh (with cache preservation across invalidateAll)

## Bug: Fix timestamps in the Ledger page
- [x] Ensure trades store proper timestamps in DB (UTC Z suffix added)
- [x] Display formatted timestamps on Ledger page (separate Time column)

## Bug: Price desync between chart header and trading panel
- [x] Investigate why chart header price differs from trading panel buy price
- [x] Sync both to use the same etfPrices endpoint

## Feature: AI Quant Bot Trader
- [x] Create bot user in DB on server startup (displayName: "QuantBot 🤖", role: user)
- [x] Build AI bot module (server/botTrader.ts) with market analysis logic
- [x] Gather market data for AI prompt: price history, recent matches, LP trend, win streaks, current holdings
- [x] Send data to OpenAI API with quant-style system prompt for trade decisions
- [x] Parse AI response into actionable trades (buy/sell/short/cover with ticker and amount)
- [x] Execute trades using existing db helpers (respects live game halt)
- [x] Post analytical sentiment comments from bot perspective
- [x] Integrate into polling engine on 10-min cycle (every 5th poll)
- [x] Handle errors gracefully (API failures → fallback momentum strategy, insufficient funds → capped trades)
- [x] Bot competes on leaderboard as regular user
- [x] Admin endpoint to force-run bot (admin.runBot)
- [x] Fallback to BUILT_IN_FORGE_API if OPENAI env vars not set
- [x] 11 vitest tests for bot trader module (all passing)
- [x] Full test suite: 81 tests passing

## Change: Bot Only Trades During Live Games
- [x] Remove 5-cycle counter — bot runs every poll cycle
- [x] Invert live game check — bot ONLY trades when player is in a live game
- [x] Update tests to reflect new behavior (11 tests passing)

## Audit: Single Source of Truth for All Prices
- [x] Audit all backend endpoints that return prices (etfPrices, priceHistory, latestPrice, etc.)
- [x] Audit all frontend components that display prices (PlayerHeader, TradingPanel, LPChart, stat cards)
- [x] Identify discrepancies: PriceRankLegend used prices.latest, others used prices.etfPrices; client playerData.ts had 1100 LP cap vs server 1200
- [x] Unify to single source of truth: ALL components now use prices.etfPrices for current prices
- [x] Ensure chart data updates correctly: reduced refetchInterval to 30s / staleTime to 15s across all price-consuming components
- [x] Fixed client-side totalLPToPrice formula to match server (1200 LP range)
- [x] Backend cache invalidateAll() already runs after every poll, so 30s staleTime ensures fresh data within one poll cycle

## Feature: Sync Ticker Selection Between Chart and Trading Panel
- [x] Create a shared TickerContext (React context) to hold the active ticker
- [x] Wire LPChart to read/write from TickerContext instead of local state
- [x] Wire TradingPanel to read/write from TickerContext instead of local state
- [x] Verify bidirectional sync: chart selection updates trading panel and vice versa

## Change: Two-Consecutive-Confirmation Live Game Check
- [x] Track previous poll's raw isInGame result in poll engine (previousRawIsInGame)
- [x] Only flip the confirmed live game status when two consecutive polls agree (confirmedIsInGame)
- [x] This provides ~2 min delay at game start and prevents false toggles from API flickers
- [x] Update the cache key to store the confirmed status (not the raw check)
- [x] Update frontend player.liveGame endpoint to use confirmed status from cache
- [x] All 81 tests passing

## Change: Disable Dividends
- [x] Skip dividend distribution in poll engine (code commented out)
- [x] Keep the code intact but commented/disabled for easy re-enable

## Bug: Quant Bot Not Trading
- [x] Investigated: bot was correctly skipping because player was not in a live game (previous change restricted bot to live-game-only)
- [x] Fix: removed the live game restriction — bot now trades every poll cycle regardless of game status
- [x] Updated tests to reflect new always-trade behavior (81 tests passing)

## Feature: Admin Reset User Cash
- [x] Add admin endpoint `admin.resetUserCash` to reset a specific user's cash balance
- [x] Support lookup by display name (e.g., "전준하") or userId, configurable cash amount (default $200)

## Bug: Double-Click Buys Twice Without Subtracting
- [x] Add server-side per-user mutex (withUserLock) on executeTrade, executeShort, executeCover — concurrent trades for same user are serialized
- [x] Add frontend 2-second cooldown + tradingLocked state on all trade buttons
- [x] Both layers prevent rapid double-click from executing two trades

## Feature: Trade by Shares (not just dollars)
- [x] Add a $ / shares toggle in TradingPanel for market and short tabs
- [x] When in "shares" mode, user enters number of shares directly
- [x] When in "dollars" mode, keep existing behavior (enter dollar amount, compute shares)
- [x] Apply to buy, sell, short, and cover actions
- [x] Update quick-amount buttons: $10/$25/$50/$100 in dollar mode, 0.5/1/2/5 in shares mode
- [x] Info line shows inverse: shares mode shows dollar equivalent, dollar mode shows share equivalent

## Feature: Admin DB Management Page
- [x] Create admin-only route /admin with full DB management UI (tabbed: Tables, SQL Console, Quick Actions)
- [x] Table browser: list all tables with row counts, click to view paginated rows
- [x] Inline row editing: click pencil icon to edit fields in dialog, save changes
- [x] Delete rows with confirmation dialog
- [x] Add new rows with auto-populated defaults
- [x] SQL console tab for raw queries (migrated from old AdminSQL page)
- [x] Quick Actions tab: Force Run Bot, Reset User Cash
- [x] Search/filter rows, pagination, refresh
- [x] Backend endpoints: tableSchema, tableRows, updateRow, deleteRow, insertRow
- [x] Quick actions: reset user cash, run bot, view DB stats
- [x] Protect with admin role check (redirects non-admin users)

## Feature: Add 6h and 1d Chart Time Ranges
- [x] Add 6H and 1D options to time range selector in LPChart, CandlestickChart, and playerData.ts
- [x] Filter price history data for these shorter timeframes (6 hours, 24 hours)
- [x] Intraday ranges show individual poll snapshots (not collapsed to daily)
- [x] X-axis shows time (e.g., 2:30 PM) for intraday, date for daily+ ranges

## Change: Chart Intraday X-Axis, 3H Range, Scrollable
- [x] Fix X-axis to show times (not dates) for intraday ranges (3H, 6H, 1D)
- [x] Add 3H time range option across LPChart, CandlestickChart, and playerData.ts
- [x] Make time range buttons scrollable on mobile
- [x] Make area chart horizontally scrollable when intraday data has many points

## Bug: Admin Page Redirects to Home on Self-Hosted
- [ ] Admin page at /admin redirects non-admin users back to home — user may not have admin role set
- [ ] Investigate: user.role check on line 713 — if user role is not "admin" it navigates to "/"
- [ ] Fix: either user needs admin role, or the auth check needs adjustment for self-hosted

## Task: Set 윤여균 as Admin
- [ ] Update user role to admin for displayName "윤여균"

## Bug: Bot Not Trading on Self-Hosted Platform
- [ ] Investigate why bot trades on Manus but not on self-hosted
- [ ] Check if bot initialization depends on env vars not present in self-hosted
- [ ] Fix the issue

## Change: Disable Bot Sentiment Comments
- [x] Commented out postBotComment calls in both runBotTrader and forceRunBot

## Audit: Short/Cover Logic and Calculations
- [ ] Audit executeShort: margin calculation, collateral requirements, share tracking
- [ ] Audit executeCover: P&L calculation, cash return, share reduction
- [ ] Audit portfolio valuation: how short positions affect total portfolio value
- [ ] Audit leaderboard: does it correctly account for short P&L?
- [ ] Audit ETF pricing: do inverse/leveraged ETFs correctly reflect in short positions?
- [ ] Check edge cases: covering more than shorted, shorting with insufficient margin, zero-price scenarios

## Audit: Race Conditions
- [ ] Evaluate concurrent trade execution (multiple users trading simultaneously)
- [ ] Evaluate poll engine vs user trades (price updates during trade execution)
- [ ] Evaluate bot trader vs user trades (bot and user trading same ticker simultaneously)
- [ ] Evaluate portfolio snapshot vs active trades
- [ ] Check for TOCTOU (time-of-check-time-of-use) bugs in balance/share checks
- [ ] Fix any identified race conditions

## Bug: Candlestick Chart Broken for 3H/6H/1D
- [x] Fix data grouping: switched from YYYY-MM-DD strings to Unix timestamps (seconds), group into 10m/15m/30m candles for 3H/6H/1D
- [x] Fix x-axis: lightweight-charts now shows times natively with timeVisible: true
- [x] Fix scrolling: chart uses fitContent() and proper barSpacing for intraday
