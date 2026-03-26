# $DORI LP Tracker — Project Memory

## Architecture
- **Frontend**: React 19 + Vite + Tailwind 4 + shadcn/ui on Vercel
- **Backend**: Express + tRPC 11 + SQLite (libSQL) on Railway
- **Deployment**: Vercel rewrites `/api/*` to Railway backend
- **Polling**: 30s interval, ~5 Riot API calls per cycle
- **Code splitting**: React.lazy() for all pages except Home + Login

## Key Technical Decisions
- `.returning()` not supported by libSQL — use select after insert
- `Array.from(map.entries())` for Map iteration (TS downlevelIteration)
- Drizzle SQL expressions type as `{}` — cast with `String()`
- `clearInterval` doesn't accept `null` — use local variable or guard
- Raw SQL sometimes more reliable than Drizzle for new columns
- Casino leaderboard uses raw SQL query (getRawClient)
- Adaptive polling: 120s idle → 15s when game active (saves 80% requests)
- Memory leak prevention: cleanup intervals on Maps (casinoLastGameTime, userTradeLocks)
- getAllMatchesFromDB limited to 200 (was unlimited)

## Navigation
- Shared AppNav component used on ALL pages
- CasinoSubNav: game tab strip on casino pages
- User names clickable → /profile/:userId

## Casino System
- Separate `casinoBalance` from `cashBalance` ($20 vs $200 start)
- Deposit: 10x multiplier ($1 trading = $10 casino)
- Daily bonus: $1/day (DB-persisted, not cache)
- Per-user cooldowns (admin-controlled, DB table)
- Games: Blackjack, Crash, Mines, Roulette, Video Poker
- Routes: /casino (landing), /casino/blackjack, /casino/crash, etc.
- In-memory game state, 30-min stale cleanup
- Casino leaderboard separate from trading

## Blackjack
- Standard rules, dealer stands 17, BJ pays 3:2
- $0.10-$5 bets, colored casino chips
- Sequential dealer reveal, keyboard shortcuts H/S/D
- Delayed result display (useDelayedStatus hook)

## Crash
- Canvas graph with real-time curve, 1% house edge
- Server-side timers for crash + auto-cashout (not polling-dependent)
- 200ms grace window on cashout for network latency
- Tab-focus resync via visibilitychange listener

## Mines
- 5x5 grid, 1-24 mines, 2% house edge
- Multiplier: ∏(25-i)/(25-m-i) × 0.98, $250 max payout

## Video Poker
- Jacks or Better, 9/5 pay table (~2% house edge)
- Full House 9x, Flush 5x

## Dividend System
- Base $0.10 + share bonus + rubber banding (3x broke → 0.5x rich)
- Cap $3/user/game

## Betting
- $1-$50 game bets, 2x payout, blocked during live games

## Discord Bot
- REST-only, all notifications gated behind newMatches > 0

## User Profiles
- /profile/:userId — public profiles with holdings, trades, bets, chart
- Clickable from leaderboard

## Welcome Modal
- 4-step first-visit education (Trading, Casino, Transfers, Dividends)
- localStorage flag, Korean/English
