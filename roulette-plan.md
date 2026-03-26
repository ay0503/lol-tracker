# Roulette Implementation Plan

## Overview
European roulette (single zero, 37 numbers) with simplified bet types for MVP. Instant gameplay (no active game state) — place bets, spin, resolve, repeat.

---

## File 1: `server/roulette.ts`

### Constants
```typescript
const MAX_PAYOUT = 250;
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
```

### Interfaces

#### `RouletteBet`
```typescript
export interface RouletteBet {
  type: 'straight' | 'red' | 'black' | 'odd' | 'even' | 'high' | 'low' | 'dozen1' | 'dozen2' | 'dozen3' | 'column1' | 'column2' | 'column3';
  number?: number; // Required only for 'straight' bets (0-36)
  amount: number;   // Individual bet amount
}
```

#### `BetResult`
```typescript
interface BetResult {
  bet: RouletteBet;
  won: boolean;
  payout: number; // 0 if lost, amount * multiplier if won
}
```

#### `RouletteResult`
```typescript
export interface RouletteResult {
  number: number;              // Winning number (0-36)
  color: 'red' | 'black' | 'green';
  bets: BetResult[];           // Breakdown of each bet
  totalBet: number;            // Sum of all bet amounts
  totalPayout: number;         // Sum of all payouts (capped at $250)
  timestamp: number;
}
```

#### `RouletteHistory` (for global recent results)
```typescript
interface RouletteHistory {
  number: number;
  color: 'red' | 'black' | 'green';
  timestamp: number;
}
```

### Global State
```typescript
const recentResults: RouletteHistory[] = []; // Global, not per-user (shared wheel)
const MAX_HISTORY = 20;
```

### Core Functions

#### `getColor(number: number): 'red' | 'black' | 'green'`
- Returns 'green' if number === 0
- Returns 'red' if number in RED_NUMBERS
- Returns 'black' if number in BLACK_NUMBERS

#### `calculatePayout(bet: RouletteBet, winningNumber: number): number`
- Determines if bet wins based on bet type and winning number
- Returns 0 if lost
- Returns `bet.amount * multiplier` if won
- Multipliers:
  - `straight`: 35:1 (pays 35x + original bet = 36x total, return 36 * bet.amount)
  - `red/black/odd/even/high/low`: 1:1 (pays 1x + original = 2x total, return 2 * bet.amount)
  - `dozen1/dozen2/dozen3/column1/column2/column3`: 2:1 (pays 2x + original = 3x total, return 3 * bet.amount)
- Logic:
  - `straight`: bet.number === winningNumber
  - `red`: winningNumber !== 0 && RED_NUMBERS.includes(winningNumber)
  - `black`: winningNumber !== 0 && BLACK_NUMBERS.includes(winningNumber)
  - `odd`: winningNumber !== 0 && winningNumber % 2 === 1
  - `even`: winningNumber !== 0 && winningNumber % 2 === 0
  - `high`: winningNumber >= 19 && winningNumber <= 36
  - `low`: winningNumber >= 1 && winningNumber <= 18
  - `dozen1`: winningNumber >= 1 && winningNumber <= 12
  - `dozen2`: winningNumber >= 13 && winningNumber <= 24
  - `dozen3`: winningNumber >= 25 && winningNumber <= 36
  - `column1`: winningNumber % 3 === 1 && winningNumber !== 0
  - `column2`: winningNumber % 3 === 2 && winningNumber !== 0
  - `column3`: winningNumber % 3 === 0 && winningNumber !== 0

#### `spin(bets: RouletteBet[]): RouletteResult`
- Generate random winning number: `Math.floor(Math.random() * 37)` (0-36)
- Calculate color: `getColor(winningNumber)`
- Map each bet to BetResult:
  ```typescript
  const betResults = bets.map(bet => {
    const payout = calculatePayout(bet, winningNumber);
    return {
      bet,
      won: payout > 0,
      payout,
    };
  });
  ```
- Calculate totals:
  ```typescript
  const totalBet = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const totalPayout = Math.min(
    betResults.reduce((sum, result) => sum + result.payout, 0),
    MAX_PAYOUT
  );
  ```
