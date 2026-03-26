# Rules for AI Coding Agents

This file contains strict rules for AI agents (Codex, Claude Code, Cursor, etc.) working on the $DORI LP Tracker codebase. These rules prevent production bugs and type errors.

---

## BEFORE Making Any Change

1. **Read CLAUDE.md** for project overview and architecture
2. **Read .claude/skills/pitfalls.md** for known issues and bugs
3. **If touching casino code** → read .claude/skills/casino-guide.md
4. **Check existing patterns** in similar files before creating new code

---

## NEVER Do These (Will Break Production)

### 1. Use 't' as variable/parameter name
**Why:** esbuild minification causes Temporal Dead Zone (TDZ) conflicts with `const { t } = useTranslation()`

**Forbidden:**
```ts
// Lambda params
TICKERS.find((t) => t.ticker === ticker)
tables.map((t) => t.name)
tables.reduce((sum, t) => sum + t.rows, 0)

// Function params
function getTiers(t: TranslationFunction) { }

// Loop variables
for (const t of tables) { }

// Destructuring
const { t } = someObject;
```

**Use instead:** `tk`, `tr`, `tbl`, `tv`, `row`, `item`, `entry`

### 2. Use dynamic Tailwind classes from database
**Why:** Tailwind JIT compiler only sees classes in source code at build time

**Forbidden:**
```tsx
<span className={dbRecord.cssClass}>{name}</span>
```

**Use instead:** Inline styles via static registry (see `client/src/components/StyledName.tsx`)

### 3. Use `.returning()` on Drizzle queries
**Why:** libSQL doesn't support `.returning()` clause

**Forbidden:**
```ts
const [row] = await db.insert(users).values({...}).returning();
```

**Use instead:**
```ts
await db.insert(users).values({...});
const [row] = await db.select().from(users).where(eq(users.id, userId));
```

### 4. Iterate Set/Map without Array.from()
**Why:** `downlevelIteration` not enabled in TypeScript config

**Forbidden:**
```ts
for (const [k, v] of map.entries()) { }
for (const item of set) { }
champMap.entries().map(([name, s]) => ...)
```

**Use instead:**
```ts
for (const [k, v] of Array.from(map.entries())) { }
for (const item of Array.from(set)) { }
Array.from(champMap.entries()).map(([name, s]) => ...)
```

### 5. Use useRef without initial value
**Forbidden:**
```tsx
const ref = useRef<number>();
```

**Use instead:**
```tsx
const ref = useRef<number | undefined>(undefined);
const chartRef = useRef<IChartApi | null>(null);
```

### 6. Self-reference query data in query options
**Why:** Creates TDZ error

**Forbidden:**
```tsx
const { data: liveGame } = api.player.liveGame.useQuery(undefined, {
  refetchInterval: liveGame?.inGame ? 15_000 : 120_000, // TDZ
});
```

**Use instead:**
```tsx
const liveGameQuery = api.player.liveGame.useQuery(undefined, {
  refetchInterval: (query) => query.state.data?.inGame ? 15_000 : 120_000,
});
const liveGame = liveGameQuery.data;
```

### 7. Leave console.log in client code
**Why:** Production logs should go through proper error tracking

**Remove all** `console.log()`, `console.warn()` before committing. Use `toast.error()` for user-facing errors.

### 8. Call clearInterval with null
**Forbidden:**
```tsx
clearInterval(timerRef.current); // TS error if current is null
```

**Use instead:**
```tsx
if (timerRef.current) clearInterval(timerRef.current);
```

---

## ALWAYS Do These

### Casino-Specific Rules

1. **Include GamblingDisclaimer** on all casino game pages:
   ```tsx
   import { GamblingDisclaimer } from "@/components/GamblingDisclaimer";

   return (
     <div>
       {/* game UI */}
       <GamblingDisclaimer />
     </div>
   );
   ```

2. **Parse casino balance as float:**
   ```ts
   const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
   ```

