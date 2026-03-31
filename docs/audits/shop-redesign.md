# Casino Shop Redesign

## Overview
Redesigning the shop from a vertical list to a card grid that better showcases cosmetic effects, especially name effects which are visual and should be displayed prominently.

---

## Layout Structure

### Grid System
```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
  {/* Cards here */}
</div>
```

- **Mobile (default)**: 2 columns with small gaps (gap-2)
- **Desktop (sm+)**: 3 columns with medium gaps (gap-3)
- Responsive and compact on mobile, spacious on desktop

---

## Card Anatomy

Each card is ~160px tall with two main sections:

### 1. Preview Area (60% of card height)
- **Background**: Dark, neutral (`bg-zinc-950` or `bg-black`)
- **Purpose**: Show the cosmetic effect in action
- **Content**:
  - **Titles**: Show "PlayerName" + title badge next to it
  - **Name Effects**: Show "PlayerName" in LARGE text with the effect applied
    - Use `text-lg sm:text-xl` for mobile/desktop
    - This is the PRIMARY selling point — make it big enough to see gradients/animations

### 2. Info Bar (40% of card height)
- **Background**: Slightly lighter dark (`bg-zinc-900/80`)
- **Layout**: Compact bottom section with:
  - Item name (tiny, `text-[10px]`)
  - Tier badge (tiny pill, `text-[7px]`)
  - Price + Buy/Equip button row

---

## Tier-Based Card Borders

Cards have tier-colored borders with subtle glows:

```tsx
const tierBorderClasses = {
  legendary: "border-yellow-500/40 shadow-lg shadow-yellow-500/10",
  epic: "border-purple-500/30 shadow-md shadow-purple-500/10",
  rare: "border-blue-500/20 shadow-sm shadow-blue-500/5",
  common: "border-zinc-800"
};
```

---

## Effect Preview Rendering

### Static Gradients (bg-clip-text)
```tsx
// Example: "Sunset" effect
<span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
  PlayerName
</span>
```

**Key Points**:
- Must use `bg-clip-text text-transparent` together
- Gradient needs to be visible — text MUST be large enough
- Works best on dark backgrounds (`bg-zinc-950` or `bg-black`)

### Drop Shadows
```tsx
// Example: "Gold Rush" effect
<span className="text-lg sm:text-xl font-bold text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]">
  PlayerName
</span>
```

**Key Points**:
- Drop shadows work as utility classes
- Need sufficient contrast against dark background
- Render on `bg-zinc-950` for best visibility

### Animated Effects
```tsx
// Example: "Rainbow Cycle" effect
<span className="text-lg sm:text-xl font-bold text-red-400 animate-[rainbow_3s_linear_infinite]">
  PlayerName
</span>
```

**Key Points**:
- Animations reference keyframes in `/client/src/index.css`
- Available keyframes: `rainbow`, `shimmer`, `lightning`, `sparkle`, `flow`, `cosmic`
- Animations should be live (not static) in preview
- Combine with `bg-clip-text` for gradient animations

### Complex Animated Gradients
```tsx
// Example: "Shimmer" effect (gradient + animation)
<span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 bg-[length:200%_100%] bg-clip-text text-transparent animate-[shimmer_2s_linear_infinite]">
  PlayerName
</span>
```

**Key Points**:
- Requires `bg-[length:200%_100%]` or similar for scrolling gradients
- Must combine `bg-clip-text text-transparent` with animation
- Text size critical for visibility

---

## Complete Card Example

Here's the exact JSX structure for one card:

```tsx
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.03 }}
  className={`
    rounded-xl overflow-hidden
    ${item.tier === "legendary" ? "border border-yellow-500/40 shadow-lg shadow-yellow-500/10" :
      item.tier === "epic" ? "border border-purple-500/30 shadow-md shadow-purple-500/10" :
      item.tier === "rare" ? "border border-blue-500/20 shadow-sm shadow-blue-500/5" :
      "border border-zinc-800"}
  `}
>
  {/* Preview Area (60% height) */}
  <div className="h-[96px] bg-zinc-950 flex items-center justify-center px-3">
    {item.type === "title" ? (
      // Title Preview: Name + Badge
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <span className="text-sm sm:text-base font-semibold text-zinc-300">
          {myName}
        </span>
        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold whitespace-nowrap ${item.cssClass}`}>
          {item.name}
        </span>
      </div>
    ) : (
      // Name Effect Preview: Large styled text
      <span className={`text-lg sm:text-xl font-bold ${item.cssClass}`}>
        {myName}
      </span>
    )}
  </div>

  {/* Info Bar (40% height) */}
  <div className="h-[64px] bg-zinc-900/80 p-2 flex flex-col justify-between">
    {/* Top row: Name + Tier */}
    <div className="flex items-center justify-between gap-1">
      <span className="text-[10px] font-semibold text-zinc-300 truncate">
        {item.name}
      </span>
      <span className={`
        px-1.5 py-0.5 rounded text-[7px] font-bold uppercase border whitespace-nowrap shrink-0
        ${item.tier === "legendary" ? "bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-yellow-100 border-yellow-400/60" :
          item.tier === "epic" ? "bg-gradient-to-r from-purple-900/70 to-violet-900/70 text-purple-300 border-purple-500/40" :
          item.tier === "rare" ? "bg-blue-950/50 text-blue-400 border-blue-500/30" :
          "bg-zinc-800 text-zinc-400 border-zinc-700"}
      `}>
        {item.tier}
      </span>
    </div>

    {/* Bottom row: Price + Button */}
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-mono font-bold text-white">
        ${item.price.toFixed(0)}
      </span>

      {isOwned ? (
        isEquipped ? (
          <span className="flex items-center gap-0.5 text-[9px] text-emerald-400 font-bold">
            <Check className="w-3 h-3" /> Equipped
          </span>
        ) : (
          <button
            onClick={() => equipMutation.mutate({
              type: item.type as "title" | "name_effect",
              cosmeticId: item.id
            })}
            disabled={equipMutation.isPending}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 text-[9px] font-bold hover:bg-emerald-600/30 transition-colors disabled:opacity-40 min-h-[32px]"
          >
            {equipMutation.isPending ?
              <Loader2 className="w-3 h-3 animate-spin" /> :
              "Equip"
            }
          </button>
        )
      ) : (
        <button
          onClick={() => purchaseMutation.mutate({ cosmeticId: item.id })}
          disabled={purchaseMutation.isPending || !canAfford || !isAuthenticated}
          className={`
            px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-colors disabled:opacity-30 min-h-[32px]
            ${canAfford
              ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
              : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            }
          `}
        >
          {purchaseMutation.isPending ?
            <Loader2 className="w-3 h-3 animate-spin" /> :
            "Buy"
          }
        </button>
      )}
    </div>
  </div>
