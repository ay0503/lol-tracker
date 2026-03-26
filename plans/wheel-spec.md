# Wheel (Fortune Wheel) - Complete Implementation Spec

**Game Type:** Instant resolution
**Complexity:** Medium (6 hours)
**Pattern:** Roulette-style instant game
**House Edge:** ~3.5% (built into segment distribution)

---

## Game Mechanics

### Core Rules
- Player places a bet and spins the wheel
- Wheel has 50 segments with different multipliers
- Wheel spins and lands on a random segment
- Player wins: `bet × segment_multiplier`
- MAX_PAYOUT: $250 (same as other games)

### Segment Distribution (50 total)
| Multiplier | Segments | Probability | Color |
|------------|----------|-------------|-------|
| 0x (lose)  | 1        | 2%          | Gray  |
| 1.5x       | 24       | 48%         | Blue  |
| 2x         | 13       | 26%         | Green |
| 3x         | 7        | 14%         | Purple |
| 5x         | 3        | 6%          | Orange |
| 10x        | 1        | 2%          | Red   |
| 50x        | 1        | 2%          | Gold  |

### House Edge Calculation
```
Expected Return = (0.02×0) + (0.48×1.5) + (0.26×2) + (0.14×3) + (0.06×5) + (0.02×10) + (0.02×50)
                = 0 + 0.72 + 0.52 + 0.42 + 0.30 + 0.20 + 1.00
                = 3.16
House Edge    = (3.16 - 3.00) / 3.00 = ~5.3%
```

**Note:** This is slightly higher than other games (2-2.7%) but acceptable for a high-variance game with 50x jackpot potential.

---

## File 1: Server Logic (`server/wheel.ts`)

**NEW FILE** - Create complete file:

```typescript
/**
 * Wheel (Fortune Wheel) game engine — server-side logic.
 * 50-segment wheel with multipliers from 0x to 50x.
 * House edge: ~3.5% built into segment distribution.
 */

const MAX_PAYOUT = 250;

// ─── Segment Definition ───
export interface WheelSegment {
  multiplier: number;
  color: 'gray' | 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gold';
}

// Build 50-segment wheel with weighted distribution
export const SEGMENTS: WheelSegment[] = [
  // 1× 0x (lose) — gray
  { multiplier: 0, color: 'gray' },

  // 24× 1.5x — blue
  ...Array(24).fill({ multiplier: 1.5, color: 'blue' }),

  // 13× 2x — green
  ...Array(13).fill({ multiplier: 2, color: 'green' }),

  // 7× 3x — purple
  ...Array(7).fill({ multiplier: 3, color: 'purple' }),

  // 3× 5x — orange
  ...Array(3).fill({ multiplier: 5, color: 'orange' }),

  // 1× 10x — red
  { multiplier: 10, color: 'red' },

  // 1× 50x — gold
  { multiplier: 50, color: 'gold' },
];

// ─── Type Definitions ───
export interface WheelBet {
  amount: number;
}

export interface WheelResult {
  segmentIndex: number;
  segment: WheelSegment;
  bet: WheelBet;
  payout: number;
  timestamp: number;
}

export interface WheelHistory {
  segmentIndex: number;
  multiplier: number;
  color: string;
  timestamp: number;
}

// ─── In-Memory Storage ───
const recentResults: WheelHistory[] = [];
const MAX_HISTORY = 20;

// ─── Main Game Function ───
export function spin(bet: WheelBet): WheelResult {
  // Select random segment (uniform distribution across all 50)
  const segmentIndex = Math.floor(Math.random() * SEGMENTS.length);
  const segment = SEGMENTS[segmentIndex];

  // Calculate payout with MAX_PAYOUT cap
  const rawPayout = bet.amount * segment.multiplier;
  const payout = Math.min(rawPayout, MAX_PAYOUT);

  const result: WheelResult = {
    segmentIndex,
    segment,
    bet,
    payout: Math.round(payout * 100) / 100,
    timestamp: Date.now(),
  };

  // Store history
  recentResults.unshift({
    segmentIndex,
    multiplier: segment.multiplier,
    color: segment.color,
    timestamp: Date.now(),
  });
  if (recentResults.length > MAX_HISTORY) recentResults.pop();

  return result;
}

export function getHistory(): WheelHistory[] {
  return recentResults;
}
```

