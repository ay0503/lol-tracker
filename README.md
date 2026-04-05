# $DORI LP Tracker

A Robinhood-style fantasy trading platform + casino built around a League of Legends player's ranked performance. Trade leveraged ETFs, bet on game outcomes, play 8 casino games, compete on leaderboards, and follow AI-generated meme news — all powered by live Riot API data with Discord notifications.

---

## Overview

$DORI LP Tracker turns the ranked journey of **목도리 도마뱀** into a full financial simulation for ~12 friends. The player's LP maps to a stock price (`$DORI`), users start with $200 cash and trade five ETF tickers. A 30-second polling engine fetches live Riot API data, detects games via Spectator API, updates prices, distributes dividends, resolves bets, and posts Discord notifications.

---

## Features

### Trading Platform
- **5 ETF Tickers**: `$DORI` (1x), `$DDRI` (2x), `$TDRI` (3x), `$SDRI` (-2x inverse), `$XDRI` (-3x inverse)
- **Daily compounding**: leveraged/inverse ETFs compound at day boundaries (not per-snapshot), matching real ETF behavior
- **Buy/sell, short/cover** with margin requirements (50% collateral)
- **Game betting**: WIN/LOSS bets ($1-$50) on match outcomes, 2x payout, auto-resolved
- **Dividends**: base + share bonus + rubber banding (3x for broke, 0.5x for rich), capped at $3/game
- **Price validation**: server-side 0.5% tolerance, market halts during live games
- **Candlestick + area charts** with time ranges (3H to ALL), pinch-to-zoom

### Casino (8 Games)
Separate $20 casino balance, one-way deposit from trading cash (configurable multiplier).

| Game | Style | Key Feature |
|------|-------|-------------|
| Blackjack | Standard flow | Keyboard H/S/D, naturals 2:1, split |
| Crash | Live multiplier graph | Auto-cashout, softer curve |
| Mines | 5x5 grid, 1-24 mines | Cashout anytime, $250 max |
| Roulette | Red/black/green | Strip animation, green refunds |
| Video Poker | Hold/draw | Tens or Better |
| Dice | Over/under target | Animated result bar |
| Hi-Lo | Higher/lower cards | Streak payout ladder |
| Plinko | 12 rows, 3 risk tiers | Deterministic animation, multi-ball |

All games are neutral or slightly player-favored. Freeform bets $0.10-$50.

### Leaderboard
- **Standings chart**: bump chart showing daily rank positions with numbered dots per user
- **Portfolio value chart**: multi-user lines with smart Y-axis (5th/95th percentile clipping)
- Time range selector (1D/1W/1M/ALL), clickable legend to toggle users
- Animated line drawing on load
- Expandable user profiles with holdings, trades, bet stats, sparkline

### AI News + Discord Bot
- **AI-generated headlines** using LLM with match history context (streaks, repeat picks, session record)
- Mixed WSB + 디씨인사이드 주갤 style with Korean internet slang
- Template fallback when AI is disabled
- **Discord notifications**: game start/end, match results with news, rank changes, streak alerts (3+), big price moves (5%+), daily summary

### Cosmetics Shop
- 50+ titles and name effects purchasable with casino cash
- Animated effects: rainbow, fire, ice, neon pulse, glitch, lava, cosmic, arcane runes
- Tiers: Common ($5-18) → Legendary ($275-500), limited stock items

### Additional Features
- Korean/English i18n toggle
- Sentiment board (bullish/bearish/neutral comments)
- User profiles at `/profile/:userId`
- Admin panel: DB viewer, SQL console, quick actions, CI/Tests dashboard
- QuantBot: LLM-powered AI trader (disabled by default)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS 4, shadcn/ui, wouter, framer-motion |
| Backend | Express 4, tRPC 11, Node.js |
| Database | SQLite via libSQL + Drizzle ORM |
| Charts | Recharts (line/area), lightweight-charts v5 (candlestick) |
| Auth | Email/password with bcrypt + JWT (jose) |
| Testing | Vitest 2 + v8 coverage + jsdom (~450 tests, 27 test files) |
| Deployment | Vercel (frontend) + Railway (backend) |
| Notifications | Discord REST API |
| AI | OpenAI-compatible LLM (news generation, bot trader) |

