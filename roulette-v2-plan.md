# Roulette UI v2 - Implementation Plan

## Overview
Complete redesign of the roulette betting board and wheel animation to create a compact, authentic casino experience optimized for mobile.

---

## 1. COMPACT BETTING BOARD LAYOUT

### Grid Structure - Traditional Horizontal Layout

**Current problem**: `aspect-ratio: 1` makes cells huge (100px+), board scrolls vertically on mobile.

**Solution**: Fixed cell sizes, horizontal traditional layout.

#### Layout Diagram
```
┌────┬──────────────────────────────────────────────┬────┐
│    │  3   6   9  12  15  18  21  24  27  30  33  36│ 2:1│ Row 1 (top)
│ 0  ├──────────────────────────────────────────────┤────┤
│    │  2   5   8  11  14  17  20  23  26  29  32  35│ 2:1│ Row 2 (mid)
│    ├──────────────────────────────────────────────┤────┤
│    │  1   4   7  10  13  16  19  22  25  28  31  34│ 2:1│ Row 3 (bot)
└────┴──────────────────────────────────────────────┴────┘
     ├────────┬────────┬────────┤  Dozens
     │  1st12 │ 2nd12  │  3rd12 │
     ├──┬──┬──┬──┬──┬──┤  Outside bets
     │1-│Ev│Re│Bl│Od│19│
     │18│en│d │k │d │36│
     └──┴──┴──┴──┴──┴──┘
```

#### Cell Dimensions
```tsx
// Number cells (0-36)
className="w-6 h-6 sm:w-8 sm:h-8 text-[9px] sm:text-[11px]"
// Mobile: 24×24px, Desktop: 32×32px

// Chip badge
className="w-3 h-3 text-[7px]"
// 12×12px, positioned absolute top-right

// Column bets (2:1) - same height as number row
className="w-6 h-6 sm:w-8 sm:h-8"

// Dozens - span 4 columns each
className="h-6 sm:h-8 text-[9px] sm:text-[10px]"

// Outside bets - span 2 columns each
className="h-6 sm:h-8 text-[8px] sm:text-[9px]"
```

#### Component Structure Changes

**Replace existing board section (lines 309-415) with:**

