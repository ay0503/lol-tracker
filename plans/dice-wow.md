# Dice Game Visual Overhaul -- $DORI Casino WOW Factor

## Current State

The dice game at `client/src/pages/Dice.tsx` shows a big number that flickers through random values for ~750ms, then reveals the result. There is no spatial relationship between the roll, the target, and the win/lose zones. The entire experience is flat and forgettable.

## Visual Concept

The redesign is inspired by Stake.com's dice game and real-casino psychology:

1. **Spatial anticipation** -- a horizontal result bar makes the roll *visible* as a race toward (or away from) your target. You can SEE yourself winning or losing in real time.
2. **Kinetic deceleration** -- the indicator starts fast and slows down near the result, building suspense exactly like a roulette ball finding its slot.
3. **Instant emotional feedback** -- green explosion on win, red shake on loss, particle burst, glow. The dopamine hit is immediate.
4. **Ambient tension** -- pulsing target line, glowing stats panels at high-risk settings, and a tumbling 3D die keep the screen alive even when idle.

---

## Improvement 1: Animated Number Bar (the hero element)

### Layout

A full-width horizontal bar (height ~48px, rounded-xl) replaces the giant number as the primary visual. The number still shows above the bar but smaller.

```
[ GREEN ZONE ||||||||TARGET LINE|||||||| RED ZONE ]
                        ^
                   rolling indicator
```

- "Over" mode: everything RIGHT of the target line is green (win zone), left is red (lose zone).
- "Under" mode: reversed.

### Bar background -- color gradient

```tsx
// The bar container
<div className="relative w-full h-12 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700/50">
  {/* Lose zone */}
  <div
    className="absolute inset-y-0 left-0 transition-all duration-300"
    style={{
      width: `${target}%`,
      background: direction === "under"
        ? "linear-gradient(90deg, rgba(0,200,5,0.25) 0%, rgba(0,200,5,0.4) 100%)"
        : "linear-gradient(90deg, rgba(255,82,82,0.2) 0%, rgba(255,82,82,0.35) 100%)",
    }}
  />
  {/* Win zone */}
  <div
    className="absolute inset-y-0 right-0 transition-all duration-300"
    style={{
      width: `${100 - target}%`,
      background: direction === "over"
        ? "linear-gradient(90deg, rgba(0,200,5,0.25) 0%, rgba(0,200,5,0.4) 100%)"
        : "linear-gradient(90deg, rgba(255,82,82,0.2) 0%, rgba(255,82,82,0.35) 100%)",
    }}
  />

  {/* Tick marks every 10 units */}
  {Array.from({ length: 9 }, (_, i) => (i + 1) * 10).map(tick => (
    <div
      key={tick}
      className="absolute top-0 bottom-0 w-px bg-white/[0.06]"
      style={{ left: `${tick}%` }}
    />
  ))}

  {/* Target line -- pulses gently when idle */}
  <motion.div
    className="absolute top-0 bottom-0 w-0.5 z-10"
    style={{ left: `${target}%` }}
    animate={!rolling ? { opacity: [0.6, 1, 0.6], boxShadow: [
      "0 0 8px rgba(250,204,21,0.4)",
      "0 0 16px rgba(250,204,21,0.8)",
      "0 0 8px rgba(250,204,21,0.4)",
    ]} : { opacity: 1 }}
    transition={{ duration: 2, repeat: Infinity }}
  >
    <div className="w-full h-full bg-yellow-400" />
    {/* Target label */}
    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-yellow-400">
      {target}
    </div>
  </motion.div>

  {/* Rolling indicator */}
  {displayRoll !== null && (
    <motion.div
      className="absolute top-1 bottom-1 w-1 rounded-full z-20"
      style={{
        background: "white",
        boxShadow: "0 0 12px rgba(255,255,255,0.8), 0 0 24px rgba(255,255,255,0.4)",
      }}
      initial={{ left: "0%" }}
      animate={{ left: `${displayRoll}%` }}
      transition={{
        duration: 1.2,
        ease: [0.22, 1, 0.36, 1], // custom deceleration curve
      }}
    />
  )}
</div>
```

### Rolling animation logic (replaces the random-number interval)

Replace the current `setInterval` approach with a framer-motion driven animation. The key insight: we get the result from the server immediately, then animate TO that result with a decelerating ease.

