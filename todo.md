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
