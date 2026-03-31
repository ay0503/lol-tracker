# Stake Roulette - Comprehensive Reference Document

## 1. Game Mechanics

### 1.1 Wheel Layout

**European Roulette (Recommended)**
- **37 pockets**: Numbers 0-36
- **Single zero** (0) - green pocket
- **House edge**: 2.70% (1/37)
- **Number arrangement on wheel** (clockwise from 0):
  ```
  0-32-15-19-4-21-2-25-17-34-6-27-13-36-11-30-8-23-10-5-24-16-33-1-20-14-31-9-22-18-29-7-28-12-35-3-26
  ```
- **Color pattern**: Red and black alternate (except 0 which is green)

**American Roulette** (Higher house edge - not recommended)
- **38 pockets**: Numbers 0-36 plus 00
- **Double zero** (0 and 00) - both green
- **House edge**: 5.26% (2/38)

**Red numbers**: 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
**Black numbers**: 2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35
**Green**: 0 (and 00 in American)

### 1.2 Bet Types & Payouts

#### Inside Bets (on the number grid)

| Bet Type | Description | Payout | Probability (European) | House Edge |
|----------|-------------|--------|----------------------|------------|
| **Straight** | Single number (0-36) | 35:1 | 2.70% (1/37) | 2.70% |
| **Split** | Two adjacent numbers (vertical or horizontal) | 17:1 | 5.41% (2/37) | 2.70% |
| **Street** | Three numbers in a horizontal row | 11:1 | 8.11% (3/37) | 2.70% |
| **Corner** | Four numbers forming a square | 8:1 | 10.81% (4/37) | 2.70% |
| **Line** | Six numbers (two adjacent rows) | 5:1 | 16.22% (6/37) | 2.70% |

#### Outside Bets (perimeter of the grid)

| Bet Type | Description | Payout | Probability (European) | House Edge |
|----------|-------------|--------|----------------------|------------|
| **Red/Black** | All red or all black numbers | 1:1 | 48.65% (18/37) | 2.70% |
| **Odd/Even** | All odd or all even numbers | 1:1 | 48.65% (18/37) | 2.70% |
| **High/Low** | 1-18 (low) or 19-36 (high) | 1:1 | 48.65% (18/37) | 2.70% |
| **Dozens** | 1st (1-12), 2nd (13-24), 3rd (25-36) | 2:1 | 32.43% (12/37) | 2.70% |
| **Columns** | One of three vertical columns | 2:1 | 32.43% (12/37) | 2.70% |

**Note**: Zero (0) is not covered by any outside bet. When 0 hits, all outside bets lose.

### 1.3 Bet Limits

**Recommended structure** (aligned with existing casino games):
- **Minimum bet per spin**: $0.10
- **Maximum bet per spin**: $5.00
- **Table maximum** (sum of all bets): $25.00

### 1.4 RNG & Fairness

- **Provably fair**: Use cryptographic hash to prove randomness
- **RNG**: Secure random number generator (0-36 for European)
- **Spin result**: Single number determines all bet outcomes
- **Display**: Show last 10-20 results with hot/cold tracking

---

## 2. UX/UI Design

### 2.1 Betting Board Layout

**Grid Structure**:
```
┌────────────────────────────────────────────────────────────────────┐
│  [0]                                                               │
├────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬───────┤
│  1 │  2 │  3 │  4 │  5 │  6 │  7 │  8 │  9 │ 10 │ 11 │ 12 │ 2:1   │
│ R  │ B  │ R  │ B  │ R  │ B  │ R  │ B  │ R  │ B  │ B  │ R  │       │
├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼───────┤
│ 13 │ 14 │ 15 │ 16 │ 17 │ 18 │ 19 │ 20 │ 21 │ 22 │ 23 │ 24 │ 2:1   │
│ B  │ R  │ B  │ R  │ B  │ R  │ R  │ B  │ R  │ B  │ R  │ B  │       │
├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼───────┤
│ 25 │ 26 │ 27 │ 28 │ 29 │ 30 │ 31 │ 32 │ 33 │ 34 │ 35 │ 36 │ 2:1   │
│ R  │ B  │ R  │ B  │ B  │ R  │ B  │ R  │ B  │ R  │ B  │ R  │       │
├────┴────┴────┴────┼────┴────┴────┴────┼────┴────┴────┴────┼───────┤
│    1st 12        │     2nd 12        │     3rd 12        │       │
├──────────────────┼───────────────────┼───────────────────┤       │
│  1-18  │  EVEN  │   RED  │  BLACK  │  ODD  │  19-36   │       │
└────────┴────────┴────────┴──────────┴───────┴──────────┴───────┘
```