```tsx
const rollMutation = trpc.casino.dice.roll.useMutation({
  onSuccess: (result) => {
    setRolling(true);
    setDisplayRoll(0); // start indicator at 0

    // Phase 1: quick overshoot animation (framer-motion handles this via the bar)
    // We set the target and let the spring/ease animate
    requestAnimationFrame(() => {
      setDisplayRoll(result.roll); // framer-motion animates from 0 -> result.roll
    });

    // Phase 2: after animation completes (~1.2s), reveal result
    setTimeout(() => {
      setRolling(false);
      setLastResult(result);
      refetchBalance();
      refetchHistory();

      if (result.won) {
        setBarFlash("win");
        toast.success(`${result.roll.toFixed(2)} -- Won $${result.payout.toFixed(2)}`);
      } else {
        setBarFlash("lose");
        toast.error(`${result.roll.toFixed(2)} -- Lost`);
      }

      setTimeout(() => {
        setBarFlash(null);
        setLastResult(null);
        setDisplayRoll(null);
      }, 3000);
    }, 1400);
  },
});
```

### Win/Lose flash on the bar

```tsx
const [barFlash, setBarFlash] = useState<"win" | "lose" | null>(null);

// Wrap the bar in:
<motion.div
  animate={
    barFlash === "win"
      ? { boxShadow: ["0 0 0px rgba(0,200,5,0)", "0 0 40px rgba(0,200,5,0.6)", "0 0 0px rgba(0,200,5,0)"] }
      : barFlash === "lose"
      ? { boxShadow: ["0 0 0px rgba(255,82,82,0)", "0 0 40px rgba(255,82,82,0.6)", "0 0 0px rgba(255,82,82,0)"] }
      : {}
  }
  transition={{ duration: 0.6 }}
  className="relative w-full h-12 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700/50"
>
```

---

## Improvement 2: Rolling 3D Dice Visual

A CSS 3D cube that tumbles while the bar animation plays, then lands on a face.

### CSS for the 3D cube

```css
.dice-scene {
  width: 60px;
  height: 60px;
  perspective: 200px;
  margin: 0 auto;
}

.dice-cube {
  width: 60px;
  height: 60px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 1.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.dice-cube.rolling {
  animation: tumble 0.4s linear infinite;
}

@keyframes tumble {
  0%   { transform: rotateX(0deg)   rotateY(0deg)   rotateZ(0deg); }
  25%  { transform: rotateX(90deg)  rotateY(45deg)  rotateZ(0deg); }
  50%  { transform: rotateX(180deg) rotateY(90deg)  rotateZ(90deg); }
  75%  { transform: rotateX(270deg) rotateY(135deg) rotateZ(90deg); }
  100% { transform: rotateX(360deg) rotateY(180deg) rotateZ(0deg); }
}

.dice-face {
  position: absolute;
  width: 60px;
  height: 60px;
  border-radius: 8px;
  background: linear-gradient(135deg, #2a2a3a, #1a1a2a);
  border: 1px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  backface-visibility: hidden;
}

.dice-face.front  { transform: translateZ(30px); }
.dice-face.back   { transform: rotateY(180deg) translateZ(30px); }
.dice-face.right  { transform: rotateY(90deg) translateZ(30px); }
.dice-face.left   { transform: rotateY(-90deg) translateZ(30px); }
.dice-face.top    { transform: rotateX(90deg) translateZ(30px); }
.dice-face.bottom { transform: rotateX(-90deg) translateZ(30px); }

/* Dot styling */
.dice-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #ffffff, #aaaacc);
  box-shadow: 0 0 4px rgba(255,255,255,0.3);
}
```

### React component

