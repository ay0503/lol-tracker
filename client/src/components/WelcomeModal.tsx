import { useState, useEffect } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, ArrowRightLeft, Sparkles, Dice5, TrendingUp, Gamepad2 } from "lucide-react";

const STORAGE_KEY = "dori-welcome-seen";

export default function WelcomeModal() {
  const { language } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setOpen(true);
  }, []);

  const dismiss = () => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  const steps = language === "ko" ? [
    {
      icon: <TrendingUp className="w-8 h-8 text-[color:var(--color-win)]" />,
      title: "$DORI 트레이딩",
      desc: "목도리 도마뱀의 랭크 LP를 추적하는 가상 주식입니다. $200 가상 현금으로 시작하여 $DORI와 레버리지/인버스 ETF를 거래하세요.",
      highlight: "트레이딩 잔고: $200",
    },
    {
      icon: <Dice5 className="w-8 h-8 text-yellow-400" />,
      title: "카지노",
      desc: "블랙잭, 크래시, 지뢰찾기, 룰렛, 비디오 포커 — 가상 캐시로 카지노 게임을 즐기세요. 카지노 잔고는 트레이딩과 별도입니다.",
      highlight: "카지노 잔고: $20",
    },
    {
      icon: <ArrowRightLeft className="w-8 h-8 text-purple-400" />,
      title: "송금",
      desc: "트레이딩 캐시를 카지노 캐시로 전환할 수 있습니다. 환율은 10배입니다 — $1 트레이딩 = $10 카지노. 카지노 페이지에서 입금하세요.",
      highlight: "$1 → $10 (10배)",
    },
    {
      icon: <Sparkles className="w-8 h-8 text-pink-400" />,
      title: "배당금 & 베팅",
      desc: "주식을 보유하면 게임 결과에 따라 배당금을 받습니다. 다음 게임 승/패에 베팅할 수도 있습니다. 매일 카지노 보너스 $1을 받으세요!",
      highlight: "일일 보너스: $1",
    },
  ] : [
    {
      icon: <TrendingUp className="w-8 h-8 text-[color:var(--color-win)]" />,
      title: "Trading",
      desc: "Trade a virtual stock that tracks a League of Legends player's ranked LP. Start with $200 virtual cash and trade $DORI and leveraged/inverse ETFs.",
      highlight: "Trading balance: $200",
    },
    {
      icon: <Dice5 className="w-8 h-8 text-yellow-400" />,
      title: "Casino",
      desc: "Blackjack, Crash, Mines, Roulette, Video Poker — play casino games with virtual cash. Casino balance is separate from trading.",
      highlight: "Casino balance: $20",
    },
    {
      icon: <ArrowRightLeft className="w-8 h-8 text-purple-400" />,
      title: "Transfers",
      desc: "You can convert trading cash to casino cash. The exchange rate is 10x — $1 trading = $10 casino. Deposit from the Casino page.",
      highlight: "$1 → $10 (10x)",
    },
    {
      icon: <Sparkles className="w-8 h-8 text-pink-400" />,
      title: "Dividends & Betting",
      desc: "Hold stocks to earn dividends based on game results. You can also bet on the next game's outcome (WIN/LOSS). Claim $20 daily casino bonus!",
      highlight: "Daily bonus: $20",
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          >
            {/* Close button */}
            <button onClick={dismiss} className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all z-10">
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="bg-gradient-to-r from-primary/10 to-yellow-500/10 px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-1">
                <Gamepad2 className="w-6 h-6 text-primary" />
                <h2 className="text-lg font-bold text-foreground font-[var(--font-heading)]">
                  {language === "ko" ? "$DORI에 오신 것을 환영합니다!" : "Welcome to $DORI!"}
                </h2>
              </div>
              {/* Step dots */}
              <div className="flex gap-1.5 mt-3">
                {steps.map((_, i) => (
                  <div key={i} className={`h-1 rounded-full transition-colors ${i === step ? "w-6 bg-primary" : "w-2 bg-border"}`} />
                ))}
              </div>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: "spring", damping: 26, stiffness: 260 }}
                className="px-6 py-5"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-secondary/50 shrink-0">
                    {current.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground mb-1">{current.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{current.desc}</p>
                    <div className="mt-3 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 inline-block">
                      <span className="text-xs font-mono font-bold text-primary">{current.highlight}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Footer */}
            <div className="px-6 pb-5 flex items-center justify-between">
              <button
                onClick={dismiss}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {language === "ko" ? "건너뛰기" : "Skip"}
              </button>
              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="px-4 py-2 rounded-lg bg-secondary text-foreground text-xs font-bold hover:bg-secondary/80 transition-colors"
                  >
                    {language === "ko" ? "이전" : "Back"}
                  </button>
                )}
                <button
                  onClick={() => isLast ? dismiss() : setStep(step + 1)}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
                >
                  {isLast ? (language === "ko" ? "시작하기!" : "Let's go!") : (language === "ko" ? "다음" : "Next")}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
