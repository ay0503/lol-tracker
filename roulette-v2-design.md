# Roulette V2 Design: Compact Board + Spinning Wheel

## Problem Summary

**Problem 1: Number cells are too big**
- Current: `aspect-ratio: 1` makes cells huge, board doesn't fit on screen
- Need: Compact layout where all 37 numbers + outside bets fit without scrolling

**Problem 2: No wheel animation**
- Current: Just a static result overlay shows the winning number
- Need: Actual spinning wheel animation when player hits SPIN

---

## Solution 1: Compact Betting Board

### Layout Strategy
Transform from a square-cell grid to a **dense horizontal roulette table layout**:

```
┌───┬─────────────────────────────────────────┬───────┐
│ 0 │  3  6  9 12 15 18 21 24 27 30 33 36   │ 2:1  │
│   ├─────────────────────────────────────────┤       │
│   │  2  5  8 11 14 17 20 23 26 29 32 35   │ 2:1  │
│   ├─────────────────────────────────────────┤       │
│   │  1  4  7 10 13 16 19 22 25 28 31 34   │ 2:1  │
└───┴─────────────────────────────────────────┴───────┘
    1st 12      2nd 12       3rd 12
    1-18 EVEN RED BLK ODD 19-36
```

### Cell Dimensions
- **Number cells**:
  - Mobile: `w-7 h-7` (28px square)
  - Desktop: `w-9 h-9` (36px square)
  - Remove `aspect-ratio: 1`, use fixed `w-` and `h-` classes

- **Zero cell**:
  - Height spans all 3 rows: `h-[calc(7rem+0.5rem)]` on mobile (3×28px + 2×2px gaps)
  - Width: same as number cells (`w-7` or `w-9`)

- **Column bet cells (2:1)**:
  - Same height as a number row, narrower width: `w-12 h-7` (mobile)

- **Dozen/Outside bets**:
  - Height: `h-7` (mobile)
  - Width: spans multiple columns (use `col-span-4` for dozens, `col-span-2` for outside bets in a 6-column grid)

### Typography
- **Number labels**: `text-[10px]` on mobile, `text-xs` on desktop
- **Outside bet labels**: `text-[8px]` on mobile, `text-[9px]` on desktop
- **Chip badges**: `w-3.5 h-3.5 text-[7px]` (currently `w-4 h-4 text-[7px]`)

### Grid Implementation
```tsx
{/* Main betting area: 4 columns (0 + 12 numbers + column bet) */}
<div className="grid grid-cols-[28px_repeat(12,28px)_48px] gap-0.5">
  {/* Row 1: Zero (rowspan 3) + Numbers 3,6,9...36 + 2:1 */}
  {/* Row 2: (zero continues) + Numbers 2,5,8...35 + 2:1 */}
  {/* Row 3: (zero continues) + Numbers 1,4,7...34 + 2:1 */}
</div>
```

Use a **single flat grid** instead of nested grids for precise control:
- Grid template: `grid-cols-[28px_repeat(12,28px)_48px]` (mobile)
- Zero cell: `row-span-3 col-start-1`
- Numbers: each gets exact column position
- Column bets: `col-start-14`

### Spacing
- Gap between cells: `gap-0.5` (2px) instead of `gap-1` (4px)
- Padding around board: reduce from `p-3 sm:p-5` to `p-2 sm:p-3`

### Current vs. Proposed Size
- **Current**: ~450px height for just the number grid (12 rows × ~36px cells)
- **Proposed**: ~90px for number grid (3 rows × 28px) + ~60px for outside bets = **150px total board** on mobile

---

## Solution 2: Spinning Wheel Animation

### Recommended Approach: **Horizontal Number Strip** (Option A)

**Why this approach:**
- Mobile-optimized: works great on small screens
- Simple to implement: just a scrolling flexbox with transform animations
- No canvas/SVG: pure CSS + framer-motion
- Familiar UX: like a slot machine but horizontal
- Fast performance: GPU-accelerated transforms

### Visual Design

```
┌─────────────────────────────────────────────────────┐
│  ←  [19] [4] [21] [2] [25] [17] [34] [6] ...  →   │
│              ▼ ▼ ▼                                  │
│          ┌─────────┐                                │
│          │   21    │  ← Winning number lands here   │
│          └─────────┘                                │
└─────────────────────────────────────────────────────┘
```

