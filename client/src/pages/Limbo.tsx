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

const PRESETS = [1.5, 2, 3, 5, 10, 50];

export default function Limbo() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [selectedChip, setSelectedChip] = useState(0.50);
  const [targetMult, setTargetMult] = useState("2.00");
  const [lastResult, setLastResult] = useState<any>(null);
  const [displayMult, setDisplayMult] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const animRef = useRef<number | undefined>(undefined);

  const { data: balance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: history, refetch: refetchHistory } = trpc.casino.limbo.history.useQuery(undefined, { staleTime: 10_000 });

  const playMutation = trpc.casino.limbo.play.useMutation({
    onSuccess: (result) => {
      // Animate counter from 1.00 up to crashPoint
      const start = Date.now();
      const duration = Math.min(result.crashPoint * 300, 2000);
      const animate = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const current = 1 + (result.crashPoint - 1) * progress;
        setDisplayMult(Math.round(current * 100) / 100);
        if (progress < 1) {
          animRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayMult(result.crashPoint);
          setPlaying(false);
          setLastResult(result);
          refetchBalance();
          refetchHistory();
          if (result.won) {
            toast.success(`${result.crashPoint.toFixed(2)}x — Won $${result.payout.toFixed(2)}`);
          } else {
            toast.error(`${result.crashPoint.toFixed(2)}x — Crashed before ${result.targetMultiplier}x`);
          }
          setTimeout(() => { setLastResult(null); setDisplayMult(null); }, 3000);
        }
      };
      animRef.current = requestAnimationFrame(animate);
    },
    onError: (err) => { setPlaying(false); toast.error(err.message); },
  });

  const cash = balance ?? 20;
  const parsedTarget = parseFloat(targetMult) || 2;
  const winChance = Math.round((99 / parsedTarget) * 100) / 100;

  const handlePlay = useCallback(() => {
    if (playing || !isAuthenticated) return;
    const tm = parseFloat(targetMult);
    if (isNaN(tm) || tm < 1.01 || tm > 1000) { toast.error("Target: 1.01x - 1000x"); return; }
    setPlaying(true);
    playMutation.mutate({ bet: selectedChip, targetMultiplier: tm });
  }, [selectedChip, targetMult, playing]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <div className="container py-6 sm:py-8 max-w-lg mx-auto px-4">
        <Link href="/casino" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mb-5">
          <ArrowLeft className="w-3.5 h-3.5" /> Casino
        </Link>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/25 to-purple-600/15 border border-violet-500/20">
              <span className="text-lg">📈</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-[var(--font-heading)]">Limbo</h1>
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
                  <div key={idx} className={`flex-shrink-0 px-1.5 h-5 rounded flex items-center justify-center text-[7px] font-mono font-bold ${rr.won ? "bg-emerald-600/30 text-emerald-400" : "bg-red-600/30 text-red-400"}`}>
                    {rr.crashPoint.toFixed(2)}x
                  </div>
                ))}
              </div>
            )}

            {/* Crash Point Display */}
            <div className="text-center mb-6 py-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={displayMult ?? "idle"}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`text-5xl sm:text-6xl font-bold font-mono ${
                    lastResult ? (lastResult.won ? "text-[#00C805]" : "text-[#FF5252]") : playing ? "text-yellow-400" : "text-zinc-600"
                  }`}
                >
                  {displayMult !== null ? `${displayMult.toFixed(2)}x` : "—"}
                </motion.div>
              </AnimatePresence>
              {lastResult && (
                <p className={`text-sm font-mono mt-2 ${lastResult.won ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                  {lastResult.won ? `+$${lastResult.payout.toFixed(2)}` : `-$${selectedChip.toFixed(2)}`}
                </p>
              )}
            </div>

            {/* Target Multiplier */}
            <div className="mb-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5">Target Multiplier</p>
              <input
                type="number"
                value={targetMult}
                onChange={(ev) => setTargetMult(ev.target.value)}
                min={1.01}
                max={1000}
                step={0.01}
                disabled={playing}
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700/50 text-white font-mono text-lg text-center focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
            </div>

            {/* Presets */}
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {PRESETS.map(pr => (
                <button key={pr} onClick={() => setTargetMult(pr.toFixed(2))} disabled={playing}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    parseFloat(targetMult) === pr ? "bg-violet-500/30 text-violet-300 border border-violet-500/40" :
                    "bg-zinc-800 text-zinc-400 border border-zinc-700/50 hover:text-white"
                  }`}>{pr}x</button>
              ))}
            </div>

            {/* Win Chance */}
            <div className="bg-zinc-800/50 rounded-lg p-2.5 text-center mb-4">
              <p className="text-[9px] text-zinc-500 uppercase">Win Chance</p>
              <p className="text-lg font-bold text-white font-mono">{winChance}%</p>
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

            {/* Play Button */}
            <motion.button
              whileHover={!playing ? { scale: 1.01 } : {}}
              whileTap={!playing ? { scale: 0.98 } : {}}
              onClick={handlePlay}
              disabled={playing || !isAuthenticated || cash < selectedChip}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-bold text-sm disabled:opacity-30 transition-colors shadow-lg"
            >
              {playing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                `PLAY · $${selectedChip.toFixed(2)}`}
            </motion.button>
          </div>
        </div>

        <p className="text-center text-[9px] text-zinc-700 mt-4 font-mono">1% house edge · $250 max payout</p>
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
