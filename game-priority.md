# $DORI Casino: Game Priority Analysis

**Current Games (5):** Blackjack, Crash, Mines, Roulette, Video Poker
**User Base:** ~12 friends
**Evaluated:** 2026-03-26

---

## Game Analysis

### Easy to Build (1-2 days)

#### 1. Dice
- **Development effort:** 6-8 hours
  - Simple RNG + multiplier math
  - Minimal UI: number input, over/under toggle, roll button
  - Reuse casino chip system from Blackjack/Mines
- **Fun for 12 friends:** ⭐⭐⭐ (3/5)
  - Very fast rounds (< 5 sec)
  - Good for quick gambling sessions
  - Easy to understand, but gets repetitive
- **Variety added:** ⭐⭐⭐⭐ (4/5)
  - Pure RNG game missing from current mix
  - Blackjack/Video Poker are skill-based, Crash/Mines have strategy
  - Fills "instant gratification" niche
- **Casino cash sink:** ⭐⭐⭐⭐ (4/5)
  - Fast rounds = high volume = steady house edge drain
  - Users chase losses with "just one more roll"
- **Cosmetic motivation:** ⭐⭐ (2/5)
  - Not very visual, hard to show off titles/effects

#### 2. Coin Flip
- **Development effort:** 4-6 hours
  - Simplest possible: 50/50, 2x payout
  - Flip animation, heads/tails bet selection
- **Fun for 12 friends:** ⭐⭐ (2/5)
  - TOO simple, boring after 2-3 rounds
  - No strategy, no depth
- **Variety added:** ⭐⭐ (2/5)
  - Dice does the same thing better (adjustable risk)
  - Redundant with other RNG games
- **Casino cash sink:** ⭐⭐⭐ (3/5)
  - Fast rounds but low engagement = users quit quickly
- **Cosmetic motivation:** ⭐ (1/5)
  - Literally just a coin

#### 3. Hilo
- **Development effort:** 10-12 hours
  - Card deck shuffling (can reuse Blackjack deck code)
  - UI: current card, higher/lower buttons, cash out
  - Multiplier calculation per correct guess
- **Fun for 12 friends:** ⭐⭐⭐⭐ (4/5)
  - Classic pub game, nostalgic
  - "One more card" tension like Mines
  - Good risk/reward balance
- **Variety added:** ⭐⭐⭐ (3/5)
  - Card-based like Blackjack/Video Poker
  - But simpler rules, more casual
- **Casino cash sink:** ⭐⭐⭐ (3/5)
  - Users cash out frequently (safer strategy)
  - Medium volume
- **Cosmetic motivation:** ⭐⭐⭐ (3/5)
  - Can reuse Blackjack card designs
  - Streak effects would look cool

#### 4. Limbo
- **Development effort:** 8-10 hours
  - RNG multiplier generation
  - Target multiplier input, payout math
  - Visual "limbo result" display (animated number climbing)
- **Fun for 12 friends:** ⭐⭐⭐ (3/5)
  - Similar to Crash but simpler (no timing skill)
  - High-risk high-reward appeals to degens
  - Can get boring without visual flair
- **Variety added:** ⭐⭐ (2/5)
  - Very similar to Crash (set target, wait for RNG)
  - Redundant core mechanic
- **Casino cash sink:** ⭐⭐⭐⭐ (4/5)
  - Users chase big multipliers (10x, 50x)
  - House edge accumulates fast
- **Cosmetic motivation:** ⭐⭐ (2/5)
  - Just a number, not very visual

#### 5. Wheel
- **Development effort:** 12-16 hours
  - SVG/canvas wheel rendering
  - Spin physics (realistic deceleration)
  - Segment configuration (1.5x, 2x, 3x, 5x, 10x, 50x)
  - Animation + sound effects
- **Fun for 12 friends:** ⭐⭐⭐⭐⭐ (5/5)
  - VERY satisfying to watch
  - Group spectacle (others can watch big spins)
  - Simple but exciting
- **Variety added:** ⭐⭐⭐⭐⭐ (5/5)
  - Most visually distinct from current games
  - No skill, pure luck, but LOOKS amazing
- **Casino cash sink:** ⭐⭐⭐⭐ (4/5)
  - "Just one more spin" is addictive
  - Fast rounds, high engagement
- **Cosmetic motivation:** ⭐⭐⭐⭐⭐ (5/5)
  - **PERFECT for showing off titles/effects**
  - Wheel segments could have cosmetic skins
  - Big win animations very visible

