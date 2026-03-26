# Plinko Physics Rewrite Plan

## Problem
The current ball animation uses framer-motion to linearly interpolate between peg positions. The ball slides from point to point with a spring transition, but there is no actual physics -- no gravity, no bouncing, no arc. It looks robotic.

## Solution Overview

Replace the framer-motion ball with a custom `requestAnimationFrame` physics loop. The server path (L/R decisions) remains the source of truth for outcome, but the visual animation simulates gravity, peg bounces, and natural motion.

---

## 1. Physics Ball Animation

### Coordinate System
- The peg board is rendered inside a container div with a known pixel height and width.
- Use a `ref` on the board container to get its bounding rect.
- All physics run in pixel coordinates relative to the board container.
- The ball is an absolutely-positioned div inside the board, with `transform: translate(x, y)`.

### Physics Constants
```
GRAVITY = 0.25           // px/frame^2, accelerates ball downward
BOUNCE_VY = -3.5         // vertical velocity after hitting a peg (upward kick)
BOUNCE_VX = +/-2.8       // horizontal velocity from L/R decision
HORIZONTAL_FRICTION = 0.98  // vx *= friction each frame
VERTICAL_DAMPING = 0.99    // slight drag on vy
RANDOM_ANGLE_JITTER = 5    // degrees, +/- random rotation of bounce vector
```

### Per-Frame Loop (requestAnimationFrame)
```
1. Apply gravity:   vy += GRAVITY
2. Apply friction:  vx *= HORIZONTAL_FRICTION
3. Update position: x += vx,  y += vy
4. Check if ball.y >= nextPegRowY:
   a. Determine bounce direction from server path[currentRow]
   b. Set vx = BOUNCE_VX * (path is "R" ? 1 : -1)
   c. Apply jitter: rotate (vx, vy) by random +/-5 degrees
   d. Set vy = BOUNCE_VY (upward kick)
   e. Snap ball.y = pegRowY (prevent tunneling)
   f. Advance currentRow++
   g. Flash the peg that was hit
5. If currentRow > ROWS, ball enters bucket zone:
   a. Let ball fall to bottom of board
   b. Once y >= boardBottom, animation complete
   c. Fire result callback
```

### Peg Position Calculation
Each row `r` (0-indexed) has `r + 3` pegs, centered horizontally.
- `pegSpacingX = boardWidth / (ROWS + 2)`  (approx, tuned to look right)
- `pegRowY = (r + 1) * rowHeight` where `rowHeight = boardHeight / (ROWS + 2)`
- `pegX(row, col) = boardCenterX + (col - (row + 2) / 2) * pegSpacingX`

The ball starts at `(boardCenterX, 0)` and the first peg row is at `pegRowY(0)`.

### Why Not framer-motion
- framer-motion animates between keyframes with easing curves. It can't do per-frame physics integration.
- `requestAnimationFrame` gives us 60fps control over position and velocity.
- The ball div uses `style={{ transform: translate3d(x, y, 0) }}` for GPU-accelerated rendering.

---

## 2. Multi-Ball Support

### Client Changes
- Add a `ballCount` state: 1, 3, or 5 (selector buttons)
- When dropping, fire `ballCount` separate `drop` mutations
- Each ball gets its own physics state object stored in a `useRef<BallState[]>`
- Balls launch with 200ms stagger (first ball at t=0, second at t=200ms, etc.)
- The rAF loop iterates over all active balls each frame
- Results accumulate: track `pendingBalls` count, show total payout when all land

### Server Changes
- No server changes needed. We call the existing `drop` endpoint N times.
- Bet validation happens per-call, and balance is deducted per-call.
- Client deducts `bet * count` from displayed balance optimistically.

### Ball State Interface
```ts
interface BallState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  currentRow: number;
  path: ("L" | "R")[];
  result: PlinkoResult | null;
  landed: boolean;
  launchDelay: number; // ms before this ball starts moving
  startTime: number;
}
```

---

## 3. Visual Polish

### Peg Glow on Bounce
- Track which peg was just hit: `{ row, col, timestamp }`
- In the peg render, if a peg was hit within last 300ms, add a glow class:
  `bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]` with CSS transition

