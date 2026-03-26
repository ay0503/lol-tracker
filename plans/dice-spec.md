# Dice Game - Complete Implementation Specification

**Game Type:** Instant resolution (Roulette pattern)
**Estimated Time:** 2 hours
**House Edge:** 1% (configurable)

---

## Game Rules

### Mechanics
- Player sets a **target number** between 1.00 and 99.00 (inclusive)
- Player chooses **Roll Over** or **Roll Under**
- Server generates a random number between **0.00 and 99.99** (two decimal places)
- **Roll Over:** Win if `result > target`
- **Roll Under:** Win if `result < target`

### Payout Calculation
The multiplier adjusts based on win probability to maintain a 1% house edge:

- **Roll Over:** `multiplier = 99 / (99 - target)`
- **Roll Under:** `multiplier = 99 / target`
- House edge applied: `payout = bet × multiplier × 0.99`

### Examples
| Target | Direction | Win Chance | Multiplier (before edge) | Multiplier (1% edge) |
|--------|-----------|------------|-------------------------|---------------------|
| 50.00  | Over      | 49.99%     | 1.98x                   | 1.96x               |
| 75.00  | Over      | 24.99%     | 3.96x                   | 3.92x               |
| 25.00  | Under     | 25.00%     | 3.96x                   | 3.92x               |
| 10.00  | Under     | 10.00%     | 9.90x                   | 9.80x               |
| 90.00  | Over      | 9.99%      | 9.91x                   | 9.81x               |

---

## Server Implementation

### File: `server/dice.ts`

```typescript
/**
 * Dice game engine — server-side logic.
 * Player sets a target (1.00-99.00) and rolls over/under.
 * 1% house edge.
 */

const MAX_PAYOUT = 250;
const HOUSE_EDGE = 0.01;

// ─── Type Definitions ───

export type DiceDirection = 'over' | 'under';

export interface DiceBet {
  target: number; // 1.00 - 99.00
  direction: DiceDirection;
  amount: number;
}

export interface DiceResult {
  roll: number; // 0.00 - 99.99
  bet: DiceBet;
  won: boolean;
  payout: number;
  multiplier: number;
  winChance: number; // percentage for display
  timestamp: number;
}

export interface DiceHistory {
  roll: number;
  won: boolean;
  timestamp: number;
}

// ─── In-Memory Storage ───

const recentResults: DiceHistory[] = [];
const MAX_HISTORY = 20;

// ─── Helper Functions ───

/**
 * Calculate the multiplier based on target and direction.
 * Formula ensures fair odds with 1% house edge.
 */
function calculateMultiplier(target: number, direction: DiceDirection): number {
  let rawMultiplier: number;

  if (direction === 'over') {
    // Win if roll > target
    // Win range: (target, 99.99]
    // Win probability: (99.99 - target) / 100
    rawMultiplier = 99 / (99 - target);
  } else {
    // Win if roll < target
    // Win range: [0.00, target)
    // Win probability: target / 100
    rawMultiplier = 99 / target;
  }

  return rawMultiplier * (1 - HOUSE_EDGE);
}

/**
 * Calculate win probability percentage for display.
 */
function calculateWinChance(target: number, direction: DiceDirection): number {
  if (direction === 'over') {
    return ((99 - target) / 100) * 100;
  } else {
    return (target / 100) * 100;
  }
}

// ─── Main Game Function ───

export function rollDice(bet: DiceBet): DiceResult {
  // Validate target range
  if (bet.target < 1 || bet.target > 99) {
    throw new Error("Target must be between 1.00 and 99.00");
  }

  // Generate roll: 0.00 to 99.99 (two decimal places)
  const roll = Math.floor(Math.random() * 10000) / 100;

  // Determine win
  const won = bet.direction === 'over'
    ? roll > bet.target
    : roll < bet.target;

  // Calculate multiplier and payout
  const multiplier = calculateMultiplier(bet.target, bet.direction);
  const rawPayout = won ? bet.amount * multiplier : 0;
  const payout = Math.min(rawPayout, MAX_PAYOUT);

  const result: DiceResult = {
    roll: Math.round(roll * 100) / 100, // Ensure 2 decimals
    bet,
    won,
    payout: Math.round(payout * 100) / 100,
    multiplier: Math.round(multiplier * 100) / 100,
    winChance: Math.round(calculateWinChance(bet.target, bet.direction) * 100) / 100,
    timestamp: Date.now(),
  };

  // Store in history
  recentResults.unshift({
    roll: result.roll,
    won,
    timestamp: Date.now()
  });
  if (recentResults.length > MAX_HISTORY) recentResults.pop();

  return result;
}

export function getHistory(): DiceHistory[] {
  return recentResults;
}
```

