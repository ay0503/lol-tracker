# $DORI LP Tracker — Project Memory

## Architecture
- Frontend: React 19 + Vite + Tailwind 4 + shadcn/ui on Vercel
- Backend: Express + tRPC 11 + SQLite (libSQL/Drizzle) on Railway
- Deployment: Vercel rewrites /api/* to Railway backend
- Polling: 30s server, adaptive client (120s idle → 15s active)
- Code splitting: React.lazy() for all pages except Home + Login
- Vite manual chunks: vendor-charts, vendor-motion

## Casino Games (8 total)
1. Blackjack — standard flow, keyboard H/S/D, naturals pay 2:1, regular wins pay 2x
2. Crash — canvas graph, server timers, softer curve, slight player edge
3. Mines — 5x5 grid, 1-24 mines, boosted multiplier table, cashout anytime
4. Roulette — simplified to red/black/green bets only, strip spin animation, green refunds color bets
5. Video Poker — classic pay table with Tens or Better qualifier
6. Dice — roll over/under, 101-based multiplier table, animated result bar
7. Hi-Lo — guess higher/lower on cards, odds-based payouts with small player boost, cashout anytime
8. Plinko — 12 rows, 3 risk levels, deterministic resolved-path animation, 1/3/5-ball drops

## Cosmetics System
- StyledName component with inline styles registry (EFFECT_STYLES)
- 50+ titles/effects purchasable with casino cash
- Animated effects: rainbow, fire, ice, neon pulse, glitch, lava, solar, arcane runes
- Badge animations: glow-pulse, shimmer-sweep
- Close friends: green star tag (admin toggle)
- NEVER use dynamic Tailwind classes from DB — use inline styles

## Admin Features
- resetCasinoBalance, setCasinoCooldown, setCasinoMultiplier
- toggleCloseFriend, grantAllCosmetics
- Configurable deposit multiplier (default 10x, stored in app_config table)
- Local admin bootstrap: `shawn` can be re-granted admin directly in local SQLite when needed

## Key Gotchas
- **NEVER use 't' as variable/param name** (TDZ with esbuild + useTranslation)
- Dynamic Tailwind classes from DB don't render — use StyledName inline styles
- libSQL: no .returning(), use select after insert
- Map/Set iteration: Array.from()
- useRef needs initial value
- Drizzle SQL types as {} — cast with String()
- clearInterval doesn't accept null
- Spectator API: by-summoner/{puuid} (NOT by-puuid)
- Casino deposit rate: configurable via admin (default 10x)
- esbuild keepNames: true in vite.config.ts
- Casino in-flight lock: acquireCasinoLock in checkCasinoCooldown
- Casino cash and trading cash are intentionally one-way separated: trading -> casino allowed, casino -> trading not allowed
- Casino bet controls use freeform amount entry with quick shortcuts; no chip UI remains
- Desktop casino pages may move betting/action panels into a right column to avoid vertical scrolling
- All casino game pages should use a consistent top header with game icon + name and no back-to-casino row

## AI Contributor Docs (from other session)
- CLAUDE.md → points to CLAUDE_CONTEXT.md as primary entry point
- AGENTS.md — strict NEVER/ALWAYS rulebook
- .claude/rules/ — contributing, checks, templates
- .claude/skills/ — server-guide, client-guide, casino-guide, pitfalls

## Sprint Status
### Sprint 1-3 ✅ Complete
### Sprint 4 🟡 Partial (casino game history done, challenges + router split TODO)
### Casino Refactor / Debug Sprint ✅ Complete
- Removed Limbo and Wheel again after upstream reintroduced them; casino is back to 8 games
- Standardized casino bet controls to $0.10-$50 with quick buttons: 10c, 25c, 50c, $1, $2, $5
- Added casino landing info section, one-way transfer explanation, purple cosmetics shop CTA, and player-edge info modal
- Expanded casino hotbar coverage for the active 8 games + shop
- Simplified Roulette to red/black/green while keeping the strip animation and fixing the end-of-spin snap
- Reworked Plinko frontend to deterministic resolved-path animation, fixed multi-ball locking, and aligned visuals to the actual resolved bucket
- Tuned casino payouts/copy toward neutral or slightly player-favored play using clean-number tables

## Still TODO
- Wire recordCasinoGameResult into game resolution points
- Daily/weekly challenges system
- routers.ts split into modules
- Trade markers on candlestick chart
- Comment reactions frontend UI
- Price alerts frontend UI
- Better non-gambling casino-cash faucets if the product needs them later
