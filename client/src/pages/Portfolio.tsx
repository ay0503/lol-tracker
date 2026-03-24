/*
 * Portfolio: Personal portfolio page with holdings, P&L, returns, and transaction history.
 * Robinhood-style layout.
 */
import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
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
  Filter,
} from "lucide-react";
import { Link } from "wouter";
import { TICKERS, LP_HISTORY, totalLPToPrice, getETFPrice } from "@/lib/playerData";

function getTickerColor(ticker: string): string {
  return TICKERS.find(t => t.symbol === ticker)?.color ?? "#fff";
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Portfolio() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<"all" | "buy" | "sell">("all");

  const { data: portfolio, isLoading: portfolioLoading } = trpc.trading.portfolio.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const { data: tradeHistory, isLoading: historyLoading } = trpc.trading.history.useQuery(
    { limit: 200 },
    { enabled: isAuthenticated }
  );

  // Current DORI price from LP data
  const currentDORIPrice = useMemo(() => {
    const last = LP_HISTORY[LP_HISTORY.length - 1];
    return last ? totalLPToPrice(last.totalLP) : 50;
  }, []);

  const previousDORIPrice = useMemo(() => {
    const prev = LP_HISTORY.length > 1 ? LP_HISTORY[LP_HISTORY.length - 2] : LP_HISTORY[LP_HISTORY.length - 1];
    return prev ? totalLPToPrice(prev.totalLP) : currentDORIPrice;
  }, [currentDORIPrice]);

  // Calculate portfolio metrics
  const metrics = useMemo(() => {
    if (!portfolio) return null;

    let totalHoldingsValue = 0;
    const holdingsWithValue = portfolio.holdings.map(h => {
      const etfPrice = getETFPrice(h.ticker, currentDORIPrice, previousDORIPrice);
      const currentValue = h.shares * etfPrice;
      const costBasis = h.shares * h.avgCostBasis;
      const pnl = currentValue - costBasis;
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      totalHoldingsValue += currentValue;
      return { ...h, currentPrice: etfPrice, currentValue, costBasis, pnl, pnlPct };
    });

    const totalValue = portfolio.cashBalance + totalHoldingsValue;
    const totalPnl = totalValue - 200; // Starting balance was $200
    const totalPnlPct = (totalPnl / 200) * 100;

    return {
      cashBalance: portfolio.cashBalance,
      totalValue,
      totalHoldingsValue,
      totalPnl,
      totalPnlPct,
      holdings: holdingsWithValue,
    };
  }, [portfolio, currentDORIPrice, previousDORIPrice]);

  // Filter trades
  const filteredTrades = useMemo(() => {
    if (!tradeHistory) return [];
    if (filter === "all") return tradeHistory;
    return tradeHistory.filter(t => t.type === filter);
  }, [tradeHistory, filter]);

  // Not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Wallet className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white font-[var(--font-heading)] mb-2">
            Sign in to view your portfolio
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Start trading $DORI with $200 in virtual cash
          </p>
          <a
            href={getLoginUrl()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-black font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Sign In to Trade
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-5xl">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to $DORI
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-secondary">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-[var(--font-heading)]">
              My Portfolio
            </h1>
            <p className="text-xs text-muted-foreground">
              {user?.name || "Trader"}'s positions and performance
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
              className="bg-card border border-border rounded-xl p-6 mb-6"
            >
              <p className="text-xs text-muted-foreground mb-1">Total Portfolio Value</p>
              <div className="flex items-baseline gap-3">
                <h2 className="text-4xl font-bold text-white font-[var(--font-mono)]">
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

              {/* Breakdown */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Cash</p>
                  <p className="text-lg font-bold text-white font-[var(--font-mono)]">
                    ${metrics.cashBalance.toFixed(2)}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Holdings Value</p>
                  <p className="text-lg font-bold text-white font-[var(--font-mono)]">
                    ${metrics.totalHoldingsValue.toFixed(2)}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total P&L</p>
                  <p
                    className="text-lg font-bold font-[var(--font-mono)]"
                    style={{ color: metrics.totalPnl >= 0 ? "#00C805" : "#FF5252" }}
                  >
                    {metrics.totalPnl >= 0 ? "+" : ""}${metrics.totalPnl.toFixed(2)}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Holdings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-xl p-6 mb-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-bold text-white font-[var(--font-heading)]">
                  Holdings
                </h3>
              </div>

              {metrics.holdings.filter(h => h.shares > 0).length > 0 ? (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    <div className="col-span-2">Ticker</div>
                    <div className="col-span-2 text-right">Shares</div>
                    <div className="col-span-2 text-right">Avg Cost</div>
                    <div className="col-span-2 text-right">Current</div>
                    <div className="col-span-2 text-right">Value</div>
                    <div className="col-span-2 text-right">P&L</div>
                  </div>

                  {metrics.holdings
                    .filter(h => h.shares > 0)
                    .map((h) => (
                      <div
                        key={h.ticker}
                        className="grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                      >
                        <div className="col-span-2">
                          <span
                            className="text-sm font-bold font-[var(--font-mono)]"
                            style={{ color: getTickerColor(h.ticker) }}
                          >
                            ${h.ticker}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-sm text-white font-[var(--font-mono)]">
                            {h.shares.toFixed(2)}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-sm text-muted-foreground font-[var(--font-mono)]">
                            ${h.avgCostBasis.toFixed(2)}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-sm text-white font-[var(--font-mono)]">
                            ${h.currentPrice.toFixed(2)}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-sm text-white font-semibold font-[var(--font-mono)]">
                            ${h.currentValue.toFixed(2)}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          <div>
                            <span
                              className="text-sm font-semibold font-[var(--font-mono)]"
                              style={{ color: h.pnl >= 0 ? "#00C805" : "#FF5252" }}
                            >
                              {h.pnl >= 0 ? "+" : ""}${h.pnl.toFixed(2)}
                            </span>
                            <p
                              className="text-[10px] font-[var(--font-mono)]"
                              style={{ color: h.pnlPct >= 0 ? "#00C805" : "#FF5252" }}
                            >
                              {h.pnlPct >= 0 ? "+" : ""}{h.pnlPct.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <PieChart className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No holdings yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Buy some $DORI to get started!
                  </p>
                </div>
              )}
            </motion.div>

            {/* Transaction History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card border border-border rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold text-white font-[var(--font-heading)]">
                    Transaction History
                  </h3>
                  {tradeHistory && (
                    <span className="text-[10px] text-muted-foreground font-[var(--font-mono)]">
                      ({tradeHistory.length} trades)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
                  {(["all", "buy", "sell"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all capitalize ${
                        filter === f
                          ? "bg-primary text-black"
                          : "text-muted-foreground hover:text-white"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {historyLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse h-12 bg-secondary rounded-lg" />
                  ))}
                </div>
              ) : filteredTrades.length > 0 ? (
                <div className="space-y-1.5">
                  {filteredTrades.map((trade, i) => (
                    <div
                      key={trade.id}
                      className="flex items-center justify-between py-3 px-3 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            trade.type === "buy"
                              ? "bg-[#00C805]/15"
                              : "bg-[#FF5252]/15"
                          }`}
                        >
                          {trade.type === "buy" ? (
                            <ArrowUpRight className="w-4 h-4 text-[#00C805]" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-[#FF5252]" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white capitalize">
                              {trade.type}
                            </span>
                            <span
                              className="text-xs font-bold font-[var(--font-mono)]"
                              style={{ color: getTickerColor(trade.ticker) }}
                            >
                              ${trade.ticker}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-[var(--font-mono)]">
                            {trade.shares.toFixed(2)} shares @ ${trade.pricePerShare.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white font-[var(--font-mono)]">
                          {trade.type === "buy" ? "-" : "+"}${trade.totalAmount.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatTime(trade.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {filter === "all" ? "No transactions yet" : `No ${filter} transactions`}
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