- **Strip container**: `h-24` (96px) on mobile, `h-32` (128px) on desktop
- **Number cells in strip**: circular badges, `w-14 h-14` on mobile
- **Winner indicator**: Fixed chevron or bracket above center position
- **Container**: Overflow hidden with gradient masks on edges for blur effect

### Number Order (European Wheel)
```tsx
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];
```

### Animation Sequence

#### Phase 1: Fast Spin (0-1.5s)
```tsx
<motion.div
  animate={{
    x: [0, -3000] // Rapid scroll through numbers
  }}
  transition={{
    duration: 1.5,
    ease: "easeIn"
  }}
>
```

#### Phase 2: Deceleration (1.5-4s)
```tsx
<motion.div
  animate={{
    x: -targetPosition // Calculated position where winner lands at center
  }}
  transition={{
    duration: 2.5,
    ease: [0.25, 0.1, 0.25, 1] // Cubic bezier for natural deceleration
  }}
>
```

#### Phase 3: Reveal & Pulse (4-5s)
- Winner cell scales up briefly: `scale: [1, 1.2, 1]`
- Glow effect with ring animation
- Hold for 1 second

#### Phase 4: Transition Out (5-6s)
- Fade out wheel container: `opacity: 0`
- Slide down betting board: `y: [20, 0]`
- Show result overlay on board

**Total duration: ~6 seconds**

### Implementation Structure

```tsx
// State
const [isSpinning, setIsSpinning] = useState(false);
const [spinPhase, setSpinPhase] = useState<'idle' | 'spinning' | 'stopping' | 'reveal'>('idle');

// Wheel strip component
const WheelStrip = ({ winningNumber, phase }) => {
  const stripRef = useRef<HTMLDivElement>(null);

  // Calculate winning position: center the winning number in viewport
  const getWinningPosition = (num: number) => {
    const winnerIndex = WHEEL_ORDER.indexOf(num);
    const cellWidth = 56; // w-14
    const gap = 8; // gap-2
    const containerWidth = window.innerWidth;

    // Position so winner is at center
    return -(winnerIndex * (cellWidth + gap)) + (containerWidth / 2) - (cellWidth / 2);
  };

  return (
    <div className="relative h-24 overflow-hidden bg-zinc-900/50 backdrop-blur">
      {/* Gradient masks */}
      <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-zinc-900 to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-zinc-900 to-transparent z-10" />

      {/* Center indicator */}
      <div className="absolute inset-x-0 top-2 flex justify-center z-20">
        <div className="text-yellow-400 text-2xl">▼</div>
      </div>

      {/* Scrolling number strip */}
      <motion.div
        className="absolute inset-0 flex items-center gap-2 px-4"
        animate={phase === 'spinning' ? {
          x: [0, -2000]
        } : phase === 'stopping' ? {
          x: getWinningPosition(winningNumber)
        } : {}}
        transition={
          phase === 'spinning' ? {
            duration: 1.5,
            ease: 'easeIn'
          } : phase === 'stopping' ? {
            duration: 2.5,
            ease: [0.25, 0.1, 0.25, 1]
          } : {}
        }
      >
        {/* Repeat wheel order 10x to ensure enough numbers during spin */}
        {Array(10).fill(WHEEL_ORDER).flat().map((num, i) => (
          <motion.div
            key={`${num}-${i}`}
            className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center font-bold text-sm ${
              getNumberColor(num) === 'green' ? 'bg-emerald-600' :
              getNumberColor(num) === 'red' ? 'bg-red-600' :
              'bg-zinc-800'
            } text-white border-2 border-white/10`}
            animate={phase === 'reveal' && num === winningNumber ? {
              scale: [1, 1.3, 1],
              borderColor: ['rgba(255,255,255,0.1)', 'rgba(250,204,21,1)', 'rgba(250,204,21,1)']
            } : {}}
          >
            {num}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
```

### Integration with Spin Flow

```tsx
const handleSpin = useCallback(() => {
  if (!canSpin) return;

  // 1. Prepare bets
  const betArray = prepareBets();

  // 2. Hide betting board, show wheel
  setIsSpinning(true);
  setSpinPhase('spinning');

  // 3. Call API
  spinMutation.mutate({ bets: betArray });
}, [bets, canSpin]);

