# Casino Shop Effects Audit Report
**Date:** 2026-03-26
**Scope:** Verify all cosmetic CSS classes render correctly in CasinoShop.tsx

---

## Executive Summary

**Status:** ✅ All keyframes present, but several CSS class issues found
**Critical Issues:** 3
**Warnings:** 2
**Total Cosmetics Checked:** 32 items (15 titles, 17 name effects)

---

## 1. Keyframes Audit

### ✅ All Required Keyframes Present

All `animate-[...]` references in seedCosmetics.ts have corresponding `@keyframes` definitions in index.css (lines 232-255):

| Animation Class | Keyframe | Status |
|----------------|----------|--------|
| `animate-[rainbow_3s_linear_infinite]` | `@keyframes rainbow` (lines 232-235) | ✅ Present |
| `animate-[shimmer_2s_linear_infinite]` | `@keyframes shimmer` (lines 236-239) | ✅ Present |
| `animate-[lightning_0.5s_ease-in-out_infinite]` | `@keyframes lightning` (lines 240-243) | ✅ Present |
| `animate-[sparkle_3s_linear_infinite]` | `@keyframes sparkle` (lines 244-247) | ✅ Present |
| `animate-[flow_2s_linear_infinite]` | `@keyframes flow` (lines 248-251) | ✅ Present |
| `animate-[cosmic_4s_ease-in-out_infinite]` | `@keyframes cosmic` (lines 252-255) | ✅ Present |

**Finding:** All animations have proper keyframe definitions. No missing keyframes.

---

## 2. CSS Class Compatibility (Tailwind v4)

### ✅ Compatible Classes
- `bg-gradient-to-r from-X to-Y` — Standard Tailwind gradient syntax
- `bg-clip-text text-transparent` — Standard text gradient technique
- `animate-pulse` — Built-in Tailwind utility
- Arbitrary values like `bg-[length:200%_100%]` — Valid Tailwind v4 syntax
- Drop-shadow arbitrary values — Valid syntax

### ⚠️ Potential Rendering Issues

#### Issue #1: Text Gradient Visibility on Dark Background (CRITICAL)
**Location:** All gradient-based name effects
**Lines in seedCosmetics.ts:** 92-94, 101-102, 106-108

**Affected Items:**
- "Sunset" (line 92): `from-orange-500 to-pink-500`
- "Ocean Wave" (line 93): `from-blue-600 to-cyan-400`
- "Toxic" (line 94): `from-lime-400 to-green-600`
- "Shimmer" (line 101): `from-yellow-200 via-yellow-400 to-yellow-200`
- "Inferno" (line 102): `from-red-600 via-orange-500 to-yellow-400`
- "Diamond Sparkle" (line 106): `from-blue-100 via-white to-blue-100`
- "Molten Gold" (line 107): `from-yellow-600 via-yellow-400 to-yellow-600`
- "Cosmic Void" (line 108): `from-purple-900 via-pink-500 to-purple-900`

**Problem:** These gradient texts render on:
- CasinoShop.tsx background: `bg-gradient-to-b from-zinc-900 via-zinc-950 to-black` (line 84)
- Preview card backgrounds: `bg-zinc-900/40` (line 173) or darker

**Specific Concerns:**
- "Diamond Sparkle" uses `from-blue-100 via-white to-blue-100` — white/light blue may have insufficient contrast
- "Shimmer" uses `yellow-200/yellow-400` — may be too light
- "Cosmic Void" uses `from-purple-900` — dark purple on dark background

**Recommendation:** Test all gradient effects on actual dark green felt background. Consider:
- Increasing saturation/brightness of gradient stops
- Adding drop-shadow to all gradients (not just some)
- Using lighter color variants

---

#### Issue #2: Drop-Shadow on Tiny Text (WARNING)
**Location:** Name effects with drop-shadow
**Lines in seedCosmetics.ts:** 95-97, 103, 106-108

