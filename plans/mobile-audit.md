# $DORI LP Tracker - Mobile Optimization Audit

**Date**: 2026-03-26
**Scope**: Casino navigation and game pages

---

## Critical Issues

### 1. CasinoSubNav Missing 5 Games

**Current State**:
- `CASINO_GAMES` array in `/home/ayoun/lol-tracker/client/src/components/CasinoSubNav.tsx` has only 7 items
- Missing: Dice, Limbo, Hi-Lo, Wheel, Plinko
- All 5 missing games exist as pages and are listed in Casino.tsx landing page

**Impact**:
- Users can only access the 5 new games from the Casino lobby
- No direct navigation between games
- Inconsistent with existing games (Blackjack, Crash, Roulette, Mines, Poker)

**With 12 items total** (Lobby + 10 games + Shop):
- On 375px screen with current horizontal scroll, users would need to scroll significantly
- Pills are small (text-[11px], compact padding) but 12 items is a lot for horizontal scroll
- No visual indicators for scroll continuation

**Solution: Two-Row Grid on Mobile**

This is the BEST approach for 12 items on mobile:

```tsx
// In CasinoSubNav.tsx
<div className="sticky top-14 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
  <div className="container">
    {/* Desktop: single-row scroll */}
    <div className="hidden sm:flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-hide">
      {CASINO_GAMES.map((game) => {
        // ... existing code
      })}
    </div>

    {/* Mobile: two-row grid */}
    <div className="grid grid-cols-3 gap-1 py-1.5 sm:hidden">
      {CASINO_GAMES.map((game) => {
        const isActive = game.exact ? location === game.href : location === game.href;
        return (
          <Link
            key={game.href}
            href={game.href}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
              isActive
                ? "bg-yellow-500/15 text-yellow-400"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            }`}
          >
            <span className="text-base">{game.emoji}</span>
            <span className="text-[9px]">{language === "ko" ? game.labelKo : game.label}</span>
          </Link>
        );
      })}
    </div>
  </div>
