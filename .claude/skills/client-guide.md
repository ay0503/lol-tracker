# Client-Side Development Guide

Reference for building pages in the $DORI LP Tracker React client.

---

## 1. Page Structure

All pages follow a consistent dark theme layout:

```tsx
<div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
  <AppNav />
  {/* Optional: CasinoSubNav for casino pages */}
  <div className="container py-6 sm:py-8 max-w-lg mx-auto px-4">
    {/* Page header */}
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/25 to-violet-600/15 border border-purple-500/20">
          <Icon className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white font-[var(--font-heading)]">Title</h1>
          <p className="text-xs text-zinc-400 font-mono">Subtitle</p>
        </div>
      </div>
    </div>

    {/* Page content */}
  </div>
</div>
```

**Key patterns:**
- Background: `bg-gradient-to-b from-zinc-900 via-zinc-950 to-black`
- Container: `container py-6 sm:py-8 max-w-lg mx-auto px-4` (or `max-w-2xl` for wider pages)
- Icon badge: gradient bg with border, icon colored to match theme
- Heading font: `font-[var(--font-heading)]` (DM Sans)
- Mono font: `font-mono` for numbers/stats

---

## 2. Adding a New Page

### Step 1: Create the page component

Create `/home/ayoun/lol-tracker/client/src/pages/YourPage.tsx`:

```tsx
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import AppNav from "@/components/AppNav";
import { SomeIcon } from "lucide-react";

export default function YourPage() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <AppNav />
      <div className="container py-6 sm:py-8 max-w-lg mx-auto px-4">
        {/* Content */}
      </div>
    </div>
  );
}
```

### Step 2: Add lazy import in App.tsx

```tsx
// In /home/ayoun/lol-tracker/client/src/App.tsx
const YourPage = lazy(() => import("./pages/YourPage"));
```

### Step 3: Add route in the Switch block

```tsx
<Route path={"/your-path"} component={YourPage} />
```

### Step 4: Add nav link in AppNav

```tsx
// In /home/ayoun/lol-tracker/client/src/components/AppNav.tsx
// Add to the MAIN_NAV array
{ href: "/your-path", icon: SomeIcon, label: "Label", labelKo: "korean label" }
```

---

## 3. Casino Page Pattern

Casino game pages follow this template:

```tsx
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import AppNav from "@/components/AppNav";
import CasinoSubNav from "@/components/CasinoSubNav";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0.50: { bg: "from-red-400 to-red-600",     border: "border-red-300/50",     text: "text-white" },
  1:    { bg: "from-gray-100 to-gray-300",    border: "border-gray-200/50",    text: "text-gray-800" },
  5:    { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50",  text: "text-black" },
  10:   { bg: "from-blue-400 to-blue-600",    border: "border-blue-300/50",    text: "text-white" },
  25:   { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", text: "text-white" },
  50:   { bg: "from-purple-400 to-purple-600",   border: "border-purple-300/50",  text: "text-white" },
};

export default function GamePage() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [selectedChip, setSelectedChip] = useState(0.50);

  // Balance query
  const { data: casinoBalance, refetch: refetchBalance } =
    trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });

  // Game mutation
  const playMutation = trpc.casino.game.play.useMutation({
    onSuccess: (result) => { toast.success(`Won $${result.payout.toFixed(2)}`); refetchBalance(); },
    onError: (err) => toast.error(err.message),
  });

  const cash = casinoBalance ?? 20;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <AppNav />
      <CasinoSubNav />
      <div className="container py-6 sm:py-8 max-w-lg mx-auto px-4">
        {/* Header with balance */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/25 to-emerald-600/15 border border-green-500/20">
              <span className="text-lg">ICON</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-[var(--font-heading)]">Game Name</h1>
              <p className="text-xs text-zinc-400 font-mono">${cash.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Game area with green felt background */}
        <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a5c2a] via-[#0d6b32] to-[#084d23]" />
          <div className="absolute inset-0 opacity-[0.07]" style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.4) 0.5px, transparent 0.5px)",
            backgroundSize: "8px 8px",
          }} />
          <div className="absolute inset-2 sm:inset-3 border border-green-500/10 rounded-xl pointer-events-none" />

          <div className="relative p-2.5 sm:p-4">
            {/* Game UI goes here */}

            {/* Controls */}
            <div className="mt-3 pt-2.5 border-t border-white/[0.05] space-y-2.5">
              {/* Chip selector */}
              <div className="flex gap-1.5 justify-center">
                {[0.50, 1, 5, 10, 25, 50].map(amt => {
                  const label = amt < 1 ? `${Math.round(amt * 100)}c` : `$${amt}`;
                  const selected = selectedChip === amt;
                  const disabled = cash < amt;
                  const colors = CHIP_COLORS[amt];
                  return (
                    <motion.button
                      key={amt}
                      whileHover={disabled ? {} : { y: -3 }}
                      whileTap={disabled ? {} : { scale: 0.92 }}
                      onClick={() => !disabled && setSelectedChip(amt)}
                      disabled={disabled}
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full font-mono font-bold
                        text-[9px] sm:text-[10px] shadow-md border-[2.5px] border-dashed
                        transition-all ${
                        disabled ? "opacity-25 cursor-not-allowed bg-gray-700 border-gray-600 text-gray-500"
                        : selected
                          ? `bg-gradient-to-b ${colors.bg} ${colors.text} ${colors.border}
                             ring-2 ring-white/40 ring-offset-1 ring-offset-[#0d6b32] shadow-lg`
                          : `bg-gradient-to-b ${colors.bg} ${colors.text} ${colors.border}
                             opacity-70 hover:opacity-100`
                      }`}
                    >{label}</motion.button>
                  );
                })}
              </div>

              {/* Action button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => playMutation.mutate({ bet: selectedChip })}
                disabled={playMutation.isPending}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500
                  text-black font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed
                  shadow-lg shadow-yellow-500/15"
              >
                {playMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  : `${language === "ko" ? "BET" : "BET"} - $${selectedChip.toFixed(2)}`}
              </motion.button>
            </div>
          </div>
        </div>

        <GamblingDisclaimer />
      </div>
    </div>
  );
}
```