3. **Invalidate cache after balance changes:**
   ```ts
   cache.invalidate("casino.leaderboard");
   ```
   Call this after: bet placement, cashout, daily bonus claim, cosmetic purchase

4. **Check casino cooldown before starting game:**
   ```ts
   await checkCasinoCooldown(ctx.user.id);
   ```

### i18n Support

5. **Support Korean language:**
   ```tsx
   language === "ko" ? "한국어 텍스트" : "English text"
   ```
   All user-facing strings must have Korean translations.

### Code Quality

6. **Use Array.from() for Map/Set iteration** (see rule #4 above)

7. **Commit AND push** (never leave work unpushed):
   ```bash
   git add .
   git commit -m "message"
   git push
   ```

8. **Read existing patterns** before creating new files:
   - Casino game engines: `server/blackjack.ts`, `server/mines.ts`
   - Casino pages: `client/src/pages/Blackjack.tsx`
   - Shared components: `client/src/components/StyledName.tsx`

---

## File Naming Conventions

| Type | Location | Example |
|------|----------|---------|
| Casino game engine | `server/{game}.ts` | `server/roulette.ts` |
| Casino page | `client/src/pages/{Game}.tsx` | `client/src/pages/Roulette.tsx` |
| Shared component | `client/src/components/{Name}.tsx` | `client/src/components/TradingPanel.tsx` |
| UI primitive | `client/src/components/ui/{name}.tsx` | `client/src/components/ui/button.tsx` |
| Hook | `client/src/hooks/use{Name}.ts` | `client/src/hooks/useBalance.ts` |
| tRPC router | `server/routers.ts` | (all routes in one file) |
| Database schema | `drizzle/schema.ts` | (all tables in one file) |

---

## Commit Message Format

Use conventional commits style:

```
Add feature: short description
Fix issue: short description
Refactor: short description
Casino landing v2: daily bonus, inline leaderboard, compact game grid
```

**Examples from git log:**
- `Fix casino leaderboard: use raw SQL instead of Drizzle schema query`
- `Casino landing v2: daily bonus, inline leaderboard, compact game grid`
- `Casino fixes: leaderboard cache invalidation, admin balance reset, game selector`

---

## Pre-Commit Checklist

Before committing, verify:

- [ ] No variable/param named `t` anywhere (grep for `(t)`, `(t,`, ` t `, `const t`)
- [ ] No dynamic Tailwind classes from DB (check StyledName registry)
- [ ] No `.returning()` calls with libSQL
- [ ] All Set/Map iteration uses `Array.from()`
- [ ] All `useRef<T>()` have initial values
- [ ] All `clearInterval()` calls are null-guarded
- [ ] Casino balance uses `parseFloat(... ?? "20.00")`
- [ ] `cache.invalidate("casino.leaderboard")` after balance changes
- [ ] All casino pages include `<GamblingDisclaimer />`
- [ ] No `console.log()` in client code
- [ ] Korean translations exist for new UI strings
- [ ] Changes tested via deployment (no local testing available)

---

## Tech Stack Quick Reference

**Frontend:**
- React 19 + Vite + Tailwind 4 + wouter (routing)
- tRPC client + React Query
- shadcn/ui components (@radix-ui/*)
- sonner (toasts), framer-motion (animations)

**Backend:**
- Express + tRPC 11
- SQLite (libSQL) + Drizzle ORM
- Raw SQL via `getRawClient()` for new tables

**Key patterns:**
- No local `node_modules` → deploy to test changes
- Frontend on Vercel, backend on Railway
- 30s Riot API polling loop
- In-memory casino game state (Map)
- Cache invalidation for leaderboards

---

## Emergency Debugging

If build breaks:

1. Check for 't' variable collision (search codebase)
2. Check for missing `Array.from()` on Set/Map
3. Check for `.returning()` on Drizzle queries
4. Check vite.config.ts: `keepNames: true` in esbuild
5. Read Railway/Vercel logs for runtime errors
6. Use AdminSQL page to inspect DB state

---

**End of Rules**

Read this file completely before making changes. Follow every rule strictly to avoid production bugs.