---

### Medium Complexity (3-5 days)

#### 6. Plinko
- **Development effort:** 24-32 hours
  - Ball physics (realistic bouncing)
  - Peg grid rendering, multiplier slots
  - Animation smoothing (60fps)
  - Mobile touch handling
- **Fun for 12 friends:** ⭐⭐⭐⭐⭐ (5/5)
  - Extremely satisfying visuals
  - Unpredictable, exciting
  - Can watch others' drops
- **Variety added:** ⭐⭐⭐⭐⭐ (5/5)
  - Physics-based, totally unique
  - Passive (drop and watch)
- **Casino cash sink:** ⭐⭐⭐⭐ (4/5)
  - Fast rounds, high replay value
  - Users chase center multipliers
- **Cosmetic motivation:** ⭐⭐⭐⭐⭐ (5/5)
  - Ball skins, peg colors, slot effects
  - Very shareable (screenshot big wins)

#### 7. Tower
- **Development effort:** 20-24 hours
  - 4-column grid, floor-by-floor progression
  - Tile selection UI (3 safe, 1 trap per floor)
  - Multiplier calculation per floor cleared
  - Cash out system like Mines
- **Fun for 12 friends:** ⭐⭐⭐⭐ (4/5)
  - Vertical Mines with clearer risk
  - "How high can you go?" challenge
  - Good tension building
- **Variety added:** ⭐⭐⭐ (3/5)
  - Very similar to Mines (reveal tiles, cash out)
  - Different visual presentation
- **Casino cash sink:** ⭐⭐⭐ (3/5)
  - Users cash out conservatively
  - Medium volume
- **Cosmetic motivation:** ⭐⭐⭐ (3/5)
  - Tower theme skins, floor effects

#### 8. Keno
- **Development effort:** 20-24 hours
  - 40-number grid, 1-10 pick selection
  - 10 random numbers drawn
  - Complex payout table (varies by picks + hits)
  - UI for selecting multiple numbers
- **Fun for 12 friends:** ⭐⭐ (2/5)
  - Feels like lottery, slow
  - Not engaging for young group
  - Confusing payout tables
- **Variety added:** ⭐⭐⭐ (3/5)
  - Lottery-style game missing
  - But doesn't fit friend group vibe
- **Casino cash sink:** ⭐⭐⭐ (3/5)
  - Slow rounds, low engagement
- **Cosmetic motivation:** ⭐ (1/5)
  - Just numbers on a grid

#### 9. Baccarat
- **Development effort:** 16-20 hours
  - Card dealing logic (Player vs Banker)
  - Third card rules (complex)
  - Betting UI (Player/Banker/Tie)
  - Reuse Blackjack card rendering
- **Fun for 12 friends:** ⭐⭐ (2/5)
  - Boring for young casual group
  - No skill, just coin flip with extra steps
  - "Old person casino game"
- **Variety added:** ⭐⭐ (2/5)
  - Card game like Blackjack/Video Poker
  - Doesn't add much
- **Casino cash sink:** ⭐⭐ (2/5)
  - Slow rounds, low engagement
- **Cosmetic motivation:** ⭐⭐ (2/5)
  - Can reuse Blackjack assets

---

### Hard (1+ week)

#### 10. Sic Bo
- **Development effort:** 40+ hours
  - 3 dice simulation
  - Massive betting board (50+ bet types)
  - Complex payout tables
  - UI/UX nightmare
- **Fun for 12 friends:** ⭐ (1/5)
  - Too complex, confusing
  - Nobody knows how to play
- **Variety added:** ⭐⭐ (2/5)
  - Dice game, but way overcomplicated
- **Casino cash sink:** ⭐⭐ (2/5)
  - Nobody will play it
- **Cosmetic motivation:** ⭐ (1/5)
  - Betting board, not exciting

#### 11. Plinko Deluxe
- **Development effort:** 60+ hours
  - Full physics engine (Matter.js or custom)
  - Realistic ball bouncing, spin, friction
  - Performance optimization
  - Cross-device testing
- **Fun for 12 friends:** ⭐⭐⭐⭐⭐ (5/5)
  - Amazing if done right
  - But overkill for 12 users
- **Variety added:** ⭐⭐⭐ (3/5)
  - Better version of Plinko
  - Not a new game type
- **Casino cash sink:** ⭐⭐⭐⭐ (4/5)
  - Same as regular Plinko
