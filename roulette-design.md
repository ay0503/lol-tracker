# Roulette UI Design Spec — $DORI Casino

## Overview
European Roulette (single zero, 37 pockets) with dark theme matching Mines/Blackjack. MVP scope: straight bets, outside bets (red/black, odd/even, high/low, dozens, columns). Skip inside bets (split, street, corner, line) for v1.

---

## 1. Page Layout

**Same structure as Blackjack/Mines:**

```tsx
<div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
  <div className="container py-6 sm:py-8 max-w-lg mx-auto">
    {/* Back Arrow */}
    <Link href="/casino">
      <ArrowLeft /> Casino
    </Link>

    {/* Header: Icon + Title + Balance */}
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/25 to-rose-600/15 border border-red-500/20">
          <span className="text-lg">🎡</span>
        </div>
        <div>
          <h1>Roulette</h1>
          <p className="text-xs text-zinc-400 font-mono">${balance}</p>
        </div>
      </div>
      {/* Total Bet Badge (when bets placed) */}
      {totalBet > 0 && (
        <div className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/25">
          <span className="text-[11px] font-mono font-bold text-yellow-400">${totalBet}</span>
        </div>
      )}
    </div>

    {/* Game Area */}
    <RouletteTable />

    {/* Footer Rules */}
    <p className="text-center text-[9px] text-zinc-700 mt-4 font-mono">
      European · 2.7% edge · $250 max payout
    </p>
  </div>
</div>
```

---

## 2. Betting Board Design

### Layout Structure

**European Roulette Grid:**

```
┌─────┬───────────────────────────┬─────┐
│  0  │ 3   6   9  12  15  18  ... │ 2:1 │
│     ├───┼───┼───┼───┼───┼───┼───┤     │
│     │ 2   5   8  11  14  17  ... │ 2:1 │
│     ├───┼───┼───┼───┼───┼───┼───┤     │
│     │ 1   4   7  10  13  16  ... │ 2:1 │
└─────┴───┴───┴───┴───┴───┴───┴───┴─────┘
       1st12    2nd12     3rd12
      1-18 EVEN RED BLK ODD 19-36
```

### Component Breakdown

**Main Container:**
```tsx
<div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
  {/* Felt Background */}
  <div className="absolute inset-0 bg-gradient-to-b from-[#0a5c2a] via-[#0d6b32] to-[#084d23]" />
  <div className="absolute inset-0 opacity-[0.07]" style={{
    backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.4) 0.5px, transparent 0.5px)",
    backgroundSize: "8px 8px"
  }} />
  <div className="absolute inset-3 border border-green-500/10 rounded-xl pointer-events-none" />

  <div className="relative p-4 sm:p-6">
    <ResultsStrip />
    <RouletteBoard />
    <Controls />
  </div>
</div>
```

**Grid Layout (12 rows × 3 cols + zero + outside bets):**
```tsx
<div className="grid gap-1">
  {/* Top: Zero spanning full width */}
  <BetCell number={0} color="green" className="col-span-3" />

  {/* Number Grid: 3 columns, 12 rows */}
  {/* Row 1: 3, 2, 1 */}
  {/* Row 2: 6, 5, 4 */}
  {/* ... */}
  {/* Row 12: 36, 35, 34 */}

  {/* Column Bets (2:1) — right side */}
  <ColumnBet column={1} className="row-start-2 row-span-12" />
  <ColumnBet column={2} className="row-start-2 row-span-12" />
  <ColumnBet column={3} className="row-start-2 row-span-12" />

  {/* Dozen Bets */}
  <DozenBet range="1-12" className="col-span-1" />
  <DozenBet range="13-24" className="col-span-1" />
  <DozenBet range="25-36" className="col-span-1" />

  {/* Outside Bets (1:1) */}
  <OutsideBet type="1-18" />
  <OutsideBet type="EVEN" />
  <OutsideBet type="RED" color="red" />
  <OutsideBet type="BLACK" color="black" />
  <OutsideBet type="ODD" />
  <OutsideBet type="19-36" />
</div>
```

**Responsive Grid:**
- Mobile: compact cells (28px × 28px), tight gaps (1px)
- Desktop: larger cells (40px × 40px), comfortable gaps (2px)

---

## 3. Color Palette

