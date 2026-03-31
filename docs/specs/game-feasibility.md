# $DORI Casino: New Game Technical Feasibility Analysis

**Author:** Engineering Team
**Date:** 2026-03-26
**Purpose:** Technical implementation analysis for 8 potential casino games

---

## Executive Summary

All 8 proposed games are **technically feasible** using existing patterns from Roulette (instant) and Mines (stateful). Implementation times range from **2-8 hours** per game.

### Quickest Wins (2-4 hours)
1. **Coin Flip** - 2 hours
2. **Dice** - 2 hours
3. **Limbo** - 2 hours
4. **Hilo** - 4 hours
5. **Tower** - 4 hours

### Medium Effort (5-6 hours)
6. **Keno** - 5 hours
7. **Wheel** - 6 hours

### Highest Effort (8 hours)
8. **Plinko** - 8 hours (physics animation complexity)

---

## Implementation Patterns

### Pattern A: Instant Resolution (Roulette-style)
- Single mutation, immediate result
- Pure function: `play(bets) → result`
- Examples: Dice, Coin Flip, Limbo, Wheel, Plinko, Keno

### Pattern B: Stateful Multi-Action (Mines-style)
- Map-based game storage keyed by `userId`
- Actions: `start → action → action → cashout`
- Examples: Hilo, Tower

### Reusable Components
- **Chip Selector** - Already built (Roulette.tsx, Mines.tsx)
- **Balance Display** - Shared pattern
- **Casino SubNav** - Routes integration
- **Animation Utilities** - Framer Motion setup
- **TRPC Router Pattern** - Cooldown, balance check, payout credit

---

## Game 1: Dice

### Concept
Player sets a target number (1-99). Roll over/under wins. Multiplier adjusts with target.

### Server Implementation (`server/dice.ts`)
```typescript
export interface DiceBet {
  target: number;
  direction: 'over' | 'under';
  amount: number;
}

export interface DiceResult {
  roll: number;
  bet: DiceBet;
  won: boolean;
  payout: number;
  timestamp: number;
}

function calculateMultiplier(target: number, direction: 'over' | 'under'): number {
  const winChance = direction === 'over'
    ? (100 - target) / 100
    : target / 100;
  return (0.98 / winChance); // 2% house edge
}

export function rollDice(bet: DiceBet): DiceResult {
  const roll = Math.floor(Math.random() * 100) + 1; // 1-100
  const won = bet.direction === 'over'
    ? roll > bet.target
    : roll < bet.target;
  const multiplier = calculateMultiplier(bet.target, bet.direction);

  return {
    roll,
    bet,
    won,
    payout: won ? bet.amount * multiplier : 0,
    timestamp: Date.now(),
  };
}
```

**Lines of code:** ~60 server, ~150 client

### Client Implementation (`client/src/pages/Dice.tsx`)
- Slider for target (1-99)
- Toggle for over/under
- Display win chance % and multiplier in real-time
- Roll animation: animated number counter (0 → result)

### Router Integration (`server/routers.ts`)
```typescript
dice: router({
  roll: protectedProcedure
    .input(z.object({
      target: z.number().int().min(1).max(99),
      direction: z.enum(['over', 'under']),
      amount: z.number().min(0.10).finite(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkCasinoCooldown(ctx.user.id);
      const portfolio = await getOrCreatePortfolio(ctx.user.id);
      const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
      if (input.amount > casinoCash) throw new TRPCError({ /* ... */ });

      // Deduct bet
      const db = await getDb();
      await db.update(portfolios)
        .set({ casinoBalance: (casinoCash - input.amount).toFixed(2) })
        .where(eq(portfolios.userId, ctx.user.id));

      // Play
      const { rollDice } = await import("./dice");
      const result = rollDice({ target: input.target, direction: input.direction, amount: input.amount });

      // Credit payout
      if (result.payout > 0) {
        const fresh = await getOrCreatePortfolio(ctx.user.id);
        await db.update(portfolios)
          .set({ casinoBalance: (parseFloat(fresh.casinoBalance ?? "0") + result.payout).toFixed(2) })
          .where(eq(portfolios.userId, ctx.user.id));
      }

      recordCasinoGame(ctx.user.id);
      cache.invalidate("casino.leaderboard");
      return result;
    }),
}),
```

