# Stake.com Casino Games Audit
**Research Date:** March 26, 2026
**Purpose:** Identify implementable games for virtual casino web app

---

## STAKE ORIGINALS

### 1. Dice
**Category:** Stake Original
**How it works:** Player sets a target number (0-100) and chooses to roll over or under. A random number is generated. Win if prediction is correct. Higher risk targets = higher multiplier.
**House edge:** ~1%
**Implementation complexity:** Easy
**Visual requirements:** Animated rolling die, number counter ticking up, win/loss indicator. Minimal — just need smooth number animations and color changes.
**Why players love it:** Pure simplicity, instant gratification, complete control over risk/reward ratio. You can go conservative (1.01x) or yolo (99x multiplier).
**Fun factor:** 6/10 — Simple but can get repetitive
**Replayability:** 7/10 — Quick rounds make it addictive
**Uniqueness:** Medium — We don't have pure probability betting yet

---

### 2. Limbo
**Category:** Stake Original
**How it works:** Set a target multiplier (1.01x to 1,000,000x). Game generates a random crash point. If crash point ≥ target, you win the multiplier. The higher your target, the lower the probability.
**House edge:** ~1%
**Implementation complexity:** Easy
**Visual requirements:** Single number counting up rapidly, explosion/crash animation when it hits the crash point. Optional: minimalist bar that fills as multiplier climbs.
**Why players love it:** The ultimate "how greedy are you?" game. Watching the number climb knowing it could crash any millisecond creates pure tension.
**Fun factor:** 8/10 — Extremely tense and exciting
**Replayability:** 9/10 — Highly addictive, quick rounds
**Uniqueness:** High — Similar to Crash but simpler, more visceral

---

### 3. Plinko
**Category:** Stake Original
**How it works:** Drop a ball from the top of a peg board. Ball bounces left/right randomly at each peg until landing in a multiplier bucket at bottom (0.2x to 1000x). Choose risk level (low/medium/high) which affects bucket distribution.
**House edge:** ~1%
**Implementation complexity:** Medium
**Visual requirements:** Physics-based ball animation, peg collision effects, glowing buckets, particle effects on landing. Need smooth 60fps physics or it feels cheap.
**Why players love it:** Mesmerizing to watch, pure chance but feels skill-based, satisfying physics. The "plink plink plink" is hypnotic.
**Fun factor:** 9/10 — Extremely satisfying to watch
**Replayability:** 8/10 — Can watch for hours
**Uniqueness:** Very High — Nothing like this in our catalog, completely different vibe

---

### 4. Keno
**Category:** Stake Original
**How it works:** Pick 1-10 numbers from a grid of 40. System draws 10 random numbers. More matches = higher payout. Multiplier increases exponentially with risk (picking 10 numbers is much harder than picking 1).
**House edge:** ~5-10% (varies by selections)
**Implementation complexity:** Easy
**Visual requirements:** Grid of 40 numbers, ball machine animation showing 10 draws, highlighting matched numbers, payout table display.
**Why players love it:** Lottery-style excitement with better odds, strategic number selection creates illusion of control, massive win potential.
**Fun factor:** 7/10 — Good for casual play
**Replayability:** 6/10 — Slower paced, less addictive
**Uniqueness:** Medium — Similar to lottery, but fills the "pick your numbers" niche

---

### 5. Wheel
**Category:** Stake Original
**How it works:** Wheel with 10-50 segments (player chooses). Each segment has a multiplier. Spin the wheel, win the multiplier you land on. More segments = more variance in payouts.
**House edge:** ~1%
**Implementation complexity:** Medium
**Visual requirements:** Smooth wheel spin animation with physics (deceleration), pointer/indicator, segment highlighting, celebration effects for big wins. Needs to feel weighty and real.
**Why players love it:** Classic carnival game psychology, anticipation during spin, visual excitement. Everyone loves spinning a wheel.
**Fun factor:** 8/10 — Universally appealing
**Replayability:** 7/10 — Can get samey but satisfying
**Uniqueness:** Medium-High — We don't have a wheel game yet, different energy than slots

