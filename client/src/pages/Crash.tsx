import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";
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

function multiplierAtTime(ms: number): number {
  return 1 + 0.06 * Math.pow(ms / 1000, 1.5);
}

function timeAtMultiplier(m: number): number {
  return Math.pow(Math.max(0, m - 1) / 0.06, 1 / 1.5) * 1000;
}

function getMultColor(m: number): string {
  if (m >= 50) return "#FF5252";
  if (m >= 10) return "#FF9800";
  if (m >= 5) return "#FFD600";
  if (m >= 2) return "#00C805";
  return "#FFFFFF";
}

function getMultColorClass(m: number): string {
  if (m >= 50) return "text-red-400";
  if (m >= 10) return "text-orange-400";
  if (m >= 5) return "text-yellow-400";
  if (m >= 2) return "text-[#00C805]";
  return "text-white";
}

function CrashPill({ point, won }: { point: number; won?: boolean }) {
  const color =
    point < 2 ? "bg-red-500/25 text-red-400 border-red-500/20" :
    point <= 10 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/20" :
    "bg-[#00C805]/20 text-[#00C805] border-[#00C805]/20";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border ${color} ${won ? "ring-1 ring-white/30" : ""}`}>
      {point.toFixed(2)}x
    </span>
  );
}

type Phase = "idle" | "flying" | "crashed" | "cashed_out";

// ---- Canvas Graph ----
function CrashCanvas({
  phase, elapsedRef, endMult, cashoutMult, crashPoint,
}: {
  phase: Phase;
  elapsedRef: React.MutableRefObject<number>;
  endMult: number;
  cashoutMult: number | null;
  crashPoint: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);

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
    ctx.clearRect(0, 0, W, H);

    const isActive = phase === "flying";
    const isCrashed = phase === "crashed";
    const isCashedOut = phase === "cashed_out";
    const elapsed = elapsedRef.current;

    // Current multiplier for live; final multiplier for results
    const liveMult = isActive ? multiplierAtTime(elapsed) : endMult;
    const displayEnd = isCrashed ? (crashPoint ?? liveMult) : isCashedOut ? (cashoutMult ?? liveMult) : liveMult;
    const curveMult = Math.max(displayEnd, 1.01);

    // Viewport
    const yMax = Math.max(curveMult * 1.35, 2.0);
    const tEnd = timeAtMultiplier(curveMult);
    const tMax = Math.max(tEnd * 1.2, 4000);

    const pad = { top: 16, right: 16, bottom: 28, left: 42 };
    const gW = W - pad.left - pad.right;
    const gH = H - pad.top - pad.bottom;
    const toX = (t: number) => pad.left + (t / tMax) * gW;
    const toY = (m: number) => pad.top + gH - ((m - 1) / (yMax - 1)) * gH;

    // ---- Grid ----
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    const ySteps = Math.min(6, Math.max(3, Math.ceil(yMax)));
    for (let i = 0; i <= ySteps; i++) {
      const mv = 1 + ((yMax - 1) * i) / ySteps;
      const y = toY(mv);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${mv.toFixed(1)}x`, pad.left - 5, y + 3);
    }
    for (let i = 0; i <= 4; i++) {
      const x = pad.left + (gW * i) / 4;
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + gH); ctx.stroke();
      const sec = (tMax / 1000) * (i / 4);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${sec.toFixed(0)}s`, x, H - pad.bottom + 14);
    }

    // Nothing to draw in idle
    if (phase === "idle") return;

    // ---- Build curve points ----
    const lineColor = isCrashed ? "#FF5252" : getMultColor(curveMult);
    const STEPS = 180;
    const pts: [number, number][] = [];
    for (let i = 0; i <= STEPS; i++) {
      const tv = (tEnd * i) / STEPS;
      const m = multiplierAtTime(tv);
      pts.push([toX(tv), toY(m)]);
    }

    // ---- Gradient fill ----
    const grad = ctx.createLinearGradient(0, toY(curveMult), 0, toY(1));
    const rgb = isCrashed ? "255,82,82" : curveMult >= 2 ? "0,200,5" : "255,255,255";
    grad.addColorStop(0, `rgba(${rgb},0.18)`);
    grad.addColorStop(1, `rgba(${rgb},0.01)`);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], toY(1));
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(pts[pts.length - 1][0], toY(1));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // ---- Curve line ----
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    // ---- Tip glow (flying) ----
    if (isActive && pts.length > 0) {
      const [tx, ty] = pts[pts.length - 1];
      const glow = ctx.createRadialGradient(tx, ty, 0, tx, ty, 22);
      glow.addColorStop(0, `${lineColor}60`);
      glow.addColorStop(1, `${lineColor}00`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(tx, ty, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = lineColor;
      ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2); ctx.fill();
    }

    // ---- Cashout marker (green dot + label) ----
    if (isCashedOut && cashoutMult && cashoutMult > 1) {
      const ct = timeAtMultiplier(cashoutMult);
      const cx = toX(ct), cy = toY(cashoutMult);
      // Outer ring
      ctx.strokeStyle = "#00C805";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.stroke();
      // Inner dot
      ctx.fillStyle = "#00C805";
      ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fill();
      // Label
      ctx.fillStyle = "#00C805";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${cashoutMult.toFixed(2)}x`, cx, cy - 16);
    }

    // ---- Crash X marker ----
    if (isCrashed && crashPoint && crashPoint > 1) {
      const ct = timeAtMultiplier(crashPoint);
      const cx = toX(ct), cy = toY(crashPoint);
      ctx.strokeStyle = "#FF5252";
      ctx.lineWidth = 3;
      const s = 7;
      ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.stroke();
    }

    if (isActive) rafRef.current = requestAnimationFrame(draw);
  }, [phase, endMult, cashoutMult, crashPoint, elapsedRef]);

  useEffect(() => {
    draw();
    if (phase === "flying") rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [draw, phase]);

  useEffect(() => {
    const h = () => draw();
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [draw]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

// ---- Main Component ----
export default function Crash() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState("0.50");
  const [autoCashout, setAutoCashout] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [displayMult, setDisplayMult] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [cashoutMult, setCashoutMult] = useState<number | null>(null);
  const [payout, setPayout] = useState<number | null>(null);
  const [flash, setFlash] = useState<"red" | "green" | null>(null);

  const animRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef(0);
  const elapsedRef = useRef(0);

  const { data: casinoBalance, refetch: refetchBalance } =
    trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: history, refetch: refetchHistory } =
    trpc.casino.crash.history.useQuery(undefined, { enabled: isAuthenticated });

  const doFlash = (c: "red" | "green") => { setFlash(c); setTimeout(() => setFlash(null), 400); };

  const endGame = useCallback((p: Phase, cp: number | null, co: number | null, pay: number | null) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setCrashPoint(cp);
    setCashoutMult(co);
    setPayout(pay);
    setDisplayMult(cp ?? co ?? 1);
    setPhase(p);
    doFlash(p === "crashed" ? "red" : "green");
    refetchBalance();
    refetchHistory();
  }, [refetchBalance, refetchHistory]);

  const tick = useCallback(() => {
    const el = Date.now() - startTimeRef.current;
    elapsedRef.current = el;
    setDisplayMult(Math.floor(multiplierAtTime(el) * 100) / 100);
    animRef.current = requestAnimationFrame(tick);
  }, []);

  const startMutation = trpc.casino.crash.start.useMutation({
    onSuccess: (game) => {
      if (game.status === "crashed") {
        elapsedRef.current = timeAtMultiplier(game.crashPoint ?? 1);
        endGame("crashed", game.crashPoint ?? 1, null, 0);
        toast.error(`Instant crash! ${game.crashPoint?.toFixed(2)}x`);
        return;
      }
      setCrashPoint(null);
      setCashoutMult(null);
      setPayout(null);
      setDisplayMult(1);
      elapsedRef.current = 0;
      startTimeRef.current = Date.now();
      setPhase("flying");
      tick();
    },
    onError: (err) => toast.error(err.message),
  });

  const cashoutMutation = trpc.casino.crash.cashout.useMutation({
    onSuccess: (game) => {
      if (game.status === "cashed_out") {
        elapsedRef.current = timeAtMultiplier(game.cashoutMultiplier ?? 1);
        endGame("cashed_out", game.crashPoint ?? null, game.cashoutMultiplier ?? null, game.payout ?? 0);
        toast.success(`Cashed out at ${(game.cashoutMultiplier ?? 1).toFixed(2)}x! +$${(game.payout ?? 0).toFixed(2)}`);
      } else {
        elapsedRef.current = timeAtMultiplier(game.crashPoint ?? displayMult);
        endGame("crashed", game.crashPoint ?? null, null, 0);
        toast.error(`Crashed at ${(game.crashPoint ?? 1).toFixed(2)}x!`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const statusQuery = trpc.casino.crash.status.useQuery(undefined, {
    enabled: isAuthenticated && phase === "flying",
    refetchInterval: 1000,
  });

  useEffect(() => {
    if (!statusQuery.data || phase !== "flying") return;
    const d = statusQuery.data;
    if (d.status === "crashed") {
      elapsedRef.current = timeAtMultiplier(d.crashPoint ?? displayMult);
      endGame("crashed", d.crashPoint ?? null, null, 0);
      toast.error(`Crashed at ${(d.crashPoint ?? 1).toFixed(2)}x!`);
    } else if (d.status === "cashed_out") {
      elapsedRef.current = timeAtMultiplier(d.cashoutMultiplier ?? 1);
      endGame("cashed_out", d.crashPoint ?? null, d.cashoutMultiplier ?? null, d.payout ?? 0);
      toast.success(`Auto-cashout at ${(d.cashoutMultiplier ?? 1).toFixed(2)}x! +$${(d.payout ?? 0).toFixed(2)}`);
    }
  }, [statusQuery.data?.status]);

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // Re-sync on tab focus (requestAnimationFrame pauses in background)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && phase === "flying") {
        statusQuery.refetch();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase]);

  const handleStart = () => {
    const amt = parseCasinoBetAmount(betAmount);
    if (Number.isNaN(amt) || amt < MIN_CASINO_BET || amt > MAX_CASINO_BET) {
      return toast.error(language === "ko" ? "베팅 금액: $0.10 - $50" : "Bet amount: $0.10 - $50");
    }
    const auto = autoCashout ? parseFloat(autoCashout) : undefined;
    if (auto !== undefined && auto < 1.01) return toast.error("Auto-cashout must be >= 1.01x");
    startMutation.mutate({ bet: amt, autoCashout: auto });
  };

  const cash = casinoBalance ?? 20;
  const isPending = startMutation.isPending || cashoutMutation.isPending;
  const parsedBetAmount = parseCasinoBetAmount(betAmount);

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <AppNav />
      <CasinoSubNav />
      {/* Full-screen flash */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className={`fixed inset-0 z-50 pointer-events-none ${flash === "red" ? "bg-red-600" : "bg-green-500"}`}
          />
        )}
      </AnimatePresence>

      <div className="container py-4 sm:py-6 max-w-lg mx-auto px-4">
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

        {/* History pills */}
        {history && history.length > 0 && (
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
            {history.slice(0, 12).map((h: any, i: number) => (
              <CrashPill key={i} point={h.crashPoint} won={h.cashedOut} />
            ))}
          </div>
        )}

        {/* ======== GRAPH AREA ======== */}
        <div className={`relative rounded-2xl overflow-hidden border border-white/[0.06] bg-zinc-900/90 shadow-[0_0_80px_rgba(0,0,0,0.6)] transition-shadow duration-300 ${
          phase === "crashed" ? "shadow-[0_0_60px_rgba(255,82,82,0.15)]" :
          phase === "cashed_out" ? "shadow-[0_0_60px_rgba(0,200,5,0.15)]" : ""
        }`}>
          <div className="relative" style={{ height: 260 }}>
            <CrashCanvas
              phase={phase}
              elapsedRef={elapsedRef}
              endMult={displayMult}
              cashoutMult={cashoutMult}
              crashPoint={crashPoint}
            />

            {/* Multiplier overlaid on graph center */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <AnimatePresence mode="wait">
                {phase === "flying" ? (
                  <motion.div key="fly" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                    <motion.p
                      className={`text-6xl sm:text-7xl font-black font-mono ${getMultColorClass(displayMult)}`}
                      style={{ textShadow: `0 0 40px ${getMultColor(displayMult)}40` }}
                      animate={displayMult >= 5 ? { scale: [1, 1.04, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 0.25 }}
                    >
                      {displayMult.toFixed(2)}x
                    </motion.p>
                    <p className="text-xs text-zinc-400/70 font-mono mt-1">
                      ${(parsedBetAmount * displayMult).toFixed(2)}
                    </p>
                  </motion.div>
                ) : phase === "crashed" ? (
                  <motion.div
                    key="crash"
                    initial={{ scale: 1.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1, x: [0, -8, 8, -5, 5, 0] }}
                    transition={{ duration: 0.4 }}
                    className="text-center"
                  >
                    <p className="text-6xl sm:text-7xl font-black font-mono text-[#FF5252]"
                      style={{ textShadow: "0 0 50px rgba(255,82,82,0.5)" }}>
                      {(crashPoint ?? 1).toFixed(2)}x
                    </p>
                    <motion.p
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="text-lg font-black text-[#FF5252] tracking-[0.2em] mt-1"
                    >
                      CRASHED
                    </motion.p>
                  </motion.div>
                ) : phase === "cashed_out" ? (
                  <motion.div
                    key="win"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="text-center"
                  >
                    <p className="text-6xl sm:text-7xl font-black font-mono text-[#00C805]"
                      style={{ textShadow: "0 0 50px rgba(0,200,5,0.5)" }}>
                      {(cashoutMult ?? 1).toFixed(2)}x
                    </p>
                    <p className="text-lg font-black text-[#00C805] mt-1">
                      +${(payout ?? 0).toFixed(2)}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                    <p className="text-6xl sm:text-7xl font-black text-zinc-700/80 font-mono">1.00x</p>
                    <p className="text-xs text-zinc-600 mt-2">
                      {language === "ko" ? "베팅하고 시작하세요" : "Place your bet"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ======== CONTROLS ======== */}
        <div className="mt-4 space-y-3">
          <AnimatePresence mode="wait">
            {phase === "flying" ? (
              <motion.button
                key="cashout-btn"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => cashoutMutation.mutate()}
                disabled={isPending}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#00C805] to-emerald-600 text-white font-bold text-lg disabled:opacity-40 shadow-lg shadow-[#00C805]/30 animate-pulse"
              >
                {cashoutMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  `${language === "ko" ? "캐시아웃" : "CASH OUT"} $${(parsedBetAmount * displayMult).toFixed(2)}`
                )}
              </motion.button>
            ) : (
              <motion.div key="bet-controls" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                <CasinoBetControls
                  language={language}
                  value={betAmount}
                  cash={cash}
                  disabled={isPending}
                  onChange={setBetAmount}
                />

                {/* Auto-cashout input */}
                <div className="relative">
                  <input
                    type="number"
                    value={autoCashout}
                    onChange={(e) => setAutoCashout(e.target.value)}
                    placeholder={language === "ko" ? "자동 캐시아웃 배율 (선택)" : "Auto cashout multiplier (optional)"}
                    min={1.01}
                    step={0.1}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                  />
                  {autoCashout && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">x</span>
                  )}
                </div>

                {/* Start button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStart}
                  disabled={
                    isPending ||
                    !isAuthenticated ||
                    parsedBetAmount < MIN_CASINO_BET ||
                    parsedBetAmount > MAX_CASINO_BET ||
                    cash < parsedBetAmount
                  }
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-sm hover:from-orange-400 hover:to-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg shadow-orange-500/20"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    `${language === "ko" ? "시작" : "START"} $${parsedBetAmount.toFixed(2)}`
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-[11px] text-zinc-700 mt-4 font-mono">
          {language === "ko" ? "더 부드러운 크래시 곡선 | 플레이어 우위 | 최대 $500 지급" : "Softer crash curve | player edge | $500 max payout"}
        </p>

        <CasinoGameLog />
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