```tsx
function DiceCube({ rolling, resultFace }: { rolling: boolean; resultFace: number }) {
  // Map result (0-99) to a face 1-6
  const face = resultFace !== null ? (Math.floor(resultFace / 16.67) % 6) + 1 : 1;

  // Rotation needed to show each face
  const faceRotations: Record<number, string> = {
    1: "rotateX(0deg) rotateY(0deg)",
    2: "rotateX(0deg) rotateY(-90deg)",
    3: "rotateX(-90deg) rotateY(0deg)",
    4: "rotateX(90deg) rotateY(0deg)",
    5: "rotateX(0deg) rotateY(90deg)",
    6: "rotateX(180deg) rotateY(0deg)",
  };

  return (
    <div className="dice-scene">
      <div
        className={`dice-cube ${rolling ? "rolling" : ""}`}
        style={!rolling ? { transform: faceRotations[face] } : undefined}
      >
        <div className="dice-face front"><DiceDots count={1} /></div>
        <div className="dice-face back"><DiceDots count={6} /></div>
        <div className="dice-face right"><DiceDots count={2} /></div>
        <div className="dice-face left"><DiceDots count={5} /></div>
        <div className="dice-face top"><DiceDots count={3} /></div>
        <div className="dice-face bottom"><DiceDots count={4} /></div>
      </div>
    </div>
  );
}

function DiceDots({ count }: { count: number }) {
  // Standard dice dot layouts using CSS grid
  const layouts: Record<number, string[]> = {
    1: ["col-start-2 row-start-2"],
    2: ["col-start-3 row-start-1", "col-start-1 row-start-3"],
    3: ["col-start-3 row-start-1", "col-start-2 row-start-2", "col-start-1 row-start-3"],
    4: ["col-start-1 row-start-1", "col-start-3 row-start-1", "col-start-1 row-start-3", "col-start-3 row-start-3"],
    5: ["col-start-1 row-start-1", "col-start-3 row-start-1", "col-start-2 row-start-2", "col-start-1 row-start-3", "col-start-3 row-start-3"],
    6: ["col-start-1 row-start-1", "col-start-3 row-start-1", "col-start-1 row-start-2", "col-start-3 row-start-2", "col-start-1 row-start-3", "col-start-3 row-start-3"],
  };

  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-1 p-3 w-full h-full">
      {layouts[count].map((pos, i) => (
        <div key={i} className={`dice-dot ${pos} place-self-center`} />
      ))}
    </div>
  );
}
```

Place the 3D die above the number bar, centered. It tumbles during the roll, then snaps to a face when the result lands.

---

## Improvement 3: Sound-like Visual Cues

### Tick marks that "click" as the indicator passes

The tick marks at every 10 units already exist in the bar. When the indicator crosses a tick mark, that tick briefly flashes bright white then fades:

```tsx
const [passedTicks, setPassedTicks] = useState<Set<number>>(new Set());

// In the animation frame callback (or useEffect watching displayRoll):
useEffect(() => {
  if (displayRoll === null) { setPassedTicks(new Set()); return; }
  const newPassed = new Set<number>();
  for (let t = 10; t <= 90; t += 10) {
    if (displayRoll >= t) newPassed.add(t);
  }
  setPassedTicks(newPassed);
}, [displayRoll]);

// In the bar, modify tick rendering:
{Array.from({ length: 9 }, (_, i) => (i + 1) * 10).map(tick => (
  <motion.div
    key={tick}
    className="absolute top-0 bottom-0 w-px"
    style={{ left: `${tick}%` }}
    animate={{
      backgroundColor: passedTicks.has(tick) ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.06)",
      scaleY: passedTicks.has(tick) ? 1.15 : 1,
    }}
    transition={{ duration: 0.15 }}
  />
))}
```

### Speed lines / motion blur on the indicator

During the fast phase of the animation (first ~40% of the ease), show a trailing "comet tail" behind the indicator:

```tsx
{displayRoll !== null && (
  <motion.div
    className="absolute top-1 bottom-1 z-20 pointer-events-none"
    initial={{ left: "0%", width: "0%" }}
    animate={{
      left: `${Math.max(0, displayRoll - 8)}%`,
      width: rolling ? "8%" : "0.25%",  // long tail while fast, shrinks as it decelerates
    }}
    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
    style={{
      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), rgba(255,255,255,0.8))",
      borderRadius: "4px",
      filter: "blur(1px)",
    }}
  />
)}
```

### Particle burst on win

Use framer-motion to spawn ~12 particles that radiate outward from the indicator position on win:

```tsx
function WinParticles({ x }: { x: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 360;
        const distance = 40 + Math.random() * 30;
        const dx = Math.cos((angle * Math.PI) / 180) * distance;
        const dy = Math.sin((angle * Math.PI) / 180) * distance;
        return (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-[#00C805]"
            style={{ left: `${x}%`, top: "50%" }}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: 0, x: dx, y: dy, scale: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

// Usage: render inside the bar container when barFlash === "win"
{barFlash === "win" && displayRoll !== null && <WinParticles x={displayRoll} />}
```

---

## Improvement 4: Color Gradient Bar (detailed)

