import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Loader2, Trophy, TrendingUp, TrendingDown, Dice5, CircleCheck, CircleX } from "lucide-react";
import NumberInput from "./NumberInput";

export default function BettingPanel() {
  const { t, language } = useTranslation();
  const [amount, setAmount] = useState("");
  const [prediction, setPrediction] = useState<"win" | "loss" | null>(null);

  const utils = trpc.useUtils();
  const { data: myBets } = trpc.betting.myBets.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: pendingPool } = trpc.betting.pending.useQuery(undefined, { refetchInterval: 30_000 });

  const placeMutation = trpc.betting.place.useMutation({
    onSuccess: () => {
      toast.success(prediction === "win" ? "Bet placed: WIN" : "Bet placed: LOSS");
      setAmount("");
      setPrediction(null);
      utils.betting.myBets.invalidate();
      utils.betting.pending.invalidate();
      utils.trading.portfolio.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const hasPendingBet = myBets?.some(b => b.status === "pending");
  const pendingBet = myBets?.find(b => b.status === "pending");
  const recentBets = myBets?.filter(b => b.status !== "pending").slice(0, 5) ?? [];

  const handlePlace = () => {
    if (!prediction || !amount) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 1 || amt > 50) {
      toast.error("Bet amount must be between $1 and $50");
      return;
    }
    placeMutation.mutate({ prediction, amount: amt });
  };

  return (
    <div className="bg-card/50 backdrop-blur-xl border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Dice5 className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-bold font-[var(--font-heading)]">
          {language === "ko" ? "다음 게임 베팅" : "Bet on Next Game"}
        </h3>
        {pendingPool && pendingPool.total > 0 && (
          <span className="ml-auto text-xs text-muted-foreground font-mono">
            {pendingPool.total} bet{pendingPool.total !== 1 ? "s" : ""} · ${pendingPool.totalPool.toFixed(0)} pool
          </span>
        )}
      </div>

      {hasPendingBet && pendingBet ? (
        <div className="text-center py-3">
          <p className="text-sm font-bold text-foreground">
            {language === "ko" ? "베팅 진행 중" : "Bet Active"}
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              pendingBet.prediction === "win"
                ? "bg-[color:var(--color-win)]/20 text-[color:var(--color-win)]"
                : "bg-[color:var(--color-loss)]/20 text-[color:var(--color-loss)]"
            }`}>
              {pendingBet.prediction === "win" ? "WIN" : "LOSS"}
            </span>
            <span className="text-sm font-mono font-bold">${pendingBet.amount.toFixed(2)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {language === "ko" ? "게임 끝나면 자동 정산됩니다" : "Auto-resolved when game ends"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Prediction buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPrediction("win")}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                prediction === "win"
                  ? "bg-[color:var(--color-win)] text-white shadow-lg shadow-[color:var(--color-win)]/25"
                  : "bg-[color:var(--color-win)]/10 text-[color:var(--color-win)] hover:bg-[color:var(--color-win)]/20 border border-[color:var(--color-win)]/30"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              WIN
            </button>
            <button
              onClick={() => setPrediction("loss")}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                prediction === "loss"
                  ? "bg-[color:var(--color-loss)] text-white shadow-lg shadow-[color:var(--color-loss)]/25"
                  : "bg-[color:var(--color-loss)]/10 text-[color:var(--color-loss)] hover:bg-[color:var(--color-loss)]/20 border border-[color:var(--color-loss)]/30"
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              LOSS
            </button>
          </div>

          {/* Amount input */}
          <div className="flex gap-2">
            <NumberInput
              value={amount}
              onChange={setAmount}
              min={1}
              max={50}
              step={5}
              placeholder="1-50"
              prefix="$"
              className="flex-1"
            />
            <button
              onClick={handlePlace}
              disabled={!prediction || !amount || placeMutation.isPending}
              className="px-4 py-2 rounded-xl bg-yellow-500 text-black text-xs font-bold hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {placeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "BET"}
            </button>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-1.5">
            {[5, 10, 25, 50].map(amt => (
              <button
                key={amt}
                onClick={() => setAmount(String(amt))}
                className="flex-1 py-1 rounded-lg bg-secondary/50 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                ${amt}
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {language === "ko"
              ? "맞추면 2배! 다음 솔랭 결과에 베팅하세요"
              : "2x payout if correct! Bet on next ranked game result"}
          </p>
        </div>
      )}

      {/* Recent bet history */}
      {recentBets.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
            {language === "ko" ? "최근 베팅" : "Recent Bets"}
          </p>
          <div className="space-y-1">
            {recentBets.map(bet => (
              <div key={bet.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className={bet.status === "won" ? "text-[color:var(--color-win)]" : "text-[color:var(--color-loss)]"}>
                    {bet.status === "won" ? <CircleCheck className="w-3 h-3" /> : <CircleX className="w-3 h-3" />}
                  </span>
                  <span className="font-mono">{bet.prediction.toUpperCase()}</span>
                  <span className="text-muted-foreground font-mono">${bet.amount.toFixed(0)}</span>
                </div>
                {bet.status === "won" && bet.payout && (
                  <span className="text-[color:var(--color-win)] font-mono font-bold">+${bet.payout.toFixed(0)}</span>
                )}
                {bet.status === "lost" && (
                  <span className="text-[color:var(--color-loss)] font-mono">-${bet.amount.toFixed(0)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