**Color scheme**:
- **Red numbers**: `bg-red-500` or `bg-gradient-to-br from-red-500 to-red-700`
- **Black numbers**: `bg-zinc-900` with `text-white`
- **Green (0)**: `bg-emerald-600` or `bg-gradient-to-br from-green-500 to-emerald-700`
- **Board background**: Green felt `from-[#0a5c2a] via-[#0d6b32] to-[#084d23]` (matches blackjack table)
- **Grid lines**: `border-white/10` or `border-green-400/20`

**Number sizing**:
- Desktop: 48-56px squares
- Mobile: 32-40px squares (5 columns on smaller screens)

### 2.2 Wheel Animation

**Visual components**:
1. **Wheel graphic**: Circular SVG or Canvas with 37 segments
2. **Ball animation**: Small white circle that travels around the rim
3. **Spin sequence**:
   - Wheel rotates clockwise (3-5 full rotations over 3-4 seconds)
   - Ball travels counter-clockwise (starts fast, decelerates)
   - Ball "bounces" between 3-5 pockets before settling
   - Final pocket highlights with glow effect

**Animation timing**:
- **Total duration**: 4-5 seconds
- **Wheel spin**: 3s with ease-out
- **Ball travel**: 3.5s with custom cubic-bezier for realistic deceleration
- **Bounce phase**: 0.5-1s at the end
- **Result reveal**: Fade in winning number with pulse effect

**Sound cues** (describe for PM/PD):
- Wheel spinning: Low whoosh/rumble
- Ball rolling: Clicking sound (faster → slower)
- Ball drop: Metallic bounce
- Result: Celebration chime (win) or neutral tone (loss)

### 2.3 Chip System

**Chip denominations** (aligned with existing games):
```javascript
const CHIP_COLORS = {
  0.10: { bg: "from-blue-400 to-blue-600", border: "border-blue-300/50", text: "text-white" },
  0.25: { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", text: "text-white" },
  0.50: { bg: "from-red-400 to-red-600", border: "border-red-300/50", text: "text-white" },
  1.00: { bg: "from-gray-100 to-gray-300", border: "border-gray-200/50", text: "text-gray-800" },
  2.00: { bg: "from-pink-400 to-pink-600", border: "border-pink-300/50", text: "text-white" },
  5.00: { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50", text: "text-black" },
};
```

**Chip display**:
- Circular, 44-48px diameter
- Border: 2.5px dashed border matching chip color
- Center: Denomination in bold mono font
- Hover: Lift up slightly (`y: -3px`)
- Selected: Ring effect with `ring-2 ring-white/40`
- Stack visualization: When multiple chips on same bet, show stacked (offset vertically)

### 2.4 Bet Placement UI

**Click to place**:
1. Select chip denomination from tray
2. Click betting area (number, split, street, etc.)
3. Chip appears on board with smooth scale animation
4. Clicking again adds another chip (increases bet)
5. Show running total next to each bet stack

**Visual feedback**:
- **Hover state**: Highlight valid betting area with glow (`ring-2 ring-yellow-400/40`)
- **Placed bet**: Chip appears with `scale(0) → scale(1)` spring animation
- **Invalid bet**: Shake animation + error toast
- **Multiple bets**: Show total bet amount in corner badge

**Bet hover preview**:
- On hover, show which numbers would win (subtle highlight)
- Display potential payout (e.g., "35:1 = $17.50" for straight bet)

