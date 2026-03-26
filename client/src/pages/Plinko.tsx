import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";
import AppNav from "@/components/AppNav";
import CasinoSubNav from "@/components/CasinoSubNav";
import CasinoBetControls, {
  MAX_CASINO_BET,
  MIN_CASINO_BET,
  parseCasinoBetAmount,
} from "@/components/CasinoBetControls";

const ROWS = 12;
const BUCKETS = 13;
const MAX_BALLS = 5;
const GRAVITY = 0.25;
const BOUNCE_VY = -3.5;
const BOUNCE_VX_BASE = 2.8;
const H_FRICTION = 0.98;
const JITTER_DEG = 5;
const TRAIL_LENGTH = 4;

const MULTIPLIERS: Record<string, number[]> = {
  low: [5.6, 2.1, 1.4, 1.1, 1, 0.5, 0.3, 0.5, 1, 1.1, 1.4, 2.1, 5.6],
  medium: [13, 3, 1.5, 1, 0.5, 0.3, 0.3, 0.3, 0.5, 1, 1.5, 3, 13],
  high: [110, 41, 10, 5, 3, 1.5, 0.5, 1.5, 3, 5, 10, 41, 110],
};

interface BallState {
  x: number; y: number; vx: number; vy: number;
  currentRow: number; path: ("L" | "R")[];
  result: { bucket: number; multiplier: number; payout: number; betAmount: number } | null;
  landed: boolean; launchDelay: number; started: boolean;
  trail: { x: number; y: number }[];
}

function getBucketColor(mult: number): string {
  if (mult >= 10) return "bg-yellow-500 text-black";
  if (mult >= 3) return "bg-orange-500 text-white";
  if (mult >= 1) return "bg-emerald-600 text-white";
  return "bg-red-600 text-white";
}

function getPegRowY(row: number, h: number): number {
  return ((row + 1) / (ROWS + 1.5)) * h;
}

