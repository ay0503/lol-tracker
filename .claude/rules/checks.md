# Pre-Commit Automated Checks

This document defines automated checks AI tools should run before committing code to prevent production bugs and TypeScript errors.

Run ALL checks before committing. If any check fails, fix the issue before proceeding.

---

## CRITICAL CHECKS — Will Break Production

### 1. Variable Name Check: No 't' Parameters

**Why:** esbuild minification creates Temporal Dead Zone conflicts with `const { t } = useTranslation()`.

**Check:**
```bash
# Check for 't' in lambda/function parameters
grep -rn '\(t\)' client/src/ --include="*.tsx" --include="*.ts" | grep -E '\.(map|find|filter|reduce|forEach|some|every)\(\(t\)' && echo "FAIL: Found 't' in lambda params" || echo "PASS"

grep -rn '\(t,' client/src/ --include="*.tsx" --include="*.ts" | grep -E '\.(map|find|filter|reduce|forEach|some|every)\(\(t,' && echo "FAIL: Found 't' as first param" || echo "PASS"

grep -rn 'function.*\bt\b.*:' client/src/ server/ --include="*.tsx" --include="*.ts" | grep -v 'useTranslation\|const { t' && echo "FAIL: Found 't' in function params" || echo "PASS"

grep -rn 'for.*\bt\b.*of' client/src/ server/ --include="*.tsx" --include="*.ts" | grep -v 'const { t' && echo "FAIL: Found 't' in for-of loops" || echo "PASS"
```

**Action if FAIL:**
- Rename parameter to `tk`, `tr`, `tbl`, `tv`, or other meaningful name
- Never use single letter 't' anywhere in code

**References:** pitfalls.md #1

---

### 2. Self-Referencing Query Check

**Why:** Using query result in its own options object creates TDZ error.

**Check:**
```bash
# Find useQuery with refetchInterval/staleTime that might reference the query data
grep -rn 'const { data:.*} = .*useQuery' client/src/ --include="*.tsx" -A5 | grep -E 'refetchInterval:|staleTime:' | grep -v '(query)' && echo "FAIL: Potential self-reference in query options" || echo "PASS"
```

**Action if FAIL:**
- Use callback form: `refetchInterval: (query) => query.state.data?.inGame ? 15_000 : 120_000`
- Store query result separately: `const liveGameQuery = trpc.player.liveGame.useQuery(...)`

**References:** pitfalls.md #3

---

## IMPORTANT CHECKS — Will Cause TS Errors

### 3. Set/Map Iteration Check

**Why:** TypeScript's `downlevelIteration` is not enabled; direct iteration fails in production.

**Check:**
```bash
# Find Set/Map iteration without Array.from()
grep -rn 'for.*of.*\.entries()' server/ client/src/ --include="*.ts" --include="*.tsx" | grep -v 'Array.from' | grep -v 'Object\.' && echo "FAIL: Map.entries() without Array.from()" || echo "PASS"

grep -rn 'for.*of.*\.values()' server/ client/src/ --include="*.ts" --include="*.tsx" | grep -v 'Array.from' | grep -v 'Object\.' && echo "FAIL: Map.values() without Array.from()" || echo "PASS"

grep -rn 'for.*of.*\.keys()' server/ client/src/ --include="*.ts" --include="*.tsx" | grep -v 'Array.from' | grep -v 'Object\.' && echo "FAIL: Map.keys() without Array.from()" || echo "PASS"

# Check for .map() on Set/Map iterators
grep -rn '\.entries()\.map\|\.values()\.map\|\.keys()\.map' server/ client/src/ --include="*.ts" --include="*.tsx" | grep -v 'Array.from' && echo "FAIL: Iterator.map() without Array.from()" || echo "PASS"
```

**Action if FAIL:**
- Wrap with `Array.from()`: `for (const [k, v] of Array.from(map.entries())) { ... }`
- For chaining: `Array.from(map.entries()).map(([k, v]) => ...)`

**References:** pitfalls.md #5

---

### 4. useRef Initial Value Check

**Why:** TypeScript requires explicit initial value for typed refs.

**Check:**
```bash
# Find useRef with type but no initial value
grep -rn 'useRef<[^>]*>()' client/src/ --include="*.tsx" --include="*.ts" | grep -v 'undefined\|null' && echo "FAIL: useRef without initial value" || echo "PASS"
```

**Action if FAIL:**
- Add initial value: `useRef<number | undefined>(undefined)` or `useRef<NodeJS.Timeout | null>(null)`

**References:** pitfalls.md #6

---

### 5. clearInterval Null Guard Check

