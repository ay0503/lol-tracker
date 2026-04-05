/*
 * Trade — Trading terminal page.
 * Chart + buy/sell panel + betting panel + portfolio summary.
 * Split from Home.tsx for dedicated trading experience.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { TickerProvider } from "@/contexts/TickerContext";
import LPChart from "@/components/LPChart";
import TradingPanel from "@/components/TradingPanel";
import BettingPanel from "@/components/BettingPanel";
import PriceRankLegend from "@/components/PriceRankLegend";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { LogIn, Wallet, TrendingUp, TrendingDown } from "lucide-react";

const spring = { type: "spring" as const, damping: 26, stiffness: 260 };

function PortfolioSummaryCard() {
  const { language } = useTranslation();
  const { data: portfolio } = trpc.trading.portfolio.useQuery(undefined, { staleTime: 60_000 });
  const { data: etfPrices } = trpc.prices.etfPrices.useQuery(undefined, { staleTime: 60_000 });

  if (!portfolio || !etfPrices) return null;

  const cash = portfolio.cashBalance ?? 0;
  let holdVal = 0;
  let shortPnl = 0;
  for (const holding of portfolio.holdings ?? []) {
    const price = etfPrices.find((ep: any) => ep.ticker === holding.ticker)?.price ?? 0;
    holdVal += (holding.shares ?? 0) * price;
    shortPnl += (holding.shortShares ?? 0) * ((holding.shortAvgPrice ?? 0) - price);
  }
  const totalValue = cash + holdVal + shortPnl;
  const pnl = totalValue - 200;
  const pnlPct = (pnl / 200) * 100;
  const isUp = pnl >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.1 }}
    >
      <Link href="/portfolio">
        <div className="bg-card border border-border rounded-2xl p-5 hover:bg-secondary/30 transition-all cursor-pointer">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {language === "ko" ? "포트폴리오" : "Portfolio"}
            </span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold font-[var(--font-mono)] text-foreground">
                ${totalValue.toFixed(2)}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                {isUp ? (
                  <TrendingUp className="w-3.5 h-3.5 text-[color:var(--color-win)]" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-[color:var(--color-loss)]" />
                )}
                <span
                  className={`text-sm font-bold font-[var(--font-mono)] ${
                    isUp ? "text-[color:var(--color-win)]" : "text-[color:var(--color-loss)]"
                  }`}
                >
                  {isUp ? "+" : ""}${pnl.toFixed(2)} ({isUp ? "+" : ""}{pnlPct.toFixed(1)}%)
                </span>
              </div>
            </div>

            <div className="text-right space-y-0.5">
              <p className="text-xs text-muted-foreground">
                {language === "ko" ? "현금" : "Cash"}: <span className="font-[var(--font-mono)]">${cash.toFixed(2)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {language === "ko" ? "보유" : "Holdings"}: <span className="font-[var(--font-mono)]">${holdVal.toFixed(2)}</span>
              </p>
              {shortPnl !== 0 && (
                <p className="text-xs text-muted-foreground">
                  {language === "ko" ? "숏 P&L" : "Short P&L"}: <span className={`font-[var(--font-mono)] ${shortPnl >= 0 ? "text-[color:var(--color-win)]" : "text-[color:var(--color-loss)]"}`}>
                    {shortPnl >= 0 ? "+" : ""}${shortPnl.toFixed(2)}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function SignInPrompt() {
  const { language } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="p-4 rounded-full bg-secondary mb-4">
        <LogIn className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">
        {language === "ko" ? "거래하려면 로그인하세요" : "Sign in to trade"}
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        {language === "ko"
          ? "ETF를 매매하고, 게임 결과에 베팅하고, 포트폴리오를 관리하세요."
          : "Buy and sell ETFs, bet on game outcomes, and manage your portfolio."}
      </p>
      <Link href="/login">
        <button className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity">
          {language === "ko" ? "로그인" : "Sign In"}
        </button>
      </Link>
    </motion.div>
  );
}

export default function Trade() {
  const { isAuthenticated } = useAuth();
  const { language } = useTranslation();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container py-8 pb-20">
          <SignInPrompt />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 pb-20">
        {/* Chart section */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
        >
          <TickerProvider>
            <LPChart />

            {/* Two-column layout: Trading + Betting/Portfolio */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.05 }}
              >
                <TradingPanel />
              </motion.div>

              <div className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring, delay: 0.1 }}
                >
                  <BettingPanel />
                </motion.div>

                <PortfolioSummaryCard />
              </div>
            </div>
          </TickerProvider>
        </motion.section>

        {/* Price/Rank Legend */}
        <motion.section
          className="mt-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.15 }}
        >
          <PriceRankLegend />
        </motion.section>
      </main>
    </div>
  );
}