### Page Background
```tsx
bg-gradient-to-b from-zinc-900 via-zinc-950 to-black
```

### Felt Background
```tsx
// Deep green felt (same as Blackjack)
bg-gradient-to-b from-[#0a5c2a] via-[#0d6b32] to-[#084d23]

// Subtle texture overlay
opacity-[0.07] radial-gradient dots
```

### Number Cells

**Zero (Green):**
```tsx
bg-emerald-600 border-emerald-500/40 text-white
// On win: ring-2 ring-emerald-400 shadow-emerald-500/50
```

**Red Numbers (1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36):**
```tsx
bg-red-600 border-red-500/30 text-white
// Hover: bg-red-500 ring-1 ring-red-400/50
// With chip: ring-2 ring-white/40
```

**Black Numbers (2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35):**
```tsx
bg-zinc-800 border-zinc-700/50 text-white
// Hover: bg-zinc-700 ring-1 ring-zinc-500/50
// With chip: ring-2 ring-white/40
```

**Outside Bet Areas:**
```tsx
bg-zinc-900/40 border-zinc-700/30 text-zinc-200
// Hover: bg-zinc-800/60 ring-1 ring-zinc-600
// With chip: ring-2 ring-white/40

// RED/BLACK special background
RED: bg-gradient-to-br from-red-600/30 to-red-700/20
BLACK: bg-gradient-to-br from-zinc-800/50 to-black/30
```

**Winning Number Highlight:**
```tsx
// Pulse animation on winning cell
ring-4 ring-yellow-400 shadow-lg shadow-yellow-500/60
animate-pulse
```

---

## 4. Chip Selector

**Same CHIP_COLORS from Blackjack/Mines:**
```tsx
const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0.10: { bg: "from-blue-400 to-blue-600", border: "border-blue-300/50", text: "text-white" },
  0.25: { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", text: "text-white" },
  0.50: { bg: "from-red-400 to-red-600", border: "border-red-300/50", text: "text-white" },
  1: { bg: "from-gray-100 to-gray-300", border: "border-gray-200/50", text: "text-gray-800" },
  2: { bg: "from-pink-400 to-pink-600", border: "border-pink-300/50", text: "text-white" },
  5: { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50", text: "text-black" },
};
```

**Chip Button (11 × 11 rounded-full, dashed border):**
```tsx
<motion.button
  whileHover={{ y: -3 }}
  whileTap={{ scale: 0.92 }}
  className={`w-11 h-11 rounded-full font-mono font-bold text-[10px] shadow-md border-[2.5px] border-dashed
    ${selected ? `ring-2 ring-white/40 ring-offset-1 ring-offset-[#0d6b32]` : `opacity-70 hover:opacity-100`}
    bg-gradient-to-b ${colors.bg} ${colors.text} ${colors.border}`}
>
  {label}
</motion.button>
```

**Chip Stack on Bet Cell:**
```tsx
// When chips placed on a bet position
<div className="absolute -top-2 -right-2 z-10">
  <div className={`w-6 h-6 rounded-full shadow-md border-[2px] border-dashed
    bg-gradient-to-b ${CHIP_COLORS[selectedChip].bg} ${CHIP_COLORS[selectedChip].text}`}>
    <span className="text-[9px] font-mono font-bold">{chipCount}</span>
  </div>
</div>
```

---

## 5. Animations (framer-motion)

### Chip Placement
```tsx
<motion.div
  initial={{ scale: 0, y: -20 }}
  animate={{ scale: 1, y: 0 }}
  transition={{ type: "spring", stiffness: 400, damping: 20 }}
  className="chip-stack"
/>
```

### Winning Number Pulse
```tsx
<motion.div
  animate={{
    scale: [1, 1.1, 1],
    boxShadow: [
      "0 0 0 0 rgba(250, 204, 21, 0)",
      "0 0 0 8px rgba(250, 204, 21, 0.4)",
      "0 0 0 0 rgba(250, 204, 21, 0)"
    ]
  }}
  transition={{ duration: 1.5, repeat: 3 }}
  className="winning-cell"
/>
```

### Losing Bets Fade
```tsx
<motion.div
  animate={{ opacity: 0, scale: 0.8 }}
  transition={{ duration: 0.5, delay: 1 }}
  className="losing-chip"
/>
```

