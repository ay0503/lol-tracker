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
const LOG_MIN = Math.log(1);
const LOG_MAX = Math.log(1000);
const METER_TICKS = [
  { value: 1, label: "1x" }, { value: 2, label: "2x" }, { value: 5, label: "5x" },
  { value: 10, label: "10x" }, { value: 50, label: "50x" }, { value: 100, label: "100x" },
  { value: 1000, label: "1000x" },
];

function logScale(val: number): number {
  const clamped = Math.max(1, Math.min(1000, val));
  return (Math.log(clamped) - LOG_MIN) / (LOG_MAX - LOG_MIN);
}

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
      const start = Date.now();
      const duration = Math.min(result.crashPoint * 400, 2500);
      const animate = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic for tension
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = 1 + (result.crashPoint - 1) * eased;
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
  const targetPos = logScale(parsedTarget) * 100;
  const currentPos = displayMult ? logScale(displayMult) * 100 : 0;
  const isWin = lastResult?.won;
  const isLoss = lastResult && !lastResult.won;

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

            {/* ─── Rising Meter + Number Display ─── */}
            <div className="flex justify-center mb-4 py-2">
              <div className="flex items-end gap-3">
                {/* Y-axis ticks */}
                <div className="relative h-48 w-10 flex-shrink-0">
                  {METER_TICKS.map(tick => (
                    <span key={tick.value} className="absolute right-0 text-[8px] font-mono text-zinc-500 -translate-y-1/2"
                      style={{ bottom: `${logScale(tick.value) * 100}%` }}>
                      {tick.label}
                    </span>
                  ))}
                </div>

                {/* Meter bar */}
                <div className="relative h-48 w-16 rounded-lg overflow-hidden bg-zinc-800/80 border border-zinc-700/50">
                  {/* Background gradient */}
                  <div className="absolute inset-0 opacity-20" style={{ background: "linear-gradient(to top, #22c55e, #eab308 50%, #ef4444)" }} />

                  {/* Target line */}
                  <div className="absolute left-0 right-0 z-10 flex items-center" style={{ bottom: `${targetPos}%`, transform: "translateY(50%)" }}>
                    <div className="w-full h-[2px] bg-white/70 shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
                  </div>

                  {/* Rising fill */}
                  <motion.div
                    className={`absolute bottom-0 left-0 right-0 rounded-b-lg ${
                      isWin ? "bg-gradient-to-t from-emerald-500 to-emerald-400" :
                      isLoss ? "bg-gradient-to-t from-red-500 to-red-400" :
                      "bg-gradient-to-t from-violet-600 to-violet-400"
                    }`}
                    initial={{ height: "0%" }}
                    animate={{ height: displayMult !== null ? `${currentPos}%` : "0%" }}
                    transition={{ duration: 0.05, ease: "linear" }}
                  />

                  {/* Glowing orb */}
                  {displayMult !== null && (
                    <motion.div
                      className={`absolute left-1/2 w-4 h-4 rounded-full z-20 ${
                        isWin ? "bg-emerald-400 shadow-[0_0_16px_4px_rgba(34,197,94,0.7)]" :
                        isLoss ? "bg-red-400 shadow-[0_0_16px_4px_rgba(239,68,68,0.7)]" :
                        "bg-violet-300 shadow-[0_0_12px_4px_rgba(167,139,250,0.6)]"
                      }`}
                      style={{ bottom: `${currentPos}%`, transform: "translate(-50%, 50%)" }}
                    />
                  )}

                  {/* Win particles */}
                  <AnimatePresence>
                    {isWin && lastResult && (
                      <>
                        {[...Array(8)].map((_, idx) => (
                          <motion.div key={idx} className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400"
                            style={{ left: "50%", bottom: `${currentPos}%` }}
                            initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
                            animate={{
                              scale: [0, 1.5, 0],
                              x: Math.cos((idx * Math.PI * 2) / 8) * 25,
                              y: Math.sin((idx * Math.PI * 2) / 8) * 25,
                              opacity: [1, 1, 0],
                            }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                        ))}
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* Multiplier display */}
                <div className="flex flex-col items-start gap-1 w-20">
                  <motion.p
                    key={displayMult ?? "idle"}
                    className={`text-3xl font-bold font-mono ${
                      isWin ? "text-[#00C805]" : isLoss ? "text-[#FF5252]" : playing ? "text-violet-300" : "text-zinc-600"
                    }`}
                  >
                    {displayMult !== null ? `${displayMult.toFixed(2)}x` : "—"}
                  </motion.p>
                  {lastResult && (
                    <p className={`text-xs font-mono ${isWin ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                      {isWin ? `+$${lastResult.payout.toFixed(2)}` : `-$${selectedChip.toFixed(2)}`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Target Multiplier Input */}
            <div className="mb-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5">Target Multiplier</p>
              <input
                type="number" value={targetMult} onChange={(ev) => setTargetMult(ev.target.value)}
                min={1.01} max={1000} step={0.01} disabled={playing}
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
              {playing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `PLAY · $${selectedChip.toFixed(2)}`}
            </motion.button>
          </div>
        </div>

        <p className="text-center text-[9px] text-zinc-700 mt-4 font-mono">1% house edge · $250 max payout</p>
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
