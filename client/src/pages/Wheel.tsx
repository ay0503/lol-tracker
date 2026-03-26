import { useState, useCallback, useRef } from "react";
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

// Full segment list (50 segments)
const SEGMENTS = [
  0, 1.5, 2, 1.5, 3, 1.5, 2, 1.5, 5, 1.5, 2, 1.5, 3, 1.5, 2, 1.5, 10, 1.5, 2, 1.5,
  3, 1.5, 2, 1.5, 50, 1.5, 2, 1.5, 3, 1.5, 2, 1.5, 5, 1.5, 2, 1.5, 3, 1.5, 2, 1.5,
  5, 1.5, 2, 1.5, 3, 1.5, 2, 1.5, 3, 2,
];

function getSegmentColor(mult: number): string {
  if (mult === 0) return "#374151";
  if (mult === 50) return "#facc15";
  if (mult === 10) return "#ef4444";
  if (mult === 5) return "#f97316";
  if (mult === 3) return "#a855f7";
  if (mult === 2) return "#22c55e";
  return "#3b82f6";
}

export default function Wheel() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [selectedChip, setSelectedChip] = useState(0.50);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastResult, setLastResult] = useState<any>(null);
  const totalSpinsRef = useRef(0);

  const { data: balance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: history, refetch: refetchHistory } = trpc.casino.wheel.history.useQuery(undefined, { staleTime: 10_000 });

  const spinMutation = trpc.casino.wheel.spin.useMutation({
    onSuccess: (result) => {
      const segAngle = 360 / SEGMENTS.length;
      const targetAngle = result.segmentIndex * segAngle + segAngle / 2;
      totalSpinsRef.current += 5; // 5 full rotations
      const finalRotation = totalSpinsRef.current * 360 + (360 - targetAngle);
      setRotation(finalRotation);

      setTimeout(() => {
        setSpinning(false);
        setLastResult(result);
        refetchBalance();
        refetchHistory();
        if (result.multiplier > 0) {
          toast.success(`${result.multiplier}x — Won $${result.payout.toFixed(2)}`);
        } else {
          toast.error("0x — Lost!");
        }
        setTimeout(() => setLastResult(null), 3000);
      }, 3500);
    },
    onError: (err) => { setSpinning(false); toast.error(err.message); },
  });

  const cash = balance ?? 20;

  const handleSpin = useCallback(() => {
    if (spinning || !isAuthenticated) return;
    setSpinning(true);
    setLastResult(null);
    spinMutation.mutate({ bet: selectedChip });
  }, [selectedChip, spinning]);

  // Build conic-gradient for the wheel
  const conicStops = SEGMENTS.map((mult, idx) => {
    const startPct = (idx / SEGMENTS.length) * 100;
    const endPct = ((idx + 1) / SEGMENTS.length) * 100;
    return `${getSegmentColor(mult)} ${startPct}% ${endPct}%`;
  }).join(", ");

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <div className="container py-6 sm:py-8 max-w-lg mx-auto px-4">
        <Link href="/casino" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mb-5">
          <ArrowLeft className="w-3.5 h-3.5" /> Casino
        </Link>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/25 to-orange-600/15 border border-yellow-500/20">
              <span className="text-lg">🎡</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-[var(--font-heading)]">Wheel</h1>
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
                  <div key={idx} className="flex-shrink-0 px-1.5 h-5 rounded flex items-center justify-center text-[7px] font-mono font-bold text-white"
                    style={{ backgroundColor: getSegmentColor(rr.multiplier) + "80" }}>
                    {rr.multiplier}x
                  </div>
                ))}
              </div>
            )}

            {/* Wheel */}
            <div className="relative flex justify-center mb-4">
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
                <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[14px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-lg" />
              </div>

              {/* Spinning Wheel */}
              <div
                className="w-56 h-56 sm:w-64 sm:h-64 rounded-full border-4 border-zinc-700 shadow-2xl"
                style={{
                  background: `conic-gradient(${conicStops})`,
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? "transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
                }}
              >
                {/* Center hub */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-zinc-900 border-2 border-zinc-600 flex items-center justify-center shadow-lg">
                    <span className="text-[10px] font-bold text-zinc-400">SPIN</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Result */}
            <AnimatePresence>
              {lastResult && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                  className="text-center mb-3">
                  <p className={`text-3xl font-bold font-mono ${lastResult.multiplier > 0 ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                    {lastResult.multiplier}x
                  </p>
                  <p className={`text-sm font-mono ${lastResult.multiplier > 0 ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                    {lastResult.multiplier > 0 ? `+$${lastResult.payout.toFixed(2)}` : `-$${selectedChip.toFixed(2)}`}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

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

            {/* Spin Button */}
            <motion.button
              whileHover={!spinning ? { scale: 1.01 } : {}}
              whileTap={!spinning ? { scale: 0.98 } : {}}
              onClick={handleSpin}
              disabled={spinning || !isAuthenticated || cash < selectedChip}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-sm disabled:opacity-30 transition-colors shadow-lg"
            >
              {spinning ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                `SPIN · $${selectedChip.toFixed(2)}`}
            </motion.button>
          </div>
        </div>

        <p className="text-center text-[9px] text-zinc-700 mt-4 font-mono">~3.5% house edge · $250 max payout</p>
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