**Why:** TypeScript doesn't accept `null` for `clearInterval()`.

**Check:**
```bash
# Find clearInterval without null guard
grep -rn 'clearInterval(' client/src/ server/ --include="*.tsx" --include="*.ts" -B2 | grep -v 'if.*current\|if.*timer' | grep 'clearInterval' && echo "WARN: clearInterval may need null guard" || echo "PASS"
```

**Action if FAIL:**
- Add null guard: `if (timerRef.current) clearInterval(timerRef.current);`

**References:** pitfalls.md #7

---

### 6. libSQL .returning() Check

**Why:** libSQL/Turso doesn't support Drizzle's `.returning()` clause.

**Check:**
```bash
# Find .returning() usage
grep -rn '\.returning()' server/ --include="*.ts" && echo "FAIL: libSQL doesn't support .returning()" || echo "PASS"
```

**Action if FAIL:**
- Remove `.returning()` and query separately:
  ```ts
  await db.insert(table).values(data);
  const [row] = await db.select().from(table).where(eq(table.id, id));
  ```

**References:** pitfalls.md #4

---

## GOOD TO KNOW CHECKS

### 7. Casino Balance Parse Check

**Why:** SQLite stores decimals as text; must parse before arithmetic.

**Check:**
```bash
# Find casinoBalance usage without parseFloat
grep -rn 'casinoBalance' server/routers.ts | grep -v 'parseFloat\|String\|UPDATE\|SET\|INSERT' | grep -E '[\+\-\*/]|bet|wager|amount' && echo "WARN: casinoBalance may need parseFloat()" || echo "PASS"
```

**Action if WARN:**
- Use: `const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");`

**References:** pitfalls.md #8

---

### 8. Cache Invalidation Check

**Why:** Casino leaderboard is cached and must be invalidated after balance changes.

**Check:**
```bash
# Find casinoBalance updates and check for nearby invalidation
echo "Checking for casinoBalance updates that may need cache invalidation..."

# This is a manual review check - show all casinoBalance update locations
grep -rn 'casinoBalance.*=' server/routers.ts | grep -E 'UPDATE|SET|casinoCash|balance.*=' | head -20

echo ""
echo "Verify each update has cache.invalidate('casino.leaderboard') within 5-10 lines"
```

**Action if missing:**
- Add after any casinoBalance update: `cache.invalidate("casino.leaderboard");`

**Manual verification required:** Check that invalidation occurs after:
- Bet placement
- Cashouts
- Daily bonus claims
- Cosmetic purchases
- Admin balance resets

**References:** pitfalls.md #9

---

### 9. GamblingDisclaimer Check (Casino Pages Only)

**Why:** All casino game pages must display the gambling disclaimer component.

**Check:**
```bash
# Check each casino page for GamblingDisclaimer import and usage
for file in client/src/pages/Blackjack.tsx client/src/pages/Mines.tsx client/src/pages/Crash.tsx client/src/pages/Roulette.tsx client/src/pages/Casino.tsx client/src/pages/CasinoShop.tsx; do
  if [ -f "$file" ]; then
    if ! grep -q "GamblingDisclaimer" "$file"; then
      echo "FAIL: $file missing GamblingDisclaimer"
    fi
  fi
done
```

**Action if FAIL:**
- Import: `import { GamblingDisclaimer } from "../components/GamblingDisclaimer";`
- Add to JSX: `<GamblingDisclaimer />`

---

### 10. Korean i18n Check

**Why:** All user-facing strings must support Korean translation.

**Check:**
```bash
# Find JSX with hardcoded English strings (heuristic)
grep -rn '<button>' client/src/pages/ client/src/components/ --include="*.tsx" | grep -v '{t(' | head -10 && echo "WARN: Found hardcoded button text" || echo "PASS"

grep -rn '<h1>' client/src/pages/ --include="*.tsx" | grep -v '{t(' | head -10 && echo "WARN: Found hardcoded heading text" || echo "PASS"
```

**Action if WARN:**
- Use translation function: `{t("key.path")}`
- Add translation keys to i18n config

**References:** pitfalls.md #10

---

### 11. Duplicate Variable Name Check

**Why:** esbuild minifier catches duplicate variable names even if JavaScript allows it.

**Check:**
```bash
# Look for common duplicate patterns
grep -rn 'const portfolio.*=' server/ --include="*.ts" | awk -F: '{print $1}' | sort | uniq -d | while read f; do
  echo "WARN: $f has multiple 'portfolio' declarations - check for duplicates"
done
```