---

### 6. Tower
**Category:** Stake Original
**How it works:** Climb a tower of 8 levels (or more). Each level has 3-4 tiles, one is a trap. Pick the safe tile to advance. Cash out anytime. Each level multiplies your bet. Hit a trap = lose everything.
**House edge:** ~1%
**Implementation complexity:** Medium
**Visual requirements:** Vertical tower visualization, tile flip animations, character/token climbing, dramatic trap reveal, running multiplier counter.
**Why players love it:** Risk management strategy, "one more level" addiction, satisfying progression, cash-out decision creates drama.
**Fun factor:** 8/10 — Very engaging decision-making
**Replayability:** 8/10 — Each game tells a story
**Uniqueness:** Medium — Similar to Mines but vertical orientation changes the psychology

---

### 7. Dragon Tower
**Category:** Stake Original
**How it works:** Nearly identical to Tower but with dragon/fantasy theming. Climb tower levels, avoid dragon eggs/traps, cash out before you hit a bad tile.
**House edge:** ~1%
**Implementation complexity:** Medium
**Visual requirements:** Fantasy-themed tower (stone, fire, dragons), egg reveal animations, dragon roar sound effects, medieval aesthetic.
**Why players love it:** Same as Tower but with more immersive theming for players who want narrative.
**Fun factor:** 8/10 — Same mechanics as Tower
**Replayability:** 8/10 — Theme variety keeps it fresh
**Uniqueness:** Low — Duplicate of Tower with different skin

---

### 8. Scarab Spin
**Category:** Stake Original
**How it works:** Egyptian-themed spinner with segments containing multipliers (1x-10x+). Spin to win the multiplier. Can choose bet amount and watch the wheel spin.
**House edge:** ~2-3%
**Implementation complexity:** Easy
**Visual requirements:** Egyptian scarab beetle wheel design, golden animations, hieroglyphic symbols, sand/desert particle effects.
**Why players love it:** Theme is engaging, simpler than full slots, quick rounds, nostalgia for Egyptian mystique.
**Fun factor:** 7/10 — Theme carries it
**Replayability:** 6/10 — Simple spinner mechanics
**Uniqueness:** Low — Very similar to Wheel with different theme

---

### 9. Slide
**Category:** Stake Original
**How it works:** Simplified 3-reel slot machine. 3 vertical reels with symbols. Spin, if you match symbols horizontally you win. Different symbol combinations = different payouts.
**House edge:** ~3-5%
**Implementation complexity:** Medium
**Visual requirements:** 3 spinning reels with smooth stop animations, symbol designs, payline highlighting, win celebration animations.
**Why players love it:** Slot machine dopamine hit in simpler format, faster than full slots, easier to understand than 5-reel games.
**Fun factor:** 6/10 — Basic slot experience
**Replayability:** 5/10 — Can get repetitive quickly
**Uniqueness:** Low — Slots are everywhere, this is just a simpler version

---

### 10. Pump
**Category:** Stake Original
**How it works:** Inflate a balloon with pumps. Each pump increases multiplier (1.01x, 1.02x, 1.05x... exponential growth). Balloon can pop at any time (random). Cash out before it pops to win the multiplier.
**House edge:** ~1%
**Implementation complexity:** Medium
**Visual requirements:** Balloon that visually expands with each pump, stretching/strain effects, pop animation (explosion of particles), pressure gauge/meter, ominous sound as it gets bigger.
**Why players love it:** Incredible tension build-up, visual representation of risk (balloon getting bigger), "one more pump" addiction, simple concept everyone understands.
**Fun factor:** 9/10 — Extremely tense and fun
**Replayability:** 9/10 — Highly addictive
**Uniqueness:** Very High — Unique mechanic, great group spectator game

---