The bar background uses a split-zone approach rather than a single gradient, so the player always knows which side is win vs. lose.

### Win zone pattern overlay

Add a subtle diagonal stripe pattern to the win zone for texture:

```tsx
<div
  className="absolute inset-y-0"
  style={{
    left: direction === "over" ? `${target}%` : "0%",
    right: direction === "under" ? `${100 - target}%` : "0%",
    backgroundImage: `repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 4px,
      rgba(0,200,5,0.05) 4px,
      rgba(0,200,5,0.05) 8px
    )`,
  }}
/>
```

### Target line with flag label

The target line already pulses (see Improvement 1). Add a small triangular flag at the top:

```tsx
<div
  className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0"
  style={{
    borderLeft: "5px solid transparent",
    borderRight: "5px solid transparent",
    borderTop: "6px solid #facc15",
  }}
/>
```

---

## Improvement 5: Stats Panel Glow

The Multiplier and Win Chance panels should glow when values enter high-risk territory (multiplier > 5x or win chance < 20%).

```tsx
const highRisk = multiplier > 5 || winChance < 20;

<motion.div
  className="bg-zinc-800/50 rounded-lg p-2.5 text-center"
  animate={highRisk ? {
    boxShadow: [
      "0 0 0px rgba(250,204,21,0)",
      "0 0 15px rgba(250,204,21,0.3)",
      "0 0 0px rgba(250,204,21,0)",
    ],
    borderColor: ["rgba(250,204,21,0)", "rgba(250,204,21,0.4)", "rgba(250,204,21,0)"],
  } : {}}
  transition={{ duration: 2, repeat: Infinity }}
  style={{ border: "1px solid transparent" }}
>
  <p className="text-[9px] text-zinc-500 uppercase">Multiplier</p>
  <p className={`text-lg font-bold font-mono ${highRisk ? "text-yellow-300" : "text-yellow-400"}`}>
    {multiplier}x
  </p>
</motion.div>
```

When `multiplier > 10`, upgrade the glow to red/orange:

```tsx
const extremeRisk = multiplier > 10;

// Use these colors instead:
// boxShadow pulse: rgba(255,82,82,0.4)
// borderColor pulse: rgba(255,82,82,0.5)
// text: text-red-400
```

---

## Implementation Order

1. **Add state variables**: `barFlash`, `passedTicks` -- minimal new state.
2. **Replace the Roll Display section** (lines 108-126) with the horizontal bar + number readout above it.
3. **Add the 3D dice** above the bar (lines ~107). Include the CSS in a `<style>` tag or a separate CSS file.
4. **Replace the `onSuccess` handler** (lines 34-56) with the new deceleration-based animation.
5. **Add particle burst** and tick-flash effects.
6. **Wrap stats panels** with the glow animation.

All of this fits in a single `Dice.tsx` file. The only new dependency consideration is that `framer-motion` is already imported. No new packages needed.

---

## Complete New Component Layout (top to bottom)

```
[Back to Casino link]
[Title + Balance]
[History strip -- unchanged]
[3D Dice Cube -- tumbles during roll]
[Result Number -- smaller, above bar]
[=============== RESULT BAR ===============]  <-- hero element
[  green/red zones | target line | indicator ]
[  tick marks | particles on win            ]
[Win/Lose payout text]
[Target Slider -- unchanged]
[Over / Under buttons -- unchanged]
[Multiplier | Win Chance -- with glow]
[Chip selector -- unchanged]
[ROLL button -- unchanged]
```

---

## Key framer-motion Config Summary

| Animation | Duration | Easing | Trigger |
|-----------|----------|--------|---------|
| Indicator race across bar | 1.2s | `[0.22, 1, 0.36, 1]` (decel) | Roll result received |
| Target line pulse | 2s loop | sinusoidal | Always (idle) |
| Win bar flash | 0.6s | default | `barFlash === "win"` |
| Lose bar flash | 0.6s | default | `barFlash === "lose"` |
| Particle burst | 0.6s | easeOut | Win |
| Tick mark flash | 0.15s | default | Indicator crosses tick |
| 3D cube tumble | 0.4s loop | linear | `rolling === true` |
| 3D cube land | 1.2s | same decel curve | `rolling === false` |
| Stats glow | 2s loop | sinusoidal | `highRisk === true` |
| Comet tail shrink | 1.2s | same decel curve | During roll |
