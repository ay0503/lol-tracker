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
