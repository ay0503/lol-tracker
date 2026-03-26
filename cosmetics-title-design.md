# Title Badge Design System
**$DORI Casino Cosmetics: Title Badges**

## Overview
Title badges are small, elegant pills that display next to a player's name on leaderboards. They are tier-based cosmetic items that players can equip from the shop to show off their achievements or status.

---

## 1. Title Badge Component

### Visual Design
- **Shape**: Rounded pill/badge (`rounded` or `rounded-md`)
- **Size**: Compact and unobtrusive (text-[8px] to text-[10px])
- **Position**:
  - Desktop: To the right of the player name, inline
  - Mobile: Can be inline or below the name depending on space
- **Spacing**: Small gap from name (gap-1.5 to gap-2)

### Tier-Based Styling

#### **Common Tier**
Simple, subtle appearance. Gray/zinc with minimal flair.

```tsx
className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700"
```

**Visual**: `[Common Title]` - muted gray, barely noticeable glow

---

#### **Rare Tier**
Blue/cyan theme with a slight glow effect. More noticeable.

```tsx
className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-blue-950/50 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10"
```

**Visual**: `[Rare Title]` - cool blue tones, soft cyan glow

---

#### **Epic Tier**
Purple/violet gradient background with enhanced glow. Eye-catching.

```tsx
className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gradient-to-r from-purple-900/70 to-violet-900/70 text-purple-300 border border-purple-500/40 shadow-md shadow-purple-500/20"
```

**Visual**: `[Epic Title]` - rich purple gradient, noticeable shimmer

---

#### **Legendary Tier**
Gold/amber with shimmer animation. Maximum prestige.

```tsx
className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-yellow-100 border border-yellow-400/60 shadow-lg shadow-yellow-500/30 animate-pulse"
```

**Alternative with custom shimmer** (no animate-pulse):
```tsx
// Add to global CSS or component
@keyframes shimmer {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}

className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-yellow-100 border border-yellow-400/60 shadow-lg shadow-yellow-500/30"
style={{ animation: "shimmer 2s ease-in-out infinite" }}
```

**Visual**: `[Legendary]` - brilliant gold with pulsing glow

---

## 2. Integration Examples

### Trading Leaderboard (Desktop)
**Location**: `/home/ayoun/lol-tracker/client/src/pages/Leaderboard.tsx` (lines 243-266)

**Before**:
```tsx
<div className="flex items-center gap-3">
  {getRankIcon(rank)}
  <div>
    <p className="text-sm font-bold text-foreground">{trader.userName}</p>
    <div className="flex items-center gap-3 mt-0.5">
      {/* stats */}
    </div>
  </div>
</div>
```

**After** (with title):
```tsx
<div className="flex items-center gap-3">
  {getRankIcon(rank)}
  <div>
    <div className="flex items-center gap-1.5">
      <p className="text-sm font-bold text-foreground">{trader.userName}</p>
      {trader.equippedTitle && (
        <span className={getTitleBadgeClass(trader.equippedTitle.tier)}>
          {trader.equippedTitle.name}
        </span>
      )}
    </div>
    <div className="flex items-center gap-3 mt-0.5">
      {/* stats */}
    </div>
  </div>
</div>
```

**Visual Example**:
```
#1  👑  PlayerName [High Roller]     $265.20    +$45.20 (+20.5%)
#2  🥈  CryptoKing [Diamond Hands]   $220.15    +$20.15 (+10.1%)
#3  🥉  TraderJoe                    $180.00    -$20.00 (-10.0%)
```

---

### Trading Leaderboard (Mobile)
**Location**: Same file, lines 294-337

**Before**:
```tsx
<div className="flex items-center gap-2">
  {getRankIcon(rank)}
  <p className="text-sm font-bold text-foreground">{trader.userName}</p>
</div>
```

**After** (with title inline):
```tsx
<div className="flex items-center gap-2 flex-wrap">
  {getRankIcon(rank)}
  <p className="text-sm font-bold text-foreground">{trader.userName}</p>
  {trader.equippedTitle && (
    <span className={getTitleBadgeClass(trader.equippedTitle.tier)}>
      {trader.equippedTitle.name}
    </span>
  )}
</div>
```

**Alternative** (title below name on very narrow screens):
```tsx
<div>
  <div className="flex items-center gap-2">
    {getRankIcon(rank)}
    <p className="text-sm font-bold text-foreground">{trader.userName}</p>
  </div>
  {trader.equippedTitle && (
    <span className={`ml-6 ${getTitleBadgeClass(trader.equippedTitle.tier)}`}>
      {trader.equippedTitle.name}
    </span>
  )}
</div>
```

---

### Casino Leaderboard
**Location**: `/home/ayoun/lol-tracker/client/src/pages/Casino.tsx` (lines 236-238)

**Before**:
```tsx
<div className="flex items-center gap-2.5 min-w-0">
  <RankIcon rank={i + 1} />
  <span className="text-xs text-zinc-300 font-medium truncate">{player.userName}</span>
</div>
```

**After**:
```tsx
<div className="flex items-center gap-2.5 min-w-0">
  <RankIcon rank={i + 1} />
  <div className="flex items-center gap-1.5 min-w-0">
    <span className="text-xs text-zinc-300 font-medium truncate">{player.userName}</span>
    {player.equippedTitle && (
      <span className={getTitleBadgeClass(player.equippedTitle.tier)}>
        {player.equippedTitle.name}
      </span>
    )}
  </div>
</div>
```