</motion.div>
```

---

## Key Implementation Notes

### 1. Dynamic cssClass Rendering
The `cssClass` field from the database contains full Tailwind classes that must be applied directly:

```tsx
<span className={`text-lg font-bold ${item.cssClass}`}>
  {myName}
</span>
```

This works for:
- Simple colors: `text-red-500`
- Gradients: `bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent`
- Animations: `text-red-400 animate-[rainbow_3s_linear_infinite]`
- Drop shadows: `text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]`
- Complex combos: `bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 bg-[length:200%_100%] bg-clip-text text-transparent animate-[shimmer_2s_linear_infinite]`

### 2. Text Size for Effect Visibility
- **Mobile**: `text-lg` (18px) minimum
- **Desktop**: `text-xl` (20px) recommended
- Smaller text makes gradients/glows harder to see
- This is especially critical for `bg-clip-text` gradients

### 3. Background Contrast
- Preview area MUST use `bg-zinc-950` or `bg-black`
- Dark backgrounds make glows and colors pop
- Avoid lighter backgrounds for name effects

### 4. Mobile Touch Targets
- Buttons need `min-h-[32px]` for tap-ability
- Small gaps (gap-2) keep grid compact on mobile
- 2-column layout prevents cramming

### 5. Limited Stock Indicator
```tsx
{item.isLimited && item.stock >= 0 && (
  <span className="text-[8px] text-red-400 font-bold absolute top-1 right-1">
    {item.stock} left
  </span>
)}
```

Position in top-right corner of card with absolute positioning.

---

## Cosmetic Types Reference

### Titles (25 items)
- **Common (8)**: $5-12, gray badges
- **Rare (8)**: $28-50, blue badges
- **Epic (7)**: $85-150, purple gradient badges
- **Legendary (5)**: $275-500, gold gradient badges (2 are limited stock)

Examples:
- "Lucky Charm" (common): `bg-zinc-800 text-zinc-400 border border-zinc-700`
- "High Roller" (rare): `bg-blue-950/50 text-blue-400 border border-blue-500/30`
- "Built Different" (epic): `bg-gradient-to-r from-purple-900/70 to-violet-900/70 text-purple-300 border border-purple-500/40`
- "Casino Overlord" (legendary): `bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-yellow-100 border border-yellow-400/60`

### Name Effects (17 items)
- **Common (5)**: $10-18, solid colors
- **Rare (6)**: $35-60, gradients + glows
- **Epic (4)**: $120-200, animated gradients
- **Legendary (3)**: $350-500, premium animations + glows

Examples:
- "Cherry Red" (common): `text-red-500`
- "Sunset" (rare): `bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent`
- "Gold Rush" (rare): `text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]`
- "Rainbow Cycle" (epic): `text-red-400 animate-[rainbow_3s_linear_infinite]`
- "Shimmer" (epic): `bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 bg-[length:200%_100%] bg-clip-text text-transparent animate-[shimmer_2s_linear_infinite]`
- "Diamond Sparkle" (legendary): `bg-gradient-to-br from-blue-100 via-white to-blue-100 bg-clip-text text-transparent animate-[sparkle_3s_linear_infinite] drop-shadow-[0_0_30px_rgba(255,255,255,1)]`

---

## Visual Hierarchy

1. **Preview** is the main attraction (60% height, large text)
2. **Tier border** signals rarity at a glance
3. **Price** is bold and prominent in info bar
4. **Buy/Equip button** has clear states (affordable, owned, equipped)
5. **Item name** is secondary (small text, top of info bar)

This prioritizes the VISUAL effect over text descriptions, which is appropriate for cosmetics.

---

## Comparison with Current Design

| Current (List) | New (Grid) |
|----------------|------------|
| Vertical cards, one per row | 2-3 columns, compact grid |
| Preview text is small (text-sm) | Preview text is large (text-lg/xl) |
| All info on one horizontal line | Separated preview + info sections |
| Tier shown in left metadata area | Tier shown as card border + badge |
| Gradients hard to see | Gradients prominent and visible |
| No visual hierarchy | Clear preview → info hierarchy |

---

## Animation Performance

- Use `motion.div` for staggered entrance (delay: index * 0.03)
- Keep animations CSS-based (defined in index.css)
- Avoid JS-based animations for name effects
- Live previews should animate automatically (no hover required)

---

## Accessibility

- Buttons have min 32px tap targets
- Color not the only indicator (tier badges have text)
- Price always visible in monospace font
- Disabled states have 30% opacity
- Hover states for interactive elements