### 2.5 Win/Loss Feedback

**Winning spin**:
1. Winning number highlights with pulsing glow (`shadow-yellow-500/50`)
2. All winning bet areas flash green (`bg-emerald-500/30` pulse)
3. Chips animate to center/stack area with collected winnings
4. Total payout displays in large text with confetti animation
5. Toast: "You win! +$XX.XX"

**Losing spin**:
1. Losing chips fade out and slide toward dealer
2. Toast: "Better luck next time"
3. Board clears for next round

**Push/even money bets**:
- Chips remain on board (for repeat bet)
- Subtle neutral animation

---

## 3. Betting Flow

### 3.1 Game States

```typescript
type GameState = "idle" | "betting" | "spinning" | "result" | "payout";
```

**State flow**:
```
idle → (click chip + bet area) → betting
betting → (click "SPIN") → spinning
spinning → (animation completes) → result
result → (payout calculated) → payout → idle
```

### 3.2 Controls & Actions

**Chip Selection**:
- Row of 6 chips at bottom of screen
- Tap to select (radio button behavior)
- Selected chip has ring glow
- Display current selection persistently

**Betting Actions**:
- **Place Bet**: Click/tap board area
- **Increase Bet**: Click same area again (adds selected chip)
- **Remove Bet**: Right-click or long-press on chip stack
- **Clear All**: Button to remove all bets (confirm dialog)
- **Undo Last**: Remove most recent bet
- **Repeat**: Re-place all bets from previous spin

**Spin Control**:
- Large "SPIN" button (disabled until at least one bet placed)
- Shows total bet amount: "SPIN $2.50"
- Disabled during spin animation
- Keyboard shortcut: Spacebar

**Quick Bet Buttons**:
- "Repeat Last Bet" - one-click to place same bets as previous round
- "Double All Bets" - 2x all current bets (if balance allows)
- "Clear Bets" - remove all chips from board

### 3.3 Auto-Bet Features

**Auto-spin** (optional enhancement):
- Toggle switch to enable
- Set number of spins (5, 10, 25, 50, 100)
- Stop conditions:
  - Balance reaches target
  - Balance drops below threshold
  - Big win (e.g., 10x+ multiplier)
  - Manual stop button

**Auto-rebet**:
- Checkbox: "Keep bets on table"
- After each spin, automatically re-place same bets for next round
- Disabled if balance insufficient

### 3.4 Bet Limits & Validation

**Client-side validation**:
- Check balance before allowing bet placement
- Enforce min/max per bet type
- Enforce table maximum (sum of all bets)
- Visual feedback: Shake + toast error

**Error states**:
- "Insufficient balance" - disable chip selection
- "Bet exceeds maximum" - prevent placement
- "Table limit reached" - disable additional bets

---

## 4. Visual Design Details

### 4.1 Layout Structure

**Desktop** (>768px):
```
┌─────────────────────────────────────────────┐
│  [Header: Balance $XX.XX]                  │
├──────────────────┬──────────────────────────┤
│                  │                          │
│   Roulette       │   Betting Board          │
│   Wheel          │   (number grid +         │
│   Animation      │    outside bets)         │
│   (large)        │                          │
│                  │   [Chip Selector]        │
│                  │   [Bet Controls]         │
│                  │   [SPIN $X.XX]           │
├──────────────────┴──────────────────────────┤
│   Recent Results: [12] [7] [33] [0] [24]   │
│   Hot: 7(3x) 12(3x)  Cold: 5(0/20) 18(0/20)│
└─────────────────────────────────────────────┘
```

**Mobile** (<768px):
```
┌─────────────────────────┐
│ [Balance $XX.XX]        │
├─────────────────────────┤
│  Roulette Wheel         │
│  (compact)              │
├─────────────────────────┤
│  Betting Board          │
│  (scrollable)           │
│  5 columns x 8 rows     │
├─────────────────────────┤
│  [Chip Selector]        │
│  [Controls]             │
│  [SPIN $X.XX]           │
├─────────────────────────┤
│  Recent: [7][12][0][33] │
└─────────────────────────┘
```

