import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";
import CasinoSubNav from "@/components/CasinoSubNav";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";
import CasinoGameLog from "@/components/CasinoGameLog";
import CasinoBetControls, {
  MAX_CASINO_BET,
  MIN_CASINO_BET,
  parseCasinoBetAmount,
} from "@/components/CasinoBetControls";

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const STRIP_CELL_WIDTH = 42;
const STRIP_REPEATS = 6;

type RouletteColor = "red" | "black" | "green";

interface SpinPlan {
  id: number;
  number: number;
  color: RouletteColor;
  targetIndex: number;
  startX: number;
  endX: number;
}

const STRIP_SEGMENTS = Array.from({ length: STRIP_REPEATS }, (_, repeatIndex) =>
  WHEEL_ORDER.map((number, numberIndex) => ({
    key: `${repeatIndex}-${numberIndex}-${number}`,
    number,
    color: getNumberColor(number),
  })),
).flat();

function getNumberColor(n: number): RouletteColor {
  if (n === 0) return "green";
  return RED_NUMBERS.includes(n) ? "red" : "black";
}

function getColorLabel(color: RouletteColor, language: string): string {
  if (color === "red") return language === "ko" ? "빨강" : "Red";
  if (color === "black") return language === "ko" ? "검정" : "Black";
  return language === "ko" ? "초록" : "Green";
}

function getColorClasses(color: RouletteColor): string {
  if (color === "red") return "border-red-500/40 bg-red-500/15 text-red-200";
  if (color === "black") return "border-border bg-secondary/80 text-foreground";
  return "border-emerald-500/40 bg-emerald-500/15 text-emerald-100";
}

function getColorButtonClasses(color: RouletteColor, selected: boolean): string {
  if (color === "red") {
    return selected
      ? "border-red-400 bg-red-500 text-foreground shadow-lg shadow-red-500/20"
      : "border-red-500/30 bg-red-500/10 text-red-200 hover:border-red-400/60";
  }
  if (color === "black") {
    return selected
      ? "border-zinc-400 bg-zinc-100 text-black shadow-lg shadow-zinc-100/20"
      : "border-border bg-card text-foreground hover:border-zinc-500";
  }
  return selected
    ? "border-emerald-400 bg-emerald-500 text-foreground shadow-lg shadow-emerald-500/20"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400/60";
}

