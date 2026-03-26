# Animated Cosmetic Effects Technical Specification

**Project**: $DORI Casino
**Date**: 2026-03-26
**Author**: Engineering Investigation
**Purpose**: Evaluate and implement CSS-based animated name effects and title badges using Tailwind CSS v4

---

## 1. Current Architecture

### How Effects Currently Render

The system uses a **static registry pattern** in `StyledName.tsx` that maps cosmetic IDs to inline React styles:

```typescript
const EFFECT_STYLES: Record<string, { className?: string; style?: CSSProperties }> = {
  "sunset": {
    style: {
      background: "linear-gradient(to right, #f97316, #ec4899)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 8px rgba(251,146,60,0.5))",
      display: "inline-block",
    },
  },
  "rainbow": {
    className: "text-red-400",
    style: { animation: "rainbow 3s linear infinite" },
  },
  // ... etc
};
```

**Flow**:
1. Database stores cosmetic items with `cssClass` field (e.g., `"inline-block bg-gradient-to-r from-orange-500 to-pink-500"`)
2. `getEffectKey()` matches the DB string to a registry key via keyword search
3. Registry returns either a Tailwind `className` or inline `style` object
4. Component renders: `<span className={effect?.className} style={effect?.style}>{name}</span>`

### What Works

- **Simple color classes**: `text-red-500`, `text-blue-400` work fine as Tailwind classes (JIT compiles them)
- **Static gradients**: Gradient text effects work via inline styles with `background-clip: text`
- **Drop shadows**: `filter: drop-shadow()` works for glow effects
- **Animations**: CSS animations defined in `index.css` apply correctly when referenced in inline styles

### What Doesn't Work

**Dynamic Tailwind classes from the database get purged by JIT.**

Example: The DB stores:
```
"inline-block bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent"
```

This string is never seen by Tailwind's JIT compiler during build time (it's only in the DB at runtime), so these classes get purged from the final CSS bundle. The registry solves this by converting these patterns to inline styles.

### Why Dynamic Classes Don't Work

Tailwind CSS v4's JIT compiler:
1. Scans source files at build time for class usage
2. Generates only the CSS for classes it finds
3. **Cannot** see classes stored in databases or returned from APIs
4. Even with safelist, maintaining a list of every possible gradient/color combo is impractical

**Solution**: Use inline styles in the EFFECT_STYLES registry for complex effects (gradients, animations, filters). Use Tailwind classes only for simple, static patterns.

---

## 2. What's Possible with Tailwind CSS v4

All techniques below use **pure CSS** — no JavaScript animation loops. Animations are defined in `@keyframes` in `/home/ayoun/lol-tracker/client/src/index.css` and applied via inline styles in the registry.

### A. Animated Name Effects

#### 1. Gradient Text that Shifts/Flows (Shimmer, Molten Gold)

**Technique**: Use `background-clip: text` with a large gradient (`background-size: 200%+`) and animate `background-position`.

**CSS Implementation**:
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

**Registry Entry**:
```typescript
"shimmer": {
  style: {
    background: "linear-gradient(to right, #facc15, #eab308, #facc15)",
    backgroundSize: "200% 100%",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    animation: "shimmer 2s linear infinite",
    display: "inline-block",
  },
}
```

**Works?** Yes. Currently implemented for "Shimmer" and "Molten Gold" effects.

**Performance**: Excellent. GPU-accelerated via `background-position` animation.

**Best Practices**:
- Use `display: inline-block` to establish a stacking context
- Set `background-size: 200%` or larger for smooth flow
- Use `linear` timing for continuous loops, `ease-in-out` for breathing effects

---

#### 2. Rainbow Hue-Rotate

**Technique**: Animate `filter: hue-rotate()` from 0deg to 360deg to cycle through the color spectrum.

**CSS Implementation**:
```css
@keyframes rainbow {
  0%, 100% { filter: hue-rotate(0deg); }
  50% { filter: hue-rotate(360deg); }
}
```

**Registry Entry**:
```typescript
"rainbow": {
  className: "text-red-400", // Base color to rotate
  style: { animation: "rainbow 3s linear infinite" },
}
```

**Works?** Yes. Currently implemented.

**Performance**: Good on desktop, acceptable on mobile. `filter` can be GPU-accelerated but is slightly heavier than `transform`.