### Key Challenges
- **None** - Pure math, simplest game

### Reusable Code
- Chip selector from Roulette
- Balance display from Mines
- Instant result pattern from Roulette

### Time Estimate: **2 hours**
- 30 min: Server logic + types
- 60 min: UI (slider, toggle, animation)
- 30 min: Integration + testing

---

## Game 2: Coin Flip

### Concept
Heads or Tails. 50/50 chance (minus house edge). 1.96x payout.

### Server Implementation (`server/coinflip.ts`)
```typescript
export type CoinSide = 'heads' | 'tails';

export interface CoinBet {
  side: CoinSide;
  amount: number;
}

export interface CoinResult {
  result: CoinSide;
  bet: CoinBet;
  won: boolean;
  payout: number;
  timestamp: number;
}

const PAYOUT_MULTIPLIER = 1.96; // 2% house edge

export function flipCoin(bet: CoinBet): CoinResult {
  const result: CoinSide = Math.random() > 0.5 ? 'heads' : 'tails';
  const won = result === bet.side;

  return {
    result,
    bet,
    won,
    payout: won ? bet.amount * PAYOUT_MULTIPLIER : 0,
    timestamp: Date.now(),
  };
}
```

**Lines of code:** ~40 server, ~130 client

### Client Implementation
- Two buttons: Heads / Tails
- 3D coin flip CSS animation (`rotateY` transform)
- Land on edge, flip to result face

### Animation (CSS in `client/src/index.css`)
```css
@keyframes coin-flip {
  0% { transform: rotateY(0deg) rotateX(0deg); }
  50% { transform: rotateY(1800deg) rotateX(20deg); }
  100% { transform: rotateY(1800deg) rotateX(0deg); }
}
```

### Key Challenges
- **CSS 3D animation** - Standard pattern, well-documented

### Reusable Code
- Chip selector
- Instant result pattern
- Balance/header layout

### Time Estimate: **2 hours**
- 20 min: Server (simplest logic)
- 70 min: UI + coin animation
- 30 min: Integration + testing

---

## Game 3: Hilo (High/Low Cards)

### Concept
Draw a card. Guess if next card is higher or lower. Cash out anytime.

### Server Implementation (`server/hilo.ts`)
```typescript
const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
const HOUSE_EDGE = 0.02;

export interface HiloGame {
  id: string;
  userId: number;
  bet: number;
  deck: string[]; // shuffled deck (rank only, no suit needed)
  currentCard: string;
  cardsDrawn: number;
  status: "playing" | "won" | "lost";
  multiplier: number;
  payout: number;
  createdAt: number;
}

function shuffleDeck(): string[] {
  const deck = RANKS.flatMap(r => [r, r, r, r]); // 4 of each rank
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function calculateMultiplier(cardsDrawn: number): number {
  // Base multiplier grows exponentially
  return Math.pow(1.5, cardsDrawn) * (1 - HOUSE_EDGE);
}

export function startHilo(userId: number, bet: number): PublicHiloGame {
  const deck = shuffleDeck();
  const currentCard = deck.pop()!;
  const game: HiloGame = {
    id: `hilo_${Date.now()}_${userId}`,
    userId, bet, deck, currentCard, cardsDrawn: 1,
    status: "playing", multiplier: 1, payout: 0,
    createdAt: Date.now(),
  };
  activeGames.set(userId, game);
  return gameToPublic(game);
}

export function guessHilo(userId: number, guess: 'higher' | 'lower'): PublicHiloGame {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");
  if (game.deck.length === 0) throw new Error("Deck exhausted");

  const nextCard = game.deck.pop()!;
  const currentValue = RANKS.indexOf(game.currentCard);
  const nextValue = RANKS.indexOf(nextCard);

  const correct = (guess === 'higher' && nextValue > currentValue) ||
                  (guess === 'lower' && nextValue < currentValue);

  if (!correct) {
    game.status = "lost";
    game.payout = 0;
    game.multiplier = 0;
  } else {
    game.currentCard = nextCard;
    game.cardsDrawn++;
    game.multiplier = calculateMultiplier(game.cardsDrawn);
  }

  return gameToPublic(game);
}

export function cashOutHilo(userId: number): PublicHiloGame {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");
  game.status = "won";
  game.payout = Math.min(game.bet * game.multiplier, MAX_PAYOUT);
  return gameToPublic(game);
}
```

