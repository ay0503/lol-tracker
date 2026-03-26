# Casino System Guide — $DORI LP Tracker

Complete reference for adding casino games, cosmetics, and understanding the casino architecture.

---

## 1. Adding a New Casino Game — Complete Checklist

### Step 1: Create Game Engine (`server/{game}.ts`)

**Template:**

```typescript
/**
 * {GameName} game engine — server-side logic.
 * {Game description, rules, house edge}
 */

const MAX_PAYOUT = 250; // or 5000 for high-variance games
const HOUSE_EDGE = 0.02; // 2% typical

// ─── Game State Interface ───
export interface {GameName}Game {
  id: string;
  userId: number;
  bet: number;
  status: "playing" | "won" | "lost";
  payout: number;
  createdAt: number;
  // ... game-specific fields
}

// ─── Public State (hides secret info during play) ───
export interface Public{GameName}Game {
  id: string;
  userId: number;
  bet: number;
  status: "playing" | "won" | "lost";
  payout: number;
  // ... revealed fields only
}

// ─── In-Memory State ───
const activeGames = new Map<number, {GameName}Game>();

// ─── Cleanup Interval (for stateful games) ───
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 min
  for (const [userId, game] of Array.from(activeGames.entries())) {
    if (game.createdAt < cutoff) activeGames.delete(userId);
  }
}, 5 * 60 * 1000); // every 5 min

// ─── Core Functions ───
export function start{GameName}Game(userId: number, bet: number, ...params): Public{GameName}Game {
  activeGames.delete(userId); // clear any existing
  const game: {GameName}Game = {
    id: `{game}_${Date.now()}_${userId}`,
    userId,
    bet,
    status: "playing",
    payout: 0,
    createdAt: Date.now(),
    // ... initialize game state
  };
  activeGames.set(userId, game);
  return gameToPublic(game);
}

export function play{GameName}(userId: number, ...action): Public{GameName}Game {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");

  // ... game logic
  // Update game.status, game.payout

  return gameToPublic(game);
}

export function getActive{GameName}Game(userId: number): Public{GameName}Game | null {
  const game = activeGames.get(userId);
  return game ? gameToPublic(game) : null;
}

function gameToPublic(game: {GameName}Game): Public{GameName}Game {
  return {
    id: game.id,
    userId: game.userId,
    bet: game.bet,
    status: game.status,
    payout: Math.round(game.payout * 100) / 100,
    // ... hide secret fields if status === "playing"
  };
}
```

**Examples:**
- Instant resolution (Roulette): no Map storage, just pure function `spin(bets): RouletteResult`
- Stateful (Mines): `Map<number, MinesGame>` with reveal/cashout actions

---

### Step 2: Add Router in `server/routers.ts`

**Location:** Inside `casino: router({})` block (line ~767)

**Template:**