</div>
```

**Why this approach**:
- 12 items ÷ 3 cols = 4 rows on mobile (manageable)
- No horizontal scroll needed
- All games visible at once
- Larger tap targets (vertical stacking allows more height)
- Emoji + text vertically stacked is clearer on small screens

**Alternative considered**: Scrollable pills with fade indicators
- Pros: Maintains single-row aesthetic
- Cons: Still requires scrolling, users may not realize there are more items, fade indicators add complexity

**Alternative considered**: Collapsible dropdown
- Pros: Minimal space usage
- Cons: Adds friction (extra tap), hides navigation, less discoverable


### 2. Game Pages Missing AppNav/CasinoSubNav

**Affected Pages** (all 5 new games):
- `/home/ayoun/lol-tracker/client/src/pages/Dice.tsx`
- `/home/ayoun/lol-tracker/client/src/pages/Limbo.tsx`
- `/home/ayoun/lol-tracker/client/src/pages/Hilo.tsx`
- `/home/ayoun/lol-tracker/client/src/pages/Wheel.tsx`
- `/home/ayoun/lol-tracker/client/src/pages/Plinko.tsx`

**Current State**:
- Using old "back to casino" pattern with ArrowLeft icon
- No AppNav (missing theme toggle, language toggle, user profile, main nav)
- No CasinoSubNav (can't navigate to other games without going back to lobby)

**Example from Dice.tsx (line 75+)**:
```tsx
return (
  <div className="dark min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
    <div className="container py-6 max-w-lg mx-auto">
      {/* Old nav */}
      <Link href="/casino" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-300 mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Casino
      </Link>
      {/* ... rest of page */}
```

**Should be** (like Blackjack.tsx, line 362+):
```tsx
return (
  <div className="dark min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
    <AppNav />
    <CasinoSubNav />
    <div className="container py-6 sm:py-8 max-w-lg mx-auto">
      {/* ... rest of page */}
```


### 3. Mobile Layout Issues

**Dice.tsx**:
- Chip selector: 6 chips in a row with gap-2
- On 375px: 6 × ~48px + gaps = ~312px (fits, but tight)
- Touch targets: chips appear to be adequate size
- Game board: single number bar, should scale fine
- **Status**: Likely OK, but verify chip selector doesn't wrap awkwardly

**Plinko.tsx**:
- Canvas-based game (lines 225+)
- ROWS = 12, BUCKETS = 13
- Canvas width likely responsive via container
- **Concern**: 13 buckets across 375px = ~28px per bucket (very tight)
- May need to reduce bucket count on mobile or shrink font size
- **Status**: Needs testing, may have horizontal scroll

**Limbo.tsx**:
- Number input + slider for target multiplier
- Chip selector (same 6 chips as Dice)
- Meter with log scale (METER_TICKS array)
- **Status**: Should be OK, mostly vertical layout

**Hilo.tsx**:
- Card display: `w-24 h-36 sm:w-28 sm:h-40` (line 28)
- On 375px: 96px wide cards (reasonable)
- Higher/Lower buttons side by side
- **Status**: Likely OK

**Wheel.tsx**:
- SVG-based wheel with 50 segments
- Wheel likely responsive via viewBox
- Chip selector (same 6 chips)
- **Status**: Should be OK if SVG scales properly

**General Issues**:
- All games use same CHIP_COLORS with 6 denominations
- Chip selector appears consistently across all games
- On 375px, 6 chips with small gaps should fit
- **Recommendation**: Verify chip selector on actual device, may need to reduce gap or font size on mobile


### 4. Casino Landing Grid

**Current State** (`/home/ayoun/lol-tracker/client/src/pages/Casino.tsx`):
- GAMES array has 10 items (all new games included)
- Grid rendering not visible in first 25 lines, but based on pattern should use responsive grid
- 10 games in 2-col grid = 5 rows on mobile

**Expected Layout**:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
  {GAMES.map(game => ...)}
</div>
```

**Mobile Impact**:
- 5 rows of game cards on 375px screen
- Requires scrolling but reasonable
- Each card has emoji, title, description, bet range
- **Status**: Should be OK, verify card height isn't excessive

---

## Proposed Fixes

### Fix 1: Add Missing Games to CasinoSubNav

**File**: `/home/ayoun/lol-tracker/client/src/components/CasinoSubNav.tsx`

**Changes**:
1. Add 5 missing games to CASINO_GAMES array
2. Implement two-row grid for mobile

```tsx
import { Link, useLocation } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";

const CASINO_GAMES = [
  { href: "/casino", label: "Lobby", labelKo: "로비", emoji: "🎰", exact: true },
  { href: "/casino/blackjack", label: "Blackjack", labelKo: "블랙잭", emoji: "🃏" },
  { href: "/casino/crash", label: "Crash", labelKo: "크래시", emoji: "🚀" },
  { href: "/casino/roulette", label: "Roulette", labelKo: "룰렛", emoji: "🎡" },
  { href: "/casino/mines", label: "Mines", labelKo: "지뢰", emoji: "💣" },
  { href: "/casino/poker", label: "Poker", labelKo: "포커", emoji: "🃑" },
  { href: "/casino/dice", label: "Dice", labelKo: "주사위", emoji: "🎲" },
  { href: "/casino/limbo", label: "Limbo", labelKo: "림보", emoji: "📈" },
  { href: "/casino/hilo", label: "Hi-Lo", labelKo: "하이로", emoji: "🃏" },
  { href: "/casino/wheel", label: "Wheel", labelKo: "휠", emoji: "🎡" },
  { href: "/casino/plinko", label: "Plinko", labelKo: "플링코", emoji: "📌" },
  { href: "/casino/shop", label: "Shop", labelKo: "상점", emoji: "🛍️" },
];

export default function CasinoSubNav() {
  const [location] = useLocation();
  const { language } = useTranslation();

  return (
    <div className="sticky top-14 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
      <div className="container">
        {/* Desktop: single-row scroll */}
        <div className="hidden sm:flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-hide">
          {CASINO_GAMES.map((game) => {
            const isActive = game.exact ? location === game.href : location === game.href;
            return (
              <Link
                key={game.href}
                href={game.href}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-yellow-500/15 text-yellow-400"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                }`}
              >
                <span className="text-xs">{game.emoji}</span>
                {language === "ko" ? game.labelKo : game.label}
              </Link>
            );
          })}
        </div>

        {/* Mobile: three-column grid */}
        <div className="grid grid-cols-3 gap-1 py-1.5 sm:hidden">
          {CASINO_GAMES.map((game) => {
            const isActive = game.exact ? location === game.href : location === game.href;
            return (
              <Link
                key={game.href}
                href={game.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  isActive
                    ? "bg-yellow-500/15 text-yellow-400"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                }`}
              >
                <span className="text-base">{game.emoji}</span>
                <span className="text-[9px] leading-tight">{language === "ko" ? game.labelKo : game.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

**Result**:
- Desktop: single-row horizontal scroll (unchanged)
- Mobile: 3-col grid, 4 rows, no horizontal scroll
- All 12 items visible without scrolling down


### Fix 2: Add AppNav/CasinoSubNav to All Game Pages

**Files to update**:
1. `/home/ayoun/lol-tracker/client/src/pages/Dice.tsx`
2. `/home/ayoun/lol-tracker/client/src/pages/Limbo.tsx`
3. `/home/ayoun/lol-tracker/client/src/pages/Hilo.tsx`
4. `/home/ayoun/lol-tracker/client/src/pages/Wheel.tsx`
5. `/home/ayoun/lol-tracker/client/src/pages/Plinko.tsx`

**For each file**:

1. Add imports (after existing imports, around line 5-8):
```tsx
import AppNav from "@/components/AppNav";
import CasinoSubNav from "@/components/CasinoSubNav";
```

2. Remove ArrowLeft import from lucide-react (it's no longer needed):
```tsx
// BEFORE:
import { ArrowLeft, Loader2 } from "lucide-react";

// AFTER:
import { Loader2 } from "lucide-react";
```

3. Update main return statement structure:
```tsx
// BEFORE (example from Dice.tsx line 75+):
return (
  <div className="dark min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
    <div className="container py-6 max-w-lg mx-auto">
      <Link href="/casino" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-300 mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Casino
      </Link>
      {/* rest of content */}
    </div>
  </div>
);

// AFTER:
return (
  <div className="dark min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
    <AppNav />
    <CasinoSubNav />
    <div className="container py-6 sm:py-8 max-w-lg mx-auto">
      {/* rest of content - remove the old Link with ArrowLeft */}
    </div>
  </div>
);
```

4. Remove the old "back to casino" Link element entirely

**Line numbers to target**:
- Dice.tsx: ~line 75-79
- Limbo.tsx: ~line 95-99
- Wheel.tsx: ~line 89-93
- Hilo.tsx: ~line 89-93
- Plinko.tsx: ~line 225-229

**Result**: All game pages will have:
- Consistent navigation (AppNav + CasinoSubNav)
- Direct game-to-game navigation
- Access to theme toggle, language toggle, user profile
- No need to return to lobby to switch games


### Fix 3: Mobile-Specific Layout Adjustments

**Plinko.tsx - Reduce Bucket Label Size**

The 13 buckets on 375px screen will be very tight (~28px each). Make bucket labels smaller on mobile:

```tsx
// In the bucket rendering section (find where bucket multipliers are displayed):
// BEFORE:
<text className="text-xs font-bold">

// AFTER:
<text className="text-[10px] sm:text-xs font-bold">
```

**All Game Pages - Chip Selector Mobile Optimization**

The 6-chip selector appears on all games. Verify it fits on 375px, if not, reduce gap:

```tsx
// Find the chip selector section in each file, look for:
<div className="flex items-center gap-2 flex-wrap">

// IF chips wrap to two rows, change to:
<div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
```

**Files to check**: Dice.tsx, Limbo.tsx, Hilo.tsx, Wheel.tsx, Plinko.tsx
(Blackjack, Crash, Roulette, Mines, VideoPoker should already be optimized)


### Fix 4: Verify Casino Landing Grid

**File**: `/home/ayoun/lol-tracker/client/src/pages/Casino.tsx`

**Action**: Read full file to verify grid implementation

**Expected**: Should already have responsive grid
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
```

**If not present**: Add responsive grid classes to game list container


---

## Implementation Priority

1. **HIGH**: Fix 2 - Add AppNav/CasinoSubNav to all game pages
   - User impact: Major (missing core navigation)
   - Effort: Low (copy-paste pattern)
   - Lines affected: ~5 per file × 5 files = 25 lines

2. **HIGH**: Fix 1 - Add missing games to CasinoSubNav
   - User impact: Major (can't access 5 games from nav)
   - Effort: Medium (array update + mobile grid layout)
   - Lines affected: ~50 lines total

3. **MEDIUM**: Fix 3 - Mobile layout adjustments
   - User impact: Medium (usability on small screens)
   - Effort: Low (minor CSS tweaks)
   - Lines affected: ~10 lines across files
   - Requires: Device testing to verify necessity

4. **LOW**: Fix 4 - Verify casino landing grid
   - User impact: Low (likely already correct)
   - Effort: Low (verification only)

---

## Testing Checklist

After implementing fixes, test on 375px viewport:

- [ ] CasinoSubNav shows all 12 items in 3-col grid
- [ ] All 12 nav items have 44px+ tap targets
- [ ] No horizontal scroll on nav
- [ ] All game pages have AppNav + CasinoSubNav
- [ ] Can navigate game-to-game without returning to lobby
- [ ] Theme/language toggles accessible from all game pages
- [ ] Chip selector doesn't wrap awkwardly on any game
- [ ] Plinko bucket labels readable at 375px
- [ ] Casino landing shows all 10 games in readable grid
- [ ] No horizontal scroll on any game page

---

## Notes

**Emoji conflicts**: Hi-Lo and Roulette both use 🎡 in GAMES array but Hi-Lo uses 🃏 in CasinoSubNav spec above. Verify intended emoji with design.

**Wheel vs Roulette**: Both are wheel-based games. Consider using different emojis for clarity:
- Roulette: 🎡 (ferris wheel)
- Wheel: 🎯 (target) or 🎰 (slot machine)

**Touch target sizes**: WCAG 2.1 recommends 44×44px minimum for touch targets. Verify all interactive elements meet this, especially in the mobile nav grid.

**Performance**: Two-row nav increases height by ~40px. Monitor whether this impacts gameplay on phones with small screens (<667px height).
