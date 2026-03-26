import { useState, useEffect, useRef, useCallback, memo } from "react";
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

// ─── Colored casino chips by denomination ───
const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0.10: { bg: "from-blue-400 to-blue-600", border: "border-blue-300/50", text: "text-white" },
  0.25: { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", text: "text-white" },
  0.50: { bg: "from-red-400 to-red-600", border: "border-red-300/50", text: "text-white" },
  1:    { bg: "from-gray-100 to-gray-300", border: "border-gray-200/50", text: "text-gray-800" },
  2:    { bg: "from-pink-400 to-pink-600", border: "border-pink-300/50", text: "text-white" },
  5:    { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50", text: "text-black" },
};

// ─── Card Component ───
const CardDisplay = memo(function CardDisplay({ card, index = 0, isNew = false }: { card: Card; index?: number; isNew?: boolean }) {
  const isRed = card.suit === "♥" || card.suit === "♦";

  if (card.hidden) {
    return (
      <motion.div
        initial={{ rotateY: 180, opacity: 0, x: 60, scale: 0.7 }}
        animate={{ rotateY: 0, opacity: 1, x: 0, scale: 1 }}
        exit={{ rotateY: 90, opacity: 0, scale: 0.8 }}
        transition={{ delay: index * 0.2, duration: 0.5, type: "spring", stiffness: 150, damping: 15 }}
        className="w-[3.75rem] h-[5.25rem] sm:w-[4.75rem] sm:h-[6.75rem] rounded-lg border border-blue-500/40 shadow-lg relative overflow-hidden select-none flex-shrink-0"
        style={{ zIndex: index }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900" />
        {/* Crosshatch pattern */}
        <div className="absolute inset-[3px] border border-blue-400/15 rounded-md overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(96,165,250,0.3) 4px, rgba(96,165,250,0.3) 5px),
                             repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(96,165,250,0.3) 4px, rgba(96,165,250,0.3) 5px)`,
          }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
            <span className="text-blue-300/50 text-[10px] font-bold">D</span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={isNew ? { rotateY: -180, opacity: 0, x: 60, scale: 0.7 } : { rotateY: -90, opacity: 0, x: 20 }}
      animate={{ rotateY: 0, opacity: 1, x: 0, scale: 1 }}
      exit={{ rotateY: 90, opacity: 0, x: -20, scale: 0.8 }}
      transition={{ delay: index * 0.2, duration: 0.5, type: "spring", stiffness: 150, damping: 15 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className="w-[3.75rem] h-[5.25rem] sm:w-[4.75rem] sm:h-[6.75rem] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.15)] relative overflow-hidden select-none flex-shrink-0"
      style={{ zIndex: index }}
    >
      {/* Top-left */}
      <div className={`absolute top-1 left-1.5 leading-tight ${isRed ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}>
        <div className="text-[11px] sm:text-sm font-extrabold font-[var(--font-heading)] leading-none">{card.rank}</div>
        <div className="text-[10px] sm:text-xs leading-none">{card.suit}</div>
      </div>
      {/* Center */}
      <div className={`absolute inset-0 flex items-center justify-center ${isRed ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}>
        <span className="text-2xl sm:text-3xl drop-shadow-sm">{card.suit}</span>
      </div>
      {/* Bottom-right */}
      <div className={`absolute bottom-1 right-1.5 leading-tight rotate-180 ${isRed ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}>
        <div className="text-[11px] sm:text-sm font-extrabold font-[var(--font-heading)] leading-none">{card.rank}</div>
        <div className="text-[10px] sm:text-xs leading-none">{card.suit}</div>
      </div>
      {/* Shine */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-white/5 to-transparent pointer-events-none rounded-lg" />
    </motion.div>
  );
});

// ─── Hand Value Badge ───
function HandValue({ value, bust, blackjack, soft }: { value: number; bust?: boolean; blackjack?: boolean; soft?: boolean }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 1.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 rounded-full text-[11px] font-mono font-bold ${
        bust ? "bg-[#FF5252]/20 text-[#FF5252] ring-1 ring-[#FF5252]/30" :
        blackjack ? "bg-yellow-500/25 text-yellow-400 ring-1 ring-yellow-500/40" :
        value === 21 ? "bg-yellow-500/25 text-yellow-400 ring-1 ring-yellow-500/40" :
        value >= 17 ? "bg-orange-500/15 text-orange-400" :
        "bg-black/20 text-white/80"
      }`}
    >
      {soft && value <= 21 ? `${value - 10}/${value}` : value}
    </motion.span>
  );
}

function PlaceholderCards() {
  return (
    <div className="flex gap-2 opacity-25">
      <div className="w-[3.75rem] h-[5.25rem] sm:w-[4.75rem] sm:h-[6.75rem] rounded-lg border-2 border-dashed border-green-400/40" />
      <div className="w-[3.75rem] h-[5.25rem] sm:w-[4.75rem] sm:h-[6.75rem] rounded-lg border-2 border-dashed border-green-400/40" />
    </div>
  );
}

function handValue(hand: Card[]): number {
  let total = 0; let aces = 0;
  for (const card of hand) {
    if (card.hidden) continue;
    if (card.rank === "A") { total += 11; aces++; }
    else if (["K", "Q", "J"].includes(card.rank)) total += 10;
    else total += parseInt(card.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isSoftHand(hand: Card[]): boolean {
  let total = 0; let aces = 0;
  for (const card of hand) {
    if (card.hidden) continue;
    if (card.rank === "A") { total += 11; aces++; }
    else if (["K", "Q", "J"].includes(card.rank)) total += 10;
    else total += parseInt(card.rank);
  }
  // Soft if an ace is counted as 11 and total <= 21
  return aces > 0 && total <= 21;
}

function useCardCount(hand: Card[] | undefined): number {
  const prevRef = useRef(0);
  useEffect(() => { if (hand) prevRef.current = hand.length; }, [hand]);
  return prevRef.current;
}

// ─── Sequential Dealer Reveal ───
function useDealerReveal(game: any) {
  const [revealed, setRevealed] = useState<Card[]>([]);
  const prevStatusRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Clear any pending reveal timer
    if (timerRef.current) { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; }

    if (!game || !game.dealerHand || game.dealerHand.length === 0) {
      setRevealed([]);
      prevStatusRef.current = null;
      return;
    }

    const hand: Card[] = game.dealerHand;

    if (game.status === "playing") {
      setRevealed([...hand]);
      prevStatusRef.current = "playing";
      return;
    }

    // Game just ended from playing — reveal sequentially
    if (prevStatusRef.current === "playing") {
      // Show first 2 cards (hole card revealed)
      setRevealed(hand.slice(0, 2));

      if (hand.length > 2) {
        let idx = 2;
        const timer = setInterval(() => {
          idx++;
          if (idx > hand.length) {
            clearInterval(timer);
            timerRef.current = null;
            return;
          }
          setRevealed(hand.slice(0, idx));
        }, 500);
        timerRef.current = timer;
      }

      prevStatusRef.current = game.status;
      return;
    }

    // Default: show all cards (page load with finished game, etc.)
    setRevealed([...hand]);
    prevStatusRef.current = game.status;

    return () => {
      if (timerRef.current) { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [game?.status, game?.id]);

  return revealed;
}

// ─── Casino Page ───
export default function Casino() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState("0.50");
  const [lastBet, setLastBet] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: activeGame } = trpc.casino.blackjack.active.useQuery(undefined, {
    enabled: isAuthenticated, staleTime: 30_000,
  });
  const { data: casinoBalance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const dealMutation = trpc.casino.blackjack.deal.useMutation({
    onSuccess: (game) => {
      utils.casino.blackjack.active.setData(undefined, game as any);
      setLastBet(game.bet);
      if (game.status === "blackjack") toast.success("BLACKJACK! 🃏");
      refetchBalance();
    },
    onError: (err) => toast.error(err.message),
  });

  const hitMutation = trpc.casino.blackjack.hit.useMutation({
    onSuccess: (game) => {
      utils.casino.blackjack.active.setData(undefined, game as any);
      if (game.status === "player_bust") toast.error("Bust! 💥");
      refetchBalance();
    },
    onError: (err) => { toast.error(err.message); utils.casino.blackjack.active.invalidate(); },
  });

  const standMutation = trpc.casino.blackjack.stand.useMutation({
    onSuccess: (game) => {
      utils.casino.blackjack.active.setData(undefined, game as any);
      refetchBalance();
      // Delay toast for dealer reveal animation
      const dealerCards = game.dealerHand.length;
      const delay = dealerCards > 2 ? (dealerCards - 2) * 500 + 300 : 300;
      setTimeout(() => {
        const s = game.status;
        if (s === "player_win" || s === "dealer_bust") toast.success("You win! 🎉");
        else if (s === "push") toast("Push — bet returned");
        else toast.error("Dealer wins 😞");
      }, delay);
    },
    onError: (err) => { toast.error(err.message); utils.casino.blackjack.active.invalidate(); },
  });

  const doubleMutation = trpc.casino.blackjack.double.useMutation({
    onSuccess: (game) => {
      utils.casino.blackjack.active.setData(undefined, game as any);
      refetchBalance();
      setTimeout(() => {
        const s = game.status;
        if (s === "player_win" || s === "dealer_bust") toast.success("Double down wins! 🎉🎉");
        else if (s === "player_bust") toast.error("Bust on double! 💥💥");
        else if (s === "push") toast("Push — bet returned");
        else toast.error("Dealer wins 😞");
      }, 500);
    },
    onError: (err) => { toast.error(err.message); utils.casino.blackjack.active.invalidate(); },
  });

  const game = activeGame;
  const isPlaying = game?.status === "playing";
  const isOver = game && game.status !== "playing";
  const isPending = dealMutation.isPending || hitMutation.isPending || standMutation.isPending || doubleMutation.isPending;
  const cash = casinoBalance ?? 20;

  const prevPlayerCards = useCardCount(game?.playerHand);
  const prevDealerCards = useCardCount(game?.dealerHand);
  const dealerRevealed = useDealerReveal(game);

  const playerVal = game ? handValue(game.playerHand) : 0;
  const dealerVal = dealerRevealed.length > 0 ? handValue(dealerRevealed) : 0;
  const playerSoft = game ? isSoftHand(game.playerHand) : false;

  const isWin = game?.status === "player_win" || game?.status === "dealer_bust" || game?.status === "blackjack";
  const isLoss = game?.status === "player_bust" || game?.status === "dealer_win";

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

  const handleDeal = useCallback((amt?: number) => {
    const betVal = amt ?? parseFloat(betAmount);
    if (isNaN(betVal) || betVal < 0.10 || betVal > 5) return toast.error("Bet $0.10–$5.00");
    dealMutation.mutate({ bet: betVal });
  }, [betAmount]);

  const statusConfig = !game ? null :
    game.status === "blackjack" ? { text: "BLACKJACK!", emoji: "🃏", color: "text-yellow-400", glow: "shadow-yellow-500/30" } :
    game.status === "player_win" ? { text: language === "ko" ? "승리!" : "You Win!", emoji: "🎉", color: "text-[#00C805]", glow: "shadow-[#00C805]/30" } :
    game.status === "dealer_bust" ? { text: language === "ko" ? "딜러 버스트!" : "Dealer Bust!", emoji: "💥", color: "text-[#00C805]", glow: "shadow-[#00C805]/30" } :
    game.status === "player_bust" ? { text: language === "ko" ? "버스트!" : "Bust!", emoji: "💀", color: "text-[#FF5252]", glow: "shadow-[#FF5252]/30" } :
    game.status === "dealer_win" ? { text: language === "ko" ? "딜러 승리" : "Dealer Wins", emoji: "😞", color: "text-[#FF5252]", glow: "shadow-[#FF5252]/30" } :
    game.status === "push" ? { text: language === "ko" ? "무승부" : "Push", emoji: "🤝", color: "text-yellow-400", glow: "shadow-yellow-500/30" } :
    null;

  const canDouble = isPlaying && game.playerHand.length === 2 && cash >= game.bet;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <div className="container py-6 sm:py-8 max-w-lg mx-auto">
        {/* Nav */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mb-5">
          <ArrowLeft className="w-3.5 h-3.5" />
          $DORI
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/25 to-amber-600/15 border border-yellow-500/20">
              <Dice5 className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-[var(--font-heading)]">Blackjack</h1>
              <p className="text-xs text-zinc-400 font-mono">${cash.toFixed(2)}</p>
            </div>
          </div>
          {(isPlaying || isOver) && game && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/25"
            >
              <span className="text-[11px] font-mono font-bold text-yellow-400">${game.bet.toFixed(2)}</span>
            </motion.div>
          )}
        </div>

        {/* Table */}
        <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
          {/* Felt */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a5c2a] via-[#0d6b32] to-[#084d23]" />
          <div className="absolute inset-0 opacity-[0.07]" style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.4) 0.5px, transparent 0.5px)",
            backgroundSize: "8px 8px",
          }} />
          <div className="absolute inset-3 sm:inset-4 border border-green-500/10 rounded-xl pointer-events-none" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

          <div className="relative p-5 sm:p-7">
            {/* Dealer */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-green-300/50 uppercase tracking-[0.15em]">
                  {language === "ko" ? "딜러" : "Dealer"}
                </span>
                {dealerRevealed.length > 0 && (
                  <HandValue value={dealerVal} bust={dealerVal > 21} blackjack={dealerVal === 21 && dealerRevealed.length === 2 && !dealerRevealed.some(c => c.hidden)} />
                )}
              </div>
              <div className="flex gap-2 sm:gap-2.5 min-h-[5.5rem] sm:min-h-[7rem] items-end">
                <AnimatePresence mode="popLayout">
                  {dealerRevealed.length > 0 ? dealerRevealed.map((card, i) => (
                    <CardDisplay key={`d-${i}-${card.rank}-${card.suit}-${card.hidden}`} card={card} index={i} isNew={i >= prevDealerCards} />
                  )) : <PlaceholderCards />}
                </AnimatePresence>
              </div>
            </div>

            {/* Result zone — fixed height */}
            <div className="relative min-h-[4.5rem] flex items-center justify-center my-2">
              <div className="absolute inset-x-0 top-1/2 border-t border-white/[0.05]" />
              <AnimatePresence>
                {statusConfig && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={`relative z-10 px-5 py-2.5 rounded-xl bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 shadow-xl ${statusConfig.glow}`}
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

              {/* Empty state prompt */}
              {!game && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative z-10 text-green-300/30 text-xs tracking-wide"
                >
                  {language === "ko" ? "베팅하고 딜을 눌러 시작하세요" : "Place your bet and press DEAL"}
                </motion.p>
              )}
            </div>

            {/* Player */}
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-green-300/50 uppercase tracking-[0.15em]">
                  {language === "ko" ? "내 패" : "You"}
                </span>
                {game && (
                  <HandValue value={playerVal} bust={playerVal > 21} blackjack={playerVal === 21 && game.playerHand.length === 2} soft={playerSoft} />
                )}
              </div>
              <div className="flex gap-2 sm:gap-2.5 min-h-[5.5rem] sm:min-h-[7rem] items-end">
                <AnimatePresence mode="popLayout">
                  {game ? game.playerHand.map((card, i) => (
                    <CardDisplay key={`p-${i}-${card.rank}-${card.suit}`} card={card} index={i} isNew={i >= prevPlayerCards} />
                  )) : <PlaceholderCards />}
                </AnimatePresence>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-6 pt-4 border-t border-white/[0.05]">
              <AnimatePresence mode="wait">
                {!game || isOver ? (
                  <motion.div
                    key="deal"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {/* Play Again shortcut */}
                    {isOver && lastBet && (
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleDeal(lastBet)}
                        disabled={isPending || cash < lastBet}
                        className="w-full py-3 rounded-xl bg-white/10 text-white font-bold text-sm hover:bg-white/15 disabled:opacity-30 transition-colors border border-white/10"
                      >
                        {language === "ko" ? `다시 ($${lastBet.toFixed(2)})` : `SAME BET ($${lastBet.toFixed(2)})`}
                      </motion.button>
                    )}

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
                                ? `bg-gradient-to-b ${colors.bg} ${colors.text} ${colors.border} ring-2 ring-white/40 ring-offset-1 ring-offset-[#0d6b32] shadow-lg`
                                : `bg-gradient-to-b ${colors.bg} ${colors.text} ${colors.border} opacity-70 hover:opacity-100`
                            }`}
                          >
                            {label}
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Deal button */}
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleDeal()}
                      disabled={isPending || !isAuthenticated || cash < parseFloat(betAmount || "0")}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold text-sm hover:from-yellow-400 hover:to-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg shadow-yellow-500/15"
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                        language === "ko" ? `$${parseFloat(betAmount || "0").toFixed(2)} 딜` : `DEAL $${parseFloat(betAmount || "0").toFixed(2)}`}
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="actions"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="grid grid-cols-3 gap-2.5">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => hitMutation.mutate()}
                        disabled={isPending}
                        className="py-3.5 rounded-xl bg-[#00C805] text-white font-bold text-sm disabled:opacity-40 transition-colors shadow-md"
                      >
                        {hitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                          <span>{language === "ko" ? "히트" : "HIT"} <span className="text-white/40 text-[9px]">H</span></span>}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => standMutation.mutate()}
                        disabled={isPending}
                        className="py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm disabled:opacity-40 transition-colors shadow-md"
                      >
                        {standMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                          <span>{language === "ko" ? "스탠드" : "STAND"} <span className="text-white/40 text-[9px]">S</span></span>}
                      </motion.button>
                      <motion.button
                        whileHover={canDouble ? { scale: 1.02 } : {}}
                        whileTap={canDouble ? { scale: 0.96 } : {}}
                        onClick={() => canDouble && doubleMutation.mutate()}
                        disabled={isPending || !canDouble}
                        className={`py-3.5 rounded-xl font-bold text-sm transition-colors shadow-md ${
                          canDouble
                            ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-black disabled:opacity-40"
                            : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                        }`}
                      >
                        {doubleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                          <span>{language === "ko" ? "더블" : "DBL"} <span className={canDouble ? "text-black/30" : "text-zinc-600"} style={{ fontSize: 9 }}>D</span></span>}
                      </motion.button>
                    </div>
                    <p className="text-center text-[9px] text-white/15 mt-2 font-mono">H / S / D</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Rules */}
        <p className="text-center text-[10px] text-zinc-600 mt-4 font-mono">
          {language === "ko"
            ? "딜러 17 스탠드 · 블랙잭 3:2 · 더블다운 첫 패"
            : "Dealer stands 17 · BJ pays 3:2 · Double on first hand"}
        </p>

      </div>
    </div>
  );
}