```typescript
casino: router({
  // ... existing games (crash, mines, poker, roulette, blackjack)

  {gameName}: router({
    start: protectedProcedure
      .input(z.object({
        bet: z.number().min(0.10).max(5).finite(),
        // ... game-specific params
      }))
      .mutation(async ({ ctx, input }) => {
        await checkCasinoCooldown(ctx.user.id);
        const portfolio = await getOrCreatePortfolio(ctx.user.id);
        const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
        if (input.bet > casinoCash) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.`
          });
        }

        const db = await getDb();
        // Deduct bet upfront
        await db.update(portfolios)
          .set({ casinoBalance: (casinoCash - input.bet).toFixed(2) })
          .where(eq(portfolios.userId, ctx.user.id));

        const { start{GameName}Game } = await import("./{gameName}");
        try {
          const game = start{GameName}Game(ctx.user.id, input.bet, /* params */);
          recordCasinoGame(ctx.user.id);

          // If instant win, credit payout immediately
          if (game.status !== "playing" && game.payout > 0) {
            const newCasino = parseFloat(portfolio.casinoBalance ?? "0") - input.bet + game.payout;
            await db.update(portfolios)
              .set({ casinoBalance: newCasino.toFixed(2) })
              .where(eq(portfolios.userId, ctx.user.id));
          }

          cache.invalidate("casino.leaderboard");
          return game;
        } catch (err: any) {
          // Refund on error
          await db.update(portfolios)
            .set({ casinoBalance: casinoCash.toFixed(2) })
            .where(eq(portfolios.userId, ctx.user.id));
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }),

    action: protectedProcedure
      .input(z.object({ /* action params */ }))
      .mutation(async ({ ctx, input }) => {
        const { play{GameName} } = await import("./{gameName}");
        try {
          const game = play{GameName}(ctx.user.id, input);

          // Credit payout if game ended with win
          if (game.status === "won" && game.payout > 0) {
            const portfolio = await getOrCreatePortfolio(ctx.user.id);
            const db = await getDb();
            const newCasino = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
            await db.update(portfolios)
              .set({ casinoBalance: newCasino.toFixed(2) })
              .where(eq(portfolios.userId, ctx.user.id));
            cache.invalidate("casino.leaderboard");
          }

          return game;
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }),

    active: protectedProcedure.query(async ({ ctx }) => {
      const { getActive{GameName}Game } = await import("./{gameName}");
      return getActive{GameName}Game(ctx.user.id);
    }),
  }),

  // ... shop, leaderboard, etc.
}),
```

**Key patterns:**
- `checkCasinoCooldown(userId)` — prevents spam (100ms cooldown)
- `getOrCreatePortfolio(userId)` — gets current balance
- Deduct bet upfront, credit payout on win
- `recordCasinoGame(userId)` — tracks activity for daily bonus
- `cache.invalidate("casino.leaderboard")` — refresh rankings

---

### Step 3: Create UI Component (`client/src/pages/{Game}.tsx`)

**Template:**

```typescript
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import AppNav from "@/components/AppNav";
import CasinoSubNav from "@/components/CasinoSubNav";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0.50: { bg: "from-red-400 to-red-600", border: "border-red-300/50", text: "text-white" },
  1: { bg: "from-gray-100 to-gray-300", border: "border-gray-200/50", text: "text-gray-800" },
  5: { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50", text: "text-black" },
  10: { bg: "from-blue-400 to-blue-600", border: "border-blue-300/50", text: "text-white" },
  25: { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", text: "text-white" },
  50: { bg: "from-purple-400 to-purple-600", border: "border-purple-300/50", text: "text-white" },
};

export default function {GameName}() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState("0.50");

  const { data: casinoBalance } = trpc.casino.blackjack.balance.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: activeGame } = trpc.casino.{gameName}.active.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const startMutation = trpc.casino.{gameName}.start.useMutation({
    onSuccess: () => {
      toast.success("Game started!");
    },
    onError: (err) => toast.error(err.message),
  });

  const cash = casinoBalance ?? 20;

  const handleStart = useCallback(() => {
    const amt = parseFloat(betAmount);
    if (isNaN(amt) || amt < 0.10) return toast.error("Min bet $0.10");
    startMutation.mutate({ bet: amt });
  }, [betAmount]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <AppNav />
      <CasinoSubNav />
      <div className="container py-6 sm:py-8 max-w-lg mx-auto px-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-{color}-500/25 to-{color}-600/15 border border-{color}-500/20">
              <span className="text-lg">{emoji}</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-[var(--font-heading)]">{GameName}</h1>
              <p className="text-xs text-zinc-400 font-mono">${cash.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/80 to-zinc-900" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

          <div className="relative p-4 sm:p-6">
            {/* Game UI */}

            {/* Chip Selector */}
            <div className="flex gap-1.5 justify-center mb-3">
              {[0.50, 1, 5, 10, 25, 50].map(amt => {
                const label = amt < 1 ? `${Math.round(amt * 100)}¢` : `$${amt}`;
                const selected = parseFloat(betAmount) === amt;
                const disabled = cash < amt;
                const colors = CHIP_COLORS[amt];
                return (
                  <motion.button
                    key={amt}
                    whileHover={disabled ? {} : { y: -3 }}
                    whileTap={disabled ? {} : { scale: 0.92 }}
                    onClick={() => !disabled && setBetAmount(amt.toString())}
                    disabled={disabled}
                    className={`w-11 h-11 rounded-full font-mono font-bold text-[10px] shadow-md border-[2.5px] border-dashed transition-all ${
                      disabled ? "opacity-25 cursor-not-allowed bg-gray-700 border-gray-600 text-gray-500" :
                      selected
                        ? `bg-gradient-to-b ${colors.bg} ${colors.text} ${colors.border} ring-2 ring-white/40`
                        : `bg-gradient-to-b ${colors.bg} ${colors.text} ${colors.border} opacity-70 hover:opacity-100`
                    }`}
                  >
                    {label}
                  </motion.button>
                );
              })}
            </div>

            {/* Start Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStart}
              disabled={startMutation.isPending}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-{color}-500 to-{color}-600 text-white font-bold text-sm disabled:opacity-30 transition-colors shadow-lg"
            >
              {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                `START · $${parseFloat(betAmount || "0").toFixed(2)}`}
            </motion.button>
          </div>
        </div>

        <p className="text-center text-[9px] text-zinc-700 mt-4 font-mono">
          {/* House edge, max payout info */}
        </p>

        <GamblingDisclaimer />
      </div>
    </div>
  );
}
```

---

### Step 4: Add Route to `client/src/App.tsx`

```typescript
import {GameName} from "@/pages/{GameName}";

