import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Dice5, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Card {
  suit: string;
  rank: string;
  hidden?: boolean;
}

function CardDisplay({ card, index = 0, isNew = false }: { card: Card; index?: number; isNew?: boolean }) {
  const isRed = card.suit === "♥" || card.suit === "♦";

  if (card.hidden) {
    return (
      <motion.div
        initial={{ rotateY: 180, opacity: 0, x: 50 }}
        animate={{ rotateY: 0, opacity: 1, x: 0 }}
        transition={{ delay: index * 0.15, duration: 0.4, type: "spring", stiffness: 200 }}
        className="w-[4.5rem] h-[6.5rem] sm:w-[5.5rem] sm:h-[8rem] rounded-xl border-2 border-blue-600/50 shadow-xl relative overflow-hidden cursor-default select-none"
        style={{ perspective: 800 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-800 via-blue-900 to-indigo-950" />
        <div className="absolute inset-2 border border-blue-500/20 rounded-lg" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 flex items-center justify-center">
            <span className="text-blue-400/40 text-lg font-bold">$</span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={isNew ? { rotateY: -180, opacity: 0, x: 80, scale: 0.8 } : { rotateY: -90, opacity: 0, x: 30 }}
      animate={{ rotateY: 0, opacity: 1, x: 0, scale: 1 }}
      transition={{
        delay: index * 0.15,
        duration: 0.5,
        type: "spring",
        stiffness: 180,
        damping: 15,
      }}
      whileHover={{ y: -4, scale: 1.03 }}
      className={`w-[4.5rem] h-[6.5rem] sm:w-[5.5rem] sm:h-[8rem] rounded-xl border-2 bg-card shadow-xl flex flex-col items-center justify-between py-2 px-1.5 relative overflow-hidden cursor-default select-none ${
        isRed ? "border-red-400/40" : "border-border"
      }`}
    >
      {/* Top-left rank+suit */}
      <div className={`self-start leading-none ${isRed ? "text-red-500" : "text-foreground"}`}>
        <div className="text-sm sm:text-base font-bold font-mono">{card.rank}</div>
        <div className="text-xs sm:text-sm -mt-0.5">{card.suit}</div>
      </div>
      {/* Center suit */}
      <div className={`text-2xl sm:text-3xl ${isRed ? "text-red-500" : "text-foreground"}`}>
        {card.suit}
      </div>
      {/* Bottom-right rank+suit (inverted) */}
      <div className={`self-end leading-none rotate-180 ${isRed ? "text-red-500" : "text-foreground"}`}>
        <div className="text-sm sm:text-base font-bold font-mono">{card.rank}</div>
        <div className="text-xs sm:text-sm -mt-0.5">{card.suit}</div>
      </div>
      {/* Subtle shine */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
    </motion.div>
  );
}

function HandValue({ value, bust }: { value: number; bust?: boolean }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 1.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-mono font-bold ${
        bust ? "bg-[#FF5252]/20 text-[#FF5252]" :
        value === 21 ? "bg-yellow-500/20 text-yellow-400" :
        "bg-secondary text-foreground"
      }`}
    >
      {value}
    </motion.span>
  );
}

function handValue(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.hidden) continue;
    if (card.rank === "A") { total += 11; aces++; }
    else if (["K", "Q", "J"].includes(card.rank)) total += 10;
    else total += parseInt(card.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

// Track previous hand lengths to know which cards are "new"
function useCardCount(hand: Card[] | undefined): number {
  const prevRef = useRef(0);
  useEffect(() => {
    if (hand) prevRef.current = hand.length;
  }, [hand]);
  return prevRef.current;
}

export default function Casino() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState("0.50");
  const utils = trpc.useUtils();

  const { data: activeGame } = trpc.casino.blackjack.active.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: portfolio } = trpc.trading.portfolio.useQuery(undefined, {
    enabled: isAuthenticated, refetchInterval: 60_000,
  });

  const dealMutation = trpc.casino.blackjack.deal.useMutation({
    onSuccess: (game) => {
      utils.casino.blackjack.active.setData(undefined, game as any);
      if (game.status === "blackjack") toast.success("BLACKJACK! 🃏");
      utils.trading.portfolio.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const hitMutation = trpc.casino.blackjack.hit.useMutation({
    onSuccess: (game) => {
      utils.casino.blackjack.active.setData(undefined, game as any);
      if (game.status === "player_bust") toast.error("Bust! 💥");
      utils.trading.portfolio.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const standMutation = trpc.casino.blackjack.stand.useMutation({
    onSuccess: (game) => {
      utils.casino.blackjack.active.setData(undefined, game as any);
      if (game.status === "player_win" || game.status === "dealer_bust") toast.success("You win! 🎉");
      else if (game.status === "push") toast("Push — bet returned");
      else toast.error("Dealer wins 😞");
      utils.trading.portfolio.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const doubleMutation = trpc.casino.blackjack.double.useMutation({
    onSuccess: (game) => {
      utils.casino.blackjack.active.setData(undefined, game as any);
      if (game.status === "player_win" || game.status === "dealer_bust") toast.success("Double down wins! 🎉🎉");
      else if (game.status === "player_bust") toast.error("Bust on double! 💥💥");
      else if (game.status === "push") toast("Push — bet returned");
      else toast.error("Dealer wins 😞");
      utils.trading.portfolio.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const game = activeGame;
  const isPlaying = game?.status === "playing";
  const isOver = game && game.status !== "playing";
  const isPending = dealMutation.isPending || hitMutation.isPending || standMutation.isPending || doubleMutation.isPending;
  const cash = portfolio?.cashBalance ?? 0;

  const prevPlayerCards = useCardCount(game?.playerHand);
  const prevDealerCards = useCardCount(game?.dealerHand);

  const playerVal = game ? handValue(game.playerHand) : 0;
  const dealerVal = game ? handValue(game.dealerHand) : 0;

  const statusConfig = !game ? null :
    game.status === "blackjack" ? { text: "BLACKJACK!", emoji: "🃏", color: "text-yellow-400", bg: "from-yellow-500/20 to-yellow-500/5" } :
    game.status === "player_win" ? { text: language === "ko" ? "승리!" : "You Win!", emoji: "🎉", color: "text-[#00C805]", bg: "from-[#00C805]/20 to-[#00C805]/5" } :
    game.status === "dealer_bust" ? { text: language === "ko" ? "딜러 버스트!" : "Dealer Bust!", emoji: "💥", color: "text-[#00C805]", bg: "from-[#00C805]/20 to-[#00C805]/5" } :
    game.status === "player_bust" ? { text: language === "ko" ? "버스트!" : "Bust!", emoji: "💀", color: "text-[#FF5252]", bg: "from-[#FF5252]/20 to-[#FF5252]/5" } :
    game.status === "dealer_win" ? { text: language === "ko" ? "딜러 승리" : "Dealer Wins", emoji: "😞", color: "text-[#FF5252]", bg: "from-[#FF5252]/20 to-[#FF5252]/5" } :
    game.status === "push" ? { text: language === "ko" ? "무승부" : "Push", emoji: "🤝", color: "text-yellow-400", bg: "from-yellow-500/20 to-yellow-500/5" } :
    null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-6 sm:py-8 max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          $DORI
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="p-2.5 rounded-xl bg-gradient-to-br from-yellow-500/30 to-amber-600/20 border border-yellow-500/20"
            >
              <Dice5 className="w-5 h-5 text-yellow-400" />
            </motion.div>
            <div>
              <h1 className="text-lg font-bold text-foreground font-[var(--font-heading)]">
                {language === "ko" ? "카지노" : "Casino"}
              </h1>
              <p className="text-[10px] text-muted-foreground font-mono">
                {language === "ko" ? "블랙잭" : "Blackjack"} · ${cash.toFixed(2)} {language === "ko" ? "보유" : "available"}
              </p>
            </div>
          </div>
          {isPlaying && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-3 py-1.5 rounded-full bg-yellow-500/15 border border-yellow-500/30"
            >
              <span className="text-xs font-mono font-bold text-yellow-400">
                {language === "ko" ? "베팅" : "BET"}: ${game.bet.toFixed(0)}
              </span>
            </motion.div>
          )}
        </div>

        {/* Table */}
        <div className="relative bg-gradient-to-b from-green-950/50 via-green-900/30 to-green-950/50 border border-green-700/30 rounded-3xl p-5 sm:p-8 shadow-2xl overflow-hidden">
          {/* Subtle table texture */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

          {/* Dealer section */}
          <div className="relative mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold text-green-400/60 uppercase tracking-widest">
                {language === "ko" ? "딜러" : "Dealer"}
              </span>
              {game && <HandValue value={dealerVal} bust={dealerVal > 21} />}
            </div>
            <div className="flex gap-2 sm:gap-3 min-h-[6.5rem] sm:min-h-[8rem] items-end">
              <AnimatePresence mode="popLayout">
                {game ? game.dealerHand.map((card, i) => (
                  <CardDisplay key={`d-${i}-${card.rank}-${card.suit}`} card={card} index={i} isNew={i >= prevDealerCards} />
                )) : (
                  <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.15 }} className="w-[4.5rem] h-[6.5rem] sm:w-[5.5rem] sm:h-[8rem] rounded-xl border-2 border-dashed border-green-500/30" />
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.15 }} className="w-[4.5rem] h-[6.5rem] sm:w-[5.5rem] sm:h-[8rem] rounded-xl border-2 border-dashed border-green-500/30" />
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Divider with status */}
          <div className="relative my-4">
            <div className="border-t border-green-600/20" />
            <AnimatePresence>
              {statusConfig && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-6 py-3 rounded-2xl bg-gradient-to-r ${statusConfig.bg} border border-border/50 backdrop-blur-sm`}
                >
                  <div className="text-center">
                    <span className="text-3xl">{statusConfig.emoji}</span>
                    <p className={`text-lg font-bold ${statusConfig.color} mt-1`}>{statusConfig.text}</p>
                    {isOver && game.payout > 0 && (
                      <motion.p
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-sm text-[#00C805] font-mono font-bold mt-0.5"
                      >
                        +${game.payout.toFixed(2)}
                      </motion.p>
                    )}
                    {isOver && game.payout === 0 && (
                      <motion.p
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-sm text-[#FF5252] font-mono font-bold mt-0.5"
                      >
                        -${game.bet.toFixed(2)}
                      </motion.p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Player section */}
          <div className={`relative ${statusConfig ? "mt-16" : "mt-4"}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold text-green-400/60 uppercase tracking-widest">
                {language === "ko" ? "내 패" : "You"}
              </span>
              {game && <HandValue value={playerVal} bust={playerVal > 21} />}
            </div>
            <div className="flex gap-2 sm:gap-3 min-h-[6.5rem] sm:min-h-[8rem] items-end">
              <AnimatePresence mode="popLayout">
                {game ? game.playerHand.map((card, i) => (
                  <CardDisplay key={`p-${i}-${card.rank}-${card.suit}`} card={card} index={i} isNew={i >= prevPlayerCards} />
                )) : (
                  <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.15 }} className="w-[4.5rem] h-[6.5rem] sm:w-[5.5rem] sm:h-[8rem] rounded-xl border-2 border-dashed border-green-500/30" />
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.15 }} className="w-[4.5rem] h-[6.5rem] sm:w-[5.5rem] sm:h-[8rem] rounded-xl border-2 border-dashed border-green-500/30" />
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Controls */}
          <motion.div layout className="relative mt-6 pt-5 border-t border-green-600/20">
            <AnimatePresence mode="wait">
              {!game || isOver ? (
                <motion.div
                  key="deal"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  {/* Chip selector */}
                  <div className="flex gap-1.5 sm:gap-2 justify-center flex-wrap">
                    {[0.10, 0.25, 0.50, 1, 2, 5].map(amt => {
                      const label = amt < 1 ? `${Math.round(amt * 100)}¢` : `$${amt}`;
                      const selected = parseFloat(betAmount) === amt;
                      return (
                        <motion.button
                          key={amt}
                          whileHover={{ scale: 1.1, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setBetAmount(amt.toString())}
                          className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full font-mono font-bold text-[11px] sm:text-xs transition-all shadow-lg ${
                            selected
                              ? "bg-gradient-to-b from-yellow-400 to-yellow-600 text-black ring-2 ring-yellow-300 ring-offset-2 ring-offset-green-950"
                              : "bg-gradient-to-b from-gray-600 to-gray-800 text-gray-300 hover:from-gray-500 hover:to-gray-700 border border-gray-500/30"
                          }`}
                        >
                          {label}
                        </motion.button>
                      );
                    })}
                  </div>
                  {/* Deal button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      const amt = parseFloat(betAmount);
                      if (isNaN(amt) || amt < 0.10 || amt > 5) return toast.error("Bet $0.10-$5.00");
                      dealMutation.mutate({ bet: amt });
                    }}
                    disabled={isPending || !isAuthenticated}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold text-base hover:from-yellow-400 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-yellow-500/20"
                  >
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                      <span className="flex items-center justify-center gap-2">
                        <Dice5 className="w-5 h-5" />
                        {language === "ko" ? `$${parseFloat(betAmount).toFixed(2)} 딜` : `DEAL $${parseFloat(betAmount).toFixed(2)}`}
                      </span>
                    )}
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  key="actions"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-3 gap-3"
                >
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => hitMutation.mutate()}
                    disabled={isPending}
                    className="py-4 rounded-2xl bg-gradient-to-b from-[#00C805] to-[#00a004] text-white font-bold text-sm disabled:opacity-40 transition-all shadow-lg shadow-[#00C805]/20"
                  >
                    {hitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : language === "ko" ? "히트" : "HIT"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => standMutation.mutate()}
                    disabled={isPending}
                    className="py-4 rounded-2xl bg-gradient-to-b from-[#FF5252] to-[#d43d3d] text-white font-bold text-sm disabled:opacity-40 transition-all shadow-lg shadow-[#FF5252]/20"
                  >
                    {standMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : language === "ko" ? "스탠드" : "STAND"}
                  </motion.button>
                  {game.playerHand.length === 2 ? (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => doubleMutation.mutate()}
                      disabled={isPending}
                      className="py-4 rounded-2xl bg-gradient-to-b from-yellow-500 to-amber-600 text-black font-bold text-sm disabled:opacity-40 transition-all shadow-lg shadow-yellow-500/20"
                    >
                      {doubleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : language === "ko" ? "더블" : "DOUBLE"}
                    </motion.button>
                  ) : (
                    <div /> /* Empty grid cell */
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Rules */}
        <div className="mt-6 text-center">
          <p className="text-[10px] text-muted-foreground/50">
            {language === "ko"
              ? "딜러 17 스탠드 · 블랙잭 3:2 · 더블다운 가능"
              : "Dealer stands on 17 · Blackjack pays 3:2 · Double down on initial hand"}
          </p>
        </div>
      </div>
    </div>
  );
}