```tsx
{/* Betting Board */}
<div className="space-y-0.5 sm:space-y-1">
  {/* Main grid: Zero (left) + Numbers + Column bets (right) */}
  <div className="flex gap-0.5 sm:gap-1">
    {/* Zero - spans 3 rows */}
    <div className="flex">
      <NumberCell
        num={0}
        color="green"
        betAmount={getBetAmount("straight-0")}
        isWinner={winningNumber === 0}
        onClick={() => placeBet("straight-0", "straight", 0)}
        className="w-6 h-[calc(3*1.5rem+0.25rem)] sm:w-8 sm:h-[calc(3*2rem+0.5rem)]"
      />
    </div>

    {/* Number grid: 12 columns × 3 rows */}
    <div className="flex-1">
      {/* Row 1 (top): 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36 */}
      <div className="grid grid-cols-12 gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
        {[3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map(num => (
          <NumberCell
            key={num}
            num={num}
            color={getNumberColor(num)}
            betAmount={getBetAmount(`straight-${num}`)}
            isWinner={winningNumber === num}
            onClick={() => placeBet(`straight-${num}`, "straight", num)}
            className="w-6 h-6 sm:w-8 sm:h-8"
          />
        ))}
      </div>

      {/* Row 2 (mid): 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35 */}
      <div className="grid grid-cols-12 gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
        {[2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35].map(num => (
          <NumberCell
            key={num}
            num={num}
            color={getNumberColor(num)}
            betAmount={getBetAmount(`straight-${num}`)}
            isWinner={winningNumber === num}
            onClick={() => placeBet(`straight-${num}`, "straight", num)}
            className="w-6 h-6 sm:w-8 sm:h-8"
          />
        ))}
      </div>

      {/* Row 3 (bot): 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34 */}
      <div className="grid grid-cols-12 gap-0.5 sm:gap-1">
        {[1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34].map(num => (
          <NumberCell
            key={num}
            num={num}
            color={getNumberColor(num)}
            betAmount={getBetAmount(`straight-${num}`)}
            isWinner={winningNumber === num}
            onClick={() => placeBet(`straight-${num}`, "straight", num)}
            className="w-6 h-6 sm:w-8 sm:h-8"
          />
        ))}
      </div>
    </div>

    {/* Column bets (2:1) - vertical on the right */}
    <div className="flex flex-col gap-0.5 sm:gap-1">
      <OutsideBetCell
        label="2:1"
        betAmount={getBetAmount("column3")}
        isWinner={winningNumber !== null && winningNumber % 3 === 0 && winningNumber !== 0}
        onClick={() => placeBet("column3", "column3")}
        className="w-6 h-6 sm:w-8 sm:h-8"
      />
      <OutsideBetCell
        label="2:1"
        betAmount={getBetAmount("column2")}
        isWinner={winningNumber !== null && winningNumber % 3 === 2}
        onClick={() => placeBet("column2", "column2")}
        className="w-6 h-6 sm:w-8 sm:h-8"
      />
      <OutsideBetCell
        label="2:1"
        betAmount={getBetAmount("column1")}
        isWinner={winningNumber !== null && winningNumber % 3 === 1}
        onClick={() => placeBet("column1", "column1")}
        className="w-6 h-6 sm:w-8 sm:h-8"
      />
    </div>
  </div>

  {/* Dozens row */}
  <div className="grid grid-cols-12 gap-0.5 sm:gap-1">
    <OutsideBetCell
      label="1st 12"
      betAmount={getBetAmount("dozen1")}
      isWinner={winningNumber !== null && winningNumber >= 1 && winningNumber <= 12}
      onClick={() => placeBet("dozen1", "dozen1")}
      className="col-span-4 h-6 sm:h-8"
    />
    <OutsideBetCell
      label="2nd 12"
      betAmount={getBetAmount("dozen2")}
      isWinner={winningNumber !== null && winningNumber >= 13 && winningNumber <= 24}
      onClick={() => placeBet("dozen2", "dozen2")}
      className="col-span-4 h-6 sm:h-8"
    />
    <OutsideBetCell
      label="3rd 12"
      betAmount={getBetAmount("dozen3")}
      isWinner={winningNumber !== null && winningNumber >= 25 && winningNumber <= 36}
      onClick={() => placeBet("dozen3", "dozen3")}
      className="col-span-4 h-6 sm:h-8"
    />
  </div>

  {/* Outside bets row */}
  <div className="grid grid-cols-6 gap-0.5 sm:gap-1">
    <OutsideBetCell
      label="1-18"
      betAmount={getBetAmount("low")}
      isWinner={winningNumber !== null && winningNumber >= 1 && winningNumber <= 18}
      onClick={() => placeBet("low", "low")}
      className="h-6 sm:h-8"
    />
    <OutsideBetCell
      label="EVEN"
      betAmount={getBetAmount("even")}
      isWinner={winningNumber !== null && winningNumber !== 0 && winningNumber % 2 === 0}
      onClick={() => placeBet("even", "even")}
      className="h-6 sm:h-8"
    />
    <OutsideBetCell
      label="RED"
      betAmount={getBetAmount("red")}
      isWinner={winningNumber !== null && RED_NUMBERS.includes(winningNumber)}
      onClick={() => placeBet("red", "red")}
      colorDot="red"
      className="h-6 sm:h-8"
    />
    <OutsideBetCell
      label="BLK"
      betAmount={getBetAmount("black")}
      isWinner={winningNumber !== null && winningNumber !== 0 && !RED_NUMBERS.includes(winningNumber)}
      onClick={() => placeBet("black", "black")}
      colorDot="black"
      className="h-6 sm:h-8"
    />
    <OutsideBetCell
      label="ODD"
      betAmount={getBetAmount("odd")}
      isWinner={winningNumber !== null && winningNumber !== 0 && winningNumber % 2 === 1}
      onClick={() => placeBet("odd", "odd")}
      className="h-6 sm:h-8"
    />
    <OutsideBetCell
      label="19-36"
      betAmount={getBetAmount("high")}
      isWinner={winningNumber !== null && winningNumber >= 19 && winningNumber <= 36}
      onClick={() => placeBet("high", "high")}
      className="h-6 sm:h-8"
    />
  </div>
</div>
```

