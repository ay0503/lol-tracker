import { useState, useEffect, useRef, useCallback } from "react";
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

// ─── Card Component ───
function CardDisplay({ card, index = 0, isNew = false }: { card: Card; index?: number; isNew?: boolean }) {
  const isRed = card.suit === "♥" || card.suit === "♦";

  const enterAnim = isNew
    ? { rotateY: -180, opacity: 0, x: 60, scale: 0.7 }
    : { rotateY: -90, opacity: 0, x: 20 };

  if (card.hidden) {
    return (
      <motion.div
        initial={{ rotateY: 180, opacity: 0, x: 60, scale: 0.7 }}
        animate={{ rotateY: 0, opacity: 1, x: 0, scale: 1 }}
        transition={{ delay: index * 0.2, duration: 0.5, type: "spring", stiffness: 150, damping: 15 }}
        className="w-[3.75rem] h-[5.25rem] sm:w-[4.75rem] sm:h-[6.75rem] rounded-lg border border-blue-500/40 shadow-lg relative overflow-hidden select-none flex-shrink-0"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900" />
        <div className="absolute inset-[3px] border border-blue-400/15 rounded-md" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-blue-400/25 text-2xl font-bold">?</div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={enterAnim}
      animate={{ rotateY: 0, opacity: 1, x: 0, scale: 1 }}
      transition={{
        delay: index * 0.2,
        duration: 0.5,
        type: "spring",
        stiffness: 150,
        damping: 15,
      }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className={`w-[3.75rem] h-[5.25rem] sm:w-[4.75rem] sm:h-[6.75rem] rounded-lg border bg-white shadow-lg relative overflow-hidden select-none flex-shrink-0 ${
        isRed ? "border-red-300/50" : "border-gray-300/50"
      }`}
    >
      {/* Top-left */}
      <div className={`absolute top-1 left-1.5 leading-tight ${isRed ? "text-red-500" : "text-gray-800"}`}>
        <div className="text-[11px] sm:text-sm font-bold font-mono leading-none">{card.rank}</div>
        <div className="text-[10px] sm:text-xs leading-none">{card.suit}</div>
      </div>
      {/* Center */}
      <div className={`absolute inset-0 flex items-center justify-center ${isRed ? "text-red-500" : "text-gray-800"}`}>
        <span className="text-xl sm:text-3xl">{card.suit}</span>
      </div>
      {/* Bottom-right */}
      <div className={`absolute bottom-1 right-1.5 leading-tight rotate-180 ${isRed ? "text-red-500" : "text-gray-800"}`}>
        <div className="text-[11px] sm:text-sm font-bold font-mono leading-none">{card.rank}</div>
        <div className="text-[10px] sm:text-xs leading-none">{card.suit}</div>
      </div>
    </motion.div>
  );
}

// ─── Hand Value Badge ───
function HandValue({ value, bust, blackjack }: { value: number; bust?: boolean; blackjack?: boolean }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 1.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 rounded-full text-[11px] font-mono font-bold ${
        bust ? "bg-[#FF5252]/20 text-[#FF5252] ring-1 ring-[#FF5252]/30" :
        blackjack ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30" :
        value === 21 ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30" :
        value >= 17 ? "bg-orange-500/15 text-orange-400" :
        "bg-secondary/80 text-foreground"
      }`}
    >
      {value}
    </motion.span>
  );
}

// ─── Placeholder Cards ───
function PlaceholderCards() {
  return (
    <div className="flex gap-2 opacity-15">
      <div className="w-[3.75rem] h-[5.25rem] sm:w-[4.75rem] sm:h-[6.75rem] rounded-lg border-2 border-dashed border-green-400/40" />
      <div className="w-[3.75rem] h-[5.25rem] sm:w-[4.75rem] sm:h-[6.75rem] rounded-lg border-2 border-dashed border-green-400/40" />
    </div>
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

function useCardCount(hand: Card[] | undefined): number {
  const prevRef = useRef(0);
  useEffect(() => {
    if (hand) prevRef.current = hand.length;
  }, [hand]);
  return prevRef.current;
}

// ─── Casino Page ───
export default function Casino() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState("0.50");
  const utils = trpc.useUtils();

  const { data: activeGame } = trpc.casino.blackjack.active.useQuery(undefined, { enabled: isAuthenticated });
  const { data: portfolio } = trpc.trading.portfolio.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 60_000 });

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
      const s = game.status;
      if (s === "player_win" || s === "dealer_bust") toast.success("You win! 🎉");
      else if (s === "push") toast("Push — bet returned");
      else toast.error("Dealer wins 😞");
      utils.trading.portfolio.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const doubleMutation = trpc.casino.blackjack.double.useMutation({
    onSuccess: (game) => {
      utils.casino.blackjack.active.setData(undefined, game as any);
      const s = game.status;
      if (s === "player_win" || s === "dealer_bust") toast.success("Double down wins! 🎉🎉");
      else if (s === "player_bust") toast.error("Bust on double! 💥💥");
      else if (s === "push") toast("Push — bet returned");
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

  // Keyboard shortcuts
  useEffect(() => {
    if (!isPlaying || isPending) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "h" || e.key === "H") hitMutation.mutate();
      if (e.key === "s" || e.key === "S") standMutation.mutate();
      if ((e.key === "d" || e.key === "D") && game?.playerHand.length === 2) doubleMutation.mutate();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPlaying, isPending, game?.playerHand.length]);

  const handleDeal = useCallback(() => {
    const amt = parseFloat(betAmount);
    if (isNaN(amt) || amt < 0.10 || amt > 5) return toast.error("Bet $0.10–$5.00");
    dealMutation.mutate({ bet: amt });
  }, [betAmount]);

  const isWin = game?.status === "player_win" || game?.status === "dealer_bust" || game?.status === "blackjack";
  const isLoss = game?.status === "player_bust" || game?.status === "dealer_win";
  const isPush = game?.status === "push";

  const statusConfig = !game ? null :
    game.status === "blackjack" ? { text: "BLACKJACK!", emoji: "🃏", color: "text-yellow-400", glow: "shadow-yellow-500/30" } :
    game.status === "player_win" ? { text: language === "ko" ? "승리!" : "You Win!", emoji: "🎉", color: "text-[#00C805]", glow: "shadow-[#00C805]/30" } :
    game.status === "dealer_bust" ? { text: language === "ko" ? "딜러 버스트!" : "Dealer Bust!", emoji: "💥", color: "text-[#00C805]", glow: "shadow-[#00C805]/30" } :
    game.status === "player_bust" ? { text: language === "ko" ? "버스트!" : "Bust!", emoji: "💀", color: "text-[#FF5252]", glow: "shadow-[#FF5252]/30" } :
    game.status === "dealer_win" ? { text: language === "ko" ? "딜러 승리" : "Dealer Wins", emoji: "😞", color: "text-[#FF5252]", glow: "shadow-[#FF5252]/30" } :
    game.status === "push" ? { text: language === "ko" ? "무승부" : "Push", emoji: "🤝", color: "text-yellow-400", glow: "shadow-yellow-500/30" } :
    null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-6 sm:py-8 max-w-lg mx-auto">
        {/* Nav */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5">
          <ArrowLeft className="w-3.5 h-3.5" />
          $DORI
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/25 to-amber-600/15 border border-yellow-500/20">
              <Dice5 className="w-4.5 h-4.5 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground font-[var(--font-heading)]">Blackjack</h1>
              <p className="text-[10px] text-muted-foreground font-mono">
                ${cash.toFixed(2)} {language === "ko" ? "보유" : "cash"}
              </p>
            </div>
          </div>
          {isPlaying && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/25"
            >
              <span className="text-[11px] font-mono font-bold text-yellow-400">${game.bet.toFixed(2)}</span>
            </motion.div>
          )}
        </div>

        {/* Table */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl">
          {/* Felt background */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a5c2a] via-[#1b6b30] to-[#145224]" />
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, white 0.5px, transparent 0.5px)", backgroundSize: "12px 12px" }} />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.08]" />

          <div className="relative p-5 sm:p-7">
            {/* Dealer */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                  {language === "ko" ? "딜러" : "Dealer"}
                </span>
                {game && <HandValue value={dealerVal} bust={dealerVal > 21} blackjack={dealerVal === 21 && game.dealerHand.length === 2} />}
              </div>
              <div className="flex gap-2 sm:gap-2.5 min-h-[5.5rem] sm:min-h-[7rem] items-end">
                {game ? game.dealerHand.map((card, i) => (
                  <CardDisplay key={`d-${i}-${card.rank}-${card.suit}-${card.hidden}`} card={card} index={i} isNew={i >= prevDealerCards} />
                )) : <PlaceholderCards />}
              </div>
            </div>

            {/* Result overlay */}
            <div className="relative h-16 flex items-center justify-center">
              <div className="absolute inset-x-0 top-1/2 border-t border-white/[0.06]" />
              <AnimatePresence>
                {statusConfig && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={`relative z-10 px-5 py-2.5 rounded-xl bg-background/90 backdrop-blur-md border border-border/50 shadow-xl ${statusConfig.glow}`}
                  >
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xl">{statusConfig.emoji}</span>
                        <span className={`text-base font-bold ${statusConfig.color}`}>{statusConfig.text}</span>
                      </div>
                      {isOver && (
                        <motion.p
                          initial={{ y: 5, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className={`text-xs font-mono font-bold mt-0.5 ${isWin ? "text-[#00C805]" : isLoss ? "text-[#FF5252]" : "text-yellow-400"}`}
                        >
                          {isWin ? `+$${game.payout.toFixed(2)}` : isLoss ? `-$${game.bet.toFixed(2)}` : `$${game.payout.toFixed(2)} returned`}
                        </motion.p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Player */}
            <div className="mt-1">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                  {language === "ko" ? "내 패" : "You"}
                </span>
                {game && <HandValue value={playerVal} bust={playerVal > 21} blackjack={playerVal === 21 && game.playerHand.length === 2} />}
              </div>
              <div className="flex gap-2 sm:gap-2.5 min-h-[5.5rem] sm:min-h-[7rem] items-end">
                {game ? game.playerHand.map((card, i) => (
                  <CardDisplay key={`p-${i}-${card.rank}-${card.suit}`} card={card} index={i} isNew={i >= prevPlayerCards} />
                )) : <PlaceholderCards />}
              </div>
            </div>

            {/* Controls */}
            <div className="mt-6 pt-5 border-t border-white/[0.06]">
              <AnimatePresence mode="wait">
                {!game || isOver ? (
                  <motion.div
                    key="deal"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-4"
                  >
                    {/* Chips */}
                    <div className="flex gap-1.5 justify-center">
                      {[0.10, 0.25, 0.50, 1, 2, 5].map(amt => {
                        const label = amt < 1 ? `${Math.round(amt * 100)}¢` : `$${amt}`;
                        const selected = parseFloat(betAmount) === amt;
                        return (
                          <motion.button
                            key={amt}
                            whileHover={{ y: -3 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => setBetAmount(amt.toString())}
                            className={`w-11 h-11 rounded-full font-mono font-bold text-[10px] transition-colors shadow-md ${
                              selected
                                ? "bg-gradient-to-b from-yellow-400 to-amber-600 text-black ring-2 ring-yellow-300/60 ring-offset-1 ring-offset-[#1b6b30]"
                                : "bg-gradient-to-b from-gray-500 to-gray-700 text-gray-200 hover:from-gray-400 hover:to-gray-600 border border-white/10"
                            }`}
                          >
                            {label}
                          </motion.button>
                        );
                      })}
                    </div>
                    {/* Deal */}
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDeal}
                      disabled={isPending || !isAuthenticated}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold text-sm hover:from-yellow-400 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-yellow-500/15"
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (
                        <span className="flex items-center justify-center gap-1.5">
                          {language === "ko" ? `$${parseFloat(betAmount).toFixed(2)} 딜` : `DEAL $${parseFloat(betAmount).toFixed(2)}`}
                        </span>
                      )}
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="actions"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className={`grid gap-2.5 ${game.playerHand.length === 2 ? "grid-cols-3" : "grid-cols-2"}`}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => hitMutation.mutate()}
                        disabled={isPending}
                        className="py-3.5 rounded-xl bg-[#00C805] text-white font-bold text-sm disabled:opacity-40 transition-colors shadow-md"
                      >
                        {hitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (
                          <span>{language === "ko" ? "히트" : "HIT"} <span className="text-white/50 text-[10px]">H</span></span>
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => standMutation.mutate()}
                        disabled={isPending}
                        className="py-3.5 rounded-xl bg-[#FF5252] text-white font-bold text-sm disabled:opacity-40 transition-colors shadow-md"
                      >
                        {standMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (
                          <span>{language === "ko" ? "스탠드" : "STAND"} <span className="text-white/50 text-[10px]">S</span></span>
                        )}
                      </motion.button>
                      {game.playerHand.length === 2 && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => doubleMutation.mutate()}
                          disabled={isPending}
                          className="py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold text-sm disabled:opacity-40 transition-colors shadow-md"
                        >
                          {doubleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (
                            <span>{language === "ko" ? "더블" : "DBL"} <span className="text-black/40 text-[10px]">D</span></span>
                          )}
                        </motion.button>
                      )}
                    </div>
                    {/* Keyboard hint */}
                    <p className="text-center text-[9px] text-white/20 mt-2 font-mono">
                      H / S / D
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Rules */}
        <p className="text-center text-[9px] text-muted-foreground/40 mt-4 font-mono">
          {language === "ko"
            ? "딜러 17 스탠드 · 블랙잭 3:2 · 더블다운 첫 패"
            : "Dealer stands 17 · BJ pays 3:2 · Double on first hand"}
        </p>
      </div>
    </div>
  );
}
