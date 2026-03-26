# Roulette Product Spec

## 1. User Stories

1. **Place multiple bets** — As a player, I want to select a chip denomination and click different board positions to place multiple simultaneous bets (straight numbers, colors, dozens, columns) so I can diversify my risk.

2. **Clear understanding of payouts** — As a player, I want to see clearly labeled bet zones with their payouts (35:1, 2:1, 1:1) so I know my potential returns before spinning.

3. **Manage bets easily** — As a player, I want Clear/Undo buttons so I can remove all bets or just the last one if I make a mistake, without restarting.

4. **See spin outcome** — As a player, I want the winning number highlighted with color coding (red/black/green) and my winning bets to pulse/flash while losing bets fade, so I immediately understand the result.

5. **Track hot/cold numbers** — As a player, I want a recent results strip showing the last 10-15 spins with color coding so I can spot patterns (even if they're meaningless).

6. **Quick rebets** — As a player, I want a "Repeat" button that replays my previous round's exact bet layout so I can run back the same strategy.

7. **Instant resolution** — As a player, I want the spin to resolve immediately with animated result (no multi-step gameplay) so I can play rapid-fire rounds.

## 2. Game Rules

**European Roulette** — 37 pockets (0-36), single zero, 2.7% house edge.

**Number colors:**
- **Green**: 0
- **Red**: 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
- **Black**: 2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35

**Wheel outcome** — Server picks random number 0-36, returns winning number + color. All bets resolved simultaneously.

## 3. Bet Types for V1

| Bet Type | Covers | Payout | Example |
|----------|--------|--------|---------|
| **Straight** | Single number (0-36) | 35:1 | Click "17" → $0.50 bet → win = $17.50 + $0.50 stake |
| **Red/Black** | 18 numbers | 1:1 | Click "Red" → $1 bet → win = $1 + $1 stake |
| **Odd/Even** | 18 numbers | 1:1 | Click "Even" → $1 bet → win = $1 + $1 stake |
| **High/Low** | 1-18 or 19-36 | 1:1 | Click "1-18" → $1 bet → win = $1 + $1 stake |
| **Dozens** | 1st (1-12), 2nd (13-24), 3rd (25-36) | 2:1 | Click "2nd 12" → $2 bet → win = $4 + $2 stake |
| **Columns** | Column of 12 numbers | 2:1 | Click column "2 to 1" zone → $2 bet → win = $4 + $2 stake |

**Zero behavior** — If ball lands on 0, all bets lose except straight bet on 0 (wins 35:1).

**Skip for v1:** Split (2 numbers), Street (3), Corner (4), Line (6).

## 4. Betting Flow

1. **Select chip** — Click chip denomination from bottom bar ($0.10, $0.25, $0.50, $1, $2, $5). Selected chip gets ring highlight.

2. **Click board positions** — Each click places one chip of selected denomination. Multiple clicks on same position stack chips (display running total).

3. **Multiple simultaneous bets** — Player can bet on Straight 7 ($0.50), Red ($1), and 2nd Dozen ($2) all in one spin. Total bet = $3.50.

4. **Bet display** — Show chip stack icon on each active bet zone with total bet amount label.

5. **Controls:**
   - **Clear** — Removes all bets, resets board
   - **Undo** — Removes last chip placed (LIFO)
   - **Repeat** — Replays previous round's exact bet layout (copies last round's bets to current board)
   - **Spin** — Enabled when total bets > 0 and ≤ $25. Disabled if insufficient balance.

6. **Validation** — Before spin, check:
   - At least one bet placed
   - Total of all bets ≤ $25
   - Balance ≥ total bet amount

## 5. Limits

- **Per-bet min/max:** $0.10 - $5.00 per individual position
- **Total bet cap:** $25 max across all bets per spin
- **Max payout:** $250 per spin (enforced server-side)
- **House edge:** 2.7% (European single-zero)

**Examples:**
- Valid: 5 straight bets × $5 = $25 total
- Invalid: 6 straight bets × $5 = $30 total (exceeds $25 cap)
- Valid: $5 on number 17 → lands → payout = $175 ($5 × 35)
- Edge case: $10 on number 17 → lands → payout = $250 (capped from theoretical $350)

## 6. Win/Loss Calculation

**Server logic:**
1. Accept bet layout: `[{ type: "straight", number: 17, amount: 0.5 }, { type: "red", amount: 1 }]`
2. Generate random winning number (0-36)
3. Evaluate each bet:
   - Straight 17 + ball lands 17 → win $17.50
   - Red + ball is red → win $1.00
   - If ball lands 0 → both lose
4. Sum all winning bets, cap total payout at $250
5. Return: `{ winningNumber, winningBets, totalPayout, netProfit }`

**Client display:**
- Flash/pulse winning bet zones
- Fade out losing bets
- Show `+$X.XX` or `-$Y.YY` net result
- Update balance

## 7. Recent Results Strip

**Layout:** Horizontal strip above betting board, scrolls left as new results arrive.

**Display:** Last 10-15 spins, newest on right.

**Visual:**
- Small circle per result
- Number displayed inside
- Background color: red/black/green
- Example: `[12] [0] [34] [7] [22] ...` with appropriate colors

**Purpose:** Visual pattern recognition (even though outcomes are independent). Players love this.

## 8. Integration

**Route:** `/casino/roulette`

**Balance system:** Uses shared `casinoBalance` via `trpc.casino.blackjack.balance.useQuery()` (reuse existing endpoint).

**Chip system:** Same denominations and `CHIP_COLORS` pattern as Blackjack/Mines.

**API mutations:**
- `trpc.casino.roulette.spin.useMutation({ bets: [...] })` → returns game result
- `trpc.casino.roulette.history.useQuery()` → last 15 spins for results strip

**UI patterns:**
- Same dark casino theme (`bg-gradient-to-b from-zinc-900 via-zinc-950 to-black`)
- Green felt board (`bg-gradient-to-b from-[#0a5c2a] via-[#0d6b32] to-[#084d23]`)
- Balance display in header (same as Blackjack)
- Back arrow to `/casino`
- Toast notifications for wins/losses

**No active game state** — Unlike Blackjack (multi-action) or Mines (progressive reveal), Roulette is instant resolution. No `active.useQuery()` needed. Just spin → result → done.

## 9. Edge Cases

**Insufficient balance for total bets:**
- Disable Spin button
- Show toast: "Insufficient balance. Total bet: $X.XX, Balance: $Y.YY"

**Balance drops mid-bet-placement:**
- Allow current bet placements to complete
- Validate on Spin click (server rejects if balance changed)

**Multiple bets exceeding $25 cap:**
- Disable Spin button when total > $25
- Show warning: "Max $25 total per spin"
- Allow player to remove bets via Clear/Undo

**Player tries to bet $10 on straight number:**
- Reject chip placement, show toast: "Max $5 per bet"

**Win exceeds $250 cap:**
- Display actual payout ($250) vs theoretical payout
- Toast: "Max payout reached: $250 (capped)"

**No bets placed:**
- Spin button disabled
- Prompt: "Place your bets"

**Network error during spin:**
- Show error toast
- Don't deduct balance (server-side transaction rollback)
- Allow retry

**Results strip empty (new player):**
- Show placeholder: "No recent spins" or empty strip

---

**Implementation Priority:**
1. Betting board layout (number grid + outside bet zones)
2. Chip selection + placement logic
3. Clear/Undo controls
4. Spin mutation + result animation
5. Win/loss calculation display
6. Recent results strip
7. Repeat button (last round replay)
