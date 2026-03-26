import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";

const CHIP_COLORS: Record<number, { bg: string; border: string; txt: string }> = {
  0.10: { bg: "from-blue-400 to-blue-600", border: "border-blue-300/50", txt: "text-white" },
  0.25: { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", txt: "text-white" },
  0.50: { bg: "from-red-400 to-red-600", border: "border-red-300/50", txt: "text-white" },
  1: { bg: "from-gray-100 to-gray-300", border: "border-gray-200/50", txt: "text-gray-800" },
  2: { bg: "from-pink-400 to-pink-600", border: "border-pink-300/50", txt: "text-white" },
  5: { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50", txt: "text-black" },
};

export default function Dice() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [selectedChip, setSelectedChip] = useState(0.50);
  const [target, setTarget] = useState(50);
  const [direction, setDirection] = useState<"over" | "under">("over");
  const [lastResult, setLastResult] = useState<any>(null);
  const [rolling, setRolling] = useState(false);
  const [displayRoll, setDisplayRoll] = useState<number | null>(null);

  const { data: balance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: history, refetch: refetchHistory } = trpc.casino.dice.history.useQuery(undefined, { staleTime: 10_000 });

  const rollMutation = trpc.casino.dice.roll.useMutation({
    onSuccess: (result) => {
      // Animate roll
      let count = 0;
      const interval = setInterval(() => {
        setDisplayRoll(Math.floor(Math.random() * 10000) / 100);
        count++;
        if (count >= 15) {
          clearInterval(interval);
          setDisplayRoll(result.roll);
          setRolling(false);
          setLastResult(result);
          refetchBalance();
          refetchHistory();
          if (result.won) {
            toast.success(`${result.roll.toFixed(2)} — Won $${result.payout.toFixed(2)} (${result.multiplier}x)`);
          } else {
            toast.error(`${result.roll.toFixed(2)} — Lost`);
          }
          setTimeout(() => { setLastResult(null); setDisplayRoll(null); }, 3000);
        }
      }, 50);
    },
    onError: (err) => { setRolling(false); toast.error(err.message); },
  });

  const cash = balance ?? 20;
  const multiplier = useMemo(() => {
    if (direction === "over") return Math.round((99 / (99 - target)) * 100) / 100;
    return Math.round((99 / target) * 100) / 100;
  }, [target, direction]);
  const winChance = useMemo(() => direction === "over" ? 99 - target : target, [target, direction]);

  const handleRoll = useCallback(() => {
    if (rolling || !isAuthenticated) return;
    setRolling(true);
    rollMutation.mutate({ bet: selectedChip, target, direction });
  }, [selectedChip, target, direction, rolling]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <div className="container py-6 sm:py-8 max-w-lg mx-auto px-4">
        <Link href="/casino" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mb-5">
          <ArrowLeft className="w-3.5 h-3.5" /> Casino
        </Link>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/25 to-blue-600/15 border border-cyan-500/20">
              <span className="text-lg">🎲</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-[var(--font-heading)]">Dice</h1>
              <p className="text-xs text-zinc-400 font-mono">${cash.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/80 to-zinc-900" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

          <div className="relative p-4 sm:p-6">
            {/* Results Strip */}
            {history && history.length > 0 && (
              <div className="flex gap-1 overflow-x-auto mb-3 pb-0.5 scrollbar-hide">
                {history.slice(0, 15).map((rr, idx) => (
                  <div key={idx} className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[7px] font-mono font-bold ${rr.won ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
                    {rr.roll.toFixed(0)}
                  </div>
                ))}
              </div>
            )}

            {/* Roll Display */}
            <div className="text-center mb-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={displayRoll ?? "idle"}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`text-5xl font-bold font-mono ${
                    lastResult ? (lastResult.won ? "text-[#00C805]" : "text-[#FF5252]") : "text-white"
                  }`}
                >
                  {displayRoll !== null ? displayRoll.toFixed(2) : "—"}
                </motion.div>
              </AnimatePresence>
              {lastResult && (
                <p className={`text-sm font-mono mt-1 ${lastResult.won ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                  {lastResult.won ? `+$${lastResult.payout.toFixed(2)}` : `-$${selectedChip.toFixed(2)}`}
                </p>
              )}
            </div>

            {/* Target Slider */}
            <div className="mb-4">
              <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                <span>1</span>
                <span className="font-bold text-white text-xs">{target}</span>
                <span>99</span>
              </div>
              <input
                type="range"
                min={1}
                max={99}
                value={target}
                onChange={(ev) => setTarget(Number(ev.target.value))}
                className="w-full accent-yellow-500"
                disabled={rolling}
              />
            </div>

            {/* Direction Toggle */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setDirection("over")}
                disabled={rolling}
                className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                  direction === "over" ? "bg-[#00C805] text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                Roll Over {target}
              </button>
              <button
                onClick={() => setDirection("under")}
                disabled={rolling}
                className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                  direction === "under" ? "bg-[#FF5252] text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                Roll Under {target}
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-zinc-800/50 rounded-lg p-2.5 text-center">
                <p className="text-[9px] text-zinc-500 uppercase">Multiplier</p>
                <p className="text-lg font-bold text-yellow-400 font-mono">{multiplier}x</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-2.5 text-center">
                <p className="text-[9px] text-zinc-500 uppercase">Win Chance</p>
                <p className="text-lg font-bold text-white font-mono">{winChance}%</p>
              </div>
            </div>

            {/* Chips */}
            <div className="flex gap-1.5 justify-center mb-3">
              {[0.10, 0.25, 0.50, 1, 2, 5].map(amt => {
                const label = amt < 1 ? `${Math.round(amt * 100)}¢` : `$${amt}`;
                const sel = selectedChip === amt;
                const dis = cash < amt;
                const clr = CHIP_COLORS[amt];
                return (
                  <button key={amt} onClick={() => !dis && setSelectedChip(amt)} disabled={dis}
                    className={`w-10 h-10 rounded-full font-mono font-bold text-[9px] shadow-md border-[2.5px] border-dashed transition-all ${
                      dis ? "opacity-25 bg-gray-700 border-gray-600 text-gray-500" :
                      sel ? `bg-gradient-to-b ${clr.bg} ${clr.txt} ${clr.border} ring-2 ring-white/40` :
                      `bg-gradient-to-b ${clr.bg} ${clr.txt} ${clr.border} opacity-70 hover:opacity-100`
                    }`}>{label}</button>
                );
              })}
            </div>

            {/* Roll Button */}
            <motion.button
              whileHover={!rolling ? { scale: 1.01 } : {}}
              whileTap={!rolling ? { scale: 0.98 } : {}}
              onClick={handleRoll}
              disabled={rolling || !isAuthenticated || cash < selectedChip}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm disabled:opacity-30 transition-colors shadow-lg"
            >
              {rolling ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                `ROLL · $${selectedChip.toFixed(2)}`}
            </motion.button>
          </div>
        </div>

        <p className="text-center text-[9px] text-zinc-700 mt-4 font-mono">1% house edge · $250 max payout</p>
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