### 4.2 Color Palette

**Primary colors**:
- **Felt green**: `#0a5c2a` → `#0d6b32` → `#084d23` (gradient)
- **Gold accents**: `#FFD700` for highlights, winner glow
- **Red**: `#DC2626` (red numbers, chips)
- **Black**: `#18181B` (black numbers, dark UI)
- **Green (zero)**: `#10B981` or `#059669`

**UI elements**:
- Background: `from-zinc-900 via-zinc-950 to-black`
- Borders: `border-zinc-800` or `border-white/10`
- Text: `text-white` (primary), `text-zinc-400` (secondary)
- Buttons:
  - Spin: `from-yellow-500 to-amber-500`
  - Clear: `bg-red-500/20 text-red-400`
  - Undo: `bg-zinc-700 text-zinc-300`

### 4.3 Typography

**Fonts**:
- **Headings**: `font-[var(--font-heading)]` (bold, 16-24px)
- **Numbers on board**: `font-bold text-lg` (white on black/red)
- **Chip values**: `font-mono font-bold text-[10px]`
- **Balance/payout**: `font-mono text-2xl`

**Spacing**:
- Board padding: 16-24px
- Number cells: 2-4px gap
- Chip tray: 8px gap between chips
- Section margins: 16-32px

### 4.4 Animations

**Micro-interactions**:
- Chip placement: `scale(0) → scale(1)` with spring
- Chip hover: `y: 0 → y: -3px` (lift)
- Number highlight: `opacity pulse` + `shadow glow`
- Win celebration: Confetti particles, scale pulse
- Spin button: Rotate icon during spin

**Performance**:
- Use `transform` and `opacity` for GPU acceleration
- Limit particle effects on mobile
- Reduce motion for accessibility (prefers-reduced-motion)

---

## 5. Bet History & Statistics

### 5.1 Recent Results Strip

**Display**:
- Horizontal scrollable row
- Last 10-20 results
- Each result: Circular badge with number
- Color-coded: Red/Black/Green background
- Click to highlight on board

**Layout**:
```
Recent: [●7] [●12] [●0] [●33] [●24] [●5] [●19] [●28] [●11] [●30]
         R    B    G    B    B    R    R    B    B    R
```

### 5.2 Hot & Cold Numbers

**Hot numbers** (appeared most in last 20-100 spins):
- Badge with fire icon
- Show top 3-5 with frequency count
- Example: "7 (5x) 12 (4x) 0 (3x)"

**Cold numbers** (not appeared in last 20+ spins):
- Badge with ice icon
- Show numbers with longest drought
- Example: "5 (0/35) 18 (0/32) 22 (0/28)"

**Visual indicator**:
- Subtle background glow on betting board
- Hot: `bg-red-500/10`
- Cold: `bg-blue-500/10`

### 5.3 Statistics Panel (Optional)

**Advanced stats** (toggle drawer):
- Total spins played
- Win rate by bet type
- Biggest win/loss
- Longest streak
- RTP (Return to Player) - should trend toward 97.3%

---

## 6. Technical Implementation Notes

### 6.1 Data Model

```typescript
interface RouletteBet {
  type: "straight" | "split" | "street" | "corner" | "line" | "red" | "black" | "odd" | "even" | "low" | "high" | "dozen1" | "dozen2" | "dozen3" | "col1" | "col2" | "col3";
  numbers: number[];  // Numbers covered by bet
  amount: number;     // Bet amount ($)
  position?: string;  // UI position identifier for rendering
}

interface RouletteGame {
  id: string;
  userId: number;
  bets: RouletteBet[];
  result: number;  // Winning number (0-36)
  payout: number;  // Total payout
  totalBet: number;
  status: "active" | "spinning" | "completed";
  createdAt: Date;
}

interface RouletteResult {
  number: number;
  color: "red" | "black" | "green";
  isOdd: boolean;
  isHigh: boolean;  // 19-36
  dozen: 1 | 2 | 3;
  column: 1 | 2 | 3;
}
```

