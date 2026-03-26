# $DORI LP Tracker — Project Memory

## Architecture
- Frontend: React 19 + Vite + Tailwind 4 + shadcn/ui on Vercel
- Backend: Express + tRPC 11 + SQLite (libSQL/Drizzle) on Railway
- Deployment: Vercel rewrites /api/* to Railway backend
- Polling: 30s server, adaptive client (120s idle → 15s active)
- Code splitting: React.lazy() for all pages except Home + Login
- Vite manual chunks: vendor-charts, vendor-motion

## Casino Games (10 total)
1. Blackjack — standard, BJ 3:2, keyboard H/S/D
2. Crash — canvas graph, server timers, 200ms grace, 1% edge
3. Mines — 5x5 grid, 1-24 mines, 2% edge, no-limit
4. Roulette — European wheel, no-limit, single smooth spin
5. Video Poker — Jacks or Better 9/5, ~2% edge
6. Dice — roll over/under, 1% edge, animated result bar
7. Limbo — target multiplier, 1% edge, rising meter animation
8. Hi-Lo — guess higher/lower on cards, 2% edge, cashout anytime
9. Wheel — 50 segments, CSS conic-gradient, ~3.5% edge
10. Plinko — 12 rows, 3 risk levels, physics ball drop, 2-3% edge

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

## AI Contributor Docs (from other session)
- CLAUDE.md → points to CLAUDE_CONTEXT.md as primary entry point
- AGENTS.md — strict NEVER/ALWAYS rulebook
- .claude/rules/ — contributing, checks, templates
- .claude/skills/ — server-guide, client-guide, casino-guide, pitfalls

## Sprint Status
### Sprint 1-3 ✅ Complete
### Sprint 4 🟡 Partial (casino game history done, challenges + router split TODO)

## Still TODO
- Wire recordCasinoGameResult into game resolution points
- Daily/weekly challenges system
- routers.ts split into modules
- Trade markers on candlestick chart
- Comment reactions frontend UI
- Price alerts frontend UI
- Casino → Trading withdrawal