- Store result in history:
  ```typescript
  recentResults.unshift({ number: winningNumber, color, timestamp: Date.now() });
  if (recentResults.length > MAX_HISTORY) recentResults.pop();
  ```
- Return `RouletteResult`

#### `getHistory(): RouletteHistory[]`
- Returns `recentResults` array (last 20 global spins)

---

## File 2: Router additions in `server/routers.ts`

**IMPORTANT**: Add these inside the existing `casino: router({` block. To minimize merge conflicts with the crash game branch, insert at **line 817** (immediately after the `mines` router closing and before the `blackjack` router opening).

### Exact insertion location
**Line 817** — between:
```typescript
    }), // <- end of casino.mines router
    roulette: router({  // <- INSERT HERE
```

### Router structure

#### `casino.roulette.spin`
```typescript
roulette: router({
  spin: protectedProcedure
    .input(z.object({
      bets: z.array(z.object({
        type: z.enum(['straight', 'red', 'black', 'odd', 'even', 'high', 'low', 'dozen1', 'dozen2', 'dozen3', 'column1', 'column2', 'column3']),
        number: z.number().int().min(0).max(36).optional(),
        amount: z.number().min(0.10).max(5).finite(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkCasinoCooldown(ctx.user.id);

      // Validate total bet ($25 max)
      const totalBet = input.bets.reduce((sum, bet) => sum + bet.amount, 0);
      if (totalBet > 25) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum total bet is $25.00 per spin." });
      }

      // Validate straight bets have number
      for (const bet of input.bets) {
        if (bet.type === 'straight' && (bet.number === undefined || bet.number < 0 || bet.number > 36)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Straight bets require a number (0-36)." });
        }
      }

      // Check balance
      const portfolio = await getOrCreatePortfolio(ctx.user.id);
      const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
      if (totalBet > casinoCash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });
      }

      // Deduct bet
      const db = await getDb();
      await db.update(portfolios).set({
        casinoBalance: (casinoCash - totalBet).toFixed(2)
      }).where(eq(portfolios.userId, ctx.user.id));

      // Spin
      const { spin } = await import("./roulette");
      const result = spin(input.bets);

      // Credit payout
      if (result.totalPayout > 0) {
        const freshPortfolio = await getOrCreatePortfolio(ctx.user.id);
        const newCasino = parseFloat(freshPortfolio.casinoBalance ?? "0") + result.totalPayout;
        await db.update(portfolios).set({
          casinoBalance: newCasino.toFixed(2)
        }).where(eq(portfolios.userId, ctx.user.id));
      }

      recordCasinoGame(ctx.user.id);
      cache.invalidate("casino.leaderboard");

      return result;
    }),
```

#### `casino.roulette.history`
```typescript
  history: publicProcedure.query(async () => {
    const { getHistory } = await import("./roulette");
    return getHistory();
  }),
}),
```

**Follow the same patterns as `casino.mines.start`**:
- Dynamic import for roulette functions
- `checkCasinoCooldown` before gameplay
- Balance deduction before spin
- Payout credit after win
- `recordCasinoGame(ctx.user.id)` to track activity
- `cache.invalidate("casino.leaderboard")` after balance change
- Use existing imports (`getDb`, `portfolios`, `eq`, `getOrCreatePortfolio`)

---

## File 3: `client/src/pages/Roulette.tsx`

### Imports
```typescript
import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Undo2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
```

### Constants
```typescript
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

const CHIP_COLORS = {
  0.10: { bg: "from-blue-400 to-blue-600", border: "border-blue-300/50", text: "text-white" },
  0.25: { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", text: "text-white" },
  0.50: { bg: "from-red-400 to-red-600", border: "border-red-300/50", text: "text-white" },
  1: { bg: "from-gray-100 to-gray-300", border: "border-gray-200/50", text: "text-gray-800" },
  2: { bg: "from-pink-400 to-pink-600", border: "border-pink-300/50", text: "text-white" },
  5: { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50", text: "text-black" },
};
```