#### Component Signature Updates

**NumberCell** - add className prop:
```tsx
const NumberCell = memo(function NumberCell({
  num, color, betAmount, isWinner, onClick, className = "",
}: {
  num: number;
  color: "red" | "black" | "green";
  betAmount: number;
  isWinner: boolean;
  onClick: () => void;
  className?: string; // NEW
}) {
  // ... existing logic
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      className={`relative flex items-center justify-center rounded-sm text-white font-bold transition-all border ${bg} ${
        isWinner ? "ring-2 ring-yellow-400 shadow-lg shadow-yellow-500/50 z-10" : ""
      } ${betAmount > 0 ? "ring-1 ring-white/30" : "hover:ring-1 hover:ring-white/20"} ${className}`}
      // REMOVE style={{ aspectRatio: "1" }}
    >
      {num}
      {betAmount > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 z-10 w-3 h-3 rounded-full bg-yellow-500 text-black text-[7px] font-mono font-bold flex items-center justify-center shadow-md border border-yellow-400/50"
        >
          {betAmount < 1 ? `${Math.round(betAmount * 100)}` : betAmount}
        </motion.div>
      )}
      {/* ... rest unchanged */}
    </motion.button>
  );
});
```

**OutsideBetCell** - already has className support, just update default styling:
```tsx
// Update line 92: remove py-1.5 sm:py-2, chip badge size
className={`relative flex items-center justify-center gap-1 rounded-sm border border-zinc-700/40 bg-zinc-900/50 text-zinc-200 font-bold transition-all ${
  isWinner ? "ring-2 ring-yellow-400 shadow-lg shadow-yellow-500/50" : ""
} ${betAmount > 0 ? "ring-1 ring-white/30" : "hover:bg-zinc-800/60 hover:ring-1 hover:ring-zinc-600/50"} ${className}`}

// Update chip badge to w-3 h-3 at line 104
```

---

## 2. HORIZONTAL SPINNING WHEEL ANIMATION

### Wheel Number Order (European)
```tsx
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];
```

### Component: SpinningWheel

**File location**: Create at top of Roulette.tsx after constants, before NumberCell.

```tsx
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const SpinningWheel = memo(function SpinningWheel({
  winningNumber,
  isSpinning,
}: {
  winningNumber: number | null;
  isSpinning: boolean;
}) {
  const [displayWheel, setDisplayWheel] = useState(false);

  useEffect(() => {
    if (isSpinning) {
      setDisplayWheel(true);
    } else if (!isSpinning && winningNumber !== null) {
      // Keep visible for 3 seconds after spin completes
      const timer = setTimeout(() => setDisplayWheel(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isSpinning, winningNumber]);

  if (!displayWheel) return null;

  // Repeat wheel order 4 times for seamless scrolling
  const repeatedNumbers = [
    ...WHEEL_ORDER,
    ...WHEEL_ORDER,
    ...WHEEL_ORDER,
    ...WHEEL_ORDER,
  ];

  // Find target index: winning number in the 3rd repetition (middle)
  const targetIndex = winningNumber !== null
    ? WHEEL_ORDER.indexOf(winningNumber) + WHEEL_ORDER.length * 2
    : 0;

  // Cell width: 36px, calculate final position to center the winning number
  const cellWidth = 36;
  const containerWidth = typeof window !== 'undefined' ? window.innerWidth : 375;
  const finalOffset = -(targetIndex * cellWidth - containerWidth / 2 + cellWidth / 2);

  return (
    <div className="relative overflow-hidden h-14 mb-3 rounded-lg bg-zinc-950/50 border border-zinc-800/50">
      {/* Center pointer/marker */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="w-0.5 h-14 bg-yellow-400/80 shadow-lg shadow-yellow-500/50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-yellow-400 ring-2 ring-yellow-400/30" />
      </div>

      {/* Scrolling number strip */}
      <motion.div
        className="flex items-center h-full"
        initial={{ x: 0 }}
        animate={{
          x: isSpinning ? [0, -cellWidth * 20] : finalOffset,
        }}
        transition={
          isSpinning
            ? {
                duration: 1.5,
                ease: "linear",
                repeat: 0,
              }
            : {
                duration: 1.5,
                ease: [0.25, 0.46, 0.45, 0.94], // Ease-out cubic
                delay: 0,
              }
        }
      >
        {repeatedNumbers.map((num, idx) => {
          const color = getNumberColor(num);
          const bg =
            color === "green"
              ? "bg-emerald-600 border-emerald-500/40"
              : color === "red"
              ? "bg-red-600 border-red-500/30"
              : "bg-zinc-800 border-zinc-700/50";

          const isWinner = num === winningNumber && !isSpinning;

          return (
            <div
              key={`${num}-${idx}`}
              className={`flex-shrink-0 w-9 h-14 flex items-center justify-center border-r text-white font-bold text-sm ${bg} ${
                isWinner ? "ring-2 ring-inset ring-yellow-400" : ""
              }`}
            >
              {num}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
});
```