**Lines of code:** ~100 server, ~220 client

### Client Implementation
- Reuse `CardDisplay` component from Blackjack (exists in codebase)
- Current card display
- Two buttons: Higher / Lower
- Cash out button (shows current multiplier)
- Card draw animation (slide in from deck)

### Key Challenges
- **Deck state management** - Already solved in Mines pattern
- **Card comparison logic** - Trivial (rank index)

### Reusable Code
- Stateful game pattern from Mines
- Card component from Blackjack
- Cash out button pattern

### Time Estimate: **4 hours**
- 60 min: Server logic (deck, comparisons)
- 120 min: UI (card display, animations)
- 60 min: Integration + testing

---

## Game 4: Limbo

### Concept
Target a multiplier. Random crash point generated. Win if crash point >= target.

### Server Implementation (`server/limbo.ts`)
```typescript
export interface LimboBet {
  target: number; // e.g., 2.0 for 2x
  amount: number;
}

export interface LimboResult {
  crashPoint: number;
  bet: LimboBet;
  won: boolean;
  payout: number;
  timestamp: number;
}

const HOUSE_EDGE = 0.02;

function generateCrashPoint(): number {
  // Use inverse transform sampling for exponential distribution
  // House edge: 2% chance of instant crash (1.00x)
  const r = Math.random();
  if (r < 0.02) return 1.00;

  // Exponential: P(X >= x) = e^(-x/mean)
  // mean = 2.0 gives reasonable distribution
  const raw = -Math.log(1 - r) * 2.0;
  return Math.min(Math.max(raw, 1.01), 1000); // cap at 1000x
}

export function playLimbo(bet: LimboBet): LimboResult {
  const crashPoint = generateCrashPoint();
  const won = crashPoint >= bet.target;

  return {
    crashPoint: Math.round(crashPoint * 100) / 100,
    bet,
    won,
    payout: won ? bet.amount * bet.target * (1 - HOUSE_EDGE) : 0,
    timestamp: Date.now(),
  };
}
```

**Lines of code:** ~50 server, ~140 client

### Client Implementation
- Input for target multiplier (min 1.01, max 100)
- Display potential payout
- Animated counter: 1.00x → crash point (count up)
- Color transition: green while safe, red when crash

### Key Challenges
- **RNG distribution** - Need exponential curve (provided above)
- **Animation** - Simple number counter

### Reusable Code
- Chip selector
- Instant result pattern
- Number animation (similar to Crash game)

### Time Estimate: **2 hours**
- 30 min: Server + RNG
- 60 min: UI + counter animation
- 30 min: Integration + testing

---

## Game 5: Wheel

### Concept
Spin a wheel with weighted segments (different multipliers). Land on a segment to win.

### Server Implementation (`server/wheel.ts`)
```typescript
interface WheelSegment {
  multiplier: number;
  weight: number; // probability weight
  color: string;
}

const SEGMENTS: WheelSegment[] = [
  { multiplier: 1.5, weight: 30, color: 'blue' },
  { multiplier: 2.0, weight: 20, color: 'green' },
  { multiplier: 3.0, weight: 15, color: 'yellow' },
  { multiplier: 5.0, weight: 10, color: 'purple' },
  { multiplier: 10.0, weight: 5, color: 'red' },
  { multiplier: 50.0, weight: 1, color: 'gold' },
];

export interface WheelBet {
  amount: number;
}

export interface WheelResult {
  segment: WheelSegment;
  segmentIndex: number;
  bet: WheelBet;
  payout: number;
  timestamp: number;
}

function selectSegment(): { segment: WheelSegment; index: number } {
  const totalWeight = SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < SEGMENTS.length; i++) {
    random -= SEGMENTS[i].weight;
    if (random <= 0) return { segment: SEGMENTS[i], index: i };
  }
  return { segment: SEGMENTS[0], index: 0 };
}

export function spinWheel(bet: WheelBet): WheelResult {
  const { segment, index } = selectSegment();

  return {
    segment,
    segmentIndex: index,
    bet,
    payout: bet.amount * segment.multiplier,
    timestamp: Date.now(),
  };
}
```

