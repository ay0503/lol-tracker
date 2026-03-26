# CLAUDE_CONTEXT.md — Full Project Context for $DORI LP Tracker

> This document gives an AI assistant complete context to work on the project.
> Read this FIRST before making any changes.

## What This Is

**$DORI LP Tracker** is a Robinhood-style fantasy stock trading + casino platform where the "stock" tracks a real League of Legends player's ranked LP. Built for a friend group (~12 users).

- **Stock price**: LP goes up when player wins, down when they lose ($10–$100 range)
- **Trading**: $200 virtual cash, 5 ETF tickers (1x, 2x, 3x, -2x, -3x leverage)
- **Casino**: Separate $20 balance, 5 games (Blackjack, Crash, Mines, Roulette, Video Poker)
- **Social**: Leaderboard, sentiment board, betting on game outcomes, user profiles

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS 4, shadcn/ui, wouter (routing), framer-motion |
| Backend | Express 4, tRPC 11, Node.js |
| Database | SQLite via libSQL + Drizzle ORM |
| Charts | Recharts (line), lightweight-charts v5 (candlestick) |
| Auth | Email/password with bcrypt + JWT cookies |
| Deployment | Vercel (frontend) + Railway (backend), Vercel rewrites /api/* to Railway |

## Project Structure

```
client/src/
├── pages/           # Page components (Home, Casino, Blackjack, Crash, etc.)
├── components/      # Shared components (AppNav, CasinoSubNav, TradingPanel, etc.)
├── contexts/        # React contexts (Language, Theme, Ticker)
├── i18n/            # en.ts + ko.ts translation dictionaries
├── lib/             # tRPC client, formatters, player data
└── _core/hooks/     # useAuth hook

server/
├── _core/           # Framework plumbing (index.ts, trpc.ts, context.ts, env.ts, llm.ts)
├── routers.ts       # ALL tRPC procedures (~1500 lines)
├── db.ts            # Database access layer
├── pollEngine.ts    # 30s polling engine (Riot API → price → matches → dividends → orders)
├── riotApi.ts       # Riot Games API client
├── etfPricing.ts    # ETF price computation
├── botTrader.ts     # AI quant bot
├── blackjack.ts     # Blackjack game engine
├── crash.ts         # Crash game engine
├── mines.ts         # Mines game engine
├── videoPoker.ts    # Video Poker game engine
├── roulette.ts      # Roulette game engine
├── discord.ts       # Discord bot (REST-only)
└── cache.ts         # In-memory TTL cache

drizzle/
├── schema.ts        # All table definitions
└── migrations/      # SQL migration files
```

## Key Gotchas

1. **libSQL**: No `.returning()` on inserts — use select after insert
2. **Map iteration**: Use `Array.from(map.entries())` for TypeScript compatibility
3. **Drizzle types**: SQL expressions type as `{}` — cast with `String()`
4. **clearInterval**: Doesn't accept `null` — use local variable or guard with `if`
5. **Schema sync**: Raw SQL (`getRawClient()`) sometimes more reliable than Drizzle for new columns
6. **Casino games**: In-memory state (Maps), lost on server restart. 30-min stale cleanup.
7. **Spectator API**: Path is `by-summoner/{puuid}` (NOT `by-puuid`). Returns 502 intermittently.
8. **Deposit rate**: 10x ($1 trading = $10 casino). Verify consistency across WelcomeModal + Casino page.
9. **Two nav components**: AppNav (site-wide) + CasinoSubNav (casino pages only)
10. **Code splitting**: All pages except Home + Login use React.lazy()

## Environment Variables (Railway)

| Variable | Required | Description |
|----------|----------|-------------|
| RIOT_API_KEY | Yes | Riot Games API key |
| JWT_SECRET | Yes (prod) | Session cookie signing |
| DATABASE_PATH | No | SQLite file path (default: ./data/lol-tracker.db) |
| OPENAI_API_URL | No | OpenAI-compatible API (enables AI news + bot) |
| OPENAI_API_KEY | No | API key for LLM |
| CORS_ORIGIN | No | Frontend URL for split deployment |
| DISCORD_BOT_TOKEN | No | Discord bot token |
| DISCORD_CHANNEL_ID | No | Discord notification channel |

## Database Tables

users, portfolios, holdings, trades, orders, comments, news, dividends, matches, marketStatus, priceHistory, portfolioSnapshots, notifications, bets, casino_daily_claims, casino_cooldowns

## Current State

- 12 registered users, all active
- 5 casino games live
- 30s polling with adaptive client-side intervals
- Discord bot sending match notifications
- Dividends active with rubber banding
- Full Korean/English i18n
- User profiles at /profile/:userId
- No-limit mode on Mines + Roulette

## What's NOT Done (from audit)

- Casino → Trading withdrawal (one-way deposit only)
- Portfolio summary on Home page
- Trade markers on price chart
- Browser push notifications / PWA
- Daily/weekly challenges
- Price alerts
- Achievements/badges
- In-memory game state → DB persistence
- Seasonal tournaments