### 11. Tome of Life
**Category:** Stake Original
**How it works:** Book-themed reveal game. Open a mystical book to reveal pages with multipliers or special symbols. Multiple rounds of reveals, can cash out or continue. Similar to scratch-off tickets.
**House edge:** ~2-4%
**Implementation complexity:** Medium
**Visual requirements:** Book opening animation, page turning, mystical symbols appearing, golden glow effects, ancient manuscript aesthetic.
**Why players love it:** Mystery box psychology, themed narrative, progressive reveal creates anticipation.
**Fun factor:** 7/10 — Theme is engaging
**Replayability:** 6/10 — Novelty wears off
**Uniqueness:** Medium — Scratch-off style game, fills themed reveal niche

---

### 12. Hilo
**Category:** Stake Original
**How it works:** Classic card game. A card is shown. Predict if next card will be Higher or Lower (Ace is low, King is high). Correct = advance with multiplier increase. Wrong = lose. Cash out anytime. Can skip cards that are 7-8 (middle).
**House edge:** ~1-2%
**Implementation complexity:** Easy
**Visual requirements:** Card dealing animations, smooth card flip, running multiplier display, deck visualization, correct/wrong indicators.
**Why players love it:** Simple decision-making, feels skill-based (probability calculation), quick rounds, satisfying progression, nostalgic game show vibes.
**Fun factor:** 8/10 — Classic game that works
**Replayability:** 8/10 — Simple but endlessly playable
**Uniqueness:** High — We don't have a card prediction game, different from poker/blackjack

---

## TABLE GAMES

### 13. Baccarat
**Category:** Table Game
**How it works:** Bet on Player, Banker, or Tie. Two hands dealt (player & banker), each gets 2-3 cards. Hand closest to 9 wins. Face cards = 0, Aces = 1, other cards = face value. Third card rules are predetermined (no player decisions after betting).
**House edge:** 1.06% (Banker), 1.24% (Player), ~14% (Tie)
**Implementation complexity:** Medium
**Visual requirements:** Green felt table, card dealing animations, score display (player/banker boxes), chip placement zones, smooth card flip animations.
**Why players love it:** High-roller prestige (James Bond game), simple betting (no strategy decisions), fast-paced, social (multiple players bet on same hands).
**Fun factor:** 7/10 — Elegant and social
**Replayability:** 7/10 — Faster than poker, less thinking required
**Uniqueness:** High — Classic table game we're missing, different audience than blackjack

---

### 14. Sic Bo
**Category:** Table Game
**How it works:** Ancient Chinese dice game. Bet on outcomes of 3 dice rolls. Can bet on: specific numbers appearing, total sum (4-17), doubles, triples, odd/even, etc. Dozens of bet types with different payouts.
**House edge:** 2.8% to 33% depending on bet type
**Implementation complexity:** Medium-Hard
**Visual requirements:** Betting table layout (complex with many zones), 3 animated dice in tumbler/cage, dice rolling physics, multi-zone highlighting for wins, Asian-themed aesthetic.
**Why players love it:** Exotic appeal, many betting options create complexity, cultural mystique, pure chance (no skill needed).
**Fun factor:** 6/10 — Complex but interesting
**Replayability:** 5/10 — Steep learning curve
**Uniqueness:** Very High — Completely different from Western casino games, unique cultural flavor

---

## ALREADY IMPLEMENTED

- **Blackjack** ✅ — Classic 21 card game
- **Roulette** ✅ — Wheel with red/black/green numbers
- **Mines** ✅ — Grid-based mine sweeper betting game
- **Crash** ✅ — Multiplier that crashes at random point
- **Video Poker** ✅ — Jacks or Better poker variant

---

## TOP 5 GAMES TO IMPLEMENT NEXT

### 1. PLINKO (Score: 95/100)
**Why:** Unique visual appeal, highly shareable (people love watching the ball drop), different from everything we have. Medium complexity but high reward. Perfect for Twitch-style streaming among friends. The physics are mesmerizing and create water-cooler moments ("I hit the 1000x bucket!").

**Implementation priority:** Invest in good physics engine (matter.js or similar). This is a showpiece game.

