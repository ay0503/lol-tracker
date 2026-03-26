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

function multiplierAtTime(elapsedMs: number): number {
  const t = elapsedMs / 1000;
  return 1 + 0.06 * Math.pow(t, 1.5);
}

function getMultColor(m: number): string {
  if (m >= 50) return "text-red-400";
  if (m >= 10) return "text-orange-400";
  if (m >= 5) return "text-yellow-400";
  if (m >= 2) return "text-[#00C805]";
  return "text-white";
}

function CrashPill({ point, won }: { point: number; won?: boolean }) {
  const color = point < 2 ? "bg-red-500/20 text-red-400" : point <= 10 ? "bg-yellow-500/20 text-yellow-400" : "bg-[#00C805]/20 text-[#00C805]";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold ${color} ${won ? "ring-1 ring-white/20" : ""}`}>
      {point.toFixed(2)}x
    </span>
  );
}

export default function Crash() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState("0.50");
  const [autoCashout, setAutoCashout] = useState("");
  const [currentMult, setCurrentMult] = useState(1.00);
  const [isFlying, setIsFlying] = useState(false);
  const [gameResult, setGameResult] = useState<{ status: string; crashPoint?: number; payout?: number; multiplier?: number } | null>(null);
  const animFrameRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  const utils = trpc.useUtils();

  const { data: casinoBalance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: history, refetch: refetchHistory } = trpc.casino.crash.history.useQuery(undefined, { enabled: isAuthenticated });

  const startMutation = trpc.casino.crash.start.useMutation({
    onSuccess: (game) => {
      if (game.status === "crashed") {
        // Instant crash
        setGameResult({ status: "crashed", crashPoint: game.crashPoint, payout: 0 });
        toast.error(`Instant crash! ${game.crashPoint?.toFixed(2)}x`);
        refetchBalance();
        refetchHistory();
        return;
      }
      setIsFlying(true);
      setGameResult(null);
      startTimeRef.current = Date.now();
      animate();
    },
    onError: (err) => toast.error(err.message),
  });

  const cashoutMutation = trpc.casino.crash.cashout.useMutation({
    onSuccess: (game) => {
      setIsFlying(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (game.status === "cashed_out") {
        setGameResult({ status: "cashed_out", crashPoint: game.crashPoint, payout: game.payout, multiplier: game.cashoutMultiplier });
        toast.success(`Cashed out at ${game.cashoutMultiplier.toFixed(2)}x! +$${game.payout.toFixed(2)}`);
      } else {
        setGameResult({ status: "crashed", crashPoint: game.crashPoint, payout: 0 });
        toast.error(`Crashed at ${game.crashPoint?.toFixed(2)}x!`);
      }
      refetchBalance();
      refetchHistory();
    },
    onError: (err) => toast.error(err.message),
  });

  // Poll for crash/auto-cashout
  const statusQuery = trpc.casino.crash.status.useQuery(undefined, {
    enabled: isAuthenticated && isFlying,
    refetchInterval: 500,
  });

  useEffect(() => {
    if (statusQuery.data && isFlying) {
      if (statusQuery.data.status === "crashed") {
        setIsFlying(false);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setGameResult({ status: "crashed", crashPoint: statusQuery.data.crashPoint, payout: 0 });
        toast.error(`Crashed at ${statusQuery.data.crashPoint?.toFixed(2)}x!`);
        refetchBalance();
        refetchHistory();
      } else if (statusQuery.data.status === "cashed_out") {
        setIsFlying(false);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setGameResult({ status: "cashed_out", crashPoint: statusQuery.data.crashPoint, payout: statusQuery.data.payout, multiplier: statusQuery.data.cashoutMultiplier });
        toast.success(`Auto-cashout at ${statusQuery.data.cashoutMultiplier.toFixed(2)}x! +$${statusQuery.data.payout.toFixed(2)}`);
        refetchBalance();
        refetchHistory();
      }
    }
  }, [statusQuery.data?.status]);

  const animate = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const mult = multiplierAtTime(elapsed);
    setCurrentMult(Math.floor(mult * 100) / 100);
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  const handleStart = () => {
    const amt = parseFloat(betAmount);
    if (isNaN(amt) || amt < 0.10 || amt > 5) return toast.error("Bet $0.10–$5.00");
    const auto = autoCashout ? parseFloat(autoCashout) : undefined;
    if (auto !== undefined && auto < 1.01) return toast.error("Auto-cashout must be ≥ 1.01x");
    startMutation.mutate({ bet: amt, autoCashout: auto });
  };

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
        <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/80 to-zinc-900" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

          <div className="relative p-6 sm:p-8">
            {/* Multiplier Display */}
            <div className="text-center min-h-[8rem] flex flex-col items-center justify-center">
              <AnimatePresence mode="wait">
                {isFlying ? (
                  <motion.div key="flying" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                    <motion.p
                      className={`text-5xl sm:text-6xl font-bold font-mono ${getMultColor(currentMult)}`}
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{ repeat: Infinity, duration: 0.5 }}
                    >
                      {currentMult.toFixed(2)}x
                    </motion.p>
                    <p className="text-xs text-zinc-500 mt-2 font-mono">
                      ${(parseFloat(betAmount) * currentMult).toFixed(2)}
                    </p>
                  </motion.div>
                ) : gameResult ? (
                  <motion.div key="result" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
                    {gameResult.status === "crashed" ? (
                      <div>
                        <motion.p
                          initial={{ x: [-10, 10, -10, 10, 0] }}
                          animate={{ x: 0 }}
                          className="text-4xl sm:text-5xl font-bold text-[#FF5252] font-mono"
                        >
                          {gameResult.crashPoint?.toFixed(2)}x
                        </motion.p>
                        <p className="text-sm text-[#FF5252] font-bold mt-1">
                          {language === "ko" ? "추락!" : "CRASHED!"}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-4xl sm:text-5xl font-bold text-[#00C805] font-mono">
                          {gameResult.multiplier?.toFixed(2)}x
                        </p>
                        <p className="text-sm text-[#00C805] font-bold mt-1">
                          +${gameResult.payout?.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-4xl sm:text-5xl font-bold text-zinc-600 font-mono">1.00x</p>
                    <p className="text-xs text-zinc-600 mt-2">
                      {language === "ko" ? "베팅하고 시작하세요" : "Place bet and start"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* History Strip */}
            {history && history.length > 0 && (
              <div className="flex gap-1.5 justify-center flex-wrap mt-4 mb-4">
                {history.slice(0, 10).map((h, i) => (
                  <CrashPill key={i} point={h.crashPoint} won={h.cashedOut} />
                ))}
              </div>
            )}

            {/* Controls */}
            <div className="mt-4 pt-4 border-t border-white/[0.05]">
              <AnimatePresence mode="wait">
                {isFlying ? (
                  <motion.button
                    key="cashout"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => cashoutMutation.mutate()}
                    disabled={isPending}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-[#00C805] to-emerald-600 text-white font-bold text-lg disabled:opacity-40 transition-colors shadow-lg shadow-[#00C805]/25 animate-pulse"
                  >
                    {cashoutMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> :
                      `${language === "ko" ? "캐시아웃" : "CASH OUT"} $${(parseFloat(betAmount) * currentMult).toFixed(2)}`}
                  </motion.button>
                ) : (
                  <motion.div key="bet" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                    {/* Chips */}
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
                            }`}>
                            {label}
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Auto-cashout */}
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="number"
                          value={autoCashout}
                          onChange={(e) => setAutoCashout(e.target.value)}
                          placeholder={language === "ko" ? "자동 캐시아웃 (선택)" : "Auto cashout (optional)"}
                          min={1.01}
                          step={0.1}
                          className="w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700/50 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        />
                        {autoCashout && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">x</span>}
                      </div>
                    </div>

                    {/* Start */}
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleStart}
                      disabled={isPending || !isAuthenticated || cash < parseFloat(betAmount || "0")}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-sm hover:from-orange-400 hover:to-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg shadow-orange-500/15"
                    >
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