---

## Test Coverage

27 test files with ~450 test cases across server and client:

| Area | Files | Coverage |
|------|-------|----------|
| **ETF Pricing** | `etfPricing.test.ts` | Daily compounding, leverage, inverse, day boundaries, volatility decay |
| **Casino Engines** | 7 files (blackjack, crash, roulette, poker, dice, plinko, mines) | Hand evaluation, game math, payout caps |
| **Trading Logic** | `tradingLogic.test.ts`, `trading.test.ts` | Route validation, price tolerance, live game blocks, margin checks |
| **Poll Engine** | `pollEngineLogic.test.ts` | Game confirmation state machine, remake detection, streak calc |
| **Discord** | `discord.test.ts` | All 7 notification functions, formatting, edge cases |
| **Edge Cases** | `edgeCases.test.ts` | Price truth, trapped positions, rounding, timezone boundaries |
| **Client** | `formatters.test.ts`, `playerData.test.ts`, `utils.test.ts` | All formatters (en+ko), LP math, class merging |
| **i18n** | `i18n.test.ts` | en/ko key parity, no empty values, placeholder consistency |
| **Auth/Admin** | 4 files | Login, registration, bcrypt, admin SQL |

CI runs on every push via GitHub Actions: type check + vitest with v8 coverage.

---

## Getting Started

### Prerequisites
- Node.js 20+ (22 recommended)
- pnpm package manager
- Riot Games API key ([developer.riotgames.com](https://developer.riotgames.com))

### Installation
```bash
git clone <repo-url> lol-tracker
cd lol-tracker
pnpm install
```

### Configuration
Create a `.env` file:
```env
# Required
RIOT_API_KEY=RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
JWT_SECRET=your-secure-random-string

# Optional
DATABASE_PATH=./data/lol-tracker.db
OPENAI_API_URL=https://api.openai.com/v1    # AI news + bot trader
OPENAI_API_KEY=sk-...
DISCORD_BOT_TOKEN=...                        # Discord notifications
DISCORD_CHANNEL_ID=...
CORS_ORIGIN=https://your-frontend.vercel.app # Split deployment
```

### Development
```bash
pnpm dev        # Start dev server with hot reload
pnpm db:push    # Generate and run DB migrations
pnpm test       # Run all ~450 tests
pnpm check      # TypeScript type check
```

### Production
```bash
pnpm build      # Bundle frontend (Vite) + server (esbuild)
pnpm start      # Run production server
```

---

## Deployment

- **Frontend**: Vercel (auto-deploy on push to main)
- **Backend**: Railway with Dockerfile (auto-deploy on push to main)
- **Database**: SQLite on Railway persistent volume

Vercel rewrites `/api/*` to the Railway backend. See `vercel.json` and `Dockerfile` for config.

---

## ETF Pricing Model

LP maps linearly to price: Platinum IV 0LP = $10, Diamond I 100LP = $100.

Leveraged/inverse ETFs compound **daily** (not per-snapshot):
- Within a day: ETF moves linearly with the underlying
- At day boundaries: daily return is multiplied by leverage factor
- Floor at $0.01 prevents negative prices

This matches real leveraged ETF behavior and prevents excessive volatility decay.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RIOT_API_KEY` | Yes | Riot Games API key |
| `JWT_SECRET` | Yes | JWT session cookie signing secret |
| `DATABASE_PATH` | No | SQLite file path (default: `./data/lol-tracker.db`) |
| `OPENAI_API_URL` | No | OpenAI-compatible API URL for AI features |
| `OPENAI_API_KEY` | No | LLM API key |
| `DISCORD_BOT_TOKEN` | No | Discord bot token for notifications |
| `DISCORD_CHANNEL_ID` | No | Discord channel for notifications |
| `CORS_ORIGIN` | No | Frontend URL for split deployment |

---

## License

MIT