**Caveats**:
- Requires a base color (you're rotating its hue, not creating color from nothing)
- Can look washed out on very light or very dark base colors
- Better with saturated base colors like `text-red-400`, `text-blue-500`

---

#### 3. Glow/Pulse Effects

**Technique**: Animate `filter: drop-shadow()` or `text-shadow` with pulsing opacity/size.

**Can you animate text-shadow?** Yes, but `filter: drop-shadow()` is more performant (GPU-accelerated).

**CSS Implementation** (Pulse Glow):
```css
@keyframes pulse-glow {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(251,146,60,0.4)); }
  50% { filter: drop-shadow(0 0 20px rgba(251,146,60,0.9)); }
}
```

**Registry Entry**:
```typescript
"pulse_glow": {
  className: "text-orange-400",
  style: { animation: "pulse-glow 2s ease-in-out infinite" },
}
```

**Works?** Yes.

**Performance**: Very good. `filter: drop-shadow()` is GPU-accelerated.

**Alternative** (text-shadow for multi-color glows):
```css
@keyframes neon-pulse {
  0%, 100% {
    text-shadow: 0 0 10px #f0f, 0 0 20px #f0f, 0 0 30px #f0f;
  }
  50% {
    text-shadow: 0 0 20px #f0f, 0 0 30px #f0f, 0 0 40px #f0f, 0 0 50px #0ff;
  }
}
```

This works but is **less performant** than `filter` since it's not GPU-accelerated.

---

#### 4. Typing/Reveal Effect

**Technique**: Animate `clip-path` or `max-width` to reveal text letter by letter.

**CSS Implementation**:
```css
@keyframes typing {
  0% { max-width: 0; }
  100% { max-width: 100%; }
}
```

**Registry Entry**:
```typescript
"typing": {
  style: {
    display: "inline-block",
    overflow: "hidden",
    whiteSpace: "nowrap",
    animation: "typing 1.5s steps(20, end) infinite",
  },
}
```

**Works?** Yes, but **NOT PRACTICAL** for leaderboard names.

**Why Not?**:
- Requires `white-space: nowrap` (names can't wrap)
- `steps()` timing needs to match name length (impossible to predict)
- On a leaderboard with 20+ names, seeing them all "type" simultaneously is visually chaotic
- Works better for hero headlines or single showcase elements

**Verdict**: Skip for leaderboard effects. Could work for a special "Shop preview" animation.

---

#### 5. Sparkle/Particle Effects

**Can you add pseudo-element sparkles?** Yes, with limitations.

**CSS Implementation**:
```css
@keyframes sparkle-orbit {
  0% { transform: rotate(0deg) translateX(15px) rotate(0deg); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: rotate(360deg) translateX(15px) rotate(-360deg); opacity: 0; }
}

/* Applied to ::before and ::after */
```

**Registry Entry**:
```typescript
"sparkle_orbit": {
  style: {
    position: "relative",
    display: "inline-block",
  },
}
// Plus CSS for ::before and ::after pseudo-elements
```

**Problem**: Inline styles **cannot** target pseudo-elements (`::before`, `::after`). You need a CSS class.

**Solution**: Use a global CSS class in `index.css`:

```css
.sparkle-effect {
  position: relative;
  display: inline-block;
}

.sparkle-effect::before,
.sparkle-effect::after {
  content: "✦";
  position: absolute;
  font-size: 0.6em;
  color: #fbbf24;
  opacity: 0;
  animation: sparkle-orbit 3s infinite;
}

.sparkle-effect::after {
  animation-delay: 1.5s;
}
```

**Registry Entry**:
```typescript
"sparkle_orbit": {
  className: "sparkle-effect text-yellow-400",
}
```

**Works?** Yes, if you define the class in `index.css`.

**Performance**: Good. Two pseudo-elements per name = manageable on a leaderboard.

**Alternative** (Canvas/SVG overlay): More complex, requires JS. Skip for now.

---

#### 6. Glitch Effect

**Technique**: Use `text-shadow` with offset color channels + `clip-path` jitter.

**CSS Implementation**:
```css
@keyframes glitch {
  0%, 100% {
    text-shadow: 2px 0 #f00, -2px 0 #0ff;
    transform: translate(0, 0);
  }
  20% {
    text-shadow: -2px 0 #f00, 2px 0 #0ff;
    transform: translate(-2px, 1px);
  }
  40% {
    text-shadow: 2px 0 #f00, -2px 0 #0ff;
    transform: translate(2px, -1px);
  }
  60% {
    text-shadow: -2px 0 #f00, 2px 0 #0ff;
    transform: translate(1px, 2px);
  }
  80% {
    text-shadow: 2px 0 #f00, -2px 0 #0ff;
    transform: translate(-1px, -1px);
  }
}
```

**Registry Entry**:
```typescript
"glitch": {
  className: "text-white",
  style: {
    animation: "glitch 0.3s infinite",
    display: "inline-block",
  },
}
```

**Works?** Yes.

**Performance**: Good. `transform` is GPU-accelerated.

**Visual Impact**: High. Very cyberpunk/chaotic. Use sparingly (maybe legendary tier).

---

### B. Animated Title Badges

Badges are small pills next to names (`<TitleBadge>`). Currently static backgrounds. Animations should be subtle.

#### 1. Shimmer Sweep (Light Reflection)

**Technique**: Overlay a semi-transparent gradient that sweeps across the badge.

**CSS Implementation**:
```css
@keyframes badge-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.badge-shimmer {
  position: relative;
  overflow: hidden;
}

.badge-shimmer::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.3) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: badge-shimmer 3s infinite;
}
```

**Registry Entry**: Requires a CSS class (can't style `::before` inline).

**Works?** Yes. Define `.badge-shimmer` in `index.css`, apply via `className`.

**Performance**: Excellent.

---

#### 2. Gradient Border Animation

**Technique**: Animate `border-image` or use a pseudo-element with rotating gradient.

**Problem**: `border-image` doesn't work with `border-radius`. Use pseudo-element hack:

**CSS Implementation**:
```css
@keyframes border-cycle {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.badge-border-glow {
  position: relative;
  border: 2px solid transparent;
  background: linear-gradient(#1a1a1a, #1a1a1a) padding-box,
              linear-gradient(90deg, #ec4899, #8b5cf6, #ec4899) border-box;
  background-size: 100%, 200%;
  animation: border-cycle 3s linear infinite;
}
```

**Works?** Yes, but complex.

**Performance**: Good.

**Alternative** (Simpler): Animate `border-color` with discrete steps:
```css
@keyframes border-pulse {
  0%, 100% { border-color: rgba(139,92,246,0.4); }
  50% { border-color: rgba(139,92,246,0.8); }
}
```

**Verdict**: Border pulse is simpler and performs better. Use that.

---

#### 3. Pulse/Breathe (Scale + Opacity)

**CSS Implementation**:
```css
@keyframes badge-breathe {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.9; }
}
```

**Registry Entry**:
```typescript
// For TitleBadge, we'd need to extend the component to accept animation classes
"badge_breathe": {
  className: "badge-breathe bg-purple-900/70 text-purple-300 border-purple-500/40",
}
```

**Works?** Yes.

**Performance**: Excellent. `transform: scale()` is GPU-accelerated.

**Note**: Very subtle. Good for legendary badges.

---

#### 4. Glow Halo (Box-Shadow Pulse)

**CSS Implementation**:
```css
@keyframes badge-glow {
  0%, 100% { box-shadow: 0 0 10px rgba(251,191,36,0.3); }
  50% { box-shadow: 0 0 20px rgba(251,191,36,0.7); }
}
```

**Registry Entry**:
```typescript
"badge_glow": {
  style: { animation: "badge-glow 2s ease-in-out infinite" },
}
```

**Works?** Yes.

**Performance**: Very good. `box-shadow` is GPU-accelerated in most modern browsers.

---

## 3. Performance Considerations

### How Many Animated Elements on a Leaderboard?

**Conservative estimate**: 20-30 simultaneously visible names with effects.

**Test scenarios**:
- 20 names with gradient + glow (e.g., "Molten Gold")
- 10 names with animations (e.g., "Rainbow", "Shimmer")
- 5 names with complex effects (e.g., "Glitch", "Sparkle Orbit")

**Performance tiers**:
- **Safe**: 30+ simple animations (hue-rotate, scale, opacity)
- **Caution**: 15-20 complex effects (multi-layer glows, pseudo-elements)
- **Risky**: 10+ glitch effects (heavy `text-shadow` + `transform`)

### GPU Acceleration Tips

**Always use GPU-accelerated properties**:
- `transform` (translate, scale, rotate)
- `opacity`
- `filter` (drop-shadow, blur, hue-rotate)
- `background-position` on gradients

**Avoid animating**:
- `width`, `height` (triggers layout recalc)
- `top`, `left`, `margin` (use `transform: translate()` instead)
- Complex `clip-path` with many points (use simple shapes)

**Use `will-change` sparingly**:
```css
.shimmer-effect {
  will-change: background-position;
}
```

Only add `will-change` if profiling shows jank. Overuse creates memory overhead.

---

### `prefers-reduced-motion` Handling

**Add to `index.css`**:
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

This disables all animations for users with motion sensitivity.

**Better approach** (per-effect control):
```css
@media (prefers-reduced-motion: reduce) {
  .rainbow-effect { animation: none; filter: none; }
  .shimmer-effect { animation: none; }
  /* Static fallback: keep gradient, remove animation */
}
```

---

### Mobile Performance Concerns

**Biggest risks**:
1. **Too many `filter` effects**: `drop-shadow()` stacks badly on low-end Android
2. **Complex gradients**: 5+ color stops can cause repaints
3. **Pseudo-element sparkles**: Each name with `::before + ::after` doubles rendered elements

**Mitigation**:
- Limit simultaneous `filter` effects to 10-15 on mobile
- Use simpler gradients (2-3 colors max) for animated effects
- Skip sparkle effects on mobile if performance is poor (CSS media query)

**Mobile-specific disable**:
```css
@media (max-width: 640px) {
  .sparkle-effect::before,
  .sparkle-effect::after {
    display: none;
  }
}
```

---

## 4. Implementation Approach

### Should Animated Effects Use Inline Styles, Global CSS Classes, or CSS Modules?

**Recommendation**: **Hybrid approach** (current system is correct).

**Use inline styles for**:
- Simple animations (hue-rotate, scale, opacity)
- Gradients + `background-position` shifts
- Single-property effects

**Use global CSS classes (in `index.css`) for**:
- Effects requiring pseudo-elements (`::before`, `::after`)
- Multi-step keyframes with many properties
- Effects that need `prefers-reduced-motion` overrides

**Example**:
```typescript
// Inline style (simple)
"rainbow": {
  className: "text-red-400",
  style: { animation: "rainbow 3s linear infinite" },
}

// Global class (complex)
"sparkle_orbit": {
  className: "sparkle-orbit-effect text-yellow-400",
}
```

Where `sparkle-orbit-effect` is defined in `index.css` with `::before` and `::after`.

---

### How to Add New Animated Effects Without Modifying Tailwind Config

**No Tailwind config changes needed.** The current approach already works:

1. Add `@keyframes` to `/home/ayoun/lol-tracker/client/src/index.css`
2. Add effect to `EFFECT_STYLES` registry in `StyledName.tsx`
3. Seed cosmetic in DB with a matching `cssClass` keyword
4. `getEffectKey()` maps DB string to registry key

**Example**: Adding a new "Neon Flicker" effect.

**Step 1** — Add keyframes to `index.css`:
```css
@keyframes neon-flicker {
  0%, 100% { opacity: 1; filter: brightness(1); }
  50% { opacity: 0.8; filter: brightness(1.5); }
  75% { opacity: 0.9; filter: brightness(1.2); }
}
```

**Step 2** — Add to registry in `StyledName.tsx`:
```typescript
"neon_flicker": {
  className: "text-cyan-400",
  style: {
    animation: "neon-flicker 0.15s infinite",
    filter: "drop-shadow(0 0 15px rgba(34,211,238,0.8))",
  },
}
```

**Step 3** — Add to `getEffectKey()` matcher:
```typescript
if (lower.includes("neon") && lower.includes("flicker")) return "neon_flicker";
```

**Step 4** — Seed in DB (in `seedCosmetics.ts`):
```typescript
{
  type: "name_effect",
  name: "Neon Flicker",
  tier: "epic",
  price: 180,
  css: "text-cyan-400 animate-[neon-flicker_0.15s_infinite]",
  desc: "Electric instability",
  extra: "drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]"
}
```

**Done.** No Tailwind changes needed.

---

### Best Pattern for Combining Multiple Effects

**Current pattern (gradient + glow + animation)**:
```typescript
"molten": {
  style: {
    background: "linear-gradient(to right, #ca8a04, #facc15, #ca8a04)",
    backgroundSize: "200% 100%",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    filter: "drop-shadow(0 0 35px rgba(234,179,8,1))",
    animation: "flow 2s linear infinite",
    display: "inline-block",
  },
}
```

**This works well.** All properties in one inline style object.

**Alternative** (global class for reusability):
```css
.molten-effect {
  background: linear-gradient(to right, #ca8a04, #facc15, #ca8a04);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 35px rgba(234,179,8,1));
  animation: flow 2s linear infinite;
  display: inline-block;
}
```

**Verdict**: Stick with inline styles in the registry for now. Only use global classes when pseudo-elements are required.

---

## 5. Recommended Animated Effects to Add

Based on feasibility, performance, and visual impact, here are **8 new animated effects** ready to implement.

---

### 1. **Neon Pulse** (Epic - $160)

**Description**: Cyan glow that pulses like a neon sign.

**@keyframes** (add to `index.css`):
```css
@keyframes neon-pulse {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(34,211,238,0.6)); }
  50% { filter: drop-shadow(0 0 20px rgba(34,211,238,1)); }
}
```

**Registry entry** (`StyledName.tsx`):
```typescript
"neon_pulse": {
  className: "text-cyan-400",
  style: { animation: "neon-pulse 1.5s ease-in-out infinite" },
}
```

**Matcher** (add to `getEffectKey()`):
```typescript
if (lower.includes("neon") && lower.includes("pulse")) return "neon_pulse";
```

**DB seed** (`seedCosmetics.ts`):
```typescript
{
  type: "name_effect",
  name: "Neon Pulse",
  tier: "epic",
  price: 160,
  css: "text-cyan-400 animate-[neon-pulse_1.5s_ease-in-out_infinite]",
  desc: "Electric heartbeat",
}
```

---

### 2. **Lava Flow** (Legendary - $420)

**Description**: Red-orange gradient that flows like molten lava.

**@keyframes** (add to `index.css`):
```css
@keyframes lava-flow {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
```

**Registry entry**:
```typescript
"lava_flow": {
  style: {
    background: "linear-gradient(to right, #dc2626, #f97316, #dc2626)",
    backgroundSize: "200% 100%",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    filter: "drop-shadow(0 0 25px rgba(239,68,68,0.8))",
    animation: "lava-flow 3s linear infinite",
    display: "inline-block",
  },
}
```

**Matcher**:
```typescript
if (lower.includes("lava")) return "lava_flow";
```

**DB seed**:
```typescript
{
  type: "name_effect",
  name: "Lava Flow",
  tier: "legendary",
  price: 420,
  css: "inline-block bg-gradient-to-r from-red-600 via-orange-500 to-red-600 bg-clip-text text-transparent animate-[lava-flow_3s_linear_infinite]",
  desc: "Molten fury",
  extra: "drop-shadow-[0_0_25px_rgba(239,68,68,0.8)]",
}
```

---

### 3. **Glitch Matrix** (Epic - $195)

**Description**: Cyberpunk glitch with RGB split.

**@keyframes** (add to `index.css`):
```css
@keyframes glitch-matrix {
  0%, 100% {
    text-shadow: 2px 0 #0f0, -2px 0 #f0f;
    transform: translate(0, 0);
  }
  25% {
    text-shadow: -2px 0 #0f0, 2px 0 #f0f;
    transform: translate(-1px, 1px);
  }
  50% {
    text-shadow: 2px 0 #0f0, -2px 0 #f0f;
    transform: translate(1px, -1px);
  }
  75% {
    text-shadow: -2px 0 #0f0, 2px 0 #f0f;
    transform: translate(-1px, -1px);
  }
}
```

**Registry entry**:
```typescript
"glitch_matrix": {
  className: "text-green-400",
  style: {
    animation: "glitch-matrix 0.4s infinite",
    display: "inline-block",
  },
}
```

**Matcher**:
```typescript
if (lower.includes("glitch") || lower.includes("matrix")) return "glitch_matrix";
```

**DB seed**:
```typescript
{
  type: "name_effect",
  name: "Glitch Matrix",
  tier: "epic",
  price: 195,
  css: "text-green-400 animate-[glitch-matrix_0.4s_infinite]",
  desc: "Digital chaos",
}
```

---

### 4. **Frostbite** (Rare - $58)

**Description**: Icy blue with pulsing frost glow.

**@keyframes** (add to `index.css`):
```css
@keyframes frostbite {
  0%, 100% { filter: drop-shadow(0 0 6px rgba(147,197,253,0.5)); }
  50% { filter: drop-shadow(0 0 18px rgba(147,197,253,1)) brightness(1.2); }
}
```

**Registry entry**:
```typescript
"frostbite": {
  className: "text-blue-200",
  style: { animation: "frostbite 2s ease-in-out infinite" },
}
```

**Matcher**:
```typescript
if (lower.includes("frost")) return "frostbite";
```

**DB seed**:
```typescript
{
  type: "name_effect",
  name: "Frostbite",
  tier: "rare",
  price: 58,
  css: "text-blue-200 animate-[frostbite_2s_ease-in-out_infinite]",
  desc: "Frozen aura",
}
```

---

### 5. **Solar Flare** (Legendary - $450)

**Description**: Bright yellow-white gradient with intense brightness pulse.

**@keyframes** (add to `index.css`):
```css
@keyframes solar-flare {
  0%, 100% {
    background-position: 0% 50%;
    filter: brightness(1) drop-shadow(0 0 15px rgba(250,204,21,0.6));
  }
  50% {
    background-position: 100% 50%;
    filter: brightness(1.5) drop-shadow(0 0 40px rgba(250,204,21,1));
  }
}
```

**Registry entry**:
```typescript
"solar_flare": {
  style: {
    background: "linear-gradient(to right, #fef08a, #fef3c7, #fef08a)",
    backgroundSize: "200% 100%",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    animation: "solar-flare 2s ease-in-out infinite",
    display: "inline-block",
  },
}
```

**Matcher**:
```typescript
if (lower.includes("solar") || lower.includes("flare")) return "solar_flare";
```

**DB seed**:
```typescript
{
  type: "name_effect",
  name: "Solar Flare",
  tier: "legendary",
  price: 450,
  css: "inline-block bg-gradient-to-r from-yellow-200 via-yellow-100 to-yellow-200 bg-clip-text text-transparent animate-[solar-flare_2s_ease-in-out_infinite]",
  desc: "Blinding radiance",
}
```

---

### 6. **Phantom Fade** (Epic - $175)

**Description**: Ghostly effect — fades in/out with slight blur.

**@keyframes** (add to `index.css`):
```css
@keyframes phantom-fade {
  0%, 100% { opacity: 1; filter: blur(0px); }
  50% { opacity: 0.4; filter: blur(1px); }
}
```

**Registry entry**:
```typescript
"phantom_fade": {
  className: "text-purple-300",
  style: { animation: "phantom-fade 3s ease-in-out infinite" },
}
```

**Matcher**:
```typescript
if (lower.includes("phantom")) return "phantom_fade";
```

**DB seed**:
```typescript
{
  type: "name_effect",
  name: "Phantom Fade",
  tier: "epic",
  price: 175,
  css: "text-purple-300 animate-[phantom-fade_3s_ease-in-out_infinite]",
  desc: "Ethereal presence",
}
```

---

### 7. **Toxic Drip** (Rare - $52)

**Description**: Lime-green gradient that drips downward.

**@keyframes** (add to `index.css`):
```css
@keyframes toxic-drip {
  0% { background-position: 0% 0%; }
  100% { background-position: 0% 200%; }
}
```

**Registry entry**:
```typescript
"toxic_drip": {
  style: {
    background: "linear-gradient(to bottom, #84cc16, #22c55e, #84cc16)",
    backgroundSize: "100% 200%",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    filter: "drop-shadow(0 0 12px rgba(132,204,22,0.7))",
    animation: "toxic-drip 2.5s linear infinite",
    display: "inline-block",
  },
}
```

**Matcher**:
```typescript
if (lower.includes("toxic") && lower.includes("drip")) return "toxic_drip";
```

**DB seed**:
```typescript
{
  type: "name_effect",
  name: "Toxic Drip",
  tier: "rare",
  price: 52,
  css: "inline-block bg-gradient-to-b from-lime-500 via-green-500 to-lime-500 bg-clip-text text-transparent animate-[toxic-drip_2.5s_linear_infinite]",
  desc: "Radioactive ooze",
  extra: "drop-shadow-[0_0_12px_rgba(132,204,22,0.7)]",
}
```

---

### 8. **Arcane Runes** (Legendary - $480)

**Description**: Purple glow with rotating pseudo-element sparkles.

**@keyframes** (add to `index.css`):
```css
@keyframes rune-orbit {
  0% { transform: rotate(0deg) translateX(12px) rotate(0deg); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: rotate(360deg) translateX(12px) rotate(-360deg); opacity: 0; }
}

@keyframes arcane-glow {
  0%, 100% { filter: drop-shadow(0 0 10px rgba(168,85,247,0.5)); }
  50% { filter: drop-shadow(0 0 25px rgba(168,85,247,1)); }
}
```

**Global CSS class** (add to `index.css`):
```css
.arcane-runes-effect {
  position: relative;
  display: inline-block;
  color: #c084fc; /* purple-400 */
  animation: arcane-glow 2s ease-in-out infinite;
}

.arcane-runes-effect::before,
.arcane-runes-effect::after {
  content: "✦";
  position: absolute;
  top: 50%;
  left: 50%;
  margin-left: -0.3em;
  margin-top: -0.5em;
  font-size: 0.5em;
  color: #a78bfa; /* purple-400 */
  opacity: 0;
  animation: rune-orbit 4s infinite;
}

.arcane-runes-effect::after {
  animation-delay: 2s;
}

@media (prefers-reduced-motion: reduce) {
  .arcane-runes-effect::before,
  .arcane-runes-effect::after {
    animation: none;
    opacity: 0;
  }
}
```

**Registry entry**:
```typescript
"arcane_runes": {
  className: "arcane-runes-effect",
}
```

**Matcher**:
```typescript
if (lower.includes("arcane") || lower.includes("runes")) return "arcane_runes";
```

**DB seed**:
```typescript
{
  type: "name_effect",
  name: "Arcane Runes",
  tier: "legendary",
  price: 480,
  css: "arcane-runes-effect",
  desc: "Ancient magic",
}
```

---

## 6. Title Badge Animations

For badges, keep animations **very subtle** — they're small elements next to names.

### Recommended Badge Animations

#### 1. **Badge Glow Pulse** (for Epic+ badges)

**@keyframes** (add to `index.css`):
```css
@keyframes badge-glow-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(168,85,247,0.3); }
  50% { box-shadow: 0 0 16px rgba(168,85,247,0.7); }
}
```

**Apply to Epic badges** in `TitleBadge` component via conditional class:
```typescript
const animationClass = tier === "epic" || tier === "legendary"
  ? "animate-[badge-glow-pulse_2s_ease-in-out_infinite]"
  : "";
```

Or add to specific badge CSS in DB:
```typescript
{
  type: "title",
  name: "Degen Royalty",
  tier: "epic",
  price: 140,
  css: "bg-gradient-to-r from-purple-900/70 to-violet-900/70 text-purple-300 border border-purple-500/40 animate-[badge-glow-pulse_2s_ease-in-out_infinite]",
  desc: "Embracing the chaos",
}
```

**Works?** Yes, if `@keyframes badge-glow-pulse` is in `index.css`.

---

#### 2. **Badge Shimmer Sweep** (for Legendary badges)

**@keyframes** (already defined as `shimmer`, reuse it):

**Global CSS class** (add to `index.css`):
```css
.badge-shimmer {
  position: relative;
  overflow: hidden;
}

.badge-shimmer::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.25) 50%,
    transparent 100%
  );
  animation: badge-shimmer-sweep 3s infinite;
}

@keyframes badge-shimmer-sweep {
  0% { left: -100%; }
  100% { left: 100%; }
}
```

**Apply to Legendary badges**:
```typescript
{
  type: "title",
  name: "Casino Overlord",
  tier: "legendary",
  price: 300,
  css: "badge-shimmer bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-yellow-100 border border-yellow-400/60",
  desc: "Top of the food chain",
}
```

**Works?** Yes.

---

## 7. Implementation Checklist

### To implement all 8 new animated name effects + badge animations:

**Step 1**: Add all `@keyframes` to `/home/ayoun/lol-tracker/client/src/index.css`

**Step 2**: Add all registry entries to `/home/ayoun/lol-tracker/client/src/components/StyledName.tsx` (`EFFECT_STYLES`)

**Step 3**: Update `getEffectKey()` matcher in `StyledName.tsx` with new keywords

**Step 4**: Add cosmetic seeds to `/home/ayoun/lol-tracker/server/seedCosmetics.ts`

**Step 5**: Run seed script to populate DB

**Step 6**: Test performance on leaderboard with 20+ animated names

**Step 7**: Add `prefers-reduced-motion` overrides for all effects

---

## 8. Performance Testing Plan

### Metrics to Monitor

1. **FPS during scroll** (should stay >55fps on desktop, >30fps on mobile)
2. **Paint time** (Chrome DevTools Performance tab)
3. **GPU memory usage** (check for memory leaks on long sessions)

### Test Matrix

| Scenario | Expected Performance |
|----------|---------------------|
| 20 names with simple effects (hue-rotate, scale) | 60fps desktop, 55fps mobile |
| 15 names with gradient animations (shimmer, flow) | 60fps desktop, 45fps mobile |
| 10 names with complex effects (glitch, arcane runes) | 55fps desktop, 30fps mobile |
| Mixed: 5 legendary + 10 epic + 5 rare | 60fps desktop, 40fps mobile |

### Fallback Strategy

If performance is poor on mobile:
- Disable pseudo-element effects (`::before`, `::after`) via media query
- Simplify gradients (2 colors instead of 3)
- Reduce `filter` effects (use `opacity` animations instead)

---

## 9. Accessibility

### `prefers-reduced-motion`

Add to `index.css` (global override):
```css
@media (prefers-reduced-motion: reduce) {
  .rainbow-effect,
  .shimmer-effect,
  .arcane-runes-effect,
  .neon-pulse-effect,
  .glitch-matrix-effect,
  .phantom-fade-effect,
  .lava-flow-effect,
  .solar-flare-effect,
  .frostbite-effect,
  .toxic-drip-effect,
  [class*="animate-"] {
    animation: none !important;
  }

  /* Keep gradients, remove animations */
  .shimmer-effect,
  .lava-flow-effect,
  .solar-flare-effect,
  .toxic-drip-effect {
    animation: none !important;
    background-position: 0% 50% !important;
  }
}
```

### Color Contrast

All effects maintain readable contrast:
- Light text on dark backgrounds (leaderboard is dark theme)
- Glows enhance visibility, don't obscure text
- Gradients use high-contrast color pairs

---

## 10. Final Recommendations

### DO:
- Use `filter: drop-shadow()` for glows (GPU-accelerated)
- Animate `background-position` for gradient flows
- Keep animations subtle for badges (they're secondary to names)
- Test on low-end Android devices
- Add `prefers-reduced-motion` overrides

### DON'T:
- Animate `width`, `height`, `margin` (use `transform` instead)
- Use typing/reveal effects on leaderboards (too chaotic)
- Add more than 2 pseudo-elements per name (performance risk)
- Forget `display: inline-block` for gradient text effects

### Best Tier Assignments:
- **Common ($10-18)**: Solid colors, no animation
- **Rare ($35-60)**: Static gradients + simple glows
- **Epic ($120-200)**: Animated glows, hue-rotate, simple gradient shifts
- **Legendary ($350-500)**: Complex gradient animations, pseudo-element sparkles, intense glows

---

## Summary

**All proposed effects are technically feasible with CSS-only animations.** The current architecture (EFFECT_STYLES registry + inline styles) is correct and scalable. Performance should be excellent with up to 20 animated names on a leaderboard, assuming:
- GPU-accelerated properties only
- `prefers-reduced-motion` support
- Mobile fallbacks for complex effects

**Next steps**: Implement the 8 recommended effects above, test on real hardware, and iterate based on performance profiling.
