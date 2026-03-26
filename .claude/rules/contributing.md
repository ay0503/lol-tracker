# Contributing Rules — $DORI LP Tracker

Enforce these rules in every code change. Non-negotiable.

---

## Code Rules (MUST follow)

### 1. Never use 't' as parameter/lambda name
esbuild minification causes TDZ errors with `const { t } = useTranslation()`.
Use descriptive names: `item`, `entry`, `row`, `game`.

### 2. Always use Array.from() for Set/Map iteration
```ts
// WRONG
for (const [k, v] of map.entries()) {}

// CORRECT
for (const [k, v] of Array.from(map.entries())) {}
```

### 3. useRef must have initial value
```ts
// WRONG
const ref = useRef<number>();

// CORRECT
const ref = useRef<number | null>(null);
```

### 4. No self-referencing query options — use callback form
```ts
// WRONG — TDZ error
const { data } = api.foo.useQuery(undefined, {
  refetchInterval: data?.active ? 15000 : 120000,
});

// CORRECT
const query = api.foo.useQuery(undefined, {
  refetchInterval: (q) => q.state.data?.active ? 15000 : 120000,
});
```

### 5. Dynamic CSS from DB must use inline styles, not Tailwind classes
Tailwind JIT does not generate classes from DB strings. Use the StyledName registry pattern with `EFFECT_STYLES` and `getEffectKey()`.

### 6. All casino pages must include GamblingDisclaimer component
```tsx
import GamblingDisclaimer from "@/components/GamblingDisclaimer";
// Render <GamblingDisclaimer /> at the bottom of every casino page.
```

### 7. All user-facing text must support Korean
```tsx
{language === "ko" ? "베팅하기" : "Place Bet"}
```

### 8. Casino balance: always parseFloat with fallback
```ts
const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
```

### 9. After balance changes, always invalidate casino leaderboard cache
```ts
cache.invalidate("casino.leaderboard");
```

### 10. New DB tables use raw SQL via getRawClient(), not Drizzle migrations
Drizzle migrations are unreliable. Use `getRawClient().execute()` for schema changes and complex queries.

### 11. No .returning() — libSQL does not support it
Insert first, then SELECT to get the row back.

### 12. clearInterval must be null-guarded
```ts
if (timerRef.current) clearInterval(timerRef.current);
```

---

## PR Rules (MUST check before submitting)

1. **No TypeScript errors** — run `tsc --noEmit`, zero errors required.
2. **No console.log in client code** — server-side logging is OK.
3. **Commit messages follow pattern** — `Verb noun: description` (e.g., `Fix casino leaderboard: use raw SQL instead of Drizzle`).
4. **Always commit + push** — never leave unpushed commits.

---

## Architecture Rules

1. **New casino games:** engine in `server/{game}.ts` (pure logic, no DB), UI in `client/src/pages/{Game}.tsx`. Dynamic-import engines in router.
2. **New routes** go inside existing router sections (`casino`, `trading`, `admin`, etc.), not at top level.
3. **Cosmetic effects** use StyledName registry (`EFFECT_STYLES` + `getEffectKey()`), not raw CSS classes. Add `@keyframes` to `client/src/index.css` if needed.
4. **Keep files self-contained** to minimize merge conflicts. One game = one engine file + one page file.

---

## Pre-Commit Checklist

- [ ] No variable/param named `t`
- [ ] Set/Map iteration uses `Array.from()`
- [ ] `useRef` has initial value
- [ ] Query options use callback form (no self-reference)
- [ ] Dynamic cosmetics use inline styles registry
- [ ] Casino pages include `<GamblingDisclaimer />`
- [ ] All UI text supports Korean
- [ ] Casino balance uses `parseFloat(... ?? "20.00")`
- [ ] `cache.invalidate("casino.leaderboard")` after balance changes
- [ ] New tables use `getRawClient()`, not Drizzle migrations
- [ ] No `.returning()` calls
- [ ] `clearInterval()` is null-guarded
- [ ] No `console.log` in client code
- [ ] `tsc --noEmit` passes
- [ ] Commit message: `Verb noun: description`
- [ ] Changes are committed AND pushed
