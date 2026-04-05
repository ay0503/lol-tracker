import { useState, useCallback, memo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Loader2, CircleDot, Diamond } from "lucide-react";
import AppNav from "@/components/AppNav";
import CasinoSubNav from "@/components/CasinoSubNav";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";
import CasinoGameLog from "@/components/CasinoGameLog";
import CasinoBetControls, {
  MAX_CASINO_BET,
  MIN_CASINO_BET,
  parseCasinoBetAmount,
} from "@/components/CasinoBetControls";

const GRID_SIZE = 25;

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
            ? "bg-secondary border-border/60 hover:bg-secondary hover:border-border cursor-pointer"
            : "bg-secondary/50 border-border/30"
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
            {isMine ? <CircleDot className="w-5 h-5 sm:w-6 sm:h-6 text-red-300" /> : <Diamond className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300" />}
          </motion.span>
        ) : (
          <motion.span key="hidden" className="text-muted-foreground text-xs sm:text-sm">
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
        toast.error(language === "ko" ? "지뢰!" : "BOOM!");
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
  const parsedBetAmount = parseCasinoBetAmount(betAmount);

  const handleStart = useCallback(() => {
    const amt = parsedBetAmount;
    if (Number.isNaN(amt) || amt < MIN_CASINO_BET || amt > MAX_CASINO_BET) {
      return toast.error(language === "ko" ? "베팅 금액: $0.10 - $50" : "Bet amount: $0.10 - $50");
    }
    startMutation.mutate({ bet: amt, mineCount });
  }, [language, mineCount, parsedBetAmount]);

  const setupControls = (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">
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
                  : "bg-secondary text-muted-foreground border border-border hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <CasinoBetControls
        language={language}
        value={betAmount}
        cash={cash}
        disabled={isPending}
        onChange={setBetAmount}
      />

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleStart}
        disabled={
          isPending ||
          !isAuthenticated ||
          parsedBetAmount < MIN_CASINO_BET ||
          parsedBetAmount > MAX_CASINO_BET ||
          cash < parsedBetAmount
        }
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-foreground font-bold text-sm hover:from-red-400 hover:to-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg shadow-red-500/15"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
          `${language === "ko" ? "시작" : "START"} · ${mineCount} ${language === "ko" ? "지뢰" : "mines"} · $${parsedBetAmount.toFixed(2)}`}
      </motion.button>
    </motion.div>
  );
  const activePanel = isPlaying && game ? (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-black/20 p-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {language === "ko" ? "현재 배율" : "Current Multiplier"}
        </p>
        <p className="mt-2 text-3xl font-bold font-mono text-foreground">{game.multiplier}x</p>
        <p className="mt-1 text-xs font-mono text-muted-foreground">
          ${(game.bet * game.multiplier).toFixed(2)} · {language === "ko" ? "다음" : "next"} {game.nextMultiplier}x
        </p>
      </div>

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => cashoutMutation.mutate()}
        disabled={isPending}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[color:var(--color-win)] to-emerald-600 text-foreground font-bold text-sm disabled:opacity-40 transition-colors shadow-lg shadow-[color:var(--color-win)]/20"
      >
        {cashoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
          `${language === "ko" ? "캐시아웃" : "CASH OUT"} $${(game.bet * game.multiplier).toFixed(2)}`}
      </motion.button>
    </div>
  ) : null;

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-card via-background to-background">
      <AppNav />
      <CasinoSubNav />
      <div className="container py-8 sm:py-8 max-w-6xl mx-auto px-4">
        

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/25 to-orange-600/15 border border-red-500/20">
              <CircleDot className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground font-[var(--font-heading)]">Mines</h1>
              <p className="text-xs text-muted-foreground font-mono">${cash.toFixed(2)}</p>
            </div>
          </div>
          {isPlaying && game && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/25">
              <span className="text-xs font-mono font-bold text-yellow-400">{game.multiplier}x</span>
            </motion.div>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          {/* Game Area */}
          <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 bg-gradient-to-b from-secondary/80 to-card" />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

            <div className="relative p-4 sm:p-6">
              <div className="mx-auto w-full max-w-[360px] sm:max-w-[390px]">
            {/* Multiplier display */}
                {isPlaying && game && game.revealedTiles.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-4">
                    <div className="lg:hidden">
                      <motion.p key={game.multiplier} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                        className="text-2xl font-bold text-foreground font-mono">
                        {game.multiplier}x
                      </motion.p>
                      <p className="text-xs text-muted-foreground font-mono">
                        ${(game.bet * game.multiplier).toFixed(2)} · {language === "ko" ? "다음" : "next"}: {game.nextMultiplier}x
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Result */}
                <AnimatePresence>
                  {isOver && game && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                      className="text-center mb-4">
                      {game.status === "won" ? (
                        <div>
                          <p className="text-xl font-bold text-[color:var(--color-win)]">
                            {game.multiplier}x · +${game.payout.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">{language === "ko" ? "캐시아웃 성공!" : "Cashed out!"}</p>
                        </div>
                      ) : (
                        <div>
                          <motion.p initial={{ x: [-5, 5, -5, 5, 0] }} animate={{ x: 0 }}
                            className="text-xl font-bold text-[color:var(--color-loss)]">
                            {language === "ko" ? "지뢰!" : "BOOM!"}
                          </motion.p>
                          <p className="text-xs text-muted-foreground">-${game.bet.toFixed(2)}</p>
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
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[color:var(--color-win)] to-emerald-600 text-foreground font-bold text-sm disabled:opacity-40 transition-colors shadow-lg shadow-[color:var(--color-win)]/20 mb-3 lg:hidden"
                  >
                    {cashoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                      `${language === "ko" ? "캐시아웃" : "CASH OUT"} $${(game.bet * game.multiplier).toFixed(2)}`}
                  </motion.button>
                )}

                {(!game || isOver) && <div className="lg:hidden">{setupControls}</div>}
              </div>
            </div>
          </div>

          {(!game || isOver) && (
            <div className="hidden lg:block rounded-2xl border border-border/80 bg-card p-4 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {language === "ko" ? "베팅 패널" : "Bet Panel"}
              </p>
              {setupControls}
            </div>
          )}
          {activePanel && (
            <div className="hidden lg:block rounded-2xl border border-border/80 bg-card p-4 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {language === "ko" ? "현재 라운드" : "Live Round"}
              </p>
              {activePanel}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground/40 mt-4 font-mono">
          {language === "ko" ? "1% 플레이어 우위 · 최대 $250 지급" : "1% player edge · $250 max payout"}
        </p>

        <CasinoGameLog />
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