// Inside <Routes>:
<Route path="/casino/{gameName}" component={{GameName}} />
```

---

### Step 5: Add to Casino Landing Page (`client/src/pages/Casino.tsx`)

**Add to GAMES array (line ~14):**

```typescript
const GAMES = [
  // ... existing games
  {
    id: "{gameName}",
    title: "{GameName}",
    titleKo: "{한글이름}",
    emoji: "{emoji}",
    desc: "Short description",
    descKo: "한글 설명",
    bet: "$0.10 – $5",
    href: "/casino/{gameName}",
    active: true,
    bg: "from-{color}-950/50 to-{color}-900/30",
    border: "border-{color}-700/40",
    badge: "from-{color}-500 to-{color}-600"
  },
];
```

---

### Step 6: Add GamblingDisclaimer Component

**Already imported in template above:**

```tsx
<GamblingDisclaimer />
```

This component is automatically included in all casino pages and shows the gambling disclaimer.

---

## 2. Game Engine Patterns

### Instant Resolution (No State)

**Example: Roulette**

```typescript
// No Map storage, just pure function
export function spin(bets: RouletteBet[]): RouletteResult {
  const winningNumber = Math.floor(Math.random() * 37);
  // ... calculate payouts
  return result;
}
```

- No active game tracking
- All logic in single function call
- Return complete result immediately

### Stateful Games (In-Memory Map)

**Example: Mines, Crash, Blackjack, Poker**

```typescript
const activeGames = new Map<number, GameState>();

export function startGame(userId: number, bet: number): PublicGame {
  activeGames.delete(userId); // clear previous
  const game = { /* initialize */ };
  activeGames.set(userId, game);
  return gameToPublic(game);
}

export function playAction(userId: number, action): PublicGame {
  const game = activeGames.get(userId);
  if (!game) throw new Error("No active game");
  // ... mutate game state
  return gameToPublic(game);
}
```

**Cleanup interval:**

```typescript
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 min
  for (const [userId, game] of Array.from(activeGames.entries())) {
    if (game.createdAt < cutoff) activeGames.delete(userId);
  }
}, 5 * 60 * 1000); // every 5 min
```

### Public vs Private State

**Always hide secrets during active play:**

```typescript
function gameToPublic(game: MinesGame): PublicMinesGame {
  return {
    id: game.id,
    userId: game.userId,
    bet: game.bet,
    status: game.status,
    multiplier: game.multiplier,
    revealedTiles: game.revealedTiles,
    // Only show mines after game ends
    minePositions: game.status !== "playing" ? game.minePositions : undefined,
  };
}
```

---

## 3. Balance Flow Pattern

**Every casino game follows this exact flow:**

### Step 1: Check Cooldown

```typescript
await checkCasinoCooldown(ctx.user.id); // 100ms rate limit
```

### Step 2: Get Current Balance

```typescript
const portfolio = await getOrCreatePortfolio(ctx.user.id);
const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
```

### Step 3: Validate Bet

```typescript
if (input.bet > casinoCash) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.`
  });
}
```

### Step 4: Deduct Bet Upfront

```typescript
const db = await getDb();
await db.update(portfolios)
  .set({ casinoBalance: (casinoCash - input.bet).toFixed(2) })
  .where(eq(portfolios.userId, ctx.user.id));
```

### Step 5: Play Game

