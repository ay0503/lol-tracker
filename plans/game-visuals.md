# Game Visual Upgrades - Limbo, Hi-Lo, Wheel

---

## Limbo Visual Upgrade

### Rising Meter Animation

Replace the current simple counter (`displayMult` shown as `text-5xl` in the center) with a vertical progress meter that creates real tension.

**Current state:** The crash point is displayed as a big number that counts up from 1.00 to the final crashPoint. There is no spatial/visual representation of "how close" the result was to the target.

**New component: `<LimboMeter>`**

This replaces the `{/* Crash Point Display */}` block (lines 113-132 of Limbo.tsx).

```tsx
// Add to imports
import { useEffect, useMemo } from "react";

// Constants for the meter
const METER_HEIGHT = 192; // h-48 in px
const LOG_MIN = Math.log(1);    // 0
const LOG_MAX = Math.log(1000); // ~6.9

function logScale(value: number): number {
  // Maps a multiplier (1-1000) to 0-1 using log scale
  const clamped = Math.max(1, Math.min(1000, value));
  return (Math.log(clamped) - LOG_MIN) / (LOG_MAX - LOG_MIN);
}

interface LimboMeterProps {
  targetMultiplier: number;  // parsed from targetMult state
  displayMult: number | null;
  lastResult: any;
  playing: boolean;
  selectedChip: number;
}

function LimboMeter({ targetMultiplier, displayMult, lastResult, playing, selectedChip }: LimboMeterProps) {
  const targetPosition = logScale(targetMultiplier) * 100; // percentage from bottom
  const currentPosition = displayMult ? logScale(displayMult) * 100 : 0;
  const isWin = lastResult?.won;
  const isLoss = lastResult && !lastResult.won;
  const showResult = lastResult !== null;

  // Tick marks for the log scale axis
  const ticks = [
    { value: 1, label: "1x" },
    { value: 2, label: "2x" },
    { value: 5, label: "5x" },
    { value: 10, label: "10x" },
    { value: 50, label: "50x" },
    { value: 100, label: "100x" },
    { value: 1000, label: "1000x" },
  ];

  return (
    <div className="flex justify-center mb-6 py-4">
      <div className="flex items-end gap-3">
        {/* Y-axis labels */}
        <div className="relative h-48 w-10 flex-shrink-0">
          {ticks.map((tick) => {
            const pos = logScale(tick.value) * 100;
            return (
              <span
                key={tick.value}
                className="absolute right-0 text-[8px] font-mono text-zinc-500 -translate-y-1/2"
                style={{ bottom: `${pos}%` }}
              >
                {tick.label}
              </span>
            );
          })}
        </div>

        {/* The meter bar */}
        <div className="relative h-48 w-16 rounded-lg overflow-hidden bg-zinc-800/80 border border-zinc-700/50">
          {/* Background gradient (green bottom to red top) */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: "linear-gradient(to top, #22c55e, #eab308 50%, #ef4444)",
            }}
          />

          {/* Target line - horizontal marker */}
          <div
            className="absolute left-0 right-0 z-10 flex items-center"
            style={{ bottom: `${targetPosition}%`, transform: "translateY(50%)" }}
          >
            <div className="w-full h-[2px] bg-white/70 shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
            <span className="absolute -right-12 text-[9px] font-mono text-white/70 whitespace-nowrap">
              {targetMultiplier.toFixed(1)}x
            </span>
          </div>

          {/* Rising fill */}
          <motion.div
            className={`absolute bottom-0 left-0 right-0 rounded-b-lg ${
              isWin
                ? "bg-gradient-to-t from-emerald-500 to-emerald-400"
                : isLoss
                ? "bg-gradient-to-t from-red-500 to-red-400"
                : "bg-gradient-to-t from-violet-600 to-violet-400"
            }`}
            initial={{ height: "0%" }}
            animate={{
              height: displayMult !== null ? `${currentPosition}%` : "0%",
            }}
            transition={{
              duration: 0.05,
              ease: "linear",
            }}
          />

          {/* Glowing orb at the top of the fill */}
          {displayMult !== null && (
            <motion.div
              className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full z-20 ${
                isWin
                  ? "bg-emerald-400 shadow-[0_0_16px_4px_rgba(34,197,94,0.7)]"
                  : isLoss
                  ? "bg-red-400 shadow-[0_0_16px_4px_rgba(239,68,68,0.7)]"
                  : "bg-violet-300 shadow-[0_0_12px_4px_rgba(167,139,250,0.6)]"
              }`}
              style={{
                bottom: `${currentPosition}%`,
                transform: "translate(-50%, 50%)",
              }}
            />
          )}

          {/* Win explosion particles */}
          <AnimatePresence>
            {isWin && showResult && (
              <>
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={`particle-${i}`}
                    className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400"
                    style={{
                      left: "50%",
                      bottom: `${currentPosition}%`,
                    }}
                    initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
                    animate={{
                      scale: [0, 1.5, 0],
                      x: Math.cos((i * Math.PI * 2) / 8) * 30,
                      y: Math.sin((i * Math.PI * 2) / 8) * 30,
                      opacity: [1, 1, 0],
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Loss: red flash overlay */}
          <AnimatePresence>
            {isLoss && showResult && (
              <motion.div
                className="absolute inset-0 bg-red-500/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ duration: 0.5 }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Current multiplier readout (right side) */}
        <div className="flex-shrink-0 w-20">
          <motion.div
            className={`text-2xl font-bold font-mono ${
              isWin
                ? "text-[#00C805]"
                : isLoss
                ? "text-[#FF5252]"
                : playing
                ? "text-yellow-400"
                : "text-zinc-600"
            }`}
            key={displayMult ?? "idle"}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            {displayMult !== null ? `${displayMult.toFixed(2)}x` : "--"}
          </motion.div>
          {lastResult && (
            <p
              className={`text-xs font-mono mt-1 ${
                lastResult.won ? "text-[#00C805]" : "text-[#FF5252]"
              }`}
            >
              {lastResult.won
                ? `+$${lastResult.payout.toFixed(2)}`
                : `-$${selectedChip.toFixed(2)}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Integration in Limbo.tsx:**

Replace lines 113-132 (the `{/* Crash Point Display */}` section) with:

```tsx
<LimboMeter
  targetMultiplier={parsedTarget}
  displayMult={displayMult}
  lastResult={lastResult}
  playing={playing}
  selectedChip={selectedChip}
/>
```

No other changes needed -- the existing animation logic in `playMutation.onSuccess` still drives `displayMult` from 1.00 up to the crash point.

---

## Hi-Lo Visual Upgrade

### 1. 3D Card Flip

Replace the current `CardFace` component (lines 20-41 of Hilo.tsx) with a full flip card that shows a back face first, then rotates to reveal the front.

```tsx
import { useState, useCallback, useEffect, useRef } from "react";

// --- Card Back component ---
function CardBack() {
  return (
    <div
      className="absolute inset-0 rounded-xl border-2 border-blue-400/50 shadow-xl flex items-center justify-center"
      style={{
        backfaceVisibility: "hidden",
        transform: "rotateY(180deg)",
        background:
          "repeating-linear-gradient(45deg, #1e3a5f 0px, #1e3a5f 4px, #2a4a72 4px, #2a4a72 8px)",
      }}
    >
      <div className="w-16 h-24 rounded-lg border-2 border-blue-300/30 bg-blue-900/50 flex items-center justify-center">
        <span className="text-blue-300/50 text-xl font-bold">?</span>
      </div>
    </div>
  );
}

// --- Card Front component ---
function CardFront({ rank, suit }: { rank: number; suit: string }) {
  const label =
    rank === 14
      ? "A"
      : rank === 13
      ? "K"
      : rank === 12
      ? "Q"
      : rank === 11
      ? "J"
      : String(rank);
  const isRed = suit === "\u2665" || suit === "\u2666";

  return (
    <div
      className="absolute inset-0 rounded-xl bg-white border-2 border-zinc-200 shadow-xl flex flex-col items-center justify-center"
      style={{ backfaceVisibility: "hidden" }}
    >
      <div
        className={`absolute top-2 left-3 leading-tight ${
          isRed ? "text-red-500" : "text-gray-800"
        }`}
      >
        <div className="text-base font-extrabold">{label}</div>
        <div className="text-sm">{suit}</div>
      </div>
      <div className={`text-4xl ${isRed ? "text-red-500" : "text-gray-800"}`}>
        {suit}
      </div>
      <div
        className={`absolute bottom-2 right-3 leading-tight rotate-180 ${
          isRed ? "text-red-500" : "text-gray-800"
        }`}
      >
        <div className="text-base font-extrabold">{label}</div>
        <div className="text-sm">{suit}</div>
      </div>
    </div>
  );
}

// --- FlipCard: wraps front + back with 3D rotation ---
function FlipCard({
  rank,
  suit,
  flipKey,
  streakCount,
}: {
  rank: number;
  suit: string;
  flipKey: string | number; // changes to trigger a new flip
  streakCount: number;
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    // Reset to back, then flip after a beat
    setIsFlipped(false);
    const timer = setTimeout(() => setIsFlipped(true), 100);
    return () => clearTimeout(timer);
  }, [flipKey]);

  // Streak-based border glow
  const streakBorder =
    streakCount >= 10
      ? "ring-4 ring-yellow-400/60 shadow-[0_0_30px_rgba(250,204,21,0.4)]"
      : streakCount >= 5
      ? "ring-3 ring-purple-400/50 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
      : streakCount >= 3
      ? "ring-2 ring-blue-400/40 shadow-[0_0_12px_rgba(59,130,246,0.3)]"
      : "";

  return (
    <div
      className="w-24 h-36 sm:w-28 sm:h-40"
      style={{ perspective: "800px" }}
    >
      <motion.div
        className={`relative w-full h-full rounded-xl ${streakBorder}`}
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 0 : 180 }}
        transition={{
          duration: 0.6,
          type: "spring",
          stiffness: 180,
          damping: 18,
        }}
      >
        <CardFront rank={rank} suit={suit} />
        <CardBack />
      </motion.div>
    </div>
  );
}
```

**Integration:** Replace the `<CardFace>` usage at line 131 with:

```tsx
<FlipCard
  rank={game.currentCard.rank}
  suit={game.currentCard.suit}
  flipKey={`${game.currentCard.rank}-${game.currentCard.suit}-${game.history.length}`}
  streakCount={game.history.length}
/>
```

### 2. Streak Fire Effect

Add a streak indicator above the card area. The streak count comes from `game.history.length` (each correct guess adds to history).

```tsx
// Place this right above the {/* Current Card */} section

function StreakIndicator({ count }: { count: number }) {
  if (count < 3) return null;

  const fires =
    count >= 10 ? "\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25" :
    count >= 5  ? "\uD83D\uDD25\uD83D\uDD25" :
                  "\uD83D\uDD25";

  const color =
    count >= 10
      ? "text-yellow-400"
      : count >= 5
      ? "text-purple-400"
      : "text-blue-400";

  return (
    <motion.div
      className="text-center mb-2"
      initial={{ scale: 0, y: 10 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
    >
      <motion.span
        className={`text-lg font-bold font-mono ${color}`}
        animate={{
          textShadow: [
            "0 0 8px currentColor",
            "0 0 20px currentColor",
            "0 0 8px currentColor",
          ],
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {count} {fires}
      </motion.span>
    </motion.div>
  );
}
```

**Integration:** Add before the card display when the game is playing:

```tsx
{isPlaying && game && game.history.length >= 3 && (
  <StreakIndicator count={game.history.length} />
)}
```

### 3. Previous Cards Trail (Fanned Cards)

Replace the current flat card history strip (lines 116-126 of Hilo.tsx) with a fanned card trail.

```tsx
// Replaces the {/* Card History */} section

function CardTrail({ history }: { history: Array<{ rank: number; suit: string; label: string }> }) {
  if (history.length === 0) return null;

  // Show at most last 6 cards, fanned out
  const visible = history.slice(-6);

  return (
    <div className="relative h-24 mb-4 flex justify-center">
      <div className="relative w-48">
        {visible.map((card, idx) => {
          const total = visible.length;
          const offset = idx - (total - 1) / 2; // center the fan
          const rotation = offset * 8; // 8 degrees per card
          const translateX = offset * 18; // px offset
          const scale = 0.6 + (idx / total) * 0.3; // older = smaller
          const opacity = 0.4 + (idx / total) * 0.6; // older = more transparent
          const isRed = card.suit === "\u2665" || card.suit === "\u2666";

          return (
            <motion.div
              key={`trail-${idx}-${card.label}`}
              className="absolute left-1/2 top-0 w-12 h-[68px] rounded-lg bg-white border border-zinc-300 shadow-md flex items-center justify-center"
              initial={{ scale: 0, rotate: 0, x: "-50%" }}
              animate={{
                scale,
                rotate: rotation,
                x: `calc(-50% + ${translateX}px)`,
                opacity,
              }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              style={{ zIndex: idx, transformOrigin: "bottom center" }}
            >
              <span
                className={`text-xs font-bold ${
                  isRed ? "text-red-500" : "text-gray-800"
                }`}
              >
                {card.label}
                <span className="text-[10px]">{card.suit}</span>
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
```

**Integration:** Replace lines 116-126 with:

```tsx
{game && game.history.length > 0 && (
  <CardTrail history={game.history} />
)}
```

---

## Wheel Visual Upgrade

### 1. Segment Labels on the Wheel

Add rotated text labels to each segment. This requires an SVG overlay on top of the conic-gradient wheel. Place this inside the spinning wheel `<div>` (after the conic-gradient div, before the center hub).

```tsx
// Segment label overlay - goes inside the wheel container div, as a child alongside the conic-gradient
function WheelLabels({ segments }: { segments: number[] }) {
  const segAngle = 360 / segments.length; // 7.2 degrees per segment

  return (
    <div className="absolute inset-0">
      {segments.map((mult, idx) => {
        if (mult === 0) return null; // skip 0x labels -- too cluttered
        const angle = idx * segAngle + segAngle / 2; // midpoint of segment

        return (
          <div
            key={`label-${idx}`}
            className="absolute left-1/2 top-1/2 origin-center pointer-events-none"
            style={{
              transform: `rotate(${angle}deg) translateY(-42%) rotate(0deg)`,
              width: 0,
              height: 0,
            }}
          >
            <span
              className="text-[5px] sm:text-[6px] font-mono font-bold text-white/80 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] whitespace-nowrap"
              style={{
                position: "absolute",
                transform: "translate(-50%, -50%)",
              }}
            >
              {mult}x
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

**Integration:** Add as a child inside the spinning wheel div (the one with `conic-gradient`), before the center hub:

```tsx
<div
  className="w-56 h-56 sm:w-64 sm:h-64 rounded-full border-4 border-zinc-700 shadow-2xl relative"
  style={{
    background: `conic-gradient(${conicStops})`,
    transform: `rotate(${rotation}deg)`,
    transition: spinning ? "transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
  }}
>
  {/* ADD: Segment labels */}
  <WheelLabels segments={SEGMENTS} />

  {/* Existing center hub */}
  <div className="absolute inset-0 flex items-center justify-center">
    {/* ... */}
  </div>
</div>
```

Note: Add `relative` to the wheel div's className (it currently lacks it, which would prevent absolute children from positioning correctly).

### 2. Light Chase Effect (Rim LEDs)

Add a ring of "LED" dots around the wheel rim that animate during spins.

```tsx
const NUM_LEDS = 24;

function WheelLEDs({ spinning, landed }: { spinning: boolean; landed: boolean }) {
  return (
    <div className="absolute inset-[-8px] pointer-events-none">
      {Array.from({ length: NUM_LEDS }).map((_, i) => {
        const angle = (i / NUM_LEDS) * 360;
        const delay = (i / NUM_LEDS) * 0.3; // stagger for chase effect

        return (
          <motion.div
            key={`led-${i}`}
            className="absolute w-2 h-2 rounded-full"
            style={{
              left: "50%",
              top: "50%",
              transform: `rotate(${angle}deg) translateY(-${50 + 4}%) translate(-50%, -50%)`,
              // translateY is half the container + offset for rim
            }}
            animate={
              spinning
                ? {
                    backgroundColor: ["#ffffff20", "#facc15", "#ffffff20"],
                    boxShadow: [
                      "0 0 0px #facc1500",
                      "0 0 8px #facc15",
                      "0 0 0px #facc1500",
                    ],
                  }
                : landed
                ? {
                    backgroundColor: ["#facc15", "#ffffff80", "#facc15"],
                    boxShadow: [
                      "0 0 4px #facc15",
                      "0 0 12px #facc15",
                      "0 0 4px #facc15",
                    ],
                  }
                : {
                    backgroundColor: "#ffffff15",
                    boxShadow: "0 0 0px transparent",
                  }
            }
            transition={
              spinning
                ? {
                    duration: 0.3,
                    repeat: Infinity,
                    delay: delay,
                    ease: "linear",
                  }
                : landed
                ? {
                    duration: 0.8,
                    repeat: 3,
                    ease: "easeInOut",
                  }
                : { duration: 0.3 }
            }
          />
        );
      })}
    </div>
  );
}
```

**Integration:** Wrap the wheel in a container that allows the LEDs to extend beyond the wheel edge. Add this as a sibling to the spinning wheel div, inside the `{/* Wheel */}` container div (line 126):

```tsx
<div className="relative flex justify-center mb-4">
  {/* Pointer (existing) */}
  ...

  {/* LED ring container */}
  <div className="relative">
    <WheelLEDs spinning={spinning} landed={lastResult !== null} />

    {/* Spinning Wheel (existing, unchanged) */}
    <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-full ...">
      ...
    </div>
  </div>
</div>
```

### 3. Pointer Bounce

Replace the static CSS triangle pointer (lines 128-130) with a motion-animated pointer that wobbles when the wheel decelerates.

```tsx
function WheelPointer({ spinning }: { spinning: boolean }) {
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
      <motion.div
        animate={
          spinning
            ? {
                rotate: [0, -5, 5, -3, 3, 0],
              }
            : { rotate: 0 }
        }
        transition={
          spinning
            ? {
                duration: 0.15,
                repeat: Infinity,
                ease: "linear",
              }
            : {
                type: "spring",
                stiffness: 300,
                damping: 8,
                // Spring wobble when spinning stops
              }
        }
        style={{ transformOrigin: "top center" }}
      >
        <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-[0_2px_4px_rgba(250,204,21,0.5)]" />
      </motion.div>
    </div>
  );
}
```

**Integration:** Replace lines 128-130 with:

```tsx
<WheelPointer spinning={spinning} />
```

To make the pointer wobble specifically during deceleration, add a `decelerating` state:

```tsx
// Add to Wheel component state:
const [decelerating, setDecelerating] = useState(false);

// In spinMutation.onSuccess, after setting rotation:
setDecelerating(false);
// Start deceleration wobble after 2 seconds (the wheel is slowing down)
setTimeout(() => setDecelerating(true), 2000);
// Stop wobble when wheel stops
setTimeout(() => setDecelerating(false), 3500);
```

Then pass `decelerating` to `WheelPointer` for a more aggressive wobble during that phase.

### 4. Win Confetti (5x+ Wins)

Add a confetti burst from the center of the wheel when the result is 5x or higher.

```tsx
function WinConfetti({ multiplier, show }: { multiplier: number; show: boolean }) {
  if (!show || multiplier < 5) return null;

  const emojis = ["\uD83C\uDF89", "\u2728", "\uD83D\uDCB0", "\uD83C\uDF1F", "\uD83C\uDF86", "\uD83D\uDCB5"];
  const particleCount = multiplier >= 50 ? 20 : multiplier >= 10 ? 15 : 10;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {Array.from({ length: particleCount }).map((_, i) => {
        const emoji = emojis[i % emojis.length];
        const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.5;
        const distance = 100 + Math.random() * 80;
        const targetX = Math.cos(angle) * distance;
        const targetY = Math.sin(angle) * distance;

        return (
          <motion.span
            key={`confetti-${i}`}
            className="absolute left-1/2 top-1/2 text-lg"
            initial={{
              x: 0,
              y: 0,
              scale: 0,
              opacity: 1,
            }}
            animate={{
              x: targetX,
              y: targetY,
              scale: [0, 1.5, 1],
              opacity: [1, 1, 0],
              rotate: Math.random() * 360,
            }}
            transition={{
              duration: 1.2,
              ease: "easeOut",
              delay: i * 0.03,
            }}
          >
            {emoji}
          </motion.span>
        );
      })}
    </div>
  );
}
```

**Integration:** Add inside the wheel container div, after the spinning wheel:

```tsx
<WinConfetti
  multiplier={lastResult?.multiplier ?? 0}
  show={lastResult !== null}
/>
```

---

## Summary of Changes Per File

### Limbo.tsx
- Add `LimboMeter` component (defined inline or extract to component file)
- Replace lines 113-132 (Crash Point Display) with `<LimboMeter>` usage
- No new dependencies needed (already uses `motion`, `AnimatePresence`)

### Hilo.tsx
- Replace `CardFace` with `CardBack`, `CardFront`, and `FlipCard` components
- Add `StreakIndicator` component
- Add `CardTrail` component replacing the flat history strip
- Update `CardFace` usage at line 131 to `FlipCard`
- No new dependencies (already uses `framer-motion`)

### Wheel.tsx
- Add `WheelLabels` component (rotated segment text)
- Add `WheelLEDs` component (chasing rim lights)
- Replace pointer with `WheelPointer` component (spring wobble)
- Add `WinConfetti` component (emoji particle burst)
- Add `relative` to the wheel div's className
- Add `decelerating` state for pointer animation phase
- No new dependencies needed
