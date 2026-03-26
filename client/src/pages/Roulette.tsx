import { useState, useCallback, useMemo, useEffect, useRef, memo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0.10: { bg: "from-blue-400 to-blue-600", border: "border-blue-300/50", text: "text-white" },
  0.25: { bg: "from-emerald-400 to-emerald-600", border: "border-emerald-300/50", text: "text-white" },
  0.50: { bg: "from-red-400 to-red-600", border: "border-red-300/50", text: "text-white" },
  1: { bg: "from-gray-100 to-gray-300", border: "border-gray-200/50", text: "text-gray-800" },
  2: { bg: "from-pink-400 to-pink-600", border: "border-pink-300/50", text: "text-white" },
  5: { bg: "from-yellow-400 to-amber-600", border: "border-yellow-300/50", text: "text-black" },
};

// European wheel order
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

function getNumberColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.includes(n) ? "red" : "black";
}

type BetType = "straight" | "red" | "black" | "odd" | "even" | "high" | "low" | "dozen1" | "dozen2" | "dozen3" | "column1" | "column2" | "column3";

interface PlacedBet {
  key: string;
  type: BetType;
  number?: number;
  amount: number;
}

// ─── Spinning Wheel Strip ───
const SpinningWheel = memo(function SpinningWheel({
  winningNumber,
  isSpinning,
}: {
  winningNumber: number | null;
  isSpinning: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [landed, setLanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSpinning) {
      setVisible(true);
      setLanded(false);
    }
  }, [isSpinning]);

  useEffect(() => {
    if (!isSpinning && winningNumber !== null && visible) {
      setLanded(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setLanded(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isSpinning, winningNumber, visible]);

  if (!visible) return null;

  const repeated = [...WHEEL_ORDER, ...WHEEL_ORDER, ...WHEEL_ORDER, ...WHEEL_ORDER];
  const cellW = 40;
  const targetIdx = winningNumber !== null
    ? WHEEL_ORDER.indexOf(winningNumber) + WHEEL_ORDER.length * 2
    : 0;
  const containerW = containerRef.current?.offsetWidth ?? 340;
  const finalX = -(targetIdx * cellW - containerW / 2 + cellW / 2);

  return (
    <div ref={containerRef} className="relative overflow-hidden h-12 sm:h-14 mb-2 rounded-lg bg-zinc-950/60 border border-zinc-800/50">
      {/* Center pointer */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center">
        <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-yellow-400" />
        <div className="w-px h-[calc(100%-6px)] bg-yellow-400/60" style={{ height: "calc(3rem - 6px)" }} />
      </div>
      {/* Edge fades */}
      <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-zinc-950/90 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-zinc-950/90 to-transparent z-10 pointer-events-none" />

      <motion.div
        className="flex items-center h-full"
        style={{ willChange: "transform" }}
        initial={{ x: 0 }}
        animate={{ x: isSpinning ? -cellW * WHEEL_ORDER.length : finalX }}
        transition={
          isSpinning
            ? { duration: 1.2, ease: "linear" }
            : { duration: 2, ease: [0.15, 0.85, 0.35, 1] }
        }
      >
        {repeated.map((num, idx) => {
          const color = getNumberColor(num);
          const isWinner = landed && num === winningNumber && idx === targetIdx;
          return (
            <div
              key={idx}
              className={`flex-shrink-0 flex items-center justify-center font-bold text-xs sm:text-sm text-white border-r border-white/5 ${
                color === "green" ? "bg-emerald-600" :
                color === "red" ? "bg-red-600" : "bg-zinc-800"
              } ${isWinner ? "ring-2 ring-inset ring-yellow-400 bg-yellow-500/20" : ""}`}
              style={{ width: cellW, height: "100%" }}
            >
              {num}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
});

// ─── Compact Number Cell ───
const NumberCell = memo(function NumberCell({
  num, color, betAmount, isWinner, onClick, className = "",
}: {
  num: number; color: "red" | "black" | "green"; betAmount: number; isWinner: boolean; onClick: () => void; className?: string;
}) {
  const bg = color === "green" ? "bg-emerald-600 border-emerald-500/40"
    : color === "red" ? "bg-red-600 border-red-500/30"
    : "bg-zinc-800 border-zinc-700/50";

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center justify-center rounded-[2px] text-white font-bold text-[9px] sm:text-[11px] transition-all border ${bg} ${
        isWinner ? "ring-[1.5px] ring-yellow-400 shadow-md shadow-yellow-500/40 z-10" : ""
      } ${betAmount > 0 ? "ring-1 ring-white/30" : "hover:brightness-125"} ${className}`}
    >
      {num}
      {betAmount > 0 && (
        <div className="absolute -top-1 -right-1 z-10 w-3 h-3 rounded-full bg-yellow-500 text-black text-[6px] font-mono font-bold flex items-center justify-center shadow border border-yellow-400/50">
          {betAmount < 1 ? `${Math.round(betAmount * 100)}` : betAmount}
        </div>
      )}
    </button>
  );
});

// ─── Compact Outside Bet Cell ───
const OutsideBetCell = memo(function OutsideBetCell({
  label, betAmount, isWinner, onClick, className = "", colorDot,
}: {
  label: string; betAmount: number; isWinner: boolean; onClick: () => void; className?: string; colorDot?: "red" | "black";
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center justify-center gap-0.5 rounded-[2px] border border-zinc-700/40 bg-zinc-900/50 text-zinc-200 font-bold text-[8px] sm:text-[10px] transition-all ${
        isWinner ? "ring-[1.5px] ring-yellow-400 shadow-md shadow-yellow-500/40" : ""
      } ${betAmount > 0 ? "ring-1 ring-white/30" : "hover:bg-zinc-800/60"} ${className}`}
    >
      {colorDot && (
        <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${colorDot === "red" ? "bg-red-500" : "bg-zinc-600 border border-zinc-400"}`} />
      )}
      {label}
      {betAmount > 0 && (
        <div className="absolute -top-1 -right-1 z-10 w-3 h-3 rounded-full bg-yellow-500 text-black text-[6px] font-mono font-bold flex items-center justify-center shadow border border-yellow-400/50">
          {betAmount < 1 ? `${Math.round(betAmount * 100)}` : betAmount}
        </div>
      )}
    </button>
  );
});

export default function Roulette() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const [selectedChip, setSelectedChip] = useState(0.50);
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [lastBets, setLastBets] = useState<PlacedBet[]>([]);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{ totalPayout: number; totalBet: number } | null>(null);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);

  const { data: casinoBalance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: history, refetch: refetchHistory } = trpc.casino.roulette.history.useQuery(undefined, {
    staleTime: 10_000,
  });

  const spinMutation = trpc.casino.roulette.spin.useMutation({
    onSuccess: (result) => {
      setIsWheelSpinning(false);
      setWinningNumber(result.number);
      setLastResult({ totalPayout: result.totalPayout, totalBet: result.totalBet });
      setLastBets([...bets]);
      refetchBalance();
      refetchHistory();

      const profit = result.totalPayout - result.totalBet;
      if (profit > 0) {
        toast.success(`${result.number} ${result.color === "red" ? "🔴" : result.color === "black" ? "⚫" : "🟢"} +$${result.totalPayout.toFixed(2)}`);
      } else if (result.totalPayout > 0) {
        toast(`${result.number} — partial win +$${result.totalPayout.toFixed(2)}`);
      } else {
        toast.error(`${result.number} ${result.color === "red" ? "🔴" : result.color === "black" ? "⚫" : "🟢"} -$${result.totalBet.toFixed(2)}`);
      }

      setTimeout(() => {
        setWinningNumber(null);
        setLastResult(null);
        setBets([]);
      }, 4000);
    },
    onError: (err) => {
      setIsWheelSpinning(false);
      toast.error(err.message);
    },
  });

  const cash = casinoBalance ?? 20;

  const betsByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bets) {
      map.set(b.key, (map.get(b.key) ?? 0) + b.amount);
    }
    return map;
  }, [bets]);

  const totalBet = useMemo(() =>
    bets.reduce((sum, b) => sum + b.amount, 0),
    [bets]
  );

  const canSpin = bets.length > 0 && totalBet <= 25 && totalBet <= cash && !spinMutation.isPending && winningNumber === null && !isWheelSpinning;

  const placeBet = useCallback((key: string, type: BetType, number?: number) => {
    if (winningNumber !== null || isWheelSpinning) return;
    const currentAmount = bets.filter(b => b.key === key).reduce((s, b) => s + b.amount, 0);
    if (currentAmount + selectedChip > 5) {
      toast.error("Max $5 per position");
      return;
    }
    const newTotal = totalBet + selectedChip;
    if (newTotal > 25) {
      toast.error("Max $25 total per spin");
      return;
    }
    if (selectedChip > cash) {
      toast.error("Insufficient balance");
      return;
    }
    setBets(prev => [...prev, { key, type, number, amount: selectedChip }]);
  }, [selectedChip, bets, totalBet, cash, winningNumber, isWheelSpinning]);

  const clearBets = useCallback(() => setBets([]), []);
  const undoBet = useCallback(() => setBets(prev => prev.slice(0, -1)), []);
  const repeatBets = useCallback(() => {
    if (lastBets.length === 0) return;
    setBets([...lastBets]);
  }, [lastBets]);

  const handleSpin = useCallback(() => {
    if (!canSpin) return;
    setIsWheelSpinning(true);
    const aggregated = new Map<string, PlacedBet>();
    for (const b of bets) {
      const existing = aggregated.get(b.key);
      if (existing) {
        existing.amount += b.amount;
      } else {
        aggregated.set(b.key, { ...b });
      }
    }
    const betArray = Array.from(aggregated.values()).map(b => ({
      type: b.type,
      number: b.number,
      amount: Math.round(b.amount * 100) / 100,
    }));
    spinMutation.mutate({ bets: betArray });
  }, [bets, canSpin]);

  const getBetAmount = (key: string) => betsByKey.get(key) ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <div className="container py-6 sm:py-8 max-w-lg mx-auto px-4">
        <Link href="/casino" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mb-5">
          <ArrowLeft className="w-3.5 h-3.5" /> Casino
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/25 to-emerald-600/15 border border-green-500/20">
              <span className="text-lg">🎡</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-[var(--font-heading)]">Roulette</h1>
              <p className="text-xs text-zinc-400 font-mono">${cash.toFixed(2)}</p>
            </div>
          </div>
          {totalBet > 0 && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/25">
              <span className="text-[11px] font-mono font-bold text-yellow-400">${totalBet.toFixed(2)}</span>
            </motion.div>
          )}
        </div>

        {/* Game Area */}
        <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a5c2a] via-[#0d6b32] to-[#084d23]" />
          <div className="absolute inset-0 opacity-[0.07]" style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.4) 0.5px, transparent 0.5px)",
            backgroundSize: "8px 8px",
          }} />
          <div className="absolute inset-2 sm:inset-3 border border-green-500/10 rounded-xl pointer-events-none" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

          <div className="relative p-2.5 sm:p-4">
            {/* Results Strip */}
            {history && history.length > 0 && (
              <div className="flex gap-1 overflow-x-auto mb-2 pb-0.5 scrollbar-hide">
                {history.slice(0, 15).map((r, i) => (
                  <motion.div
                    key={`${r.timestamp}-${i}`}
                    initial={i === 0 ? { scale: 0, opacity: 0 } : {}}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[7px] sm:text-[8px] font-mono font-bold ${
                      r.color === "green" ? "bg-emerald-600 text-white" :
                      r.color === "red" ? "bg-red-600 text-white" :
                      "bg-zinc-800 text-zinc-200 border border-zinc-700"
                    }`}
                  >
                    {r.number}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Spinning Wheel */}
            <SpinningWheel winningNumber={winningNumber} isSpinning={isWheelSpinning} />

            {/* Result Overlay */}
            <AnimatePresence>
              {winningNumber !== null && lastResult && !isWheelSpinning && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="text-center mb-2"
                >
                  <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-lg bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 shadow-xl">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                      getNumberColor(winningNumber) === "green" ? "bg-emerald-600" :
                      getNumberColor(winningNumber) === "red" ? "bg-red-600" : "bg-zinc-800"
                    }`}>
                      {winningNumber}
                    </div>
                    <p className={`text-sm font-bold font-mono ${lastResult.totalPayout > 0 ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                      {lastResult.totalPayout > 0 ? `+$${lastResult.totalPayout.toFixed(2)}` : `-$${lastResult.totalBet.toFixed(2)}`}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Betting Board — Compact Horizontal Layout */}
            <div className="space-y-0.5">
              {/* Main grid: Zero (left) + 12×3 Numbers + Column bets (right) */}
              <div className="flex gap-0.5">
                {/* Zero — spans 3 rows */}
                <NumberCell
                  num={0}
                  color="green"
                  betAmount={getBetAmount("straight-0")}
                  isWinner={winningNumber === 0}
                  onClick={() => placeBet("straight-0", "straight", 0)}
                  className="w-6 sm:w-8 h-[calc(3*1.5rem+0.25rem)] sm:h-[calc(3*2rem+0.25rem)]"
                />

                {/* Number grid: 3 rows × 12 columns */}
                <div className="flex-1 space-y-0.5">
                  {/* Row 1 (top): 3, 6, 9, ... 36 */}
                  <div className="grid grid-cols-12 gap-0.5">
                    {[3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map(num => (
                      <NumberCell
                        key={num} num={num} color={getNumberColor(num)}
                        betAmount={getBetAmount(`straight-${num}`)}
                        isWinner={winningNumber === num}
                        onClick={() => placeBet(`straight-${num}`, "straight", num)}
                        className="h-6 sm:h-8"
                      />
                    ))}
                  </div>
                  {/* Row 2 (mid): 2, 5, 8, ... 35 */}
                  <div className="grid grid-cols-12 gap-0.5">
                    {[2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35].map(num => (
                      <NumberCell
                        key={num} num={num} color={getNumberColor(num)}
                        betAmount={getBetAmount(`straight-${num}`)}
                        isWinner={winningNumber === num}
                        onClick={() => placeBet(`straight-${num}`, "straight", num)}
                        className="h-6 sm:h-8"
                      />
                    ))}
                  </div>
                  {/* Row 3 (bot): 1, 4, 7, ... 34 */}
                  <div className="grid grid-cols-12 gap-0.5">
                    {[1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34].map(num => (
                      <NumberCell
                        key={num} num={num} color={getNumberColor(num)}
                        betAmount={getBetAmount(`straight-${num}`)}
                        isWinner={winningNumber === num}
                        onClick={() => placeBet(`straight-${num}`, "straight", num)}
                        className="h-6 sm:h-8"
                      />
                    ))}
                  </div>
                </div>

                {/* Column bets (2:1) — right side */}
                <div className="flex flex-col gap-0.5">
                  <OutsideBetCell label="2:1" betAmount={getBetAmount("column3")}
                    isWinner={winningNumber !== null && winningNumber !== 0 && winningNumber % 3 === 0}
                    onClick={() => placeBet("column3", "column3")}
                    className="w-6 sm:w-8 h-6 sm:h-8"
                  />
                  <OutsideBetCell label="2:1" betAmount={getBetAmount("column2")}
                    isWinner={winningNumber !== null && winningNumber !== 0 && winningNumber % 3 === 2}
                    onClick={() => placeBet("column2", "column2")}
                    className="w-6 sm:w-8 h-6 sm:h-8"
                  />
                  <OutsideBetCell label="2:1" betAmount={getBetAmount("column1")}
                    isWinner={winningNumber !== null && winningNumber !== 0 && winningNumber % 3 === 1}
                    onClick={() => placeBet("column1", "column1")}
                    className="w-6 sm:w-8 h-6 sm:h-8"
                  />
                </div>
              </div>

              {/* Dozens */}
              <div className="grid grid-cols-3 gap-0.5">
                <OutsideBetCell label="1st 12" betAmount={getBetAmount("dozen1")}
                  isWinner={winningNumber !== null && winningNumber >= 1 && winningNumber <= 12}
                  onClick={() => placeBet("dozen1", "dozen1")}
                  className="h-6 sm:h-7"
                />
                <OutsideBetCell label="2nd 12" betAmount={getBetAmount("dozen2")}
                  isWinner={winningNumber !== null && winningNumber >= 13 && winningNumber <= 24}
                  onClick={() => placeBet("dozen2", "dozen2")}
                  className="h-6 sm:h-7"
                />
                <OutsideBetCell label="3rd 12" betAmount={getBetAmount("dozen3")}
                  isWinner={winningNumber !== null && winningNumber >= 25 && winningNumber <= 36}
                  onClick={() => placeBet("dozen3", "dozen3")}
                  className="h-6 sm:h-7"
                />
              </div>

              {/* Outside bets */}
              <div className="grid grid-cols-6 gap-0.5">
                <OutsideBetCell label="1-18" betAmount={getBetAmount("low")}
                  isWinner={winningNumber !== null && winningNumber >= 1 && winningNumber <= 18}
                  onClick={() => placeBet("low", "low")}
                  className="h-6 sm:h-7"
                />
                <OutsideBetCell label={language === "ko" ? "짝" : "EVEN"} betAmount={getBetAmount("even")}
                  isWinner={winningNumber !== null && winningNumber !== 0 && winningNumber % 2 === 0}
                  onClick={() => placeBet("even", "even")}
                  className="h-6 sm:h-7"
                />
                <OutsideBetCell label={language === "ko" ? "빨강" : "RED"} betAmount={getBetAmount("red")}
                  isWinner={winningNumber !== null && RED_NUMBERS.includes(winningNumber)}
                  onClick={() => placeBet("red", "red")}
                  colorDot="red" className="h-6 sm:h-7"
                />
                <OutsideBetCell label={language === "ko" ? "검정" : "BLK"} betAmount={getBetAmount("black")}
                  isWinner={winningNumber !== null && winningNumber !== 0 && !RED_NUMBERS.includes(winningNumber)}
                  onClick={() => placeBet("black", "black")}
                  colorDot="black" className="h-6 sm:h-7"
                />
                <OutsideBetCell label={language === "ko" ? "홀" : "ODD"} betAmount={getBetAmount("odd")}
                  isWinner={winningNumber !== null && winningNumber !== 0 && winningNumber % 2 === 1}
                  onClick={() => placeBet("odd", "odd")}
                  className="h-6 sm:h-7"
                />
                <OutsideBetCell label="19-36" betAmount={getBetAmount("high")}
                  isWinner={winningNumber !== null && winningNumber >= 19 && winningNumber <= 36}
                  onClick={() => placeBet("high", "high")}
                  className="h-6 sm:h-7"
                />
              </div>
            </div>

            {/* Controls */}
            <div className="mt-3 pt-2.5 border-t border-white/[0.05] space-y-2.5">
              {/* Bet management */}
              <div className="flex gap-2 justify-center">
                <button onClick={clearBets} disabled={bets.length === 0 || winningNumber !== null || isWheelSpinning}
                  className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-[10px] font-bold uppercase disabled:opacity-25 transition-colors hover:bg-red-500/25">
                  {language === "ko" ? "전체삭제" : "CLEAR"}
                </button>
                <button onClick={undoBet} disabled={bets.length === 0 || winningNumber !== null || isWheelSpinning}
                  className="px-3 py-1.5 rounded-lg bg-zinc-700/50 text-zinc-300 text-[10px] font-bold uppercase disabled:opacity-25 transition-colors hover:bg-zinc-700">
                  {language === "ko" ? "취소" : "UNDO"}
                </button>
                <button onClick={repeatBets} disabled={lastBets.length === 0 || winningNumber !== null || isWheelSpinning}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/15 text-blue-400 text-[10px] font-bold uppercase disabled:opacity-25 transition-colors hover:bg-blue-600/25">
                  {language === "ko" ? "반복" : "REPEAT"}
                </button>
              </div>

              {/* Chips */}
              <div className="flex gap-1.5 justify-center">
                {[0.10, 0.25, 0.50, 1, 2, 5].map(amt => {
                  const label = amt < 1 ? `${Math.round(amt * 100)}¢` : `$${amt}`;
                  const selected = selectedChip === amt;
                  const disabled = cash < amt;
                  const colors = CHIP_COLORS[amt];
                  return (
                    <motion.button
                      key={amt}
                      whileHover={disabled ? {} : { y: -3 }}
                      whileTap={disabled ? {} : { scale: 0.92 }}
                      onClick={() => !disabled && setSelectedChip(amt)}
                      disabled={disabled}
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full font-mono font-bold text-[9px] sm:text-[10px] shadow-md border-[2.5px] border-dashed transition-all ${
                        disabled ? "opacity-25 cursor-not-allowed bg-gray-700 border-gray-600 text-gray-500" :
                        selected
                          ? `bg-gradient-to-b ${colors.bg} ${colors.text} ${colors.border} ring-2 ring-white/40 ring-offset-1 ring-offset-[#0d6b32] shadow-lg`
                          : `bg-gradient-to-b ${colors.bg} ${colors.text} ${colors.border} opacity-70 hover:opacity-100`
                      }`}
                    >
                      {label}
                    </motion.button>
                  );
                })}
              </div>

              {/* Spin Button */}
              <motion.button
                whileHover={canSpin ? { scale: 1.01 } : {}}
                whileTap={canSpin ? { scale: 0.98 } : {}}
                onClick={handleSpin}
                disabled={!canSpin}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold text-sm hover:from-yellow-400 hover:to-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg shadow-yellow-500/15"
              >
                {spinMutation.isPending || isWheelSpinning ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                  bets.length === 0
                    ? (language === "ko" ? "베팅을 놓으세요" : "PLACE YOUR BETS")
                    : `${language === "ko" ? "스핀" : "SPIN"} · $${totalBet.toFixed(2)}`}
              </motion.button>
            </div>
          </div>
        </div>

        <p className="text-center text-[9px] text-zinc-700 mt-4 font-mono">
          {language === "ko" ? "유럽식 룰렛 · 2.7% 하우스 엣지 · 최대 $250 지급" : "European · 2.7% edge · $250 max payout"}
        </p>
      </div>
    </div>
  );
}