```typescript
const game = startGame(ctx.user.id, input.bet, params);
recordCasinoGame(ctx.user.id); // track for daily bonus
```

### Step 6: Credit Payout (if win)

```typescript
if (game.status === "won" && game.payout > 0) {
  const freshPortfolio = await getOrCreatePortfolio(ctx.user.id);
  const newCasino = parseFloat(freshPortfolio.casinoBalance ?? "0") + game.payout;
  await db.update(portfolios)
    .set({ casinoBalance: newCasino.toFixed(2) })
    .where(eq(portfolios.userId, ctx.user.id));
}
```

### Step 7: Invalidate Cache

```typescript
cache.invalidate("casino.leaderboard"); // refresh rankings
```

### Step 8: Refund on Error

```typescript
try {
  // ... game logic
} catch (err: any) {
  // Refund bet if error occurs
  await db.update(portfolios)
    .set({ casinoBalance: casinoCash.toFixed(2) })
    .where(eq(portfolios.userId, ctx.user.id));
  throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
}
```

---

## 4. Adding a New Cosmetic

### Step 1: Add to Seed Data (`server/seedCosmetics.ts`)

**Title (line ~45):**

```typescript
{
  type: "title",
  name: "Your Title",
  tier: "rare", // common | rare | epic | legendary
  price: 35,
  css: "bg-blue-950/50 text-blue-400 border border-blue-500/30",
  desc: "Short description"
},
```

**Name Effect (line ~84):**

```typescript
// Simple color (line ~84-90)
{
  type: "name_effect",
  name: "Cherry Red",
  tier: "common",
  price: 10,
  css: "text-red-500",
  desc: "Classic standout"
},

// Gradient with glow (line ~91-98)
{
  type: "name_effect",
  name: "Sunset",
  tier: "rare",
  price: 35,
  css: "inline-block bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent",
  desc: "Warm fade",
  extra: "drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]"
},

// Animated (line ~99-104)
{
  type: "name_effect",
  name: "Rainbow Cycle",
  tier: "epic",
  price: 120,
  css: "text-red-400 animate-[rainbow_3s_linear_infinite]",
  desc: "Full spectrum shift"
},
```

**Limited edition (line ~81-82):**

```typescript
{
  type: "title",
  name: "Unhinged",
  tier: "legendary",
  price: 400,
  css: "bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-yellow-100 border border-yellow-400/60",
  desc: "Too far gone",
  limited: true,
  stock: 10
},
```

---

### Step 2: Add to StyledName Registry (`client/src/components/StyledName.tsx`)

**EFFECT_STYLES registry (line ~10):**

```typescript
const EFFECT_STYLES: Record<string, { className?: string; style?: CSSProperties }> = {
  // Simple color (works as Tailwind class)
  "text-red-500": { className: "text-red-500" },

  // Gradient (needs inline style)
  "sunset": {
    style: {
      background: "linear-gradient(to right, #f97316, #ec4899)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 8px rgba(251,146,60,0.5))",
      display: "inline-block",
    },
  },

  // Animated
  "rainbow": {
    className: "text-red-400",
    style: { animation: "rainbow 3s linear infinite" },
  },
};
```

**getEffectKey matcher (line ~183):**

```typescript
function getEffectKey(cssClass: string): string | null {
  if (!cssClass) return null;

  // Simple color classes — pass through
  if (/^text-(red|blue|green|purple|amber)-\d+$/.test(cssClass.trim())) {
    return cssClass.trim();
  }

  // Match by keywords in cssClass
  const lower = cssClass.toLowerCase();
  if (lower.includes("from-orange") && lower.includes("to-pink")) return "sunset";
  if (lower.includes("rainbow")) return "rainbow";
  // ... add your matcher

  return null;
}
```

---

### Step 3: Add CSS Keyframes (if animated)

**In `client/src/index.css`:**

```css
@keyframes rainbow {
  0%, 100% { color: rgb(248, 113, 113); }
  14% { color: rgb(251, 146, 60); }
  28% { color: rgb(250, 204, 21); }
  42% { color: rgb(132, 204, 22); }
  57% { color: rgb(34, 197, 94); }
  71% { color: rgb(59, 130, 246); }
  85% { color: rgb(168, 85, 247); }
}
```

---

## 5. Chip System