**Lines of code:** ~100

---

## Router Integration

### File: `server/routers.ts`

Add inside `casino: router({ ... })` (around line 938, after roulette):

```typescript
    dice: router({
      roll: protectedProcedure
        .input(z.object({
          target: z.number().min(1).max(99).finite(),
          direction: z.enum(['over', 'under']),
          amount: z.number().min(0.10).finite(),
        }))
        .mutation(async ({ ctx, input }) => {
          // 1. Cooldown check
          await checkCasinoCooldown(ctx.user.id);

          // 2. Balance check
          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
          if (input.amount > casinoCash) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.`,
            });
          }

          // 3. Deduct bet
          const db = await getDb();
          await db.update(portfolios)
            .set({ casinoBalance: (casinoCash - input.amount).toFixed(2) })
            .where(eq(portfolios.userId, ctx.user.id));

          // 4. Roll dice
          const { rollDice } = await import("./dice");
          const result = rollDice({
            target: input.target,
            direction: input.direction,
            amount: input.amount,
          });

          // 5. Credit winnings
          if (result.payout > 0) {
            const freshPortfolio = await getOrCreatePortfolio(ctx.user.id);
            const newCasino = parseFloat(freshPortfolio.casinoBalance ?? "0") + result.payout;
            await db.update(portfolios)
              .set({ casinoBalance: newCasino.toFixed(2) })
              .where(eq(portfolios.userId, ctx.user.id));
          }

          // 6. Record activity and invalidate cache
          recordCasinoGame(ctx.user.id);
          cache.invalidate("casino.leaderboard");

          return result;
        }),
      history: publicProcedure.query(async () => {
        const { getHistory } = await import("./dice");
        return getHistory();
      }),
    }),
```

---

## Client Implementation

### File: `client/src/pages/Dice.tsx`

```tsx
import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Dices } from "lucide-react";
import AppNav from "@/components/AppNav";
import CasinoSubNav from "@/components/CasinoSubNav";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";