function ColorStrip({
  frameRef,
  spinPlan,
  landed,
  onComplete,
  emptyLabel,
}: {
  frameRef: RefObject<HTMLDivElement | null>;
  spinPlan: SpinPlan | null;
  landed: boolean;
  onComplete: () => void;
  emptyLabel: string;
}) {
  return (
    <div
      ref={frameRef}
      className="relative mb-4 h-14 overflow-hidden rounded-xl border border-border/60 bg-background/70"
    >
      <div className="absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-zinc-950 to-transparent" />
      <div className="absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-zinc-950 to-transparent" />
      <div className="absolute left-1/2 top-0 z-20 flex -translate-x-1/2 flex-col items-center">
        <div className="h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-yellow-400" />
        <div className="h-10 w-px bg-yellow-400/70" />
      </div>

      {spinPlan ? (
        <motion.div
          key={spinPlan.id}
          className="flex h-full items-center"
          initial={{ x: spinPlan.startX }}
          animate={{ x: spinPlan.endX }}
          transition={{ duration: 3.2, ease: [0.08, 0.3, 0.18, 1] }}
          onAnimationComplete={onComplete}
          style={{ willChange: "transform" }}
        >
          {STRIP_SEGMENTS.map((segment, segmentIndex) => {
            const isWinner = landed && segmentIndex === spinPlan.targetIndex;
            return (
              <div
                key={segment.key}
                className={`flex h-full flex-shrink-0 items-center justify-center border-r border-white/5 ${
                  segment.color === "red"
                    ? "bg-red-600"
                    : segment.color === "black"
                      ? "bg-secondary"
                      : "bg-emerald-600"
                } ${isWinner ? "scale-105 ring-2 ring-inset ring-yellow-400 transition-transform" : ""}`}
                style={{ width: STRIP_CELL_WIDTH }}
              />
            );
          })}
        </motion.div>
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

export default function Roulette() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [betAmount, setBetAmount] = useState("1.00");
  const [selectedColor, setSelectedColor] = useState<RouletteColor>("red");
  const [spinPlan, setSpinPlan] = useState<SpinPlan | null>(null);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [stripLanded, setStripLanded] = useState(false);
  const [latestResult, setLatestResult] = useState<any>(null);
  const stripFrameRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<any>(null);
  const spinIdRef = useRef(0);
  const [stripWidth, setStripWidth] = useState(360);

  const { data: casinoBalance, refetch: refetchBalance } = trpc.casino.blackjack.balance.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: history, refetch: refetchHistory } = trpc.casino.roulette.history.useQuery(undefined, {
    staleTime: 10_000,
  });

  useEffect(() => {
    const frame = stripFrameRef.current;
    if (!frame) return;

    const updateWidth = () => {
      setStripWidth(frame.offsetWidth || 360);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const spinMutation = trpc.casino.roulette.spin.useMutation({
    onSuccess: (result) => {
      const winningIndex = WHEEL_ORDER.indexOf(result.number);
      const targetIndex = winningIndex + WHEEL_ORDER.length * 4;
      const finalX = -(targetIndex * STRIP_CELL_WIDTH - stripWidth / 2 + STRIP_CELL_WIDTH / 2);
      const startX = finalX + WHEEL_ORDER.length * STRIP_CELL_WIDTH * 2.4;

      spinIdRef.current += 1;
      resultRef.current = result;
      setLatestResult(result);
      setStripLanded(false);
      setIsWheelSpinning(true);
      setSpinPlan({
        id: spinIdRef.current,
        number: result.number,
        color: result.color,
        targetIndex,
        startX,
        endX: finalX,
      });
    },
    onError: (err) => {
      setIsWheelSpinning(false);
      toast.error(err.message);
    },
  });

  const cash = casinoBalance ?? 20;
  const parsedBetAmount = parseCasinoBetAmount(betAmount);
  const canSpin =
    isAuthenticated &&
    !isWheelSpinning &&
    !spinMutation.isPending &&
    parsedBetAmount >= MIN_CASINO_BET &&
    parsedBetAmount <= MAX_CASINO_BET &&
    parsedBetAmount <= cash;

  const handleSpin = useCallback(() => {
    if (!canSpin) return;
    spinMutation.mutate({
      type: selectedColor,
      amount: Math.round(parsedBetAmount * 100) / 100,
    });
  }, [canSpin, parsedBetAmount, selectedColor, spinMutation]);

  const handleSpinComplete = useCallback(() => {
    if (stripLanded) return;

    const result = resultRef.current;
    if (!result) return;

    setStripLanded(true);
    setIsWheelSpinning(false);
    refetchBalance();
    refetchHistory();

    if (result.outcome === "win") {
      toast.success(
        `${getColorLabel(result.color, language)} +$${result.totalPayout.toFixed(2)}`,
      );
      return;
    }

    if (result.outcome === "push") {
      toast(
        language === "ko"
          ? "초록 적중 · 컬러 베팅 환불"
          : "Green hit · color bet refunded",
      );
      return;
    }

    toast.error(
      `${getColorLabel(result.color, language)} -$${result.totalBet.toFixed(2)}`,
    );
  }, [language, refetchBalance, refetchHistory, stripLanded]);

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-card via-background to-background">
      <CasinoSubNav />
      <div className="container py-8 sm:py-8 max-w-lg mx-auto px-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/25 to-emerald-600/15 border border-green-500/20">
              <span className="text-lg">🎡</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground font-[var(--font-heading)]">Roulette</h1>
              <p className="text-xs text-muted-foreground font-mono">${cash.toFixed(2)}</p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/25">
            <span className="text-xs font-mono font-bold text-yellow-400">
              ${parsedBetAmount.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a5c2a] via-[#0d6b32] to-[#084d23]" />
          <div className="absolute inset-0 opacity-[0.07]" style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.4) 0.5px, transparent 0.5px)",
            backgroundSize: "8px 8px",
          }} />
          <div className="absolute inset-2 sm:inset-3 border border-green-500/10 rounded-xl pointer-events-none" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

          <div className="relative p-4 sm:p-5">
            {history && history.length > 0 && (
              <div className="flex gap-1 overflow-x-auto mb-3 pb-0.5 scrollbar-hide">
                {history.slice(0, 15).map((entry: any, index: number) => (
                  <div
                    key={`${entry.timestamp}-${index}`}
                    className={`h-5 w-5 flex-shrink-0 rounded-full ${
                      entry.color === "red"
                        ? "bg-red-600"
                        : entry.color === "black"
                          ? "bg-secondary border border-border"
                          : "bg-emerald-600"
                    }`}
                  />
                ))}
              </div>
            )}

            <ColorStrip
              frameRef={stripFrameRef}
              spinPlan={spinPlan}
              landed={stripLanded}
              onComplete={handleSpinComplete}
              emptyLabel={language === "ko" ? "스핀하면 컬러 스트립이 멈춥니다." : "Spin to watch the strip land."}
            />

            <AnimatePresence mode="wait">
              {latestResult && !isWheelSpinning && (
                <motion.div
                  key={latestResult.timestamp}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="mb-4 text-center"
                >
                  <div className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 ${getColorClasses(latestResult.color)}`}>
                    <span className="text-sm font-bold">
                      {getColorLabel(latestResult.color, language)}
                    </span>
                    <span className={`text-sm font-mono font-bold ${
                      latestResult.outcome === "win"
                        ? "text-[color:var(--color-win)]"
                        : latestResult.outcome === "push"
                          ? "text-yellow-300"
                          : "text-[color:var(--color-loss)]"
                    }`}>
                      {latestResult.outcome === "win"
                        ? `+$${latestResult.totalPayout.toFixed(2)}`
                        : latestResult.outcome === "push"
                          ? (language === "ko" ? "환불" : "Refund")
                          : `-$${latestResult.totalBet.toFixed(2)}`}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="mb-4 text-center text-xs text-foreground/80">
              {language === "ko" ? "빨강, 검정, 초록 중 하나를 고르세요. 초록이 뜨면 컬러 베팅은 환불됩니다." : "Pick red, black, or green. If green hits, red and black bets are refunded."}
            </p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {(["red", "black", "green"] as const).map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  disabled={isWheelSpinning}
                  className={`rounded-xl border px-3 py-3 text-sm font-bold transition-all ${getColorButtonClasses(color, selectedColor === color)}`}
                >
                  <div>{getColorLabel(color, language)}</div>
                  <div className="mt-1 text-xs font-mono opacity-80">
                    {color === "green" ? "37x" : "2x"}
                  </div>
                </button>
              ))}
            </div>

            <div className="mb-4">
              <CasinoBetControls
                language={language}
                value={betAmount}
                cash={cash}
                disabled={isWheelSpinning}
                onChange={setBetAmount}
              />
            </div>

            <motion.button
              whileHover={canSpin ? { scale: 1.01 } : {}}
              whileTap={canSpin ? { scale: 0.98 } : {}}
              onClick={handleSpin}
              disabled={!canSpin}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold text-sm hover:from-yellow-400 hover:to-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg shadow-yellow-500/15"
            >
              {spinMutation.isPending || isWheelSpinning
                ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                : `${language === "ko" ? "스핀" : "SPIN"} · $${parsedBetAmount.toFixed(2)}`}
            </motion.button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/40 mt-4 font-mono">
          {language === "ko" ? "초록은 컬러 베팅 환불 · 깔끔한 중립 룰렛" : "Green refunds color bets · clean neutral roulette"}
        </p>

        <CasinoGameLog />
        <GamblingDisclaimer />
      </div>
    </div>
  );
}