- **Cosmetic motivation:** ⭐⭐⭐⭐⭐ (5/5)
  - Incredible visuals
  - But HUGE time investment

---

## PRIORITIZED BUILD ORDER

### 1. Wheel (12-16 hours) — BUILD FIRST
**Why:**
- **Visual spectacle** — most exciting game to watch
- **Perfect for cosmetics** — wheel skins, segment effects, title display
- **Group appeal** — friends can spectate big spins
- **Fast, addictive** — "just one more spin"
- **Unique** — nothing like it in current lineup
- **Moderate effort** — 1.5-2 days for huge impact

**Implementation:**
- 6 segments: 1.5x, 2x, 3x (large), 5x (medium), 10x (small), 50x (tiny)
- House edge: ~10% (adjust segment sizes)
- Smooth spin animation (3-5 seconds)
- Sound effects (click-click-click, win chime)
- Big win overlay for 10x+ results

---

### 2. Dice (6-8 hours) — BUILD SECOND
**Why:**
- **Fastest to build** — minimal UI, simple math
- **High volume sink** — users spam rounds
- **Fills RNG gap** — pure instant gambling
- **Complements Wheel** — quick rounds vs. spectacle

**Implementation:**
- Target number 1-99 (decimal input)
- Roll over/under toggle
- Auto-calculate multiplier: `99 / (99 - target)` for over
- 2% house edge
- Instant result reveal (no animation needed)

---

### 3. Hilo (10-12 hours) — BUILD THIRD
**Why:**
- **Nostalgic pub game** — friend group will recognize it
- **Reuse Blackjack cards** — minimal new assets
- **Good tension** — "one more card" like Mines
- **Casual skill element** — card counting slightly helps

**Implementation:**
- Start with random card (2-A)
- Guess higher or lower (Aces high)
- Multiplier increases per correct guess (1.9x, 3.6x, 6.8x...)
- Cash out anytime after first correct guess
- Reveal next card immediately (no drama delay)

---

### 4. Plinko (24-32 hours) — BUILD FOURTH
**Why:**
- **Best medium-complexity game** — worth the investment
- **Unique physics gameplay** — can't get this anywhere else
- **Extremely shareable** — screenshot big center hits
- **Cosmetic goldmine** — ball skins, peg colors, slot effects

**Implementation:**
- Simple physics (canvas + basic gravity/bounce)
- 12-16 pegs in pyramid, 9 multiplier slots at bottom
- Center slots higher multiplier (0.5x, 1x, 2x, 5x, 10x, 5x, 2x, 1x, 0.5x)
- Drop animation ~3 seconds
- Can queue multiple balls (up to 3 at once)

---

### 5. Tower (20-24 hours) — BUILD FIFTH
**Why:**
- **Proven mechanic** — Mines works well, Tower is variant
- **Leaderboard potential** — "highest floor reached"
- **Good for streams** — friends can watch climbs
- **Less overwhelming than Mines** — clearer risk per floor

**Implementation:**
- 8 floors, 4 tiles per floor (3 safe, 1 trap)
- Multiplier increases per floor (1.3x, 1.7x, 2.2x, 2.9x...)
- Cash out after clearing any floor
- Reveal all tiles on loss (like Mines)
- Climbing visual theme (darker as you go up)

---

## DO NOT BUILD (Yet)

### Skip: Coin Flip
- Too boring, Dice does the same thing better

### Skip: Limbo
- Redundant with Crash (same core mechanic)

### Skip: Keno, Baccarat, Sic Bo
- Wrong demographic, too slow/complex for friend group

### Skip: Plinko Deluxe
- Overkill, regular Plinko is good enough

---

## Summary

**Next 5 games in order:**
1. **Wheel** (1.5-2 days) → visual spectacle, cosmetic showcase
2. **Dice** (1 day) → fast RNG sink, easy build
3. **Hilo** (1.5 days) → casual card game, reuse assets
4. **Plinko** (3-4 days) → physics game, unique, shareable
5. **Tower** (2.5-3 days) → Mines variant, leaderboard potential

**Total build time:** ~10-13 days for 5 new games

**Result:** 10 total games covering all major casino categories:
- Cards: Blackjack, Video Poker, Hilo
- Instant RNG: Dice, Wheel, Crash
- Strategic: Mines, Tower, Roulette
- Physics: Plinko

**Casino will print money.** Friends will gamble responsibly (or not).