**Key elements:**
- `CasinoSubNav` -- sticky sub-nav for casino games
- Green felt: `from-[#0a5c2a] via-[#0d6b32] to-[#084d23]` with radial-gradient texture overlay
- Chip selector with gradient colors, hover lift (`y: -3`), tap scale
- `GamblingDisclaimer` footer component
- Toast notifications via `sonner` for wins/losses

---

## 4. Styling Conventions

### Colors
| Purpose | Classes |
|---------|---------|
| Dark backgrounds | `zinc-900`, `zinc-950`, `black` |
| Cards/panels | `bg-zinc-900/60 border border-zinc-800/80` |
| Green felt (casino) | `from-[#0a5c2a] via-[#0d6b32] to-[#084d23]` |
| Win | `text-[#00C805]` |
| Loss | `text-[#FF5252]` |
| Gold accent | `text-yellow-400`, `bg-yellow-500/15`, `border-yellow-500/25` |

### Typography
- **Headings:** `text-base font-bold text-white font-[var(--font-heading)]`
- **Body:** `text-xs sm:text-sm text-zinc-400`
- **Numbers/stats:** `font-mono`

### Spacing
- **Container:** `py-6 sm:py-8`
- **Sections:** `mb-5`, `mb-4`
- **Card padding:** `p-2.5 sm:p-4`

### framer-motion patterns

```tsx
// Button hover/tap
<motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} />

// Card entrance with stagger
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: i * 0.02 }}
/>

// Conditional overlay
<AnimatePresence>
  {showResult && (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
    />
  )}
</AnimatePresence>
```

### CSS Animations (defined in index.css)

Casino cosmetic keyframes: `rainbow`, `shimmer`, `lightning`, `sparkle`, `flow`, `cosmic`,
`neon-pulse`, `lava-flow`, `glitch-matrix`, `frostbite`, `solar-flare`, `phantom-fade`,
`toxic-drip`, `arcane-glow`, `rune-orbit`.

CSS classes: `.arcane-runes-effect` (orbiting sparkle pseudo-elements), `.badge-shimmer`
(sweep highlight for legendary badges).

All animations respect `@media (prefers-reduced-motion: reduce)`.

---

## 5. i18n (Korean Translations)

Use `useTranslation` from `/home/ayoun/lol-tracker/client/src/contexts/LanguageContext.tsx`:

```tsx
import { useTranslation } from "@/contexts/LanguageContext";

function Component() {
  const { language, t } = useTranslation();

  // Inline switching
  <span>{language === "ko" ? "korean" : "English"}</span>

  // Structured translations via t object
  <span>{t.portfolio.title}</span>  // "Portfolio" or korean equivalent
  <span>{t.ledger.buy}</span>       // "Buy" or korean equivalent
}
```

For nav links (AppNav, CasinoSubNav), use `label` / `labelKo` fields in config arrays
and switch on `language === "ko"`.

---

## 6. Cosmetics System

### StyledName Component

File: `/home/ayoun/lol-tracker/client/src/components/StyledName.tsx`

```tsx
import StyledName from "@/components/StyledName";

<StyledName
  name="PlayerName"
  nameEffectCss="rainbow"
  titleName="Champion"
  titleCss="bg-gradient-to-r from-yellow-500 to-amber-500 text-black"
  isCloseFriend={true}
  className="text-sm"
  showTitle={true}
/>
```

