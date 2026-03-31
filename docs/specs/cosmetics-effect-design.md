# Name Effects System - $DORI Casino Cosmetics

Complete visual design system for player name cosmetics on the leaderboard.

---

## 1. Effect Categories & Pricing

### Color Effects (Common: $10-20)
Single-color text replacements. Clean, simple, effective.

```tsx
const COLOR_EFFECTS = {
  // Reds
  "crimson": {
    name: "Crimson",
    price: 10,
    className: "text-red-400",
  },
  "blood": {
    name: "Blood",
    price: 15,
    className: "text-red-600",
  },

  // Blues
  "royal_blue": {
    name: "Royal Blue",
    price: 10,
    className: "text-blue-400",
  },
  "ice": {
    name: "Ice",
    price: 15,
    className: "text-cyan-300",
  },

  // Greens
  "toxic": {
    name: "Toxic Green",
    price: 12,
    className: "text-emerald-400",
  },
  "slime": {
    name: "Slime",
    price: 15,
    className: "text-lime-400",
  },

  // Purples
  "amethyst": {
    name: "Amethyst",
    price: 12,
    className: "text-purple-400",
  },
  "void": {
    name: "Void",
    price: 18,
    className: "text-violet-600",
  },

  // Gold/Yellow
  "gold": {
    name: "Gold",
    price: 20,
    className: "text-yellow-400",
  },
  "amber": {
    name: "Amber",
    price: 15,
    className: "text-amber-500",
  },
};
```

---

### Gradient Effects (Rare: $30-60)
Multi-color gradients using background-clip technique.

```tsx
const GRADIENT_EFFECTS = {
  "sunset": {
    name: "Sunset",
    price: 35,
    className: "bg-gradient-to-r from-orange-400 via-red-400 to-pink-500 bg-clip-text text-transparent",
  },
  "ocean": {
    name: "Ocean Depth",
    price: 40,
    className: "bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent",
  },
  "forest": {
    name: "Forest",
    price: 35,
    className: "bg-gradient-to-r from-emerald-400 via-green-500 to-teal-600 bg-clip-text text-transparent",
  },
  "lavender": {
    name: "Lavender Dream",
    price: 45,
    className: "bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent",
  },
  "fire": {
    name: "Inferno",
    price: 50,
    className: "bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 bg-clip-text text-transparent",
  },
  "midnight": {
    name: "Midnight",
    price: 60,
    className: "bg-gradient-to-r from-slate-400 via-purple-600 to-blue-900 bg-clip-text text-transparent",
  },
};
```

---

### Glow Effects (Epic: $100-200)
Text with subtle shadow glow. Requires both className and inline style.

```tsx
const GLOW_EFFECTS = {
  "neon_green": {
    name: "Neon Green",
    price: 120,
    className: "text-emerald-400 font-semibold",
    style: {
      textShadow: "0 0 10px rgba(52, 211, 153, 0.7), 0 0 20px rgba(52, 211, 153, 0.4)"
    },
  },
  "electric_blue": {
    name: "Electric Blue",
    price: 150,
    className: "text-blue-400 font-semibold",
    style: {
      textShadow: "0 0 10px rgba(96, 165, 250, 0.8), 0 0 20px rgba(96, 165, 250, 0.5)"
    },
  },
  "plasma_pink": {
    name: "Plasma Pink",
    price: 180,
    className: "text-pink-400 font-semibold",
    style: {
      textShadow: "0 0 12px rgba(244, 114, 182, 0.8), 0 0 24px rgba(244, 114, 182, 0.5)"
    },
  },
  "radioactive": {
    name: "Radioactive",
    price: 200,
    className: "text-lime-300 font-semibold",
    style: {
      textShadow: "0 0 14px rgba(190, 242, 100, 0.9), 0 0 28px rgba(190, 242, 100, 0.6), 0 0 40px rgba(190, 242, 100, 0.3)"
    },
  },
  "arcane": {
    name: "Arcane",
    price: 175,
    className: "text-violet-400 font-semibold",
    style: {
      textShadow: "0 0 10px rgba(167, 139, 250, 0.8), 0 0 20px rgba(167, 139, 250, 0.5)"
    },
  },
};
```

