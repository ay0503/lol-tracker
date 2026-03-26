# Crash Game -- Complete Technical Specification

**Author**: Gaming Research Spec
**Date**: 2026-03-26
**Purpose**: Full implementation guide for engineers building the Crash game into the lol-tracker casino platform.

---

## 1. Core Mechanic

The Crash game is conceptually simple:

1. **Bet phase**: The player places a bet before the round starts.
2. **Growth phase**: A multiplier starts at **1.00x** and rises continuously.
3. **Decision**: The player must click "Cash Out" before the multiplier **crashes** (drops to 0).
4. **Resolution**:
   - **Cash out in time** --> Payout = bet x multiplier at time of cashout.
   - **Fail to cash out** --> Player loses entire bet.

The crash point is determined *before* the round begins using a cryptographically-seeded random value. The player does not know the crash point until the round ends.

---

## 2. Multiplier Curve (Visual Growth)

### Formula

The multiplier follows an **exponential curve**:

```
multiplier(t) = e^(speed * t)
```

Where:
- `t` = elapsed time in seconds since round start
- `speed` = growth rate constant (controls how fast the curve rises)
- `e` = Euler's number (2.71828...)

### Typical Speed Values

| Speed Constant | Feel | 2x reached at | 10x reached at |
|---|---|---|---|
| 0.04 | Slow/relaxed | ~17.3s | ~57.6s |
| 0.06 | Medium (Stake-like) | ~11.6s | ~38.4s |
| 0.08 | Fast/tense | ~8.7s | ~28.8s |
| 0.10 | Very fast | ~6.9s | ~23.0s |

**Recommended for our app: `speed = 0.06e0`** -- this gives a Stake-like pace where most rounds feel meaningful (not too fast, not too slow).

### Time-to-Multiplier Derivation

Given `m = e^(s*t)`, solving for time: `t = ln(m) / s`

Examples at speed = 0.06:
- 1.50x --> `ln(1.5)/0.06` = 6.76s
- 2.00x --> `ln(2)/0.06` = 11.55s
- 5.00x --> `ln(5)/0.06` = 26.82s
- 10.00x --> `ln(10)/0.06` = 38.38s
- 100.00x --> `ln(100)/0.06` = 76.75s

### Display Update Rate

Update the displayed multiplier at **60fps** (every 16.67ms) for smooth animation. Use `requestAnimationFrame` on the client; compute the multiplier from elapsed wall-clock time, not from frame count.

```typescript
// Client-side rendering loop
const startTime = Date.now();
const SPEED = 0.06;

function updateDisplay() {
  const elapsed = (Date.now() - startTime) / 1000;
  const multiplier = Math.exp(SPEED * elapsed);
  renderMultiplier(multiplier); // update DOM
  if (gameActive) requestAnimationFrame(updateDisplay);
}
```

---

## 3. Crash Point Generation (The Math)

### The Standard Formula

The crash point is drawn from a **Pareto-like distribution** that guarantees a fixed house edge:

```
crashPoint = max(1.00, floor(100 * H / (1 - r)) / 100)
```