### 6.2 Payout Calculation

```typescript
function calculatePayout(bets: RouletteBet[], result: number): number {
  let totalPayout = 0;

  for (const bet of bets) {
    if (bet.numbers.includes(result)) {
      const multiplier = getPayoutMultiplier(bet.type);
      totalPayout += bet.amount * multiplier + bet.amount; // Includes original bet
    }
  }

  return totalPayout;
}

function getPayoutMultiplier(betType: string): number {
  const payouts = {
    straight: 35,
    split: 17,
    street: 11,
    corner: 8,
    line: 5,
    red: 1, black: 1, odd: 1, even: 1, low: 1, high: 1,
    dozen1: 2, dozen2: 2, dozen3: 2,
    col1: 2, col2: 2, col3: 2,
  };
  return payouts[betType];
}
```

### 6.3 RNG Implementation

```typescript
// Server-side only
function spinWheel(): number {
  // Use crypto.randomInt for secure randomness
  const result = crypto.randomInt(0, 37); // 0-36 for European
  return result;
}

// Optional: Provably fair with seed
function provablyFairSpin(clientSeed: string, serverSeed: string, nonce: number): number {
  const hash = crypto.createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}`)
    .digest('hex');
  const result = parseInt(hash.substring(0, 8), 16) % 37;
  return result;
}
```

### 6.4 Mobile Responsiveness

**Breakpoints**:
- **Mobile**: <640px (1 column layout, compact wheel)
- **Tablet**: 640-1024px (wheel left, board right)
- **Desktop**: >1024px (full layout with stats)

**Touch optimizations**:
- Larger tap targets (min 44x44px)
- Swipe to scroll recent results
- Long-press to remove bet
- Double-tap to quick-bet favorite numbers

---

## 7. Accessibility

### 7.1 Keyboard Navigation

- **Tab**: Navigate between chips, bets, controls
- **Enter/Space**: Select chip, place bet, spin
- **Arrow keys**: Navigate betting board
- **Esc**: Clear current selection
- **Backspace**: Undo last bet

### 7.2 Screen Reader Support

- ARIA labels for all interactive elements
- Announce bet placement: "Placed $0.50 on number 7"
- Announce spin result: "Ball landed on 12 red"
- Announce winnings: "You won $17.50"

### 7.3 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable wheel spin animation */
  /* Use instant reveal with fade-in */
  /* Remove confetti and particle effects */
}
```

---

## 8. Comparison to Existing Casino Games

| Feature | Blackjack | Mines | Roulette |
|---------|-----------|-------|----------|
| **Bet Range** | $0.10 - $5.00 | $0.10 - $5.00 | $0.10 - $5.00 |
| **House Edge** | ~0.5% (optimal) | 2% | 2.70% |
| **Duration** | 30-60s | Variable | 4-5s per spin |
| **Decisions** | Hit/Stand/Double | Tile selection | Bet placement only |
| **Max Payout** | 3:2 (blackjack) | 250x | 35:1 + multiple bets |
| **Complexity** | Medium | Low | Low-Medium |
| **Visual Focus** | Card animations | Grid reveal | Wheel spin |
| **Felt Color** | Green | Dark zinc | Green |

**Roulette advantages**:
- Fast-paced, no decisions after spin starts
- Multiple bet types (beginner to advanced)
- Iconic casino game with strong recognition
- Social aspect (bet alongside others on same spin)

**Design consistency**:
- Reuse chip system from Blackjack/Mines
- Maintain green felt aesthetic
- Same balance display, bet controls
- Consistent typography and color palette

---

## 9. Korean Localization

