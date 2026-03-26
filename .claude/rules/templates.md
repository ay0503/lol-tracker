# Casino Game Templates

Copy-paste-ready templates for adding new features to the $DORI LP Tracker casino.

---

## Template 1: New Casino Game Engine (server/{game}.ts)

**Use for:** Instant-resolution games (like Roulette) or stateful games (like Mines).

### Instant Game Pattern (like Roulette)

```typescript
/**
 * {GameName} game engine — server-side logic.
 * {Game description, house edge, mechanics}
 */

const MAX_PAYOUT = 250;
const HOUSE_EDGE = 0.027; // 2.7%

// ─── Type Definitions ───
export type BetType = 'option1' | 'option2' | 'option3'; // Define bet options

export interface GameBet {
  type: BetType;
  amount: number;
  // Add game-specific fields (e.g., number for roulette)
}

export interface BetResult {
  bet: GameBet;
  won: boolean;
  payout: number;
}

export interface GameResult {
  outcome: string | number; // Winning outcome (e.g., number, symbol)
  bets: BetResult[];
  totalBet: number;
  totalPayout: number;
  timestamp: number;
}

export interface GameHistory {
  outcome: string | number;
  timestamp: number;
}

// ─── In-Memory Storage ───
const recentResults: GameHistory[] = [];
const MAX_HISTORY = 20;

// ─── Game Logic Helpers ───
function calculateWin(bet: GameBet, outcome: any): boolean {
  switch (bet.type) {
    case 'option1': return /* winning condition */;
    case 'option2': return /* winning condition */;
    default: return false;
  }
}

function getMultiplier(type: BetType): number {
  switch (type) {
    case 'option1': return 2;
    case 'option2': return 5;
    default: return 0;
  }
}

// ─── Main Game Function ───
export function play(bets: GameBet[]): GameResult {
  // 1. Generate outcome
  const outcome = /* RNG logic here */;

  // 2. Evaluate bets
  const betResults: BetResult[] = bets.map(bet => {
    const won = calculateWin(bet, outcome);
    return {
      bet,
      won,
      payout: won ? bet.amount * getMultiplier(bet.type) : 0,
    };
  });

  // 3. Calculate totals with MAX_PAYOUT cap
  const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);
  const rawPayout = betResults.reduce((sum, r) => sum + r.payout, 0);
  const totalPayout = Math.min(rawPayout, MAX_PAYOUT);

  const result: GameResult = {
    outcome,
    bets: betResults,
    totalBet: Math.round(totalBet * 100) / 100,
    totalPayout: Math.round(totalPayout * 100) / 100,
    timestamp: Date.now(),
  };

  // 4. Store history
  recentResults.unshift({ outcome, timestamp: Date.now() });
  if (recentResults.length > MAX_HISTORY) recentResults.pop();

  return result;
}

export function getHistory(): GameHistory[] {
  return recentResults;
}
```

### Stateful Game Pattern (like Mines)

