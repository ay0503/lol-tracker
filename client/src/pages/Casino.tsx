import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Dice5, Loader2 } from "lucide-react";
import { toast } from "sonner";
import NumberInput from "@/components/NumberInput";

interface Card {
  suit: string;
  rank: string;
  hidden?: boolean;
}

function CardDisplay({ card, delay = 0 }: { card: Card; delay?: number }) {
  const isRed = card.suit === "♥" || card.suit === "♦";

  if (card.hidden) {
    return (
      <div
        className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 border-border bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center shadow-lg"
        style={{ animationDelay: `${delay}ms` }}
      >
        <span className="text-2xl opacity-30">?</span>
      </div>
    );
  }

  return (
    <div
      className={`w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 bg-card shadow-lg flex flex-col items-center justify-center transition-all ${
        isRed ? "border-red-500/30 text-red-500" : "border-border text-foreground"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-lg sm:text-xl font-bold font-mono leading-none">{card.rank}</span>
      <span className="text-lg sm:text-xl leading-none">{card.suit}</span>
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

export default function Casino() {
  const { t, language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState("10");
  const utils = trpc.useUtils();

  const { data: activeGame } = trpc.casino.blackjack.active.useQuery(undefined, {
    enabled: isAuthenticated,
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

  const statusMessage = !game ? null :
    game.status === "blackjack" ? { text: "BLACKJACK! 🃏", color: "text-yellow-400" } :
    game.status === "player_win" ? { text: language === "ko" ? "승리!" : "You Win!", color: "text-[#00C805]" } :
    game.status === "dealer_bust" ? { text: language === "ko" ? "딜러 버스트! 승리!" : "Dealer Bust! You Win!", color: "text-[#00C805]" } :
    game.status === "player_bust" ? { text: language === "ko" ? "버스트!" : "Bust!", color: "text-[#FF5252]" } :
    game.status === "dealer_win" ? { text: language === "ko" ? "딜러 승리" : "Dealer Wins", color: "text-[#FF5252]" } :
    game.status === "push" ? { text: language === "ko" ? "무승부" : "Push", color: "text-yellow-400" } :
    null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" />
          {t.common.back} $DORI
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-yellow-500/20">
            <Dice5 className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground font-[var(--font-heading)]">
              {language === "ko" ? "카지노" : "Casino"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {language === "ko" ? "블랙잭 — $DORI 캐시로 플레이" : "Blackjack — play with your $DORI cash"}
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-b from-green-950/40 to-green-900/20 border border-green-800/30 rounded-2xl p-6 sm:p-8">
          {/* Dealer hand */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {language === "ko" ? "딜러" : "Dealer"}
              </span>
              {game && (
                <span className="text-xs font-mono text-muted-foreground">
                  ({handValue(game.dealerHand)})
                </span>
              )}
            </div>
            <div className="flex gap-2 min-h-[7rem]">
              {game ? game.dealerHand.map((card, i) => (
                <CardDisplay key={i} card={card} delay={i * 100} />
              )) : (
                <div className="flex gap-2 opacity-20">
                  <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 border-dashed border-border" />
                  <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 border-dashed border-border" />
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          {statusMessage && (
            <div className="text-center my-6">
              <p className={`text-2xl font-bold ${statusMessage.color}`}>{statusMessage.text}</p>
              {isOver && game.payout > 0 && (
                <p className="text-sm text-[#00C805] font-mono mt-1">+${game.payout.toFixed(2)}</p>
              )}
              {isOver && game.payout === 0 && (
                <p className="text-sm text-[#FF5252] font-mono mt-1">-${game.bet.toFixed(2)}</p>
              )}
            </div>
          )}

          {/* Player hand */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {language === "ko" ? "내 패" : "Your Hand"}
              </span>
              {game && (
                <span className="text-xs font-mono text-foreground font-bold">
                  ({handValue(game.playerHand)})
                </span>
              )}
            </div>
            <div className="flex gap-2 min-h-[7rem]">
              {game ? game.playerHand.map((card, i) => (
                <CardDisplay key={i} card={card} delay={i * 100} />
              )) : (
                <div className="flex gap-2 opacity-20">
                  <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 border-dashed border-border" />
                  <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 border-dashed border-border" />
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="border-t border-green-800/30 pt-5">
            {!game || isOver ? (
              /* Deal new game */
              <div className="flex items-center gap-3">
                <NumberInput
                  value={betAmount}
                  onChange={setBetAmount}
                  min={1} max={50} step={5}
                  prefix="$" placeholder="1-50"
                  className="w-32"
                />
                <button
                  onClick={() => {
                    const amt = parseFloat(betAmount);
                    if (isNaN(amt) || amt < 1 || amt > 50) return toast.error("Bet $1-$50");
                    dealMutation.mutate({ bet: amt });
                  }}
                  disabled={isPending || !isAuthenticated}
                  className="flex-1 py-3 rounded-xl bg-yellow-500 text-black font-bold text-sm hover:bg-yellow-400 disabled:opacity-40 transition-all"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : language === "ko" ? "딜!" : "DEAL"}
                </button>
              </div>
            ) : (
              /* Game actions */
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => hitMutation.mutate()}
                  disabled={isPending}
                  className="py-3 rounded-xl bg-[#00C805] text-white font-bold text-sm hover:bg-[#00C805]/80 disabled:opacity-40 transition-all"
                >
                  {language === "ko" ? "히트" : "HIT"}
                </button>
                <button
                  onClick={() => standMutation.mutate()}
                  disabled={isPending}
                  className="py-3 rounded-xl bg-[#FF5252] text-white font-bold text-sm hover:bg-[#FF5252]/80 disabled:opacity-40 transition-all"
                >
                  {language === "ko" ? "스탠드" : "STAND"}
                </button>
                {game.playerHand.length === 2 && (
                  <button
                    onClick={() => doubleMutation.mutate()}
                    disabled={isPending}
                    className="py-3 rounded-xl bg-yellow-500 text-black font-bold text-sm hover:bg-yellow-400 disabled:opacity-40 transition-all"
                  >
                    {language === "ko" ? "더블" : "DOUBLE"}
                  </button>
                )}
              </div>
            )}

            {/* Bet info */}
            {isPlaying && (
              <p className="text-center text-xs text-muted-foreground mt-3 font-mono">
                {language === "ko" ? "베팅" : "Bet"}: ${game.bet.toFixed(2)}
              </p>
            )}
          </div>
        </div>

        {/* Quick bet amounts */}
        {(!game || isOver) && (
          <div className="flex gap-2 mt-4 justify-center">
            {[1, 5, 10, 25, 50].map(amt => (
              <button
                key={amt}
                onClick={() => setBetAmount(String(amt))}
                className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all ${
                  betAmount === String(amt)
                    ? "bg-yellow-500 text-black"
                    : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
