import AppNav from "@/components/AppNav";
/*
 * Portfolio: Personal portfolio page with holdings, P&L, returns, and transaction history.
 * Now wired to live backend prices via trpc.prices.etfPrices.
 * Supports short positions and all trade types (buy, sell, short, cover, dividend).
 * Full i18n support (EN/KR).
 */
import { useMemo, useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  LogIn,
  PieChart,
  History,
  DollarSign,
  ArrowDownUp,
  Repeat,
  Gift,
  LineChart,
  Dice5,
} from "lucide-react";
import { Link } from "wouter";
import { TICKERS } from "@/lib/playerData";
import { formatDateTime } from "@/lib/formatters";

function getTickerColor(ticker: string): string {
  return TICKERS.find(tk => tk.symbol === ticker)?.color ?? "#fff";
}

type TradeFilter = "all" | "buy" | "sell" | "short" | "cover" | "dividend" | "bet";

function getTradeTypeStyle(type: string, t: any) {
  switch (type) {
    case "buy":
      return { icon: ArrowUpRight, color: "#00C805", bg: "bg-[#00C805]/15", label: t.trading.buy, sign: "-" };
    case "sell":
      return { icon: ArrowDownRight, color: "#FF5252", bg: "bg-[#FF5252]/15", label: t.trading.sell, sign: "+" };
    case "short":
      return { icon: ArrowDownUp, color: "#a855f7", bg: "bg-purple-500/15", label: t.trading.short, sign: "+" };
    case "cover":
      return { icon: Repeat, color: "#3b82f6", bg: "bg-blue-500/15", label: t.trading.cover, sign: "-" };
    case "dividend":
      return { icon: Gift, color: "#facc15", bg: "bg-yellow-500/15", label: t.portfolio.dividends, sign: "+" };
    default:
      return { icon: DollarSign, color: "#fff", bg: "bg-secondary", label: type, sign: "" };
  }
}

type PnlTimeRange = "1W" | "1M" | "3M" | "ALL";

function PortfolioPnlChart() {
  const { t, language } = useTranslation();
  const PNL_RANGES: { id: PnlTimeRange; label: string; ms: number }[] = [
    { id: "1W", label: "1W", ms: 7 * 24 * 60 * 60 * 1000 },
    { id: "1M", label: "1M", ms: 30 * 24 * 60 * 60 * 1000 },
    { id: "3M", label: "3M", ms: 90 * 24 * 60 * 60 * 1000 },
    { id: "ALL", label: t.common.all, ms: 0 },
  ];
  const locale = language === "ko" ? "ko-KR" : "en-US";
  const { isAuthenticated } = useAuth();
  const [range, setRange] = useState<PnlTimeRange>("ALL");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const since = range === "ALL" ? undefined : Date.now() - (PNL_RANGES.find(r => r.id === range)?.ms ?? 0);

  const { data: snapshots } = trpc.portfolioHistory.history.useQuery(
    { since },
    { enabled: isAuthenticated, refetchInterval: 120_000 }
  );

  useEffect(() => {
    if (!canvasRef.current || !snapshots || snapshots.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    const values = snapshots.map(s => s.totalValue);
    const timestamps = snapshots.map(s => s.timestamp);
    const minVal = Math.min(...values) * 0.98;
    const maxVal = Math.max(...values) * 1.02;
    const valRange = maxVal - minVal || 1;

    ctx.clearRect(0, 0, W, H);

    const baselineY = H - ((200 - minVal) / valRange) * H;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(W, baselineY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "10px JetBrains Mono, monospace";
    ctx.fillText("$200", 4, baselineY - 4);

    const finalVal = values[values.length - 1];
    const isProfit = finalVal >= 200;
    const lineColor = isProfit ? "#00C805" : "#FF5252";
    const gradientColor = isProfit ? "rgba(0, 200, 5, 0.15)" : "rgba(255, 82, 82, 0.15)";

    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, gradientColor);
    gradient.addColorStop(1, "rgba(0,0,0,0)");

    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((values[i] - minVal) / valRange) * H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    for (let i = 0; i < values.length; i++) {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((values[i] - minVal) / valRange) * H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const lastX = W - 4;
    const lastY = H - ((finalVal - minVal) / valRange) * H;
    ctx.fillStyle = lineColor;
    ctx.font = "bold 11px JetBrains Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText(`$${finalVal.toFixed(2)}`, lastX, lastY - 8);
    ctx.textAlign = "left";

    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "9px JetBrains Mono, monospace";
    if (timestamps.length > 1) {
      const first = new Date(timestamps[0]);
      const last = new Date(timestamps[timestamps.length - 1]);
      ctx.fillText(first.toLocaleDateString(locale, { month: "short", day: "numeric" }), 4, H - 4);
      ctx.textAlign = "right";
      ctx.fillText(last.toLocaleDateString(locale, { month: "short", day: "numeric" }), W - 4, H - 4);
      ctx.textAlign = "left";
    }
  }, [snapshots]);

  if (!snapshots || snapshots.length < 2) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card border border-border rounded-xl p-6 mb-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <LineChart className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground font-[var(--font-heading)]">
            {t.portfolio.portfolioPerformance}
          </h3>
        </div>
        <div className="text-center py-8">
          <LineChart className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t.portfolio.noChartData}</p>
        </div>
      </motion.div>
    );
  }

  const firstVal = snapshots[0].totalValue;
  const lastVal = snapshots[snapshots.length - 1].totalValue;
  const change = lastVal - firstVal;
  const changePct = firstVal > 0 ? (change / firstVal) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="bg-card border border-border rounded-xl p-6 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground font-[var(--font-heading)]">
            {t.portfolio.portfolioPerformance}
          </h3>
          <span
            className="text-xs font-semibold font-[var(--font-mono)] px-2 py-0.5 rounded"
            style={{
              color: change >= 0 ? "#00C805" : "#FF5252",
              backgroundColor: change >= 0 ? "rgba(0,200,5,0.12)" : "rgba(255,82,82,0.12)",
            }}
          >
            {change >= 0 ? "+" : ""}{changePct.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
          {PNL_RANGES.map(r => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                range === r.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: "180px" }}
      />
    </motion.div>
  );
}

