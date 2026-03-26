# $DORI LP Tracker — AI Coding Assistant Onboarding

> **Start here**: Read `CLAUDE_CONTEXT.md` for full project context, required reading list, and critical rules.
> This file is a quick reference. For rules, see `AGENTS.md`. For deep guides, see `.claude/skills/`.

## Project Overview
Real-time League of Legends rank tracking app with trading platform and casino games. Users bet on a player's performance, trade ETFs based on rank changes, and play casino games with virtual currency.

**Tech Stack:**
- Frontend: React 19 + Vite + Tailwind 4 + shadcn/ui + wouter (routing) + tRPC client
- Backend: Express + tRPC 11 + SQLite (libSQL) + Drizzle ORM
- Deployment: Frontend on Vercel, backend on Railway
- Data: Riot Games API (30s polling), price snapshots every 5min

**Live Flow:**
1. Poll engine hits Riot API every 30s for active game + match history
2. Spectator API confirms in-game status → market halts trading
3. Match completion → price update → dividend payouts → betting resolution → Discord notifications
4. Casino games run independently with separate balance ($20 start vs $200 trading cash)

---

## Architecture

### Frontend (`client/src/`)
```
pages/          # Route components (Home, Casino, Blackjack, Leaderboard, etc.)
components/     # Reusable UI (TradingPanel, CandlestickChart, StyledName, NavBar)
  ui/           # shadcn primitives (button, dialog, toast, etc.)
contexts/       # React contexts (Theme, Language, Ticker)
lib/trpc.ts     # tRPC client setup
```

**Routing:** wouter with lazy-loaded routes (see `App.tsx`)
**State:** tRPC React Query hooks (`api.portfolio.get.useQuery()`)
**Styling:** Tailwind 4 + dark theme default + framer-motion animations
**Toasts:** sonner library (`toast.success()`, `toast.error()`)

### Backend (`server/`)
```
_core/          # Express app, tRPC setup, middleware
routers.ts      # All tRPC routes (auth, trading, casino, admin)
db.ts           # Database functions (Drizzle queries + raw SQL)
pollEngine.ts   # 30s Riot API polling loop
riotApi.ts      # Riot API wrappers
etfPricing.ts   # ETF price computation (DORI, DDRI, TDRI, SDRI, XDRI)
blackjack.ts    # Blackjack game engine (in-memory state)
mines.ts        # Mines game engine
crash.ts        # Crash game engine
roulette.ts     # Roulette game engine
videoPoker.ts   # Video poker engine
seedCosmetics.ts # Cosmetics shop data (titles, name effects)
discord.ts      # Discord webhook notifications
cache.ts        # In-memory cache for ETF prices, leaderboard
```

### Database (`drizzle/`)
```
schema.ts       # Drizzle table definitions (users, portfolios, trades, bets, etc.)
migrations/*.sql # Auto-generated migration files
```

**SQLite quirks:**
- `.returning()` NOT supported by libSQL → use `db.select()` after insert
- Timestamps stored as ISO strings: `DEFAULT (datetime('now'))`
- Booleans stored as integers (0/1)

---

## Directory Structure

### Key Files
- `/home/ayoun/lol-tracker/MEMORY.md` — Architecture notes, technical decisions, gotchas
- `/home/ayoun/lol-tracker/FEATURES.md` — Feature changelog
- `/home/ayoun/lol-tracker/package.json` — Dependencies (React 19, Tailwind 4, tRPC 11)
- `/home/ayoun/lol-tracker/client/src/App.tsx` — Route definitions
- `/home/ayoun/lol-tracker/server/routers.ts` — All backend API routes
- `/home/ayoun/lol-tracker/server/db.ts` — Database operations
- `/home/ayoun/lol-tracker/drizzle/schema.ts` — Database schema

### Pages (client/src/pages/)
- `Home.tsx` — Live game status, price chart, trading panel, betting panel
- `Casino.tsx` — Casino landing (game grid, balance, daily bonus, leaderboard)
- `Blackjack.tsx`, `Mines.tsx`, `Crash.tsx`, `Roulette.tsx`, `VideoPoker.tsx` — Casino games
- `Leaderboard.tsx` — Trading + Casino leaderboard tabs
- `Portfolio.tsx` — Holdings, P&L chart, transaction history
- `Ledger.tsx` — Trades + Dividends + Bets tabs
- `AdminDB.tsx`, `AdminSQL.tsx` — Admin tools (DB viewer, raw SQL)