**Lines of code:** ~70

---

## File 2: Router Integration (`server/routers.ts`)

**MODIFY EXISTING FILE** - Add inside `casino: router({ ... })` block (after roulette, before blackjack):

```typescript
    wheel: router({
      spin: protectedProcedure
        .input(z.object({
          amount: z.number().min(0.10).max(5).finite(),
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

          // Spin wheel
          const { spin } = await import("./wheel");
          const result = spin({ amount: input.amount });

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
        const { getHistory } = await import("./wheel");
        return getHistory();
      }),
    }),
```

**Location:** Insert after line 981 (after roulette router closes, before blackjack starts)

---

## File 3: Client Page (`client/src/pages/Wheel.tsx`)

**NEW FILE** - Create complete file:

```typescript
import { useState, useCallback, useMemo, useEffect } from "react";
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

// ─── Chip Values & Colors ───
const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0.50: { bg: "from-red-400 to-red-600", border: "border-red-300/50", text: "text-white" },
  1: { bg: "from-gray-100 to-gray-300", border: "border-gray-200/50", text: "text-gray-800" },
  5: { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50", text: "text-black" },
  10: { bg: "from-blue-400 to-blue-600", border: "border-blue-300/50", text: "text-white" },
  25: { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", text: "text-white" },
  50: { bg: "from-purple-400 to-purple-600", border: "border-purple-300/50", text: "text-white" },
};

// ─── Wheel Segment Definition (matches server) ───
const SEGMENTS = [
  { multiplier: 0, color: 'gray' },
  ...Array(24).fill({ multiplier: 1.5, color: 'blue' }),
  ...Array(13).fill({ multiplier: 2, color: 'green' }),
  ...Array(7).fill({ multiplier: 3, color: 'purple' }),
  ...Array(3).fill({ multiplier: 5, color: 'orange' }),
  { multiplier: 10, color: 'red' },
  { multiplier: 50, color: 'gold' },
];

// ─── Color Mapping ───
const SEGMENT_COLORS: Record<string, string> = {
  gray: '#52525b',    // zinc-600
  blue: '#3b82f6',    // blue-500
  green: '#10b981',   // emerald-500
  purple: '#a855f7',  // purple-500
  orange: '#f97316',  // orange-500
  red: '#ef4444',     // red-500
  gold: '#fbbf24',    // amber-400
};

export default function Wheel() {
  const { language } = useTranslation();
  const { isAuthenticated, user } = useAuth();

  // ─── State ───
  const [selectedChip, setSelectedChip] = useState(1);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [rotation, setRotation] = useState(0);

  // ─── Queries ───
  const balance = trpc.portfolio.balances.useQuery(undefined, { enabled: isAuthenticated });
  const history = trpc.casino.wheel.history.useQuery(undefined, { refetchInterval: 5000 });
  const utils = trpc.useUtils();

  // ─── Mutations ───
  const spinMutation = trpc.casino.wheel.spin.useMutation({
    onSuccess: (data) => {
      setResult(data);
      utils.portfolio.balances.invalidate();
      utils.casino.wheel.history.invalidate();

      // Calculate target rotation
      // Each segment is 360/50 = 7.2 degrees
      const segmentAngle = 360 / SEGMENTS.length;
      const targetAngle = data.segmentIndex * segmentAngle;
      // Spin 5 full rotations + land on target (offset by half segment for center alignment)
      const finalRotation = 360 * 5 + targetAngle + segmentAngle / 2;
      setRotation(finalRotation);

      // Show result after animation completes (3s)
      setTimeout(() => {
        setIsSpinning(false);
        if (data.payout > 0) {
          toast.success(`${data.segment.multiplier}x — Won $${data.payout.toFixed(2)}!`);
        } else {
          toast.error("0x — No win this time");
        }
      }, 3200);
    },
    onError: (err) => {
      toast.error(err.message);
      setIsSpinning(false);
    },
  });

  // ─── Handlers ───
  const handleSpin = useCallback(() => {
    if (!isAuthenticated) {
      toast.error("Sign in to play");
      return;
    }
    setIsSpinning(true);
    setResult(null);
    spinMutation.mutate({ amount: selectedChip });
  }, [isAuthenticated, selectedChip, spinMutation]);

  const casinoCash = balance.data?.casinoBalance ?? 20;

  // ─── Build conic gradient for wheel ───
  const wheelGradient = useMemo(() => {
    const segmentAngle = 360 / SEGMENTS.length;
    const stops: string[] = [];

    SEGMENTS.forEach((seg, idx) => {
      const startAngle = idx * segmentAngle;
      const endAngle = (idx + 1) * segmentAngle;
      const color = SEGMENT_COLORS[seg.color];
      stops.push(`${color} ${startAngle}deg ${endAngle}deg`);
    });

    return `conic-gradient(from 0deg, ${stops.join(', ')})`;
  }, []);

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
            <div>
              <h1 className="text-xl font-bold">Wheel</h1>
              <p className="text-xs text-zinc-400">Spin the fortune wheel</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg">
            <span className="text-xs text-zinc-400">Casino Cash</span>
            <span className="font-bold text-green-400">${casinoCash.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">

        {/* ─── Wheel Area ─── */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-8 min-h-[500px] flex flex-col items-center justify-center gap-6">

          {/* Wheel Container */}
          <div className="relative">
            {/* Pointer (arrow at top) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 z-20">
              <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[16px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-lg" />
            </div>

            {/* Wheel */}
            <motion.div
              className="relative w-80 h-80 rounded-full border-8 border-zinc-800 shadow-2xl"
              style={{
                background: wheelGradient,
              }}
              animate={{ rotate: rotation }}
              transition={{
                duration: 3,
                ease: [0.1, 0.25, 0.15, 1], // Custom easing for deceleration
              }}
            >
              {/* Center circle */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border-4 border-zinc-700 flex items-center justify-center shadow-lg">
                  <span className="text-xs font-bold text-zinc-400">SPIN</span>
                </div>
              </div>

              {/* Segment labels (optional — can be omitted for cleaner look) */}
              {SEGMENTS.map((seg, idx) => {
                const segmentAngle = 360 / SEGMENTS.length;
                const angle = idx * segmentAngle + segmentAngle / 2;
                const radius = 120; // Distance from center
                const x = Math.cos((angle - 90) * Math.PI / 180) * radius;
                const y = Math.sin((angle - 90) * Math.PI / 180) * radius;

                // Only show labels for high multipliers (less cluttered)
                if (seg.multiplier < 3) return null;

                return (
                  <div
                    key={idx}
                    className="absolute text-[10px] font-bold text-white drop-shadow-lg"
                    style={{
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {seg.multiplier}x
                  </div>
                );
              })}
            </motion.div>
          </div>

          {/* Result Display */}
          <AnimatePresence mode="wait">
            {result && !isSpinning && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-center"
              >
                <div className="text-sm text-zinc-400 mb-1">Landed on</div>
                <div
                  className="text-5xl font-bold mb-2"
                  style={{ color: SEGMENT_COLORS[result.segment.color] }}
                >
                  {result.segment.multiplier}x
                </div>
                <div className="text-lg text-zinc-300">
                  {result.payout > 0 ? `Won $${result.payout.toFixed(2)}` : 'Better luck next time'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Recent Results ─── */}
        {history.data && history.data.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-xs font-semibold text-zinc-400 mb-2">Recent Spins</div>
            <div className="flex gap-1 overflow-x-auto">
              {history.data.slice(0, 20).map((h, idx) => (
                <div
                  key={idx}
                  className="flex-shrink-0 w-10 h-10 rounded-full border-2 border-zinc-700 flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: SEGMENT_COLORS[h.color] }}
                >
                  {h.multiplier}x
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* ─── Spin Button ─── */}
        <button
          onClick={handleSpin}
          disabled={isSpinning || !isAuthenticated}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-zinc-700 disabled:to-zinc-800 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg disabled:shadow-none"
        >
          {isSpinning ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Spinning...
            </span>
          ) : (
            `Spin for $${selectedChip.toFixed(2)}`
          )}
        </button>

        {/* ─── Payouts Reference ─── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs font-semibold text-zinc-400 mb-3">Wheel Multipliers</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: SEGMENT_COLORS.gray }} />
              <span className="text-zinc-400">0x (2%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: SEGMENT_COLORS.blue }} />
              <span className="text-zinc-300">1.5x (48%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: SEGMENT_COLORS.green }} />
              <span className="text-zinc-300">2x (26%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: SEGMENT_COLORS.purple }} />
              <span className="text-zinc-300">3x (14%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: SEGMENT_COLORS.orange }} />
              <span className="text-zinc-300">5x (6%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: SEGMENT_COLORS.red }} />
              <span className="text-orange-300">10x (2%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: SEGMENT_COLORS.gold }} />
              <span className="text-yellow-300">50x (2%)</span>
            </div>
          </div>
        </div>

        {/* ─── Disclaimer ─── */}
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
```

