# Casino Shop UX Audit & Recommendations

**Date:** 2026-03-26
**File:** `/home/ayoun/lol-tracker/client/src/pages/CasinoShop.tsx`
**Status:** NEEDS REDESIGN

---

## Executive Summary

The current shop uses a **vertical list layout** that doesn't showcase the visual effects players are buying. Name effects with gradients, glows, and animations are rendered at small sizes (text-sm) and don't stand out. The shop needs to transition to a **responsive grid** with **large, prominent effect previews** so players can see exactly what they're purchasing.

---

## Problem 1: Vertical List → Grid Layout

### Current State
- Items displayed in `space-y-2` vertical stack (lines 158-234)
- Each item is a full-width card with horizontal layout (preview left, price/button right)
- Maximum width constrained to `max-w-lg` (lines 85)

### Target State
**Responsive Grid:**
- **Mobile (default):** 2 columns
- **Small+ (640px):** 3 columns
- **Large+ (1024px):** 4 columns

### Implementation Plan

**Step 1:** Change container max-width
```tsx
// Line 85: Remove max-w-lg constraint
<div className="container py-6 sm:py-8 max-w-6xl mx-auto px-4">
```

**Step 2:** Replace vertical stack with grid
```tsx
// Line 158: Replace `space-y-2` with grid
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
```

**Step 3:** Restructure card layout from horizontal → vertical
- Move tier badge to **top-right corner** (absolute positioned)
- **Large effect preview** at top (60-70% of card height)
- Item name below preview (text-xs, centered)
- Price + button at bottom (compact, stacked vertically)

---

## Problem 2: Effect Previews Not Visible

### Current Issues

**Name Effects (line 34-40):**
```tsx
function NamePreview({ name, cssClass }: { name: string; cssClass: string | null }) {
  return (
    <span className={`text-sm font-bold ${cssClass || "text-zinc-300"}`}>
      {name}
    </span>
  );
}
```

**Problems:**
1. **Too small:** `text-sm` (14px) doesn't show off gradients/glows/animations
2. **Wrong text:** Shows item name ("Sunset", "Rainbow Cycle") instead of player's name
3. **No contrast:** Dark gradients (purple, cosmic) blend into dark background
4. **Truncated effects:** `bg-clip-text text-transparent` gradients need sufficient width

### Effect Types in Catalog

From `/home/ayoun/lol-tracker/server/seedCosmetics.ts`:

**Common (solid colors):**
- `text-red-500`, `text-blue-400`, `text-green-600` — these work fine

**Rare (gradients):**
- `bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent` (Sunset)
- `bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent` (Ocean Wave)
- `text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]` (Gold Rush — has glow!)

**Epic (gradients + animations):**
- `text-red-400 animate-[rainbow_3s_linear_infinite]` (Rainbow Cycle)
- `bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 bg-[length:200%_100%] bg-clip-text text-transparent animate-[shimmer_2s_linear_infinite]` (Shimmer)
- `text-blue-300 animate-[lightning_0.5s_ease-in-out_infinite] drop-shadow-[0_0_25px_rgba(147,197,253,1)]` (Electric Storm — animated glow!)

**Legendary (complex animations + glows):**
- `bg-gradient-to-br from-blue-100 via-white to-blue-100 bg-clip-text text-transparent animate-[sparkle_3s_linear_infinite] drop-shadow-[0_0_30px_rgba(255,255,255,1)]` (Diamond Sparkle)
- `bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 bg-[length:200%_100%] bg-clip-text text-transparent animate-[flow_2s_linear_infinite] drop-shadow-[0_0_35px_rgba(234,179,8,1)]` (Molten Gold)

**Animations exist in `/home/ayoun/lol-tracker/client/src/index.css`:**
- Lines 232-256 define @keyframes for rainbow, shimmer, lightning, sparkle, flow, cosmic

### Recommended Fix

**Create dedicated large preview component:**

