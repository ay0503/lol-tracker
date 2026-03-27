import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";
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
const TRAIL_LENGTH = 5;
const DEFAULT_BOARD_WIDTH = 360;
const BOARD_HEIGHT = 390;
const PEG_SIZE = 8;
const BALL_SIZE = 12;

const MULTIPLIERS: Record<string, number[]> = {
  low: [8.2, 3.08, 2.05, 1.54, 1.44, 0.82, 0.41, 0.82, 1.44, 1.54, 2.05, 3.08, 8.2],
  medium: [27.12, 6.26, 3.13, 2.09, 1.04, 0.63, 0.63, 0.63, 1.04, 2.09, 3.13, 6.26, 27.12],
  high: [41.45, 14.88, 3.72, 1.91, 1.17, 0.64, 0.21, 0.64, 1.17, 1.91, 3.72, 14.88, 41.45],
};

const RISK_DESCRIPTIONS = {
  low: {
    en: "Steadier board, gentler swings, smaller spikes.",
    ko: "변동폭이 가장 낮고, 완만한 수익 곡선입니다.",
  },
  medium: {
    en: "Balanced volatility with bigger edge buckets.",
    ko: "중간 변동성에 더 큰 외곽 배율이 섞입니다.",
  },
  high: {
    en: "Sharply volatile with rare big hits and punishing center bins.",
    ko: "희귀한 큰 당첨과 강한 중앙 손실이 공존하는 고변동 모드입니다.",
  },
} as const;

interface AnimationPoint {
  at: number;
  x: number;
  y: number;
  pegRow?: number;
}

interface BallState {
  x: number;
  y: number;
  path: ("L" | "R")[];
  result: { bucket: number; multiplier: number; payout: number; betAmount: number } | null;
  landed: boolean;
  launchDelay: number;
  started: boolean;
  trail: { x: number; y: number }[];
  animationPoints: AnimationPoint[];
  pointIndex: number;
}

function getBucketColor(multiplier: number): string {
  if (multiplier >= 10) return "bg-yellow-500 text-black";
  if (multiplier >= 3) return "bg-orange-500 text-white";
  if (multiplier >= 1) return "bg-emerald-600 text-white";
  return "bg-red-600 text-white";
}

function getPegRowY(rowIndex: number, boardHeight: number): number {
  return ((rowIndex + 1) / (ROWS + 1.5)) * boardHeight;
}

function getBoardPitch(boardWidth: number): number {
  return boardWidth / (ROWS + 3);
}

function getBucketPadding(boardWidth: number): number {
  return getBoardPitch(boardWidth);
}

function getBucketCenterX(bucket: number, boardWidth: number): number {
  return boardWidth / 2 + (bucket - ROWS / 2) * getBoardPitch(boardWidth);
}

