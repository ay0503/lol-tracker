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
