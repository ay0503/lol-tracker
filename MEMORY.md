# $DORI LP Tracker — Project Memory

## Architecture
- Frontend: React 19 + Vite + Tailwind 4 + shadcn/ui on Vercel
- Backend: Express + tRPC 11 + SQLite (libSQL/Drizzle) on Railway
- Deployment: Vercel rewrites /api/* to Railway backend
- Polling: 30s server, adaptive client (120s idle → 15s active)
- Code splitting: React.lazy() for all pages except Home + Login
- Vite manual chunks: vendor-charts, vendor-motion

## Recent Sprint Progress

### Sprint 1 ✅ (8 items)
- Trade price validation uses cached ETF prices (no full table scan)
- fullHistoryCache properly assigned in pollEngine
- Cache invalidation uses invalidatePrefix for parameterized keys
- Portfolio summary card on Home page
- Unhandled rejection/exception handlers
- Discord .catch() on all notifications
- Dead code removed from Home.tsx
- keepNames removed from vite config

### Sprint 2 ✅ (4 items)
- Comment reactions (like/fire/dislike toggle) - backend done
- Price alerts (table + endpoints + poll engine checking) - backend done
- Sentiment preview on Home (last 3 comments)
- Portfolio summary (merged with Sprint 1)

### Sprint 3 ✅ (5 items)
- DB indexes on dividends, matches, news, notifications
- Portfolio snapshots pruning (7d/hourly/daily)
- Vite manual chunk splitting
- Casino race condition: in-flight lock + withUserLock
- Casino dark theme: dark class on wrappers

### Sprint 4 🟡 (1/3 items)
- Casino game history table + endpoint ✅
- Daily challenges - NOT STARTED
- routers.ts decomposition - NOT STARTED

## Still TODO
- Wire recordCasinoGameResult into game resolution points
- Daily/weekly challenges system
- routers.ts split into modules
- Trade markers on candlestick chart
- Comment reactions frontend UI
- Price alerts frontend UI
- Casino → Trading withdrawal

## Key Gotchas (unchanged)
- libSQL: no .returning(), use select after insert
- Map iteration: Array.from(map.entries())
- Drizzle SQL types as {} — cast with String()
- clearInterval doesn't accept null
- Spectator API: by-summoner/{puuid} (NOT by-puuid)
- Casino deposit rate: 10x
- Casino in-flight lock: acquireCasinoLock in checkCasinoCooldown