function getPathTargetX(position: number, boardWidth: number): number {
  return boardWidth / 2 + position * (getBoardPitch(boardWidth) / 2);
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function easeInOutQuad(progress: number): number {
  if (progress < 0.5) return 2 * progress * progress;
  return 1 - Math.pow(-2 * progress + 2, 2) / 2;
}

function quadraticPoint(
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  progress: number,
) {
  const inverse = 1 - progress;
  return {
    x: inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x,
    y: inverse * inverse * start.y + 2 * inverse * progress * control.y + progress * progress * end.y,
  };
}

function seededUnit(seed: number, index: number): number {
  const raw = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453123;
  return raw - Math.floor(raw);
}

function appendQuadraticSegment(
  points: AnimationPoint[],
  start: { x: number; y: number },
  midpoint: { x: number; y: number },
  end: { x: number; y: number },
  startAt: number,
  duration: number,
  samples: number,
  pegRow?: number,
) {
  const control = {
    x: 2 * midpoint.x - (start.x + end.x) / 2,
    y: 2 * midpoint.y - (start.y + end.y) / 2,
  };

  for (let sampleIndex = 1; sampleIndex <= samples; sampleIndex++) {
    const progress = sampleIndex / samples;
    const point = quadraticPoint(start, control, end, progress);
    points.push({
      at: startAt + duration * progress,
      x: point.x,
      y: point.y,
      pegRow: pegRow !== undefined && sampleIndex === Math.round(samples / 2) ? pegRow : undefined,
    });
  }
}

function buildAnimationPoints(
  path: ("L" | "R")[],
  bucket: number,
  boardWidth: number,
  boardHeight: number,
  seed: number,
): AnimationPoint[] {
  const rowGap = boardHeight / (ROWS + 1.5);
  const pitch = getBoardPitch(boardWidth);
  const centerX = boardWidth / 2;
  const launchOffset = (seededUnit(seed, 0) - 0.5) * pitch * 0.35;
  const points: AnimationPoint[] = [{ at: 0, x: centerX + launchOffset, y: -14 }];

  let currentPoint = { x: centerX + launchOffset, y: -14 };
  let elapsed = 0;
  let position = 0;

  for (let rowIndex = 0; rowIndex < path.length; rowIndex++) {
    const sign = path[rowIndex] === "R" ? 1 : -1;
    position += sign;
    const laneX = getPathTargetX(position, boardWidth);
    const pegY = getPegRowY(rowIndex, boardHeight);
    const exitPoint = { x: laneX, y: pegY + rowGap * 0.46 };
    const wobble = (seededUnit(seed, rowIndex + 1) - 0.5) * pitch * 0.12;
    const midpoint = {
      x: lerp(currentPoint.x, laneX, 0.5) + wobble,
      y: pegY,
    };
    const duration = Math.max(58, 122 - rowIndex * 4);
    appendQuadraticSegment(points, currentPoint, midpoint, exitPoint, elapsed, duration, 8, rowIndex);
    elapsed += duration;
    currentPoint = exitPoint;
  }

  const bucketX = getBucketCenterX(bucket, boardWidth);
  const nearBucketPoint = { x: bucketX, y: boardHeight - rowGap * 0.58 };
  appendQuadraticSegment(
    points,
    currentPoint,
    { x: lerp(currentPoint.x, bucketX, 0.55), y: boardHeight - rowGap * 0.85 },
    nearBucketPoint,
    elapsed,
    170,
    10,
  );
  elapsed += 170;

  appendQuadraticSegment(
    points,
    nearBucketPoint,
    { x: bucketX, y: boardHeight - 6 },
    { x: bucketX, y: boardHeight - 12 },
    elapsed,
    90,
    6,
  );

  return points;
}

export default function Plinko() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState("0.50");
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [dropping, setDropping] = useState(false);
  const [ballCount, setBallCount] = useState<1 | 3 | 5>(1);
  const [landedBuckets, setLandedBuckets] = useState<number[]>([]);
  const [lastResults, setLastResults] = useState<{ multiplier: number; payout: number; bet: number }[]>([]);
  const [shaking, setShaking] = useState(false);
  const [boardWidth, setBoardWidth] = useState(DEFAULT_BOARD_WIDTH);

  const boardRef = useRef<HTMLDivElement>(null);
  const ballRefs = useRef<(HTMLDivElement | null)[]>([]);
  const trailRefs = useRef<(HTMLDivElement | null)[][]>([]);
  const pegRefs = useRef<(HTMLDivElement | null)[][]>([]);
  const pegFlashTimeoutsRef = useRef<number[][]>([]);
  const ballsRef = useRef<BallState[]>([]);
  const rafRef = useRef<number>(0);
  const pendingRef = useRef(0);
  const resultsAccRef = useRef<{ multiplier: number; payout: number; bet: number }[]>([]);

  const { data: balance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: history, refetch: refetchHistory } = trpc.casino.plinko.history.useQuery(undefined, {
    staleTime: 10_000,
  });
  const dropMutation = trpc.casino.plinko.drop.useMutation();

  const cash = balance ?? 20;
  const multipliers = MULTIPLIERS[risk];
  const parsedBetAmount = parseCasinoBetAmount(betAmount);
  const totalBetAmount = parsedBetAmount * ballCount;
  function renderControlPanel() {
    return (
      <>
      <div className="flex gap-1.5 justify-center lg:justify-start mb-3">
        <span className="text-[10px] text-zinc-500 self-center mr-1">Balls:</span>
        {([1, 3, 5] as const).map((countOption) => (
          <button
            key={countOption}
            onClick={() => !dropping && setBallCount(countOption)}
            disabled={dropping}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${ballCount === countOption ? "bg-pink-500/30 text-pink-300 border border-pink-500/40" : "bg-zinc-800 text-zinc-500 border border-zinc-700/30 hover:text-zinc-300"}`}
          >
            {countOption}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 justify-center lg:justify-start mb-3">
        {(["low", "medium", "high"] as const).map(riskOption => (
          <button
            key={riskOption}
            onClick={() => !dropping && setRisk(riskOption)}
            disabled={dropping}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
              risk === riskOption
                ? riskOption === "high"
                  ? "bg-red-500/30 text-red-300 border border-red-500/40"
                  : riskOption === "medium"
                    ? "bg-yellow-500/30 text-yellow-300 border border-yellow-500/40"
                    : "bg-emerald-500/30 text-emerald-300 border border-emerald-500/40"
                : "bg-zinc-800 text-zinc-500 border border-zinc-700/30 hover:text-zinc-300"
            }`}
          >
            {riskOption}
          </button>
        ))}
      </div>

      <p className="mb-3 text-center lg:text-left text-[10px] text-zinc-500">
        {language === "ko" ? RISK_DESCRIPTIONS[risk].ko : RISK_DESCRIPTIONS[risk].en}
      </p>

      <div className="mb-3">
        <CasinoBetControls
          language={language}
          value={betAmount}
          cash={cash}
          disabled={dropping}
          onChange={setBetAmount}
        />
      </div>

      <p className="mb-3 text-center lg:text-left text-[10px] font-mono text-zinc-500">
        {language === "ko"
          ? `공당 $${parsedBetAmount.toFixed(2)} · 총 $${totalBetAmount.toFixed(2)}`
          : `Per ball $${parsedBetAmount.toFixed(2)} · Total $${totalBetAmount.toFixed(2)}`}
      </p>

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
      </>
    );
  }

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const syncBoardWidth = () => setBoardWidth(board.offsetWidth || DEFAULT_BOARD_WIDTH);
    syncBoardWidth();

    const observer = new ResizeObserver(() => syncBoardWidth());
    observer.observe(board);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      for (const timeoutRow of pegFlashTimeoutsRef.current) {
        for (const timeoutId of timeoutRow ?? []) {
          if (timeoutId) window.clearTimeout(timeoutId);
        }
      }
    };
  }, []);

  if (pegRefs.current.length === 0) {
    pegRefs.current = Array.from({ length: ROWS }, (_, rowIndex) => new Array(rowIndex + 3).fill(null));
  }
  if (pegFlashTimeoutsRef.current.length === 0) {
    pegFlashTimeoutsRef.current = Array.from({ length: ROWS }, (_, rowIndex) => new Array(rowIndex + 3).fill(0));
  }

  const flashPeg = useCallback((rowIndex: number, ballX: number, activeBoardWidth: number) => {
    const pegsInRow = rowIndex + 3;
    let closestCol = 0;
    let closestDistance = Infinity;

    for (let colIndex = 0; colIndex < pegsInRow; colIndex++) {
      const pegX = activeBoardWidth / 2 + (colIndex - (pegsInRow - 1) / 2) * getBoardPitch(activeBoardWidth);
      const distance = Math.abs(pegX - ballX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestCol = colIndex;
      }
    }

    const pegEl = pegRefs.current[rowIndex]?.[closestCol];
    if (!pegEl) return;

    pegEl.classList.add("peg-dot-active");
    const previousTimeout = pegFlashTimeoutsRef.current[rowIndex]?.[closestCol];
    if (previousTimeout) window.clearTimeout(previousTimeout);
    pegFlashTimeoutsRef.current[rowIndex][closestCol] = window.setTimeout(() => {
      pegEl.classList.remove("peg-dot-active");
      pegFlashTimeoutsRef.current[rowIndex][closestCol] = 0;
    }, 180);
  }, []);

  const settleBallResult = useCallback((ball: BallState, ballIndex: number) => {
    ball.landed = true;
    const ballEl = ballRefs.current[ballIndex];
    if (ballEl) ballEl.style.opacity = "0";
    for (const trailEl of trailRefs.current[ballIndex] || []) {
      if (trailEl) trailEl.style.opacity = "0";
    }

    if (ball.result) {
      setLandedBuckets(prev => [...prev, ball.result!.bucket]);
      resultsAccRef.current.push({
        multiplier: ball.result.multiplier,
        payout: ball.result.payout,
        bet: ball.result.betAmount,
      });
      if (ball.result.multiplier >= 10) {
        setShaking(true);
        window.setTimeout(() => setShaking(false), 400);
      }
    }

    pendingRef.current--;
    if (pendingRef.current > 0) return;

    setDropping(false);
    setLastResults([...resultsAccRef.current]);
    refetchBalance();
    refetchHistory();
    const totalPayout = resultsAccRef.current.reduce((sum, entry) => sum + entry.payout, 0);
    if (resultsAccRef.current.length === 1) {
      const result = resultsAccRef.current[0];
      if (result.payout > 0) toast.success(`${result.multiplier}x — $${result.payout.toFixed(2)}`);
      else toast.error(`${result.multiplier}x — Lost`);
    } else {
      toast.success(`${resultsAccRef.current.length} balls — Total: $${totalPayout.toFixed(2)}`);
    }
    window.setTimeout(() => {
      setLastResults([]);
      setLandedBuckets([]);
    }, 2500);
  }, [refetchBalance, refetchHistory]);

  const runResolvedAnimation = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;

    const activeBoardWidth = board.offsetWidth || boardWidth;
    const now = performance.now();
    let anyActive = false;

    for (let ballIndex = 0; ballIndex < ballsRef.current.length; ballIndex++) {
      const ball = ballsRef.current[ballIndex];
      if (ball.landed) continue;
      if (!ball.started) {
        if (now < ball.launchDelay) continue;
        ball.started = true;
      }

      const elapsed = now - ball.launchDelay;
      const points = ball.animationPoints;
      const finalPoint = points[points.length - 1];
      anyActive = true;

      while (ball.pointIndex < points.length - 2 && points[ball.pointIndex + 1].at <= elapsed) {
        ball.pointIndex++;
        const reachedPoint = points[ball.pointIndex];
        if (reachedPoint.pegRow !== undefined) flashPeg(reachedPoint.pegRow, reachedPoint.x, activeBoardWidth);
      }

      const currentPoint = points[Math.min(ball.pointIndex, points.length - 1)];
      const nextPoint = points[Math.min(ball.pointIndex + 1, points.length - 1)];
      const span = Math.max(nextPoint.at - currentPoint.at, 1);
      const eased = easeInOutQuad(clamp((elapsed - currentPoint.at) / span, 0, 1));

      ball.x = lerp(currentPoint.x, nextPoint.x, eased);
      ball.y = lerp(currentPoint.y, nextPoint.y, eased);
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > TRAIL_LENGTH) ball.trail.shift();

      const ballEl = ballRefs.current[ballIndex];
      if (ballEl) {
        ballEl.style.transform = `translate3d(${ball.x - BALL_SIZE / 2}px, ${ball.y - BALL_SIZE / 2}px, 0)`;
      }

      const trails = trailRefs.current[ballIndex] || [];
      for (let trailIndex = 0; trailIndex < TRAIL_LENGTH; trailIndex++) {
        const trailEl = trails[trailIndex];
        if (!trailEl) continue;
        const trailPoint = ball.trail[ball.trail.length - 1 - (trailIndex + 1)];
        if (!trailPoint) {
          trailEl.style.opacity = "0";
          continue;
        }

        const size = Math.max(4 - trailIndex, 1);
        trailEl.style.transform = `translate3d(${trailPoint.x - size / 2}px, ${trailPoint.y - size / 2}px, 0)`;
        trailEl.style.width = `${size}px`;
        trailEl.style.height = `${size}px`;
        trailEl.style.opacity = `${Math.max(0.4 - trailIndex * 0.1, 0)}`;
      }

      if (elapsed >= finalPoint.at) {
        settleBallResult(ball, ballIndex);
      }
    }

    if (anyActive) rafRef.current = requestAnimationFrame(runResolvedAnimation);
  }, [boardWidth, flashPeg, settleBallResult]);

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

    const board = boardRef.current;
    if (!board) return;

    setDropping(true);
    setLastResults([]);
    setLandedBuckets([]);
    resultsAccRef.current = [];

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const activeBoardWidth = board.offsetWidth || boardWidth;
    const activeBoardHeight = board.offsetHeight || BOARD_HEIGHT;
    const startTime = performance.now();

    try {
      const response = await dropMutation.mutateAsync({ bet: parsedBetAmount, risk, count: ballCount });
      const results = response.results;
      pendingRef.current = results.length;

      const newBalls: BallState[] = results.map((result, index) => {
        const seed = result.path.reduce(
          (accumulator, dir, rowIndex) => accumulator + (dir === "R" ? 17 : 31) * (rowIndex + 1),
          result.bucket * 43 + index * 101,
        );
        const points = buildAnimationPoints(result.path, result.bucket, activeBoardWidth, activeBoardHeight, seed);
        return {
          x: points[0].x,
          y: points[0].y,
          path: result.path,
          result: {
            bucket: result.bucket,
            multiplier: result.multiplier,
            payout: result.payout,
            betAmount: result.betAmount,
          },
          landed: false,
          launchDelay: startTime + index * 170,
          started: false,
          trail: [],
          animationPoints: points,
          pointIndex: 0,
        };
      });

      ballsRef.current = newBalls;
      for (let ballIndex = 0; ballIndex < newBalls.length; ballIndex++) {
        const ballEl = ballRefs.current[ballIndex];
        if (ballEl) {
          ballEl.style.opacity = "1";
          ballEl.style.transform = `translate3d(${newBalls[ballIndex].x - BALL_SIZE / 2}px, ${newBalls[ballIndex].y - BALL_SIZE / 2}px, 0)`;
        }
      }

      rafRef.current = requestAnimationFrame(runResolvedAnimation);
    } catch (err: any) {
      setDropping(false);
      toast.error(err.message || "Drop failed");
    }
  }, [ballCount, boardWidth, cash, dropMutation, dropping, isAuthenticated, language, parsedBetAmount, risk, runResolvedAnimation, totalBetAmount]);

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <AppNav />
      <CasinoSubNav />
      <div className="container py-6 sm:py-8 max-w-6xl mx-auto px-4">
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

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className={`relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)] ${shaking ? "animate-shake" : ""}`}>
          <style>{`
            @keyframes shake { 0%,100%{transform:translate(0)} 10%{transform:translate(-3px,1px)} 30%{transform:translate(3px,-2px)} 50%{transform:translate(-2px,3px)} 70%{transform:translate(2px,-1px)} 90%{transform:translate(-1px,2px)} }
            .animate-shake { animation: shake 0.4s ease-in-out; }
            .peg-dot { transition: background 0.18s, box-shadow 0.18s, transform 0.18s; }
            .peg-dot-active {
              background: radial-gradient(circle, #fbbf24, #f59e0b) !important;
              box-shadow: 0 0 8px rgba(250,204,21,0.7);
              transform: scale(1.35);
            }
          `}</style>
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/80 to-zinc-900" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

          <div className="relative p-3 sm:p-5">
            {history && history.length > 0 && (
              <div className="flex gap-1 overflow-x-auto mb-2 pb-0.5 scrollbar-hide">
                {history.slice(0, 15).map((historyEntry, index) => (
                  <div
                    key={index}
                    className={`flex-shrink-0 px-1.5 h-5 rounded flex items-center justify-center text-[7px] font-mono font-bold ${
                      historyEntry.multiplier >= 3
                        ? "bg-yellow-500/30 text-yellow-400"
                        : historyEntry.multiplier >= 1
                          ? "bg-emerald-600/30 text-emerald-400"
                          : "bg-red-600/30 text-red-400"
                    }`}
                  >
                    {historyEntry.multiplier}x
                  </div>
                ))}
              </div>
            )}

            <div className="mx-auto w-full mb-3" style={{ maxWidth: DEFAULT_BOARD_WIDTH }}>
              <div ref={boardRef} className="relative overflow-hidden mb-2" style={{ width: "100%", height: BOARD_HEIGHT }}>
                {Array.from({ length: ROWS }).map((_, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="absolute left-0 right-0 flex justify-center"
                    style={{ top: `${((rowIndex + 1) / (ROWS + 1.5)) * 100}%` }}
                  >
                    {Array.from({ length: rowIndex + 3 }).map((_, colIndex) => {
                      const pegsInRow = rowIndex + 3;
                      return (
                        <div
                          key={colIndex}
                          ref={el => {
                            if (!pegRefs.current[rowIndex]) pegRefs.current[rowIndex] = [];
                            pegRefs.current[rowIndex][colIndex] = el;
                          }}
                          className="peg-dot rounded-full absolute"
                          style={{
                            width: PEG_SIZE,
                            height: PEG_SIZE,
                            background: "radial-gradient(circle at 35% 35%, #a1a1aa, #52525b)",
                            left: `calc(50% + ${(colIndex - (pegsInRow - 1) / 2) * getBoardPitch(boardWidth)}px - ${PEG_SIZE / 2}px)`,
                          }}
                        />
                      );
                    })}
                  </div>
                ))}

                {Array.from({ length: MAX_BALLS }).map((_, ballIndex) => (
                  <div key={`ball-${ballIndex}`}>
                    {Array.from({ length: TRAIL_LENGTH }).map((_, trailIndex) => (
                      <div
                        key={`trail-${ballIndex}-${trailIndex}`}
                        ref={el => {
                          if (!trailRefs.current[ballIndex]) trailRefs.current[ballIndex] = [];
                          trailRefs.current[ballIndex][trailIndex] = el;
                        }}
                        className="absolute rounded-full bg-yellow-400/40 pointer-events-none"
                        style={{ opacity: 0, width: 4, height: 4, willChange: "transform" }}
                      />
                    ))}
                    <div
                      ref={el => {
                        ballRefs.current[ballIndex] = el;
                      }}
                      className="absolute rounded-full pointer-events-none z-10"
                      style={{
                        width: BALL_SIZE,
                        height: BALL_SIZE,
                        background: "radial-gradient(circle at 40% 35%, #fde047, #f59e0b)",
                        boxShadow: "0 0 10px rgba(250,204,21,0.5)",
                        opacity: 0,
                        willChange: "transform",
                      }}
                    />
                  </div>
                ))}
              </div>

              <div
                className="flex gap-0.5"
                style={{
                  paddingLeft: `${getBucketPadding(boardWidth)}px`,
                  paddingRight: `${getBucketPadding(boardWidth)}px`,
                }}
              >
                {multipliers.map((multiplier, index) => (
                  <div
                    key={index}
                    className={`flex-1 py-1.5 rounded text-center text-[7px] sm:text-[8px] font-mono font-bold transition-all duration-300 ${getBucketColor(multiplier)} ${landedBuckets.includes(index) ? "ring-2 ring-yellow-400 scale-110 z-10" : ""}`}
                  >
                    {multiplier}x
                  </div>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {lastResults.length > 0 && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="text-center mb-2">
                  {lastResults.length === 1 ? (
                    <p className={`text-2xl font-bold font-mono ${lastResults[0].payout > 0 ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                      {lastResults[0].multiplier}x {lastResults[0].payout > 0 ? `+$${lastResults[0].payout.toFixed(2)}` : `-$${lastResults[0].bet.toFixed(2)}`}
                    </p>
                  ) : (
                    <p className={`text-2xl font-bold font-mono ${lastResults.reduce((sum, entry) => sum + entry.payout, 0) >= lastResults.reduce((sum, entry) => sum + entry.bet, 0) ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                      {lastResults.length} balls · ${lastResults.reduce((sum, entry) => sum + entry.payout, 0).toFixed(2)}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="lg:hidden">
              {renderControlPanel()}
            </div>
          </div>
          </div>

          <div className="hidden lg:block rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-4 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              {language === "ko" ? "드롭 패널" : "Drop Panel"}
            </p>
            {renderControlPanel()}
          </div>
        </div>

        <p className="text-center text-[9px] text-zinc-700 mt-4 font-mono">
          {language === "ko" ? "약 1% 플레이어 우위 · 최대 $500 지급" : "~1% player edge · $500 max payout"}
        </p>
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