**Action if WARN:**
- Rename second variable: `const portfolio2 = ...`

**References:** pitfalls.md #11

---

### 12. Dynamic Tailwind Class Check

**Why:** Tailwind JIT only compiles classes in source code; DB strings won't render.

**Check:**
```bash
# Find className props that use database values
grep -rn 'className={.*\.css\|className={.*effect' client/src/ --include="*.tsx" | grep -v 'EFFECT_STYLES\|style=' && echo "WARN: Dynamic className may not render" || echo "PASS"
```

**Action if WARN:**
- Use inline styles registry pattern (see `client/src/components/StyledName.tsx`)
- Map DB strings to static `style` objects

**References:** pitfalls.md #2

---

## Quick Pre-Commit Script

Run all critical checks in sequence:

```bash
#!/bin/bash
cd /home/ayoun/lol-tracker

FAIL_COUNT=0

echo "=== RUNNING PRE-COMMIT CHECKS ==="
echo ""

# Check 1: No 't' parameters
echo "[1/6] Checking for 't' parameters..."
if grep -rn '\(t\)' client/src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -qE '\.(map|find|filter|reduce|forEach|some|every)\(\(t\)'; then
  echo "  FAIL: Found 't' in lambda params"
  grep -rn '\(t\)' client/src/ --include="*.tsx" --include="*.ts" | grep -E '\.(map|find|filter|reduce|forEach|some|every)\(\(t\)'
  FAIL_COUNT=$((FAIL_COUNT+1))
else
  echo "  PASS"
fi

# Check 2: Set/Map iteration
echo "[2/6] Checking Set/Map iteration..."
if grep -rn 'for.*of.*\.entries()\|for.*of.*\.values()\|for.*of.*\.keys()' server/ client/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -qv 'Array.from\|Object\.'; then
  echo "  FAIL: Map/Set iteration without Array.from()"
  grep -rn 'for.*of.*\.entries()\|for.*of.*\.values()\|for.*of.*\.keys()' server/ client/src/ --include="*.ts" --include="*.tsx" | grep -v 'Array.from\|Object\.'
  FAIL_COUNT=$((FAIL_COUNT+1))
else
  echo "  PASS"
fi

# Check 3: useRef initial value
echo "[3/6] Checking useRef initial values..."
if grep -rn 'useRef<[^>]*>()' client/src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -qv 'undefined\|null'; then
  echo "  FAIL: useRef without initial value"
  grep -rn 'useRef<[^>]*>()' client/src/ --include="*.tsx" --include="*.ts" | grep -v 'undefined\|null'
  FAIL_COUNT=$((FAIL_COUNT+1))
else
  echo "  PASS"
fi

# Check 4: .returning() usage
echo "[4/6] Checking for .returning() usage..."
if grep -rqn '\.returning()' server/ --include="*.ts" 2>/dev/null; then
  echo "  FAIL: libSQL doesn't support .returning()"
  grep -rn '\.returning()' server/ --include="*.ts"
  FAIL_COUNT=$((FAIL_COUNT+1))
else
  echo "  PASS"
fi

# Check 5: Self-referencing queries
echo "[5/6] Checking for self-referencing queries..."
if grep -rn 'const { data:.*} = .*useQuery' client/src/ --include="*.tsx" -A5 2>/dev/null | grep -qE 'refetchInterval:|staleTime:'; then
  echo "  WARN: Manual review needed for query self-references"
else
  echo "  PASS"
fi

# Check 6: Casino pages GamblingDisclaimer
echo "[6/6] Checking GamblingDisclaimer in casino pages..."
MISSING_DISCLAIMER=0
for file in client/src/pages/Blackjack.tsx client/src/pages/Mines.tsx client/src/pages/Crash.tsx client/src/pages/Roulette.tsx; do
  if [ -f "$file" ] && ! grep -q "GamblingDisclaimer" "$file" 2>/dev/null; then
    echo "  FAIL: $file missing GamblingDisclaimer"
    MISSING_DISCLAIMER=1
  fi
done
if [ $MISSING_DISCLAIMER -eq 0 ]; then
  echo "  PASS"
fi

echo ""
if [ $FAIL_COUNT -eq 0 ]; then
  echo "=== ALL CHECKS PASSED ==="
  exit 0
else
  echo "=== $FAIL_COUNT CHECK(S) FAILED -- fix before committing ==="
  exit 1
fi
```

---

## Usage

Before committing:
```bash
bash /home/ayoun/lol-tracker/.claude/rules/run-checks.sh
```

For AI tools: Parse this document and execute each check command. Halt commit if any FAIL result occurs.