---

## Common Patterns

### Adding a New Page
1. Create `/home/ayoun/lol-tracker/client/src/pages/NewPage.tsx`
2. Add lazy import in `App.tsx`: `const NewPage = lazy(() => import("./pages/NewPage"));`
3. Add route: `<Route path={"/new"} component={NewPage} />`
4. Add nav link in `NavBar.tsx` or `AppNav.tsx`

### Adding a New tRPC Route
1. Open `/home/ayoun/lol-tracker/server/routers.ts`
2. Add to `appRouter` object:
   ```ts
   myNewRoute: protectedProcedure
     .input(z.object({ userId: z.number() }))
     .query(async ({ input }) => {
       const db = getDb();
       return db.select().from(users).where(eq(users.id, input.userId));
     }),
   ```
3. Frontend usage:
   ```ts
   const { data } = api.myNewRoute.useQuery({ userId: 1 });
   ```

### Adding a New Casino Game
1. Create engine file: `/home/ayoun/lol-tracker/server/mygame.ts`
   - Export game state type, in-memory Map, game functions
   - Use pattern from `blackjack.ts` or `mines.ts`
2. Add tRPC routes in `routers.ts`:
   ```ts
   casino: router({
     myGame: router({
       start: protectedProcedure.input(...).mutation(async ({ ctx, input }) => {
         await checkCasinoCooldown(ctx.user.id);
         // Deduct bet from casinoBalance FIRST
         const game = startMyGame(ctx.user.id, input.bet);
         recordCasinoGame(ctx.user.id);
         return game;
       }),
       action: protectedProcedure.mutation(...),
       end: protectedProcedure.mutation(async ({ ctx }) => {
         const result = endMyGame(ctx.user.id);
         // Add payout to casinoBalance
         await updateCasinoBalance(ctx.user.id, result.payout);
         // Invalidate leaderboard cache
         cache.delete("casino_leaderboard");
         return result;
       }),
     }),
   }),
   ```
3. Create page: `/home/ayoun/lol-tracker/client/src/pages/MyGame.tsx`
4. Add route in `App.tsx`: `<Route path={"/casino/mygame"} component={MyGame} />`
5. Add to casino landing grid in `Casino.tsx`

### Adding a New Cosmetic Effect
1. Open `/home/ayoun/lol-tracker/server/seedCosmetics.ts`
2. Add to `items` array:
   ```ts
   { type: "nameEffect", name: "Fire Glow", tier: "rare", price: 50,
     css: "fire_glow", desc: "Blazing name" }
   ```
3. Open `/home/ayoun/lol-tracker/client/src/components/StyledName.tsx`
4. Add to `EFFECT_STYLES` registry:
   ```ts
   "fire_glow": {
     style: {
       background: "linear-gradient(to right, #f97316, #dc2626)",
       WebkitBackgroundClip: "text",
       WebkitTextFillColor: "transparent",
       filter: "drop-shadow(0 0 12px rgba(239,68,68,0.7))",
       display: "inline-block",
     },
   },
   ```
5. Add to `getEffectKey()` function:
   ```ts
   if (lower.includes("fire") && lower.includes("glow")) return "fire_glow";
   ```

---

## Common Pitfalls

### 1. TDZ Error: `Cannot access 't' before initialization`
**Problem:** Variable name collision in Drizzle SQL templates.
```ts
// BAD — 't' collides with Drizzle internal variable
const t = await db.select()...
```
**Fix:** Use different variable name (`row`, `result`, `user`, etc.)

### 2. Tailwind JIT Not Purging Dynamic Classes
**Problem:** DB strings like `"text-red-500 font-bold"` won't be compiled by Tailwind JIT.
**Fix:** Use inline styles for dynamic effects (see `StyledName.tsx` pattern) or add to safelist in `tailwind.config.js`.

### 3. Set/Map Iteration Needs `Array.from()`
**Problem:** `for (const [k, v] of map.entries())` fails in esbuild downlevelIteration.
**Fix:** Always wrap in `Array.from()`:
```ts
for (const [k, v] of Array.from(map.entries())) { ... }
```

