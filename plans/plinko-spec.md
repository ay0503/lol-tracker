# Plinko Implementation Specification

**Game Type:** Instant Resolution (Roulette pattern)
**Complexity:** High (physics animation)
**Estimated Time:** 8 hours
**Created:** 2026-03-26

---

## Overview

Plinko is a physics-based casino game where a ball drops from the top through rows of pegs, bouncing left or right at each peg, and lands in one of 13 buckets at the bottom with different multipliers. The game features three risk levels (Low, Medium, High) with different multiplier distributions.

### Key Features
- 12 rows of pegs → 13 buckets at bottom
- Ball bounces left/right at each peg (50/50 random)
- Three risk levels with different multiplier distributions
- Animated ball path following server-determined bounces
- Higher cap: MAX_PAYOUT = 500 (due to 110x potential)
- House edge: ~2-3% (built into multiplier distributions)

---

## Game Rules

### Basic Mechanics
1. Player selects bet amount and risk level (Low/Medium/High)
2. Ball drops from center top
3. At each of 12 rows, ball bounces left or right (random 50/50)
4. Ball lands in one of 13 buckets at bottom
5. Multiplier depends on bucket and risk level

### Risk Levels & Multipliers

**Low Risk** (conservative, lower variance):
```
[5.6x, 2.1x, 1.4x, 1.1x, 1x, 0.5x, 0.3x, 0.5x, 1x, 1.1x, 1.4x, 2.1x, 5.6x]
```
- Center buckets: 0.3x-1x (safer)
- Edges: up to 5.6x
- RTP: ~97%

**Medium Risk** (balanced):
```
[13x, 3x, 1.5x, 1x, 0.5x, 0.3x, 0.3x, 0.3x, 0.5x, 1x, 1.5x, 3x, 13x]
```
- Center buckets: 0.3x (high risk in middle)
- Edges: up to 13x
- RTP: ~97%

**High Risk** (high variance, big wins or big losses):
```
[110x, 41x, 10x, 5x, 3x, 1.5x, 0.5x, 1.5x, 3x, 5x, 10x, 41x, 110x]
```
- Center: 0.5x (likely loss)
- Edges: 110x (rare but huge)
- RTP: ~97%

### House Edge
- Achieved through multiplier distribution averaging to ~0.97-0.98 RTP
- Higher variance on High risk (big wins/losses), lower on Low risk

---

## Server Implementation

### File: `server/plinko.ts`

```typescript
/**
 * Plinko game engine — server-side logic.
 * Ball drops through 12 rows of pegs, landing in 1 of 13 buckets.
 * Three risk levels with different multiplier distributions.
 */

const MAX_PAYOUT = 500; // Higher cap for Plinko (110x possible)
const ROWS = 12;

export type RiskLevel = 'low' | 'medium' | 'high';

// Multiplier distributions (13 buckets, symmetric)
const MULTIPLIERS: Record<RiskLevel, number[]> = {
  low: [5.6, 2.1, 1.4, 1.1, 1, 0.5, 0.3, 0.5, 1, 1.1, 1.4, 2.1, 5.6],
  medium: [13, 3, 1.5, 1, 0.5, 0.3, 0.3, 0.3, 0.5, 1, 1.5, 3, 13],
  high: [110, 41, 10, 5, 3, 1.5, 0.5, 1.5, 3, 5, 10, 41, 110],
};

// ─── Type Definitions ───
export interface PlinkoBet {
  amount: number;
  risk: RiskLevel;
}

export interface PlinkoResult {
  path: ('L' | 'R')[]; // 12 decisions (L=left, R=right)
  bucket: number; // 0-12 (index into multipliers array)
  multiplier: number;
  bet: PlinkoBet;
  payout: number;
  timestamp: number;
}

export interface PlinkoHistory {
  bucket: number;
  multiplier: number;
  risk: RiskLevel;
  timestamp: number;
}

// ─── In-Memory Storage ───
const recentResults: PlinkoHistory[] = [];
const MAX_HISTORY = 20;

// ─── Game Logic ───
export function play(bet: PlinkoBet): PlinkoResult {
  // Generate ball path: 12 random left/right decisions
  const path: ('L' | 'R')[] = [];
  let position = 6; // Start at center (0-12 scale)

  for (let row = 0; row < ROWS; row++) {
    const goRight = Math.random() > 0.5;
    path.push(goRight ? 'R' : 'L');
    position += goRight ? 0.5 : -0.5;
  }

  // Clamp position to valid bucket range (0-12)
  const bucket = Math.max(0, Math.min(12, Math.round(position)));
  const multiplier = MULTIPLIERS[bet.risk][bucket];
  const rawPayout = bet.amount * multiplier;
  const payout = Math.min(rawPayout, MAX_PAYOUT);

  const result: PlinkoResult = {
    path,
    bucket,
    multiplier,
    bet,
    payout: Math.round(payout * 100) / 100,
    timestamp: Date.now(),
  };

  // Store history
  recentResults.unshift({
    bucket,
    multiplier,
    risk: bet.risk,
    timestamp: Date.now(),
  });
  if (recentResults.length > MAX_HISTORY) recentResults.pop();

  return result;
}

export function getHistory(): PlinkoHistory[] {
  return recentResults;
}
```