**Visual Example** (Casino compact leaderboard):
```
👑  PlayerName [High Roller]     +$5.20      $25.20
🥈  LuckyGambler                  +$2.10      $22.10
🥉  BetMaster [Whale]             -$1.50      $18.50
```

---

## 3. Helper Function

```tsx
function getTitleBadgeClass(tier: "common" | "rare" | "epic" | "legendary"): string {
  const baseClasses = "px-1.5 py-0.5 rounded text-[8px] font-medium";

  switch (tier) {
    case "common":
      return `${baseClasses} bg-zinc-800 text-zinc-400 border border-zinc-700`;

    case "rare":
      return `${baseClasses} bg-blue-950/50 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10`;

    case "epic":
      return `${baseClasses} font-bold bg-gradient-to-r from-purple-900/70 to-violet-900/70 text-purple-300 border border-purple-500/40 shadow-md shadow-purple-500/20`;

    case "legendary":
      return `${baseClasses} font-bold bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-yellow-100 border border-yellow-400/60 shadow-lg shadow-yellow-500/30 animate-pulse`;

    default:
      return baseClasses;
  }
}
```

---

## 4. Shop Preview UI

When viewing a title in the shop, show a live preview of how it looks on your own name.

### Shop Card Design

```tsx
<div className="bg-card border border-border rounded-xl p-4">
  {/* Title info */}
  <div className="mb-4">
    <h3 className="text-sm font-bold text-foreground mb-1">{title.name}</h3>
    <p className="text-[10px] text-muted-foreground">{title.description}</p>
  </div>

  {/* Preview */}
  <div className="bg-secondary/30 border border-border/50 rounded-lg p-3 mb-4">
    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-2">
      Preview
    </p>
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-foreground font-medium">{currentUser.name}</span>
      <span className={getTitleBadgeClass(title.tier)}>
        {title.name}
      </span>
    </div>
  </div>

  {/* Price & Buy button */}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-1.5">
      <span className="text-lg font-bold text-foreground font-mono">${title.price}</span>
      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${getTierBadgeClass(title.tier)}`}>
        {title.tier}
      </span>
    </div>
    <button className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold">
      Equip
    </button>
  </div>
</div>
```

### Tier Badge for Shop Cards

```tsx
function getTierBadgeClass(tier: "common" | "rare" | "epic" | "legendary"): string {
  switch (tier) {
    case "common":
      return "bg-zinc-700 text-zinc-300";
    case "rare":
      return "bg-blue-600 text-blue-100";
    case "epic":
      return "bg-purple-600 text-purple-100";
    case "legendary":
      return "bg-gradient-to-r from-amber-500 to-yellow-500 text-black";
    default:
      return "bg-zinc-700 text-zinc-300";
  }
}
```

---

## 5. Example Title Names by Tier

### Common
- Trader
- Beginner
- Player
- Gambler

### Rare
- High Roller
- Risk Taker
- Day Trader
- Lucky

### Epic
- Diamond Hands
- Whale
- Degen
- Market Maker

### Legendary
- The Oracle
- Golden Touch
- Crypto King
- Unstoppable

---

## 6. Accessibility Considerations

- **Text contrast**: All tier colors meet WCAG AA standards against their backgrounds
- **No essential info**: Titles are purely cosmetic; no gameplay information is hidden in them
- **Truncation**: On very narrow screens, player names should truncate before titles disappear
- **Hover states**: (Optional) Show title description on hover for context

---

## 7. Animation Notes

### Legendary Shimmer (Custom)
For a more subtle shimmer than `animate-pulse`:

```css
@keyframes title-shimmer {
  0%, 100% {
    box-shadow: 0 10px 15px -3px rgba(251, 191, 36, 0.3),
                0 4px 6px -4px rgba(251, 191, 36, 0.3);
  }
  50% {
    box-shadow: 0 10px 15px -3px rgba(251, 191, 36, 0.5),
                0 4px 6px -4px rgba(251, 191, 36, 0.5);
  }
}

.legendary-title {
  animation: title-shimmer 2s ease-in-out infinite;
}
```

### Epic Subtle Glow (Optional)
```css
@keyframes epic-glow {
  0%, 100% { opacity: 0.9; }
  50% { opacity: 1; }
}

.epic-title {
  animation: epic-glow 3s ease-in-out infinite;
}
```

---

## 8. Database Schema Reference

Expected data structure from backend:

```typescript
interface EquippedTitle {
  id: number;
  name: string;
  tier: "common" | "rare" | "epic" | "legendary";
  description?: string; // For shop/hover tooltip
}

interface LeaderboardPlayer {
  userId: number;
  userName: string;
  equippedTitle?: EquippedTitle | null;
  // ... other stats
}
```

---

## Implementation Checklist

- [ ] Add `getTitleBadgeClass()` helper to shared utils
- [ ] Update Trading Leaderboard desktop layout (Leaderboard.tsx line ~247)
- [ ] Update Trading Leaderboard mobile layout (Leaderboard.tsx line ~297)
- [ ] Update Casino Leaderboard (Casino.tsx line ~238)
- [ ] Add shop preview component
- [ ] Add tier badge helper for shop cards
- [ ] Test text truncation on narrow screens
- [ ] Verify color contrast for accessibility
- [ ] Optional: Add custom shimmer animation for Legendary
- [ ] Optional: Add hover tooltips with title descriptions