**Key translations**:
```typescript
const translations = {
  en: {
    spin: "SPIN",
    clearBets: "CLEAR BETS",
    undoLast: "UNDO",
    repeatBet: "REPEAT BET",
    straight: "Straight",
    split: "Split",
    street: "Street",
    corner: "Corner",
    red: "Red",
    black: "Black",
    odd: "Odd",
    even: "Even",
    low: "1-18",
    high: "19-36",
    youWin: "You Win!",
    betterLuck: "Better luck next time",
  },
  ko: {
    spin: "스핀",
    clearBets: "베팅 취소",
    undoLast: "실행 취소",
    repeatBet: "이전 베팅 반복",
    straight: "스트레이트",
    split: "스플릿",
    street: "스트리트",
    corner: "코너",
    red: "레드",
    black: "블랙",
    odd: "홀수",
    even: "짝수",
    low: "로우",
    high: "하이",
    youWin: "승리!",
    betterLuck: "다음 기회에",
  },
};
```

---

## 10. Future Enhancements

### Phase 1 (MVP)
- [x] European roulette wheel
- [x] All standard bet types
- [x] Basic wheel animation
- [x] Chip placement UI
- [x] Recent results (last 10)

### Phase 2
- [ ] Auto-bet / auto-spin
- [ ] Hot/cold number tracking
- [ ] Neighbor bets (announce, voisins, orphelins)
- [ ] Bet history with filtering
- [ ] Sound effects

### Phase 3
- [ ] Live multiplayer (multiple players on same spin)
- [ ] Chat/reactions
- [ ] Leaderboards (biggest single win, best streak)
- [ ] Achievements (hit zero, all reds in a row, etc.)
- [ ] Custom felt colors / themes

---

## 11. Reference Links & Resources

**Game rules**:
- European Roulette: https://en.wikipedia.org/wiki/Roulette
- Bet types visual guide: Search "roulette betting layout"

**Visual inspiration** (described):
- Stake.com: Clean, modern, dark theme with subtle gradients
- Traditional casino tables: Green felt with gold accents
- Modern online casinos: Animated wheel, particle effects on wins

**Color references**:
- Red numbers: #DC2626 (Tailwind red-600)
- Black numbers: #18181B (Tailwind zinc-900)
- Green felt: #0a5c2a → #0d6b32
- Gold highlight: #FFD700 → #FFA500

**Animation libraries**:
- Framer Motion (already in use)
- Canvas API for wheel rendering
- CSS transforms for chips

---

## 12. Implementation Checklist

### Backend (tRPC)
- [ ] `casino.roulette.bet` mutation - place bets
- [ ] `casino.roulette.spin` mutation - spin wheel, calculate result
- [ ] `casino.roulette.activeGame` query - get current game state
- [ ] `casino.roulette.history` query - recent results
- [ ] `casino.roulette.stats` query - hot/cold numbers

### Frontend (React + TypeScript)
- [ ] RouletteWheel component (SVG/Canvas)
- [ ] BettingBoard component (number grid + outside bets)
- [ ] ChipSelector component (reuse from Blackjack)
- [ ] BetControls component (spin, clear, undo, repeat)
- [ ] ResultsStrip component (recent spins)
- [ ] Animations: spin, ball drop, win celebration

### Database
- [ ] `rouletteGames` table
- [ ] `rouletteBets` table (many-to-one with games)
- [ ] `rouletteResults` table (spin history for stats)

### Testing
- [ ] Unit tests: Payout calculation for all bet types
- [ ] Unit tests: RNG distribution (chi-square test)
- [ ] E2E: Place bets, spin, collect winnings
- [ ] E2E: Multi-bet scenarios (inside + outside)
- [ ] Mobile: Touch interaction, responsiveness

---

## Summary

This document provides a complete reference for implementing **European Roulette** in the $DORI Casino, maintaining consistency with existing games (Blackjack, Mines) while adding the iconic wheel-based gameplay. Key design principles:

1. **2.70% house edge** (European single-zero)
2. **Fast 4-5 second spins** for engaging gameplay
3. **Visual consistency** with green felt, chip system, dark UI
4. **Mobile-first responsive** design
5. **Comprehensive bet types** (inside + outside)
6. **Provably fair RNG** with optional verification

The game should feel premium, fast-paced, and accessible to both casual players and experienced gamblers.