**Key Implementation Notes:**
- `path`: Array of 12 'L'/'R' decisions for client animation
- `position`: Tracks horizontal position (0-12), starting at 6 (center)
- Each bounce moves position by ±0.5
- Final position rounded to nearest bucket (0-12)
- MAX_PAYOUT = 500 to cap extreme wins (110x on $5 bet = $550 → capped to $500)

---

## Router Implementation

### File: `server/routers.ts`

Add inside `casino: router({ ... })`:

```typescript
plinko: router({
  drop: protectedProcedure
    .input(z.object({
      amount: z.number().min(0.10).max(5).finite(),
      risk: z.enum(['low', 'medium', 'high']),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkCasinoCooldown(ctx.user.id);

      const portfolio = await getOrCreatePortfolio(ctx.user.id);
      const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
      if (input.amount > casinoCash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.`,
        });
      }

      // Deduct bet
      const db = await getDb();
      await db.update(portfolios)
        .set({ casinoBalance: (casinoCash - input.amount).toFixed(2) })
        .where(eq(portfolios.userId, ctx.user.id));

      // Play game
      const { play } = await import("./plinko");
      const result = play({ amount: input.amount, risk: input.risk });

      // Credit winnings
      if (result.payout > 0) {
        const freshPortfolio = await getOrCreatePortfolio(ctx.user.id);
        const newCasino = parseFloat(freshPortfolio.casinoBalance ?? "0") + result.payout;
        await db.update(portfolios)
          .set({ casinoBalance: newCasino.toFixed(2) })
          .where(eq(portfolios.userId, ctx.user.id));
      }

      recordCasinoGame(ctx.user.id);
      cache.invalidate("casino.leaderboard");

      return result;
    }),
  history: publicProcedure.query(async () => {
    const { getHistory } = await import("./plinko");
    return getHistory();
  }),
}),
```

**Router Pattern:**
- Follows instant game pattern (like Roulette)
- Validates bet amount ($0.10-$5)
- Validates risk level (low/medium/high)
- Standard balance check, deduct, play, credit, record flow

---

## Client Implementation

### File: `client/src/pages/Plinko.tsx`

```tsx
import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import AppNav from "@/components/AppNav";
import CasinoSubNav from "@/components/CasinoSubNav";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";

// ─── Constants ───
const ROWS = 12;
const BUCKETS = 13;
const PEG_SIZE = 8; // pixels
const BALL_SIZE = 12; // pixels
const ROW_HEIGHT = 40; // vertical spacing
const COL_WIDTH = 35; // horizontal spacing