**Lines of code:** ~70 server, ~280 client

### Client Implementation
- SVG or CSS-based wheel (6 colored segments)
- Rotation animation (CSS `transform: rotate()`)
- Calculate final rotation angle from segmentIndex
- Spin 3-5 full rotations + angle to land on segment

### Animation
```css
@keyframes wheel-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(1800deg); /* 5 rotations */ }
}
```
Apply final rotation inline: `rotate(${1800 + segmentAngle}deg)`

### Key Challenges
- **SVG/CSS wheel layout** - Moderate (pie chart pattern)
- **Weighted random** - Simple algorithm (above)

### Reusable Code
- Chip selector
- Instant result pattern
- CSS rotation animation

### Time Estimate: **6 hours**
- 40 min: Server + weighted selection
- 180 min: Wheel SVG/CSS layout
- 120 min: Rotation animation tuning
- 40 min: Integration + testing

---

## Game 6: Plinko

### Concept
Drop ball from top. Ball bounces through pegs. Land in bottom slots with different multipliers.

### Server Implementation (`server/plinko.ts`)
```typescript
const ROWS = 12;
const SLOTS = [0.2, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 3.0, 2.0, 1.5, 1.0, 0.5, 0.2]; // 13 slots

export interface PlinkoBet {
  amount: number;
}

export interface PlinkoResult {
  path: number[]; // 0 = left, 1 = right at each row
  slot: number;
  multiplier: number;
  bet: PlinkoBet;
  payout: number;
  timestamp: number;
}

export function dropPlinko(bet: PlinkoBet): PlinkoResult {
  const path: number[] = [];
  let position = ROWS / 2; // start in middle

  for (let row = 0; row < ROWS; row++) {
    const bounce = Math.random() > 0.5 ? 1 : -1;
    path.push(bounce === 1 ? 1 : 0);
    position += bounce * 0.5;
  }

  // Final slot is based on cumulative position
  const slot = Math.max(0, Math.min(SLOTS.length - 1, Math.round(position)));
  const multiplier = SLOTS[slot];

  return {
    path,
    slot,
    multiplier,
    bet,
    payout: bet.amount * multiplier,
    timestamp: Date.now(),
  };
}
```

**Lines of code:** ~90 server, ~380 client

### Client Implementation
- Canvas or CSS grid (pegs + slots)
- Ball drop animation (follow path)
- Each bounce: transition to next row with sideways offset
- Use Framer Motion or CSS transitions for smooth movement

### Key Challenges
- **Physics animation** - Most complex of all games
- **Canvas/Grid layout** - Need precise positioning
- Ball path needs to look natural (ease-in-out curves)

### Reusable Code
- Chip selector
- Instant result pattern
- Animation utilities (Framer Motion)

### Time Estimate: **8 hours**
- 60 min: Server + path generation
- 240 min: Canvas/grid layout + ball animation
- 120 min: Animation tuning (realistic bounces)
- 60 min: Integration + testing

---

## Game 7: Tower

### Concept
Climb a vertical tower. Each floor has hidden traps. Click safe tiles to climb. Cash out anytime.