### State Management Changes

**Add new state**:
```tsx
const [isWheelSpinning, setIsWheelSpinning] = useState(false);
```

**Update spinMutation.onSuccess** (line 132):
```tsx
const spinMutation = trpc.casino.roulette.spin.useMutation({
  onSuccess: (result) => {
    setIsWheelSpinning(false); // Stop wheel animation
    setWinningNumber(result.number);
    setLastResult({ totalPayout: result.totalPayout, totalBet: result.totalBet });
    setLastBets([...bets]);
    refetchBalance();
    refetchHistory();

    const profit = result.totalPayout - result.totalBet;
    // ... rest unchanged
  },
  onError: (err) => {
    setIsWheelSpinning(false); // Stop on error too
    toast.error(err.message);
  },
});
```

**Update handleSpin** (line 201):
```tsx
const handleSpin = useCallback(() => {
  if (!canSpin) return;
  setIsWheelSpinning(true); // Start wheel animation
  // Aggregate bets by key for the mutation
  const aggregated = new Map<string, PlacedBet>();
  for (const b of bets) {
    const existing = aggregated.get(b.key);
    if (existing) {
      existing.amount += b.amount;
    } else {
      aggregated.set(b.key, { ...b });
    }
  }
  const betArray = Array.from(aggregated.values()).map(b => ({
    type: b.type,
    number: b.number,
    amount: Math.round(b.amount * 100) / 100,
  }));
  spinMutation.mutate({ bets: betArray });
}, [bets, canSpin]);
```

### Insert Wheel Component

**Location**: Between results strip and betting board (after line 278, before line 280).

```tsx
{/* Results Strip */}
{history && history.length > 0 && (
  <div className="flex gap-1 overflow-x-auto mb-3 pb-1 scrollbar-hide">
    {/* ... existing results strip ... */}
  </div>
)}

{/* Spinning Wheel Animation */}
<SpinningWheel
  winningNumber={winningNumber}
  isSpinning={isWheelSpinning}
/>

{/* Result Overlay */}
<AnimatePresence>
  {/* ... existing result overlay ... */}
</AnimatePresence>
```

---

## 3. ANIMATION TIMING BREAKDOWN

### Spin Sequence (Total: 3 seconds)

1. **User clicks SPIN** → `isWheelSpinning = true`
2. **Phase 1: Fast scroll** (0-1.5s)
   - Linear motion, scrolls ~20 cells left
   - Creates anticipation
3. **API returns result** (typically 0.2-0.5s into animation)
4. **Phase 2: Decelerate** (1.5s-3s)
   - Ease-out cubic to final position
   - Centers on winning number
