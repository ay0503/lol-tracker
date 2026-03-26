# $DORI LP Tracker — Project Memory

## Architecture
- **Frontend**: React 19 + Vite + Tailwind 4 + shadcn/ui on Vercel
- **Backend**: Express + tRPC 11 + SQLite (libSQL) on Railway
- **Deployment**: Vercel rewrites `/api/*` to Railway backend
- **Polling**: 30s interval, ~5 Riot API calls per cycle

## Key Technical Decisions
- `.returning()` not supported by libSQL — use select after insert
- `Array.from(map.entries())` for Map iteration (TS downlevelIteration)
- Drizzle SQL expressions type as `{}` — cast with `String()`
- `clearInterval` doesn't accept `null` — use local variable or guard
- esbuild catches duplicate variable names in same scope
- Raw SQL sometimes more reliable than Drizzle for new columns (schema sync issues)
- Casino leaderboard uses raw SQL query (getRawClient) to avoid Drizzle schema mismatch

## Spectator API
- Path: `lol/spectator/v5/active-games/by-summoner/{puuid}` (NOT `by-puuid`)
- Returns 502 intermittently — handled gracefully, preserves previous state
- Queue 2400 mapped to Ranked Solo/Duo
- Two-consecutive-confirmation: ~1 min with 30s polling

## Casino System
- Separate `casinoBalance` from `cashBalance` ($20 vs $200 start)
- Games: Blackjack (live), Mines (live), Coin Flip/Dice (coming soon)
- Routes: `/casino` (landing), `/casino/blackjack`, `/casino/mines`
- In-memory game state (Map per game type), 30-min stale cleanup
- Daily bonus: $1/day via cache-based cooldown
- Casino leaderboard separate from trading leaderboard
- Admin: resetCasinoBalance endpoint in Quick Actions

## Blackjack
- Standard rules, dealer stands 17, BJ pays 3:2
- $0.10-$5 bets, colored casino chips
- Sequential dealer card reveal animation (500ms between cards)
- Keyboard shortcuts: H/S/D
- Double-down: engine executes before cash deduction (race fix)
- Soft hand display (7/17 for Ace+6)

## Mines
- 5x5 grid, 1-24 mine count selection
- Multiplier: `∏(25-i)/(25-m-i) × 0.98` per safe tile (2% house edge)
- $250 max payout cap
- Mine positions server-side only, revealed on game end
- Cash out after first safe reveal

## Dividend System
- Base: $0.10 per holder per game
- Share bonus: WIN→DORI/DDRI/TDRI, LOSS→SDRI/XDRI
- Rates: DORI $0.002, DDRI $0.003, TDRI $0.004 per LP per share
- Rubber banding: 3x (<$50) → 0.5x (>$400)
- Cap: $3 per user per game

## Betting System
- $1-$50 game bets, 2x payout, blocked during live games
- Auto-resolved when new match detected

## Discord Bot
- REST-only, notifications: match/rank/streak/big move/daily summary
- All gated behind `result.newMatches > 0` (no spam)
- Streak only notifies on count increase

## Polling Optimizations
- 30s interval, deduplicated API calls (5 per cycle)
- Price snapshots throttled to every 5 min
- Portfolio snapshots every 10 min
- Daily price history pruning
- Client refetch: 60s staleTime, 30s intervals