### Results Strip Scroll
```tsx
<motion.div
  initial={{ x: -40, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  transition={{ type: "spring", stiffness: 200, damping: 20 }}
  className="result-item"
/>
```

### Spin Button
```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  disabled={totalBet === 0 || isSpinning}
  className="spin-button"
>
  {isSpinning ? <Loader2 className="animate-spin" /> : "SPIN"}
</motion.button>
```

---

## 6. Responsive Design

### Mobile (< 640px)
```tsx
// Compact cells
.bet-cell { width: 28px; height: 28px; gap: 1px; }
.bet-cell-text { font-size: 10px; }

// Scrollable board if needed
.roulette-board { overflow-x: auto; }

// Chip selector: smaller chips
.chip { width: 40px; height: 40px; font-size: 9px; }
```

### Desktop (≥ 640px)
```tsx
// Larger cells
.bet-cell { width: 40px; height: 40px; gap: 2px; }
.bet-cell-text { font-size: 12px; }

// Full width board
.roulette-board { max-width: 600px; margin: 0 auto; }

// Standard chips
.chip { width: 44px; height: 44px; font-size: 10px; }
```

---

## 7. Component Hierarchy

### Main Component Tree
```
<Roulette>
  ├─ <RouletteTable>
  │   ├─ <ResultsStrip results={lastResults} />
  │   ├─ <RouletteBoard>
  │   │   ├─ <BetCell number={0} color="green" />
  │   │   ├─ <BetCell number={1..36} color="red|black" />
  │   │   │   └─ <ChipStack chips={bets[number]} />
  │   │   ├─ <OutsideBet type="red|black|odd|even|1-18|19-36" />
  │   │   ├─ <DozenBet range="1-12|13-24|25-36" />
  │   │   └─ <ColumnBet column={1|2|3} />
  │   └─ <Controls>
  │       ├─ <ChipSelector chips={[0.10, 0.25, 0.50, 1, 2, 5]} />
  │       ├─ <BetControls>
  │       │   ├─ <ClearButton />
  │       │   ├─ <UndoButton />
  │       │   └─ <RepeatButton />
  │       └─ <SpinButton />
  └─ <ResultModal result={winningNumber} payout={totalPayout} />
```

### Key Components

**BetCell.tsx**
```tsx
interface BetCellProps {
  number: number;
  color: "red" | "black" | "green";
  bet?: number; // Chip value placed
  isWinning?: boolean;
  onClick: () => void;
}

// Renders: number, background color, chip stack, hover/active states
```

**ChipStack.tsx**
```tsx
interface ChipStackProps {
  chips: number[]; // Array of chip denominations
  total: number;
}

// Renders stacked chips with total badge
```

**ResultsStrip.tsx**
```tsx
interface ResultsStripProps {
  results: Array<{ number: number; color: "red" | "black" | "green" }>;
}

// Horizontal scrolling strip of last 15 results
// Color-coded dots with number labels
```

**SpinButton.tsx**
```tsx
interface SpinButtonProps {
  totalBet: number;
  onSpin: () => void;
  disabled: boolean;
  isSpinning: boolean;
}

// Gold gradient button (yellow-500 to amber-500)
// Shows total bet amount
// Disabled when no bets or spinning
```

**BetControls.tsx**
```tsx
// CLEAR: Remove all bets
// UNDO: Remove last bet placed
// REPEAT: Replay previous round's bets

<div className="flex gap-2 justify-center mb-3">
  <button onClick={clearBets} className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400">
    CLEAR
  </button>
  <button onClick={undoLastBet} className="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-300">
    UNDO
  </button>
  <button onClick={repeatBets} className="px-4 py-2 rounded-lg bg-blue-600/20 text-blue-400">
    REPEAT
  </button>
</div>
```

---

## 8. Betting Flow (State Management)

### State Structure
```tsx
interface Bet {
  type: "straight" | "red" | "black" | "odd" | "even" | "1-18" | "19-36" | "dozen" | "column";
  value: number | string; // number for straight, "red" for color, "1-12" for dozen, etc.
  amount: number; // chip denomination
}

interface RouletteState {
  bets: Bet[];
  selectedChip: number; // 0.10, 0.25, 0.50, 1, 2, 5
  totalBet: number;
  lastResults: Array<{ number: number; color: string }>;
  isSpinning: boolean;
  winningNumber: number | null;
  payout: number;
}
```

