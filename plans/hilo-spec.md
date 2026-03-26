# Hilo (High/Low) Card Game - Complete Implementation Spec

**Game Type:** Stateful Multi-Action (Mines pattern)
**Estimated Time:** 4 hours
**House Edge:** 2%
**Max Payout:** $250

---

## Game Rules

### Core Mechanics
1. **Start:** Player places bet ($0.10 - $5), one card is dealt face up
2. **Each Round:** Player guesses if NEXT card is Higher, Lower, or Same
3. **Correct Guess:** Multiplier increases based on probability. Player can cash out or continue.
4. **Wrong Guess:** Lose bet, game ends
5. **Equal Cards:** If current and next card have the same rank (e.g., 7 and 7), both "Higher" and "Lower" count as wins. "Same" pays out the higher multiplier.
6. **Cash Out:** After any successful guess, player can cash out for current multiplier × bet

### Ace Handling
- Ace can be treated as either:
  - **Low (1):** Lowest card
  - **High (14):** Highest card
- Player chooses interpretation at game start (stored in game state)
- Default: **Ace is High (14)**

### Multiplier Calculation
Based on remaining cards in deck that satisfy the guess:

```
For "Higher" or "Lower":
  winningCards = count of remaining cards that match the guess
  totalRemaining = cards left in deck
  probability = winningCards / totalRemaining
  multiplier = (1 / probability) × (1 - HOUSE_EDGE)

For "Same":
  probability = (count of matching rank cards left) / totalRemaining
  multiplier = (1 / probability) × (1 - HOUSE_EDGE)
```

### Card Comparison Logic
```typescript
// Rank values (with Ace high by default)
const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// If Ace is low:
// 'A': 1

// Equal rank case:
if (nextValue === currentValue) {
  // "Higher" wins, "Lower" wins, "Same" pays best multiplier
}
```

---

## Server Implementation: `server/hilo.ts`

### Complete File

