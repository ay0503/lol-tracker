import { useState, useEffect, useRef, useCallback, memo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Dice5, Loader2 } from "lucide-react";
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

interface Card {
  suit: string;
  rank: string;
  hidden?: boolean;
}

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
        <div className="absolute inset-[3px] border border-blue-400/15 rounded-md overflow-hidden">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(96,165,250,0.3) 4px, rgba(96,165,250,0.3) 5px),
                             repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(96,165,250,0.3) 4px, rgba(96,165,250,0.3) 5px)`,
            }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
            <span className="text-blue-300/50 text-[11px] font-bold">D</span>
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
      className="w-[3.75rem] h-[5.25rem] sm:w-[4.75rem] sm:h-[6.75rem] rounded-lg border border-zinc-200 dark:border-border bg-white dark:bg-card shadow-[0_2px_8px_rgba(0,0,0,0.15)] relative overflow-hidden select-none flex-shrink-0"
      style={{ zIndex: index }}
    >
      <div className={`absolute top-1 left-1.5 leading-tight ${isRed ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}>
        <div className="text-[11px] sm:text-sm font-extrabold font-[var(--font-heading)] leading-none">{card.rank}</div>
        <div className="text-[11px] sm:text-xs leading-none">{card.suit}</div>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center ${isRed ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}>
        <span className="text-2xl sm:text-3xl drop-shadow-sm">{card.suit}</span>
      </div>
      <div className={`absolute bottom-1 right-1.5 leading-tight rotate-180 ${isRed ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}>
        <div className="text-[11px] sm:text-sm font-extrabold font-[var(--font-heading)] leading-none">{card.rank}</div>
        <div className="text-[11px] sm:text-xs leading-none">{card.suit}</div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-white/5 to-transparent pointer-events-none rounded-lg" />
    </motion.div>
  );
});

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
        "bg-black/20 text-foreground/80"
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
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.hidden) continue;
    if (card.rank === "A") {
      total += 11;
      aces++;
    } else if (["K", "Q", "J"].includes(card.rank)) {
      total += 10;
    } else {
      total += parseInt(card.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isSoftHand(hand: Card[]): boolean {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.hidden) continue;
    if (card.rank === "A") {
      total += 11;
      aces++;
    } else if (["K", "Q", "J"].includes(card.rank)) {
      total += 10;
    } else {
      total += parseInt(card.rank);
    }
  }
  return aces > 0 && total <= 21;
}

function useCardCount(hand: Card[] | undefined): number {
  const prevRef = useRef(0);
  useEffect(() => {
    if (hand) prevRef.current = hand.length;
  }, [hand]);
  return prevRef.current;
}

function useDealerReveal(game: any) {
  const [revealed, setRevealed] = useState<Card[]>([]);
  const prevStatusRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }

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

    if (prevStatusRef.current === "playing") {
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

    setRevealed([...hand]);
    prevStatusRef.current = game.status;

    return () => {
      if (timerRef.current) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [game?.status, game?.id]);

  return revealed;
}

function useDelayedStatus(game: any) {
  const [visibleStatus, setVisibleStatus] = useState<string | null>(null);
  const prevGameId = useRef<string | null>(null);

  useEffect(() => {
    if (!game) {
      setVisibleStatus(null);
      return;
    }

    if (game.id !== prevGameId.current) {
      setVisibleStatus(game.status === "playing" ? null : game.status);
      prevGameId.current = game.id;
      return;
    }

    if (game.status === "playing") {
      setVisibleStatus(null);
      return;
    }

    const delay = game.dealerHand?.length > 2 ? (game.dealerHand.length - 1) * 500 + 400 : 700;
    const timer = setTimeout(() => {
      setVisibleStatus(game.status);
    }, delay);

    return () => clearTimeout(timer);
  }, [game?.status, game?.id, game?.dealerHand?.length]);

  return visibleStatus;
}

export default function Casino() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState("0.50");
  const [lastBet, setLastBet] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: activeGame } = trpc.casino.blackjack.active.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 30_000,
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
      if (game.status === "player_bust") {
        setTimeout(() => toast.error("Bust! 💥"), 700);
      }
      refetchBalance();
    },
    onError: (err) => {
      toast.error(err.message);
      utils.casino.blackjack.active.invalidate();
    },
  });

  const standMutation = trpc.casino.blackjack.stand.useMutation({
    onSuccess: (game) => {
      utils.casino.blackjack.active.setData(undefined, game as any);
      refetchBalance();
      const dealerCards = game.dealerHand.length;
      const delay = dealerCards > 2 ? (dealerCards - 2) * 500 + 300 : 300;
      setTimeout(() => {
        const status = game.status;
        if (status === "player_win" || status === "dealer_bust") toast.success("You win! 🎉");
        else if (status === "push") toast("Push — bet returned");
        else toast.error("Dealer wins 😞");
      }, delay);
    },
    onError: (err) => {
      toast.error(err.message);
      utils.casino.blackjack.active.invalidate();
    },
  });

  const doubleMutation = trpc.casino.blackjack.double.useMutation({
    onSuccess: (game) => {
      utils.casino.blackjack.active.setData(undefined, game as any);
      refetchBalance();
      setTimeout(() => {
        const status = game.status;
        if (status === "player_win" || status === "dealer_bust") toast.success("Double down wins! 🎉🎉");
        else if (status === "player_bust") toast.error("Bust on double! 💥💥");
        else if (status === "push") toast("Push — bet returned");
        else toast.error("Dealer wins 😞");
      }, 500);
    },
    onError: (err) => {
      toast.error(err.message);
      utils.casino.blackjack.active.invalidate();
    },
  });

  const splitMutation = trpc.casino.blackjack.split.useMutation({
    onSuccess: (game) => {
      utils.casino.blackjack.active.setData(undefined, game as any);
      refetchBalance();
      toast.success(language === "ko" ? "스플릿!" : "Split!");
      if (game.status !== "playing") {
        // Split aces auto-resolved
        setTimeout(() => {
          if (game.payout > 0) toast.success(`Won $${game.payout.toFixed(2)}`);
          else toast.error("Both hands lost");
        }, 1000);
      }
    },
    onError: (err) => {
      toast.error(err.message);
      utils.casino.blackjack.active.invalidate();
    },
  });

  const game = activeGame;
  const isPlaying = game?.status === "playing";
  const isOver = game && game.status !== "playing";
  const isPending = dealMutation.isPending || hitMutation.isPending || standMutation.isPending || doubleMutation.isPending || splitMutation.isPending;
  const isSplitGame = !!(game as any)?.splitHand;
  const activeHand = (game as any)?.activeHand as "main" | "split" | undefined;
  const cash = casinoBalance ?? 20;

  const prevPlayerCards = useCardCount(game?.playerHand);
  const prevDealerCards = useCardCount(game?.dealerHand);
  const dealerRevealed = useDealerReveal(game);
  const visibleStatus = useDelayedStatus(game);

  const playerVal = game ? handValue(game.playerHand) : 0;
  const dealerVal = dealerRevealed.length > 0 ? handValue(dealerRevealed) : 0;
  const playerSoft = game ? isSoftHand(game.playerHand) : false;
  const parsedBetAmount = parseCasinoBetAmount(betAmount);

  const showResult = visibleStatus && visibleStatus !== "playing";
  const isWin = visibleStatus === "player_win" || visibleStatus === "dealer_bust" || visibleStatus === "blackjack";
  const isLoss = visibleStatus === "player_bust" || visibleStatus === "dealer_win";

  const activeHandCards = isSplitGame && activeHand === "split" ? ((game as any)?.splitHand as Card[] ?? []) : game?.playerHand ?? [];
  const activeHandBet = isSplitGame && activeHand === "split" ? ((game as any)?.splitBet as number | undefined) ?? game?.bet ?? 0 : game?.bet ?? 0;
  const canDouble = isPlaying && !!game && activeHandCards.length === 2 && cash >= activeHandBet;
  const canSplitHand = isPlaying && !!game && !isSplitGame && game.playerHand.length === 2 &&
    game.playerHand[0] && game.playerHand[1] &&
    (() => {
      const v1 = ["K","Q","J","10"].includes(game.playerHand[0].rank) ? 10 : game.playerHand[0].rank === "A" ? 11 : parseInt(game.playerHand[0].rank);
      const v2 = ["K","Q","J","10"].includes(game.playerHand[1].rank) ? 10 : game.playerHand[1].rank === "A" ? 11 : parseInt(game.playerHand[1].rank);
      return v1 === v2;
    })() && cash >= game.bet;

  useEffect(() => {
    if (!isPlaying || isPending) return;
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "h" || event.key === "H") hitMutation.mutate();
      if (event.key === "s" || event.key === "S") standMutation.mutate();
      if ((event.key === "d" || event.key === "D") && canDouble) doubleMutation.mutate();
      if ((event.key === "p" || event.key === "P") && canSplitHand) splitMutation.mutate();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPlaying, isPending, canDouble, canSplitHand, hitMutation, standMutation, doubleMutation, splitMutation]);

  const handleDeal = useCallback((amount?: number) => {
    const betVal = amount ?? parsedBetAmount;
    if (Number.isNaN(betVal) || betVal < MIN_CASINO_BET || betVal > MAX_CASINO_BET) {
      return toast.error(language === "ko" ? "베팅 금액: $0.10 - $50" : "Bet amount: $0.10 - $50");
    }
    dealMutation.mutate({ bet: betVal });
  }, [dealMutation, language, parsedBetAmount]);

  const statusConfig = !showResult ? null :
    visibleStatus === "blackjack" ? { text: "BLACKJACK!", emoji: "🃏", color: "text-yellow-400", glow: "shadow-yellow-500/30" } :
    visibleStatus === "player_win" ? { text: language === "ko" ? "승리!" : "You Win!", emoji: "🎉", color: "text-[#00C805]", glow: "shadow-[#00C805]/30" } :
    visibleStatus === "dealer_bust" ? { text: language === "ko" ? "딜러 버스트!" : "Dealer Bust!", emoji: "💥", color: "text-[#00C805]", glow: "shadow-[#00C805]/30" } :
    visibleStatus === "player_bust" ? { text: language === "ko" ? "버스트!" : "Bust!", emoji: "💀", color: "text-[#FF5252]", glow: "shadow-[#FF5252]/30" } :
    visibleStatus === "dealer_win" ? { text: language === "ko" ? "딜러 승리" : "Dealer Wins", emoji: "😞", color: "text-[#FF5252]", glow: "shadow-[#FF5252]/30" } :
    visibleStatus === "push" ? { text: language === "ko" ? "무승부" : "Push", emoji: "🤝", color: "text-yellow-400", glow: "shadow-yellow-500/30" } :
    null;

  const pregameControls = (
    <motion.div
      key="deal"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-3"
    >
      {isOver && lastBet && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => handleDeal(lastBet)}
          disabled={isPending || cash < lastBet}
          className="w-full py-3 rounded-xl bg-white/10 text-foreground font-bold text-sm hover:bg-white/15 disabled:opacity-30 transition-colors border border-white/10"
        >
          {language === "ko" ? `다시 ($${lastBet.toFixed(2)})` : `SAME BET ($${lastBet.toFixed(2)})`}
        </motion.button>
      )}

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
        onClick={() => handleDeal()}
        disabled={
          isPending ||
          !isAuthenticated ||
          parsedBetAmount < MIN_CASINO_BET ||
          parsedBetAmount > MAX_CASINO_BET ||
          cash < parsedBetAmount
        }
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold text-sm hover:from-yellow-400 hover:to-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg shadow-yellow-500/15"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
          language === "ko" ? `$${parsedBetAmount.toFixed(2)} 딜` : `DEAL $${parsedBetAmount.toFixed(2)}`}
      </motion.button>
    </motion.div>
  );

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-card via-background to-background">
      <AppNav />
      <CasinoSubNav />
      <div className="container py-8 sm:py-8 max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/25 to-amber-600/15 border border-yellow-500/20">
              <Dice5 className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground font-[var(--font-heading)]">Blackjack</h1>
              <p className="text-xs text-muted-foreground font-mono">${cash.toFixed(2)}</p>
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

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a5c2a] via-[#0d6b32] to-[#084d23]" />
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.4) 0.5px, transparent 0.5px)",
                backgroundSize: "8px 8px",
              }}
            />
            <div className="absolute inset-3 sm:inset-4 border border-green-500/10 rounded-xl pointer-events-none" />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

            <div className="relative p-5 sm:p-7">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-green-300/50 uppercase tracking-[0.15em]">
                    {language === "ko" ? "딜러" : "Dealer"}
                  </span>
                  {dealerRevealed.length > 0 && (
                    <HandValue value={dealerVal} bust={dealerVal > 21} blackjack={dealerVal === 21 && dealerRevealed.length === 2 && !dealerRevealed.some((card) => card.hidden)} />
                  )}
                </div>
                <div className="flex gap-2 sm:gap-4 min-h-[5.5rem] sm:min-h-[7rem] items-end">
                  <AnimatePresence>
                    {dealerRevealed.length > 0 ? dealerRevealed.map((card, index) => (
                      <CardDisplay key={`d-${index}`} card={card} index={index} isNew={index >= prevDealerCards} />
                    )) : <PlaceholderCards />}
                  </AnimatePresence>
                </div>
              </div>

              <div className="relative min-h-[4.5rem] flex items-center justify-center my-2">
                <div className="absolute inset-x-0 top-1/2 border-t border-white/[0.05]" />
                <AnimatePresence>
                  {statusConfig && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className={`relative z-10 px-5 py-2.5 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-xl ${statusConfig.glow}`}
                    >
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xl">{statusConfig.emoji}</span>
                          <span className={`text-base font-bold ${statusConfig.color}`}>{statusConfig.text}</span>
                        </div>
                        {showResult && game && (
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

              <div className="mt-2">
                {isSplitGame && game ? (
                  /* Split hands view */
                  <div className="grid grid-cols-2 gap-3">
                    {/* Main hand */}
                    <div className={`rounded-xl p-2 transition-all ${activeHand === "main" ? "ring-2 ring-yellow-400/60 bg-white/[0.03]" : "opacity-70"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-semibold text-green-300/50 uppercase tracking-[0.12em]">
                          {language === "ko" ? "핸드 1" : "Hand 1"}
                        </span>
                        <HandValue value={handValue(game.playerHand)} bust={handValue(game.playerHand) > 21} soft={isSoftHand(game.playerHand)} />
                        {activeHand === "main" && <span className="text-[11px] text-yellow-400 animate-pulse">ACTIVE</span>}
                      </div>
                      <div className="flex gap-1.5 min-h-[5rem] items-end flex-wrap">
                        <AnimatePresence>
                          {game.playerHand.map((card: Card, index: number) => (
                            <CardDisplay key={`p1-${index}`} card={card} index={index} isNew={false} />
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                    {/* Split hand */}
                    <div className={`rounded-xl p-2 transition-all ${activeHand === "split" ? "ring-2 ring-yellow-400/60 bg-white/[0.03]" : "opacity-70"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-semibold text-green-300/50 uppercase tracking-[0.12em]">
                          {language === "ko" ? "핸드 2" : "Hand 2"}
                        </span>
                        {(game as any).splitHand && (
                          <HandValue value={handValue((game as any).splitHand)} bust={handValue((game as any).splitHand) > 21} soft={isSoftHand((game as any).splitHand)} />
                        )}
                        {activeHand === "split" && <span className="text-[11px] text-yellow-400 animate-pulse">ACTIVE</span>}
                      </div>
                      <div className="flex gap-1.5 min-h-[5rem] items-end flex-wrap">
                        <AnimatePresence>
                          {((game as any).splitHand as Card[] || []).map((card, index) => (
                            <CardDisplay key={`p2-${index}`} card={card} index={index} isNew={false} />
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Normal single hand view */
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-green-300/50 uppercase tracking-[0.15em]">
                        {language === "ko" ? "내 패" : "You"}
                      </span>
                      {game && (
                        <HandValue value={playerVal} bust={playerVal > 21} blackjack={playerVal === 21 && game.playerHand.length === 2} soft={playerSoft} />
                      )}
                    </div>
                    <div className="flex gap-2 sm:gap-4 min-h-[5.5rem] sm:min-h-[7rem] items-end">
                      <AnimatePresence>
                        {game ? game.playerHand.map((card: Card, index: number) => (
                          <CardDisplay key={`p-${index}`} card={card} index={index} isNew={index >= prevPlayerCards} />
                        )) : <PlaceholderCards />}
                      </AnimatePresence>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-8 pt-4 border-t border-white/[0.05]">
                <AnimatePresence mode="wait">
                  {!game || isOver ? (
                    <motion.div
                      key="deal-mobile"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3 lg:hidden"
                    >
                      {pregameControls}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="actions"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className={`grid gap-4 ${canSplitHand ? "grid-cols-4" : "grid-cols-3"}`}>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => hitMutation.mutate()}
                          disabled={isPending}
                          className="py-3.5 rounded-xl bg-[#00C805] text-foreground font-bold text-sm disabled:opacity-40 transition-colors shadow-md"
                        >
                          {hitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                            <span>{language === "ko" ? "히트" : "HIT"} <span className="text-foreground/40 text-[11px]">H</span></span>}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => standMutation.mutate()}
                          disabled={isPending}
                          className="py-3.5 rounded-xl bg-blue-600 text-foreground font-bold text-sm disabled:opacity-40 transition-colors shadow-md"
                        >
                          {standMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                            <span>{language === "ko" ? "스탠드" : "STAND"} <span className="text-foreground/40 text-[11px]">S</span></span>}
                        </motion.button>
                        <motion.button
                          whileHover={canDouble ? { scale: 1.02 } : {}}
                          whileTap={canDouble ? { scale: 0.96 } : {}}
                          onClick={() => canDouble && doubleMutation.mutate()}
                          disabled={isPending || !canDouble}
                          className={`py-3.5 rounded-xl font-bold text-sm transition-colors shadow-md ${
                            canDouble
                              ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-black disabled:opacity-40"
                              : "bg-zinc-700 text-muted-foreground cursor-not-allowed"
                          }`}
                        >
                          {doubleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                            <span>{language === "ko" ? "더블" : "DBL"} <span className={canDouble ? "text-black/30" : "text-muted-foreground"} style={{ fontSize: 9 }}>D</span></span>}
                        </motion.button>
                        {canSplitHand && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => splitMutation.mutate()}
                            disabled={isPending}
                            className="py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 text-foreground font-bold text-sm disabled:opacity-40 transition-colors shadow-md"
                          >
                            {splitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                              <span>{language === "ko" ? "스플릿" : "SPLIT"} <span className="text-foreground/40 text-[11px]">P</span></span>}
                          </motion.button>
                        )}
                      </div>
                      <p className="text-center text-[11px] text-foreground/15 mt-2 font-mono">{canSplitHand ? "H / S / D / P" : "H / S / D"}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {!game || isOver ? (
            <div className="hidden lg:block rounded-2xl border border-border/80 bg-card p-4 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {language === "ko" ? "베팅 패널" : "Bet Panel"}
              </p>
              {pregameControls}
            </div>
          ) : (
            <div className="hidden lg:block rounded-2xl border border-border/80 bg-card p-4 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {language === "ko" ? "현재 핸드" : "Current Hand"}
              </p>
              <div className="space-y-2 text-xs text-foreground/80">
                <div className="flex items-center justify-between rounded-xl border border-border bg-black/20 px-3 py-2">
                  <span>{language === "ko" ? "베팅" : "Bet"}</span>
                  <span className="font-mono text-foreground">${game.bet.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border bg-black/20 px-3 py-2">
                  <span>{language === "ko" ? "핸드 값" : "Hand"}</span>
                  <span className="font-mono text-foreground">{playerVal}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border bg-black/20 px-3 py-2">
                  <span>{language === "ko" ? "더블 가능" : "Double"}</span>
                  <span className={`font-mono ${canDouble ? "text-yellow-300" : "text-muted-foreground"}`}>
                    {canDouble ? (language === "ko" ? "가능" : "Ready") : (language === "ko" ? "불가" : "Locked")}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-4 font-mono">
          {language === "ko"
            ? "딜러 17 스탠드 · 블랙잭 2:1 · 더블다운 · 스플릿 페어"
            : "Dealer stands 17 · BJ pays 2:1 · Double · Split pairs"}
        </p>
        <p className="text-center text-[11px] text-zinc-700 mt-2 font-mono">
          {language === "ko" ? "플레이어 우위 블랙잭 지급표" : "Player-favored blackjack payouts"}
        </p>

        <CasinoGameLog />
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