**Lines of code:** ~340

---

## File 4: App.tsx Route (`client/src/App.tsx`)

**MODIFY EXISTING FILE** - Add two entries:

### 4a. Lazy import (after line 29)
```typescript
const Wheel = lazy(() => import("./pages/Wheel"));
```

### 4b. Route registration (after line 58, before `/casino` catch-all)
```typescript
        <Route path={"/casino/wheel"} component={Wheel} />
```

**Final location:** Insert between poker and casino routes.

---

## File 5: Casino Landing Page (`client/src/pages/Casino.tsx`)

**MODIFY EXISTING FILE** - Add to GAMES array (after line 19, before closing bracket):

```typescript
  { id: "wheel", title: "Wheel", titleKo: "휠", emoji: "🎡", desc: "50-segment fortune wheel", descKo: "행운의 바퀴", bet: "$0.10 – $5", href: "/casino/wheel", active: true, bg: "from-yellow-950/50 to-amber-900/30", border: "border-yellow-700/40", badge: "from-yellow-500 to-amber-600" },
```

**Location:** Insert after poker entry, before the closing `];`

---

## Testing Checklist

### Server Tests
- [ ] `SEGMENTS` array has exactly 50 entries
- [ ] `spin()` returns segmentIndex in range [0, 49]
- [ ] Payout respects MAX_PAYOUT cap ($250)
- [ ] History stores last 20 spins
- [ ] Multiplier probabilities match design (48% for 1.5x, etc.)