// ─── Chip Values & Colors ───
const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0.50: { bg: "from-red-400 to-red-600",     border: "border-red-300/50",     text: "text-white" },
  1:    { bg: "from-gray-100 to-gray-300",    border: "border-gray-200/50",    text: "text-gray-800" },
  5:    { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50",  text: "text-black" },
  10:   { bg: "from-blue-400 to-blue-600",    border: "border-blue-300/50",    text: "text-white" },
  25:   { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", text: "text-white" },
  50:   { bg: "from-purple-400 to-purple-600",   border: "border-purple-300/50",  text: "text-white" },
};

export default function Dice() {
  const { language } = useTranslation();
  const { isAuthenticated, user } = useAuth();

  // ─── State ───
  const [selectedChip, setSelectedChip] = useState(1);
  const [target, setTarget] = useState(50);
  const [direction, setDirection] = useState<'over' | 'under'>('over');
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [animatedRoll, setAnimatedRoll] = useState<number | null>(null);

  // ─── Queries ───
  const balance = trpc.portfolio.balances.useQuery(undefined, { enabled: isAuthenticated });
  const history = trpc.casino.dice.history.useQuery(undefined, {
    refetchInterval: 5000,
    enabled: isAuthenticated,
  });
  const utils = trpc.useUtils();

  // ─── Calculate multiplier and win chance ───
  const winChance = direction === 'over'
    ? ((99 - target) / 100) * 100
    : (target / 100) * 100;

  const rawMultiplier = direction === 'over'
    ? 99 / (99 - target)
    : 99 / target;

  const multiplier = rawMultiplier * 0.99; // 1% house edge

  // ─── Mutations ───
  const rollMutation = trpc.casino.dice.roll.useMutation({
    onSuccess: (data) => {
      utils.portfolio.balances.invalidate();
      utils.casino.dice.history.invalidate();
      setResult(data);

      // Animate roll
      setIsRolling(true);
      let counter = 0;
      const interval = setInterval(() => {
        setAnimatedRoll(Math.random() * 100);
        counter++;
        if (counter > 20) {
          clearInterval(interval);
          setAnimatedRoll(data.roll);
          setTimeout(() => {
            setIsRolling(false);
            if (data.won) {
              toast.success(`Won $${data.payout.toFixed(2)}! (${data.multiplier.toFixed(2)}x)`);
            } else {
              toast.error("Better luck next time");
            }
          }, 500);
        }
      }, 50);
    },
    onError: (err) => {
      toast.error(err.message);
      setIsRolling(false);
    },
  });

  // ─── Handlers ───
  const handleRoll = useCallback(() => {
    if (!isAuthenticated) {
      toast.error("Sign in to play");
      return;
    }
    setResult(null);
    setAnimatedRoll(null);
    rollMutation.mutate({
      target,
      direction,
      amount: selectedChip,
    });
  }, [isAuthenticated, target, direction, selectedChip, rollMutation]);

  const casinoCash = balance.data?.casinoBalance ?? 20;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      <AppNav />
      <CasinoSubNav />

      {/* ─── Header ─── */}
      <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800 py-4">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/casino">
              <button className="p-2 hover:bg-zinc-800 rounded-lg transition">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <Dices className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold">{language === "ko" ? "주사위" : "Dice"}</h1>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg">
            <span className="text-xs text-zinc-400">Casino Cash</span>
            <span className="font-bold text-green-400">${casinoCash.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6 max-w-2xl">

        {/* ─── Game Area ─── */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-8">

          {/* Roll Display */}
          <div className="flex items-center justify-center min-h-[200px]">
            <AnimatePresence mode="wait">
              {animatedRoll !== null ? (
                <motion.div
                  key="rolling"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="text-center"
                >
                  <div
                    className={`text-7xl font-bold font-[var(--font-mono)] ${
                      result?.won === true
                        ? "text-green-400"
                        : result?.won === false
                        ? "text-red-400"
                        : "text-blue-400"
                    }`}
                  >
                    {animatedRoll.toFixed(2)}
                  </div>
                  {result && !isRolling && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4"
                    >
                      <div className={`text-xl font-bold ${result.won ? "text-green-400" : "text-red-400"}`}>
                        {result.won ? "WIN" : "LOSS"}
                      </div>
                      <div className="text-sm text-zinc-400 mt-1">
                        Target: {direction === 'over' ? '>' : '<'} {target.toFixed(2)}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-zinc-500"
                >
                  <Dices className="w-20 h-20 mx-auto mb-4 opacity-20" />
                  <p className="text-sm">Set target and roll</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Target Slider */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-zinc-300">
                {language === "ko" ? "목표 숫자" : "Target Number"}
              </label>
              <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-lg">
                <input
                  type="number"
                  value={target}
                  onChange={(e) => setTarget(Math.max(1, Math.min(99, parseFloat(e.target.value) || 1)))}
                  className="w-16 bg-transparent text-right font-[var(--font-mono)] text-sm focus:outline-none"
                  min="1"
                  max="99"
                  step="0.01"
                />
              </div>
            </div>
            <input
              type="range"
              min="1"
              max="99"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(parseFloat(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Over/Under Toggle */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => setDirection('over')}
              className={`py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                direction === 'over'
                  ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              {language === "ko" ? "높음" : "Roll Over"}
            </button>
            <button
              onClick={() => setDirection('under')}
              className={`py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                direction === 'under'
                  ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              {language === "ko" ? "낮음" : "Roll Under"}
            </button>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
              <div className="text-xs text-zinc-400 mb-1">Multiplier</div>
              <div className="text-lg font-bold text-blue-400 font-[var(--font-mono)]">
                {multiplier.toFixed(2)}x
              </div>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
              <div className="text-xs text-zinc-400 mb-1">Win Chance</div>
              <div className="text-lg font-bold text-purple-400 font-[var(--font-mono)]">
                {winChance.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* ─── Chip Selector ─── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-zinc-300">Select Chip</span>
            <span className="text-xs text-zinc-500">Balance: ${casinoCash.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Object.entries(CHIP_COLORS).map(([val, colors]) => {
              const value = parseFloat(val);
              const active = selectedChip === value;
              return (
                <button
                  key={value}
                  onClick={() => setSelectedChip(value)}
                  disabled={value > casinoCash}
                  className={`
                    relative flex items-center justify-center aspect-square rounded-full
                    border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed
                    ${active ? "scale-110 shadow-lg border-white" : "border-transparent hover:scale-105"}
                  `}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg} rounded-full border-4 ${colors.border}`} />
                  <span className={`relative z-10 font-bold ${colors.text} text-sm`}>
                    ${value}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Roll Button ─── */}
        <button
          onClick={handleRoll}
          disabled={isRolling || !isAuthenticated}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-zinc-700 disabled:to-zinc-800 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg disabled:shadow-none"
        >
          {isRolling ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Rolling...
            </span>
          ) : (
            `Roll $${selectedChip.toFixed(2)}`
          )}
        </button>

        {/* ─── Recent Results ─── */}
        {history?.data && history.data.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Recent Rolls</h3>
            <div className="flex gap-1.5 flex-wrap">
              {history.data.slice(0, 15).map((h, i) => (
                <div
                  key={i}
                  className={`px-2.5 py-1 rounded-lg text-xs font-[var(--font-mono)] font-bold ${
                    h.won
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}
                >
                  {h.roll.toFixed(2)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Disclaimer ─── */}
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
```

**Lines of code:** ~320

---

## Integration Steps

### 1. App.tsx Routes

Add after the poker route (around line 58):

```tsx
<Route path={"/casino/dice"} component={Dice} />
```

Also add the lazy import at the top with other casino games:

```tsx
const Dice = lazy(() => import("./pages/Dice"));
```

### 2. Casino.tsx Game Grid

Add to the `GAMES` array (around line 14):

```tsx
{
  id: "dice",
  title: "Dice",
  titleKo: "주사위",
  emoji: "🎲",
  desc: "Roll over or under target",
  descKo: "목표 숫자 맞추기",
  bet: "$0.10 – $5",
  href: "/casino/dice",
  active: true,
  bg: "from-blue-950/50 to-cyan-900/30",
  border: "border-blue-700/40",
  badge: "from-blue-500 to-cyan-600"
},
```

---

## Testing Checklist

### Server Tests
- [ ] Target validation (1-99 range)
- [ ] Direction validation (over/under)
- [ ] Roll generation (0.00-99.99 range)
- [ ] Win condition: Roll Over (roll > target)
- [ ] Win condition: Roll Under (roll < target)
- [ ] Multiplier calculation accuracy
- [ ] MAX_PAYOUT cap ($250)
- [ ] History storage (max 20 entries)

### Client Tests
- [ ] Slider range (1-99)
- [ ] Number input sync with slider
- [ ] Over/Under toggle
- [ ] Live multiplier updates as target changes
- [ ] Live win chance updates as target changes
- [ ] Roll animation (rapid number changes)
- [ ] Win/loss color coding (green/red)
- [ ] Balance deduction
- [ ] Payout credit
- [ ] Recent results display
- [ ] Cooldown enforcement
- [ ] Insufficient balance error

### Edge Cases
- [ ] Target = 1 (Under = 1% win chance, 98x mult)
- [ ] Target = 99 (Over = 0.99% win chance, 99x mult)
- [ ] Target = 50 (balanced 50/50 odds)
- [ ] Roll = 50.00, Target = 50.00, Over → Loss
- [ ] Roll = 50.00, Target = 50.00, Under → Loss
- [ ] Multiple rapid rolls (cooldown)

---

## Game Balance Analysis

### House Edge Verification

**Formula:** For a fair game, `Expected Value = -house_edge × bet`

**Roll Over (Target = 50):**
- Win chance: 49.99%
- Multiplier: 1.98 × 0.99 = 1.96x
- EV = 0.4999 × 1.96 - 0.5001 = -0.01 ✓ (1% house edge)

**Roll Under (Target = 25):**
- Win chance: 25%
- Multiplier: 3.96 × 0.99 = 3.92x
- EV = 0.25 × 3.92 - 0.75 = -0.01 ✓ (1% house edge)

### Risk Profile
- **Low variance:** Balanced targets (40-60) → 1.5x-2.5x multipliers
- **High variance:** Extreme targets (1-10, 90-99) → 10x-99x multipliers
- **MAX_PAYOUT protection:** Limits max loss to $250 per roll

---

## Future Enhancements (Optional)

1. **Auto-bet:** Set number of rolls with same settings
2. **Hot/Cold numbers:** Track most/least common roll ranges
3. **Presets:** Quick buttons for 25/50/75 targets
4. **Sound effects:** Roll animation audio
5. **Provably fair:** Show hash verification for roll result
6. **Leaderboard:** Highest single win, most consecutive wins
7. **Achievements:** "100 rolls", "Win on 1% chance", etc.

---

## File Summary

| File | Purpose | LoC |
|------|---------|-----|
| `server/dice.ts` | Game engine, RNG, history | ~100 |
| `server/routers.ts` | TRPC router (dice.roll, dice.history) | ~50 |
| `client/src/pages/Dice.tsx` | UI, slider, animation | ~320 |
| `client/src/App.tsx` | Route + lazy import | ~2 |
| `client/src/pages/Casino.tsx` | Game grid entry | ~1 |

**Total new code:** ~473 lines

---

## Implementation Time Breakdown

| Task | Time |
|------|------|
| Server engine (`dice.ts`) | 30 min |
| Router integration (`routers.ts`) | 15 min |
| Client UI (slider, toggle, stats) | 45 min |
| Roll animation | 15 min |
| Testing + bug fixes | 15 min |
| **Total** | **2 hours** |

---

## Dependencies

**No new dependencies required.** Uses existing stack:
- Framer Motion (animations)
- Zod (validation)
- TRPC (API)
- Tailwind (styling)

---

## Notes

- **Instant resolution:** No active game state (like Roulette)
- **Simple RNG:** `Math.random()` sufficient (no complex physics)
- **Mobile-friendly:** Slider + large buttons work well on touch
- **Low complexity:** Simplest game after Coin Flip
- **High replayability:** Easy to adjust target/direction for next roll

---

## Risk Assessment

**Technical Risk:** **LOW**
- Pure math, no complex algorithms
- Pattern already proven (Roulette instant game)
- No external dependencies

**Balance Risk:** **LOW**
- Math verified: 1% house edge for all targets
- MAX_PAYOUT prevents catastrophic wins

**UX Risk:** **LOW**
- Slider is intuitive, familiar pattern
- Live multiplier feedback helps players understand odds

---

## Success Metrics

After launch, track:
1. **Adoption:** % of casino users who try Dice
2. **Retention:** Average rolls per session
3. **House edge:** Actual vs theoretical (should converge to 1%)
4. **Popular targets:** Distribution of target selections
5. **Win rate:** Should be close to calculated probabilities

---

**Status:** Ready for implementation
**Blockers:** None
**Next Steps:** Create `server/dice.ts` → Add router → Build UI → Test → Ship