### Interaction Flow
1. **Select chip** → Set `selectedChip`
2. **Click bet cell** → Add `Bet` to `bets[]`, update `totalBet`
3. **Click CLEAR** → Reset `bets[]` and `totalBet`
4. **Click UNDO** → Pop last `Bet` from `bets[]`
5. **Click REPEAT** → Load `bets[]` from `previousRoundBets`
6. **Click SPIN** → Send `bets[]` to backend, set `isSpinning: true`
7. **Receive result** → Animate winning number, calculate payout, fade losing chips
8. **Show result modal** → Display winnings, update balance, add to `lastResults`

---

## 9. Visual Feedback States

### Hover State (before bet placed)
```tsx
hover:bg-red-500 hover:ring-1 hover:ring-red-400/50 cursor-pointer
```

### Active Bet State (chip placed)
```tsx
ring-2 ring-white/40 shadow-lg
// Chip stack visible
```

### Winning State
```tsx
ring-4 ring-yellow-400 shadow-lg shadow-yellow-500/60
animate-pulse
```

### Disabled State (spinning)
```tsx
opacity-50 cursor-not-allowed pointer-events-none
```

---

## 10. Additional UI Elements

### Results Strip (above board)
```tsx
<div className="flex gap-1.5 overflow-x-auto mb-3 pb-2">
  {lastResults.map((result, i) => (
    <motion.div
      key={i}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-mono font-bold ${
        result.color === "green" ? "bg-emerald-600 text-white" :
        result.color === "red" ? "bg-red-600 text-white" :
        "bg-zinc-800 text-white"
      }`}
    >
      {result.number}
    </motion.div>
  ))}
</div>
```

### Spin Animation (simplified)
```tsx
// No actual wheel animation for MVP — just highlight winning number
<AnimatePresence>
  {winningNumber !== null && (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="winning-overlay"
    >
      <div className="text-4xl font-bold text-yellow-400">
        {winningNumber}
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

### Result Modal
```tsx
<motion.div
  initial={{ scale: 0.8, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
>
  <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 text-center max-w-sm">
    <div className="text-5xl mb-3">{winningNumber}</div>
    <p className="text-zinc-400 text-sm mb-4">Winning Number</p>
    {payout > 0 ? (
      <div>
        <p className="text-2xl font-bold text-[#00C805] mb-1">+${payout.toFixed(2)}</p>
        <p className="text-xs text-zinc-500">You win!</p>
      </div>
    ) : (
      <div>
        <p className="text-2xl font-bold text-[#FF5252] mb-1">-${totalBet.toFixed(2)}</p>
        <p className="text-xs text-zinc-500">Better luck next spin</p>
      </div>
    )}
  </div>
</motion.div>
```

---

## Summary for Engineer

**Build a European Roulette game with:**
- Dark zinc/black gradient page background (matching Mines/Blackjack)
- Deep green felt board (`from-[#0a5c2a] to-[#084d23]`)
- 3-column grid layout: zero on top, 12 rows × 3 columns for numbers 1-36
- Column bets (2:1) on right, dozen bets below grid, outside bets at bottom
- Red/black number cells with proper European roulette color mapping
- Same chip selector pattern as other games (6 denominations, gradient backgrounds)
- Chip stacks visible on bet positions with count badge
- Results strip (last 15 spins, color-coded dots)
- Bet controls: Clear, Undo, Repeat buttons
- Gold gradient Spin button (disabled when no bets)
- Framer Motion animations: chip placement bounce, winning number pulse, losing bets fade
- Responsive grid (compact mobile, larger desktop)
- Component structure: RouletteBoard, BetCell, ChipStack, ResultsStrip, SpinButton

**Key animations:**
- Chip placement: `scale: 0 → 1` with spring
- Winning number: pulse + ring glow
- Losing chips: fade out + scale down
- Results strip: slide in from left

**Betting flow:**
1. Select chip denomination
2. Click bet positions to place chips
3. Use Clear/Undo/Repeat to manage bets
4. Click Spin when ready (shows total bet amount)
5. Winning number highlights, losing bets fade
6. Result modal shows payout
7. New result appears in results strip

This matches the existing casino aesthetic while delivering a clean, playable roulette experience.