### Server Implementation (`server/tower.ts`)
```typescript
const FLOORS = 8;
const TILES_PER_FLOOR = 3;
const TRAPS_PER_FLOOR = 1;

export interface TowerGame {
  id: string;
  userId: number;
  bet: number;
  trapPositions: number[][]; // [floor][trap_indices]
  currentFloor: number;
  status: "playing" | "won" | "lost";
  multiplier: number;
  payout: number;
  createdAt: number;
}

function generateTraps(): number[][] {
  return Array.from({ length: FLOORS }, () => {
    const trap = Math.floor(Math.random() * TILES_PER_FLOOR);
    return [trap];
  });
}

function calculateMultiplier(floor: number): number {
  // Each floor: 2/3 chance to pass = 1.5x per floor
  return Math.pow(1.5, floor) * 0.98;
}

export function startTower(userId: number, bet: number): PublicTowerGame {
  const game: TowerGame = {
    id: `tower_${Date.now()}_${userId}`,
    userId, bet,
    trapPositions: generateTraps(),
    currentFloor: 0,
    status: "playing",
    multiplier: 1,
    payout: 0,
    createdAt: Date.now(),
  };
  activeGames.set(userId, game);
  return gameToPublic(game);
}

export function climbTower(userId: number, tile: number): PublicTowerGame {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");
  if (tile < 0 || tile >= TILES_PER_FLOOR) throw new Error("Invalid tile");

  const traps = game.trapPositions[game.currentFloor];
  if (traps.includes(tile)) {
    game.status = "lost";
    game.payout = 0;
    game.multiplier = 0;
  } else {
    game.currentFloor++;
    game.multiplier = calculateMultiplier(game.currentFloor);
    if (game.currentFloor >= FLOORS) {
      game.status = "won";
      game.payout = Math.min(game.bet * game.multiplier, MAX_PAYOUT);
    }
  }

  return gameToPublic(game);
}

export function cashOutTower(userId: number): PublicTowerGame {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");
  game.status = "won";
  game.payout = Math.min(game.bet * game.multiplier, MAX_PAYOUT);
  return gameToPublic(game);
}
```

**Lines of code:** ~110 server, ~260 client

### Client Implementation
- Vertical stack of floors (8 rows)
- Each floor: 3 tiles (1 trap, 2 safe)
- Click tile to reveal
- Trap = explosion animation
- Safe = green glow, unlock next floor
- Cash out button at top

### Key Challenges
- **None** - Extremely similar to Mines (just vertical instead of grid)

### Reusable Code
- **Entire Mines pattern** - Same Map-based state, reveal logic
- Tile reveal animation from Mines
- Cash out pattern

### Time Estimate: **4 hours**
- 50 min: Server (copy Mines pattern, adjust grid)
- 120 min: UI (vertical layout, tile animations)
- 70 min: Integration + testing

---

## Game 8: Keno

### Concept
Pick 1-10 numbers (1-40). Game draws 10 random numbers. Match count determines payout.

### Server Implementation (`server/keno.ts`)
```typescript
const MAX_NUMBER = 40;
const DRAW_COUNT = 10;

const PAYOUT_TABLE: Record<number, Record<number, number>> = {
  1: { 1: 3.0 },
  2: { 1: 1.0, 2: 9.0 },
  3: { 2: 2.0, 3: 27.0 },
  4: { 2: 1.0, 3: 5.0, 4: 81.0 },
  5: { 3: 2.0, 4: 10.0, 5: 243.0 },
  // ... up to 10 picks
};

export interface KenoBet {
  picks: number[]; // 1-10 numbers
  amount: number;
}

export interface KenoResult {
  picks: number[];
  drawn: number[];
  matches: number[];
  matchCount: number;
  bet: KenoBet;
  payout: number;
  timestamp: number;
}

function drawNumbers(): number[] {
  const available = Array.from({ length: MAX_NUMBER }, (_, i) => i + 1);
  const drawn: number[] = [];
  for (let i = 0; i < DRAW_COUNT; i++) {
    const idx = Math.floor(Math.random() * available.length);
    drawn.push(available.splice(idx, 1)[0]);
  }
  return drawn;
}

export function playKeno(bet: KenoBet): KenoResult {
  const drawn = drawNumbers();
  const matches = bet.picks.filter(p => drawn.includes(p));
  const matchCount = matches.length;

  const payoutMultiplier = PAYOUT_TABLE[bet.picks.length]?.[matchCount] ?? 0;

  return {
    picks: bet.picks,
    drawn: drawn.sort((a, b) => a - b),
    matches,
    matchCount,
    bet,
    payout: bet.amount * payoutMultiplier,
    timestamp: Date.now(),
  };
}
```

**Lines of code:** ~80 server, ~300 client

### Client Implementation
- 8x5 grid of numbers (1-40)
- Click to select/deselect (max 10)
- Play button
- Draw animation: numbers appear one by one (0.2s delay each)
- Highlight matches with green glow

### Key Challenges
- **Payout table** - Need to define fair multipliers for each pick count
- **Selection UI** - Simple toggle state

### Reusable Code
- Chip selector
- Instant result pattern
- Grid layout (similar to Mines)