### Ball Trail
- Render 3-4 trailing circles behind the ball at previous positions
- Each trail dot is smaller and more transparent
- Store last 4 positions in a circular buffer

### Landing Bucket Animation
- When ball lands, the target bucket gets `scale-110` and a `ring-2 ring-yellow-400` for 500ms
- Use CSS transition, not framer-motion

### Screen Shake on Big Wins
- If multiplier >= 10, apply a CSS animation to the board container:
  `@keyframes shake { 0%,100% { transform: translate(0) } 25% { transform: translate(-3px, 2px) } 75% { transform: translate(3px, -2px) } }`
- Duration: 400ms

---

## 4. Peg Board Rendering

### Current Issues
- Pegs are `w-1.5 h-1.5` (6px) -- too small
- No visual connection between pegs
- Board doesn't feel like a physical Plinko machine

### Changes
- Increase peg dots to `w-2 h-2` (8px) with a subtle radial gradient (metallic look)
- Peg color: `bg-gradient-radial from-zinc-400 to-zinc-600` (use inline style since Tailwind doesn't have radial)
- Add subtle vertical lines connecting pegs in same column (1px zinc-800 lines)
- Board background: slightly lighter than surroundings with subtle inner shadow
- Row spacing: increase from `mb-0.5` to ensure ball has room to arc between rows

### Board Dimensions
- Fixed aspect ratio container (e.g., 340px wide, ~400px tall for 12 rows)
- This gives ~28px between peg rows -- enough for visible bounce arcs

---

## 5. Implementation File

The complete rewritten `Plinko.tsx` is below. Key architectural decisions:
- All physics state lives in `useRef` (not `useState`) to avoid re-renders every frame
- Only the ball div's `style.transform` is updated directly via ref (no React re-render)
- React state is only used for: UI controls, result display, landed bucket highlight
- The peg board is rendered once and peg glow is toggled via direct DOM manipulation for performance

### Complete Plinko.tsx

```tsx
import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";

// ── Constants ──────────────────────────────────────────────────────────
const ROWS = 12;
const BUCKETS = 13;

const MULTIPLIERS: Record<string, number[]> = {
  low:    [5.6, 2.1, 1.4, 1.1, 1, 0.5, 0.3, 0.5, 1, 1.1, 1.4, 2.1, 5.6],
  medium: [13, 3, 1.5, 1, 0.5, 0.3, 0.3, 0.3, 0.5, 1, 1.5, 3, 13],
  high:   [110, 41, 10, 5, 3, 1.5, 0.5, 1.5, 3, 5, 10, 41, 110],
};

const CHIP_COLORS: Record<number, { bg: string; border: string; txt: string }> = {
  0.10: { bg: "from-blue-400 to-blue-600", border: "border-blue-300/50", txt: "text-white" },
  0.25: { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", txt: "text-white" },
  0.50: { bg: "from-red-400 to-red-600", border: "border-red-300/50", txt: "text-white" },
  1: { bg: "from-gray-100 to-gray-300", border: "border-gray-200/50", txt: "text-gray-800" },
  2: { bg: "from-pink-400 to-pink-600", border: "border-pink-300/50", txt: "text-white" },
  5: { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50", txt: "text-black" },
};

// Physics tuning
const GRAVITY = 0.25;
const BOUNCE_VY = -3.5;
const BOUNCE_VX_BASE = 2.8;
const H_FRICTION = 0.98;
const JITTER_DEG = 5;
const TRAIL_LENGTH = 4;

// ── Types ──────────────────────────────────────────────────────────────
interface BallState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  currentRow: number;
  path: ("L" | "R")[];
  result: { bucket: number; multiplier: number; payout: number } | null;
  landed: boolean;
  launchDelay: number;
  started: boolean;
  trail: { x: number; y: number }[];
}

interface PegGlow {
  row: number;
  col: number;
  time: number;
}

// ── Helpers ────────────────────────────────────────────────────────────
function getBucketColor(mult: number): string {
  if (mult >= 10) return "bg-yellow-500 text-black";
  if (mult >= 3) return "bg-orange-500 text-white";
  if (mult >= 1) return "bg-emerald-600 text-white";
  return "bg-red-600 text-white";
}

function getPegPosition(row: number, col: number, boardWidth: number, boardHeight: number) {
  const totalRows = ROWS;
  const rowHeight = boardHeight / (totalRows + 1.5);
  const y = (row + 1) * rowHeight;
  const pegsInRow = row + 3;
  const spacing = boardWidth / (totalRows + 3);
  const rowWidth = (pegsInRow - 1) * spacing;
  const startX = (boardWidth - rowWidth) / 2;
  const x = startX + col * spacing;
  return { x, y };
}

function getPegRowY(row: number, boardHeight: number): number {
  const rowHeight = boardHeight / (ROWS + 1.5);
  return (row + 1) * rowHeight;
}

function getPegXForBallAtRow(row: number, colIndex: number, boardWidth: number): number {
  // After bouncing at row `row`, the ball is between two pegs of row `row`.
  // colIndex = number of R bounces so far (0 to row+1 range maps to pegs of next row)
  // Actually we track cumulative position: start at center of row 0's pegs.
  // Row r has (r+3) pegs. Ball enters from top center.
  // At row 0 (3 pegs), ball hits middle peg (index 1) and goes L(col 0.5) or R(col 1.5) between row 1's pegs
  // We just compute X from the bucket-like position.
  const spacing = boardWidth / (ROWS + 3);
  const totalBuckets = BUCKETS; // 13
  const totalWidth = (totalBuckets - 1) * spacing;
  const startX = (boardWidth - totalWidth) / 2;
  return startX + colIndex * spacing;
}

// ── Component ──────────────────────────────────────────────────────────
export default function Plinko() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [selectedChip, setSelectedChip] = useState(0.50);
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [dropping, setDropping] = useState(false);
  const [ballCount, setBallCount] = useState(1);
  const [landedBuckets, setLandedBuckets] = useState<number[]>([]);
  const [lastResults, setLastResults] = useState<{ multiplier: number; payout: number; bet: number }[]>([]);
  const [shaking, setShaking] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const ballRefs = useRef<(HTMLDivElement | null)[]>([]);
  const trailRefs = useRef<(HTMLDivElement | null)[][]>([]);
  const pegRefs = useRef<(HTMLDivElement | null)[][]>([]);
  const ballsRef = useRef<BallState[]>([]);
  const rafRef = useRef<number>(0);
  const glowsRef = useRef<PegGlow[]>([]);
  const pendingRef = useRef(0);
  const resultsAccRef = useRef<{ multiplier: number; payout: number; bet: number }[]>([]);

  const { data: balance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: history, refetch: refetchHistory } = trpc.casino.plinko.history.useQuery(undefined, { staleTime: 10_000 });

  const dropMutation = trpc.casino.plinko.drop.useMutation();

  const cash = balance ?? 20;
  const mults = MULTIPLIERS[risk];

  // Cleanup
  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // ── Physics Loop ─────────────────────────────────────────────────────
  const runPhysics = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    const boardWidth = board.offsetWidth;
    const boardHeight = board.offsetHeight;
    const now = performance.now();

    let anyActive = false;

    for (let i = 0; i < ballsRef.current.length; i++) {
      const ball = ballsRef.current[i];
      if (ball.landed) continue;

      // Check launch delay
      if (!ball.started) {
        if (now - ball.launchDelay < 0) continue; // not yet
        ball.started = true;
      }

      anyActive = true;

      // Apply gravity
      ball.vy += GRAVITY;

      // Apply friction
      ball.vx *= H_FRICTION;

      // Update position
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Store trail
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > TRAIL_LENGTH) ball.trail.shift();

      // Check peg collision
      if (ball.currentRow < ROWS) {
        const pegY = getPegRowY(ball.currentRow, boardHeight);
        if (ball.y >= pegY) {
          // Bounce!
          const dir = ball.path[ball.currentRow];
          const sign = dir === "R" ? 1 : -1;

          // Jitter angle
          const jitter = (Math.random() * 2 - 1) * JITTER_DEG * (Math.PI / 180);
          const baseVx = BOUNCE_VX_BASE * sign;
          const baseVy = BOUNCE_VY;
          ball.vx = baseVx * Math.cos(jitter) - baseVy * Math.sin(jitter);
          ball.vy = baseVx * Math.sin(jitter) + baseVy * Math.cos(jitter);

          // Snap to peg Y to prevent tunneling
          ball.y = pegY;

          // Calculate which peg was hit for glow effect
          // At row r, the ball hits one of (r+3) pegs
          // Track the peg col: ball's bucket position maps to peg index
          // Simpler: compute closest peg
          const pegsInRow = ball.currentRow + 3;
          let closestCol = 0;
          let closestDist = Infinity;
          for (let c = 0; c < pegsInRow; c++) {
            const pp = getPegPosition(ball.currentRow, c, boardWidth, boardHeight);
            const dist = Math.abs(pp.x - ball.x);
            if (dist < closestDist) {
              closestDist = dist;
              closestCol = c;
            }
          }

          // Glow the peg
          glowsRef.current.push({ row: ball.currentRow, col: closestCol, time: now });
          const pegEl = pegRefs.current[ball.currentRow]?.[closestCol];
          if (pegEl) {
            pegEl.style.background = "radial-gradient(circle, #fbbf24, #f59e0b)";
            pegEl.style.boxShadow = "0 0 8px rgba(250,204,21,0.7)";
            pegEl.style.transform = "scale(1.4)";
            setTimeout(() => {
              pegEl.style.background = "";
              pegEl.style.boxShadow = "";
              pegEl.style.transform = "";
            }, 300);
          }

          ball.currentRow++;
        }
      } else {
        // Past all rows -- check if reached bottom
        if (ball.y >= boardHeight - 5) {
          ball.landed = true;
          ball.y = boardHeight - 5;

          // Hide ball and trail
          const ballEl = ballRefs.current[i];
          if (ballEl) ballEl.style.opacity = "0";
          for (const tEl of (trailRefs.current[i] || [])) {
            if (tEl) tEl.style.opacity = "0";
          }

          if (ball.result) {
            setLandedBuckets(prev => [...prev, ball.result!.bucket]);
            resultsAccRef.current.push({
              multiplier: ball.result.multiplier,
              payout: ball.result.payout,
              bet: selectedChip,
            });

            // Screen shake for big wins
            if (ball.result.multiplier >= 10) {
              setShaking(true);
              setTimeout(() => setShaking(false), 400);
            }
          }

          pendingRef.current--;
          if (pendingRef.current <= 0) {
            // All balls landed
            setDropping(false);
            setLastResults([...resultsAccRef.current]);
            refetchBalance();
            refetchHistory();

            const totalPayout = resultsAccRef.current.reduce((s, r) => s + r.payout, 0);
            const totalBet = resultsAccRef.current.reduce((s, r) => s + r.bet, 0);
            if (resultsAccRef.current.length === 1) {
              const r = resultsAccRef.current[0];
              toast.success(`${r.multiplier}x -- $${r.payout.toFixed(2)}`);
            } else {
              toast.success(`${resultsAccRef.current.length} balls -- Total: $${totalPayout.toFixed(2)}`);
            }

            setTimeout(() => {
              setLastResults([]);
              setLandedBuckets([]);
            }, 2500);
          }
        }
      }

      // Update ball DOM element
      const ballEl = ballRefs.current[i];
      if (ballEl) {
        ballEl.style.transform = `translate3d(${ball.x - 6}px, ${ball.y - 6}px, 0)`;
      }

      // Update trail DOM elements
      const trails = trailRefs.current[i] || [];
      for (let t = 0; t < TRAIL_LENGTH; t++) {
        const tEl = trails[t];
        if (!tEl) continue;
        const trailPoint = ball.trail[ball.trail.length - 1 - (t + 1)];
        if (trailPoint) {
          const size = Math.max(4 - t, 1);
          const opacity = 0.4 - t * 0.1;
          tEl.style.transform = `translate3d(${trailPoint.x - size / 2}px, ${trailPoint.y - size / 2}px, 0)`;
          tEl.style.width = `${size}px`;
          tEl.style.height = `${size}px`;
          tEl.style.opacity = `${Math.max(opacity, 0)}`;
        } else {
          tEl.style.opacity = "0";
        }
      }
    }

    if (anyActive) {
      rafRef.current = requestAnimationFrame(runPhysics);
    }
  }, [selectedChip, refetchBalance, refetchHistory]);

  // ── Drop Handler ─────────────────────────────────────────────────────
  const handleDrop = useCallback(async () => {
    if (dropping || !isAuthenticated) return;
    if (cash < selectedChip * ballCount) {
      toast.error(`Need $${(selectedChip * ballCount).toFixed(2)} for ${ballCount} ball(s)`);
      return;
    }

    setDropping(true);
    setLastResults([]);
    setLandedBuckets([]);
    resultsAccRef.current = [];
    pendingRef.current = ballCount;

    const board = boardRef.current;
    if (!board) return;
    const boardWidth = board.offsetWidth;
    const startX = boardWidth / 2;
    const startTime = performance.now();

    const newBalls: BallState[] = [];

    // Fire all drop mutations
    const promises = Array.from({ length: ballCount }, (_, i) =>
      dropMutation.mutateAsync({ bet: selectedChip, risk })
    );

    try {
      const results = await Promise.all(promises);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        newBalls.push({
          id: i,
          x: startX,
          y: 0,
          vx: 0,
          vy: 0,
          currentRow: 0,
          path: result.path,
          result: { bucket: result.bucket, multiplier: result.multiplier, payout: result.payout },
          landed: false,
          launchDelay: startTime + i * 200,
          started: i === 0,
          trail: [],
        });
      }

      ballsRef.current = newBalls;

      // Show ball elements
      for (let i = 0; i < newBalls.length; i++) {
        const el = ballRefs.current[i];
        if (el) {
          el.style.opacity = "1";
          el.style.transform = `translate3d(${startX - 6}px, -6px, 0)`;
        }
      }

      // Start physics loop
      rafRef.current = requestAnimationFrame(runPhysics);
    } catch (err: any) {
      setDropping(false);
      toast.error(err.message || "Drop failed");
    }
  }, [selectedChip, risk, dropping, isAuthenticated, ballCount, cash, dropMutation, runPhysics]);

  // ── Render ───────────────────────────────────────────────────────────
  const MAX_BALLS = 5;

  // Initialize peg refs array
  if (pegRefs.current.length === 0) {
    pegRefs.current = Array.from({ length: ROWS }, (_, r) =>
      new Array(r + 3).fill(null)
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <div className="container py-6 sm:py-8 max-w-lg mx-auto px-4">
        <Link href="/casino" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mb-5">
          <ArrowLeft className="w-3.5 h-3.5" /> Casino
        </Link>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/25 to-rose-600/15 border border-pink-500/20">
              <span className="text-lg">📌</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-[var(--font-heading)]">Plinko</h1>
              <p className="text-xs text-zinc-400 font-mono">${cash.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className={`relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)] ${shaking ? "animate-shake" : ""}`}>
          <style>{`
            @keyframes shake {
              0%, 100% { transform: translate(0, 0); }
              10% { transform: translate(-3px, 1px); }
              30% { transform: translate(3px, -2px); }
              50% { transform: translate(-2px, 3px); }
              70% { transform: translate(2px, -1px); }
              90% { transform: translate(-1px, 2px); }
            }
            .animate-shake { animation: shake 0.4s ease-in-out; }
            .peg-dot {
              transition: background 0.2s, box-shadow 0.2s, transform 0.2s;
            }
          `}</style>
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/80 to-zinc-900" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

          <div className="relative p-3 sm:p-5">
            {/* Results Strip */}
            {history && history.length > 0 && (
              <div className="flex gap-1 overflow-x-auto mb-2 pb-0.5 scrollbar-hide">
                {history.slice(0, 15).map((rr, idx) => (
                  <div key={idx} className={`flex-shrink-0 px-1.5 h-5 rounded flex items-center justify-center text-[7px] font-mono font-bold ${
                    rr.multiplier >= 3 ? "bg-yellow-500/30 text-yellow-400" :
                    rr.multiplier >= 1 ? "bg-emerald-600/30 text-emerald-400" :
                    "bg-red-600/30 text-red-400"
                  }`}>
                    {rr.multiplier}x
                  </div>
                ))}
              </div>
            )}

            {/* Peg Board */}
            <div
              ref={boardRef}
              className="relative mx-auto mb-2 overflow-hidden"
              style={{ maxWidth: 340, height: 380 }}
            >
              {/* Pegs */}
              {Array.from({ length: ROWS }).map((_, row) => (
                <div key={row} className="absolute left-0 right-0 flex justify-center" style={{
                  top: `${((row + 1) / (ROWS + 1.5)) * 100}%`,
                }}>
                  {Array.from({ length: row + 3 }).map((_, col) => {
                    const pegsInRow = row + 3;
                    return (
                      <div
                        key={col}
                        ref={el => {
                          if (!pegRefs.current[row]) pegRefs.current[row] = [];
                          pegRefs.current[row][col] = el;
                        }}
                        className="peg-dot rounded-full"
                        style={{
                          width: 8,
                          height: 8,
                          background: "radial-gradient(circle at 35% 35%, #a1a1aa, #52525b)",
                          position: "absolute",
                          left: `calc(50% + ${(col - (pegsInRow - 1) / 2) * (340 / (ROWS + 3))}px - 4px)`,
                        }}
                      />
                    );
                  })}
                </div>
              ))}

              {/* Ball elements (pre-rendered, positioned by physics) */}
              {Array.from({ length: MAX_BALLS }).map((_, i) => (
                <div key={`ball-group-${i}`}>
                  {/* Trail dots */}
                  {Array.from({ length: TRAIL_LENGTH }).map((_, t) => (
                    <div
                      key={`trail-${i}-${t}`}
                      ref={el => {
                        if (!trailRefs.current[i]) trailRefs.current[i] = [];
                        trailRefs.current[i][t] = el;
                      }}
                      className="absolute rounded-full bg-yellow-400/40 pointer-events-none"
                      style={{ opacity: 0, width: 4, height: 4, willChange: "transform" }}
                    />
                  ))}
                  {/* Ball */}
                  <div
                    ref={el => { ballRefs.current[i] = el; }}
                    className="absolute rounded-full pointer-events-none z-10"
                    style={{
                      width: 12,
                      height: 12,
                      background: "radial-gradient(circle at 40% 35%, #fde047, #f59e0b)",
                      boxShadow: "0 0 10px rgba(250,204,21,0.5), 0 2px 4px rgba(0,0,0,0.3)",
                      opacity: 0,
                      willChange: "transform",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Buckets */}
            <div className="flex gap-0.5 mb-3">
              {mults.map((mult, idx) => (
                <div
                  key={idx}
                  className={`flex-1 py-1.5 rounded text-center text-[7px] sm:text-[8px] font-mono font-bold transition-all duration-300 ${getBucketColor(mult)} ${
                    landedBuckets.includes(idx) ? "ring-2 ring-yellow-400 scale-110 z-10" : ""
                  }`}
                >
                  {mult}x
                </div>
              ))}
            </div>

            {/* Result */}
            <AnimatePresence>
              {lastResults.length > 0 && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                  className="text-center mb-2">
                  {lastResults.length === 1 ? (
                    <p className={`text-2xl font-bold font-mono ${lastResults[0].multiplier >= 1 ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                      {lastResults[0].multiplier}x {lastResults[0].payout > 0 ? `+$${lastResults[0].payout.toFixed(2)}` : `-$${selectedChip.toFixed(2)}`}
                    </p>
                  ) : (
                    <div>
                      <p className="text-lg font-bold font-mono text-white">
                        {lastResults.length} balls
                      </p>
                      <p className={`text-2xl font-bold font-mono ${
                        lastResults.reduce((s, r) => s + r.payout, 0) >= lastResults.reduce((s, r) => s + r.bet, 0)
                          ? "text-[#00C805]" : "text-[#FF5252]"
                      }`}>
                        Total: ${lastResults.reduce((s, r) => s + r.payout, 0).toFixed(2)}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Ball Count Selector */}
            <div className="flex gap-1.5 justify-center mb-3">
              <span className="text-[10px] text-zinc-500 self-center mr-1">Balls:</span>
              {[1, 3, 5].map(n => (
                <button key={n} onClick={() => !dropping && setBallCount(n)} disabled={dropping}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    ballCount === n
                      ? "bg-pink-500/30 text-pink-300 border border-pink-500/40"
                      : "bg-zinc-800 text-zinc-500 border border-zinc-700/30 hover:text-zinc-300"
                  }`}>{n}</button>
              ))}
            </div>

            {/* Risk Selector */}
            <div className="flex gap-1.5 justify-center mb-3">
              {(["low", "medium", "high"] as const).map(rk => (
                <button key={rk} onClick={() => !dropping && setRisk(rk)} disabled={dropping}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                    risk === rk
                      ? rk === "high" ? "bg-red-500/30 text-red-300 border border-red-500/40" :
                        rk === "medium" ? "bg-yellow-500/30 text-yellow-300 border border-yellow-500/40" :
                        "bg-emerald-500/30 text-emerald-300 border border-emerald-500/40"
                      : "bg-zinc-800 text-zinc-500 border border-zinc-700/30 hover:text-zinc-300"
                  }`}>{rk}</button>
              ))}
            </div>

            {/* Chips */}
            <div className="flex gap-1.5 justify-center mb-3">
              {[0.10, 0.25, 0.50, 1, 2, 5].map(amt => {
                const label = amt < 1 ? `${Math.round(amt * 100)}¢` : `$${amt}`;
                const sel = selectedChip === amt;
                const dis = cash < amt * ballCount;
                const clr = CHIP_COLORS[amt];
                return (
                  <button key={amt} onClick={() => !dis && setSelectedChip(amt)} disabled={dis}
                    className={`w-10 h-10 rounded-full font-mono font-bold text-[9px] shadow-md border-[2.5px] border-dashed transition-all ${
                      dis ? "opacity-25 bg-gray-700 border-gray-600 text-gray-500" :
                      sel ? `bg-gradient-to-b ${clr.bg} ${clr.txt} ${clr.border} ring-2 ring-white/40` :
                      `bg-gradient-to-b ${clr.bg} ${clr.txt} ${clr.border} opacity-70 hover:opacity-100`
                    }`}>{label}</button>
                );
              })}
            </div>

            {/* Drop Button */}
            <motion.button
              whileHover={!dropping ? { scale: 1.01 } : {}}
              whileTap={!dropping ? { scale: 0.98 } : {}}
              onClick={handleDrop}
              disabled={dropping || !isAuthenticated || cash < selectedChip * ballCount}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm disabled:opacity-30 transition-colors shadow-lg"
            >
              {dropping ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                ballCount > 1
                  ? `DROP ${ballCount} BALLS · $${(selectedChip * ballCount).toFixed(2)}`
                  : `DROP · $${selectedChip.toFixed(2)}`}
            </motion.button>
          </div>
        </div>

        <p className="text-center text-[9px] text-zinc-700 mt-4 font-mono">2-3% house edge · $500 max payout</p>
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
```

---

## 6. Migration Steps

1. Replace `/client/src/pages/Plinko.tsx` with the code above
2. No server changes needed -- existing `drop` endpoint is called N times for multi-ball
3. Test with 1 ball first, then 3 and 5
4. Tune physics constants (GRAVITY, BOUNCE_VY, BOUNCE_VX_BASE) by feel

## 7. Tuning Guide

| Constant | Effect | Range |
|----------|--------|-------|
| GRAVITY | How fast ball accelerates down | 0.15-0.4 |
| BOUNCE_VY | How high ball bounces off pegs | -2.0 to -5.0 |
| BOUNCE_VX_BASE | How far ball moves horizontally per bounce | 2.0-4.0 |
| H_FRICTION | Horizontal slowdown (1.0 = none) | 0.95-0.99 |
| JITTER_DEG | Randomness in bounce angle | 0-10 |
| Board height (380px) | Vertical space for arcs | 350-450 |
