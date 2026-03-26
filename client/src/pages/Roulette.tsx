import { useState, useCallback, useMemo, memo } from "react";
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

function getNumberColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.includes(n) ? "red" : "black";
}

// Standard European roulette board layout: rows go 1-2-3, 4-5-6, ... 34-35-36
// Each row has 3 numbers. Row i (0-indexed): [i*3+1, i*3+2, i*3+3]
const BOARD_ROWS: number[][] = [];
for (let i = 0; i < 12; i++) {
  BOARD_ROWS.push([i * 3 + 1, i * 3 + 2, i * 3 + 3]);
}

type BetType = "straight" | "red" | "black" | "odd" | "even" | "high" | "low" | "dozen1" | "dozen2" | "dozen3" | "column1" | "column2" | "column3";

interface PlacedBet {
  key: string;
  type: BetType;
  number?: number;
  amount: number;
}

const NumberCell = memo(function NumberCell({
  num, color, betAmount, isWinner, onClick,
}: {
  num: number; color: "red" | "black" | "green"; betAmount: number; isWinner: boolean; onClick: () => void;
}) {
  const bg = color === "green" ? "bg-emerald-600 border-emerald-500/40"
    : color === "red" ? "bg-red-600 border-red-500/30"
    : "bg-zinc-800 border-zinc-700/50";

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      className={`relative flex items-center justify-center rounded-sm sm:rounded text-white font-bold text-[11px] sm:text-sm transition-all border ${bg} ${
        isWinner ? "ring-2 ring-yellow-400 shadow-lg shadow-yellow-500/50 z-10" : ""
      } ${betAmount > 0 ? "ring-1 ring-white/30" : "hover:ring-1 hover:ring-white/20"}`}
      style={{ aspectRatio: "1" }}
    >
      {num}
      {betAmount > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-yellow-500 text-black text-[7px] sm:text-[8px] font-mono font-bold flex items-center justify-center shadow-md border border-yellow-400/50"
        >
          {betAmount < 1 ? `${Math.round(betAmount * 100)}` : betAmount}
        </motion.div>
      )}
      {isWinner && (
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.2, repeat: 2 }}
          className="absolute inset-0 rounded-sm sm:rounded ring-2 ring-yellow-400/60 pointer-events-none"
        />
      )}
    </motion.button>
  );
});