```typescript
/**
 * Hilo (High/Low) card game engine — server-side logic.
 * Stateful: player draws cards one at a time, guessing higher/lower.
 * 2% house edge. Max payout $250.
 */

const HOUSE_EDGE = 0.02;
const MAX_PAYOUT = 250;

// Standard 52-card deck: 4 suits × 13 ranks
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
const SUITS = ['♠', '♥', '♦', '♣'] as const;

type Rank = typeof RANKS[number];
type Suit = typeof SUITS[number];

interface Card {
  rank: Rank;
  suit: Suit;
}

export type GuessDirection = 'higher' | 'lower' | 'same';

export interface HiloGame {
  id: string;
  userId: number;
  bet: number;
  deck: Card[];
  currentCard: Card;
  history: Card[]; // Previously revealed cards
  aceIsHigh: boolean;
  status: "playing" | "won" | "lost";
  multiplier: number;
  payout: number;
  createdAt: number;
}

export interface PublicHiloGame {
  id: string;
  userId: number;
  bet: number;
  currentCard: Card;
  history: Card[];
  aceIsHigh: boolean;
  deckRemaining: number;
  status: "playing" | "won" | "lost";
  multiplier: number;
  nextMultipliers: {
    higher: number;
    lower: number;
    same: number;
  };
  payout: number;
}

const activeGames = new Map<number, HiloGame>();

// ─── Deck Management ───

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ─── Card Value Logic ───

function getRankValue(rank: Rank, aceIsHigh: boolean): number {
  const values: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': aceIsHigh ? 14 : 1,
  };
  return values[rank];
}

function countMatchingCards(deck: Card[], targetValue: number, currentRank: Rank, direction: GuessDirection, aceIsHigh: boolean): number {
  if (direction === 'same') {
    // Count cards with same rank
    return deck.filter(c => c.rank === currentRank).length;
  }

  return deck.filter(card => {
    const cardValue = getRankValue(card.rank, aceIsHigh);
    if (direction === 'higher') return cardValue > targetValue;
    if (direction === 'lower') return cardValue < targetValue;
    return false;
  }).length;
}

// ─── Multiplier Calculation ───

function calculateNextMultipliers(game: HiloGame): { higher: number; lower: number; same: number } {
  const currentValue = getRankValue(game.currentCard.rank, game.aceIsHigh);
  const remaining = game.deck.length;

  if (remaining === 0) {
    return { higher: 0, lower: 0, same: 0 };
  }

  const higherCount = countMatchingCards(game.deck, currentValue, game.currentCard.rank, 'higher', game.aceIsHigh);
  const lowerCount = countMatchingCards(game.deck, currentValue, game.currentCard.rank, 'lower', game.aceIsHigh);
  const sameCount = countMatchingCards(game.deck, currentValue, game.currentCard.rank, 'same', game.aceIsHigh);

  const calcMult = (count: number) => {
    if (count === 0) return 0;
    return (remaining / count) * (1 - HOUSE_EDGE);
  };

  return {
    higher: Math.round(calcMult(higherCount) * 100) / 100,
    lower: Math.round(calcMult(lowerCount) * 100) / 100,
    same: Math.round(calcMult(sameCount) * 100) / 100,
  };
}

// ─── Game State Helpers ───

function gameToPublic(game: HiloGame): PublicHiloGame {
  const nextMultipliers = game.status === "playing"
    ? calculateNextMultipliers(game)
    : { higher: 0, lower: 0, same: 0 };

  return {
    id: game.id,
    userId: game.userId,
    bet: game.bet,
    currentCard: game.currentCard,
    history: game.history,
    aceIsHigh: game.aceIsHigh,
    deckRemaining: game.deck.length,
    status: game.status,
    multiplier: Math.round(game.multiplier * 100) / 100,
    nextMultipliers,
    payout: Math.round(game.payout * 100) / 100,
  };
}

// ─── Game Actions ───

export function startGame(userId: number, bet: number, aceIsHigh: boolean = true): PublicHiloGame {
  activeGames.delete(userId); // Clean up any existing game

  const deck = shuffleDeck(createDeck());
  const currentCard = deck.pop()!;

  const game: HiloGame = {
    id: `hilo_${Date.now()}_${userId}`,
    userId,
    bet,
    deck,
    currentCard,
    history: [],
    aceIsHigh,
    status: "playing",
    multiplier: 1,
    payout: 0,
    createdAt: Date.now(),
  };

  activeGames.set(userId, game);
  return gameToPublic(game);
}

export function guess(userId: number, direction: GuessDirection): PublicHiloGame {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");
  if (game.deck.length === 0) throw new Error("Deck exhausted — cash out");

  const nextCard = game.deck.pop()!;
  const currentValue = getRankValue(game.currentCard.rank, game.aceIsHigh);
  const nextValue = getRankValue(nextCard.rank, game.aceIsHigh);

  let correct = false;

  if (direction === 'same') {
    // Exact rank match
    correct = nextValue === currentValue;
  } else if (nextValue === currentValue) {
    // Equal cards: both "higher" and "lower" win
    if (direction === 'higher' || direction === 'lower') correct = true;
  } else {
    // Normal comparison
    correct = (direction === 'higher' && nextValue > currentValue) ||
              (direction === 'lower' && nextValue < currentValue);
  }

  if (!correct) {
    game.status = "lost";
    game.payout = 0;
    game.multiplier = 0;
  } else {
    // Calculate the multiplier BEFORE this guess (used for updating game.multiplier)
    const mults = calculateNextMultipliers(game);
    const earnedMultiplier = mults[direction];

    game.history.push(game.currentCard);
    game.currentCard = nextCard;
    game.multiplier = earnedMultiplier;

    // Auto-win if deck exhausted
    if (game.deck.length === 0) {
      game.status = "won";
      game.payout = Math.min(game.bet * game.multiplier, MAX_PAYOUT);
    }
  }

  return gameToPublic(game);
}

export function cashOut(userId: number): PublicHiloGame {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");
  if (game.history.length === 0) throw new Error("Make at least one guess before cashing out");

  game.status = "won";
  game.payout = Math.min(game.bet * game.multiplier, MAX_PAYOUT);
  return gameToPublic(game);
}

export function getActiveGame(userId: number): PublicHiloGame | null {
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

## Router Integration: `server/routers.ts`

### Add to `casino: router({ ... })`

```typescript
hilo: router({
  start: protectedProcedure
    .input(z.object({
      bet: z.number().min(0.10).max(5).finite(),
      aceIsHigh: z.boolean().default(true),
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
      const { startGame } = await import("./hilo");
      try {
        const game = startGame(ctx.user.id, input.bet, input.aceIsHigh);
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

  guess: protectedProcedure
    .input(z.object({
      direction: z.enum(['higher', 'lower', 'same']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { guess } = await import("./hilo");
      try {
        const game = guess(ctx.user.id, input.direction);

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
    const { cashOut } = await import("./hilo");
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
    const { getActiveGame } = await import("./hilo");
    return getActiveGame(ctx.user.id);
  }),
}),
```

---

## Client Implementation: `client/src/pages/Hilo.tsx`

### Complete File

```typescript
import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus, DollarSign } from "lucide-react";
import AppNav from "@/components/AppNav";
import CasinoSubNav from "@/components/CasinoSubNav";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";

// ─── Types ───
interface Card {
  suit: string;
  rank: string;
}

// ─── Chip Values & Colors ───
const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0.10: { bg: "from-blue-400 to-blue-600", border: "border-blue-300/50", text: "text-white" },
  0.25: { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", text: "text-white" },
  0.50: { bg: "from-red-400 to-red-600", border: "border-red-300/50", text: "text-white" },
  1:    { bg: "from-gray-100 to-gray-300", border: "border-gray-200/50", text: "text-gray-800" },
  2:    { bg: "from-pink-400 to-pink-600", border: "border-pink-300/50", text: "text-white" },
  5:    { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50", text: "text-black" },
};

// ─── Card Display Component ───
function CardDisplay({ card, index = 0, isNew = false }: { card: Card; index?: number; isNew?: boolean }) {
  const isRed = card.suit === "♥" || card.suit === "♦";

  return (
    <motion.div
      initial={isNew ? { rotateY: -180, opacity: 0, x: 60, scale: 0.7 } : { rotateY: -90, opacity: 0, x: 20 }}
      animate={{ rotateY: 0, opacity: 1, x: 0, scale: 1 }}
      exit={{ rotateY: 90, opacity: 0, x: -20, scale: 0.8 }}
      transition={{ delay: index * 0.2, duration: 0.5, type: "spring", stiffness: 150, damping: 15 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className="w-[4.75rem] h-[6.75rem] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.15)] relative overflow-hidden select-none flex-shrink-0"
      style={{ zIndex: index }}
    >
      {/* Top-left */}
      <div className={`absolute top-1 left-1.5 leading-tight ${isRed ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}>
        <div className="text-sm font-extrabold font-[var(--font-heading)] leading-none">{card.rank}</div>
        <div className="text-xs leading-none">{card.suit}</div>
      </div>
      {/* Center */}
      <div className={`absolute inset-0 flex items-center justify-center ${isRed ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}>
        <span className="text-3xl drop-shadow-sm">{card.suit}</span>
      </div>
      {/* Bottom-right */}
      <div className={`absolute bottom-1 right-1.5 leading-tight rotate-180 ${isRed ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}>
        <div className="text-sm font-extrabold font-[var(--font-heading)] leading-none">{card.rank}</div>
        <div className="text-xs leading-none">{card.suit}</div>
      </div>
      {/* Shine */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-white/5 to-transparent pointer-events-none rounded-lg" />
    </motion.div>
  );
}

export default function Hilo() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();

  // ─── State ───
  const [selectedChip, setSelectedChip] = useState(0.50);
  const [aceIsHigh, setAceIsHigh] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  // ─── Queries ───
  const balance = trpc.portfolio.balances.useQuery(undefined, { enabled: isAuthenticated });
  const activeGame = trpc.casino.hilo.active.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: false,
  });
  const utils = trpc.useUtils();

  // ─── Mutations ───
  const startMutation = trpc.casino.hilo.start.useMutation({
    onSuccess: () => {
      utils.portfolio.balances.invalidate();
      utils.casino.hilo.active.invalidate();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setIsStarting(false),
  });

  const guessMutation = trpc.casino.hilo.guess.useMutation({
    onSuccess: (data) => {
      utils.casino.hilo.active.invalidate();
      utils.portfolio.balances.invalidate();
      if (data.status === "won") {
        toast.success(`Won $${data.payout.toFixed(2)}!`);
      } else if (data.status === "lost") {
        toast.error("Wrong guess! Game over.");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const cashoutMutation = trpc.casino.hilo.cashout.useMutation({
    onSuccess: (data) => {
      utils.casino.hilo.active.invalidate();
      utils.portfolio.balances.invalidate();
      toast.success(`Cashed out $${data.payout.toFixed(2)}!`);
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── Handlers ───
  const handleStart = useCallback(() => {
    if (!isAuthenticated) {
      toast.error("Sign in to play");
      return;
    }
    setIsStarting(true);
    startMutation.mutate({ bet: selectedChip, aceIsHigh });
  }, [isAuthenticated, selectedChip, aceIsHigh, startMutation]);

  const handleGuess = useCallback((direction: 'higher' | 'lower' | 'same') => {
    guessMutation.mutate({ direction });
  }, [guessMutation]);

  const handleCashout = useCallback(() => {
    cashoutMutation.mutate();
  }, [cashoutMutation]);

  const casinoCash = balance.data?.casinoBalance ?? 20;
  const game = activeGame.data;
  const isPlaying = game?.status === "playing";
  const isLoading = guessMutation.isPending || cashoutMutation.isPending || isStarting;

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
            <h1 className="text-xl font-bold">
              {language === "ko" ? "하이로" : "Hilo"}
            </h1>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg">
            <span className="text-xs text-zinc-400">
              {language === "ko" ? "잔고" : "Casino Cash"}
            </span>
            <span className="font-bold text-green-400">${casinoCash.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">

        {/* ─── Game Area ─── */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 min-h-[500px]">
          <AnimatePresence mode="wait">
            {!isPlaying ? (
              // ─── Start Screen ───
              <motion.div
                key="start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-[450px] space-y-6"
              >
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-bold mb-2">
                    {language === "ko" ? "하이로 게임" : "Hilo Game"}
                  </h2>
                  <p className="text-sm text-zinc-400 max-w-md">
                    {language === "ko"
                      ? "카드를 뽑고 다음 카드가 높을지 낮을지 맞춰보세요. 언제든 캐시아웃 가능!"
                      : "Guess if the next card is higher or lower. Cash out anytime!"}
                  </p>
                </div>

                {/* Ace Setting */}
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 w-full max-w-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-zinc-300">
                      {language === "ko" ? "에이스 설정" : "Ace Setting"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setAceIsHigh(true)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                        aceIsHigh
                          ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700/50 hover:text-white"
                      }`}
                    >
                      {language === "ko" ? "높음 (14)" : "High (14)"}
                    </button>
                    <button
                      onClick={() => setAceIsHigh(false)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                        !aceIsHigh
                          ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700/50 hover:text-white"
                      }`}
                    >
                      {language === "ko" ? "낮음 (1)" : "Low (1)"}
                    </button>
                  </div>
                </div>

                {/* Chip Selector */}
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 w-full max-w-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-zinc-300">
                      {language === "ko" ? "베팅 선택" : "Select Bet"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {language === "ko" ? "잔고" : "Balance"}: ${casinoCash.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
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

                <button
                  onClick={handleStart}
                  disabled={isLoading || !isAuthenticated}
                  className="w-full max-w-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-zinc-700 disabled:to-zinc-800 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg disabled:shadow-none"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {language === "ko" ? "시작 중..." : "Starting..."}
                    </span>
                  ) : (
                    `${language === "ko" ? "게임 시작" : "Start Game"} - $${selectedChip.toFixed(2)}`
                  )}
                </button>
              </motion.div>
            ) : (
              // ─── Playing Screen ───
              <motion.div
                key="playing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Stats Bar */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-center">
                    <div className="text-xs text-zinc-500 mb-1">
                      {language === "ko" ? "배팅" : "Bet"}
                    </div>
                    <div className="text-lg font-bold text-white">${game.bet.toFixed(2)}</div>
                  </div>
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-center">
                    <div className="text-xs text-zinc-500 mb-1">
                      {language === "ko" ? "배수" : "Multiplier"}
                    </div>
                    <div className="text-lg font-bold text-yellow-400">{game.multiplier.toFixed(2)}x</div>
                  </div>
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-center">
                    <div className="text-xs text-zinc-500 mb-1">
                      {language === "ko" ? "남은 카드" : "Cards Left"}
                    </div>
                    <div className="text-lg font-bold text-cyan-400">{game.deckRemaining}</div>
                  </div>
                </div>

                {/* Current Card */}
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-sm text-zinc-400">
                    {language === "ko" ? "현재 카드" : "Current Card"}
                  </div>
                  <CardDisplay card={game.currentCard} isNew={true} />
                </div>

                {/* Guess Buttons */}
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleGuess('lower')}
                    disabled={isLoading || game.nextMultipliers.lower === 0}
                    className="bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-zinc-700 disabled:to-zinc-800 disabled:cursor-not-allowed text-white font-bold py-6 rounded-xl transition-all shadow-lg disabled:shadow-none flex flex-col items-center gap-2"
                  >
                    <TrendingDown className="w-6 h-6" />
                    <span>{language === "ko" ? "낮음" : "Lower"}</span>
                    {game.nextMultipliers.lower > 0 && (
                      <span className="text-xs opacity-80">{game.nextMultipliers.lower.toFixed(2)}x</span>
                    )}
                  </button>
                  <button
                    onClick={() => handleGuess('same')}
                    disabled={isLoading || game.nextMultipliers.same === 0}
                    className="bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 disabled:from-zinc-700 disabled:to-zinc-800 disabled:cursor-not-allowed text-white font-bold py-6 rounded-xl transition-all shadow-lg disabled:shadow-none flex flex-col items-center gap-2"
                  >
                    <Minus className="w-6 h-6" />
                    <span>{language === "ko" ? "같음" : "Same"}</span>
                    {game.nextMultipliers.same > 0 && (
                      <span className="text-xs opacity-80">{game.nextMultipliers.same.toFixed(2)}x</span>
                    )}
                  </button>
                  <button
                    onClick={() => handleGuess('higher')}
                    disabled={isLoading || game.nextMultipliers.higher === 0}
                    className="bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 disabled:from-zinc-700 disabled:to-zinc-800 disabled:cursor-not-allowed text-white font-bold py-6 rounded-xl transition-all shadow-lg disabled:shadow-none flex flex-col items-center gap-2"
                  >
                    <TrendingUp className="w-6 h-6" />
                    <span>{language === "ko" ? "높음" : "Higher"}</span>
                    {game.nextMultipliers.higher > 0 && (
                      <span className="text-xs opacity-80">{game.nextMultipliers.higher.toFixed(2)}x</span>
                    )}
                  </button>
                </div>

                {/* Cash Out Button */}
                {game.history.length > 0 && (
                  <button
                    onClick={handleCashout}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <DollarSign className="w-5 h-5" />
                    {language === "ko" ? "캐시아웃" : "Cash Out"} - ${(game.bet * game.multiplier).toFixed(2)}
                  </button>
                )}

                {/* Card History */}
                {game.history.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider">
                      {language === "ko" ? "히스토리" : "History"} ({game.history.length})
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {game.history.map((card, i) => (
                        <CardDisplay key={i} card={card} index={i} />
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Game Over Display ─── */}
        {game && game.status !== "playing" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border ${
              game.status === "won"
                ? "bg-green-950/50 border-green-700/50"
                : "bg-red-950/50 border-red-700/50"
            }`}
          >
            <div className="text-center">
              <div className="text-sm font-bold mb-1">
                {game.status === "won"
                  ? (language === "ko" ? "승리!" : "You Won!")
                  : (language === "ko" ? "패배" : "Game Over")}
              </div>
              <div className="text-lg font-bold text-white">
                ${game.payout.toFixed(2)}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Disclaimer ─── */}
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
```

---

## Integration

### 1. App.tsx Route

Add to lazy imports:
```typescript
const Hilo = lazy(() => import("./pages/Hilo"));
```

Add to `<Switch>`:
```typescript
<Route path={"/casino/hilo"} component={Hilo} />
```

### 2. Casino.tsx GAMES Entry

Add to `GAMES` array in `/client/src/pages/Casino.tsx`:
```typescript
{
  id: "hilo",
  title: "Hilo",
  titleKo: "하이로",
  emoji: "🎴",
  desc: "Higher or Lower?",
  descKo: "높을까? 낮을까?",
  bet: "$0.10 – $5",
  href: "/casino/hilo",
  active: true,
  bg: "from-violet-950/50 to-purple-900/30",
  border: "border-violet-700/40",
  badge: "from-violet-500 to-purple-600"
},
```

---

## Testing Checklist

### Server Logic
- [ ] Deck shuffles randomly (52 cards)
- [ ] Ace high/low setting respected
- [ ] Multiplier calculation correct for all three directions
- [ ] Equal cards: both higher/lower win
- [ ] Same guess: only exact rank match wins
- [ ] Max payout cap ($250) enforced
- [ ] Stale game cleanup (30 min)
- [ ] Error handling: no active game, deck exhausted

### Client UI
- [ ] Chip selector disabled if insufficient balance
- [ ] Ace toggle works (high/low)
- [ ] Start game deducts bet
- [ ] Card display animation smooth
- [ ] Guess buttons show next multipliers
- [ ] Guess buttons disabled if probability = 0
- [ ] Cash out button only shows after first guess
- [ ] Cash out button shows correct payout
- [ ] Game over message displays correctly
- [ ] Balance updates after win/loss

### Router Integration
- [ ] Cooldown check enforced
- [ ] Balance check before start
- [ ] Refund on error
- [ ] Payout credited on win
- [ ] Leaderboard cache invalidated

---

## Design Rationale

### Equal Card Handling
When current and next card have the same rank (e.g., 7♠ and 7♥):
- **Problem:** Strict "higher" or "lower" would make both lose
- **Solution:** Both "higher" and "lower" count as wins for fairness
- **"Same" bet:** Still requires exact rank match, pays higher multiplier

### Multiplier Formula
```
P(win) = (winning cards) / (remaining cards)
Base multiplier = 1 / P(win)
House edge multiplier = base × (1 - 0.02)
```

Example:
- Current card: 7
- Deck remaining: 40 cards (12 deck draws)
- Cards > 7: 24 (8, 9, T, J, Q, K, A × 4 - already drawn)
- P(higher) = 24/40 = 0.6
- Multiplier = (1/0.6) × 0.98 = 1.63x

### Max Payout
$250 cap prevents:
- Extreme multipliers from long streaks
- Balance inflation
- Matches other stateful games (Mines: $5000 cap with higher bets)

---

## Time Breakdown

1. **Server Implementation (60 min)**
   - Deck creation, shuffling, card comparison logic
   - Multiplier calculation with probability math
   - Game state management (Map-based)
   - Edge cases (equal cards, deck exhaustion)

2. **Client UI (120 min)**
   - Start screen (chip selector, ace toggle)
   - Playing screen (card display, guess buttons)
   - Multiplier display per direction
   - Card history strip
   - Cash out button with dynamic payout
   - Game over screen

3. **Integration & Testing (60 min)**
   - Router setup with balance/cooldown checks
   - App.tsx route
   - Casino.tsx entry
   - Manual testing (edge cases, animations)

**Total: 4 hours**

---

## Future Enhancements (Optional)

1. **Statistics Display**
   - Win streak counter
   - Longest streak this session
   - Best multiplier achieved

2. **Auto-cashout Setting**
   - Set target multiplier to auto-cashout

3. **Card Animation Variants**
   - Different card back designs
   - Flip animation variants

4. **Sound Effects**
   - Card flip sound
   - Win/loss chimes

5. **Multiplayer Leaderboard**
   - Longest streak globally
   - Highest multiplier achieved