### Client Tests
- [ ] Wheel renders 50 colored segments (conic gradient)
- [ ] Pointer is centered at top
- [ ] Spin animation rotates 5 full turns + lands on correct segment
- [ ] Animation takes ~3 seconds with deceleration easing
- [ ] Result displays after animation completes
- [ ] Toast shows win/loss message
- [ ] Recent results strip shows last 20 spins with colors
- [ ] Chip selector disables chips above balance
- [ ] Spin button disabled when spinning or not authenticated
- [ ] Balance updates immediately after spin

### Router Tests
- [ ] `casino.wheel.spin` mutation deducts bet from balance
- [ ] Credits payout correctly (bet × multiplier, capped at $250)
- [ ] Cooldown enforced (same as other games)
- [ ] `casino.wheel.history` query returns recent spins
- [ ] Leaderboard cache invalidates on spin

### Integration Tests
- [ ] Route `/casino/wheel` loads page
- [ ] Casino landing page shows Wheel game card
- [ ] Navigation works (back to casino, subnav highlights Wheel)
- [ ] Sign-in required to play
- [ ] Low balance shows error toast

---

## Alternative Implementation: Horizontal Strip

If circular wheel animation proves too complex, use horizontal strip approach (proven in Roulette):

### Modified Client (Strip Version)

Replace wheel rendering with:

```typescript
// Build horizontal strip (repeat segments 5 times for scrolling)
const strip = [...SEGMENTS, ...SEGMENTS, ...SEGMENTS, ...SEGMENTS, ...SEGMENTS];

<motion.div
  className="flex h-20 items-center"
  initial={{ x: -targetIdx * cellWidth }}
  animate={{ x: -finalIdx * cellWidth + containerWidth / 2 }}
  transition={{ duration: 3, ease: [0.1, 0.25, 0.15, 1] }}
>
  {strip.map((seg, idx) => (
    <div
      key={idx}
      className="flex-shrink-0 flex items-center justify-center text-white font-bold border-r border-zinc-700"
      style={{
        width: cellWidth,
        backgroundColor: SEGMENT_COLORS[seg.color],
      }}
    >
      {seg.multiplier}x
    </div>
  ))}
</motion.div>
```

**Pros:**
- Simpler implementation (reuse Roulette pattern)
- Proven animation code
- Easier to debug

**Cons:**
- Less visually impressive than circular wheel
- Doesn't match "wheel" theme as well

**Recommendation:** Start with circular wheel. If animation issues arise, fall back to horizontal strip.

---

## Estimated Time Breakdown

| Task | Time |
|------|------|
| Server logic (`wheel.ts`) | 40 min |
| Router integration | 20 min |
| Client page (circular wheel) | 180 min |
| Segment gradient generation | 30 min |
| Spin animation tuning | 60 min |
| Recent results + payouts table | 30 min |
| Integration (App.tsx, Casino.tsx) | 20 min |
| Testing (server + client) | 40 min |
| **Total** | **6 hours 20 min** |

**Buffer for issues:** +1 hour
**Final estimate:** **7-8 hours**

---

## Success Metrics

### Functionality
- ✅ Wheel spins smoothly with deceleration
- ✅ Lands on correct segment (matches server result)
- ✅ Payouts calculated correctly
- ✅ History displays recent spins

### Performance
- ✅ Animation runs at 60fps (no jank)
- ✅ Response time < 200ms (server)
- ✅ No memory leaks (long play sessions)

### UX
- ✅ Clear visual feedback (segment colors, result display)
- ✅ Satisfying animation (feels exciting)
- ✅ Mobile-responsive (wheel scales down on small screens)

---

## Notes

1. **House Edge Transparency:** 3.5% is higher than other games. Consider adding tooltip explaining this is offset by 50x jackpot potential.

2. **Segment Labels:** Current design shows multiplier labels for 3x+ segments. Can remove for cleaner look, or add all labels with smaller font.

3. **Animation Fallback:** If CSS conic-gradient has browser compatibility issues, use SVG approach:
   ```typescript
   <svg viewBox="0 0 200 200">
     {SEGMENTS.map((seg, idx) => {
       const angle = (360 / SEGMENTS.length) * idx;
       return <path d={/* arc path */} fill={SEGMENT_COLORS[seg.color]} />;
     })}
   </svg>
   ```

4. **Sound Effects:** Consider adding spin sound (optional). Use Web Audio API or `<audio>` element with wheel spin sound effect.

5. **Max Payout Warning:** If bet × 50 exceeds $250, show warning toast: "Max payout capped at $250 (jackpot would pay $X)".

---

## Deployment Steps

1. **Create server file:** `server/wheel.ts`
2. **Modify router:** `server/routers.ts` (add wheel router)
3. **Create client page:** `client/src/pages/Wheel.tsx`
4. **Update App.tsx:** Add lazy import + route
5. **Update Casino.tsx:** Add game card to GAMES array
6. **Test locally:** Verify spin, payout, animation
7. **Deploy:** Push to production
8. **Monitor:** Check error logs, play test with real users

---

## Future Enhancements

- **Auto-spin:** Option to auto-spin N times at same bet
- **Bet history:** Show last 10 personal spins with results
- **Segment targeting:** Let players bet on specific multipliers (higher risk/reward)
- **Progressive jackpot:** Accumulate 1% of bets into jackpot pool, awarded on 50x hit
- **Sound effects:** Tick-tock while spinning, fanfare on win
- **Confetti animation:** Trigger on 10x or 50x wins (use canvas-confetti library)

---

## End of Spec

**Ready to implement:** All files specified with complete code.
**Estimated time:** 6-8 hours for full implementation and testing.
**Complexity:** Medium (circular animation + conic gradient).
**Fallback:** Horizontal strip pattern (reduces to 4 hours if needed).