**Affected Items:**
- "Gold Rush" (line 95): `drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]`
- "Neon Pink" (line 96): `drop-shadow-[0_0_10px_rgba(244,114,182,0.8)]`
- "Ice Cold" (line 97): `drop-shadow-[0_0_12px_rgba(103,232,249,0.7)]`
- "Electric Storm" (line 103): `drop-shadow-[0_0_25px_rgba(147,197,253,1)]`
- "Diamond Sparkle" (line 106): `drop-shadow-[0_0_30px_rgba(255,255,255,1)]`
- "Molten Gold" (line 107): `drop-shadow-[0_0_35px_rgba(234,179,8,1)]`
- "Cosmic Void" (line 108): `drop-shadow-[0_0_40px_rgba(168,85,247,1)]`

**Problem:** Drop-shadows are applied to text rendered at `text-[8px]` (TitleBadge, line 28) and `text-sm` (NamePreview, line 36).

**Concern:**
- 8px text with 25-40px drop-shadow blur radius creates massive glow that overwhelms tiny text
- May cause readability issues or appear as amorphous blobs
- Shadows sized for full names (text-sm) applied to tiny badges

**Recommendation:**
- Test preview rendering at both sizes
- Consider conditional shadow sizing based on context
- May need to reduce blur radius for legendary effects

---

#### Issue #3: Background Size Animation on Static Elements (CRITICAL)
**Location:** "Shimmer", "Molten Gold", "Cosmic Void"
**Lines in seedCosmetics.ts:** 101, 107, 108

**CSS Classes:**
```
Shimmer (line 101):
bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200
bg-[length:200%_100%] bg-clip-text text-transparent
animate-[shimmer_2s_linear_infinite]

Molten Gold (line 107):
bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600
bg-[length:200%_100%] bg-clip-text text-transparent
animate-[flow_2s_linear_infinite]

Cosmic Void (line 108):
bg-gradient-to-r from-purple-900 via-pink-500 to-purple-900
bg-[length:300%_100%] bg-clip-text text-transparent
animate-[cosmic_4s_ease-in-out_infinite]
```