// In mutation onSuccess:
onSuccess: (result) => {
  // Fast spin is already happening...

  // After 1.5s, transition to deceleration
  setTimeout(() => {
    setSpinPhase('stopping');
  }, 1500);

  // After 4s, reveal winner with pulse
  setTimeout(() => {
    setSpinPhase('reveal');
    setWinningNumber(result.number);
  }, 4000);

  // After 5s, hide wheel and show board with result overlay
  setTimeout(() => {
    setIsSpinning(false);
    setSpinPhase('idle');
    // Board's result overlay shows (existing code)
  }, 5000);

  // After 8s total, clear everything (existing 3s timer becomes 3s after wheel)
  setTimeout(() => {
    setWinningNumber(null);
    setBets([]);
  }, 8000);
}
```

### Mobile Considerations
- **Touch-safe**: No interaction during spin (disable betting board)
- **Performance**: Use `will-change: transform` on strip container
- **Size**: Compact height (24 = 96px) to leave room for board below
- **Orientation**: Horizontal layout works better than vertical on narrow screens

### Visual Polish
- **Sound effect** (optional): "tick tick tick" during fast spin, "ding" on reveal
- **Haptic feedback** (optional): Light vibration when winner stops
- **Gradient edges**: Blur effect on strip edges so numbers fade in/out smoothly
- **Background**: Semi-transparent dark overlay during spin so board is slightly visible but disabled

---

## Layout When Spinning

```
┌─────────────────────────────────────────┐
│          ROULETTE WHEEL STRIP           │
│  [19] [4] [21] [2] [25] [17] [34] ...   │
│              ▼                           │
│          [ 21 ] ← winner                 │
│                                          │  96px
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│      BETTING BOARD (dimmed/disabled)    │
│  0  │ 3  6  9  12...                    │
│     │ 2  5  8  11...                    │  150px
│     │ 1  4  7  10...                    │
│      Outside bets...                     │
└─────────────────────────────────────────┘

Total height on mobile: ~250px (fits in viewport)
```

---

## Alternative Approaches (Not Recommended)

### Option B: CSS Roulette Wheel (Circular)
- **Pros**: Looks like a real roulette wheel, premium feel
- **Cons**:
  - Complex CSS (conic-gradient for 37 segments, transform rotations)
  - Hard to make responsive (circular layout doesn't scale well on narrow phones)
  - Ball animation requires careful timing/physics simulation
  - Larger size requirement (~300px minimum for legibility)

### Option C: Vertical Drum
- **Pros**: Familiar slot machine UX
- **Cons**:
  - Takes up vertical space (bad for mobile where height is precious)
  - Less visually connected to roulette theme
  - Harder to see multiple numbers at once during spin

---

## Implementation Checklist

### Compact Board
- [ ] Replace `aspect-ratio: 1` with fixed `w-7 h-7` (mobile) / `w-9 h-9` (desktop)
- [ ] Restructure grid: single flat grid with explicit column positions
- [ ] Add zero cell with `row-span-3`
- [ ] Reduce gap from `gap-1` to `gap-0.5`
- [ ] Reduce padding from `p-3` to `p-2`
- [ ] Shrink chip badges to `w-3.5 h-3.5 text-[7px]`
- [ ] Test full board fits on iPhone SE (375×667) without scrolling

### Spinning Wheel
- [ ] Create WHEEL_ORDER constant (37 numbers in European wheel order)
- [ ] Build WheelStrip component with horizontal flexbox
- [ ] Add gradient edge masks
- [ ] Implement 4-phase animation (spin → decelerate → reveal → exit)
- [ ] Calculate winning position formula
- [ ] Add state: isSpinning, spinPhase
- [ ] Integrate with existing spin mutation flow
- [ ] Add conditional rendering: show wheel OR board
- [ ] Adjust timing: wheel animations + existing result overlay
- [ ] Test on mobile: performance, sizing, touch safety

---

## Expected Result

**Before**:
- Board: 450px tall, cells huge, scrolling required
- Spin: Static result popup, no animation

**After**:
- Board: 150px tall, compact grid, everything visible
- Spin: 6-second wheel animation → smooth reveal → board result overlay
- Total experience: Fits on phone, feels like real roulette