```tsx
function EffectPreview({ cssClass, sampleText = "PREVIEW" }: { cssClass: string | null; sampleText?: string }) {
  return (
    <div className="relative h-28 flex items-center justify-center bg-black/40 rounded-lg border border-zinc-800/60 overflow-hidden">
      {/* Dark vignette for contrast */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/50" />

      {/* Large effect text */}
      <span className={`text-2xl sm:text-3xl font-black tracking-tight ${cssClass || "text-zinc-300"}`}>
        {sampleText}
      </span>
    </div>
  );
}
```

**Why this works:**
- **text-2xl/3xl** (24-30px) makes gradients/glows visible
- **Black background** provides contrast for light gradients (Diamond Sparkle, Molten Gold)
- **Full width** allows gradient background-position animations to flow
- **h-28** (112px) gives vertical space for drop-shadow glows to be visible
- **Sample text "PREVIEW"** is short, centered, bold — effect is immediately obvious

**For name effects in grid cards:**
```tsx
{item.type === "name_effect" ? (
  <EffectPreview cssClass={item.cssClass} sampleText="VICTORY" />
) : (
  <div className="h-28 flex items-center justify-center bg-zinc-900/40 rounded-lg border border-zinc-800/60">
    <TitleBadge name={item.name} cssClass={item.cssClass} />
  </div>
)}
```

---

## Problem 3: Card Design Spec

### Recommended Card Structure

```tsx
<motion.div className="relative border rounded-xl overflow-hidden bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700 transition-all">
  {/* Tier badge - top-right corner */}
  <div className="absolute top-2 right-2 z-10">
    <TierBadge tier={item.tier} />
  </div>

  {/* Main preview area - 60% of card */}
  <div className="p-3">
    {item.type === "name_effect" ? (
      <EffectPreview cssClass={item.cssClass} sampleText="VICTORY" />
    ) : (
      <div className="h-28 flex flex-col gap-1.5 items-center justify-center bg-zinc-900/40 rounded-lg border border-zinc-800/60">
        <span className="text-[10px] text-zinc-500">Sample Name</span>
        <TitleBadge name={item.name} cssClass={item.cssClass} />
      </div>
    )}
  </div>

  {/* Item info - compact */}
  <div className="px-3 pb-2">
    <p className="text-xs font-bold text-white text-center truncate">{item.name}</p>
    {item.description && (
      <p className="text-[9px] text-zinc-600 text-center truncate">{item.description}</p>
    )}
  </div>

  {/* Price + action - bottom */}
  <div className="px-3 pb-3 flex flex-col gap-1.5">
    <div className="text-center">
      <span className="text-sm font-mono font-bold text-white">${item.price.toFixed(0)}</span>
      {item.isLimited && item.stock >= 0 && (
        <span className="ml-1.5 text-[8px] text-red-400 font-bold">({item.stock} left)</span>
      )}
    </div>

    {/* Buy/Equip button - full width */}
    {isOwned ? (
      isEquipped ? (
        <div className="flex items-center justify-center gap-0.5 text-[9px] text-emerald-400 font-bold py-1.5">
          <Check className="w-3 h-3" /> Equipped
        </div>
      ) : (
        <button
          onClick={() => equipMutation.mutate({ type: item.type as "title" | "name_effect", cosmeticId: item.id })}
          disabled={equipMutation.isPending}
          className="w-full px-2.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 text-[9px] font-bold hover:bg-emerald-600/30 transition-colors disabled:opacity-40"
        >
          {equipMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Equip"}
        </button>
      )
    ) : (
      <button
        onClick={() => purchaseMutation.mutate({ cosmeticId: item.id })}
        disabled={purchaseMutation.isPending || !canAfford || !isAuthenticated}
        className={`w-full px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-colors disabled:opacity-30 ${
          canAfford
            ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
            : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
        }`}
      >
        {purchaseMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Buy"}
      </button>
    )}
  </div>
</motion.div>
```

### Visual Hierarchy
1. **Effect preview** (largest, most eye-catching)
2. **Tier badge** (corner, visible but not intrusive)
3. **Item name** (small, centered below preview)
4. **Price** (prominent, above button)
5. **Action button** (full-width, clear CTA)

---

## Problem 4: Sort/Filter Improvements

### Current State
- 3 tabs: All / Titles / Effects (lines 142-155)
- Sorted by tier desc, then price desc (line 81)