const MULTIPLIERS = {
  low: [5.6, 2.1, 1.4, 1.1, 1, 0.5, 0.3, 0.5, 1, 1.1, 1.4, 2.1, 5.6],
  medium: [13, 3, 1.5, 1, 0.5, 0.3, 0.3, 0.3, 0.5, 1, 1.5, 3, 13],
  high: [110, 41, 10, 5, 3, 1.5, 0.5, 1.5, 3, 5, 10, 41, 110],
};

// Chip colors
const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0.50: { bg: "from-red-400 to-red-600", border: "border-red-300/50", text: "text-white" },
  1: { bg: "from-gray-100 to-gray-300", border: "border-gray-200/50", text: "text-gray-800" },
  5: { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50", text: "text-black" },
};

// Bucket color by multiplier
function getBucketColor(mult: number): string {
  if (mult >= 10) return "bg-gradient-to-t from-yellow-500/80 to-amber-400/80 border-yellow-400";
  if (mult >= 3) return "bg-gradient-to-t from-green-500/80 to-emerald-400/80 border-green-400";
  if (mult >= 1) return "bg-gradient-to-t from-blue-500/80 to-cyan-400/80 border-blue-400";
  if (mult >= 0.5) return "bg-gradient-to-t from-orange-500/80 to-yellow-500/80 border-orange-400";
  return "bg-gradient-to-t from-red-500/80 to-rose-400/80 border-red-400";
}

