# Common Pitfalls & Known Issues — $DORI LP Tracker

This document catalogs all production bugs, TS errors, and patterns that have caused failures. **Read this before making changes.**

---

## CRITICAL — Will Break Production

### 1. NEVER use 't' as a variable/parameter name

**Why:** esbuild minification merges scopes and reuses variable names, creating Temporal Dead Zone (TDZ) conflicts with `const { t } = useTranslation()`. Even with `keepNames: true` in vite.config, 't' should be avoided entirely.

**Applies to:** Lambda params, function params, loop variables, destructuring, reduce callbacks, array methods.

**BAD:**
```tsx
// Lambda param
TICKERS.find((t) => t.ticker === selectedTicker)

// Function param
function getTiers(t: TranslationFunction) { ... }

// Loop variable
for (const t of tables) { ... }

// Reduce callback
tables.reduce((sum, t) => sum + t.rows, 0)

// Map iteration
tables.map((t) => ({ name: t.name }))
```

**GOOD:**
```tsx
// Use tk, tr, tbl, tv instead
TICKERS.find((tk) => tk.ticker === selectedTicker)

function getTiers(tr: TranslationFunction) { ... }

for (const tbl of tables) { ... }

tables.reduce((sum, tbl) => sum + tbl.rows, 0)

tables.map((tbl) => ({ name: tbl.name }))
```

**History:** Fixed in commits `10604b4`, `6f18c55`, `adf6b95`. The bug manifested as runtime error: `Cannot access 't' before initialization`.

---

### 2. Dynamic Tailwind classes from DB don't render

**Why:** Tailwind's JIT compiler only sees classes that appear in source code at build time. Database strings like `"bg-gradient-to-r from-orange-500 to-pink-500"` are never compiled.

**Solution:** Use inline styles via a static registry pattern (see `/home/ayoun/lol-tracker/client/src/components/StyledName.tsx`).

**BAD:**
```tsx
// This gradient class won't render — it's from the DB
<span className={nameEffect.cssClass}>
  {player.name}
</span>
```

**GOOD:**
```tsx
// Static registry maps DB strings to inline styles
const EFFECT_STYLES: Record<string, { className?: string; style?: CSSProperties }> = {
  "sunset": {
    style: {
      background: "linear-gradient(to right, #f97316, #ec4899)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 8px rgba(251,146,60,0.5))",
      display: "inline-block",
    },
  },
  // ... more effects
};

function StyledName({ nameEffectCss }: Props) {
  const effectKey = getEffectKey(nameEffectCss); // Maps DB string to registry key
  const effect = effectKey ? EFFECT_STYLES[effectKey] : null;
  return (
    <span className={effect?.className} style={effect?.style}>
      {name}
    </span>
  );
}
```

**Note:** Simple color classes like `text-red-500` work fine because they're common Tailwind patterns.

---

### 3. Self-referencing query options cause TDZ

**Why:** Using the query result in its own options object creates a temporal dead zone error.

**BAD:**
```tsx
const { data: liveGame } = trpc.player.liveGame.useQuery(undefined, {
  refetchInterval: liveGame?.inGame ? 15_000 : 120_000, // TDZ: liveGame not initialized yet
});
```

**GOOD:**
```tsx
// Use callback form with query state
const liveGameQuery = trpc.player.liveGame.useQuery(undefined, {
  refetchInterval: (query) => query.state.data?.inGame ? 15_000 : 120_000,
  staleTime: 60_000,
});
const liveGame = liveGameQuery.data;
```

**History:** Fixed in commit `adf6b95` for `Home.tsx` event query.

---

## IMPORTANT — Will Cause TS Errors

### 4. `.returning()` not supported by libSQL

**Why:** libSQL (Turso) doesn't support Drizzle's `.returning()` clause.

**BAD:**
```ts
const [row] = await db.insert(portfolios).values({ userId, cashBalance: "200.00" }).returning();
```

**GOOD:**
```ts
await db.insert(portfolios).values({ userId, cashBalance: "200.00" });
const [row] = await db.select().from(portfolios).where(eq(portfolios.userId, userId));
```

**Reference:** MEMORY.md line 10.

---

### 5. Set/Map iteration requires `Array.from()`

**Why:** TypeScript's `downlevelIteration` is not enabled, so direct iteration over Set/Map fails in production builds.

**BAD:**
```ts
for (const [userId, time] of casinoLastGameTime.entries()) { ... } // TS error

for (const cfId of closeFriendIds) { ... } // TS error (Set)

return champMap.entries().map(([name, s]) => ...) // TS error
```

**GOOD:**
```ts
for (const [userId, time] of Array.from(casinoLastGameTime.entries())) { ... }

for (const cfId of Array.from(closeFriendIds)) { ... }

return Array.from(champMap.entries()).map(([name, s]) => ...)
```

**Examples:** `/home/ayoun/lol-tracker/server/routers.ts` lines 44, 290, 331, 1222, 1725.

**Reference:** MEMORY.md line 11.

---

### 6. `useRef<number>()` needs initial value

**Why:** TypeScript requires explicit initial value for non-undefined ref types.

**BAD:**
```tsx
const animRef = useRef<number>(); // TS error: Expected 1 argument
```

**GOOD:**
```tsx
const animRef = useRef<number | undefined>(undefined);
```

**History:** Fixed in commit `adf6b95` for `Crash.tsx`.

---

### 7. `clearInterval(null)` is not allowed