### Component State
```typescript
const [selectedChip, setSelectedChip] = useState<number>(0.50);
const [bets, setBets] = useState<Map<string, number>>(new Map());
const [lastResult, setLastResult] = useState<RouletteResult | null>(null);
const [winningNumber, setWinningNumber] = useState<number | null>(null);
const [lastBets, setLastBets] = useState<Map<string, number>>(new Map()); // For "Repeat" button
```

### Betting Logic

#### Bet Keys
Generate unique keys for bet map:
- Straight bets: `"straight-{number}"`
- Outside bets: `"{type}"` (e.g., "red", "dozen1", "column2")

#### `placeBet(betKey: string, type: BetType, number?: number)`
- If bet exists at key, add `selectedChip` to existing amount (stacking chips)
- Otherwise, create new bet with `selectedChip` amount
- Cap individual bet at $5
- Update `bets` Map

#### `removeBet(betKey: string)`
- Remove bet from Map completely (right-click or dedicated remove UI)

#### `clearBets()`
- `setBets(new Map())`

#### `undoBet()`
- Remove most recently added bet (track insertion order via Array conversion or separate history)

#### `repeatBets()`
- `setBets(new Map(lastBets))`

#### Computed Values
```typescript
const totalBet = useMemo(() =>
  Array.from(bets.values()).reduce((sum, amt) => sum + amt, 0),
  [bets]
);

const canSpin = bets.size > 0 && totalBet <= 25 && totalBet <= casinoBalance;
```

### tRPC Queries/Mutations

#### `trpc.casino.blackjack.balance.useQuery()`
Fetch casino balance (same endpoint as other games)

#### `trpc.casino.roulette.history.useQuery()`
Fetch recent global results for strip display

#### `trpc.casino.roulette.spin.useMutation()`
```typescript
const spinMutation = trpc.casino.roulette.spin.useMutation({
  onSuccess: (result) => {
    setLastResult(result);
    setWinningNumber(result.number);
    setLastBets(new Map(bets)); // Save for repeat
    setBets(new Map()); // Clear board
    refetchBalance();

    const profit = result.totalPayout - result.totalBet;
    if (profit > 0) {
      toast.success(`+$${profit.toFixed(2)} won!`);
    } else {
      toast.error(`Lost $${result.totalBet.toFixed(2)}`);
    }

    // Clear winning highlight after 3s
    setTimeout(() => setWinningNumber(null), 3000);
  },
  onError: (err) => toast.error(err.message),
});
```

#### `handleSpin()`
```typescript
const handleSpin = useCallback(() => {
  if (!canSpin) return;

  const betArray = Array.from(bets.entries()).map(([key, amount]) => {
    // Parse bet type and number from key
    const [type, numStr] = key.split('-');
    return {
      type: type as BetType,
      number: numStr ? parseInt(numStr) : undefined,
      amount,
    };
  });

  spinMutation.mutate({ bets: betArray });
}, [bets, canSpin]);
```

### UI Components

#### Header
- Title: "Roulette" with wheel emoji
- Balance display
- Back link to /casino

#### Recent Results Strip
- Horizontal row of last 20 results (from history query)
- Each result: colored circle/number (red/black/green)
- Right-to-left display (newest on right)

#### Betting Board
Standard European layout (3 columns, 12 rows + outside bets):

**Number Grid (3x12)**
- 0 spans full height on left (green cell)
- Numbers 1-36 in grid:
  - Row 1: [3, 2, 1] (right to left per standard layout)
  - Row 2: [6, 5, 4]
  - ...
  - Row 12: [36, 35, 34]
- Each number cell:
  - Background color: red/black based on RED_NUMBERS/BLACK_NUMBERS
  - Click handler: `placeBet("straight-{num}", 'straight', num)`
  - Show stacked chips if bet exists
  - Highlight if `winningNumber === num`

**Column Bets (right side of grid)**
- Three "2:1" buttons aligned with columns
- Click: `placeBet('column1', 'column1')`

**Dozen Bets (below grid)**
- Three buttons: "1st 12" / "2nd 12" / "3rd 12"
- Click: `placeBet('dozen1', 'dozen1')`