export default function Plinko() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();

  // ─── State ───
  const [selectedChip, setSelectedChip] = useState(1);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [isPlaying, setIsPlaying] = useState(false);
  const [ballPath, setBallPath] = useState<('L' | 'R')[]>([]);
  const [currentRow, setCurrentRow] = useState(-1);
  const [finalBucket, setFinalBucket] = useState<number | null>(null);
  const [result, setResult] = useState<any>(null);

  // ─── Queries ───
  const balance = trpc.portfolio.balances.useQuery(undefined, { enabled: isAuthenticated });
  const history = trpc.casino.plinko.history.useQuery();
  const utils = trpc.useUtils();

  // ─── Mutations ───
  const dropMutation = trpc.casino.plinko.drop.useMutation({
    onSuccess: (data) => {
      utils.portfolio.balances.invalidate();
      utils.casino.plinko.history.invalidate();
      setResult(data);
      setBallPath(data.path);
      setCurrentRow(0);
      setFinalBucket(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setIsPlaying(false);
    },
  });

  // ─── Ball Animation ───
  useEffect(() => {
    if (currentRow >= 0 && currentRow < ROWS) {
      const timer = setTimeout(() => {
        setCurrentRow(currentRow + 1);
      }, 180); // 180ms per bounce
      return () => clearTimeout(timer);
    } else if (currentRow === ROWS && result) {
      // Animation complete
      setFinalBucket(result.bucket);
      setTimeout(() => {
        if (result.payout > 0) {
          toast.success(`Won $${result.payout.toFixed(2)}! (${result.multiplier}x)`);
        } else {
          toast.error("No win this time");
        }
        setIsPlaying(false);
        setCurrentRow(-1);
        setBallPath([]);
        setFinalBucket(null);
        setResult(null);
      }, 1000);
    }
  }, [currentRow, result]);

  // ─── Handlers ───
  const handleDrop = useCallback(() => {
    if (!isAuthenticated) {
      toast.error("Sign in to play");
      return;
    }
    setIsPlaying(true);
    dropMutation.mutate({ amount: selectedChip, risk });
  }, [isAuthenticated, selectedChip, risk, dropMutation]);

  // ─── Ball Position Calculation ───
  function getBallPosition(row: number): { x: number; y: number } {
    let position = 6; // Start at center (0-12 scale)
    for (let r = 0; r < row; r++) {
      position += ballPath[r] === 'R' ? 0.5 : -0.5;
    }
    const x = position * COL_WIDTH;
    const y = row * ROW_HEIGHT;
    return { x, y };
  }

  const casinoCash = balance.data?.casinoBalance ?? 20;
  const currentMultipliers = MULTIPLIERS[risk];

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
            <h1 className="text-xl font-bold">Plinko</h1>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg">
            <span className="text-xs text-zinc-400">Casino Cash</span>
            <span className="font-bold text-green-400">${casinoCash.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6 max-w-4xl">

        {/* ─── Plinko Board ─── */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 overflow-x-auto">
          <div className="relative mx-auto" style={{ width: BUCKETS * COL_WIDTH, height: ROWS * ROW_HEIGHT + 120 }}>

            {/* Pegs */}
            {Array.from({ length: ROWS }).map((_, row) => {
              const pegsInRow = row + 2; // Row 0 has 2 pegs, row 11 has 13 pegs
              const offsetX = (BUCKETS - pegsInRow) * COL_WIDTH / 2;
              return (
                <div key={row} className="absolute" style={{ top: row * ROW_HEIGHT }}>
                  {Array.from({ length: pegsInRow }).map((_, pegIdx) => (
                    <div
                      key={pegIdx}
                      className="absolute rounded-full bg-zinc-700"
                      style={{
                        width: PEG_SIZE,
                        height: PEG_SIZE,
                        left: offsetX + pegIdx * COL_WIDTH - PEG_SIZE / 2,
                        top: -PEG_SIZE / 2,
                      }}
                    />
                  ))}
                </div>
              );
            })}

            {/* Ball */}
            <AnimatePresence>
              {currentRow >= 0 && currentRow <= ROWS && (
                <motion.div
                  key="ball"
                  className="absolute rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-yellow-500/50"
                  style={{ width: BALL_SIZE, height: BALL_SIZE }}
                  animate={getBallPosition(currentRow)}
                  transition={{ type: "spring", stiffness: 300, damping: 20, duration: 0.15 }}
                />
              )}
            </AnimatePresence>

            {/* Buckets */}
            <div className="absolute flex gap-0.5" style={{ top: ROWS * ROW_HEIGHT + 10, left: 0 }}>
              {currentMultipliers.map((mult, idx) => (
                <div
                  key={idx}
                  className={`relative border-2 rounded-lg flex flex-col items-center justify-center transition-all ${
                    finalBucket === idx
                      ? "border-yellow-400 shadow-lg shadow-yellow-500/50 scale-110"
                      : "border-zinc-700"
                  }`}
                  style={{ width: COL_WIDTH - 2, height: 60 }}
                >
                  <div className={`absolute inset-0 rounded-lg opacity-60 ${getBucketColor(mult)}`} />
                  <span className="relative z-10 text-xs font-bold text-white">{mult}x</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Risk Selector ─── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-zinc-300">Risk Level</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['low', 'medium', 'high'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setRisk(level)}
                disabled={isPlaying}
                className={`py-3 rounded-lg text-sm font-bold transition-all ${
                  risk === level
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 text-center font-mono">
            {risk === 'low' && 'Lower variance • Max 5.6x'}
            {risk === 'medium' && 'Balanced • Max 13x'}
            {risk === 'high' && 'High variance • Max 110x'}
          </div>
        </div>

        {/* ─── Chip Selector ─── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-zinc-300">Select Chip</span>
            <span className="text-xs text-zinc-500">Balance: ${casinoCash.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(CHIP_COLORS).map(([val, colors]) => {
              const value = parseFloat(val);
              const active = selectedChip === value;
              return (
                <button
                  key={value}
                  onClick={() => setSelectedChip(value)}
                  disabled={value > casinoCash || isPlaying}
                  className={`relative flex items-center justify-center aspect-square rounded-full border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                    active ? "scale-110 shadow-lg border-white" : "border-transparent hover:scale-105"
                  }`}
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

        {/* ─── Drop Button ─── */}
        <button
          onClick={handleDrop}
          disabled={isPlaying || !isAuthenticated}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-zinc-700 disabled:to-zinc-800 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg disabled:shadow-none"
        >
          {isPlaying ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Dropping...
            </span>
          ) : (
            `Drop Ball $${selectedChip.toFixed(2)}`
          )}
        </button>

        {/* ─── Recent Results ─── */}
        {history.data && history.data.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Recent Drops</h3>
            <div className="flex gap-1.5 flex-wrap">
              {history.data.slice(0, 15).map((h, i) => (
                <div
                  key={i}
                  className={`px-2 py-1 rounded text-[9px] font-mono font-bold ${getBucketColor(h.multiplier)} border`}
                >
                  {h.multiplier}x
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

**Key Client Features:**
- **Peg Grid**: Rendered with absolute positioning, row 0 has 2 pegs, row 11 has 13 pegs
- **Ball Animation**: `motion.div` with spring transition, follows `path` from server
- **Ball Position**: Calculated from cumulative L/R decisions in `ballPath`
- **Animation Timing**: 180ms per bounce (12 rows × 180ms = ~2.2 seconds total)
- **Bucket Highlighting**: Final bucket lights up when ball lands
- **Color Coding**: Red (< 0.5x), Orange (0.5x), Yellow (1x), Blue (1-3x), Green (3-10x), Gold (10x+)
- **Risk Selector**: Three buttons, updates multiplier display
- **Recent Results**: Shows last 15 drops with multiplier colors

---

## Integration Steps

### 1. App.tsx Route

Add lazy import:
```typescript
const Plinko = lazy(() => import("./pages/Plinko"));
```

Add route:
```typescript
<Route path={"/casino/plinko"} component={Plinko} />
```

### 2. Casino.tsx GAMES Entry

Add to `GAMES` array:
```typescript
{
  id: "plinko",
  title: "Plinko",
  titleKo: "플링코",
  emoji: "⚪",
  desc: "Drop the ball, win big",
  descKo: "공을 떨어뜨려라",
  bet: "$0.10 – $5",
  href: "/casino/plinko",
  active: true,
  bg: "from-purple-950/50 to-violet-900/30",
  border: "border-purple-700/40",
  badge: "from-purple-500 to-violet-600"
},
```

### 3. CasinoSubNav.tsx

Add link (if not dynamic):
```typescript
{ href: "/casino/plinko", label: "Plinko", labelKo: "플링코" },
```

---

## Animation Details

### Ball Path Physics Simulation

The ball animation is the **key feature** of Plinko. Here's how it works:

1. **Server generates path**: 12 random L/R decisions
2. **Client calculates position**: Starting at x=6 (center), each L = -0.5, each R = +0.5
3. **Framer Motion animates**: `motion.div` with spring transition
4. **Timing**: 180ms per row (total ~2.2 seconds)
5. **Visual effect**: Ball appears to bounce off pegs

**Critical Implementation Notes:**
- Use `type: "spring"` for realistic bounce feel
- `stiffness: 300, damping: 20` for snappy but smooth motion
- Each row transition triggers via `useEffect` with `setTimeout`
- Ball size: 12px, Peg size: 8px for visual clarity
- Shadow on ball (`shadow-lg shadow-yellow-500/50`) enhances 3D effect

### Bucket Highlighting

When ball lands:
- Bucket scales to 110% (`scale-110`)
- Border changes to yellow (`border-yellow-400`)
- Shadow appears (`shadow-lg shadow-yellow-500/50`)
- After 1 second, animation resets and result toast shows

---

## Testing Checklist

### Server
- [ ] `play()` generates valid paths (12 L/R decisions)
- [ ] Bucket calculation stays in range 0-12
- [ ] Multipliers applied correctly for each risk level
- [ ] MAX_PAYOUT caps extreme wins
- [ ] History stored correctly (last 20)

### Router
- [ ] Balance check prevents overdraft
- [ ] Bet amount validation ($0.10-$5)
- [ ] Risk level validation (low/medium/high)
- [ ] Payout credited correctly
- [ ] Leaderboard cache invalidated

### Client
- [ ] Peg grid renders correctly (row 0 = 2 pegs, row 11 = 13 pegs)
- [ ] Ball starts at center top
- [ ] Ball follows server path exactly
- [ ] Animation duration ~2-3 seconds
- [ ] Bucket lights up on landing
- [ ] Multipliers update when risk level changes
- [ ] Chip selector works, respects balance
- [ ] Recent results display correctly
- [ ] Mobile responsive (board scales down)

### Edge Cases
- [ ] Insufficient balance shows error
- [ ] Cannot drop while ball is animating
- [ ] Network error during drop refunds bet (handled by mutation error)
- [ ] Extreme position (edge buckets) handled correctly
- [ ] 110x win capped at $500 max payout

---

## Performance Considerations

### Server
- No state storage (instant game)
- O(1) path generation (12 random calls)
- Minimal memory footprint (20 history items)

### Client
- Pegs: 78 DOM elements (sum of 2+3+...+13)
- Optimize with `will-change: transform` on ball
- Use `AnimatePresence` to clean up motion elements
- Consider `useMemo` for peg grid if performance issues

### Animation Optimization
```tsx
// Add to ball motion.div
style={{
  width: BALL_SIZE,
  height: BALL_SIZE,
  willChange: 'transform',
}}
```

---

## Future Enhancements (Optional)

### V2 Features (not in initial spec)
1. **Auto-play**: Drop multiple balls in sequence
2. **Sound effects**: Peg bounce sounds, win chimes
3. **Trail effect**: Motion blur or particle trail behind ball
4. **Statistics**: Show expected RTP, hit frequency per bucket
5. **Custom risk**: Let players design custom multiplier distributions
6. **Provably fair**: Show hash of path seed for verification

### Alternative Implementations
1. **Canvas rendering**: For smoother animation at high frame rates
2. **Physics engine**: Use matter.js for realistic physics (adds 100KB bundle size)
3. **WebGL**: For particle effects and 3D pegs (complexity +++)

---

## File Summary

| File | Lines | Purpose |
|------|-------|---------|
| `server/plinko.ts` | ~80 | Game engine, path generation, multipliers |
| `server/routers.ts` | ~45 | TRPC router (add to casino router) |
| `client/src/pages/Plinko.tsx` | ~350 | Full game UI with animation |
| `client/src/App.tsx` | +2 | Route registration |
| `client/src/pages/Casino.tsx` | +10 | Game card in lobby |

**Total new code:** ~485 lines
**Estimated time:** 8 hours (4h UI/animation, 2h server logic, 2h testing/polish)

---

## Dependencies

### Server
- No new dependencies (uses existing RNG)

### Client
- `framer-motion` (already installed)
- No new dependencies

### Browser Compatibility
- CSS Grid: All modern browsers
- Framer Motion: Chrome 60+, Firefox 55+, Safari 11+
- No fallback needed (casino is entertainment, not critical)

---

## Risk Assessment

### Low Risk
- Server logic: Simple RNG, no complex state
- Router: Standard instant game pattern
- Multipliers: Pre-calculated, no edge cases

### Medium Risk
- Animation timing: May need tuning for feel
- Mobile performance: 78+ DOM elements + animation
- Bucket calculation: Edge cases at position boundaries

### Mitigation
- Test animation on low-end devices
- Add performance monitoring
- Extensive bucket boundary testing (position = -0.5, 12.5, etc.)
- Consider reducing pegs on mobile (8 rows instead of 12)

---

## Completion Criteria

Game is complete when:
1. ✅ Ball drops from top, bounces through pegs, lands in bucket
2. ✅ Multiplier applies correctly based on bucket and risk level
3. ✅ Balance updates correctly (deduct bet, credit payout)
4. ✅ Animation feels smooth and realistic (~2-3 seconds)
5. ✅ Recent results display last 15 drops
6. ✅ Works on mobile (board scales, touch works)
7. ✅ All three risk levels have correct multipliers
8. ✅ MAX_PAYOUT caps extreme wins at $500

---

**Status:** Ready for implementation
**Next Steps:** Create `server/plinko.ts`, add router, create `Plinko.tsx`, integrate routes