### 4. `clearInterval` Doesn't Accept `null`
**Problem:** `clearInterval(null)` throws in strict mode.
**Fix:** Guard with conditional or use local variable:
```ts
let timer: NodeJS.Timeout | null = null;
if (timer) clearInterval(timer);
```

### 5. Drizzle Schema Sync Issues
**Problem:** New columns added manually to DB don't match Drizzle schema → type errors.
**Fix:** Use raw SQL for queries on new columns until schema is regenerated:
```ts
const client = getRawClient();
const result = await client.execute({
  sql: `SELECT cooldownSeconds FROM casino_cooldowns WHERE userId = ?`,
  args: [userId]
});
```

### 6. `useRef` Initial Value Required
**Problem:** `useRef()` without initial value causes type errors.
**Fix:** Always provide initial value:
```ts
const chartRef = useRef<IChartApi | null>(null);
```

---

## Database

### Tech Stack
- **SQLite** via libSQL (Turso/Railway)
- **ORM:** Drizzle (type-safe queries)
- **Raw SQL:** Used for complex queries (leaderboard, new columns)

### Key Tables
- `users` — Auth, role, displayName
- `portfolios` — cashBalance, casinoBalance, totalDividends
- `holdings` — shares, shortShares per ticker
- `trades` — buy/sell/short/cover/dividend transactions
- `bets` — WIN/LOSS game bets
- `dividends` — Dividend payout history
- `matches` — Match results from Riot API
- `priceHistory` — LP snapshots over time
- `cosmetic_items`, `user_cosmetics`, `user_equipped` — Shop system

### Patterns

**Insert (no `.returning()`):**
```ts
const [inserted] = await db.insert(users).values({ ... });
const user = await db.select().from(users).where(eq(users.id, inserted.lastInsertRowid));
```

**Raw SQL (complex queries):**
```ts
import { getRawClient } from "./db";
const client = getRawClient();
const result = await client.execute({
  sql: `SELECT * FROM users WHERE role = ?`,
  args: ["admin"]
});
// Access: result.rows[0].columnName (cast types manually)
```

**Cache Invalidation:**
```ts
import { cache } from "./cache";
cache.delete("etf_prices");
cache.delete("casino_leaderboard");
```

---

## Casino System

### Balance Separation
- **Trading cash:** `portfolios.cashBalance` ($200 start)
- **Casino cash:** `portfolios.casinoBalance` ($20 start)
- Daily bonus: $1/day via cache-based cooldown

### Game Pattern (In-Memory State)
1. User starts game → deduct bet from `casinoBalance` FIRST
2. Game state stored in `Map<userId, GameState>`
3. User actions mutate in-memory state
4. Game ends → add payout to `casinoBalance`, invalidate leaderboard cache
5. Stale cleanup: delete games older than 30min every 5-10min

**Example (Blackjack):**
```ts
// server/blackjack.ts
const activeGames = new Map<number, BlackjackGame>();

export function dealGame(userId: number, bet: number) {
  const deck = createDeck();
  const game = { id: ..., userId, bet, deck, playerHand: [...], dealerHand: [...], status: "playing" };
  activeGames.set(userId, game);
  return game;
}
```

### Casino Cooldown (Optional)
- Per-user cooldown stored in `casino_cooldowns` table
- Checked via `checkCasinoCooldown(userId)` before each game
- Tracked in-memory via `casinoLastGameTime` Map

### Leaderboard
- **Trading:** Top 20 by total portfolio value (cash + holdings + short P&L)
- **Casino:** Top 20 by `casinoBalance`
- Cached for 30s, invalidated on balance changes

---

## Cosmetics System

### Types
- **Titles:** Badges next to name (e.g., "High Roller", "Casino Royale")
- **Name Effects:** Gradient/animated text styles (e.g., "rainbow", "molten")

### Database
- `cosmetic_items` — Shop inventory (type, name, tier, price, cssClass)
- `user_cosmetics` — Purchased items per user
- `user_equipped` — Currently equipped title + name effect

### Rendering
**StyledName Component:**
- Reads `nameEffectCss` from DB
- Maps to `EFFECT_STYLES` registry (inline styles, NOT Tailwind classes)
- Renders gradient/glow/animation via inline CSS

