import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";
import AppNav from "@/components/AppNav";
import CasinoSubNav from "@/components/CasinoSubNav";
import CasinoBetControls, {
  MAX_CASINO_BET,
  MIN_CASINO_BET,
  parseCasinoBetAmount,
} from "@/components/CasinoBetControls";

function CardFace({ rank, suit }: { rank: number; suit: string }) {
  const label = rank === 14 ? "A" : rank === 13 ? "K" : rank === 12 ? "Q" : rank === 11 ? "J" : String(rank);
  const isRed = suit === "♥" || suit === "♦";
  return (
    <motion.div
      initial={{ rotateY: -90, scale: 0.8 }}
      animate={{ rotateY: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      className="w-24 h-36 sm:w-28 sm:h-40 rounded-xl bg-white border-2 border-zinc-200 shadow-xl flex flex-col items-center justify-center relative"
    >
      <div className={`absolute top-2 left-3 leading-tight ${isRed ? "text-red-500" : "text-gray-800"}`}>
        <div className="text-base font-extrabold">{label}</div>
        <div className="text-sm">{suit}</div>
      </div>
      <div className={`text-4xl ${isRed ? "text-red-500" : "text-gray-800"}`}>{suit}</div>
      <div className={`absolute bottom-2 right-3 leading-tight rotate-180 ${isRed ? "text-red-500" : "text-gray-800"}`}>
        <div className="text-base font-extrabold">{label}</div>
        <div className="text-sm">{suit}</div>
      </div>
    </motion.div>
  );
}

export default function Hilo() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [betAmount, setBetAmount] = useState("0.50");

  const { data: activeGame } = trpc.casino.hilo.active.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30_000 });
  const { data: balance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });

  const startMutation = trpc.casino.hilo.start.useMutation({
    onSuccess: (game) => { utils.casino.hilo.active.setData(undefined, game as any); refetchBalance(); },
    onError: (err) => toast.error(err.message),
  });

  const guessMutation = trpc.casino.hilo.guess.useMutation({
    onSuccess: (game) => {
      utils.casino.hilo.active.setData(undefined, game as any);
      if (game.status === "lost") { toast.error("Wrong guess!"); refetchBalance(); }
      else if (game.status === "won") { toast.success(`All correct! +$${game.payout.toFixed(2)}`); refetchBalance(); }
    },
    onError: (err) => { toast.error(err.message); utils.casino.hilo.active.invalidate(); },
  });

  const cashoutMutation = trpc.casino.hilo.cashout.useMutation({
    onSuccess: (game) => {
      utils.casino.hilo.active.setData(undefined, game as any);
      toast.success(`Cashed out! +$${game.payout.toFixed(2)} (${game.multiplier.toFixed(2)}x)`);
      refetchBalance();
    },
    onError: (err) => toast.error(err.message),
  });

  const game = activeGame;
  const isPlaying = game?.status === "playing";
  const isOver = game && game.status !== "playing";
  const isPending = startMutation.isPending || guessMutation.isPending || cashoutMutation.isPending;
  const cash = balance ?? 20;
  const parsedBetAmount = parseCasinoBetAmount(betAmount);
  const streak = game?.history?.length ?? 0;
  const streakGlow = streak >= 10 ? "ring-2 ring-yellow-400 shadow-lg shadow-yellow-500/30" :
    streak >= 5 ? "ring-2 ring-purple-400 shadow-lg shadow-purple-500/20" :
    streak >= 3 ? "ring-2 ring-blue-400 shadow-md shadow-blue-500/15" : "";

  const handleStart = useCallback(() => {
    if (parsedBetAmount < MIN_CASINO_BET || parsedBetAmount > MAX_CASINO_BET) {
      toast.error(language === "ko" ? "베팅 금액: $0.10 - $50" : "Bet amount: $0.10 - $50");
      return;
    }
    startMutation.mutate({ bet: parsedBetAmount });
  }, [language, parsedBetAmount, startMutation]);

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <AppNav />
      <CasinoSubNav />
      <div className="container py-6 sm:py-8 max-w-lg mx-auto px-4">
        <Link href="/casino" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mb-5">
          <ArrowLeft className="w-3.5 h-3.5" /> Casino
        </Link>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/25 to-indigo-600/15 border border-violet-500/20">
              <span className="text-lg">🃏</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-[var(--font-heading)]">Hi-Lo</h1>
              <p className="text-xs text-zinc-400 font-mono">${cash.toFixed(2)}</p>
            </div>
          </div>
          {isPlaying && game && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/25">
              <span className="text-[11px] font-mono font-bold text-yellow-400">{game.multiplier.toFixed(2)}x</span>
            </motion.div>
          )}
        </div>

        <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a1040] via-[#150d35] to-[#0d0820]" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

          <div className="relative p-4 sm:p-6">
            {/* Card History */}
            {game && game.history.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1 scrollbar-hide">
                {game.history.map((card, idx) => (
                  <div key={idx} className="flex-shrink-0 w-8 h-11 rounded bg-white/10 border border-white/20 flex items-center justify-center">
                    <span className={`text-[10px] font-bold ${card.suit === "♥" || card.suit === "♦" ? "text-red-400" : "text-white"}`}>
                      {card.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Streak Indicator */}
            {isPlaying && streak >= 3 && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center mb-2">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                  streak >= 10 ? "bg-yellow-500/20 text-yellow-400" :
                  streak >= 5 ? "bg-purple-500/20 text-purple-400" :
                  "bg-blue-500/20 text-blue-400"
                }`}>
                  {streak} streak {"🔥".repeat(Math.min(Math.floor(streak / 3), 3))}
                </span>
              </motion.div>
            )}

            {/* Current Card */}
            <div className={`flex justify-center mb-6 min-h-[160px] items-center rounded-2xl transition-all ${streakGlow}`}>
              {game ? (
                <CardFace rank={game.currentCard.rank} suit={game.currentCard.suit} />
              ) : (
                <div className="w-24 h-36 rounded-xl border-2 border-dashed border-violet-500/30 flex items-center justify-center">
                  <span className="text-violet-500/40 text-2xl">?</span>
                </div>
              )}
            </div>

            {/* Result */}
            <AnimatePresence>
              {isOver && game && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="text-center mb-4">
                  {game.status === "won" ? (
                    <p className="text-xl font-bold text-[#00C805]">+${game.payout.toFixed(2)} ({game.multiplier.toFixed(2)}x)</p>
                  ) : (
                    <p className="text-xl font-bold text-[#FF5252]">Wrong! -{game.bet.toFixed(2)}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Controls */}
            {isPlaying ? (
              <div className="space-y-3">
                {/* Guess Buttons */}
                <div className="grid grid-cols-2 gap-2.5">
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                    onClick={() => guessMutation.mutate({ direction: "higher" })}
                    disabled={isPending}
                    className="py-4 rounded-xl bg-[#00C805] text-white font-bold text-sm disabled:opacity-40 flex flex-col items-center gap-1"
                  >
                    <ArrowUp className="w-5 h-5" />
                    <span>Higher ({game.nextHigherMult.toFixed(2)}x)</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                    onClick={() => guessMutation.mutate({ direction: "lower" })}
                    disabled={isPending}
                    className="py-4 rounded-xl bg-[#FF5252] text-white font-bold text-sm disabled:opacity-40 flex flex-col items-center gap-1"
                  >
                    <ArrowDown className="w-5 h-5" />
                    <span>Lower ({game.nextLowerMult.toFixed(2)}x)</span>
                  </motion.button>
                </div>

                {/* Cash Out */}
                {game.history.length > 0 && (
                  <motion.button
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => cashoutMutation.mutate()}
                    disabled={isPending}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold text-sm disabled:opacity-40 shadow-lg"
                  >
                    {cashoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                      `CASH OUT $${(game.bet * game.multiplier).toFixed(2)}`}
                  </motion.button>
                )}

                <p className="text-center text-[9px] text-white/20 font-mono">
                  {game.cardsRemaining} cards remaining
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <CasinoBetControls
                  language={language}
                  value={betAmount}
                  cash={cash}
                  disabled={isPending}
                  onChange={setBetAmount}
                />

                {/* Deal Button */}
                <motion.button
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={handleStart}
                  disabled={
                    isPending ||
                    !isAuthenticated ||
                    parsedBetAmount < MIN_CASINO_BET ||
                    parsedBetAmount > MAX_CASINO_BET ||
                    cash < parsedBetAmount
                  }
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-bold text-sm disabled:opacity-30 transition-colors shadow-lg"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                    `${language === "ko" ? "딜" : "DEAL"} · $${parsedBetAmount.toFixed(2)}`}
                </motion.button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-[9px] text-zinc-700 mt-4 font-mono">
          {language === "ko" ? "1% 플레이어 우위 · 최대 $250 지급" : "1% player edge · $250 max payout"}
        </p>
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