### Recommended Additions

**Add sort dropdown:**
```tsx
const [sortBy, setSortBy] = useState<"tier" | "price-asc" | "price-desc">("tier");

// In UI, after tabs:
<select
  value={sortBy}
  onChange={(e) => setSortBy(e.target.value as any)}
  className="ml-auto px-2 py-1 rounded-lg bg-zinc-800/50 border border-zinc-700/30 text-[10px] text-zinc-400"
>
  <option value="tier">Sort by Tier</option>
  <option value="price-asc">Price: Low to High</option>
  <option value="price-desc">Price: High to Low</option>
</select>

// Update sort logic (line 81):
const filtered = (catalog ?? [])
  .filter(c => tab === "all" || c.type === tab)
  .sort((a, b) => {
    if (sortBy === "tier") return (TIER_ORDER[b.tier] ?? 0) - (TIER_ORDER[a.tier] ?? 0) || b.price - a.price;
    if (sortBy === "price-asc") return a.price - b.price;
    return b.price - a.price;
  });
```

**Optional: Add "Affordable" filter**
```tsx
const [onlyAffordable, setOnlyAffordable] = useState(false);

// Filter logic:
.filter(c => tab === "all" || c.type === tab)
.filter(c => !onlyAffordable || cash >= c.price)
```

---

## Implementation Checklist

### Phase 1: Grid Layout
- [ ] Change container to `max-w-6xl`
- [ ] Replace `space-y-2` with `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4`
- [ ] Restructure card from horizontal → vertical layout
- [ ] Move tier badge to absolute top-right

### Phase 2: Effect Previews
- [ ] Create `EffectPreview` component with large text (text-2xl/3xl)
- [ ] Add dark background container for contrast (`bg-black/40`)
- [ ] Use sample text "VICTORY" or player name instead of item name
- [ ] For titles: show badge on sample name text
- [ ] Test all effect types (gradients, glows, animations)

### Phase 3: Card Polish
- [ ] Implement vertical card structure (preview → name → price → button)
- [ ] Make buttons full-width
- [ ] Add hover state to cards (`hover:border-zinc-700`)
- [ ] Ensure limited stock badge is visible in new layout
- [ ] Test equipped state in grid cards

### Phase 4: Sort/Filter
- [ ] Add sort dropdown (tier / price-asc / price-desc)
- [ ] Position dropdown next to tabs (flex justify-between)
- [ ] Optional: Add "Show Affordable Only" toggle

### Phase 5: Testing
- [ ] Test on mobile (2 cols should fit comfortably)
- [ ] Test on tablet (3 cols should have breathing room)
- [ ] Test on desktop (4 cols should look spacious)
- [ ] Verify all animations play correctly
- [ ] Verify gradients render properly
- [ ] Check drop-shadow glows are visible

---

## Additional Notes

### Current Equipped Preview (lines 106-138)
The "Your Profile" section works correctly and should remain unchanged. It shows the player's actual name with effects applied, which is the right approach for that context.

### Animation Keyframes
All required animations are defined in `/home/ayoun/lol-tracker/client/src/index.css` (lines 232-256). No additional CSS needed.

### Leaderboard Consistency
The leaderboard already renders effects correctly at text-sm size (see `/home/ayoun/lol-tracker/client/src/pages/Leaderboard.tsx` line 389). The shop needs larger previews because it's a buying decision — players need to see the effect clearly before purchasing.

### Color Contrast
Some legendary effects (Diamond Sparkle, Molten Gold) use very light colors (white, yellow-400) that will pop against the black preview background. Dark effects (Cosmic Void with purple-900) may need testing to ensure they're visible — the border + vignette should help.

---

## Success Metrics

**Before:** Vertical list, small text, effects not visible
**After:** Grid layout, large effect previews, clear visual hierarchy

Players should be able to:
1. Browse 8-12+ items at once (grid vs 4-5 in vertical list)
2. See gradients/glows/animations clearly
3. Instantly identify tier by badge position + card glow
4. Make purchase decisions faster (fewer clicks to see effects)

---

**End of Audit**