const OutsideBetCell = memo(function OutsideBetCell({
  label, betAmount, isWinner, onClick, className = "", colorDot,
}: {
  label: string; betAmount: number; isWinner: boolean; onClick: () => void; className?: string; colorDot?: "red" | "black";
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`relative flex items-center justify-center gap-1 rounded-sm sm:rounded border border-zinc-700/40 bg-zinc-900/50 text-zinc-200 font-bold text-[9px] sm:text-[11px] py-1.5 sm:py-2 transition-all ${
        isWinner ? "ring-2 ring-yellow-400 shadow-lg shadow-yellow-500/50" : ""
      } ${betAmount > 0 ? "ring-1 ring-white/30" : "hover:bg-zinc-800/60 hover:ring-1 hover:ring-zinc-600/50"} ${className}`}
    >
      {colorDot && (
        <span className={`w-2.5 h-2.5 rounded-full ${colorDot === "red" ? "bg-red-500" : "bg-zinc-700 border border-zinc-500"}`} />
      )}
      {label}
      {betAmount > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-yellow-500 text-black text-[7px] sm:text-[8px] font-mono font-bold flex items-center justify-center shadow-md border border-yellow-400/50"
        >
          {betAmount < 1 ? `${Math.round(betAmount * 100)}` : betAmount}
        </motion.div>
      )}
    </motion.button>
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

  const { data: casinoBalance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: history, refetch: refetchHistory } = trpc.casino.roulette.history.useQuery(undefined, {
    staleTime: 10_000,
  });

  const spinMutation = trpc.casino.roulette.spin.useMutation({
    onSuccess: (result) => {
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
      }, 3000);
    },
    onError: (err) => toast.error(err.message),
  });

  const cash = casinoBalance ?? 20;

  // Aggregate bets by key
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

  const canSpin = bets.length > 0 && totalBet <= 25 && totalBet <= cash && !spinMutation.isPending && winningNumber === null;

  const placeBet = useCallback((key: string, type: BetType, number?: number) => {
    if (winningNumber !== null) return;
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
  }, [selectedChip, bets, totalBet, cash, winningNumber]);

  const clearBets = useCallback(() => setBets([]), []);
  const undoBet = useCallback(() => setBets(prev => prev.slice(0, -1)), []);
  const repeatBets = useCallback(() => {
    if (lastBets.length === 0) return;
    setBets([...lastBets]);
  }, [lastBets]);

  const handleSpin = useCallback(() => {
    if (!canSpin) return;
    // Aggregate bets by key for the mutation
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
          <div className="absolute inset-3 sm:inset-4 border border-green-500/10 rounded-xl pointer-events-none" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

          <div className="relative p-3 sm:p-5">
            {/* Results Strip */}
            {history && history.length > 0 && (
              <div className="flex gap-1 overflow-x-auto mb-3 pb-1 scrollbar-hide">
                {history.slice(0, 15).map((r, i) => (
                  <motion.div
                    key={`${r.timestamp}-${i}`}
                    initial={i === 0 ? { scale: 0, opacity: 0 } : {}}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-mono font-bold ${
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

            {/* Result Overlay */}
            <AnimatePresence>
              {winningNumber !== null && lastResult && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="text-center mb-3"
                >
                  <div className="inline-flex flex-col items-center px-5 py-3 rounded-xl bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 shadow-xl">
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 0.8, repeat: 2 }}
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white mb-1.5 ${
                        getNumberColor(winningNumber) === "green" ? "bg-emerald-600" :
                        getNumberColor(winningNumber) === "red" ? "bg-red-600" : "bg-zinc-800"
                      }`}
                    >
                      {winningNumber}
                    </motion.div>
                    <p className={`text-sm font-bold font-mono ${lastResult.totalPayout > 0 ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                      {lastResult.totalPayout > 0 ? `+$${lastResult.totalPayout.toFixed(2)}` : `-$${lastResult.totalBet.toFixed(2)}`}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Betting Board */}
            <div className="space-y-1">
              {/* Zero */}
              <NumberCell
                num={0}
                color="green"
                betAmount={getBetAmount("straight-0")}
                isWinner={winningNumber === 0}
                onClick={() => placeBet("straight-0", "straight", 0)}
              />

              {/* Number Grid: 12 rows × 3 columns */}
              <div className="grid grid-cols-3 gap-1">
                {BOARD_ROWS.map(row =>
                  row.map(num => (
                    <NumberCell
                      key={num}
                      num={num}
                      color={getNumberColor(num)}
                      betAmount={getBetAmount(`straight-${num}`)}
                      isWinner={winningNumber === num}
                      onClick={() => placeBet(`straight-${num}`, "straight", num)}
                    />
                  ))
                )}
              </div>

              {/* Column bets (2:1) */}
              <div className="grid grid-cols-3 gap-1">
                {([["column1", "2:1", [1,4,7,10,13,16,19,22,25,28,31,34]],
                   ["column2", "2:1", [2,5,8,11,14,17,20,23,26,29,32,35]],
                   ["column3", "2:1", [3,6,9,12,15,18,21,24,27,30,33,36]]] as const).map(([key, label]) => (
                  <OutsideBetCell
                    key={key}
                    label={label}
                    betAmount={getBetAmount(key)}
                    isWinner={winningNumber !== null && winningNumber !== 0 && (
                      key === "column1" ? winningNumber % 3 === 1 :
                      key === "column2" ? winningNumber % 3 === 2 :
                      winningNumber % 3 === 0
                    )}
                    onClick={() => placeBet(key, key as BetType)}
                  />
                ))}
              </div>

              {/* Dozens */}
              <div className="grid grid-cols-3 gap-1">
                {([["dozen1", language === "ko" ? "1st 12" : "1st 12"],
                   ["dozen2", language === "ko" ? "2nd 12" : "2nd 12"],
                   ["dozen3", language === "ko" ? "3rd 12" : "3rd 12"]] as const).map(([key, label]) => (
                  <OutsideBetCell
                    key={key}
                    label={label}
                    betAmount={getBetAmount(key)}
                    isWinner={winningNumber !== null && (
                      key === "dozen1" ? winningNumber >= 1 && winningNumber <= 12 :
                      key === "dozen2" ? winningNumber >= 13 && winningNumber <= 24 :
                      winningNumber >= 25 && winningNumber <= 36
                    )}
                    onClick={() => placeBet(key, key as BetType)}
                  />
                ))}
              </div>

              {/* Outside bets: 1-18, Even, Red, Black, Odd, 19-36 */}
              <div className="grid grid-cols-6 gap-1">
                <OutsideBetCell
                  label="1-18"
                  betAmount={getBetAmount("low")}
                  isWinner={winningNumber !== null && winningNumber >= 1 && winningNumber <= 18}
                  onClick={() => placeBet("low", "low")}
                />
                <OutsideBetCell
                  label={language === "ko" ? "짝" : "EVEN"}
                  betAmount={getBetAmount("even")}
                  isWinner={winningNumber !== null && winningNumber !== 0 && winningNumber % 2 === 0}
                  onClick={() => placeBet("even", "even")}
                />
                <OutsideBetCell
                  label={language === "ko" ? "빨강" : "RED"}
                  betAmount={getBetAmount("red")}
                  isWinner={winningNumber !== null && RED_NUMBERS.includes(winningNumber)}
                  onClick={() => placeBet("red", "red")}
                  colorDot="red"
                />
                <OutsideBetCell
                  label={language === "ko" ? "검정" : "BLK"}
                  betAmount={getBetAmount("black")}
                  isWinner={winningNumber !== null && winningNumber !== 0 && !RED_NUMBERS.includes(winningNumber)}
                  onClick={() => placeBet("black", "black")}
                  colorDot="black"
                />
                <OutsideBetCell
                  label={language === "ko" ? "홀" : "ODD"}
                  betAmount={getBetAmount("odd")}
                  isWinner={winningNumber !== null && winningNumber !== 0 && winningNumber % 2 === 1}
                  onClick={() => placeBet("odd", "odd")}
                />
                <OutsideBetCell
                  label="19-36"
                  betAmount={getBetAmount("high")}
                  isWinner={winningNumber !== null && winningNumber >= 19 && winningNumber <= 36}
                  onClick={() => placeBet("high", "high")}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="mt-4 pt-3 border-t border-white/[0.05] space-y-3">
              {/* Bet management */}
              <div className="flex gap-2 justify-center">
                <button
                  onClick={clearBets}
                  disabled={bets.length === 0 || winningNumber !== null}
                  className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-[10px] font-bold uppercase disabled:opacity-25 transition-colors hover:bg-red-500/25"
                >
                  {language === "ko" ? "전체삭제" : "CLEAR"}
                </button>
                <button
                  onClick={undoBet}
                  disabled={bets.length === 0 || winningNumber !== null}
                  className="px-3 py-1.5 rounded-lg bg-zinc-700/50 text-zinc-300 text-[10px] font-bold uppercase disabled:opacity-25 transition-colors hover:bg-zinc-700"
                >
                  {language === "ko" ? "취소" : "UNDO"}
                </button>
                <button
                  onClick={repeatBets}
                  disabled={lastBets.length === 0 || winningNumber !== null}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/15 text-blue-400 text-[10px] font-bold uppercase disabled:opacity-25 transition-colors hover:bg-blue-600/25"
                >
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
                      className={`w-11 h-11 rounded-full font-mono font-bold text-[10px] shadow-md border-[2.5px] border-dashed transition-all ${
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
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold text-sm hover:from-yellow-400 hover:to-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg shadow-yellow-500/15"
              >
                {spinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
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
