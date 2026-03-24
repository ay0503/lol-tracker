/*
 * TradingPanel: Robinhood-style trading interface for $DORI.
 * Shows portfolio summary, buy/sell form, and trade history.
 * LP is converted to a "stock price" where 1 LP = $1.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { LP_HISTORY } from "@/lib/playerData";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  BarChart3,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

// Current "stock price" is based on the latest total LP
function getCurrentPrice(): number {
  const latest = LP_HISTORY[LP_HISTORY.length - 1];
  return latest ? latest.totalLP : 100;
}

export default function TradingPanel() {
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const currentPrice = getCurrentPrice();

  const utils = trpc.useUtils();
  const { data: portfolio, isLoading: portfolioLoading } =
    trpc.trading.portfolio.useQuery();
  const { data: tradeHistory } = trpc.trading.history.useQuery();

  const tradeMutation = trpc.trading.trade.useMutation({
    onSuccess: (data) => {
      toast.success(
        `${tradeType === "buy" ? "Bought" : "Sold"} ${shares.toFixed(2)} shares of $DORI`,
        {
          description: `Balance: $${data.cashBalance.toFixed(2)} · Shares: ${data.sharesOwned.toFixed(2)}`,
        }
      );
      setAmount("");
      utils.trading.portfolio.invalidate();
      utils.trading.history.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Trade failed");
    },
  });

  const shares = useMemo(() => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return 0;
    return val / currentPrice;
  }, [amount, currentPrice]);

  const totalValue = useMemo(() => {
    if (!portfolio) return 0;
    return portfolio.sharesOwned * currentPrice + portfolio.cashBalance;
  }, [portfolio, currentPrice]);

  const pnl = useMemo(() => {
    if (!portfolio) return 0;
    return totalValue - 200; // Starting balance was $200
  }, [totalValue]);

  const handleTrade = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      toast.error("Enter a valid dollar amount");
      return;
    }
    tradeMutation.mutate({
      type: tradeType,
      shares,
      pricePerShare: currentPrice,
    });
  };

  const maxBuy = portfolio ? portfolio.cashBalance : 0;
  const maxSell = portfolio ? portfolio.sharesOwned * currentPrice : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-white font-[var(--font-heading)]">
            Trade $DORI
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-[var(--font-mono)]">
            Price:{" "}
            <span className="text-white font-semibold">
              ${currentPrice.toFixed(2)}
            </span>
          </span>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1"
          >
            <Clock className="w-3.5 h-3.5" />
            History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:divide-x divide-border">
        {/* Portfolio Summary */}
        <div className="p-5">
          <p className="text-xs text-muted-foreground mb-3">Your Portfolio</p>
          {portfolioLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-8 bg-secondary rounded w-24" />
              <div className="h-4 bg-secondary rounded w-32" />
            </div>
          ) : portfolio ? (
            <div className="space-y-3">
              <div>
                <p className="text-2xl font-bold text-white font-[var(--font-mono)]">
                  ${totalValue.toFixed(2)}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {pnl >= 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#00C805]" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-[#FF5252]" />
                  )}
                  <span
                    className="text-xs font-semibold font-[var(--font-mono)]"
                    style={{ color: pnl >= 0 ? "#00C805" : "#FF5252" }}
                  >
                    {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} (
                    {((pnl / 200) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-secondary/50 rounded-lg p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Cash
                  </p>
                  <p className="text-sm font-semibold text-white font-[var(--font-mono)]">
                    ${portfolio.cashBalance.toFixed(2)}
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Shares
                  </p>
                  <p className="text-sm font-semibold text-white font-[var(--font-mono)]">
                    {portfolio.sharesOwned.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Trade Form */}
        <div className="p-5 lg:col-span-2">
          <div className="flex gap-1 mb-4">
            <button
              onClick={() => setTradeType("buy")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                tradeType === "buy"
                  ? "bg-[#00C805] text-black"
                  : "bg-secondary text-muted-foreground hover:text-white"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 inline mr-1" />
              Buy
            </button>
            <button
              onClick={() => setTradeType("sell")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                tradeType === "sell"
                  ? "bg-[#FF5252] text-white"
                  : "bg-secondary text-muted-foreground hover:text-white"
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5 inline mr-1" />
              Sell
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Amount (USD)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full bg-secondary border border-border rounded-lg pl-8 pr-4 py-2.5 text-white text-sm font-[var(--font-mono)] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex gap-2">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    const max = tradeType === "buy" ? maxBuy : maxSell;
                    setAmount(((max * pct) / 100).toFixed(2));
                  }}
                  className="flex-1 py-1 text-[10px] font-semibold text-muted-foreground bg-secondary hover:bg-secondary/80 rounded transition-colors font-[var(--font-mono)]"
                >
                  {pct}%
                </button>
              ))}
            </div>

            {shares > 0 && (
              <p className="text-xs text-muted-foreground font-[var(--font-mono)]">
                ≈ {shares.toFixed(4)} shares @ ${currentPrice.toFixed(2)}
              </p>
            )}

            <button
              onClick={handleTrade}
              disabled={tradeMutation.isPending || shares <= 0}
              className={`w-full py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                tradeType === "buy"
                  ? "bg-[#00C805] hover:bg-[#00B504] text-black"
                  : "bg-[#FF5252] hover:bg-[#E04848] text-white"
              }`}
            >
              {tradeMutation.isPending
                ? "Processing..."
                : `${tradeType === "buy" ? "Buy" : "Sell"} $DORI`}
            </button>
          </div>
        </div>
      </div>

      {/* Trade History */}
      <AnimatePresence>
        {showHistory && tradeHistory && tradeHistory.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-border overflow-hidden"
          >
            <div className="p-4 max-h-48 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2 font-semibold">
                Recent Trades
              </p>
              <div className="space-y-1.5">
                {tradeHistory.map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded bg-secondary/30"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          trade.type === "buy"
                            ? "bg-[#00C805]/20 text-[#00C805]"
                            : "bg-[#FF5252]/20 text-[#FF5252]"
                        }`}
                      >
                        {trade.type}
                      </span>
                      <span className="text-xs text-white font-[var(--font-mono)]">
                        {trade.shares.toFixed(2)} shares
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-white font-[var(--font-mono)]">
                        ${trade.totalAmount.toFixed(2)}
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        @ ${trade.pricePerShare.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