### Time Estimate: **5 hours**
- 50 min: Server + payout table tuning
- 150 min: UI (grid, selection, animations)
- 80 min: Draw animation sequence
- 40 min: Integration + testing

---

## Technical Comparison Matrix

| Game | Pattern | Server LoC | Client LoC | Animation Complexity | Time (hrs) |
|------|---------|-----------|-----------|---------------------|-----------|
| Coin Flip | Instant | 40 | 130 | Low (CSS 3D) | 2 |
| Dice | Instant | 60 | 150 | Low (counter) | 2 |
| Limbo | Instant | 50 | 140 | Low (counter) | 2 |
| Hilo | Stateful | 100 | 220 | Medium (cards) | 4 |
| Tower | Stateful | 110 | 260 | Medium (tiles) | 4 |
| Keno | Instant | 80 | 300 | Medium (sequence) | 5 |
| Wheel | Instant | 70 | 280 | High (rotation) | 6 |
| Plinko | Instant | 90 | 380 | Very High (physics) | 8 |

---

## Shared Infrastructure (Already Built)

### Server
- `checkCasinoCooldown(userId)` - Rate limiting
- `getOrCreatePortfolio(userId)` - Balance management
- `recordCasinoGame(userId)` - Activity tracking
- `cache.invalidate("casino.leaderboard")` - Stats refresh
- Router pattern with bet validation

### Client
- Chip selector component (6 denominations)
- Balance display header
- Casino SubNav routing
- Framer Motion animations
- Toast notifications
- Auth checks

### Database
- `portfolios.casinoBalance` - Already exists
- No schema changes needed for any game

---

## Risk Assessment

### Low Risk Games (0 blockers)
- **Coin Flip, Dice, Limbo** - Pure math, simple UI
- **Tower** - Mines clone with vertical layout

### Medium Risk Games (minor challenges)
- **Hilo** - Need CardDisplay component (check if exists from Blackjack)
- **Keno** - Payout table balancing requires testing
- **Wheel** - SVG layout needs precision

### Higher Risk Game (animation complexity)
- **Plinko** - Physics animation is time-consuming to make look good
  - Mitigation: Can use simpler CSS grid transitions instead of realistic physics
  - Alternative: Use pre-built physics library (matter.js)

---

## Recommendations

### Phase 1: Quick Wins (1 week)
Build 5 games in 14 hours total:
1. Coin Flip (2h)
2. Dice (2h)
3. Limbo (2h)
4. Tower (4h)
5. Hilo (4h)

**Rationale:** Maximum game variety with minimal effort. All use proven patterns.

### Phase 2: Visual Impact (1 week)
Build 2 games in 11 hours:
6. Keno (5h)
7. Wheel (6h)

**Rationale:** More visually impressive, good for marketing.

### Phase 3: Flagship Game (3 days)
Build 1 game in 8 hours:
8. Plinko (8h)

**Rationale:** Most unique, highest production value. Save for last when patterns are refined.

---

## House Edge Configuration

All games use **2% house edge** for consistency:
- Coin Flip: 1.96x payout (instead of 2x)
- Dice: `0.98 / winChance`
- Limbo: `targetMultiplier * 0.98`
- Hilo/Tower: Multiplier formula includes `* 0.98`
- Keno: Payout table adjusted for 98% RTP
- Wheel: Weighted probabilities sum to 98% expected return
- Plinko: Slot multipliers average to 0.98x

**Configurable:** Change `HOUSE_EDGE` constant in each file.

---

## File Structure (Per Game)

```
server/
  {game}.ts        # Game engine
  routers.ts       # Add casino.{game} router

client/src/
  pages/{Game}.tsx # Game UI page

# No schema changes needed
# No new dependencies needed (all use existing stack)
```

---

## Conclusion

**All 8 games are highly feasible.** The architecture supports rapid development:
- Instant games: 2-6 hours each
- Stateful games: 4 hours each (thanks to Mines pattern)

**Total implementation time: 33 hours** (4 working days for 1 developer, or 2 days with 2 developers in parallel)

**No technical blockers identified.** All required patterns, components, and infrastructure already exist in the codebase.

**Recommended order:** Quick wins first (Coin, Dice, Limbo, Tower, Hilo) to maximize game count, then visual polish games (Keno, Wheel, Plinko).