export default function Portfolio() {
  const { t, language } = useTranslation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<TradeFilter>("all");

  const TRADE_FILTERS: { id: TradeFilter; label: string }[] = [
    { id: "all", label: t.portfolio.all },
    { id: "buy", label: t.trading.buy },
    { id: "sell", label: t.trading.sell },
    { id: "short", label: t.trading.short },
    { id: "cover", label: t.trading.cover },
    { id: "dividend", label: t.portfolio.dividends },
    { id: "bet", label: language === "ko" ? "베팅" : "Bets" },
  ];

  const { data: portfolio, isLoading: portfolioLoading } = trpc.trading.portfolio.useQuery(
    undefined,
    { enabled: isAuthenticated, refetchInterval: 60_000 }
  );
  const { data: tradeHistory, isLoading: historyLoading } = trpc.trading.history.useQuery(
    { limit: 200 },
    { enabled: isAuthenticated }
  );
  const { data: myBets } = trpc.betting.myBets.useQuery(undefined, { enabled: isAuthenticated });

  // Single source of truth for all current prices
  const { data: etfPrices } = trpc.prices.etfPrices.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const getLivePrice = (ticker: string): number => {
    if (!etfPrices) return 0;
    const found = etfPrices.find(e => e.ticker === ticker);
    return found ? found.price : 0;
  };

  const metrics = useMemo(() => {
    if (!portfolio || !etfPrices) return null;

    let totalHoldingsValue = 0;
    let totalShortPnl = 0;
    const holdingsWithValue = portfolio.holdings.map(h => {
      const etfPrice = getLivePrice(h.ticker);
      const currentValue = h.shares * etfPrice;
      const costBasis = h.shares * h.avgCostBasis;
      const pnl = currentValue - costBasis;
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      totalHoldingsValue += currentValue;

      const shortValue = h.shortShares * etfPrice;
      const shortCostBasis = h.shortShares * h.shortAvgPrice;
      const shortPnl = shortCostBasis - shortValue;
      const shortPnlPct = shortCostBasis > 0 ? (shortPnl / shortCostBasis) * 100 : 0;
      totalShortPnl += shortPnl;

      return {
        ...h,
        currentPrice: etfPrice,
        currentValue,
        costBasis,
        pnl,
        pnlPct,
        shortValue,
        shortCostBasis,
        shortPnl,
        shortPnlPct,
      };
    });

    const totalValue = portfolio.cashBalance + totalHoldingsValue + totalShortPnl;
    const totalPnl = totalValue - 200;
    const totalPnlPct = (totalPnl / 200) * 100;

    return {
      cashBalance: portfolio.cashBalance,
      totalValue,
      totalHoldingsValue,
      totalShortPnl,
      totalPnl,
      totalPnlPct,
      totalDividends: portfolio.totalDividends,
      holdings: holdingsWithValue,
    };
  }, [portfolio, etfPrices]);

  const filteredTrades = useMemo(() => {
    if (filter === "bet") return []; // Bets shown separately
    if (!tradeHistory) return [];
    if (filter === "all") return tradeHistory;
    return tradeHistory.filter(tr => tr.type === filter);
  }, [tradeHistory, filter]);

  const tradeCounts = useMemo(() => {
    if (!tradeHistory) return {};
    const counts: Record<string, number> = {};
    for (const tr of tradeHistory) {
      counts[tr.type] = (counts[tr.type] || 0) + 1;
    }
    if (myBets) counts["bet"] = myBets.length;
    return counts;
  }, [tradeHistory, myBets]);

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
      <AppNav />
        <div className="text-center">
          <Wallet className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground font-[var(--font-heading)] mb-2">
            {t.common.signInRequired}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {t.portfolio.startTrading}
          </p>
          <a
            href={getLoginUrl()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {t.nav.signIn}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-5xl">

        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-secondary">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground font-[var(--font-heading)]">
              {t.portfolio.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              {user?.name || t.common.trader}
            </p>
          </div>
        </div>

        {portfolioLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-card border border-border rounded-xl p-6">
                <div className="h-8 bg-secondary rounded w-32 mb-2" />
                <div className="h-4 bg-secondary rounded w-48" />
              </div>
            ))}
          </div>
        ) : metrics ? (
          <>
            {/* Portfolio Value Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-4 sm:p-6 mb-6"
            >
              <p className="text-xs text-muted-foreground mb-1">{t.portfolio.totalValue}</p>
              <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
                <h2 className="text-2xl sm:text-4xl font-bold text-foreground font-[var(--font-mono)]">
                  ${metrics.totalValue.toFixed(2)}
                </h2>
                <div
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold font-[var(--font-mono)]"
                  style={{
                    backgroundColor: metrics.totalPnl >= 0 ? "rgba(0, 200, 5, 0.12)" : "rgba(255, 82, 82, 0.12)",
                    color: metrics.totalPnl >= 0 ? "#00C805" : "#FF5252",
                  }}
                >
                  {metrics.totalPnl >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {metrics.totalPnl >= 0 ? "+" : ""}${metrics.totalPnl.toFixed(2)} ({metrics.totalPnlPct.toFixed(1)}%)
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t.portfolio.cashBalance}</p>
                  <p className="text-lg font-bold text-foreground font-[var(--font-mono)]">
                    ${metrics.cashBalance.toFixed(2)}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t.portfolio.holdingsValue}</p>
                  <p className="text-lg font-bold text-foreground font-[var(--font-mono)]">
                    ${metrics.totalHoldingsValue.toFixed(2)}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t.portfolio.shortPnl}</p>
                  <p
                    className="text-lg font-bold font-[var(--font-mono)]"
                    style={{ color: metrics.totalShortPnl >= 0 ? "#00C805" : "#FF5252" }}
                  >
                    {metrics.totalShortPnl >= 0 ? "+" : ""}${metrics.totalShortPnl.toFixed(2)}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t.portfolio.dividends}</p>
                  <p className="text-lg font-bold text-[#facc15] font-[var(--font-mono)]">
                    +${metrics.totalDividends.toFixed(2)}
                  </p>
                </div>
              </div>
            </motion.div>

            <PortfolioPnlChart />

            {/* Long Holdings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-xl p-4 sm:p-6 mb-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-bold text-foreground font-[var(--font-heading)]">
                  {t.portfolio.longPositions}
                </h3>
              </div>

              {metrics.holdings.filter(h => h.shares > 0).length > 0 ? (
                <div className="space-y-2">
                  {/* Desktop table header */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    <div className="col-span-2">{t.portfolio.ticker}</div>
                    <div className="col-span-2 text-right">{t.portfolio.shares}</div>
                    <div className="col-span-2 text-right">{t.portfolio.avgPrice}</div>
                    <div className="col-span-2 text-right">{t.portfolio.currentPrice}</div>
                    <div className="col-span-2 text-right">{t.portfolio.value}</div>
                    <div className="col-span-2 text-right">{t.portfolio.pnl}</div>
                  </div>

                  {metrics.holdings
                    .filter(h => h.shares > 0)
                    .map((h) => (
                      <div key={h.ticker}>
                        {/* Desktop row */}
                        <div className="hidden sm:grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                          <div className="col-span-2">
                            <span className="text-sm font-bold font-[var(--font-mono)]" style={{ color: getTickerColor(h.ticker) }}>
                              ${h.ticker}
                            </span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-sm text-foreground font-[var(--font-mono)]">{h.shares.toFixed(2)}</span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-sm text-muted-foreground font-[var(--font-mono)]">${h.avgCostBasis.toFixed(2)}</span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-sm text-foreground font-[var(--font-mono)]">${h.currentPrice.toFixed(2)}</span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-sm text-foreground font-semibold font-[var(--font-mono)]">${h.currentValue.toFixed(2)}</span>
                          </div>
                          <div className="col-span-2 text-right">
                            <div>
                              <span className="text-sm font-semibold font-[var(--font-mono)]" style={{ color: h.pnl >= 0 ? "#00C805" : "#FF5252" }}>
                                {h.pnl >= 0 ? "+" : ""}${h.pnl.toFixed(2)}
                              </span>
                              <p className="text-[10px] font-[var(--font-mono)]" style={{ color: h.pnlPct >= 0 ? "#00C805" : "#FF5252" }}>
                                {h.pnlPct >= 0 ? "+" : ""}{h.pnlPct.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                        {/* Mobile card */}
                        <div className="sm:hidden px-3 py-3 rounded-lg bg-secondary/30">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold font-[var(--font-mono)]" style={{ color: getTickerColor(h.ticker) }}>
                              ${h.ticker}
                            </span>
                            <span className="text-sm font-semibold text-foreground font-[var(--font-mono)]">${h.currentValue.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground font-[var(--font-mono)]">
                              {h.shares.toFixed(2)} @ ${h.avgCostBasis.toFixed(2)} → ${h.currentPrice.toFixed(2)}
                            </span>
                            <span className="font-semibold font-[var(--font-mono)]" style={{ color: h.pnl >= 0 ? "#00C805" : "#FF5252" }}>
                              {h.pnl >= 0 ? "+" : ""}${h.pnl.toFixed(2)} ({h.pnlPct >= 0 ? "+" : ""}{h.pnlPct.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <PieChart className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{t.portfolio.noHoldings}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">{t.portfolio.startTrading}</p>
                </div>
              )}
            </motion.div>

            {/* Short Positions */}
            {metrics.holdings.some(h => h.shortShares > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-card border border-purple-500/30 rounded-xl p-6 mb-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <ArrowDownUp className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-foreground font-[var(--font-heading)]">
                    {t.portfolio.shortPositions}
                  </h3>
                </div>

                <div className="space-y-2">
                  {/* Desktop table header */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    <div className="col-span-2">{t.portfolio.ticker}</div>
                    <div className="col-span-2 text-right">{t.portfolio.shares}</div>
                    <div className="col-span-2 text-right">{t.portfolio.avgPrice}</div>
                    <div className="col-span-2 text-right">{t.portfolio.currentPrice}</div>
                    <div className="col-span-2 text-right">{t.portfolio.value}</div>
                    <div className="col-span-2 text-right">{t.portfolio.pnl}</div>
                  </div>

                  {metrics.holdings
                    .filter(h => h.shortShares > 0)
                    .map((h) => (
                      <div key={`short-${h.ticker}`}>
                        {/* Desktop row */}
                        <div className="hidden sm:grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-lg bg-purple-500/5 hover:bg-purple-500/10 transition-colors">
                          <div className="col-span-2">
                            <span className="text-sm font-bold font-[var(--font-mono)]" style={{ color: getTickerColor(h.ticker) }}>
                              ${h.ticker}
                            </span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-sm text-purple-300 font-[var(--font-mono)]">{h.shortShares.toFixed(2)}</span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-sm text-muted-foreground font-[var(--font-mono)]">${h.shortAvgPrice.toFixed(2)}</span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-sm text-foreground font-[var(--font-mono)]">${h.currentPrice.toFixed(2)}</span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-sm text-foreground font-semibold font-[var(--font-mono)]">${h.shortValue.toFixed(2)}</span>
                          </div>
                          <div className="col-span-2 text-right">
                            <div>
                              <span className="text-sm font-semibold font-[var(--font-mono)]" style={{ color: h.shortPnl >= 0 ? "#00C805" : "#FF5252" }}>
                                {h.shortPnl >= 0 ? "+" : ""}${h.shortPnl.toFixed(2)}
                              </span>
                              <p className="text-[10px] font-[var(--font-mono)]" style={{ color: h.shortPnlPct >= 0 ? "#00C805" : "#FF5252" }}>
                                {h.shortPnlPct >= 0 ? "+" : ""}{h.shortPnlPct.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                        {/* Mobile card */}
                        <div className="sm:hidden px-3 py-3 rounded-lg bg-purple-500/5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold font-[var(--font-mono)]" style={{ color: getTickerColor(h.ticker) }}>
                              ${h.ticker}
                            </span>
                            <span className="text-sm font-semibold text-foreground font-[var(--font-mono)]">${h.shortValue.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-purple-300 font-[var(--font-mono)]">
                              {h.shortShares.toFixed(2)} @ ${h.shortAvgPrice.toFixed(2)} → ${h.currentPrice.toFixed(2)}
                            </span>
                            <span className="font-semibold font-[var(--font-mono)]" style={{ color: h.shortPnl >= 0 ? "#00C805" : "#FF5252" }}>
                              {h.shortPnl >= 0 ? "+" : ""}${h.shortPnl.toFixed(2)} ({h.shortPnlPct >= 0 ? "+" : ""}{h.shortPnlPct.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </motion.div>
            )}

            {/* Transaction History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card border border-border rounded-xl p-4 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold text-foreground font-[var(--font-heading)]">
                    {t.portfolio.transactionHistory}
                  </h3>
                  {tradeHistory && (
                    <span className="text-[10px] text-muted-foreground font-[var(--font-mono)]">
                      ({tradeHistory.length})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5 flex-wrap">
                  {TRADE_FILTERS.map(f => {
                    const count = f.id === "all" ? tradeHistory?.length ?? 0 : tradeCounts[f.id] ?? 0;
                    if (f.id !== "all" && count === 0) return null;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all capitalize ${
                          filter === f.id
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {historyLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse h-12 bg-secondary rounded-lg" />
                  ))}
                </div>
              ) : filter === "bet" ? (
                /* Bets list */
                myBets && myBets.length > 0 ? (
                  <div className="space-y-1.5">
                    {myBets.map((bet) => {
                      const isPending = bet.status === "pending";
                      const isWon = bet.status === "won";
                      return (
                        <div
                          key={bet.id}
                          className="flex items-center justify-between py-3 px-3 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              isPending ? "bg-yellow-500/20" : isWon ? "bg-[#00C805]/20" : "bg-[#FF5252]/20"
                            }`}>
                              <Dice5 className="w-4 h-4" style={{ color: isPending ? "#eab308" : isWon ? "#00C805" : "#FF5252" }} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold uppercase ${
                                  bet.prediction === "win" ? "text-[#00C805]" : "text-[#FF5252]"
                                }`}>
                                  {bet.prediction}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isPending ? "bg-yellow-500/15 text-yellow-400" :
                                  isWon ? "bg-[#00C805]/15 text-[#00C805]" : "bg-[#FF5252]/15 text-[#FF5252]"
                                }`}>
                                  {isPending ? "PENDING" : isWon ? "WON" : "LOST"}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground font-[var(--font-mono)]">
                                ${bet.amount.toFixed(2)} {language === "ko" ? "베팅" : "bet"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold font-[var(--font-mono)] ${
                              isPending ? "text-yellow-400" : isWon ? "text-[#00C805]" : "text-[#FF5252]"
                            }`}>
                              {isPending ? `$${bet.amount.toFixed(2)}` :
                               isWon ? `+$${(bet.payout ?? 0).toFixed(2)}` :
                               `-$${bet.amount.toFixed(2)}`}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatDateTime(bet.createdAt, language)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Dice5 className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {language === "ko" ? "아직 베팅 기록이 없습니다" : "No bets yet"}
                    </p>
                  </div>
                )
              ) : filteredTrades.length > 0 ? (
                <div className="space-y-1.5">
                  {filteredTrades.map((trade) => {
                    const style = getTradeTypeStyle(trade.type, t);
                    const Icon = style.icon;
                    return (
                      <div
                        key={trade.id}
                        className="flex items-center justify-between py-3 px-3 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${style.bg}`}>
                            <Icon className="w-4 h-4" style={{ color: style.color }} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground capitalize">
                                {style.label}
                              </span>
                              <span
                                className="text-xs font-bold font-[var(--font-mono)]"
                                style={{ color: getTickerColor(trade.ticker) }}
                              >
                                ${trade.ticker}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-[var(--font-mono)]">
                              {trade.shares.toFixed(2)} {t.trading.shares} @ ${trade.pricePerShare.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground font-[var(--font-mono)]">
                            {style.sign}${trade.totalAmount.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDateTime(trade.createdAt, language)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t.portfolio.noTransactions}
                  </p>
                </div>
              )}
            </motion.div>
          </>
        ) : null}
      </div>
    </div>
  );
}