---

### 2. PUMP (Score: 92/100)
**Why:** Best group spectator game on the list. "One more pump!" becomes a meme. Incredible tension build-up, extremely simple to understand (even non-gamers get it), high viral potential. Different psychology from our existing games (visible risk representation).

**Implementation priority:** Focus on smooth balloon expansion animation and sound design (creaking, stretching sounds).

---

### 3. HILO (Score: 89/100)
**Why:** Easy to implement, highly replayable, fills the "card prediction" niche. Players can actually apply probability thinking (feels skill-based even though it's luck). Fast rounds, clear decisions, works well for both solo and competitive leaderboards.

**Implementation priority:** Quick win — can ship in a week. Add stats tracker (longest streak) for engagement.

---

### 4. LIMBO (Score: 87/100)
**Why:** Simplest possible implementation but creates intense emotional response. One number going up = maximum tension. Different flavor from Crash (you set target vs. deciding when to cash out). Perfect for quick sessions. Low dev cost, high engagement return.

**Implementation priority:** Easiest to implement. Focus on snappy animations and satisfying crash effect.

---

### 5. BACCARAT (Score: 84/100)
**Why:** Adds sophistication and variety to table games section. Different audience from blackjack (no strategy decisions = lower barrier to entry). Strong cultural cachet (high roller vibes). Good for players who want table game atmosphere without learning complex rules.

**Implementation priority:** Moderate complexity. Reuse card dealing infrastructure from blackjack. Add multiplayer betting to make it social.

---

## HONORABLE MENTIONS

- **Wheel** (Score: 80/100) — Solid carnival game appeal, but lower priority than above 5
- **Tower** (Score: 78/100) — Good mechanics but too similar to Mines (which we have)
- **Dice** (Score: 75/100) — Very simple, good filler game, implement after the top 5

---

## SKIP / LOW PRIORITY

- **Dragon Tower** — Duplicate of Tower with different skin
- **Scarab Spin** — Duplicate of Wheel with Egyptian theme
- **Slide** — Basic slots, not differentiated enough
- **Tome of Life** — Gimmicky theme, gameplay not compelling
- **Keno** — Slow-paced, high house edge, less engaging than alternatives
- **Sic Bo** — Too complex for target audience, high learning curve, niche appeal

---

## IMPLEMENTATION ROADMAP

**Phase 1 (Quick Wins — 2-3 weeks):**
1. Limbo (3 days)
2. Hilo (5 days)
3. Dice (3 days)

**Phase 2 (Medium Complexity — 4-6 weeks):**
4. Pump (10 days — animation-heavy)
5. Plinko (14 days — physics engine)

**Phase 3 (Table Game Expansion — 3-4 weeks):**
6. Baccarat (12 days)

**Phase 4 (Nice to Have):**
7. Wheel
8. Tower (if player feedback shows demand for more progression games)

---

## TECHNICAL NOTES

**Shared Infrastructure Needed:**
- Random number generation with provably fair verification
- Multiplier calculation engine
- Animation framework (GSAP or Framer Motion)
- Sound effect system
- Leaderboard integration for all games
- Bet history / stats tracking

**Physics Engine (for Plinko):**
- Matter.js or Cannon.js
- Need consistent RNG seeding for fairness
- Mobile performance optimization critical

**Card Games (Hilo, Baccarat):**
- Shared card deck component
- Card dealing animation library
- Shuffle algorithm

---

## PSYCHOLOGY / ENGAGEMENT HOOKS

**High Tension Games:** Pump, Limbo, Hilo
**Visual Spectacle:** Plinko, Wheel
**Quick Dopamine:** Dice, Limbo
**Strategic Feel:** Hilo, Baccarat, Tower
**Group Watching:** Pump, Plinko (best for streaming/sharing)
**Chill Gambling:** Keno, Wheel, Baccarat

---

**Next Steps:** Review with team, validate technical feasibility of Plinko physics, start with Limbo as proof-of-concept for simplest Stake Original implementation.
