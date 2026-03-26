# Features Built This Session

## Infrastructure & Polling
- Poll interval: 2min → 30s with API dedup (8→5 calls/cycle)
- Snapshot throttling: price every 5min, portfolio every 10min
- Daily price history pruning (7d full → hourly → daily)
- Client refetch relaxed to 60s/30s
- Leaderboard reuses cached ETF prices
- etfHistory cache normalized to 5-min buckets
- Admin DB mutations invalidate cache
- Console logging reduced (frontend + backend)
- Concise frontend health check

## Live Game & Trading
- Fixed Spectator v5 path (by-summoner with PUUID)
- Trade endpoints use confirmed cache only
- Fallback post-game banner from match history
- Queue 2400 mapped to Ranked Solo/Duo
- Removed trading cooldown
- Price validation tightened (2% → 0.5%)
- Trade/short/cover/bet wrapped in try-catch for proper errors
- Admin users on leaderboard

## Discord Bot
- Match results, rank changes, streak alerts (3+)
- Big price moves (5%+), daily summary with top 3
- Admin testDiscord endpoint
- Spam prevention: only on new events, streak count increase

## Dividend System
- New model: base + share bonus + rubber banding
- Direction-dependent payouts (bull on win, bear on loss)
- Rubber banding: 3x broke → 0.5x rich
- Cap $3/user/game, notifications on receipt
- Dividends tab on Ledger page

## Betting System
- WIN/LOSS game bets ($1-$50), 2x payout
- Blocked during live games, auto-resolved on match
- Full integration: Home, Ledger (Bets tab), Portfolio (Bets filter), Leaderboard (bet stats)

## Casino Platform
- Landing page: hero balance, game grid, inline leaderboard, daily bonus
- Separate casinoBalance ($20 start) from trading cash
- Casino leaderboard (tab on main leaderboard + inline on /casino)
- Admin: resetCasinoBalance endpoint + Quick Actions UI
- Routes: /casino, /casino/blackjack, /casino/mines

## Blackjack
- Server-side engine, $0.10-$5 colored casino chips
- Standard rules, BJ 3:2, dealer stands 17
- Sequential dealer card reveal, soft hand values
- Keyboard shortcuts H/S/D, "Same Bet" play-again
- Cards: white face, crosshatch back, spring animations
- Rich green felt table, dark page background
- Double-down race condition fix

## Mines (NEW)
- 5x5 grid, 1-24 mines, 2% house edge
- Multiplier: ∏(25-i)/(25-m-i) × 0.98
- $250 max payout, cash out anytime
- Server-side mine placement (can't cheat)
- Tile flip animations (💎/💣), live multiplier display
- Mine count presets, colored chips
- Red/orange themed, dark background

## UI/UX
- Admin nav link (red, desktop + mobile)
- Chart P&L reflects visible data range
- Number input custom spinners
- Candlestick flat candle merging + time skip indicators
- Trackpad pinch-to-zoom for both charts
- Leaderboard: clickable profiles with holdings, trades, sparkline, bet stats
- Multi-select bulk delete in admin DB
- Leaderboard tabs: Trading + Casino
- Ledger tabs: Trades + Dividends + Bets
- Portfolio: Bets filter tab
- Daily bonus claim on casino page
