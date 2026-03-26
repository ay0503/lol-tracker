import { useState, useCallback, memo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";

const GRID_SIZE = 25;

const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0.10: { bg: "from-blue-400 to-blue-600", border: "border-blue-300/50", text: "text-white" },
  0.25: { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", text: "text-white" },
  0.50: { bg: "from-red-400 to-red-600", border: "border-red-300/50", text: "text-white" },
  1: { bg: "from-gray-100 to-gray-300", border: "border-gray-200/50", text: "text-gray-800" },
  2: { bg: "from-pink-400 to-pink-600", border: "border-pink-300/50", text: "text-white" },
  5: { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50", text: "text-black" },
};

const MINE_PRESETS = [1, 3, 5, 10, 15, 20, 24];

const Tile = memo(function Tile({
  index, revealed, isMine, isSafe, isPlaying, onClick, disabled,
}: {
  index: number; revealed: boolean; isMine: boolean; isSafe: boolean;
  isPlaying: boolean; onClick: () => void; disabled: boolean;
}) {
  return (
    <motion.button
      whileHover={!revealed && isPlaying && !disabled ? { scale: 1.05 } : {}}
      whileTap={!revealed && isPlaying && !disabled ? { scale: 0.95 } : {}}
      onClick={onClick}
      disabled={revealed || !isPlaying || disabled}
      className={`aspect-square rounded-lg font-bold text-lg transition-all relative overflow-hidden ${
        revealed
          ? isMine
            ? "bg-red-600/80 border-red-500/60 shadow-red-500/20 shadow-lg"
            : "bg-emerald-600/30 border-emerald-500/40"
          : isPlaying
            ? "bg-zinc-800 border-zinc-700/60 hover:bg-zinc-700 hover:border-zinc-600 cursor-pointer"
            : "bg-zinc-800/50 border-zinc-700/30"
      } border`}
    >
      <AnimatePresence mode="wait">
        {revealed ? (
          <motion.span
            key="revealed"
            initial={{ rotateY: 90, scale: 0.5 }}
            animate={{ rotateY: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="text-xl sm:text-2xl"
          >
            {isMine ? "💣" : "💎"}
          </motion.span>
        ) : (
          <motion.span key="hidden" className="text-zinc-600 text-xs sm:text-sm">
            ?
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
});

export default function Mines() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState("0.50");
  const [mineCount, setMineCount] = useState(3);
  const utils = trpc.useUtils();

  const { data: activeGame } = trpc.casino.mines.active.useQuery(undefined, {
    enabled: isAuthenticated, staleTime: 30_000,
  });
  const { data: casinoBalance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const startMutation = trpc.casino.mines.start.useMutation({
    onSuccess: (game) => {
      utils.casino.mines.active.setData(undefined, game as any);
      refetchBalance();
    },
    onError: (err) => toast.error(err.message),
  });

  const revealMutation = trpc.casino.mines.reveal.useMutation({
    onSuccess: (game) => {
      utils.casino.mines.active.setData(undefined, game as any);
      if (game.status === "lost") {
        toast.error(language === "ko" ? "지뢰! 💣" : "BOOM! 💣");
        refetchBalance();
      } else if (game.status === "won") {
        toast.success(`${language === "ko" ? "전부 찾았다!" : "All gems found!"} +$${game.payout.toFixed(2)}`);
        refetchBalance();
      }
    },
    onError: (err) => { toast.error(err.message); utils.casino.mines.active.invalidate(); },
  });

  const cashoutMutation = trpc.casino.mines.cashout.useMutation({
    onSuccess: (game) => {
      utils.casino.mines.active.setData(undefined, game as any);
      toast.success(`${language === "ko" ? "캐시아웃!" : "Cashed out!"} +$${game.payout.toFixed(2)} (${game.multiplier}x)`);
      refetchBalance();
    },
    onError: (err) => toast.error(err.message),
  });

  const game = activeGame;
  const isPlaying = game?.status === "playing";
  const isOver = game && game.status !== "playing";
  const isPending = startMutation.isPending || revealMutation.isPending || cashoutMutation.isPending;
  const cash = casinoBalance ?? 20;

  const handleStart = useCallback(() => {
    const amt = parseFloat(betAmount);
    if (isNaN(amt) || amt < 0.10 || amt > 5) return toast.error("Bet $0.10–$5.00");
    startMutation.mutate({ bet: amt, mineCount });
  }, [betAmount, mineCount]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <div className="container py-6 sm:py-8 max-w-lg mx-auto">
        <Link href="/casino" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mb-5">
          <ArrowLeft className="w-3.5 h-3.5" /> Casino
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/25 to-orange-600/15 border border-red-500/20">
              <span className="text-lg">💣</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-[var(--font-heading)]">Mines</h1>
              <p className="text-xs text-zinc-400 font-mono">${cash.toFixed(2)}</p>
            </div>
          </div>
          {isPlaying && game && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/25">
              <span className="text-[11px] font-mono font-bold text-yellow-400">{game.multiplier}x</span>
            </motion.div>
          )}
        </div>

        {/* Game Area */}
        <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/80 to-zinc-900" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

          <div className="relative p-4 sm:p-6">
            {/* Multiplier display */}
            {isPlaying && game && game.revealedTiles.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-4">
                <motion.p key={game.multiplier} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                  className="text-2xl font-bold text-white font-mono">
                  {game.multiplier}x
                </motion.p>
                <p className="text-[10px] text-zinc-500 font-mono">
                  ${(game.bet * game.multiplier).toFixed(2)} · {language === "ko" ? "다음" : "next"}: {game.nextMultiplier}x
                </p>
              </motion.div>
            )}

            {/* Result */}
            <AnimatePresence>
              {isOver && game && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  className="text-center mb-4">
                  {game.status === "won" ? (
                    <div>
                      <p className="text-xl font-bold text-[#00C805]">
                        {game.multiplier}x · +${game.payout.toFixed(2)}
                      </p>
                      <p className="text-xs text-zinc-400">{language === "ko" ? "캐시아웃 성공!" : "Cashed out!"}</p>
                    </div>
                  ) : (
                    <div>
                      <motion.p initial={{ x: [-5, 5, -5, 5, 0] }} animate={{ x: 0 }}
                        className="text-xl font-bold text-[#FF5252]">
                        💣 {language === "ko" ? "지뢰!" : "BOOM!"}
                      </motion.p>
                      <p className="text-xs text-zinc-400">-${game.bet.toFixed(2)}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Grid */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-4">
              {Array.from({ length: GRID_SIZE }).map((_, i) => {
                const isRevealed = game?.revealedTiles.includes(i) || false;
                const isMine = (isOver && game?.minePositions?.includes(i)) || false;
                const isSafe = isRevealed && !isMine;
                return (
                  <Tile
                    key={i}
                    index={i}
                    revealed={isRevealed || (isOver && game?.minePositions?.includes(i)) || false}
                    isMine={isMine || (isOver && game?.minePositions?.includes(i)) || false}
                    isSafe={isSafe}
                    isPlaying={isPlaying || false}
                    onClick={() => revealMutation.mutate({ position: i })}
                    disabled={isPending}
                  />
                );
              })}
            </div>

            {/* Cash Out button */}
            {isPlaying && game && game.revealedTiles.length > 0 && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => cashoutMutation.mutate()}
                disabled={isPending}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#00C805] to-emerald-600 text-white font-bold text-sm disabled:opacity-40 transition-colors shadow-lg shadow-[#00C805]/20 mb-3"
              >
                {cashoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                  `${language === "ko" ? "캐시아웃" : "CASH OUT"} $${(game.bet * game.multiplier).toFixed(2)}`}
              </motion.button>
            )}

            {/* Controls */}
            {(!game || isOver) && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {/* Mine count selector */}
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-2">
                    {language === "ko" ? "지뢰 수" : "Mines"}: {mineCount}
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {MINE_PRESETS.map(m => (
                      <button
                        key={m}
                        onClick={() => setMineCount(m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                          mineCount === m
                            ? "bg-red-500/20 text-red-400 border border-red-500/40"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chips */}
                <div className="flex gap-1.5 justify-center">
                  {[0.10, 0.25, 0.50, 1, 2, 5].map(amt => {
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
                            ? `bg-gradient-to-b ${colors.bg} ${colors.text} ${colors.border} ring-2 ring-white/40 ring-offset-1 ring-offset-zinc-900 shadow-lg`
                            : `bg-gradient-to-b ${colors.bg} ${colors.text} ${colors.border} opacity-70 hover:opacity-100`
                        }`}
                      >
                        {label}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Start */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStart}
                  disabled={isPending || !isAuthenticated || cash < parseFloat(betAmount || "0")}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-sm hover:from-red-400 hover:to-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg shadow-red-500/15"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                    `${language === "ko" ? "시작" : "START"} · ${mineCount} ${language === "ko" ? "지뢰" : "mines"} · $${parseFloat(betAmount || "0").toFixed(2)}`}
                </motion.button>
              </motion.div>
            )}
          </div>
        </div>

        <p className="text-center text-[9px] text-zinc-700 mt-4 font-mono">
          {language === "ko" ? "2% 하우스 엣지 · 최대 $250 지급" : "2% house edge · $250 max payout"}
        </p>

        <GamblingDisclaimer />
      </div>
    </div>
  );
}