**Why:** TypeScript doesn't accept `null` for `clearInterval()`. Guard with null check or use local variable pattern.

**BAD:**
```tsx
const timerRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  return () => clearInterval(timerRef.current); // TS error if current is null
}, []);
```

**GOOD:**
```tsx
// Pattern 1: Guard with null check
if (timerRef.current) clearInterval(timerRef.current);

// Pattern 2: Local variable (used in pollEngine.ts)
let pollTimer: NodeJS.Timeout | null = null;

export function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// Pattern 3: Double guard (used in Blackjack.tsx)
if (timerRef.current) {
  if (timerRef.current) clearInterval(timerRef.current);
  timerRef.current = null;
}
```

**Reference:** MEMORY.md line 13.

---

## GOOD TO KNOW

### 8. Casino balance is a string in DB

**Why:** SQLite stores decimals as text to avoid floating-point precision issues.

**Always use:**
```ts
const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
```

**Examples:** Found throughout `/home/ayoun/lol-tracker/server/routers.ts` (lines 774, 841, 899, 958, 987, 1030, 1045, 1074, 1093, 1133, 1174, 1187, 1270, 1440).

---

### 9. Cache invalidation after balance changes

**Why:** Casino leaderboard is cached and must be invalidated whenever `casinoBalance` changes.

**Always call after updating casino balance:**
```ts
cache.invalidate("casino.leaderboard");
```

**Examples:** After bet placement, cashout, daily bonus claim, cosmetic purchases — see `/home/ayoun/lol-tracker/server/routers.ts` lines 787, 806, 822, 850, 865, 882, 927, 974, 1007, 1033, 1062, 1099, 1147, 1281, 1302, 2011.

---

### 10. Korean i18n support

All user-facing strings must have Korean translations in i18n config. Use the `t()` function from `useTranslation()` for all UI text.

```tsx
const { t } = useTranslation();

// BAD
<button>Place Bet</button>

// GOOD
<button>{t("betting.placeBet")}</button>
```

---

### 11. esbuild duplicate variable names

**Why:** esbuild's minifier catches duplicate variable names in the same scope, even if JavaScript allows it.

**BAD:**
```ts
const portfolio = await getOrCreatePortfolio(userId);
const portfolio = await getOrCreatePortfolio(anotherUserId); // Error
```

**GOOD:**
```ts
const portfolio = await getOrCreatePortfolio(userId);
const portfolio2 = await getOrCreatePortfolio(anotherUserId);
```

**Reference:** MEMORY.md line 14.

---

### 12. Raw SQL for new tables — Use `getRawClient()` pattern

**Why:** Drizzle schema migrations are unreliable for adding new columns/tables to existing production DB. Raw SQL via libSQL client avoids schema sync issues.

**Pattern (from `casino_daily_claims`):**
```ts
import { getRawClient } from "./db";

// Query
const client = getRawClient();
const result = await client.execute({
  sql: `SELECT * FROM casino_daily_claims WHERE userId = ?`,
  args: [userId]
});

// Insert/Update
await client.execute({
  sql: `INSERT INTO casino_daily_claims (userId, lastClaim) VALUES (?, ?)
        ON CONFLICT(userId) DO UPDATE SET lastClaim = ?`,
  args: [userId, today, today]
});
```

**Used for:** Casino leaderboard queries, daily claims, cosmetics system.

**Reference:** MEMORY.md lines 15-16, `cosmetics-plan.md`.

---

### 13. Drizzle SQL expressions type as `{}`

**Why:** Drizzle's type inference for SQL expressions returns `{}` instead of `string`.

**Solution:** Cast with `String()` wrapper.

```ts
// Type returned is { userName: {} } instead of { userName: string }
const result = await db.select({ userName: sql`users.name` }).from(users);

// Fix: cast in mapping
return result.map(r => ({
  userName: String(r.userName || "Anonymous")
}));
```

**Reference:** MEMORY.md line 12.

---

## Prevention Checklist

Before committing, verify:

- [ ] No variable/param named `t` anywhere (use `tr`, `tk`, `tbl`, `tv`)
- [ ] Dynamic cosmetic classes use inline styles registry, not className
- [ ] Query options don't reference their own data (use callback form)
- [ ] Set/Map iteration uses `Array.from()`
- [ ] `useRef<number>()` has initial value
- [ ] `clearInterval()` calls are null-guarded
- [ ] Casino balance uses `parseFloat(... ?? "20.00")`
- [ ] `cache.invalidate("casino.leaderboard")` after balance changes
- [ ] All user-facing strings use `t()` function
- [ ] New tables use `getRawClient()` not Drizzle schema
- [ ] No `.returning()` calls with libSQL

---

## File References

Key files demonstrating these patterns:

- `/home/ayoun/lol-tracker/MEMORY.md` — Technical decisions reference
- `/home/ayoun/lol-tracker/vite.config.ts` — esbuild keepNames setting (line 25)
- `/home/ayoun/lol-tracker/client/src/components/StyledName.tsx` — Inline styles registry pattern
- `/home/ayoun/lol-tracker/server/routers.ts` — Array.from() Set iteration (lines 44, 290, 331, 1222, 1725)
- `/home/ayoun/lol-tracker/client/src/pages/Home.tsx` — TDZ callback pattern (lines 141, 232)
- `/home/ayoun/lol-tracker/client/src/pages/Crash.tsx` — useRef initial value pattern
- `/home/ayoun/lol-tracker/server/pollEngine.ts` — clearInterval null guard pattern (lines 724-727)