5. **Phase 3: Display result** (3s-6s)
   - Wheel stays visible centered on winner
   - Result overlay appears (existing behavior)
   - Board highlights winning positions
6. **Cleanup** (6s)
   - Wheel fades out
   - Result clears (existing behavior)
   - Bets reset

### Animation Values

```tsx
// Fast scroll phase (initial)
duration: 1.5,
ease: "linear",
x: [0, -cellWidth * 20]  // Scroll left ~720px

// Decelerate phase (on result received)
duration: 1.5,
ease: [0.25, 0.46, 0.45, 0.94], // Ease-out cubic
x: finalOffset  // Calculated to center winning number
```

---

## 4. RESPONSIVE BREAKPOINTS

### Mobile (default, <640px)
- Number cells: 24×24px (`w-6 h-6`)
- Text: 9px (`text-[9px]`)
- Gap: 2px (`gap-0.5`)
- Chip badge: 12×12px (`w-3 h-3`)
- Wheel: 56px height, 36px cell width

### Desktop (sm:, ≥640px)
- Number cells: 32×32px (`w-8 h-8`)
- Text: 11px (`text-[11px]`)
- Gap: 4px (`gap-1`)
- Chip badge: 12×12px (same)
- Wheel: 56px height, 36px cell width (same)

---

## 5. IMPLEMENTATION CHECKLIST

### Phase 1: Compact Board
- [ ] Add `className` prop to `NumberCell` component
- [ ] Remove `aspectRatio: 1` style from `NumberCell`
- [ ] Update chip badge sizes to `w-3 h-3`
- [ ] Replace board layout section (lines 309-415) with new horizontal grid
- [ ] Test all betting positions (straight, column, dozen, outside)
- [ ] Verify responsive behavior on mobile (320px) and desktop (1024px)

### Phase 2: Spinning Wheel
- [ ] Add `WHEEL_ORDER` constant
- [ ] Create `SpinningWheel` component
- [ ] Add `isWheelSpinning` state
- [ ] Update `spinMutation.onSuccess` to manage wheel state
- [ ] Update `spinMutation.onError` to stop wheel
- [ ] Update `handleSpin` to start wheel
- [ ] Insert `<SpinningWheel />` between results strip and board
- [ ] Test spin animation timing
- [ ] Test with fast/slow network responses

### Phase 3: Polish
- [ ] Adjust wheel cell styling (borders, colors)
- [ ] Fine-tune animation easing curves
- [ ] Test Korean language labels fit in compact cells
- [ ] Verify winning number centering is pixel-perfect
- [ ] Test rapid successive spins (edge cases)

---

## 6. TRADE-OFFS & NOTES

### Why horizontal wheel instead of circular?
- Circular wheel requires complex SVG/canvas rotation
- Horizontal strip is trivial to implement with CSS transform
- Still provides authentic "spinning" feel
- Easier to ensure winning number is perfectly centered
- Better performance on mobile (simple translateX)

### Why hide wheel between spins?
- Reduces visual clutter when not needed
- Board remains the primary focus for placing bets
- Appears only when relevant (during spin + result)
- Saves vertical space on mobile

### Why 37-number strip repeated 4x?
- Creates illusion of continuous wheel
- Always enough runway for smooth deceleration
- Winning number lands in 3rd repetition (predictable offset math)

### Container width assumptions
- `max-w-lg` (~512px) on desktop
- Typical mobile: 375-414px wide
- Padding: 16px each side (32px total)
- Available width for board: ~343px mobile, ~480px desktop
- Zero cell width: 24px, Number grid: ~288px (12×24), Column cells: 24px
- Total minimum: ~336px (fits in 375px mobile screen)

---

## 7. EXPECTED OUTCOME

**Before**:
- Vertical scrolling board on mobile
- Huge square cells waste space
- No wheel animation
- Results strip only visual feedback

**After**:
- Everything visible at once on mobile (no scroll)
- Compact authentic casino layout
- Horizontal spinning wheel during spin
- Dramatic reveal animation when number lands
- Professional, polished casino feel

**Total bundle size impact**: +0.3KB (SpinningWheel component + constants)