```typescript
/**
 * {GameName} game engine — server-side logic.
 * Stateful: game persists across multiple player actions.
 */

const HOUSE_EDGE = 0.02;
const MAX_PAYOUT = 5000;

// ─── Type Definitions ───
export interface GameState {
  id: string;
  userId: number;
  bet: number;
  // Game-specific secret state (e.g., mine positions, deck order)
  secretField: number[];
  // Game-specific visible state (e.g., revealed cells, drawn cards)
  revealedField: number[];
  status: "playing" | "won" | "lost";
  multiplier: number;
  payout: number;
  createdAt: number;
}

export interface PublicGameState {
  id: string;
  userId: number;
  bet: number;
  // Only public fields — secrets hidden until game ends
  revealedField: number[];
  status: "playing" | "won" | "lost";
  multiplier: number;
  nextMultiplier: number;
  payout: number;
  secretField?: number[]; // Only revealed when game ends
}

// ─── In-Memory Storage ───
const activeGames = new Map<number, GameState>();

// ─── Helper Functions ───
function calculateMultiplier(revealedCount: number, totalCells: number, dangerCount: number): number {
  let mult = 1;
  for (let i = 0; i < revealedCount; i++) {
    const safeCells = totalCells - dangerCount - i;
    const remainingCells = totalCells - i;
    mult *= remainingCells / safeCells;
  }
  return mult * (1 - HOUSE_EDGE);
}

function gameToPublic(game: GameState): PublicGameState {
  return {
    id: game.id,
    userId: game.userId,
    bet: game.bet,
    revealedField: game.revealedField,
    status: game.status,
    multiplier: Math.round(game.multiplier * 100) / 100,
    nextMultiplier: Math.round(calculateMultiplier(
      game.revealedField.length + 1, /* totalCells */, /* dangerCount */
    ) * 100) / 100,
    payout: Math.round(game.payout * 100) / 100,
    // Reveal secrets only when game is over
    secretField: game.status !== "playing" ? game.secretField : undefined,
  };
}

// ─── Game Actions ───
export function startGame(userId: number, bet: number /*, params */): PublicGameState {
  activeGames.delete(userId); // Clean up any existing game

  const game: GameState = {
    id: `game_${Date.now()}_${userId}`,
    userId,
    bet,
    secretField: /* generate secrets (e.g., shuffle, place mines) */,
    revealedField: [],
    status: "playing",
    multiplier: 1,
    payout: 0,
    createdAt: Date.now(),
  };

  activeGames.set(userId, game);
  return gameToPublic(game);
}

export function performAction(userId: number, actionParam: number): PublicGameState {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");

  // Validate action (e.g., cell not already revealed)
  if (game.revealedField.includes(actionParam)) throw new Error("Already revealed");

  // Check win/loss
  if (game.secretField.includes(actionParam)) {
    // Hit a danger cell — loss
    game.status = "lost";
    game.payout = 0;
    game.multiplier = 0;
  } else {
    // Safe — update multiplier
    game.revealedField.push(actionParam);
    game.multiplier = calculateMultiplier(
      game.revealedField.length, /* totalCells */, /* dangerCount */
    );
  }

  return gameToPublic(game);
}

export function cashOut(userId: number): PublicGameState {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");

  game.status = "won";
  game.payout = Math.min(game.bet * game.multiplier, MAX_PAYOUT);
  return gameToPublic(game);
}

export function getActiveGame(userId: number): PublicGameState | null {
  const game = activeGames.get(userId);
  return game ? gameToPublic(game) : null;
}

// ─── Cleanup: delete stale games every 5 min (older than 30 min) ───
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [userId, game] of Array.from(activeGames.entries())) {
    if (game.createdAt < cutoff) activeGames.delete(userId);
  }
}, 5 * 60 * 1000);
```

---

## Template 2: Casino Game Router (add to server/routers.ts)

**Location:** Inside the `casino: router({ ... })` block in `server/routers.ts`.

### Instant Game Router

