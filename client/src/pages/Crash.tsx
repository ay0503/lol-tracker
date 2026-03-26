import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0.10: { bg: "from-blue-400 to-blue-600", border: "border-blue-300/50", text: "text-white" },
  0.25: { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", text: "text-white" },
  0.50: { bg: "from-red-400 to-red-600", border: "border-red-300/50", text: "text-white" },
  1: { bg: "from-gray-100 to-gray-300", border: "border-gray-200/50", text: "text-gray-800" },
  2: { bg: "from-pink-400 to-pink-600", border: "border-pink-300/50", text: "text-white" },
  5: { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50", text: "text-black" },
};

function multiplierAtTime(ms: number): number {
  return 1 + 0.06 * Math.pow(ms / 1000, 1.5);
}

function getMultColor(m: number): string {
  if (m >= 50) return "#ef4444";
  if (m >= 10) return "#f97316";
  if (m >= 5) return "#eab308";
  if (m >= 2) return "#00C805";
  return "#ffffff";
}

function getMultColorClass(m: number): string {
  if (m >= 50) return "text-red-400";
  if (m >= 10) return "text-orange-400";
  if (m >= 5) return "text-yellow-400";
  if (m >= 2) return "text-[#00C805]";
  return "text-white";
}

// ─── Canvas Graph Component ───
function CrashGraph({
  isFlying, currentMult, crashPoint, cashoutMult, startTime, crashed,
}: {
  isFlying: boolean; currentMult: number; crashPoint?: number;
  cashoutMult?: number; startTime: number; crashed: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Determine time range and mult range
    const elapsed = isFlying ? Date.now() - startTime : 0;
    const maxTime = Math.max(elapsed + 2000, 5000); // at least 5s visible
    const maxMult = Math.max(currentMult * 1.3, 2.5); // headroom above current

    const pad = { top: 20, right: 20, bottom: 30, left: 45 };
    const gW = W - pad.left - pad.right;
    const gH = H - pad.top - pad.bottom;

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;

    // Y grid (multiplier)
    const ySteps = Math.min(6, Math.ceil(maxMult));
    for (let i = 0; i <= ySteps; i++) {
      const mult = 1 + (maxMult - 1) * (i / ySteps);
      const y = pad.top + gH - (gH * (mult - 1) / (maxMult - 1));
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${mult.toFixed(1)}x`, pad.left - 5, y + 3);
    }

    // X grid (time)
    const xSteps = 5;
    for (let i = 0; i <= xSteps; i++) {
      const t = (maxTime / 1000) * (i / xSteps);
      const x = pad.left + gW * (i / xSteps);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, H - pad.bottom);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${t.toFixed(1)}s`, x, H - pad.bottom + 15);
    }

    if (!isFlying && !crashed && !cashoutMult) return; // idle state

    // Draw curve
    const toX = (ms: number) => pad.left + (ms / maxTime) * gW;
    const toY = (m: number) => pad.top + gH - (gH * (m - 1) / (maxMult - 1));

    const points: [number, number][] = [];
    const step = Math.max(1, Math.floor(elapsed / 200));
    for (let t = 0; t <= elapsed; t += step) {
      const m = multiplierAtTime(t);
      points.push([toX(t), toY(m)]);
    }
    // Final point
    points.push([toX(elapsed), toY(currentMult)]);

    if (points.length < 2) return;

    // Gradient fill under curve
    const gradient = ctx.createLinearGradient(0, toY(currentMult), 0, toY(1));
    const color = crashed ? "255,82,82" : "0,200,5";
    gradient.addColorStop(0, `rgba(${color},0.15)`);
    gradient.addColorStop(1, `rgba(${color},0.02)`);

    ctx.beginPath();
    ctx.moveTo(points[0][0], toY(1));
    for (const [x, y] of points) ctx.lineTo(x, y);
    ctx.lineTo(points[points.length - 1][0], toY(1));
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Curve line
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.strokeStyle = crashed ? "#FF5252" : getMultColor(currentMult);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    // Current point dot (pulsing)
    if (isFlying || cashoutMult) {
      const lastPt = points[points.length - 1];
      ctx.beginPath();
      ctx.arc(lastPt[0], lastPt[1], 4, 0, Math.PI * 2);
      ctx.fillStyle = crashed ? "#FF5252" : getMultColor(currentMult);
      ctx.fill();

      // Outer glow
      ctx.beginPath();
      ctx.arc(lastPt[0], lastPt[1], 8, 0, Math.PI * 2);
      ctx.fillStyle = crashed ? "rgba(255,82,82,0.2)" : `rgba(0,200,5,0.2)`;
      ctx.fill();
    }

    // Cashout marker
    if (cashoutMult && !crashed) {
      const cashTime = Math.pow((cashoutMult - 1) / 0.06, 1 / 1.5) * 1000;
      const cx = toX(cashTime);
      const cy = toY(cashoutMult);

      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#00C805";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#00C805";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${cashoutMult.toFixed(2)}x`, cx, cy - 12);
    }

    // Crash marker
    if (crashed && crashPoint) {
      const crashTime = Math.pow((crashPoint - 1) / 0.06, 1 / 1.5) * 1000;
      const cx = toX(Math.min(crashTime, elapsed));
      const cy = toY(crashPoint);

      // Red X
      ctx.strokeStyle = "#FF5252";
      ctx.lineWidth = 3;
      const s = 6;
      ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.stroke();
    }

    if (isFlying) animRef.current = requestAnimationFrame(draw);
  }, [isFlying, currentMult, crashPoint, cashoutMult, startTime, crashed]);

  useEffect(() => {
    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [draw]);

  // Redraw on resize
  useEffect(() => {
    const handle = () => draw();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [draw]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

function CrashPill({ point, won }: { point: number; won?: boolean }) {
  const color = point < 2 ? "bg-red-500/20 text-red-400" : point <= 10 ? "bg-yellow-500/20 text-yellow-400" : "bg-[#00C805]/20 text-[#00C805]";
  return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold ${color} ${won ? "ring-1 ring-white/20" : ""}`}>{point.toFixed(2)}x</span>;
}

// ─── Main Component ───
export default function Crash() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState("0.50");
  const [autoCashout, setAutoCashout] = useState("");
  const [currentMult, setCurrentMult] = useState(1.00);
  const [isFlying, setIsFlying] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [gameResult, setGameResult] = useState<{ status: string; crashPoint?: number; payout?: number; multiplier?: number } | null>(null);
  const [flashRed, setFlashRed] = useState(false);
  const animRef = useRef<number>();
  const utils = trpc.useUtils();

  const { data: casinoBalance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: history, refetch: refetchHistory } = trpc.casino.crash.history.useQuery(undefined, { enabled: isAuthenticated });

  const startMutation = trpc.casino.crash.start.useMutation({
    onSuccess: (game) => {
      if (game.status === "crashed") {
        setGameResult({ status: "crashed", crashPoint: game.crashPoint, payout: 0 });
        setFlashRed(true); setTimeout(() => setFlashRed(false), 500);
        toast.error(`Instant crash! ${game.crashPoint?.toFixed(2)}x`);
        refetchBalance(); refetchHistory();
        return;
      }
      setIsFlying(true);
      setGameResult(null);
      setCurrentMult(1.00);
      const now = Date.now();
      setStartTime(now);
      const animate = () => {
        const m = multiplierAtTime(Date.now() - now);
        setCurrentMult(Math.floor(m * 100) / 100);
        animRef.current = requestAnimationFrame(animate);
      };
      animRef.current = requestAnimationFrame(animate);
    },
    onError: (err) => toast.error(err.message),
  });

  const cashoutMutation = trpc.casino.crash.cashout.useMutation({
    onSuccess: (game) => {
      setIsFlying(false);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (game.status === "cashed_out") {
        setGameResult({ status: "cashed_out", crashPoint: game.crashPoint, payout: game.payout, multiplier: game.cashoutMultiplier });
        toast.success(`Cashed out at ${game.cashoutMultiplier.toFixed(2)}x! +$${game.payout.toFixed(2)}`);
      } else {
        setGameResult({ status: "crashed", crashPoint: game.crashPoint, payout: 0 });
        setFlashRed(true); setTimeout(() => setFlashRed(false), 500);
        toast.error(`Crashed at ${game.crashPoint?.toFixed(2)}x!`);
      }
      refetchBalance(); refetchHistory();
    },
    onError: (err) => toast.error(err.message),
  });

  // Poll for crash/auto-cashout during flight
  const statusQuery = trpc.casino.crash.status.useQuery(undefined, {
    enabled: isAuthenticated && isFlying, refetchInterval: 400,
  });

  useEffect(() => {
    if (statusQuery.data && isFlying) {
      const s = statusQuery.data.status;
      if (s === "crashed") {
        setIsFlying(false);
        if (animRef.current) cancelAnimationFrame(animRef.current);
        setGameResult({ status: "crashed", crashPoint: statusQuery.data.crashPoint, payout: 0 });
        setFlashRed(true); setTimeout(() => setFlashRed(false), 500);
        toast.error(`Crashed at ${statusQuery.data.crashPoint?.toFixed(2)}x!`);
        refetchBalance(); refetchHistory();
      } else if (s === "cashed_out") {
        setIsFlying(false);
        if (animRef.current) cancelAnimationFrame(animRef.current);
        setGameResult({ status: "cashed_out", crashPoint: statusQuery.data.crashPoint, payout: statusQuery.data.payout, multiplier: statusQuery.data.cashoutMultiplier });
        toast.success(`Auto-cashout! +$${statusQuery.data.payout.toFixed(2)}`);
        refetchBalance(); refetchHistory();
      }
    }
  }, [statusQuery.data?.status]);

  useEffect(() => { return () => { if (animRef.current) cancelAnimationFrame(animRef.current); }; }, []);

  const cash = casinoBalance ?? 20;
  const isPending = startMutation.isPending || cashoutMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <div className="container py-6 sm:py-8 max-w-lg mx-auto">
        <Link href="/casino" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mb-5">
          <ArrowLeft className="w-3.5 h-3.5" /> Casino
        </Link>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/25 to-red-600/15 border border-orange-500/20">
              <span className="text-lg">🚀</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-[var(--font-heading)]">Crash</h1>
              <p className="text-xs text-zinc-400 font-mono">${cash.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className={`relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)] transition-all duration-200 ${flashRed ? "ring-2 ring-red-500/60" : ""}`}>
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/90 to-zinc-900/95" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

          {/* Red flash overlay */}
          <AnimatePresence>
            {flashRed && (
              <motion.div
                initial={{ opacity: 0.4 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 bg-red-500/20 z-10 pointer-events-none"
              />
            )}
          </AnimatePresence>

          <div className="relative p-4 sm:p-5">
            {/* Graph + Multiplier Overlay */}
            <div className="relative" style={{ height: 220 }}>
              <CrashGraph
                isFlying={isFlying}
                currentMult={currentMult}
                crashPoint={gameResult?.crashPoint}
                cashoutMult={gameResult?.status === "cashed_out" ? gameResult.multiplier : undefined}
                startTime={startTime}
                crashed={gameResult?.status === "crashed" || false}
              />

              {/* Overlaid multiplier number */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <AnimatePresence mode="wait">
                  {isFlying ? (
                    <motion.p key="fly" className={`text-5xl sm:text-6xl font-bold font-mono drop-shadow-lg ${getMultColorClass(currentMult)}`}
                      style={{ textShadow: `0 0 30px ${getMultColor(currentMult)}40` }}>
                      {currentMult.toFixed(2)}x
                    </motion.p>
                  ) : gameResult?.status === "crashed" ? (
                    <motion.div key="crash" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }} className="text-center">
                      <p className="text-4xl sm:text-5xl font-bold font-mono text-[#FF5252] drop-shadow-lg" style={{ textShadow: "0 0 30px rgba(255,82,82,0.4)" }}>
                        {gameResult.crashPoint?.toFixed(2)}x
                      </p>
                      <p className="text-sm font-bold text-[#FF5252] mt-1">{language === "ko" ? "추락!" : "CRASHED!"}</p>
                    </motion.div>
                  ) : gameResult?.status === "cashed_out" ? (
                    <motion.div key="win" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }} className="text-center">
                      <p className="text-4xl sm:text-5xl font-bold font-mono text-[#00C805] drop-shadow-lg" style={{ textShadow: "0 0 30px rgba(0,200,5,0.4)" }}>
                        {gameResult.multiplier?.toFixed(2)}x
                      </p>
                      <p className="text-sm font-bold text-[#00C805] mt-1">+${gameResult.payout?.toFixed(2)}</p>
                    </motion.div>
                  ) : (
                    <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-4xl sm:text-5xl font-bold text-zinc-700 font-mono">
                      1.00x
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* History Strip */}
            {history && history.length > 0 && (
              <div className="flex gap-1 justify-center flex-wrap mt-3 mb-3">
                {history.slice(0, 12).map((h, i) => <CrashPill key={i} point={h.crashPoint} won={h.cashedOut} />)}
              </div>
            )}

            {/* Controls */}
            <div className="pt-3 border-t border-white/[0.05]">
              <AnimatePresence mode="wait">
                {isFlying ? (
                  <motion.button key="cashout" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => cashoutMutation.mutate()} disabled={isPending}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-[#00C805] to-emerald-600 text-white font-bold text-lg disabled:opacity-40 transition-colors shadow-lg shadow-[#00C805]/25"
                    style={{ animation: "pulse 1s ease-in-out infinite" }}>
                    {cashoutMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> :
                      `${language === "ko" ? "캐시아웃" : "CASH OUT"} $${(parseFloat(betAmount) * currentMult).toFixed(2)}`}
                  </motion.button>
                ) : (
                  <motion.div key="bet" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                    <div className="flex gap-1.5 justify-center">
                      {[0.10, 0.25, 0.50, 1, 2, 5].map(amt => {
                        const label = amt < 1 ? `${Math.round(amt * 100)}¢` : `$${amt}`;
                        const selected = parseFloat(betAmount) === amt;
                        const disabled = cash < amt;
                        const colors = CHIP_COLORS[amt];
                        return (
                          <motion.button key={amt} whileHover={disabled ? {} : { y: -3 }} whileTap={disabled ? {} : { scale: 0.92 }}
                            onClick={() => !disabled && setBetAmount(amt.toString())} disabled={disabled}
                            className={`w-11 h-11 rounded-full font-mono font-bold text-[10px] shadow-md border-[2.5px] border-dashed transition-all ${
                              disabled ? "opacity-25 cursor-not-allowed bg-gray-700 border-gray-600 text-gray-500" :
                              selected ? `bg-gradient-to-b ${colors.bg} ${colors.text} ${colors.border} ring-2 ring-white/40 ring-offset-1 ring-offset-zinc-900 shadow-lg`
                                : `bg-gradient-to-b ${colors.bg} ${colors.text} ${colors.border} opacity-70 hover:opacity-100`
                            }`}>{label}</motion.button>
                        );
                      })}
                    </div>
                    <input type="number" value={autoCashout} onChange={(e) => setAutoCashout(e.target.value)}
                      placeholder={language === "ko" ? "자동 캐시아웃 배율 (선택)" : "Auto cashout multiplier (optional)"}
                      min={1.01} step={0.1}
                      className="w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700/50 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
                    <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        const amt = parseFloat(betAmount);
                        if (isNaN(amt) || amt < 0.10 || amt > 5) return toast.error("Bet $0.10–$5.00");
                        const auto = autoCashout ? parseFloat(autoCashout) : undefined;
                        if (auto !== undefined && auto < 1.01) return toast.error("Auto-cashout ≥ 1.01x");
                        startMutation.mutate({ bet: amt, autoCashout: auto });
                      }}
                      disabled={isPending || !isAuthenticated || cash < parseFloat(betAmount || "0")}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-sm hover:from-orange-400 hover:to-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg shadow-orange-500/15">
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                        `🚀 ${language === "ko" ? "시작" : "START"} $${parseFloat(betAmount || "0").toFixed(2)}`}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <p className="text-center text-[9px] text-zinc-700 mt-4 font-mono">
          {language === "ko" ? "1% 하우스 엣지 · 최대 $500 지급" : "1% house edge · $500 max payout"}
        </p>
      </div>
    </div>
  );
}