export default function Plinko() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState("0.50");
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [dropping, setDropping] = useState(false);
  const [ballCount, setBallCount] = useState(1);
  const [landedBuckets, setLandedBuckets] = useState<number[]>([]);
  const [lastResults, setLastResults] = useState<{ multiplier: number; payout: number; bet: number }[]>([]);
  const [shaking, setShaking] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const ballRefs = useRef<(HTMLDivElement | null)[]>([]);
  const trailRefs = useRef<(HTMLDivElement | null)[][]>([]);
  const pegRefs = useRef<(HTMLDivElement | null)[][]>([]);
  const ballsRef = useRef<BallState[]>([]);
  const rafRef = useRef<number>(0);
  const pendingRef = useRef(0);
  const resultsAccRef = useRef<{ multiplier: number; payout: number; bet: number }[]>([]);

  const { data: balance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: history, refetch: refetchHistory } = trpc.casino.plinko.history.useQuery(undefined, { staleTime: 10_000 });
  const dropMutation = trpc.casino.plinko.drop.useMutation();

  const cash = balance ?? 20;
  const mults = MULTIPLIERS[risk];
  const parsedBetAmount = parseCasinoBetAmount(betAmount);
  const totalBetAmount = parsedBetAmount * ballCount;

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // Init peg refs
  if (pegRefs.current.length === 0) {
    pegRefs.current = Array.from({ length: ROWS }, (_, r) => new Array(r + 3).fill(null));
  }

  const runPhysics = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    const bw = board.offsetWidth;
    const bh = board.offsetHeight;
    const now = performance.now();
    let anyActive = false;

    for (let i = 0; i < ballsRef.current.length; i++) {
      const ball = ballsRef.current[i];
      if (ball.landed) continue;
      if (!ball.started) {
        if (now < ball.launchDelay) continue;
        ball.started = true;
      }
      anyActive = true;

      ball.vy += GRAVITY;
      ball.vx *= H_FRICTION;
      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > TRAIL_LENGTH) ball.trail.shift();

      if (ball.currentRow < ROWS) {
        const pegY = getPegRowY(ball.currentRow, bh);
        if (ball.y >= pegY) {
          const dir = ball.path[ball.currentRow];
          const sign = dir === "R" ? 1 : -1;
          const jitter = (Math.random() * 2 - 1) * JITTER_DEG * (Math.PI / 180);
          ball.vx = BOUNCE_VX_BASE * sign * Math.cos(jitter) - BOUNCE_VY * Math.sin(jitter);
          ball.vy = BOUNCE_VX_BASE * sign * Math.sin(jitter) + BOUNCE_VY * Math.cos(jitter);
          ball.y = pegY;

          // Glow peg
          const pegsInRow = ball.currentRow + 3;
          let closestCol = 0, closestDist = Infinity;
          for (let c = 0; c < pegsInRow; c++) {
            const pegX = bw / 2 + (c - (pegsInRow - 1) / 2) * (bw / (ROWS + 3));
            const dist = Math.abs(pegX - ball.x);
            if (dist < closestDist) { closestDist = dist; closestCol = c; }
          }
          const pegEl = pegRefs.current[ball.currentRow]?.[closestCol];
          if (pegEl) {
            pegEl.style.background = "radial-gradient(circle, #fbbf24, #f59e0b)";
            pegEl.style.boxShadow = "0 0 8px rgba(250,204,21,0.7)";
            pegEl.style.transform = "scale(1.4)";
            setTimeout(() => { pegEl.style.background = ""; pegEl.style.boxShadow = ""; pegEl.style.transform = ""; }, 300);
          }
          ball.currentRow++;
        }
      } else if (ball.y >= bh - 5) {
        ball.landed = true;
        ball.y = bh - 5;
        const ballEl = ballRefs.current[i];
        if (ballEl) ballEl.style.opacity = "0";
        for (const tEl of (trailRefs.current[i] || [])) { if (tEl) tEl.style.opacity = "0"; }

        if (ball.result) {
          setLandedBuckets(prev => [...prev, ball.result!.bucket]);
          resultsAccRef.current.push({ multiplier: ball.result.multiplier, payout: ball.result.payout, bet: ball.result.betAmount });
          if (ball.result.multiplier >= 10) { setShaking(true); setTimeout(() => setShaking(false), 400); }
        }
        pendingRef.current--;
        if (pendingRef.current <= 0) {
          setDropping(false);
          setLastResults([...resultsAccRef.current]);
          refetchBalance();
          refetchHistory();
          const totalPayout = resultsAccRef.current.reduce((s, r) => s + r.payout, 0);
          if (resultsAccRef.current.length === 1) {
            const r = resultsAccRef.current[0];
            if (r.payout > 0) toast.success(`${r.multiplier}x — $${r.payout.toFixed(2)}`);
            else toast.error(`${r.multiplier}x — Lost`);
          } else {
            toast.success(`${resultsAccRef.current.length} balls — Total: $${totalPayout.toFixed(2)}`);
          }
          setTimeout(() => { setLastResults([]); setLandedBuckets([]); }, 2500);
        }
      }

      const ballEl = ballRefs.current[i];
      if (ballEl) ballEl.style.transform = `translate3d(${ball.x - 6}px, ${ball.y - 6}px, 0)`;
      const trails = trailRefs.current[i] || [];
      for (let tr = 0; tr < TRAIL_LENGTH; tr++) {
        const tEl = trails[tr];
        if (!tEl) continue;
        const tp = ball.trail[ball.trail.length - 1 - (tr + 1)];
        if (tp) {
          const sz = Math.max(4 - tr, 1);
          tEl.style.transform = `translate3d(${tp.x - sz / 2}px, ${tp.y - sz / 2}px, 0)`;
          tEl.style.width = `${sz}px`; tEl.style.height = `${sz}px`;
          tEl.style.opacity = `${Math.max(0.4 - tr * 0.1, 0)}`;
        } else { tEl.style.opacity = "0"; }
      }
    }
    if (anyActive) rafRef.current = requestAnimationFrame(runPhysics);
  }, [refetchBalance, refetchHistory]);

  const handleDrop = useCallback(async () => {
    if (dropping || !isAuthenticated) return;
    if (parsedBetAmount < MIN_CASINO_BET || parsedBetAmount > MAX_CASINO_BET) {
      toast.error(language === "ko" ? "베팅 금액: $0.10 - $50" : "Bet amount: $0.10 - $50");
      return;
    }
    if (cash < totalBetAmount) {
      toast.error(language === "ko" ? `총 $${totalBetAmount.toFixed(2)} 필요` : `Need $${totalBetAmount.toFixed(2)}`);
      return;
    }

    setDropping(true);
    setLastResults([]);
    setLandedBuckets([]);
    resultsAccRef.current = [];
    pendingRef.current = ballCount;

    const board = boardRef.current;
    if (!board) return;
    const startX = board.offsetWidth / 2;
    const startTime = performance.now();

    try {
      const results = await Promise.all(
        Array.from({ length: ballCount }, () => dropMutation.mutateAsync({ bet: parsedBetAmount, risk }))
      );

      const newBalls: BallState[] = results.map((result, idx) => ({
        x: startX, y: 0, vx: 0, vy: 0, currentRow: 0,
        path: result.path, result: { bucket: result.bucket, multiplier: result.multiplier, payout: result.payout, betAmount: result.betAmount },
        landed: false, launchDelay: startTime + idx * 200, started: idx === 0, trail: [],
      }));

      ballsRef.current = newBalls;
      for (let idx = 0; idx < newBalls.length; idx++) {
        const el = ballRefs.current[idx];
        if (el) { el.style.opacity = "1"; el.style.transform = `translate3d(${startX - 6}px, -6px, 0)`; }
      }
      rafRef.current = requestAnimationFrame(runPhysics);
    } catch (err: any) { setDropping(false); toast.error(err.message || "Drop failed"); }
  }, [ballCount, cash, dropMutation, dropping, isAuthenticated, language, parsedBetAmount, risk, runPhysics, totalBetAmount]);

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <AppNav />
      <CasinoSubNav />
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

        <div className={`relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)] ${shaking ? "animate-shake" : ""}`}>
          <style>{`
            @keyframes shake { 0%,100%{transform:translate(0)} 10%{transform:translate(-3px,1px)} 30%{transform:translate(3px,-2px)} 50%{transform:translate(-2px,3px)} 70%{transform:translate(2px,-1px)} 90%{transform:translate(-1px,2px)} }
            .animate-shake { animation: shake 0.4s ease-in-out; }
            .peg-dot { transition: background 0.2s, box-shadow 0.2s, transform 0.2s; }
          `}</style>
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/80 to-zinc-900" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

          <div className="relative p-3 sm:p-5">
            {/* Results Strip */}
            {history && history.length > 0 && (
              <div className="flex gap-1 overflow-x-auto mb-2 pb-0.5 scrollbar-hide">
                {history.slice(0, 15).map((rr, idx) => (
                  <div key={idx} className={`flex-shrink-0 px-1.5 h-5 rounded flex items-center justify-center text-[7px] font-mono font-bold ${
                    rr.multiplier >= 3 ? "bg-yellow-500/30 text-yellow-400" : rr.multiplier >= 1 ? "bg-emerald-600/30 text-emerald-400" : "bg-red-600/30 text-red-400"
                  }`}>{rr.multiplier}x</div>
                ))}
              </div>
            )}

            {/* Peg Board */}
            <div ref={boardRef} className="relative mx-auto mb-2 overflow-hidden" style={{ maxWidth: 340, height: 380 }}>
              {Array.from({ length: ROWS }).map((_, row) => (
                <div key={row} className="absolute left-0 right-0 flex justify-center" style={{ top: `${((row + 1) / (ROWS + 1.5)) * 100}%` }}>
                  {Array.from({ length: row + 3 }).map((_, col) => {
                    const pegsInRow = row + 3;
                    return (
                      <div key={col}
                        ref={el => { if (!pegRefs.current[row]) pegRefs.current[row] = []; pegRefs.current[row][col] = el; }}
                        className="peg-dot rounded-full absolute"
                        style={{ width: 8, height: 8, background: "radial-gradient(circle at 35% 35%, #a1a1aa, #52525b)", left: `calc(50% + ${(col - (pegsInRow - 1) / 2) * (340 / (ROWS + 3))}px - 4px)` }}
                      />
                    );
                  })}
                </div>
              ))}

              {/* Ball elements */}
              {Array.from({ length: MAX_BALLS }).map((_, idx) => (
                <div key={`ball-${idx}`}>
                  {Array.from({ length: TRAIL_LENGTH }).map((_, tr) => (
                    <div key={`trail-${idx}-${tr}`}
                      ref={el => { if (!trailRefs.current[idx]) trailRefs.current[idx] = []; trailRefs.current[idx][tr] = el; }}
                      className="absolute rounded-full bg-yellow-400/40 pointer-events-none"
                      style={{ opacity: 0, width: 4, height: 4, willChange: "transform" }}
                    />
                  ))}
                  <div ref={el => { ballRefs.current[idx] = el; }}
                    className="absolute rounded-full pointer-events-none z-10"
                    style={{ width: 12, height: 12, background: "radial-gradient(circle at 40% 35%, #fde047, #f59e0b)", boxShadow: "0 0 10px rgba(250,204,21,0.5)", opacity: 0, willChange: "transform" }}
                  />
                </div>
              ))}
            </div>

            {/* Buckets */}
            <div className="flex gap-0.5 mb-3">
              {mults.map((mult, idx) => (
                <div key={idx} className={`flex-1 py-1.5 rounded text-center text-[7px] sm:text-[8px] font-mono font-bold transition-all duration-300 ${getBucketColor(mult)} ${landedBuckets.includes(idx) ? "ring-2 ring-yellow-400 scale-110 z-10" : ""}`}>
                  {mult}x
                </div>
              ))}
            </div>

            {/* Result */}
            <AnimatePresence>
              {lastResults.length > 0 && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="text-center mb-2">
                  {lastResults.length === 1 ? (
                    <p className={`text-2xl font-bold font-mono ${lastResults[0].payout > 0 ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                      {lastResults[0].multiplier}x {lastResults[0].payout > 0 ? `+$${lastResults[0].payout.toFixed(2)}` : `-$${lastResults[0].bet.toFixed(2)}`}
                    </p>
                  ) : (
                    <p className={`text-2xl font-bold font-mono ${lastResults.reduce((s, r) => s + r.payout, 0) >= lastResults.reduce((s, r) => s + r.bet, 0) ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                      {lastResults.length} balls · ${lastResults.reduce((s, r) => s + r.payout, 0).toFixed(2)}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Ball Count */}
            <div className="flex gap-1.5 justify-center mb-3">
              <span className="text-[10px] text-zinc-500 self-center mr-1">Balls:</span>
              {[1, 3, 5].map(n => (
                <button key={n} onClick={() => !dropping && setBallCount(n)} disabled={dropping}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${ballCount === n ? "bg-pink-500/30 text-pink-300 border border-pink-500/40" : "bg-zinc-800 text-zinc-500 border border-zinc-700/30 hover:text-zinc-300"}`}>{n}</button>
              ))}
            </div>

            {/* Risk */}
            <div className="flex gap-1.5 justify-center mb-3">
              {(["low", "medium", "high"] as const).map(rk => (
                <button key={rk} onClick={() => !dropping && setRisk(rk)} disabled={dropping}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                    risk === rk ? rk === "high" ? "bg-red-500/30 text-red-300 border border-red-500/40" : rk === "medium" ? "bg-yellow-500/30 text-yellow-300 border border-yellow-500/40" : "bg-emerald-500/30 text-emerald-300 border border-emerald-500/40" : "bg-zinc-800 text-zinc-500 border border-zinc-700/30 hover:text-zinc-300"
                  }`}>{rk}</button>
              ))}
            </div>

            <div className="mb-3">
              <CasinoBetControls
                language={language}
                value={betAmount}
                cash={cash}
                disabled={dropping}
                onChange={setBetAmount}
              />
            </div>

            <p className="mb-3 text-center text-[10px] font-mono text-zinc-500">
              {language === "ko"
                ? `공당 $${parsedBetAmount.toFixed(2)} · 총 $${totalBetAmount.toFixed(2)}`
                : `Per ball $${parsedBetAmount.toFixed(2)} · Total $${totalBetAmount.toFixed(2)}`}
            </p>

            {/* Drop */}
            <motion.button
              whileHover={!dropping ? { scale: 1.01 } : {}}
              whileTap={!dropping ? { scale: 0.98 } : {}}
              onClick={handleDrop}
              disabled={
                dropping ||
                !isAuthenticated ||
                parsedBetAmount < MIN_CASINO_BET ||
                parsedBetAmount > MAX_CASINO_BET ||
                cash < totalBetAmount
              }
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm disabled:opacity-30 transition-colors shadow-lg"
            >
              {dropping ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                ballCount > 1
                  ? language === "ko"
                    ? `${ballCount}개 드롭 · $${totalBetAmount.toFixed(2)}`
                    : `DROP ${ballCount} BALLS · $${totalBetAmount.toFixed(2)}`
                  : language === "ko"
                    ? `드롭 · $${parsedBetAmount.toFixed(2)}`
                    : `DROP · $${parsedBetAmount.toFixed(2)}`}
            </motion.button>
          </div>
        </div>

        <p className="text-center text-[9px] text-zinc-700 mt-4 font-mono">2-3% house edge · $500 max payout</p>
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
