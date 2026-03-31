# Casino Visual Audit - Premium Experience Gap Analysis

**Date:** 2026-03-26
**Auditor:** PM Review
**Status:** All 5 games functional, auditing for WOW factor

---

## Game-by-Game Audit

---

### Limbo

**Current State:** A number counting up from 1.00 to the crash point, displayed as a large `text-5xl` mono font in the center. Uses `requestAnimationFrame` to animate the counter. No visual context -- just a naked number ticking up. History strip at top shows past crash points as tiny pills.

**What's Missing:**
- No visual tension or suspense -- it's literally watching a number increment
- No spatial representation of "climbing" or "crashing"
- No target line visualization (you set a target but can't SEE it during the animation)
- No acceleration/deceleration curve feel
- The animation duration caps at 2 seconds regardless, so high multipliers don't feel different from low ones

**Proposed Improvements:**

| # | Improvement | Description | Impact | Effort |
|---|-----------|-------------|--------|--------|
| 1 | **Vertical rising meter** | Replace bare number with a vertical bar/meter that fills upward. Target multiplier shown as a horizontal line. Ball of light climbs the meter. If it passes the line = win, if it stops below = loss. | 5 | 3 |
| 2 | **Color gradient shift during climb** | Background/number transitions from cool blue (safe, low) through yellow to red (danger, high) as the multiplier climbs. Creates visceral tension. | 4 | 1 |
| 3 | **Screen pulse/shake on crash** | When the multiplier stops, add a brief `motion` shake on the container if lost, or a glow burst if won. Currently the number just... stops. | 4 | 1 |
| 4 | **Increasing text scale during climb** | Number grows slightly in font-size as the multiplier climbs (e.g., `text-5xl` to `text-7xl`). Adds subconscious pressure. | 3 | 1 |
| 5 | **Heartbeat pulse animation** | The displayed number pulses/throbs faster as it gets closer to the target multiplier. | 3 | 2 |
| 6 | **Crash trail / graph line** | Draw an SVG line that traces the multiplier climb in real-time (like crash gambling sites). X-axis = time, Y-axis = multiplier. Target shown as horizontal dashed line. | 5 | 4 |

**Priority:** Items 2, 3, 4 are quick wins. Item 1 or 6 would be the signature visual upgrade.

---

### Hi-Lo

**Current State:** Card renders with a spring animation (`rotateY: -90` to `0`), which provides a basic flip effect. Higher/Lower buttons show multiplier for each guess. Card history shown as tiny pills at top. Multiplier badge in header during active game.

**What's Missing:**
- The card flip is decent but lacks the "dealing from a deck" feel -- card just appears
- No streak celebration -- getting 5+ correct in a row feels the same as getting 1
- No visual cue for how close the current card is to Ace or King (probability context)
- Cash-out button doesn't feel urgent or rewarding enough
- The card history pills are too small to see suit/rank clearly

**Proposed Improvements:**

| # | Improvement | Description | Impact | Effort |
|---|-----------|-------------|--------|--------|
| 1 | **Card slide-in from deck** | Before the flip animation, card slides in from a "deck" on the right side of the screen. Adds dealing feel. Use `motion` with `x: 200` initial. | 4 | 2 |
| 2 | **Streak combo counter** | After 2+ correct guesses, show a combo counter ("3x Streak!") with increasing glow intensity. At 5+ streak, the counter should pulse gold. | 5 | 2 |
| 3 | **Card back design** | Show a styled card back (dark pattern) before the flip, not just empty space. Makes the reveal more dramatic. | 3 | 2 |
| 4 | **Growing cash-out glow** | Cash-out button glows brighter the higher the multiplier. At 3x+, add a shimmer animation. Creates urgency. | 4 | 1 |
| 5 | **Probability bar** | Below the card, show a thin bar indicating likelihood of higher vs lower (based on current rank). Helps players feel informed. | 3 | 2 |
| 6 | **Wrong guess: card shatter/shake** | On loss, the card briefly shakes or cracks before the "Wrong!" message. Currently it's anticlimactic. | 4 | 2 |
| 7 | **Full-width card history** | Replace tiny pills with mini card faces (showing rank+suit in proper colors) in the history strip. | 3 | 2 |

**Priority:** Items 2, 4 are the highest impact quickest wins. Item 1 + 6 add drama to the core loop.

---

### Wheel

**Current State:** Conic-gradient wheel (50 segments) with CSS `transform: rotate()` and `transition` for the spin. Static yellow triangle pointer at top. Center hub shows "SPIN". Results strip at top shows past multipliers color-coded.

**What's Missing:**
- No segment labels on the wheel itself -- you can't tell what you might land on without memorizing colors
- The pointer is static; no wobble/bounce when landing near segment edges
- No light effects around the rim -- feels flat compared to real casino wheels
- The spin easing is good (`cubic-bezier(0.17, 0.67, 0.12, 0.99)`) but the landing moment has no drama
- Center hub is wasted space (just says "SPIN")

**Proposed Improvements:**

| # | Improvement | Description | Impact | Effort |
|---|-----------|-------------|--------|--------|
| 1 | **Segment labels on wheel** | Render multiplier text on each segment (rotated to match angle). Even if small, it lets players see what's where. Use absolute-positioned divs or SVG text. | 5 | 3 |
| 2 | **Pointer bounce on landing** | After spin ends, add a CSS keyframe bounce on the pointer triangle (2-3 small oscillations). Simulates physical "clicking" past segments. | 4 | 1 |
| 3 | **Rim light dots** | Add 20-30 small dots around the wheel's circumference that "chase" (light up sequentially) during spin. Use a rotating gradient or animated pseudo-elements. | 4 | 3 |
| 4 | **Landing segment highlight** | After spin stops, the winning segment briefly pulses/glows brighter. Currently you only see the result text below. | 4 | 2 |
| 5 | **Center hub shows result** | After landing, center hub displays the multiplier won (e.g., "5x") instead of always showing "SPIN". | 3 | 1 |
| 6 | **Tick-tick-tick deceleration sound visual** | As wheel decelerates, add subtle opacity pulses on the pointer (like it's clicking past each segment). Visual metronome effect. | 3 | 2 |
| 7 | **Big win explosion** | On 10x+ or 50x, add a burst of particles/confetti emanating from the wheel center. These are the rare, exciting moments. | 5 | 3 |

**Priority:** Items 2, 5 are trivial wins. Item 1 is the single biggest upgrade for usability. Item 7 makes rare wins memorable.

---

### Plinko

**Being handled separately (physics overhaul)**

**Quick Notes from Audit:**
- Current peg board uses div-based layout with flexbox -- pegs are tiny `w-1.5 h-1.5` circles
- Ball animation uses Framer Motion spring physics on `top`/`left` percentage positioning
- Ball path is step-based (150ms per row) which feels mechanical, not physics-based
- Bucket highlight on landing works (`ring-2 ring-yellow-400 scale-110`)
- The board is visually sparse -- pegs are small gray dots with no depth

**Things to carry into physics overhaul:**
- Ball needs to feel like it has weight (gravity acceleration, not linear steps)
- Pegs should react when ball hits them (brief flash/scale pulse)
- Ball should leave a fading trail as it bounces down
- Sound-like visual: slight screen shake when ball lands in bucket

---

### Dice

**Being handled separately (visual overhaul)**

**Quick Notes from Audit:**
- Roll display is a large mono number with random-number animation (15 frames at 50ms intervals)
- Target slider uses native `<input type="range">` with `accent-yellow-500` -- looks like default browser UI
- Direction toggle (Over/Under) is clean with green/red color coding
- Results strip shows win/loss as tiny colored circles
- The random-number scramble animation is decent but feels generic

**Things to carry into visual overhaul:**
- The native range slider needs custom styling -- it's the most interacted-with element and looks plain
- Roll animation could show the number on a visual "track" (0-100 bar) with an animated marker
- Consider 3D dice visual even if the game mechanic is number-based
- The "scrambling numbers" effect is fine but could benefit from a speed curve (fast -> slow)

---

## Cross-Game Improvements

These apply to ALL casino games and should be implemented as shared components/utilities.

| # | Improvement | Description | Impact | Effort | Priority |
|---|-----------|-------------|--------|--------|----------|
| 1 | **Win celebration: confetti burst** | On wins of 5x+ multiplier, trigger a confetti/particle burst animation. Use a lightweight lib like `canvas-confetti` or CSS-only particles. Import once, call from any game. | 5 | 2 | P0 |
| 2 | **Screen shake on loss** | Shared utility: `useScreenShake()` hook that applies a brief CSS transform shake to the game container on loss. 100ms, 3px displacement. | 4 | 1 | P0 |
| 3 | **Win flash/pulse** | On any win, briefly flash the game container border from transparent to green and back. 300ms. Pure CSS animation class. | 4 | 1 | P0 |
| 4 | **Consistent ambient glow** | Each game already has the dark gradient background, but add a subtle radial glow behind the main game element (cards, wheel, etc.) in the game's accent color. | 3 | 1 | P1 |
| 5 | **Loading skeleton states** | While waiting for server response after bet, show a skeleton pulse on the result area instead of just a spinner. More premium feel. | 3 | 2 | P1 |
| 6 | **Big win overlay** | For massive wins (10x+), show a full-screen overlay with the win amount, animated counter, and auto-dismiss after 2s. Think slot machine jackpot screen. | 5 | 3 | P1 |
| 7 | **Shared chip component** | All 5 games duplicate the exact same `CHIP_COLORS` constant and chip rendering code. Extract to `<ChipSelector />` component. Not visual, but reduces maintenance. | 2 | 1 | P2 |
| 8 | **Bet history with graph** | Replace the results strip (tiny pills) with a mini sparkline showing win/loss trend over last 15 bets. More visually informative. | 3 | 3 | P2 |
| 9 | **Ambient particle background** | Subtle floating particles (like dust motes) in the background of all casino pages. Very subtle, very premium. CSS-only possible. | 2 | 2 | P2 |

---

## Impact vs Effort Matrix

### Quick Wins (High Impact, Low Effort) -- DO THESE FIRST
- Limbo: Color gradient shift during climb (I:4, E:1)
- Limbo: Screen pulse/shake on crash (I:4, E:1)
- Limbo: Increasing text scale (I:3, E:1)
- Hi-Lo: Growing cash-out glow (I:4, E:1)
- Wheel: Pointer bounce on landing (I:4, E:1)
- Wheel: Center hub shows result (I:3, E:1)
- Cross-game: Screen shake on loss (I:4, E:1)
- Cross-game: Win flash/pulse (I:4, E:1)
- Cross-game: Ambient glow (I:3, E:1)

### High-Value Projects (High Impact, Medium Effort)
- Cross-game: Confetti burst on big wins (I:5, E:2)
- Hi-Lo: Streak combo counter (I:5, E:2)
- Hi-Lo: Card slide-in from deck (I:4, E:2)
- Hi-Lo: Wrong guess shake (I:4, E:2)
- Wheel: Landing segment highlight (I:4, E:2)
- Limbo: Heartbeat pulse (I:3, E:2)

### Signature Features (High Impact, Higher Effort)
- Wheel: Segment labels on wheel (I:5, E:3)
- Wheel: Big win explosion (I:5, E:3)
- Limbo: Vertical rising meter (I:5, E:3)
- Cross-game: Big win overlay (I:5, E:3)
- Wheel: Rim light dots (I:4, E:3)

### Long-Term / Stretch
- Limbo: Crash trail graph line (I:5, E:4)

---

## Recommended Implementation Order

**Sprint 1 -- Quick Wins (1 day):**
1. Cross-game: Extract shared `useScreenShake`, `useWinFlash`, ambient glow
2. Limbo: Color gradient + text scale + shake on crash
3. Hi-Lo: Cash-out glow effect
4. Wheel: Pointer bounce + center hub result

**Sprint 2 -- Drama & Celebration (1-2 days):**
5. Cross-game: Confetti burst component (canvas-confetti)
6. Hi-Lo: Streak combo counter + card slide-in + loss shake
7. Wheel: Landing segment highlight + segment labels

**Sprint 3 -- Signature Visuals (2-3 days):**
8. Limbo: Vertical rising meter OR crash graph line
9. Wheel: Rim lights + big win explosion
10. Cross-game: Big win overlay
11. Extract shared ChipSelector component

**Plinko & Dice:** Handled in their own overhaul tracks.

---

## Code Debt Noted

- `CHIP_COLORS` is copy-pasted identically across all 5 game files
- All games use `trpc.casino.blackjack.balance` for balance (naming artifact from blackjack being first game)
- Result display timeout (`setTimeout(() => setLastResult(null), ...)`) varies per game (2500-3000ms) -- should be consistent
- All games independently handle the "not authenticated" state -- could use a shared casino layout wrapper