Also exports `TitleBadge` and `EffectPreview` for shop/preview use:

```tsx
import { TitleBadge, EffectPreview } from "@/components/StyledName";

<TitleBadge name="Champion" cssClass="bg-yellow-500/20 text-yellow-400" />
<EffectPreview name="PlayerName" cssClass="rainbow" />
```

### useCosmetics Hook

File: `/home/ayoun/lol-tracker/client/src/hooks/useCosmetics.ts`

```tsx
import { useCosmetics } from "@/hooks/useCosmetics";

const { getCosmetics } = useCosmetics();
const cosmetics = getCosmetics(userId);
// Returns: { title: {...}, nameEffect: {...}, isCloseFriend: boolean }
```

### Effect Registry (EFFECT_STYLES)

All effects are mapped to inline styles in `StyledName.tsx`:

```tsx
const EFFECT_STYLES: Record<string, { className?: string; style?: CSSProperties }> = {
  "sunset": {
    style: {
      background: "linear-gradient(to right, #f97316, #ec4899)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      display: "inline-block",
    },
  },
  "rainbow": {
    className: "text-red-400",
    style: { animation: "rainbow 3s linear infinite" },
  },
};
```

**To add a new effect:**
1. Add entry to `EFFECT_STYLES` in StyledName.tsx
2. Add pattern matching in `getEffectKey()` function
3. If needed, define `@keyframes` in `/home/ayoun/lol-tracker/client/src/index.css`

---

## 7. CRITICAL: Variable Naming -- TDZ Error

**NEVER use `t` as a lambda/function parameter when `useTranslation` is in scope:**

```tsx
// BAD -- causes TDZ error with esbuild minification
const { t } = useTranslation();
items.map(t => <div>{t.name}</div>)

// GOOD -- use a different parameter name
items.map(item => <div>{item.name}</div>)
items.map(entry => <div>{entry.name}</div>)
```

**Why:** esbuild minification can rename the inner `t` parameter to shadow the outer `t`
from `useTranslation`, producing "Cannot access 't' before initialization" (Temporal Dead
Zone) errors at runtime.

---

## 8. CRITICAL: Dynamic CSS Classes from DB

**Dynamic Tailwind classes from the database DO NOT WORK with JIT compilation:**

```tsx
// BAD -- class string from DB won't be in the compiled CSS
<span className={cosmetic.cssClass}>Text</span>

// GOOD -- use inline styles via the EFFECT_STYLES registry
const effect = EFFECT_STYLES[getEffectKey(cosmetic.cssClass)];
<span className={effect?.className} style={effect?.style}>Text</span>
```

**Why:** Tailwind JIT scans source files at build time. Class strings stored in the database
are never seen by the compiler, so those utility classes are not generated.

**Solution:** Map DB strings to inline styles in the `EFFECT_STYLES` registry in StyledName.tsx.

---

## 9. Common Components

### GamblingDisclaimer

File: `/home/ayoun/lol-tracker/client/src/components/GamblingDisclaimer.tsx`

```tsx
import GamblingDisclaimer from "@/components/GamblingDisclaimer";
<GamblingDisclaimer />
// Renders: "Virtual currency only - No real money - For entertainment"
```

### AppNav

File: `/home/ayoun/lol-tracker/client/src/components/AppNav.tsx`

Main navigation bar with auth, language toggle, theme toggle. Always place at top of page.

```tsx
import AppNav from "@/components/AppNav";
<AppNav />
```

### CasinoSubNav

File: `/home/ayoun/lol-tracker/client/src/components/CasinoSubNav.tsx`

Sticky sub-navigation below AppNav for casino pages. Games configured in `CASINO_GAMES` array.

```tsx
import CasinoSubNav from "@/components/CasinoSubNav";

// To add a new casino game link, add to CASINO_GAMES:
{ href: "/casino/newgame", label: "New Game", labelKo: "korean label", emoji: "ICON", }
```

### tRPC Client

File: `/home/ayoun/lol-tracker/client/src/lib/trpc.ts`

```tsx
import { trpc } from "@/lib/trpc";

const utils = trpc.useUtils();

// Query (auth-gated)
const { data, isLoading } = trpc.casino.blackjack.balance.useQuery(undefined, {
  enabled: isAuthenticated,
  staleTime: 10_000,
});

// Mutation with cache invalidation
const mutation = trpc.casino.blackjack.play.useMutation({
  onSuccess: () => { toast.success("Win!"); utils.casino.blackjack.balance.invalidate(); },
  onError: (err) => toast.error(err.message),
});

mutation.mutate({ bet: 5 });
```