---

### Animation Effects (Legendary: $300-500)
Complex CSS animations. GPU-accelerated, respects prefers-reduced-motion.

#### Rainbow Cycle
```tsx
const RAINBOW_EFFECT = {
  name: "Rainbow",
  price: 350,
  className: "font-bold",
  animationClass: "animate-rainbow",
};

// Add to global CSS or Tailwind config
const rainbowKeyframes = `
@keyframes rainbow {
  0%, 100% { color: #f87171; } /* red-400 */
  16% { color: #fb923c; } /* orange-400 */
  33% { color: #fbbf24; } /* amber-400 */
  50% { color: #34d399; } /* emerald-400 */
  66% { color: #60a5fa; } /* blue-400 */
  83% { color: #a78bfa; } /* violet-400 */
}

.animate-rainbow {
  animation: rainbow 4s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-rainbow {
    animation: none;
    color: #a78bfa; /* violet-400 fallback */
  }
}
`;
```

#### Shimmer Pulse
```tsx
const SHIMMER_EFFECT = {
  name: "Shimmer",
  price: 300,
  className: "text-yellow-300 font-bold",
  animationClass: "animate-shimmer",
};

const shimmerKeyframes = `
@keyframes shimmer {
  0%, 100% {
    filter: brightness(1);
    opacity: 1;
  }
  50% {
    filter: brightness(1.4);
    opacity: 0.95;
  }
}

.animate-shimmer {
  animation: shimmer 2.5s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-shimmer {
    animation: none;
    filter: brightness(1.15);
  }
}
`;
```

#### Holographic
```tsx
const HOLOGRAPHIC_EFFECT = {
  name: "Holographic",
  price: 500,
  className: "font-bold bg-gradient-to-r from-cyan-300 via-purple-400 to-pink-400 bg-clip-text text-transparent",
  animationClass: "animate-holographic",
};

const holographicKeyframes = `
@keyframes holographic {
  0%, 100% {
    filter: hue-rotate(0deg) brightness(1.1);
  }
  33% {
    filter: hue-rotate(120deg) brightness(1.2);
  }
  66% {
    filter: hue-rotate(240deg) brightness(1.15);
  }
}

.animate-holographic {
  animation: holographic 3s linear infinite;
  background-size: 200% auto;
}

@media (prefers-reduced-motion: reduce) {
  .animate-holographic {
    animation: none;
    filter: hue-rotate(0deg) brightness(1.1);
  }
}
`;
```

#### Glitch
```tsx
const GLITCH_EFFECT = {
  name: "Glitch",
  price: 400,
  className: "text-cyan-400 font-bold",
  animationClass: "animate-glitch",
};

const glitchKeyframes = `
@keyframes glitch {
  0%, 90%, 100% {
    transform: translate(0, 0);
    opacity: 1;
  }
  91% {
    transform: translate(-2px, 1px);
    opacity: 0.8;
  }
  92% {
    transform: translate(2px, -1px);
    opacity: 0.9;
  }
  93% {
    transform: translate(-1px, 2px);
    opacity: 0.85;
  }
  94% {
    transform: translate(0, 0);
    opacity: 1;
  }
}

.animate-glitch {
  animation: glitch 4s ease-in-out infinite;
  display: inline-block;
}

@media (prefers-reduced-motion: reduce) {
  .animate-glitch {
    animation: none;
    transform: none;
  }
}
`;
```

---

## 2. Unified Effect Registry

```tsx
// types/cosmetics.ts
export interface NameEffect {
  id: string;
  name: string;
  tier: "common" | "rare" | "epic" | "legendary";
  price: number;
  className: string;
  style?: React.CSSProperties;
  animationClass?: string;
}

// lib/name-effects.ts
export const NAME_EFFECTS: Record<string, NameEffect> = {
  // Common (Colors)
  crimson: {
    id: "crimson",
    name: "Crimson",
    tier: "common",
    price: 10,
    className: "text-red-400",
  },
  royal_blue: {
    id: "royal_blue",
    name: "Royal Blue",
    tier: "common",
    price: 10,
    className: "text-blue-400",
  },
  toxic: {
    id: "toxic",
    name: "Toxic Green",
    tier: "common",
    price: 12,
    className: "text-emerald-400",
  },
  amethyst: {
    id: "amethyst",
    name: "Amethyst",
    tier: "common",
    price: 12,
    className: "text-purple-400",
  },
  gold: {
    id: "gold",
    name: "Gold",
    tier: "common",
    price: 20,
    className: "text-yellow-400",
  },
  ice: {
    id: "ice",
    name: "Ice",
    tier: "common",
    price: 15,
    className: "text-cyan-300",
  },
  blood: {
    id: "blood",
    name: "Blood",
    tier: "common",
    price: 15,
    className: "text-red-600",
  },
  void: {
    id: "void",
    name: "Void",
    tier: "common",
    price: 18,
    className: "text-violet-600",
  },

  // Rare (Gradients)
  sunset: {
    id: "sunset",
    name: "Sunset",
    tier: "rare",
    price: 35,
    className: "bg-gradient-to-r from-orange-400 via-red-400 to-pink-500 bg-clip-text text-transparent",
  },
  ocean: {
    id: "ocean",
    name: "Ocean Depth",
    tier: "rare",
    price: 40,
    className: "bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent",
  },
  forest: {
    id: "forest",
    name: "Forest",
    tier: "rare",
    price: 35,
    className: "bg-gradient-to-r from-emerald-400 via-green-500 to-teal-600 bg-clip-text text-transparent",
  },
  fire: {
    id: "fire",
    name: "Inferno",
    tier: "rare",
    price: 50,
    className: "bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 bg-clip-text text-transparent",
  },
  lavender: {
    id: "lavender",
    name: "Lavender Dream",
    tier: "rare",
    price: 45,
    className: "bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent",
  },
  midnight: {
    id: "midnight",
    name: "Midnight",
    tier: "rare",
    price: 60,
    className: "bg-gradient-to-r from-slate-400 via-purple-600 to-blue-900 bg-clip-text text-transparent",
  },

  // Epic (Glows)
  neon_green: {
    id: "neon_green",
    name: "Neon Green",
    tier: "epic",
    price: 120,
    className: "text-emerald-400 font-semibold",
    style: {
      textShadow: "0 0 10px rgba(52, 211, 153, 0.7), 0 0 20px rgba(52, 211, 153, 0.4)"
    },
  },
  electric_blue: {
    id: "electric_blue",
    name: "Electric Blue",
    tier: "epic",
    price: 150,
    className: "text-blue-400 font-semibold",
    style: {
      textShadow: "0 0 10px rgba(96, 165, 250, 0.8), 0 0 20px rgba(96, 165, 250, 0.5)"
    },
  },
  plasma_pink: {
    id: "plasma_pink",
    name: "Plasma Pink",
    tier: "epic",
    price: 180,
    className: "text-pink-400 font-semibold",
    style: {
      textShadow: "0 0 12px rgba(244, 114, 182, 0.8), 0 0 24px rgba(244, 114, 182, 0.5)"
    },
  },
  radioactive: {
    id: "radioactive",
    name: "Radioactive",
    tier: "epic",
    price: 200,
    className: "text-lime-300 font-semibold",
    style: {
      textShadow: "0 0 14px rgba(190, 242, 100, 0.9), 0 0 28px rgba(190, 242, 100, 0.6), 0 0 40px rgba(190, 242, 100, 0.3)"
    },
  },
  arcane: {
    id: "arcane",
    name: "Arcane",
    tier: "epic",
    price: 175,
    className: "text-violet-400 font-semibold",
    style: {
      textShadow: "0 0 10px rgba(167, 139, 250, 0.8), 0 0 20px rgba(167, 139, 250, 0.5)"
    },
  },

  // Legendary (Animations)
  shimmer: {
    id: "shimmer",
    name: "Shimmer",
    tier: "legendary",
    price: 300,
    className: "text-yellow-300 font-bold",
    animationClass: "animate-shimmer",
  },
  rainbow: {
    id: "rainbow",
    name: "Rainbow",
    tier: "legendary",
    price: 350,
    className: "font-bold",
    animationClass: "animate-rainbow",
  },
  glitch: {
    id: "glitch",
    name: "Glitch",
    tier: "legendary",
    price: 400,
    className: "text-cyan-400 font-bold",
    animationClass: "animate-glitch",
  },
  holographic: {
    id: "holographic",
    name: "Holographic",
    tier: "legendary",
    price: 500,
    className: "font-bold bg-gradient-to-r from-cyan-300 via-purple-400 to-pink-400 bg-clip-text text-transparent",
    animationClass: "animate-holographic",
  },
};
```

---

## 3. PlayerName Component

```tsx
// components/PlayerName.tsx
import { NAME_EFFECTS } from "@/lib/name-effects";
import { cn } from "@/lib/utils";

interface PlayerNameProps {
  name: string;
  effectId?: string | null;
  className?: string;
}

export function PlayerName({ name, effectId, className }: PlayerNameProps) {
  // Default styling if no effect
  if (!effectId) {
    return <span className={cn("text-zinc-300 font-medium", className)}>{name}</span>;
  }

  const effect = NAME_EFFECTS[effectId];

  // Fallback to default if effect not found
  if (!effect) {
    return <span className={cn("text-zinc-300 font-medium", className)}>{name}</span>;
  }

  return (
    <span
      className={cn(
        effect.className,
        effect.animationClass,
        className
      )}
      style={effect.style}
    >
      {name}
    </span>
  );
}
```

**Usage Examples:**

```tsx
// Default (no effect)
<PlayerName name="xXDoriSlayer" />

// With color effect
<PlayerName name="xXDoriSlayer" effectId="crimson" />

// With gradient effect
<PlayerName name="CasinoKing" effectId="sunset" />

// With glow effect
<PlayerName name="NeonDreamer" effectId="neon_green" />

// With animation effect
<PlayerName name="RainbowMaster" effectId="rainbow" />
```

---

## 4. Global CSS Setup

Add to `app/globals.css`:

```css
/* Name Effect Animations */

@keyframes rainbow {
  0%, 100% { color: #f87171; }
  16% { color: #fb923c; }
  33% { color: #fbbf24; }
  50% { color: #34d399; }
  66% { color: #60a5fa; }
  83% { color: #a78bfa; }
}

.animate-rainbow {
  animation: rainbow 4s linear infinite;
}

@keyframes shimmer {
  0%, 100% {
    filter: brightness(1);
    opacity: 1;
  }
  50% {
    filter: brightness(1.4);
    opacity: 0.95;
  }
}

.animate-shimmer {
  animation: shimmer 2.5s ease-in-out infinite;
}

@keyframes holographic {
  0%, 100% {
    filter: hue-rotate(0deg) brightness(1.1);
  }
  33% {
    filter: hue-rotate(120deg) brightness(1.2);
  }
  66% {
    filter: hue-rotate(240deg) brightness(1.15);
  }
}

.animate-holographic {
  animation: holographic 3s linear infinite;
  background-size: 200% auto;
}

@keyframes glitch {
  0%, 90%, 100% {
    transform: translate(0, 0);
    opacity: 1;
  }
  91% {
    transform: translate(-2px, 1px);
    opacity: 0.8;
  }
  92% {
    transform: translate(2px, -1px);
    opacity: 0.9;
  }
  93% {
    transform: translate(-1px, 2px);
    opacity: 0.85;
  }
  94% {
    transform: translate(0, 0);
    opacity: 1;
  }
}

.animate-glitch {
  animation: glitch 4s ease-in-out infinite;
  display: inline-block;
}

/* Respect user motion preferences */
@media (prefers-reduced-motion: reduce) {
  .animate-rainbow {
    animation: none;
    color: #a78bfa;
  }

  .animate-shimmer {
    animation: none;
    filter: brightness(1.15);
  }

  .animate-holographic {
    animation: none;
    filter: hue-rotate(0deg) brightness(1.1);
  }

  .animate-glitch {
    animation: none;
    transform: none;
  }
}
```

---

## 5. Database Schema

```ts
// In user_cosmetics table
interface UserCosmeticInventory {
  userId: string;
  nameEffects: string[]; // Array of owned effect IDs
  equippedNameEffect: string | null; // Currently active effect ID
  // ... other cosmetic types
}
```

---

## 6. Shop Display Component

```tsx
// components/NameEffectShop.tsx
import { NAME_EFFECTS } from "@/lib/name-effects";
import { PlayerName } from "@/components/PlayerName";

const tierColors = {
  common: "border-zinc-600 bg-zinc-800",
  rare: "border-blue-500 bg-blue-950/30",
  epic: "border-purple-500 bg-purple-950/30",
  legendary: "border-yellow-500 bg-yellow-950/30",
};

export function NameEffectShop({ userName }: { userName: string }) {
  const effectsByTier = Object.values(NAME_EFFECTS).reduce((acc, effect) => {
    if (!acc[effect.tier]) acc[effect.tier] = [];
    acc[effect.tier].push(effect);
    return acc;
  }, {} as Record<string, typeof NAME_EFFECTS[string][]>);

  return (
    <div className="space-y-8">
      {(["common", "rare", "epic", "legendary"] as const).map((tier) => (
        <div key={tier}>
          <h3 className="text-xl font-bold text-zinc-100 mb-4 capitalize">
            {tier} Effects
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {effectsByTier[tier]?.map((effect) => (
              <div
                key={effect.id}
                className={`p-4 border rounded-lg ${tierColors[tier]}`}
              >
                <div className="text-sm text-zinc-400 mb-2">{effect.name}</div>
                <div className="mb-3">
                  <PlayerName name={userName} effectId={effect.id} />
                </div>
                <div className="text-lg font-bold text-green-400">
                  ${effect.price}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 7. Performance Notes

### GPU Acceleration
All animations use GPU-accelerated properties only:
- `transform` (translate, rotate, scale)
- `opacity`
- `filter` (for hue-rotate, brightness)

Avoid animating:
- `color` directly (except Rainbow, which is acceptable for premium effect)
- `width`, `height`, `margin`, `padding`
- `background-position` (acceptable for Holographic given it's $500)

### Reduced Motion
Every animation respects `prefers-reduced-motion: reduce` with sensible fallbacks:
- Rainbow → static violet
- Shimmer → 15% brightness boost
- Holographic → static gradient with slight brightness
- Glitch → no transform

### Text Rendering
- Gradient effects require `bg-clip-text text-transparent`
- Glow effects use multiple `text-shadow` layers
- Animations on glitch use `display: inline-block` to enable transforms

### Dark Background Compatibility
All effects designed for dark theme (zinc-900/950 background):
- Colors use 400-600 shade range
- Glows use semi-transparent shadows
- Gradients have sufficient contrast

---

## 8. Recommended Implementation Order

1. **Phase 1: Colors & Gradients**
   - Implement `PlayerName` component
   - Add 8 color effects
   - Add 6 gradient effects
   - Test on leaderboard

2. **Phase 2: Glows**
   - Add global CSS for text-shadow
   - Implement 5 glow effects
   - Test performance on low-end devices

3. **Phase 3: Animations**
   - Add keyframes to globals.css
   - Implement 4 animated effects
   - Add reduced-motion support
   - Performance audit

4. **Phase 4: Shop & Inventory**
   - Build shop UI
   - Add purchase flow
   - Implement equip/unequip
   - Add preview mode

---

## 9. Pricing Strategy Summary

| Tier | Price Range | Effect Count | Total Revenue Potential |
|------|-------------|--------------|------------------------|
| Common (Colors) | $10-20 | 8 | $116 |
| Rare (Gradients) | $35-60 | 6 | $265 |
| Epic (Glows) | $120-200 | 5 | $825 |
| Legendary (Animations) | $300-500 | 4 | $1,550 |

**Total possible spend:** $2,756 for a completionist

**Expected ARPU (10% conversion):** $20-50 (color + gradient buyers)

**Whale spend:** $500-1,000 (epic + 1-2 legendary)

---

## 10. Future Expansion Ideas

- **Seasonal Effects**: Halloween glow, Christmas shimmer, etc.
- **Combo Effects**: Name effect + border glow
- **Custom Gradients**: User picks 2-3 colors
- **Text Styles**: Bold, italic, strikethrough overlays
- **Particle Effects**: Sparkles, embers, snowflakes around name
- **3D Transform**: Perspective skew on hover (desktop only)
