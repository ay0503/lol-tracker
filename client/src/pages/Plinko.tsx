import { useState, useCallback, useRef, useEffect } from "react";
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

const ROWS = 12;
const BUCKETS = 13;

const MULTIPLIERS: Record<string, number[]> = {
  low: [5.6, 2.1, 1.4, 1.1, 1, 0.5, 0.3, 0.5, 1, 1.1, 1.4, 2.1, 5.6],
  medium: [13, 3, 1.5, 1, 0.5, 0.3, 0.3, 0.3, 0.5, 1, 1.5, 3, 13],
  high: [110, 41, 10, 5, 3, 1.5, 0.5, 1.5, 3, 5, 10, 41, 110],
};

function getBucketColor(mult: number): string {
  if (mult >= 10) return "bg-yellow-500 text-black";
  if (mult >= 3) return "bg-orange-500 text-white";
  if (mult >= 1) return "bg-emerald-600 text-white";
  return "bg-red-600 text-white";
}

export default function Plinko() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [selectedChip, setSelectedChip] = useState(0.50);
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [dropping, setDropping] = useState(false);
  const [ballRow, setBallRow] = useState(-1);
  const [ballCol, setBallCol] = useState(6); // Start centered
  const [landedBucket, setLandedBucket] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: balance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: history, refetch: refetchHistory } = trpc.casino.plinko.history.useQuery(undefined, { staleTime: 10_000 });

  // Cleanup animation timers
  useEffect(() => {
    return () => { if (animTimerRef.current) clearTimeout(animTimerRef.current); };
  }, []);

  const dropMutation = trpc.casino.plinko.drop.useMutation({
    onSuccess: (result) => {
      // Animate ball through path
      let position = 6; // Start centered (column 6 of 13)
      setBallRow(0);
      setBallCol(6);

      const animateStep = (step: number) => {
        if (step >= result.path.length) {
          // Ball landed
          setLandedBucket(result.bucket);
          setDropping(false);
          setLastResult(result);
          refetchBalance();
          refetchHistory();
          if (result.multiplier > 0) {
            toast.success(`${result.multiplier}x — $${result.payout.toFixed(2)}`);
          }
          setTimeout(() => {
            setLastResult(null);
            setLandedBucket(null);
            setBallRow(-1);
          }, 2500);
          return;
        }

        const dir = result.path[step];
        position += dir === "R" ? 0.5 : -0.5;
        setBallRow(step + 1);
        setBallCol(position);
        animTimerRef.current = setTimeout(() => animateStep(step + 1), 150);
      };

      animTimerRef.current = setTimeout(() => animateStep(0), 200);
    },
    onError: (err) => { setDropping(false); toast.error(err.message); },
  });

  const cash = balance ?? 20;
  const mults = MULTIPLIERS[risk];

  const handleDrop = useCallback(() => {
    if (dropping || !isAuthenticated) return;
    setDropping(true);
    setLastResult(null);
    setLandedBucket(null);
    dropMutation.mutate({ bet: selectedChip, risk });
  }, [selectedChip, risk, dropping]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <div className="container py-6 sm:py-8 max-w-lg mx-auto px-4">
        <Link href="/casino" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mb-5">
          <ArrowLeft className="w-3.5 h-3.5" /> Casino
        </Link>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/25 to-rose-600/15 border border-pink-500/20">
              <span className="text-lg">📌</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-[var(--font-heading)]">Plinko</h1>
              <p className="text-xs text-zinc-400 font-mono">${cash.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/80 to-zinc-900" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

          <div className="relative p-3 sm:p-5">
            {/* Results Strip */}
            {history && history.length > 0 && (
              <div className="flex gap-1 overflow-x-auto mb-2 pb-0.5 scrollbar-hide">
                {history.slice(0, 15).map((rr, idx) => (
                  <div key={idx} className={`flex-shrink-0 px-1.5 h-5 rounded flex items-center justify-center text-[7px] font-mono font-bold ${
                    rr.multiplier >= 3 ? "bg-yellow-500/30 text-yellow-400" :
                    rr.multiplier >= 1 ? "bg-emerald-600/30 text-emerald-400" :
                    "bg-red-600/30 text-red-400"
                  }`}>
                    {rr.multiplier}x
                  </div>
                ))}
              </div>
            )}

            {/* Peg Board */}
            <div className="relative mx-auto mb-2" style={{ maxWidth: 340 }}>
              {/* Pegs */}
              {Array.from({ length: ROWS }).map((_, row) => (
                <div key={row} className="flex justify-center gap-0" style={{ marginBottom: 2 }}>
                  {Array.from({ length: row + 3 }).map((_, col) => (
                    <div key={col} className="w-5 h-5 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    </div>
                  ))}
                </div>
              ))}

              {/* Ball */}
              <AnimatePresence>
                {ballRow >= 0 && dropping && (
                  <motion.div
                    key="ball"
                    initial={{ top: 0, left: "50%" }}
                    animate={{
                      top: `${(ballRow / ROWS) * 100}%`,
                      left: `${(ballCol / BUCKETS) * 100}%`,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/50 z-10"
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Buckets */}
            <div className="flex gap-0.5 mb-3">
              {mults.map((mult, idx) => (
                <div
                  key={idx}
                  className={`flex-1 py-1.5 rounded text-center text-[7px] sm:text-[8px] font-mono font-bold transition-all ${getBucketColor(mult)} ${
                    landedBucket === idx ? "ring-2 ring-yellow-400 scale-110 z-10" : ""
                  }`}
                >
                  {mult}x
                </div>
              ))}
            </div>

            {/* Result */}
            <AnimatePresence>
              {lastResult && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                  className="text-center mb-2">
                  <p className={`text-2xl font-bold font-mono ${lastResult.multiplier >= 1 ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                    {lastResult.multiplier}x · {lastResult.payout > 0 ? `+$${lastResult.payout.toFixed(2)}` : `-$${selectedChip.toFixed(2)}`}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Risk Selector */}
            <div className="flex gap-1.5 justify-center mb-3">
              {(["low", "medium", "high"] as const).map(rk => (
                <button key={rk} onClick={() => !dropping && setRisk(rk)} disabled={dropping}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                    risk === rk
                      ? rk === "high" ? "bg-red-500/30 text-red-300 border border-red-500/40" :
                        rk === "medium" ? "bg-yellow-500/30 text-yellow-300 border border-yellow-500/40" :
                        "bg-emerald-500/30 text-emerald-300 border border-emerald-500/40"
                      : "bg-zinc-800 text-zinc-500 border border-zinc-700/30 hover:text-zinc-300"
                  }`}>{rk}</button>
              ))}
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

            {/* Drop Button */}
            <motion.button
              whileHover={!dropping ? { scale: 1.01 } : {}}
              whileTap={!dropping ? { scale: 0.98 } : {}}
              onClick={handleDrop}
              disabled={dropping || !isAuthenticated || cash < selectedChip}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm disabled:opacity-30 transition-colors shadow-lg"
            >
              {dropping ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                `DROP · $${selectedChip.toFixed(2)}`}
            </motion.button>
          </div>
        </div>

        <p className="text-center text-[9px] text-zinc-700 mt-4 font-mono">2-3% house edge · $500 max payout</p>
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