**Outside Bets (below dozens)**
- Six buttons in row:
  - "1-18" → `placeBet('low', 'low')`
  - "EVEN" → `placeBet('even', 'even')`
  - "RED" → `placeBet('red', 'red')`
  - "BLACK" → `placeBet('black', 'black')`
  - "ODD" → `placeBet('odd', 'odd')`
  - "19-36" → `placeBet('high', 'high')`

#### Chip Display on Bets
- For each bet in `bets` Map, render chip stack on corresponding cell
- Show total amount for that position
- Use chip color matching highest denomination in stack

#### Control Panel (below board)
- **Chip Selector**: Same as Mines/Blackjack (0.10, 0.25, 0.50, 1, 2, 5)
- **Total Bet Display**: Show `totalBet` (current bets sum)
- **Clear Button**: Clear all bets
- **Undo Button**: Remove last bet
- **Repeat Button**: Restore last round's bets (disabled if no lastBets)
- **SPIN Button**:
  - Disabled if `!canSpin` or `isPending`
  - Green gradient, gold accent
  - Shows "SPIN · ${totalBet.toFixed(2)}"

#### Result Display
- After spin, show winning number in large display (animated entrance)
- Show result breakdown: "Red 23 · +$5.40" or "Green 0 · Lost $2.50"
- Highlight winning bets briefly before clearing board

### Styling
- Dark background (zinc-900/zinc-950)
- **Board felt**: Deep green gradient (`bg-gradient-to-br from-green-900 to-emerald-950`)
- Red numbers: `bg-red-600` with white text
- Black numbers: `bg-zinc-900` with white text
- Zero: `bg-green-600` with white text
- Outside bet boxes: Bordered containers matching felt theme
- Spin button: Gold gradient (`from-yellow-500 to-amber-500`)
- Animations: Framer Motion for chip placement, result reveal, number highlight

---

## File 4: App.tsx + Casino.tsx Updates

### `client/src/App.tsx`
**Line 33** (after mines route, before casino route):
```typescript
<Route path={"/casino/roulette"} component={Roulette} />
```

**Line 19** (import):
```typescript
import Roulette from "./pages/Roulette";
```

### `client/src/pages/Casino.tsx`
**GAMES array** — insert after mines entry (line 14):
```typescript
{
  id: "roulette",
  title: "Roulette",
  titleKo: "룰렛",
  emoji: "🎡",
  desc: "European wheel, 2.7% edge",
  descKo: "유럽식 룰렛",
  bet: "$0.10 – $5",
  href: "/casino/roulette",
  active: true,
  bg: "from-green-950/50 to-emerald-900/30",
  border: "border-green-700/40",
  badge: "from-green-500 to-emerald-600"
},
```

---

## Implementation Checklist

### Backend
- [ ] Create `server/roulette.ts`
  - [ ] Define constants (RED_NUMBERS, BLACK_NUMBERS, MAX_PAYOUT)
  - [ ] Define interfaces (RouletteBet, BetResult, RouletteResult, RouletteHistory)
  - [ ] Implement `getColor()`
  - [ ] Implement `calculatePayout()` with all bet type logic
  - [ ] Implement `spin()` with random number generation, payout calculation, history storage
  - [ ] Implement `getHistory()`
  - [ ] Export all public functions

### Router
- [ ] Add `casino.roulette.spin` mutation at line 817 in `server/routers.ts`
  - [ ] Input validation (bets array, amount limits, total bet cap)
  - [ ] Cooldown check
  - [ ] Balance check and deduction
  - [ ] Spin execution
  - [ ] Payout credit
  - [ ] Leaderboard invalidation
- [ ] Add `casino.roulette.history` query

### Frontend
- [ ] Create `client/src/pages/Roulette.tsx`
  - [ ] Component setup with state (selectedChip, bets Map, lastResult, winningNumber, lastBets)
  - [ ] Betting functions (placeBet, removeBet, clearBets, undoBet, repeatBets)
  - [ ] tRPC hooks (balance, history, spin mutation)
  - [ ] Header with balance
  - [ ] Recent results strip (history display)
  - [ ] Betting board layout:
    - [ ] Number grid (3x12 + zero)
    - [ ] Column bets
    - [ ] Dozen bets
    - [ ] Outside bets (high/low, odd/even, red/black)
  - [ ] Chip stacking display on board
  - [ ] Control panel (chip selector, clear/undo/repeat, total bet)
  - [ ] Spin button with validation
  - [ ] Result animation and display
  - [ ] Winning number highlight (3s timeout)

