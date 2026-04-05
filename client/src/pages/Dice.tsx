import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Loader2, Dice5 as Dice5Icon } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";
import CasinoGameLog from "@/components/CasinoGameLog";
import AppNav from "@/components/AppNav";
import CasinoSubNav from "@/components/CasinoSubNav";
import CasinoBetControls, {
  MAX_CASINO_BET,
  MIN_CASINO_BET,
  parseCasinoBetAmount,
} from "@/components/CasinoBetControls";

export default function Dice() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState("0.50");
  const [target, setTarget] = useState(50);
  const [direction, setDirection] = useState<"over" | "under">("over");
  const [lastResult, setLastResult] = useState<any>(null);
  const [lastBetAmount, setLastBetAmount] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [displayRoll, setDisplayRoll] = useState<number | null>(null);
  const [barFlash, setBarFlash] = useState<"win" | "lose" | null>(null);

  const { data: balance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: history, refetch: refetchHistory } = trpc.casino.dice.history.useQuery(undefined, { staleTime: 10_000 });

  const rollMutation = trpc.casino.dice.roll.useMutation({
    onSuccess: (result) => {
      // Start indicator at 0, animate to result position on the bar
      setDisplayRoll(0);
      requestAnimationFrame(() => setDisplayRoll(result.roll));

      // After animation (~1.3s), show result
      setTimeout(() => {
        setRolling(false);
        setLastResult(result);
        refetchBalance();
        refetchHistory();
        if (result.won) {
          setBarFlash("win");
          toast.success(`${result.roll.toFixed(2)} — Won $${result.payout.toFixed(2)} (${result.multiplier}x)`);
        } else {
          setBarFlash("lose");
          toast.error(`${result.roll.toFixed(2)} — Lost`);
        }
        setTimeout(() => { setBarFlash(null); setLastResult(null); setDisplayRoll(null); }, 2500);
      }, 1300);
    },
    onError: (err) => { setRolling(false); toast.error(err.message); },
  });

  const cash = balance ?? 20;
  const parsedBetAmount = parseCasinoBetAmount(betAmount);
  const multiplier = useMemo(() => {
    if (direction === "over") return Math.round((101 / (99.99 - target)) * 100) / 100;
    return Math.round((101 / target) * 100) / 100;
  }, [target, direction]);
  const winChance = useMemo(() => (
    direction === "over" ? Math.round((99.99 - target) * 100) / 100 : target
  ), [target, direction]);

  const handleRoll = useCallback(() => {
    if (rolling || !isAuthenticated) return;
    if (parsedBetAmount < MIN_CASINO_BET || parsedBetAmount > MAX_CASINO_BET) {
      toast.error(language === "ko" ? "베팅 금액: $0.10 - $50" : "Bet amount: $0.10 - $50");
      return;
    }
    setRolling(true);
    setLastBetAmount(parsedBetAmount);
    setBarFlash(null);
    rollMutation.mutate({ bet: parsedBetAmount, target, direction });
  }, [direction, isAuthenticated, language, parsedBetAmount, rolling, rollMutation, target]);

  const isWinZoneLeft = direction === "under";

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-card via-background to-background">
      <AppNav />
      <CasinoSubNav />
      <div className="container py-8 sm:py-8 max-w-lg mx-auto px-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/25 to-blue-600/15 border border-cyan-500/20">
              <Dice5Icon className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground font-[var(--font-heading)]">Dice</h1>
              <p className="text-xs text-muted-foreground font-mono">${cash.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-b from-secondary/80 to-card" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

          <div className="relative p-4 sm:p-6">
            {/* Results Strip */}
            {history && history.length > 0 && (
              <div className="flex gap-1 overflow-x-auto mb-3 pb-0.5 scrollbar-hide">
                {history.slice(0, 15).map((rr: any, idx: number) => (
                  <div key={idx} className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${rr.won ? "bg-emerald-600 text-foreground" : "bg-red-600 text-foreground"}`}>
                    {rr.roll.toFixed(0)}
                  </div>
                ))}
              </div>
            )}

            {/* Result Number */}
            <div className="text-center mb-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={lastResult?.roll ?? "idle"}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`text-4xl font-bold font-mono ${
                    lastResult ? (lastResult.won ? "text-[color:var(--color-win)]" : "text-[color:var(--color-loss)]") : "text-foreground/30"
                  }`}
                >
                  {displayRoll !== null ? displayRoll.toFixed(2) : "—"}
                </motion.div>
              </AnimatePresence>
              {lastResult && (
                <p className={`text-sm font-mono mt-0.5 ${lastResult.won ? "text-[color:var(--color-win)]" : "text-[color:var(--color-loss)]"}`}>
                  {lastResult.won ? `+$${lastResult.payout.toFixed(2)}` : `-$${(lastBetAmount ?? parsedBetAmount).toFixed(2)}`}
                </p>
              )}
            </div>

            {/* ─── Animated Result Bar ─── */}
            <div className={`relative w-full h-12 rounded-xl overflow-hidden bg-secondary border transition-all duration-300 mb-4 ${
              barFlash === "win" ? "border-[color:var(--color-win)] shadow-lg shadow-[color:var(--color-win)]/30" :
              barFlash === "lose" ? "border-[color:var(--color-loss)] shadow-lg shadow-[color:var(--color-loss)]/30" :
              "border-border"
            }`}>
              {/* Win zone (green) */}
              <div
                className="absolute inset-y-0 transition-all duration-300"
                style={{
                  left: isWinZoneLeft ? "0%" : `${target}%`,
                  width: isWinZoneLeft ? `${target}%` : `${100 - target}%`,
                  background: "linear-gradient(90deg, rgba(0,200,5,0.15) 0%, rgba(0,200,5,0.3) 100%)",
                }}
              />
              {/* Lose zone (red) */}
              <div
                className="absolute inset-y-0 transition-all duration-300"
                style={{
                  left: isWinZoneLeft ? `${target}%` : "0%",
                  width: isWinZoneLeft ? `${100 - target}%` : `${target}%`,
                  background: "linear-gradient(90deg, rgba(255,82,82,0.1) 0%, rgba(255,82,82,0.2) 100%)",
                }}
              />

              {/* Tick marks every 10 */}
              {Array.from({ length: 9 }, (_, idx) => (idx + 1) * 10).map(tick => (
                <div key={tick} className="absolute top-0 bottom-0 w-px bg-white/[0.06]" style={{ left: `${tick}%` }} />
              ))}

              {/* Target line — pulses when idle */}
              <motion.div
                className="absolute top-0 bottom-0 w-0.5 z-10"
                style={{ left: `${target}%` }}
                animate={!rolling ? {
                  boxShadow: ["0 0 8px rgba(250,204,21,0.4)", "0 0 16px rgba(250,204,21,0.8)", "0 0 8px rgba(250,204,21,0.4)"],
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="w-full h-full bg-yellow-400" />
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-mono font-bold text-yellow-400">
                  {target}
                </div>
              </motion.div>

              {/* Rolling indicator — glowing white dot that races across */}
              {displayRoll !== null && (
                <motion.div
                  className="absolute top-1 bottom-1 w-1 rounded-full z-20"
                  style={{
                    background: "white",
                    boxShadow: "0 0 12px rgba(255,255,255,0.8), 0 0 24px rgba(255,255,255,0.4)",
                  }}
                  initial={{ left: "0%" }}
                  animate={{ left: `${displayRoll}%` }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </div>

            {/* Target Slider */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>1</span>
                <span className="font-bold text-foreground text-xs">{target}</span>
                <span>99</span>
              </div>
              <input
                type="range" min={1} max={99} value={target}
                onChange={(ev) => setTarget(Number(ev.target.value))}
                className="w-full accent-yellow-500" disabled={rolling}
              />
            </div>

            {/* Direction Toggle */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => setDirection("over")} disabled={rolling}
                className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                  direction === "over" ? "bg-[color:var(--color-win)] text-foreground shadow-lg shadow-[color:var(--color-win)]/20" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}>
                Roll Over {target}
              </button>
              <button onClick={() => setDirection("under")} disabled={rolling}
                className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                  direction === "under" ? "bg-[color:var(--color-loss)] text-foreground shadow-lg shadow-[color:var(--color-loss)]/20" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}>
                Roll Under {target}
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`bg-secondary/50 rounded-lg p-2.5 text-center transition-all ${
                multiplier > 5 ? "ring-1 ring-yellow-500/30 shadow-md shadow-yellow-500/10" : ""
              }`}>
                <p className="text-xs text-muted-foreground uppercase">Multiplier</p>
                <p className="text-lg font-bold text-yellow-400 font-mono">{multiplier}x</p>
              </div>
              <div className={`bg-secondary/50 rounded-lg p-2.5 text-center transition-all ${
                winChance < 20 ? "ring-1 ring-red-500/30 shadow-md shadow-red-500/10" : ""
              }`}>
                <p className="text-xs text-muted-foreground uppercase">Win Chance</p>
                <p className="text-lg font-bold text-foreground font-mono">{winChance}%</p>
              </div>
            </div>

            <div className="mb-3">
              <CasinoBetControls
                language={language}
                value={betAmount}
                cash={cash}
                disabled={rolling}
                onChange={setBetAmount}
              />
            </div>

            {/* Roll Button */}
            <motion.button
              whileHover={!rolling ? { scale: 1.01 } : {}}
              whileTap={!rolling ? { scale: 0.98 } : {}}
              onClick={handleRoll}
              disabled={
                rolling ||
                !isAuthenticated ||
                parsedBetAmount < MIN_CASINO_BET ||
                parsedBetAmount > MAX_CASINO_BET ||
                cash < parsedBetAmount
              }
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-foreground font-bold text-sm disabled:opacity-30 transition-colors shadow-lg"
            >
              {rolling ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `ROLL · $${parsedBetAmount.toFixed(2)}`}
            </motion.button>
          </div>
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