**Keyframe Definitions (index.css):**
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes flow {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
@keyframes cosmic {
  0%, 100% { background-position: 0% 50%; filter: brightness(1); }
  50% { background-position: 100% 50%; filter: brightness(1.3); }
}
```

**Problem:** These animations rely on `background-position` changes, but the CSS includes:
- `bg-clip-text` — Clips background to text shape
- `text-transparent` — Makes text transparent to show background
- **BUT:** Tailwind v4 arbitrary animations may not properly apply to inline elements

**Potential Issue:**
- `<span>` elements (used in TitleBadge and NamePreview) are inline by default
- Background animations on inline elements may not render correctly
- Need `display: inline-block` or `display: block` for background-position animations to work

**Fix Required:** Add `inline-block` to the CSS classes or ensure components wrap in block-level elements.

---

## 3. Rendering Issues Summary

### By Severity:

**CRITICAL (Fix Required):**
1. Background animation classes need `inline-block` display mode (affects Shimmer, Molten Gold, Cosmic Void)
2. Gradient visibility on dark background (test all 8 gradient effects)

**WARNING (Test Required):**
1. Drop-shadow effects on 8px text may overwhelm readability
2. Light gradient stops (blue-100, yellow-200, white) may have contrast issues

---

## 4. Fix List

### Fix #1: Add `inline-block` to Animated Gradient Effects

**Location:** seedCosmetics.ts, lines 101, 107, 108

**Current CSS:**
```typescript
// Line 101 - Shimmer
css: "bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 bg-[length:200%_100%] bg-clip-text text-transparent animate-[shimmer_2s_linear_infinite]"

// Line 107 - Molten Gold
css: "bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 bg-[length:200%_100%] bg-clip-text text-transparent animate-[flow_2s_linear_infinite]"

// Line 108 - Cosmic Void
css: "bg-gradient-to-r from-purple-900 via-pink-500 to-purple-900 bg-[length:300%_100%] bg-clip-text text-transparent animate-[cosmic_4s_ease-in-out_infinite]"
```

**Fixed CSS:**
```typescript
// Line 101 - Shimmer
css: "inline-block bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 bg-[length:200%_100%] bg-clip-text text-transparent animate-[shimmer_2s_linear_infinite]"

// Line 107 - Molten Gold
css: "inline-block bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 bg-[length:200%_100%] bg-clip-text text-transparent animate-[flow_2s_linear_infinite]"

// Line 108 - Cosmic Void
css: "inline-block bg-gradient-to-r from-purple-900 via-pink-500 to-purple-900 bg-[length:300%_100%] bg-clip-text text-transparent animate-[cosmic_4s_ease-in-out_infinite]"
```

---

### Fix #2: Brighten Gradient Stops for Dark Background Visibility

**Location:** seedCosmetics.ts, lines 92-94, 101-102, 106-108

**Recommendations:**

```typescript
// Line 92 - Sunset (OK - orange/pink bright enough)
// No change needed

// Line 93 - Ocean Wave (OK - cyan is bright)
// No change needed

// Line 94 - Toxic (OK - lime is bright)
// No change needed

// Line 101 - Shimmer (TOO LIGHT - upgrade from 200/400 to 400/500)
css: "inline-block bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 bg-[length:200%_100%] bg-clip-text text-transparent animate-[shimmer_2s_linear_infinite]"

// Line 102 - Inferno (OK - bright enough)
// No change needed

// Line 106 - Diamond Sparkle (TOO LIGHT - upgrade to blue-200/blue-100/blue-200)
css: "bg-gradient-to-br from-blue-200 via-blue-100 to-blue-200 bg-clip-text text-transparent animate-[sparkle_3s_linear_infinite]"

// Line 107 - Molten Gold (OK - 600/400/600 visible)
// No change needed (but add inline-block per Fix #1)

// Line 108 - Cosmic Void (DARK START - upgrade purple-900 to purple-700)
css: "inline-block bg-gradient-to-r from-purple-700 via-pink-500 to-purple-700 bg-[length:300%_100%] bg-clip-text text-transparent animate-[cosmic_4s_ease-in-out_infinite]"
```

---

### Fix #3: Add Drop-Shadow to Non-Glowing Gradients

**Location:** seedCosmetics.ts, lines 92-94, 102

These gradient effects don't have drop-shadow, making them potentially hard to read:

```typescript
// Line 92 - Sunset
css: "bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent"
extra: "drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]"  // Add orange glow

// Line 93 - Ocean Wave
css: "bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent"
extra: "drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"  // Add cyan glow

// Line 94 - Toxic
css: "bg-gradient-to-r from-lime-400 to-green-600 bg-clip-text text-transparent"
extra: "drop-shadow-[0_0_10px_rgba(163,230,53,0.6)]"  // Add lime glow

// Line 102 - Inferno
css: "bg-gradient-to-t from-red-600 via-orange-500 to-yellow-400 bg-clip-text text-transparent"
extra: "drop-shadow-[0_0_15px_rgba(251,146,60,0.7)]"  // Add fire glow
```

---

## 5. Complete Fixed seedCosmetics.ts Snippet

**Lines to replace (92-108):**

```typescript
// ─── NAME EFFECTS: Rare ($35-60) ───
{ type: "name_effect", name: "Sunset", tier: "rare", price: 35, css: "bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent", desc: "Warm fade", extra: "drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]" },
{ type: "name_effect", name: "Ocean Wave", tier: "rare", price: 40, css: "bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent", desc: "Cool and fluid", extra: "drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" },
{ type: "name_effect", name: "Toxic", tier: "rare", price: 45, css: "bg-gradient-to-r from-lime-400 to-green-600 bg-clip-text text-transparent", desc: "Radioactive energy", extra: "drop-shadow-[0_0_10px_rgba(163,230,53,0.6)]" },
{ type: "name_effect", name: "Gold Rush", tier: "rare", price: 50, css: "text-yellow-500", desc: "Golden glow", extra: "drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]" },
{ type: "name_effect", name: "Neon Pink", tier: "rare", price: 55, css: "text-pink-400", desc: "Hot pink glow", extra: "drop-shadow-[0_0_10px_rgba(244,114,182,0.8)]" },
{ type: "name_effect", name: "Ice Cold", tier: "rare", price: 60, css: "text-cyan-300", desc: "Frosty aura", extra: "drop-shadow-[0_0_12px_rgba(103,232,249,0.7)]" },

// ─── NAME EFFECTS: Epic ($120-200) ───
{ type: "name_effect", name: "Rainbow Cycle", tier: "epic", price: 120, css: "text-red-400 animate-[rainbow_3s_linear_infinite]", desc: "Full spectrum shift" },
{ type: "name_effect", name: "Shimmer", tier: "epic", price: 150, css: "inline-block bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 bg-[length:200%_100%] bg-clip-text text-transparent animate-[shimmer_2s_linear_infinite]", desc: "Metallic sheen" },
{ type: "name_effect", name: "Inferno", tier: "epic", price: 180, css: "bg-gradient-to-t from-red-600 via-orange-500 to-yellow-400 bg-clip-text text-transparent", desc: "Flames rising", extra: "drop-shadow-[0_0_15px_rgba(251,146,60,0.7)]" },
{ type: "name_effect", name: "Electric Storm", tier: "epic", price: 200, css: "text-blue-300 animate-[lightning_0.5s_ease-in-out_infinite]", desc: "Lightning strikes", extra: "drop-shadow-[0_0_25px_rgba(147,197,253,1)]" },

// ─── NAME EFFECTS: Legendary ($350-500) ───
{ type: "name_effect", name: "Diamond Sparkle", tier: "legendary", price: 350, css: "bg-gradient-to-br from-blue-200 via-blue-100 to-blue-200 bg-clip-text text-transparent animate-[sparkle_3s_linear_infinite]", desc: "VIP sparkle", extra: "drop-shadow-[0_0_30px_rgba(255,255,255,1)]" },
{ type: "name_effect", name: "Molten Gold", tier: "legendary", price: 400, css: "inline-block bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 bg-[length:200%_100%] bg-clip-text text-transparent animate-[flow_2s_linear_infinite]", desc: "Liquid metal", extra: "drop-shadow-[0_0_35px_rgba(234,179,8,1)]" },
{ type: "name_effect", name: "Cosmic Void", tier: "legendary", price: 500, css: "inline-block bg-gradient-to-r from-purple-700 via-pink-500 to-purple-700 bg-[length:300%_100%] bg-clip-text text-transparent animate-[cosmic_4s_ease-in-out_infinite]", desc: "Nebula aura", extra: "drop-shadow-[0_0_40px_rgba(168,85,247,1)]" },
```

---

## 6. Testing Checklist

After applying fixes, verify:

- [ ] All animated gradients (Shimmer, Molten Gold, Cosmic Void) actually animate in browser
- [ ] Gradient text is readable on dark background in both TitleBadge (8px) and NamePreview (text-sm)
- [ ] Drop-shadow effects don't create unreadable blobs on tiny text
- [ ] "Diamond Sparkle" white gradient is visible (not invisible on dark background)
- [ ] "Shimmer" yellow gradient isn't washed out
- [ ] "Cosmic Void" purple isn't too dark to see
- [ ] All 6 keyframe animations play correctly without jank
- [ ] Effects render in both equipped preview (lines 106-116) and catalog preview (lines 188-194)

---

## Appendix: All Cosmetic Items by Type

### Titles (15 items)
**Common (8):** Lucky Charm, Card Counter, Down Bad, Copium Dealer, Paper Hands, Casual Gambler, Slot Enjoyer, Betting Enthusiast
**Rare (8):** High Roller, Card Shark, Diamond Hands, Elo Gambler, Ranked Degen, Risk Taker, Profit Prophet, Crash Test Dummy
**Epic (7):** Built Different, Main Character, Casino Royale, Money Printer, Challenger Gambler, All In Andy, Degen Royalty
**Legendary (3):** Casino Overlord, Money Bags, House Edge Survivor
**Legendary Limited (2):** Unhinged (10 stock), Limit Does Not Exist (5 stock)

### Name Effects (17 items)
**Common (5):** Cherry Red, Sky Blue, Forest Green, Royal Purple, Amber
**Rare (6):** Sunset, Ocean Wave, Toxic, Gold Rush, Neon Pink, Ice Cold
**Epic (4):** Rainbow Cycle, Shimmer, Inferno, Electric Storm
**Legendary (3):** Diamond Sparkle, Molten Gold, Cosmic Void

---

**End of Audit Report**
