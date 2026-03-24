/*
 * TradingPanel: Robinhood-style trading interface supporting all ETF tickers.
 * Self-contained: computes current price from LP data.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Clock,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { TICKERS, LP_HISTORY, totalLPToPrice, getETFPrice } from "@/lib/playerData";

type TickerSymbol = (typeof TICKERS)[number]["symbol"];

export default function TradingPanel() {
  const [selectedTicker, setSelectedTicker] = useState<TickerSymbol>("DORI");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showTickerDropdown, setShowTickerDropdown] = useState(false);

  // Compute current and previous price from LP data
  const currentPrice = useMemo(() => {
    const last = LP_HISTORY[LP_HISTORY.length - 1];
    return last ? totalLPToPrice(last.totalLP) : 50;
  }, []);

  const previousPrice = useMemo(() => {
    const prev = LP_HISTORY.length > 1 ? LP_HISTORY[LP_HISTORY.length - 2] : LP_HISTORY[LP_HISTORY.length - 1];
    return prev ? totalLPToPrice(prev.totalLP) : currentPrice;
  }, [currentPrice]);

  // Calculate ETF price for the selected ticker
  const tickerPrice = useMemo(() => {
    return getETFPrice(selectedTicker, currentPrice, previousPrice);
  }, [selectedTicker, currentPrice, previousPrice]);

  const tickerInfo = TICKERS.find(t => t.symbol === selectedTicker)!;

  const utils = trpc.useUtils();
  const { data: portfolio, isLoading: portfolioLoading } =
    trpc.trading.portfolio.useQuery();
  const { data: tradeHistory } = trpc.trading.history.useQuery({ limit: 10 });

  const tradeMutation = trpc.trading.trade.useMutation({
    onSuccess: (data) => {
      toast.success(
        `${tradeType === "buy" ? "Bought" : "Sold"} ${shares.toFixed(2)} shares of $${selectedTicker}`,
        {
          description: `Balance: $${data.cashBalance.toFixed(2)} · ${selectedTicker} Shares: ${data.sharesOwned.toFixed(2)}`,
        }
      );
      setAmount("");
      utils.trading.portfolio.invalidate();
      utils.trading.history.invalidate();
      utils.ledger.all.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Trade failed");
    },
  });

  const shares = useMemo(() => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0 || tickerPrice <= 0) return 0;
    return val / tickerPrice;
  }, [amount, tickerPrice]);

  // Get holding for selected ticker
  const currentHolding = useMemo(() => {
    if (!portfolio) return { shares: 0, avgCostBasis: 0 };
    const h = portfolio.holdings.find((h) => h.ticker === selectedTicker);
    return h ?? { shares: 0, avgCostBasis: 0 };
  }, [portfolio, selectedTicker]);

  const totalValue = useMemo(() => {
    if (!portfolio) return 0;
    let holdingsValue = 0;
    for (const h of portfolio.holdings) {
      const price = getETFPrice(h.ticker, currentPrice, previousPrice);
      holdingsValue += h.shares * price;
    }
    return portfolio.cashBalance + holdingsValue;
  }, [portfolio, currentPrice, previousPrice]);

  const pnl = useMemo(() => totalValue - 200, [totalValue]);

  const handleTrade = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      toast.error("Enter a valid dollar amount");
      return;
    }
    tradeMutation.mutate({
      ticker: selectedTicker,
      type: tradeType,
      shares,
      pricePerShare: tickerPrice,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5 }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      {/* Portfolio Summary Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Cash</span>
            <span className="text-xs font-bold text-white font-[var(--font-mono)]">
              ${portfolio ? portfolio.cashBalance.toFixed(2) : "200.00"}
            </span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Portfolio</span>
            <span className="text-xs font-bold text-white font-[var(--font-mono)]">
              ${totalValue.toFixed(2)}
            </span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5">
            {pnl >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-[#00C805]" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-[#FF5252]" />
            )}
            <span className="text-xs text-muted-foreground">P&L</span>
            <span
              className="text-xs font-bold font-[var(--font-mono)]"
              style={{ color: pnl >= 0 ? "#00C805" : "#FF5252" }}
            >
              {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Trading Form */}
      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left: Ticker selector + Price */}
          <div>
            {/* Ticker Selector */}
            <div className="relative mb-4">
              <button
                onClick={() => setShowTickerDropdown(!showTickerDropdown)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-secondary border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tickerInfo.color }}
                  />
                  <div>
                    <span className="text-sm font-bold text-white font-[var(--font-mono)]">
                      ${selectedTicker}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {tickerInfo.description}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${
                    showTickerDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {showTickerDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute top-full left-0 right-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-xl overflow-hidden"
                  >
                    {TICKERS.map((t) => {
                      const tPrice = getETFPrice(t.symbol, currentPrice, previousPrice);
                      return (
                        <button
                          key={t.symbol}
                          onClick={() => {
                            setSelectedTicker(t.symbol as TickerSymbol);
                            setShowTickerDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/50 transition-colors ${
                            selectedTicker === t.symbol ? "bg-secondary/30" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: t.color }}
                            />
                            <span className="text-xs font-bold text-white font-[var(--font-mono)]">
                              ${t.symbol}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {t.description}
                            </span>
                          </div>
                          <span className="text-xs text-white font-[var(--font-mono)]">
                            ${tPrice.toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Current Price Display */}
            <div className="bg-secondary/30 rounded-lg p-4 mb-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Current Price
              </p>
              <p className="text-2xl font-bold text-white font-[var(--font-mono)]">
                ${tickerPrice.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {currentHolding.shares > 0 && (
                  <span>
                    You own{" "}
                    <span className="text-white font-semibold">
                      {currentHolding.shares.toFixed(2)}
                    </span>{" "}
                    shares (avg ${currentHolding.avgCostBasis.toFixed(2)})
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right: Trade Form */}
          <div>
            {/* Buy/Sell Toggle */}
            <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5 mb-4">
              <button
                onClick={() => setTradeType("buy")}
                className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                  tradeType === "buy"
                    ? "bg-[#00C805] text-black"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setTradeType("sell")}
                className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                  tradeType === "sell"
                    ? "bg-[#FF5252] text-white"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                Sell
              </button>
            </div>

            {/* Amount Input */}
            <div className="relative mb-3">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount in USD"
                className="w-full pl-9 pr-4 py-3 rounded-lg bg-secondary border border-border text-white text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Shares preview */}
            {shares > 0 && (
              <p className="text-xs text-muted-foreground mb-3 font-[var(--font-mono)]">
                ≈ {shares.toFixed(4)} shares @ ${tickerPrice.toFixed(2)}
              </p>
            )}

            {/* Quick amounts */}
            <div className="flex gap-2 mb-4">
              {["10", "25", "50", "100"].map((val) => (
                <button
                  key={val}
                  onClick={() => setAmount(val)}
                  className="flex-1 py-1.5 rounded-md bg-secondary text-xs text-muted-foreground hover:text-white hover:bg-secondary/80 transition-colors font-[var(--font-mono)]"
                >
                  ${val}
                </button>
              ))}
            </div>

            {/* Execute Button */}
            <button
              onClick={handleTrade}
              disabled={tradeMutation.isPending || shares <= 0}
              className={`w-full py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                tradeType === "buy"
                  ? "bg-[#00C805] text-black hover:bg-[#00b004]"
                  : "bg-[#FF5252] text-white hover:bg-[#e04848]"
              }`}
            >
              {tradeMutation.isPending
                ? "Processing..."
                : `${tradeType === "buy" ? "Buy" : "Sell"} $${selectedTicker}`}
            </button>
          </div>
        </div>

        {/* Recent Trades Toggle */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground hover:text-white transition-colors"
        >
          <Clock className="w-3.5 h-3.5" />
          Recent Trades
          <ChevronDown
            className={`w-3 h-3 transition-transform ${showHistory ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {showHistory && tradeHistory && tradeHistory.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-3"
            >
              <div className="space-y-1.5">
                {tradeHistory.map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/20"
                  >
                    <div className="flex items-center gap-2">
                      {trade.type === "buy" ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-[#00C805]" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 text-[#FF5252]" />
                      )}
                      <span className="text-xs text-white capitalize font-semibold">
                        {trade.type}
                      </span>
                      <span
                        className="text-xs font-bold font-[var(--font-mono)]"
                        style={{ color: TICKERS.find(t => t.symbol === trade.ticker)?.color ?? "#fff" }}
                      >
                        ${trade.ticker}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-white font-[var(--font-mono)]">
                        {trade.shares.toFixed(2)} @ ${trade.pricePerShare.toFixed(2)}
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        ${trade.totalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