### Standard Denominations

**Used across ALL casino games:**

```typescript
const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0.50: { bg: "from-red-400 to-red-600", border: "border-red-300/50", text: "text-white" },
  1: { bg: "from-gray-100 to-gray-300", border: "border-gray-200/50", text: "text-gray-800" },
  5: { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50", text: "text-black" },
  10: { bg: "from-blue-400 to-blue-600", border: "border-blue-300/50", text: "text-white" },
  25: { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", text: "text-white" },
  50: { bg: "from-purple-400 to-purple-600", border: "border-purple-300/50", text: "text-white" },
};
```

### UI Pattern

```tsx
<div className="flex gap-1.5 justify-center">
  {[0.50, 1, 5, 10, 25, 50].map(amt => {
    const label = amt < 1 ? `${Math.round(amt * 100)}¢` : `$${amt}`;
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
        className={`w-11 h-11 rounded-full font-mono font-bold text-[10px] shadow-md border-[2.5px] border-dashed transition-all ${
          disabled ? "opacity-25 cursor-not-allowed bg-gray-700 border-gray-600 text-gray-500" :
          selected
            ? `bg-gradient-to-b ${colors.bg} ${colors.text} ${colors.border} ring-2 ring-white/40`
            : `bg-gradient-to-b ${colors.bg} ${colors.text} ${colors.border} opacity-70 hover:opacity-100`
        }`}
      >
        {label}
      </motion.button>
    );
  })}
</div>
```

**Key features:**
- Hover lift (`y: -3`)
- Tap scale (`scale: 0.92`)
- Auto-disable if insufficient balance
- White ring on selected chip
- Consistent across all games

---

## 6. Common Constants

### Roulette (`server/roulette.ts`)

```typescript
const MAX_PAYOUT = 250;

export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
export const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

// European wheel order (client-side for spin animation)
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
```

### Mines (`server/mines.ts`)

```typescript
const GRID_SIZE = 25;
const HOUSE_EDGE = 0.02; // 2%
const MAX_PAYOUT = 5000;

// Multiplier formula
function calculateMultiplier(mineCount: number, revealedCount: number): number {
  if (revealedCount === 0) return 1;
  let mult = 1;
  for (let i = 0; i < revealedCount; i++) {
    mult *= (GRID_SIZE - i) / (GRID_SIZE - mineCount - i);
  }
  return mult * (1 - HOUSE_EDGE);
}
```

### Bet Limits (All Games)

```typescript
// Standard across casino
const MIN_BET = 0.10;
const MAX_BET = 5.00;

// Validation in router
.input(z.object({ bet: z.number().min(0.10).max(5).finite() }))
```

### House Edges

- **Roulette:** 2.7% (European single zero)
- **Mines:** 2% (multiplier formula)
- **Crash:** 2% (crash point calculation)
- **Blackjack:** 0.5% (optimal strategy)
- **Video Poker:** 0.46% (Jacks or Better, perfect play)

---

## 7. File Locations Reference

### Server

- **Game Engines:** `/home/ayoun/lol-tracker/server/{game}.ts`
- **Routers:** `/home/ayoun/lol-tracker/server/routers.ts` (line ~767)
- **Cosmetics Seed:** `/home/ayoun/lol-tracker/server/seedCosmetics.ts`

### Client

- **Game Pages:** `/home/ayoun/lol-tracker/client/src/pages/{Game}.tsx`
- **Casino Landing:** `/home/ayoun/lol-tracker/client/src/pages/Casino.tsx`
- **Shop:** `/home/ayoun/lol-tracker/client/src/pages/CasinoShop.tsx`
- **StyledName:** `/home/ayoun/lol-tracker/client/src/components/StyledName.tsx`
- **GamblingDisclaimer:** `/home/ayoun/lol-tracker/client/src/components/GamblingDisclaimer.tsx`
- **Routes:** `/home/ayoun/lol-tracker/client/src/App.tsx`

---

## 8. Quick Copy-Paste: Roulette Bet Types