**Why Inline Styles?**
Tailwind JIT can't compile dynamic class strings from DB. Registry pattern ensures all effects are defined at build time.

**Adding Effects:** See "Adding a New Cosmetic Effect" above.

---

## Testing

### No Local `node_modules`
- Development env lacks local `node_modules` (cloud-based)
- Cannot run `npm test` or `npm run dev` locally
- **Verify changes:** Deploy to Railway/Vercel and test live

### Deployment
- **Backend:** Railway (auto-deploy on push to main)
- **Frontend:** Vercel (auto-deploy on push to main)
- **Database:** libSQL (Turso) or Railway SQLite

### Manual Testing Checklist
1. Deploy backend → check Railway logs for errors
2. Deploy frontend → open app in browser
3. Test flow: login → trade → casino game → check leaderboard
4. Check Discord webhook (if testing notifications)
5. Use AdminSQL page to inspect DB state

---

## Code Style

### Naming Conventions
- **tRPC routes:** camelCase (`api.portfolio.get`, `api.casino.blackjack.start`)
- **Components:** PascalCase (`TradingPanel.tsx`, `StyledName.tsx`)
- **Database functions:** camelCase (`getUserHoldings`, `executeTrade`)
- **Constants:** UPPER_SNAKE_CASE (`THIRTY_MIN`, `TICKERS`)

### UI Patterns
- **Dark theme:** Default, bg-background, text-foreground
- **Animations:** framer-motion (`<motion.div>`, variants)
- **Toasts:** `toast.success("Message")`, `toast.error("Error")`
- **Forms:** react-hook-form + zod validation
- **Loading states:** Spinner from `lucide-react` (`<Loader2 className="animate-spin" />`)

### i18n Support
- Korean language toggle in `LanguageContext.tsx`
- Use `t()` helper for strings in some components
- Not fully implemented — mostly English

### Formatting
- Prettier: 2 spaces, no semicolons (optional), trailing commas
- ESLint: TypeScript strict mode
- File structure: group imports (React → libs → local)

---

## Key Dependencies

**Frontend:**
- `react` 19, `react-dom` 19
- `@tanstack/react-query` — tRPC client state
- `wouter` — Client-side routing
- `tailwindcss` 4, `@tailwindcss/vite` — Styling
- `framer-motion` — Animations
- `sonner` — Toast notifications
- `lucide-react` — Icons
- `lightweight-charts` — Candlestick chart
- `recharts` — Line/area charts
- `shadcn/ui` — UI primitives (@radix-ui/*)

**Backend:**
- `express` — HTTP server
- `@trpc/server` 11 — API layer
- `drizzle-orm` — Database ORM
- `@libsql/client` — SQLite driver
- `zod` — Schema validation
- `bcryptjs` — Password hashing
- `axios` — Riot API calls
- `dotenv` — Environment variables

**Dev:**
- `vite` — Frontend bundler
- `esbuild` — Backend bundler
- `tsx` — TypeScript execution
- `drizzle-kit` — Database migrations
- `vitest` — Testing (not used locally)

---

## Quick Reference

### Add a Feature
1. Read `MEMORY.md` + `FEATURES.md` for context
2. Check existing patterns in similar files
3. Update schema if DB changes (`drizzle/schema.ts` → `pnpm db:push`)
4. Add tRPC route in `routers.ts`
5. Create/update page component
6. Test via deployment (no local testing)

### Debug Common Issues
- **Type error:** Check Drizzle schema sync, use raw SQL if needed
- **Tailwind class not working:** Use inline styles for dynamic classes
- **tRPC error:** Check input validation (zod schema), backend logs
- **Cache stale:** Invalidate via `cache.delete(key)`
- **Game state lost:** Check in-memory Map, verify cleanup interval

### Access Patterns
- **User data:** `ctx.user` (available in `protectedProcedure`)
- **DB client:** `getDb()` for Drizzle, `getRawClient()` for raw SQL
- **Cache:** `cache.get(key)`, `cache.set(key, value, ttl)`
- **Casino balance:** `updateCasinoBalance(userId, amount)`
- **Trading balance:** `executeTrade()`, `executeShort()`, `executeCover()`

---

**End of Onboarding Doc**
This file is optimized for AI coding assistants. Read it first when working on this codebase.