```typescript
gameName: router({
  play: protectedProcedure
    .input(z.object({
      bets: z.array(z.object({
        type: z.enum(['option1', 'option2', 'option3']),
        amount: z.number().min(0.10).finite(),
        // Add other bet fields as needed
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Cooldown check
      await checkCasinoCooldown(ctx.user.id);

      // 2. Calculate total bet
      const totalBet = input.bets.reduce((sum, b) => sum + b.amount, 0);

      // 3. Balance check
      const portfolio = await getOrCreatePortfolio(ctx.user.id);
      const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
      if (totalBet > casinoCash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.`,
        });
      }

      // 4. Deduct bet
      const db = await getDb();
      await db.update(portfolios)
        .set({ casinoBalance: (casinoCash - totalBet).toFixed(2) })
        .where(eq(portfolios.userId, ctx.user.id));

      // 5. Play game
      const { play } = await import("./gameName");
      const result = play(input.bets);

      // 6. Credit winnings
      if (result.totalPayout > 0) {
        const freshPortfolio = await getOrCreatePortfolio(ctx.user.id);
        const newCasino = parseFloat(freshPortfolio.casinoBalance ?? "0") + result.totalPayout;
        await db.update(portfolios)
          .set({ casinoBalance: newCasino.toFixed(2) })
          .where(eq(portfolios.userId, ctx.user.id));
      }

      // 7. Record activity and invalidate cache
      recordCasinoGame(ctx.user.id);
      cache.invalidate("casino.leaderboard");

      return result;
    }),
  history: publicProcedure.query(async () => {
    const { getHistory } = await import("./gameName");
    return getHistory();
  }),
}),
```

### Stateful Game Router

```typescript
gameName: router({
  start: protectedProcedure
    .input(z.object({
      bet: z.number().min(0.10).max(5).finite(),
      // Add game-specific params (e.g., difficulty, mineCount)
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Cooldown check
      await checkCasinoCooldown(ctx.user.id);

      // 2. Balance check
      const portfolio = await getOrCreatePortfolio(ctx.user.id);
      const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
      if (input.bet > casinoCash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.`,
        });
      }

      // 3. Deduct bet
      const db = await getDb();
      await db.update(portfolios)
        .set({ casinoBalance: (casinoCash - input.bet).toFixed(2) })
        .where(eq(portfolios.userId, ctx.user.id));

      // 4. Start game
      const { startGame } = await import("./gameName");
      try {
        const game = startGame(ctx.user.id, input.bet /* , params */);
        recordCasinoGame(ctx.user.id);
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
    .input(z.object({
      /* action params, e.g.: position: z.number().int().min(0).max(24) */
    }))
    .mutation(async ({ ctx, input }) => {
      const { performAction } = await import("./gameName");
      try {
        const game = performAction(ctx.user.id, input./* param */);

        // Credit payout if game ended in a win
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

  cashout: protectedProcedure.mutation(async ({ ctx }) => {
    const { cashOut } = await import("./gameName");
    try {
      const game = cashOut(ctx.user.id);

      if (game.payout > 0) {
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
    const { getActiveGame } = await import("./gameName");
    return getActiveGame(ctx.user.id);
  }),
}),
```

---

## Template 3: Casino Page Component (client/src/pages/{Game}.tsx)

```tsx
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import AppNav from "@/components/AppNav";
import CasinoSubNav from "@/components/CasinoSubNav";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";

// ─── Chip Values & Colors ───
const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0.50: { bg: "from-red-400 to-red-600",     border: "border-red-300/50",     text: "text-white" },
  1:    { bg: "from-gray-100 to-gray-300",    border: "border-gray-200/50",    text: "text-gray-800" },
  5:    { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50",  text: "text-black" },
  10:   { bg: "from-blue-400 to-blue-600",    border: "border-blue-300/50",    text: "text-white" },
  25:   { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", text: "text-white" },
  50:   { bg: "from-purple-400 to-purple-600",   border: "border-purple-300/50",  text: "text-white" },
};

export default function GameName() {
  const { language } = useTranslation();
  const { isAuthenticated, user } = useAuth();

  // ─── State ───
  const [selectedChip, setSelectedChip] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  // Add game-specific state here (e.g., result, animation phase)

  // ─── Queries ───
  const balance = trpc.portfolio.balances.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  // ─── Mutations ───
  const playMutation = trpc.casino.gameName.play.useMutation({
    onSuccess: (data) => {
      utils.portfolio.balances.invalidate();
      if (data.totalPayout > 0) {
        toast.success(`Won $${data.totalPayout.toFixed(2)}!`);
      } else {
        toast.error("No win this time");
      }
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setIsPlaying(false),
  });

  // ─── Handlers ───
  const handlePlay = useCallback(() => {
    if (!isAuthenticated) {
      toast.error("Sign in to play");
      return;
    }
    setIsPlaying(true);
    playMutation.mutate({
      bets: [{ type: "option1", amount: selectedChip }],
    });
  }, [isAuthenticated, selectedChip, playMutation]);

  const casinoCash = balance.data?.casinoBalance ?? 20;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      <AppNav />
      <CasinoSubNav />

      {/* ─── Header ─── */}
      <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800 py-4">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/casino">
              <button className="p-2 hover:bg-zinc-800 rounded-lg transition">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <h1 className="text-xl font-bold">Game Name</h1>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg">
            <span className="text-xs text-zinc-400">Casino Cash</span>
            <span className="font-bold text-green-400">${casinoCash.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">

        {/* ─── Game Area ─── */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 min-h-[400px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            {/* Replace with game-specific UI */}
            <motion.div
              key="game-area"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center text-zinc-500"
            >
              Game UI goes here
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ─── Chip Selector ─── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-zinc-300">Select Chip</span>
            <span className="text-xs text-zinc-500">Balance: ${casinoCash.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Object.entries(CHIP_COLORS).map(([val, colors]) => {
              const value = parseFloat(val);
              const active = selectedChip === value;
              return (
                <button
                  key={value}
                  onClick={() => setSelectedChip(value)}
                  disabled={value > casinoCash}
                  className={`
                    relative flex items-center justify-center aspect-square rounded-full
                    border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed
                    ${active ? "scale-110 shadow-lg border-white" : "border-transparent hover:scale-105"}
                  `}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg} rounded-full border-4 ${colors.border}`} />
                  <span className={`relative z-10 font-bold ${colors.text} text-sm`}>
                    ${value}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Play Button ─── */}
        <button
          onClick={handlePlay}
          disabled={isPlaying || !isAuthenticated}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-zinc-700 disabled:to-zinc-800 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg disabled:shadow-none"
        >
          {isPlaying ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Playing...
            </span>
          ) : (
            `Play $${selectedChip.toFixed(2)}`
          )}
        </button>

        {/* ─── Disclaimer ─── */}
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
```

---

## Template 4: New Cosmetic Effect

Adding a cosmetic requires changes in 4 files. Follow all steps.

### Step 1: Add @keyframes to client/src/index.css

Add inside the `/* Casino Cosmetic Animations */` section:

```css
@keyframes effect-name {
  0%, 100% { /* start/end state */ }
  50% { /* midpoint state */ }
}
```

Real examples from the codebase:

```css
/* Glow pulse */
@keyframes neon-pulse {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(34,211,238,0.6)); }
  50% { filter: drop-shadow(0 0 20px rgba(34,211,238,1)); }
}

/* Background position shift (for gradient animations) */
@keyframes lava-flow {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

/* Glitch / jitter */
@keyframes glitch-matrix {
  0%, 100% { text-shadow: 2px 0 #0f0, -2px 0 #f0f; transform: translate(0,0); }
  25% { text-shadow: -2px 0 #0f0, 2px 0 #f0f; transform: translate(-1px,1px); }
  50% { text-shadow: 2px 0 #0f0, -2px 0 #f0f; transform: translate(1px,-1px); }
  75% { text-shadow: -2px 0 #0f0, 2px 0 #f0f; transform: translate(-1px,-1px); }
}
```

### Step 2: Add entry to EFFECT_STYLES in client/src/components/StyledName.tsx

```typescript
const EFFECT_STYLES: Record<string, { className?: string; style?: CSSProperties }> = {
  // ... existing entries ...

  // ─── Common: solid color (works as Tailwind class) ───
  "text-teal-400": { className: "text-teal-400" },

  // ─── Rare: gradient with glow (needs inline styles) ───
  "blood-moon": {
    style: {
      background: "linear-gradient(to right, #dc2626, #7c3aed)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 10px rgba(220,38,38,0.6))",
      display: "inline-block",
    },
  },

  // ─── Epic: animated effect (needs inline style + keyframe from index.css) ───
  "plasma-wave": {
    style: {
      background: "linear-gradient(to right, #06b6d4, #8b5cf6, #06b6d4)",
      backgroundSize: "200% 100%",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      animation: "flow 2s linear infinite",
      filter: "drop-shadow(0 0 15px rgba(139,92,246,0.7))",
      display: "inline-block",
    },
  },

  // ─── Legendary: complex multi-property animation ───
  "supernova": {
    style: {
      background: "linear-gradient(to right, #fbbf24, #ffffff, #fbbf24)",
      backgroundSize: "300% 100%",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      animation: "cosmic 4s ease-in-out infinite",
      filter: "drop-shadow(0 0 40px rgba(251,191,36,1))",
      display: "inline-block",
    },
  },
};
```

### Step 3: Add matcher to getEffectKey() in StyledName.tsx

```typescript
function getEffectKey(cssClass: string): string | null {
  const lower = cssClass.toLowerCase();
  // ... existing matchers ...

  // New effect matchers
  if (lower.includes("blood-moon")) return "blood-moon";
  if (lower.includes("plasma-wave")) return "plasma-wave";
  if (lower.includes("supernova")) return "supernova";

  return null;
}
```

### Step 4: Add seed data to server/seedCosmetics.ts

```typescript
const items = [
  // ... existing items ...

  // ─── NAME EFFECTS ───
  // Common: solid color, $10-18
  { type: "name_effect", name: "Teal Glow",    tier: "common",    price: 14, css: "text-teal-400",     desc: "Clean and modern" },

  // Rare: gradient + glow, $35-60
  { type: "name_effect", name: "Blood Moon",    tier: "rare",      price: 48, css: "inline-block bg-gradient-to-r from-red-600 to-purple-600 bg-clip-text text-transparent", desc: "Dark energy", extra: "drop-shadow-[0_0_10px_rgba(220,38,38,0.6)]" },

  // Epic: animated, $120-200
  { type: "name_effect", name: "Plasma Wave",   tier: "epic",      price: 170, css: "inline-block bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 bg-[length:200%_100%] bg-clip-text text-transparent animate-[flow_2s_linear_infinite]", desc: "Energetic flow", extra: "drop-shadow-[0_0_15px_rgba(139,92,246,0.7)]" },

  // Legendary: complex animation, $350-500
  { type: "name_effect", name: "Supernova",     tier: "legendary", price: 460, css: "inline-block bg-gradient-to-r from-yellow-400 via-white to-yellow-400 bg-[length:300%_100%] bg-clip-text text-transparent animate-[cosmic_4s_ease-in-out_infinite]", desc: "Stellar explosion", extra: "drop-shadow-[0_0_40px_rgba(251,191,36,1)]" },

  // ─── TITLES ───
  // Common: $5-12
  { type: "title", name: "New Title",           tier: "common",    price: 8,   css: "bg-zinc-800 text-zinc-400 border border-zinc-700",   desc: "Description" },

  // Rare: $28-50
  { type: "title", name: "Rare Title",          tier: "rare",      price: 38,  css: "bg-blue-950/50 text-blue-400 border border-blue-500/30", desc: "Description" },

  // Epic: $85-150
  { type: "title", name: "Epic Title",          tier: "epic",      price: 110, css: "bg-gradient-to-r from-purple-900/70 to-violet-900/70 text-purple-300 border border-purple-500/40", desc: "Description" },

  // Legendary: $275-500
  { type: "title", name: "Legendary Title",     tier: "legendary", price: 350, css: "bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-yellow-100 border border-yellow-400/60", desc: "Description" },

  // Limited (add limited + stock fields)
  { type: "title", name: "Super Limited",       tier: "legendary", price: 500, css: "bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-yellow-100 border border-yellow-400/60", desc: "Only 5 exist", limited: true, stock: 5 },
];
```

---

## Template 5: New Admin Quick Action

### Step 1: Add backend route to server/routers.ts

Add inside `admin: router({ ... })`:

```typescript
/** Short description of what this action does */
actionName: adminProcedure
  .input(z.object({
    displayName: z.string().optional(),
    userId: z.number().optional(),
    amount: z.number().min(0).finite().default(100),
  }))
  .mutation(async ({ input }) => {
    const db = await getDb();
    let userId: number | null = null;
    let userName: string | null = null;

    // Resolve user by ID or display name
    if (input.userId) {
      const user = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (user.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: `User with ID ${input.userId} not found` });
      userId = user[0].id;
      userName = user[0].displayName || user[0].name;
    } else if (input.displayName) {
      const allUsers = await db.select().from(users);
      const match = allUsers.find(u => (u.displayName || u.name) === input.displayName);
      if (!match) throw new TRPCError({ code: "NOT_FOUND", message: `User "${input.displayName}" not found` });
      userId = match.id;
      userName = match.displayName || match.name;
    } else {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Provide either displayName or userId" });
    }

    // Perform the action
    const portfolio = await getOrCreatePortfolio(userId);
    await db.update(portfolios)
      .set({ casinoBalance: input.amount.toFixed(2) })
      .where(eq(portfolios.userId, userId));

    cache.invalidateAll();

    return {
      success: true,
      userId,
      userName,
      previousValue: portfolio.casinoBalance,
      newValue: input.amount.toFixed(2),
    };
  }),
```

For actions that do NOT need a user lookup (e.g., system-wide):

```typescript
systemAction: adminProcedure
  .mutation(async () => {
    const client = getRawClient();

    // Raw SQL for operations not covered by Drizzle schema
    await client.execute(`UPDATE some_table SET field = value WHERE condition`);

    cache.invalidateAll();
    return { success: true, message: "Action completed" };
  }),
```

### Step 2: Add UI to client/src/pages/AdminDB.tsx

Add inside the Quick Actions section:

```tsx
{/* ─── Action Name ─── */}
<div className="bg-card border border-border rounded-xl p-5">
  <div className="flex items-center gap-2 mb-3">
    <IconName className="w-4 h-4 text-primary" />
    <h3 className="text-sm font-bold">Action Title</h3>
  </div>
  <p className="text-xs text-muted-foreground mb-4">
    Description of what this admin action does.
  </p>
  <div className="flex gap-2">
    <div className="flex-1">
      <label className="text-xs text-muted-foreground mb-1 block">User</label>
      <input
        type="text"
        value={actionUser}
        onChange={(e) => setActionUser(e.target.value)}
        placeholder="Display name"
        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
    <div className="w-28">
      <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
      <input
        type="number"
        value={actionAmount}
        onChange={(e) => setActionAmount(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
    <Button
      size="sm"
      onClick={() => actionMutation.mutate({
        displayName: actionUser,
        amount: parseFloat(actionAmount),
      })}
      disabled={!actionUser.trim() || actionMutation.isPending}
      className="h-9 self-end"
    >
      {actionMutation.isPending ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <>
          <IconName className="w-3 h-3 mr-1" />
          Execute
        </>
      )}
    </Button>
  </div>
</div>
```

State and mutation hook to add at the top of the QuickActions component:

```tsx
const [actionUser, setActionUser] = useState("");
const [actionAmount, setActionAmount] = useState("100");

const actionMutation = trpc.admin.actionName.useMutation({
  onSuccess: (data) => {
    toast.success(`${data.userName}: set to $${data.newValue} (was $${data.previousValue})`);
    setActionUser("");
  },
  onError: (err) => toast.error(err.message),
});
```

---

## Quick Reference

### Key File Locations

| What | Path |
|---|---|
| Game engines | `server/{game}.ts` |
| All routers | `server/routers.ts` |
| Game pages | `client/src/pages/{Game}.tsx` |
| Shared components | `client/src/components/` |
| CSS animations | `client/src/index.css` |
| Cosmetic seed data | `server/seedCosmetics.ts` |
| Name effect renderer | `client/src/components/StyledName.tsx` |
| Admin panel | `client/src/pages/AdminDB.tsx` |

### Common Server Imports

```typescript
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, getRawClient } from "./db";
import { portfolios, users } from "./db/schema";
import { getOrCreatePortfolio, checkCasinoCooldown, recordCasinoGame } from "./portfolio";
import { cache } from "./cache";
```

### Common Client Imports

```typescript
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
```

### Cosmetic Pricing Guide

| Tier | Title Price | Name Effect Price |
|---|---|---|
| Common | $5-12 | $10-18 |
| Rare | $28-50 | $35-60 |
| Epic | $85-150 | $120-200 |
| Legendary | $275-500 | $350-500 |
