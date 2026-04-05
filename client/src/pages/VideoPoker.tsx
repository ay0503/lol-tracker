import { useState, useCallback, memo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";
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

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["", "", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SUIT_COLORS: Record<string, boolean> = { "♥": true, "♦": true };

const PAY_TABLE = [
  { hand: "Royal Flush", payout: "250x" },
  { hand: "Straight Flush", payout: "50x" },
  { hand: "Four of a Kind", payout: "25x" },
  { hand: "Full House", payout: "9x" },
  { hand: "Flush", payout: "5x" },
  { hand: "Straight", payout: "4x" },
  { hand: "Three of a Kind", payout: "3x" },
  { hand: "Two Pair", payout: "2x" },
  { hand: "Tens or Better", payout: "1x" },
];

function cardDisplay(card: { rank: number; suit: number }) {
  return { rank: RANKS[card.rank] || "?", suit: SUITS[card.suit] || "?", isRed: card.suit === 1 || card.suit === 2 };
}

const PokerCard = memo(function PokerCard({
  card, held, onClick, index, isNew, canHold
}: {
  card: { rank: number; suit: number }; held: boolean; onClick: () => void;
  index: number; isNew: boolean; canHold: boolean;
}) {
  const { rank, suit, isRed } = cardDisplay(card);
  return (
    <motion.div
      initial={isNew ? { rotateY: -180, opacity: 0, y: -20 } : { rotateY: -90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1, y: held ? -8 : 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 18, delay: index * 0.12 }}
      onClick={canHold ? onClick : undefined}
      className={`relative w-[4rem] h-[5.5rem] sm:w-[5rem] sm:h-[7rem] rounded-lg border bg-white dark:bg-card shadow-lg select-none flex-shrink-0 transition-all ${
        canHold ? "cursor-pointer hover:shadow-xl" : ""
      } ${held ? "ring-2 ring-yellow-400 shadow-yellow-400/20" : "border-border dark:border-border"}`}
    >
      {/* Top-left */}
      <div className={`absolute top-1 left-1.5 leading-tight ${isRed ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}>
        <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">{rank}</div>
        <div className="text-xs sm:text-xs leading-none">{suit}</div>
      </div>
      {/* Center */}
      <div className={`absolute inset-0 flex items-center justify-center ${isRed ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}>
        <span className="text-xl sm:text-2xl">{suit}</span>
      </div>
      {/* Bottom-right */}
      <div className={`absolute bottom-1 right-1.5 leading-tight rotate-180 ${isRed ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}>
        <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">{rank}</div>
        <div className="text-xs sm:text-xs leading-none">{suit}</div>
      </div>
      {/* HELD badge */}
      <AnimatePresence>
        {held && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-xs font-bold bg-yellow-500 text-black tracking-wider">
            HELD
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default function VideoPoker() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState("0.50");
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false]);
  const utils = trpc.useUtils();

  const { data: activeGame } = trpc.casino.poker.active.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30_000 });
  const { data: casinoBalance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });

  const dealMutation = trpc.casino.poker.deal.useMutation({
    onSuccess: (game) => {
      utils.casino.poker.active.setData(undefined, game as any);
      setHeld([false, false, false, false, false]);
      refetchBalance();
    },
    onError: (err) => toast.error(err.message),
  });

  const drawMutation = trpc.casino.poker.draw.useMutation({
    onSuccess: (game) => {
      utils.casino.poker.active.setData(undefined, game as any);
      if (game.payout > 0) {
        toast.success(`${game.result}! +$${game.payout.toFixed(2)} (${game.multiplier}x)`);
      } else {
        toast.error(language === "ko" ? "당첨 없음" : "No win");
      }
      refetchBalance();
    },
    onError: (err) => toast.error(err.message),
  });

  const game = activeGame;
  const isHolding = game?.status === "holding";
  const isComplete = game?.status === "complete";
  const isPending = dealMutation.isPending || drawMutation.isPending;
  const cash = casinoBalance ?? 20;
  const parsedBetAmount = parseCasinoBetAmount(betAmount);

  const toggleHold = useCallback((i: number) => {
    if (!isHolding) return;
    setHeld(prev => { const next = [...prev]; next[i] = !next[i]; return next; });
  }, [isHolding]);

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-card via-background to-background">
      <CasinoSubNav />
      <div className="container py-8 sm:py-8 max-w-2xl mx-auto">
        

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/25 to-blue-600/15 border border-indigo-500/20">
              <span className="text-lg">🃑</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground font-[var(--font-heading)]">Video Poker</h1>
              <p className="text-xs text-muted-foreground font-mono">${cash.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-4">
          {/* Game Area */}
          <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/40 to-card" />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

            <div className="relative p-4 sm:p-6">
              {/* Result */}
              <AnimatePresence>
                {isComplete && game && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center mb-4">
                    {game.payout > 0 ? (
                      <div>
                        <p className="text-lg font-bold text-[color:var(--color-win)]">{game.result}</p>
                        <p className="text-sm font-mono text-[color:var(--color-win)]">+${game.payout.toFixed(2)} ({game.multiplier}x)</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{language === "ko" ? "당첨 없음" : "No winning hand"}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cards */}
              <div className="flex gap-1.5 sm:gap-2 justify-center mb-5 min-h-[6rem] sm:min-h-[7.5rem] items-end">
                {game?.hand ? game.hand.map((card: any, i: number) => (
                  <PokerCard
                    key={`${i}-${card.rank}-${card.suit}`}
                    card={card}
                    held={held[i]}
                    onClick={() => toggleHold(i)}
                    index={i}
                    isNew={true}
                    canHold={isHolding || false}
                  />
                )) : (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="w-[4rem] h-[5.5rem] sm:w-[5rem] sm:h-[7rem] rounded-lg border-2 border-dashed border-border/30 opacity-25" />
                  ))
                )}
              </div>

              {isHolding && (
                <p className="text-center text-xs text-muted-foreground mb-4">
                  {language === "ko" ? "카드를 클릭하여 홀드/취소" : "Click cards to hold, then draw"}
                </p>
              )}

              {/* Controls */}
              <div className="pt-3 border-t border-white/[0.05]">
                {(!game || isComplete) ? (
                  <div className="space-y-3">
                    <CasinoBetControls
                      language={language}
                      value={betAmount}
                      cash={cash}
                      disabled={isPending}
                      onChange={setBetAmount}
                    />
                    <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        const amt = parsedBetAmount;
                        if (Number.isNaN(amt) || amt < MIN_CASINO_BET || amt > MAX_CASINO_BET) {
                          return toast.error(language === "ko" ? "베팅 금액: $0.10 - $50" : "Bet amount: $0.10 - $50");
                        }
                        dealMutation.mutate({ bet: amt });
                      }}
                      disabled={
                        isPending ||
                        !isAuthenticated ||
                        parsedBetAmount < MIN_CASINO_BET ||
                        parsedBetAmount > MAX_CASINO_BET ||
                        cash < parsedBetAmount
                      }
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 text-foreground font-bold text-sm disabled:opacity-30 transition-colors shadow-lg shadow-indigo-500/15">
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                        `${language === "ko" ? "딜" : "DEAL"} $${parsedBetAmount.toFixed(2)}`}
                    </motion.button>
                  </div>
                ) : isHolding ? (
                  <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    onClick={() => drawMutation.mutate({ held })}
                    disabled={isPending}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold text-sm disabled:opacity-30 transition-colors shadow-lg shadow-yellow-500/15">
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                      `${language === "ko" ? "드로우" : "DRAW"} (${held.filter(Boolean).length} ${language === "ko" ? "홀드" : "held"})`}
                  </motion.button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Pay Table */}
          <div className="bg-card border border-border rounded-xl p-3 h-fit">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              {language === "ko" ? "페이 테이블" : "Pay Table"}
            </h3>
            <div className="space-y-1">
              {PAY_TABLE.map(row => {
                const isWin = isComplete && game?.result === row.hand;
                return (
                  <div key={row.hand} className={`flex items-center justify-between py-1 px-2 rounded text-xs font-mono transition-colors ${
                    isWin ? "bg-[color:var(--color-win)]/20 text-[color:var(--color-win)] font-bold" : "text-muted-foreground"
                  }`}>
                    <span className="truncate">{row.hand}</span>
                    <span className="font-bold ml-2">{row.payout}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/40 mt-4 font-mono">
          {language === "ko" ? "텐즈 오어 베터 · 클래식 비디오 포커" : "Tens or Better · classic video poker"}
        </p>

        <CasinoGameLog />
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