```typescript
type BetType =
  | 'straight'    // single number (0-36) — 36x payout
  | 'red'         // red numbers — 2x
  | 'black'       // black numbers — 2x
  | 'odd'         // odd numbers (1-35) — 2x
  | 'even'        // even numbers (2-36) — 2x
  | 'high'        // 19-36 — 2x
  | 'low'         // 1-18 — 2x
  | 'dozen1'      // 1-12 — 3x
  | 'dozen2'      // 13-24 — 3x
  | 'dozen3'      // 25-36 — 3x
  | 'column1'     // numbers % 3 === 1 — 3x
  | 'column2'     // numbers % 3 === 2 — 3x
  | 'column3';    // numbers % 3 === 0 — 3x
```

---

## 9. Tips & Best Practices

1. **Always refund on error** — Bet is deducted upfront, so catch errors and refund
2. **Invalidate cache** — Call `cache.invalidate("casino.leaderboard")` after balance changes
3. **Round payouts** — `Math.round(payout * 100) / 100` for display
4. **Use publicProcedure sparingly** — Most endpoints should be `protectedProcedure`
5. **Toast notifications** — Use `toast.success()` for wins, `toast.error()` for losses
6. **Framer Motion** — Use for smooth animations (chips, results, etc.)
7. **GamblingDisclaimer** — Required on all casino pages
8. **Cleanup intervals** — Set for stateful games to prevent memory leaks
9. **Cooldown checks** — `checkCasinoCooldown()` prevents spam
10. **Max payout caps** — Enforce `MAX_PAYOUT` to prevent bankroll drain

---

## 10. Complete Example: Adding "Coin Flip" Game

### 1. Server Engine (`server/coinFlip.ts`)

```typescript
/**
 * Coin Flip — instant game, 50/50 odds, 1.96x payout (2% house edge)
 */

const HOUSE_EDGE = 0.02;
const PAYOUT_MULTIPLIER = 2 * (1 - HOUSE_EDGE); // 1.96x
const MAX_PAYOUT = 250;

export interface CoinFlipResult {
  result: "heads" | "tails";
  playerChoice: "heads" | "tails";
  won: boolean;
  bet: number;
  payout: number;
  timestamp: number;
}

export function flipCoin(playerChoice: "heads" | "tails", bet: number): CoinFlipResult {
  const result: "heads" | "tails" = Math.random() < 0.5 ? "heads" : "tails";
  const won = result === playerChoice;
  const rawPayout = won ? bet * PAYOUT_MULTIPLIER : 0;
  const payout = Math.min(rawPayout, MAX_PAYOUT);

  return {
    result,
    playerChoice,
    won,
    bet: Math.round(bet * 100) / 100,
    payout: Math.round(payout * 100) / 100,
    timestamp: Date.now(),
  };
}
```

### 2. Router (`server/routers.ts`)

```typescript
coinFlip: router({
  flip: protectedProcedure
    .input(z.object({
      bet: z.number().min(0.10).max(5).finite(),
      choice: z.enum(['heads', 'tails']),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkCasinoCooldown(ctx.user.id);
      const portfolio = await getOrCreatePortfolio(ctx.user.id);
      const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
      if (input.bet > casinoCash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.`
        });
      }

      const db = await getDb();
      await db.update(portfolios)
        .set({ casinoBalance: (casinoCash - input.bet).toFixed(2) })
        .where(eq(portfolios.userId, ctx.user.id));

      const { flipCoin } = await import("./coinFlip");
      const result = flipCoin(input.choice, input.bet);

      if (result.payout > 0) {
        const newCasino = parseFloat(portfolio.casinoBalance ?? "0") - input.bet + result.payout;
        await db.update(portfolios)
          .set({ casinoBalance: newCasino.toFixed(2) })
          .where(eq(portfolios.userId, ctx.user.id));
      }

      recordCasinoGame(ctx.user.id);
      cache.invalidate("casino.leaderboard");
      return result;
    }),
}),
```

### 3. Add to Casino Landing (`client/src/pages/Casino.tsx`)

```typescript
{
  id: "coinFlip",
  title: "Coin Flip",
  titleKo: "동전던지기",
  emoji: "🪙",
  desc: "50/50 odds, instant win",
  descKo: "동전던지기",
  bet: "$0.10 – $5",
  href: "/casino/coin-flip",
  active: true,
  bg: "from-yellow-950/50 to-amber-900/30",
  border: "border-yellow-700/40",
  badge: "from-yellow-500 to-amber-600"
},
```

---

**Done!** This guide covers the entire casino system architecture.