### Integration
- [ ] Add route to `client/src/App.tsx`
- [ ] Add roulette to GAMES array in `client/src/pages/Casino.tsx`

---

## Testing Plan

### Unit Tests (Backend)
- `getColor()`: Verify 0 → green, RED_NUMBERS → red, BLACK_NUMBERS → black
- `calculatePayout()`: Test all 13 bet types with winning/losing scenarios
  - Straight: Correct number → 36x, wrong → 0
  - Red/Black: Matching color → 2x, 0 → 0
  - Odd/Even: Correct parity → 2x, 0 → 0
  - High/Low: Range check → 2x
  - Dozens: Range check → 3x
  - Columns: Modulo check → 3x
- `spin()`: Verify random number generation (0-36), payout calculation, history storage, $250 cap
- History: Verify max 20 results stored

### Integration Tests (Router)
- Insufficient balance → error
- Total bet > $25 → error
- Straight bet without number → error
- Valid spin → balance deduction, payout credit, leaderboard invalidation
- Multiple simultaneous bets → correct total calculation
- Max payout cap enforcement

### E2E Tests (Frontend)
- Chip selection changes active chip
- Clicking board positions places bets (chips stack)
- Clear button removes all bets
- Undo removes last bet
- Repeat restores previous bets
- Total bet display updates correctly
- Spin button disabled when invalid (no bets, over limit, insufficient balance)
- Successful spin → result display, balance update, winning number highlight
- Recent results strip displays history correctly
- Multiple bet types on single spin work correctly

---

## Edge Cases to Handle

### Backend
- Zero winning number → all outside bets lose (except straight on 0)
- Multiple bets win on same spin → sum payouts, cap at $250
- Empty bets array → validation error
- Negative amounts → validation error (Zod handles this)
- Straight bet on invalid number (>36) → validation error
- Column/dozen validation for 0 → should lose (0 not in any column/dozen)

### Frontend
- Clicking same position multiple times → stack chips correctly
- Undo with empty bets → no-op
- Repeat with no previous bets → no-op
- Balance updates during active spin → disable UI until complete
- Very long chip stacks → UI overflow handling
- Mobile responsiveness for betting board layout

---

## Performance Considerations

### Backend
- History storage in memory (acceptable for 20 items)
- No database writes for game results (history is ephemeral)
- Fast random number generation (Math.random is sufficient)

### Frontend
- Use `useMemo` for totalBet calculation
- Debounce rapid bet placements if needed
- Optimize board rendering (25+ cells) with React.memo for number cells
- Framer Motion animations should be performant (small number of animated elements)

### Network
- Single mutation per spin (send all bets together)
- History query cached/refetched on interval (not real-time)

---

## UI/UX Polish Ideas (Post-MVP)

- Wheel animation (spinning SVG/canvas)
- Ball bounce animation before landing
- Sound effects (chip placement, wheel spin, win/lose)
- Bet statistics panel (show which bets have highest probability)
- "Hot/cold" numbers display based on history
- Neighbor bets (common in European roulette)
- Keyboard shortcuts for chip selection (1-6 keys)
- Save favorite bet patterns
- Mobile drag-and-drop for chip placement
- Confetti animation on big wins

---

## Notes

- **No active game state**: Unlike Mines/Blackjack, roulette doesn't need persistent game sessions. Each spin is independent.
- **Global history**: Recent results are shared across all users (same wheel).
- **2.7% house edge**: Built into European roulette odds (single zero). No artificial adjustment needed.
- **$250 payout cap**: Matches other casino games. Prevents massive single-spin wins.
- **Simplified bet types**: MVP skips split/street/corner/line bets (complex board positioning). Can add in v2.
- **Chip stacking**: Allows multiple bets on same position (e.g., $0.50 + $1 + $2 = $3.50 on red).
- **Merge conflict mitigation**: Roulette code entirely in new files except 2 router additions. Mark exact line numbers for router insertions.
