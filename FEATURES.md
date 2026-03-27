# Features Built This Session

## Casino Refactor / Debug Sprint
- Casino is back to 8 games: Blackjack, Crash, Roulette, Mines, Video Poker, Dice, Hi-Lo, Plinko
- Removed Limbo and Wheel from routes, lobby, hotbar, and server/router surface
- All casino games now support freeform bets from $0.10 to $50
- Quick bet buttons standardized to 10c, 25c, 50c, $1, $2, $5
- Chip UI removed across the casino flow

## Casino Landing
- Added an info section below the hero that explains the casino as a lighthearted side economy
- Clearly documents that casino cash is separate from trading cash
- Trading cash can be converted into casino cash at 1:10
- Casino cash cannot be transferred back into trading cash
- Added a more prominent purple cosmetics shop CTA
- Added Player Edge pill + modal explaining each game's neutral/player-favored tweaks

## Casino Navigation & Layout
- Casino hotbar updated to cover the active 8 games plus shop
- Removed back-to-casino rows from game pages to save vertical space
- Standardized game headers so each page shows a game icon + name
- Desktop layouts for Blackjack, Mines, and Plinko now move betting/action controls into a right-side panel when appropriate
- Mines board and live-round UI compacted to reduce unnecessary scrolling
- Sub-dollar quick bet labels use cent notation so they fit cleanly on buttons

## Roulette
- Simplified betting to red, black, or green only
- Kept the strip-style spin animation instead of the old cluttered number board
- Fixed the end-of-spin backward snap/glitch so the final color resolves cleanly
- Red/black pay 2x, green pays 37x, and green refunds color bets

## Plinko
- Rebalanced payout tables, especially the overly player-favored high-risk mode
- Fixed peg-hit rendering so pegs no longer disappear on impact
- Fixed 3-ball and 5-ball drops so they no longer fail with "Game already in progress"
- Reworked the frontend animation to follow the server-resolved path instead of fake free physics
- Final landing animation now matches the actual resolved bucket much more closely

## Casino Payout Tuning
- Blackjack naturals now use clean 2:1 payout while regular wins stay 2x
- Video Poker keeps a normal-looking pay table but now uses Tens or Better
- Crash curve was softened to make higher cashouts a bit more reachable
- Dice keeps the friendlier 101-based multiplier table
- Casino copy now explains the player-favored/neutral philosophy without losing the game flavor

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
- Routes: /casino, /casino/blackjack, /casino/crash, /casino/roulette, /casino/mines, /casino/poker, /casino/dice, /casino/hilo, /casino/plinko, /casino/shop

## Blackjack
- Server-side engine, freeform $0.10-$50 bet entry with quick shortcuts
- Standard rules, naturals 2:1, dealer stands 17
- Sequential dealer card reveal, soft hand values
- Keyboard shortcuts H/S/D, "Same Bet" play-again
- Cards: white face, crosshatch back, spring animations
- Rich green felt table, dark page background
- Double-down race condition fix

## Mines
- 5x5 grid, 1-24 mines, cashout-anytime flow
- Multiplier table adjusted away from the old house-cut formula
- $250 max payout, cash out anytime
- Server-side mine placement (can't cheat)
- Tile flip animations (💎/💣), live multiplier display
- Mine count presets, compact desktop layout, freeform bet entry
- Red/orange themed, dark background

## Additional Casino Games
- Crash: live multiplier graph, auto-cashout, softer high-end curve
- Roulette: red/black/green-only simplified UI with strip animation
- Video Poker: hold/draw flow with Tens or Better payouts
- Dice: over/under target betting with animated result bar
- Hi-Lo: streak presentation, odds-based payout ladder, cashout flow
- Plinko: 12-row board, risk tiers, deterministic resolved-path animation, multi-ball drops

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