Where:
- `r` = a uniform random float in [0, 1)
- `H` = 1 - houseEdge (e.g., 0.99 for 1% house edge, 0.97 for 3%)
- `floor(...) / 100` = truncation to 2 decimal places (always rounds down, in the house's favor)

For a **1% house edge**: `crashPoint = max(1.00, floor(99 / (1 - r)) / 100)`

### Why This Formula Works

The cumulative distribution function (CDF) -- the probability that the crash point is <= some value `x` -- is:

```
P(crash <= x) = 1 - H/x
```

For H = 0.99 and x = 2.00: `P(crash <= 2) = 1 - 0.99/2 = 0.505` -- so roughly 50.5% of rounds crash at or below 2x.

Key probabilities (H = 0.99):

| Crash Point | P(crash >= this) | P(crash < this) |
|---|---|---|
| 1.00x | 100% (always starts) | 0% |
| 1.01x | 98.0% | 2.0% |
| 1.50x | 66.0% | 34.0% |
| 2.00x | 49.5% | 50.5% |
| 3.00x | 33.0% | 67.0% |
| 5.00x | 19.8% | 80.2% |
| 10.00x | 9.9% | 90.1% |
| 20.00x | 4.95% | 95.05% |
| 50.00x | 1.98% | 98.02% |
| 100.00x | 0.99% | 99.01% |
| 1000.00x | 0.099% | 99.901% |

### The Instant-Crash Edge Case

When `r < 0.01` (probability 1%), the formula yields a value below 1.00, so the `max(1.00, ...)` kicks in. The round "instantly crashes" at 1.00x -- everyone loses. This is the **entire source of the house edge**. In every other case, the game is mathematically fair.

### Implementation

```typescript
const HOUSE_EDGE = 0.01; // 1%

function generateCrashPoint(): number {
  const r = Math.random(); // [0, 1)
  const h = 1 - HOUSE_EDGE; // 0.99

  // Instant crash ~1% of the time
  if (r < HOUSE_EDGE) return 1.00;

  // Pareto-distributed crash point, truncated to 2 decimals
  const raw = h / (1 - r);
  return Math.max(1.00, Math.floor(raw * 100) / 100);
}
```

**Alternative (single expression, equivalent):**

```typescript
function generateCrashPoint(): number {
  const r = Math.random();
  return Math.max(1.00, Math.floor(99 / (1 - r)) / 100);
}
```

### Choosing House Edge

| House Edge | H | Instant crash % | Player EV per $1 | Notes |
|---|---|---|---|---|
| 1% | 0.99 | 1% | $0.99 | Industry standard (Bustabit, Stake) |
| 2% | 0.98 | 2% | $0.98 | More conservative |
| 3% | 0.97 | 3% | $0.97 | Matches our Mines game |

**Recommendation**: Use **2% house edge** to match the Mines game (consistency across casino games).

With 2%: `crashPoint = max(1.00, floor(98 / (1 - r)) / 100)`

---

## 4. House Edge Proof

### Theorem

For a player who always cashes out at multiplier `m` (any `m >= 1.00`), the expected value of a $1 bet is exactly `$H` (i.e., `$0.99` for 1% house edge).

### Proof

The probability of surviving to multiplier `m` (crash point >= m) is:

```
P(survive to m) = H / m    (for m >= 1)
```

Expected payout for always cashing out at `m`:

```
EV = P(survive) * payout + P(crash) * 0
   = (H/m) * m + (1 - H/m) * 0
   = H
   = 0.99  (for 1% edge)
   = 0.98  (for 2% edge)
```

The `m` cancels out. No matter what target multiplier you pick, expected return per $1 bet is exactly `$H`. The house edge is uniform across all strategies. There is no "optimal" cashout point -- they are all equally (dis)advantageous.

### Empirical Verification

Over N rounds with H = 0.99:
- ~1% of rounds crash at 1.00x (total loss)
- Remaining 99% have crash points drawn from Pareto(1, 1)
- Average crash point across all rounds converges to infinity (heavy tail), but the *probability-weighted payout* at any fixed cashout target converges to H.

```typescript
// Monte Carlo verification
function verifyHouseEdge(trials = 1_000_000, cashoutAt = 2.0) {
  let totalPayout = 0;
  for (let i = 0; i < trials; i++) {
    const crash = generateCrashPoint();
    if (crash >= cashoutAt) totalPayout += cashoutAt;
    // else: lost, payout = 0
  }
  console.log(`EV at ${cashoutAt}x: $${(totalPayout / trials).toFixed(4)}`);
  // Should print ~0.99 for any cashoutAt value
}
```

---

## 5. Player Experience Flow

### 5.1 Pre-Round (Betting Phase)

1. Player sees the Crash game page with:
   - Current casino balance
   - Bet input (chip selector: $0.10, $0.25, $0.50, $1.00, $2.00, $5.00 -- matching existing casino games)
   - Auto-cashout input (optional, e.g., "2.00x")
   - "Start Round" button (single-player adaptation -- see Section 10)
   - History of recent crash points (last 10-20 rounds)

2. Player sets bet amount and optional auto-cashout target.
3. Player clicks "Start Round."

### 5.2 During Round (Growth Phase)

1. The multiplier display begins at **1.00x** and rises exponentially.
2. Visual: large centered multiplier number, with a rising graph/curve behind it.
3. Color transitions:
   - **1.00x - 1.99x**: Blue/teal (safe zone)
   - **2.00x - 4.99x**: Green (profit zone)
   - **5.00x - 9.99x**: Yellow/orange (excitement)
   - **10.00x+**: Red/purple (danger/euphoria)
4. A "CASH OUT" button is prominently displayed. Clicking it ends the round with the current multiplier.
5. If auto-cashout is set and the multiplier reaches that target, auto-cashout triggers and the round ends.

### 5.3 Post-Round (Result)

1. **If cashed out in time**: Screen flashes green, shows payout amount and multiplier achieved.
2. **If crashed**: The multiplier display freezes at the crash point with a dramatic "CRASHED" animation. Screen flashes red.
3. Show the crash point (always, even if cashed out early).
4. The crash point is added to the history strip.
5. Balance is updated.
6. "Play Again" or "Same Bet" button appears.

---

## 6. Auto-Cashout System

### How It Works

- Player enters a target multiplier (e.g., 1.50x, 2.00x, 10.00x) before the round starts.
- When the client-side multiplier display reaches or exceeds the target, the cashout is triggered.
- **Important**: The actual payout is calculated server-side based on the crash point, not the client display. If `crashPoint >= autoCashout`, payout = `bet * autoCashout`. If `crashPoint < autoCashout`, payout = 0.

### Server-Side Logic

```typescript
function resolveRound(bet: number, crashPoint: number, autoCashout?: number, manualCashout?: number): number {
  // Auto-cashout takes priority if set
  const cashoutAt = autoCashout ?? manualCashout;

  if (!cashoutAt) return 0; // Never cashed out = loss
  if (crashPoint < cashoutAt) return 0; // Crashed before cashout
  return bet * cashoutAt; // Successful cashout
}
```

### Validation

- Minimum auto-cashout: **1.01x** (must be above 1.00)
- Maximum auto-cashout: **1000.00x** (practical upper bound)
- Precision: 2 decimal places

---

## 7. Round Timing

### In Multi-Player (Stake.com, Bustabit)

- **Between rounds**: 5-10 second countdown (betting window)
- **Round duration**: Variable, depends entirely on crash point
  - 1.00x crash: instant (0 seconds)
  - 2.00x crash: ~11.5s (at speed 0.06)
  - 10.00x crash: ~38s
  - 100.00x crash: ~77s
  - Median round (crash ~2x): ~11.5s
- **Average cycle**: ~20-25 seconds (bet phase + median round)

### In Our Single-Player Adaptation

- No countdown timer needed -- player starts when ready.
- Round duration is still governed by the exponential curve formula.
- **Minimum pause between rounds**: 1.5 seconds (prevents spam-clicking).

---

## 8. Statistics & History

### What to Track

#### Per-Round History (stored in memory, last 50 rounds per user)
- Crash point
- Bet amount
- Cashout multiplier (null if crashed)
- Payout
- Timestamp

#### Aggregate Stats (stored in DB for leaderboard)
- Total rounds played
- Total wagered
- Total won (payouts)
- Net profit/loss
- Biggest win (single round payout)
- Highest cashout multiplier achieved
- Current streak (wins/losses)
- Best streak

#### Display in UI
1. **History strip**: Last 15-20 crash points shown as colored badges at top of game screen
   - Green badge: crash >= 2.00x
   - Red badge: crash < 2.00x
   - Brighter/larger for extreme values (10x+)

2. **Stats panel** (collapsible):
   - Rounds played
   - Win rate (% of rounds where player cashed out successfully)
   - Net profit/loss
   - Biggest win

---

## 9. Social Element

### On Stake.com (Reference)

All players play the **same round simultaneously**. Key social features:
- Live feed showing every player's bet, their cashout point, and profit/loss
- You watch other players cash out as the multiplier rises -- creates FOMO pressure
- Chat integration
- "Whale" bets highlighted

### Our Adaptation (Single-Player)

Since we have ~20 users and no real-time websocket infrastructure:

1. **Simulated crowd**: Show 5-10 fake "other players" with bets and random cashout points during each round. This creates the social tension without real multiplayer.
   - Generate fake player names from a pool (e.g., "CryptoKing", "DiamondHands", "PaperBoy")
   - Fake bets: random $0.10-$5.00
   - Fake cashouts: drawn from realistic distribution (most cash out 1.2x-3x)
   - Some fake players "crash" (don't cash out in time)

2. **Leaderboard integration**: Real stats on the casino leaderboard (already exists).

3. **Recent history**: Show actual crash point history (shared seed makes this interesting).

**Implementation note**: Fake players are purely cosmetic. They do not affect the crash point, payout, or any server-side logic.

---

## 10. Single-Player Adaptation

### Architecture Decision

**On-demand rounds (player clicks "Start")**. This matches how our Blackjack and Mines games already work -- the player initiates each round.

### Game Flow (Single-Player)

```
[IDLE]
  |
  v
Player sets bet + optional auto-cashout
  |
  v
Player clicks "Start Round"
  |
  v
Server: deducts bet from casinoBalance, generates crashPoint, returns round ID
  |
  v
Client: begins multiplier animation (e^(0.06 * t))
  |                           |
  |                           v
  |                  Player clicks "Cash Out" at multiplier M
  |                           |
  |                           v
  |                  Client sends cashout request to server with M
  |                           |
  |                           v
  |                  Server: if crashPoint >= M, payout = bet * M
  |                  Server: credits casinoBalance, returns result
  |                           |
  v                           v
Multiplier reaches crashPoint (client animation)
  |
  v
Client: shows CRASH animation, sends "crashed" to server
Server: confirms loss (payout = 0)
  |
  v
[IDLE] -- show result, "Play Again"
```

### Critical Design: Server Authority

The server must be the source of truth. The crash point is generated server-side when the round starts but is NOT sent to the client until the round ends.

**API endpoints needed:**

```typescript
// 1. Start a round
POST /api/crash/start
Body: { bet: number, autoCashout?: number }
Response: { roundId: string, bet: number, autoCashout?: number }
// crashPoint is NOT returned here

// 2. Cash out
POST /api/crash/cashout
Body: { roundId: string, multiplier: number }
Response: {
  success: boolean,
  crashPoint: number,      // revealed now
  cashoutMultiplier: number,
  payout: number
}

// 3. Report crash (client says "I saw it crash")
POST /api/crash/crash
Body: { roundId: string }
Response: {
  crashPoint: number,      // revealed now
  payout: 0
}

// 4. Get history
GET /api/crash/history
Response: { rounds: CrashRound[] }
```

### Preventing Cheating

1. **Crash point generated at round start**, stored server-side. Client never sees it until round end.
2. **Cashout multiplier validated**: Server checks that `requestedCashout <= crashPoint`. The client sends the multiplier it *displayed* at cashout time; the server verifies this against the actual crash point.
3. **Timing validation**: Server tracks round start time. The claimed cashout multiplier must be consistent with elapsed time: `claimedMultiplier <= e^(speed * elapsedSeconds) + epsilon`. This prevents a player from modifying the client to claim a higher multiplier.
4. **Max payout cap**: $250 (matching Mines).

```typescript
// Server-side cashout validation
function validateCashout(round: CrashRound, claimedMultiplier: number): boolean {
  const elapsed = (Date.now() - round.startTime) / 1000;
  const maxPossible = Math.exp(SPEED * elapsed) * 1.05; // 5% tolerance for latency

  if (claimedMultiplier > maxPossible) return false; // timing cheat
  if (claimedMultiplier > round.crashPoint) return false; // already crashed
  return true;
}
```

---

## 11. Server-Side Implementation Spec

### Data Structures

```typescript
interface CrashRound {
  id: string;              // "crash_{timestamp}_{userId}"
  userId: number;
  bet: number;
  crashPoint: number;      // pre-determined at round start
  autoCashout: number | null;
  cashoutMultiplier: number | null;  // null = didn't cash out
  payout: number;
  status: "active" | "cashed_out" | "crashed";
  startTime: number;       // Date.now() when round began
  endTime: number | null;
}

interface PublicCrashRound {
  id: string;
  bet: number;
  crashPoint?: number;     // only revealed when status !== "active"
  cashoutMultiplier: number | null;
  payout: number;
  status: "active" | "cashed_out" | "crashed";
}
```

### Engine Module (`server/crash.ts`)

```typescript
const HOUSE_EDGE = 0.02;        // 2% to match Mines
const SPEED = 0.06;             // multiplier growth rate
const MAX_PAYOUT = 250;         // dollars
const MIN_BET = 0.10;
const MAX_BET = 5.00;
const MIN_AUTO_CASHOUT = 1.01;
const MAX_AUTO_CASHOUT = 1000.00;

const activeRounds = new Map<number, CrashRound>(); // userId -> active round
const roundHistory = new Map<number, CrashRound[]>(); // userId -> last 50 rounds

function generateCrashPoint(): number {
  const r = Math.random();
  const h = 1 - HOUSE_EDGE; // 0.98
  if (r < HOUSE_EDGE) return 1.00;
  return Math.max(1.00, Math.floor(h / (1 - r) * 100) / 100);
}

function startRound(userId: number, bet: number, autoCashout?: number): PublicCrashRound { ... }
function cashOut(userId: number, claimedMultiplier: number): PublicCrashRound { ... }
function reportCrash(userId: number): PublicCrashRound { ... }
function getHistory(userId: number): PublicCrashRound[] { ... }
```

### Integration with Existing Casino System

Follow the exact pattern established in `server/routers.ts` for Blackjack and Mines:

1. **Balance check**: `parseFloat(portfolio.casinoBalance ?? "20.00")`
2. **Deduct bet**: `db.update(portfolios).set({ casinoBalance: ... })`
3. **Credit winnings**: Same pattern on cashout
4. **Cooldown**: Use existing `checkCasinoCooldown()` function
5. **Leaderboard**: Winnings/losses feed into existing casino leaderboard

### tRPC Router Additions

Add to `appRouter` in `server/routers.ts`:

```typescript
crashStart: protectedProcedure
  .input(z.object({
    bet: z.number().min(0.10).max(5.00),
    autoCashout: z.number().min(1.01).max(1000).optional(),
  }))
  .mutation(async ({ ctx, input }) => { ... }),

crashCashout: protectedProcedure
  .input(z.object({ multiplier: z.number().min(1.00) }))
  .mutation(async ({ ctx, input }) => { ... }),

crashCrash: protectedProcedure
  .mutation(async ({ ctx }) => { ... }),

crashHistory: protectedProcedure
  .query(async ({ ctx }) => { ... }),

crashActive: protectedProcedure
  .query(async ({ ctx }) => { ... }),
```

---

## 12. Client-Side Implementation Spec

### Route

`/casino/crash` -- follows existing pattern (`/casino/blackjack`, `/casino/mines`).

### Component Structure

```
CrashPage
  +-- BetControls (chip selector, auto-cashout input, start button)
  +-- CrashDisplay (main multiplier + curve animation)
  +-- CashoutButton (large, pulsing during active round)
  +-- HistoryStrip (last 15 crash points as colored badges)
  +-- FakePlayers (simulated crowd, cosmetic only)
  +-- StatsPanel (collapsible, win rate / profit / biggest win)
```

### Animation Details

**The Curve Graph** (behind the multiplier number):
- X-axis: time
- Y-axis: multiplier
- Draw an exponential curve that grows in real-time
- Use canvas or SVG for smooth rendering
- When crash occurs: curve line turns red and a burst/explosion animation plays

**Multiplier Display**:
- Large, centered, monospace font
- Updates at 60fps
- Truncate to 2 decimal places: `(Math.floor(multiplier * 100) / 100).toFixed(2)`
- Grows in font-size slightly as multiplier increases (subtle scale effect)

**Color scheme**: Match existing casino dark theme with game-specific accent colors.

---

## 13. Edge Cases & Error Handling

| Scenario | Handling |
|---|---|
| Player closes browser during active round | Round auto-resolves as crash (loss) after 5-minute timeout. If auto-cashout was set, process it first. |
| Player has insufficient balance | Reject at bet time with clear error message |
| Network latency on cashout | Server uses its own elapsed time. Client sends claimed multiplier; server validates against crash point. Slight latency benefits the house (player's displayed multiplier may be higher than what the server grants). The 5% tolerance epsilon handles reasonable latency. |
| Crash at exactly auto-cashout value | `crashPoint >= autoCashout` --> successful cashout. Must be `>=`, not `>`. |
| Multiple cashout requests | Only the first is processed. Round status changes to "cashed_out" and subsequent requests are rejected. |
| Player tries to start new round with active round | Reject. One active round per user. |
| Extremely high crash point (e.g., 10000x) | Max payout cap of $250 applies. Display continues but payout is capped. |

### Stale Game Cleanup

```typescript
// Clean up abandoned rounds (same pattern as Mines)
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000; // 5 minutes
  for (const [userId, round] of activeRounds.entries()) {
    if (round.startTime < cutoff && round.status === "active") {
      // Auto-cashout if set and crash point allows
      if (round.autoCashout && round.crashPoint >= round.autoCashout) {
        round.status = "cashed_out";
        round.cashoutMultiplier = round.autoCashout;
        round.payout = Math.min(round.bet * round.autoCashout, MAX_PAYOUT);
        // Credit balance...
      } else {
        round.status = "crashed";
        round.payout = 0;
      }
      round.endTime = Date.now();
      activeRounds.delete(userId);
    }
  }
}, 60 * 1000);
```

---

## 14. Summary of Constants

| Constant | Value | Rationale |
|---|---|---|
| `HOUSE_EDGE` | 0.02 (2%) | Matches Mines game |
| `SPEED` | 0.06 | Stake-like pace, ~11.5s to 2x |
| `MIN_BET` | $0.10 | Matches existing casino |
| `MAX_BET` | $5.00 | Matches existing casino |
| `MAX_PAYOUT` | $250 | Matches Mines game |
| `MIN_AUTO_CASHOUT` | 1.01x | Must be above 1.00 |
| `MAX_AUTO_CASHOUT` | 1000.00x | Practical upper bound |
| `DISPLAY_UPDATE_RATE` | 60fps | Smooth animation |
| `STALE_GAME_TIMEOUT` | 5 minutes | Auto-cleanup abandoned rounds |
| `MIN_ROUND_GAP` | 1.5 seconds | Prevent spam |
| `CASHOUT_TIME_TOLERANCE` | 5% | Latency buffer for validation |

---

## 15. Crash Point Distribution Verification

For engineers to validate their implementation, here are expected statistical properties over 1,000,000 simulated rounds with 2% house edge:

```
Rounds crashing at exactly 1.00x:  ~2.0%  (the house edge source)
Rounds crashing below 2.00x:       ~51.0%
Rounds crashing below 5.00x:       ~80.4%
Rounds crashing below 10.00x:      ~90.2%
Rounds crashing at or above 100x:  ~0.98%

Average crash point:                ~infinity (heavy tail -- the mean does not converge)
Median crash point:                 ~1.96x

EV of $1 bet cashing out at 2.00x: ~$0.98
EV of $1 bet cashing out at 5.00x: ~$0.98
EV of $1 bet cashing out at any target: ~$0.98
```

Run the Monte Carlo simulation to confirm before shipping:

```typescript
function verifyImplementation() {
  const N = 1_000_000;
  const targets = [1.5, 2.0, 3.0, 5.0, 10.0];

  const crashes = Array.from({ length: N }, () => generateCrashPoint());

  console.log(`Instant crashes (1.00x): ${(crashes.filter(c => c === 1).length / N * 100).toFixed(2)}%`);
  console.log(`Median crash: ${crashes.sort((a, b) => a - b)[Math.floor(N / 2)]}`);

  for (const target of targets) {
    const wins = crashes.filter(c => c >= target).length;
    const ev = (wins * target) / N;
    console.log(`EV at ${target}x: $${ev.toFixed(4)} (expected ~$0.98)`);
  }
}
```
