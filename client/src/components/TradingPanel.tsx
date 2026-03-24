/*
 * TradingPanel: Full trading interface with Market Orders, Limit Orders,
 * Stop-Losses, Short Selling, and Market Status.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  DollarSign, Clock, ChevronDown, Target, ShieldAlert, ArrowDownUp,
  XCircle, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { TICKERS, LP_HISTORY, totalLPToPrice, getETFPrice } from "@/lib/playerData";

type TickerSymbol = (typeof TICKERS)[number]["symbol"];
type OrderTab = "market" | "limit" | "stop_loss" | "short";

export default function TradingPanel() {
  const [selectedTicker, setSelectedTicker] = useState<TickerSymbol>("DORI");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [orderTab, setOrderTab] = useState<OrderTab>("market");
  const [amount, setAmount] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showTickerDropdown, setShowTickerDropdown] = useState(false);

  const currentPrice = useMemo(() => {
    const last = LP_HISTORY[LP_HISTORY.length - 1];
    return last ? totalLPToPrice(last.totalLP) : 50;
  }, []);

  const previousPrice = useMemo(() => {
    const prev = LP_HISTORY.length > 1 ? LP_HISTORY[LP_HISTORY.length - 2] : LP_HISTORY[LP_HISTORY.length - 1];
    return prev ? totalLPToPrice(prev.totalLP) : currentPrice;
  }, [currentPrice]);

  const tickerPrice = useMemo(() => {
    return getETFPrice(selectedTicker, currentPrice, previousPrice);
  }, [selectedTicker, currentPrice, previousPrice]);

  const tickerInfo = TICKERS.find((t) => t.symbol === selectedTicker)!;

  const utils = trpc.useUtils();
  const { data: portfolio } = trpc.trading.portfolio.useQuery();
  const { data: tradeHistory } = trpc.trading.history.useQuery({ limit: 10 });
  const { data: pendingOrders } = trpc.trading.orders.useQuery();
  const { data: marketStatus } = trpc.market.status.useQuery(undefined, { refetchInterval: 60000 });

  const tradeMutation = trpc.trading.trade.useMutation({
    onSuccess: (data) => {
      toast.success(`${tradeType === "buy" ? "Bought" : "Sold"} shares of $${selectedTicker}`, {
        description: `Balance: $${data.cashBalance.toFixed(2)}`,
      });
      setAmount("");
      utils.trading.portfolio.invalidate();
      utils.trading.history.invalidate();
      utils.ledger.all.invalidate();
      utils.leaderboard.rankings.invalidate();
    },
    onError: (err) => toast.error(err.message || "Trade failed"),
  });

  const shortMutation = trpc.trading.short.useMutation({
    onSuccess: (data) => {
      toast.success(`Shorted ${data.shortShares.toFixed(2)} shares of $${selectedTicker}`, {
        description: `Balance: $${data.cashBalance.toFixed(2)}`,
      });
      setAmount("");
      utils.trading.portfolio.invalidate();
      utils.trading.history.invalidate();
      utils.ledger.all.invalidate();
    },
    onError: (err) => toast.error(err.message || "Short failed"),
  });

  const coverMutation = trpc.trading.cover.useMutation({
    onSuccess: (data) => {
      toast.success(`Covered short on $${selectedTicker}`, {
        description: `Balance: $${data.cashBalance.toFixed(2)}`,
      });
      setAmount("");
      utils.trading.portfolio.invalidate();
      utils.trading.history.invalidate();
      utils.ledger.all.invalidate();
    },
    onError: (err) => toast.error(err.message || "Cover failed"),
  });

  const createOrderMutation = trpc.trading.createOrder.useMutation({
    onSuccess: () => {
      toast.success("Order placed!");
      setAmount("");
      setTargetPrice("");
      utils.trading.orders.invalidate();
    },
    onError: (err) => toast.error(err.message || "Order failed"),
  });

  const cancelOrderMutation = trpc.trading.cancelOrder.useMutation({
    onSuccess: () => {
      toast.success("Order cancelled");
      utils.trading.orders.invalidate();
    },
    onError: (err) => toast.error(err.message || "Cancel failed"),
  });

  const shares = useMemo(() => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0 || tickerPrice <= 0) return 0;
    return val / tickerPrice;
  }, [amount, tickerPrice]);

  const currentHolding = useMemo(() => {
    if (!portfolio) return { shares: 0, avgCostBasis: 0, shortShares: 0, shortAvgPrice: 0 };
    const h = portfolio.holdings.find((h) => h.ticker === selectedTicker);
    return h ?? { shares: 0, avgCostBasis: 0, shortShares: 0, shortAvgPrice: 0 };
  }, [portfolio, selectedTicker]);

  const totalValue = useMemo(() => {
    if (!portfolio) return 0;
    let holdingsValue = 0;
    for (const h of portfolio.holdings) {
      const price = getETFPrice(h.ticker, currentPrice, previousPrice);
      holdingsValue += h.shares * price;
      holdingsValue += h.shortShares * (h.shortAvgPrice - price); // short P&L
    }
    return portfolio.cashBalance + holdingsValue;
  }, [portfolio, currentPrice, previousPrice]);

  const pnl = useMemo(() => totalValue - 200, [totalValue]);
  const isMarketOpen = marketStatus?.isOpen ?? true;

  const handleMarketTrade = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) { toast.error("Enter a valid positive dollar amount"); return; }
    if (shares <= 0) { toast.error("Trade amount too small"); return; }
    tradeMutation.mutate({ ticker: selectedTicker, type: tradeType, shares, pricePerShare: tickerPrice });
  };

  const handleShort = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) { toast.error("Enter a valid positive dollar amount"); return; }
    if (shares <= 0) { toast.error("Trade amount too small"); return; }
    shortMutation.mutate({ ticker: selectedTicker, shares, pricePerShare: tickerPrice });
  };

  const handleCover = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) { toast.error("Enter a valid positive dollar amount"); return; }
    if (shares <= 0) { toast.error("Trade amount too small"); return; }
    coverMutation.mutate({ ticker: selectedTicker, shares, pricePerShare: tickerPrice });
  };

  const handleLimitOrder = () => {
    const val = parseFloat(amount);
    const tp = parseFloat(targetPrice);
    if (isNaN(val) || val <= 0) { toast.error("Enter a valid amount"); return; }
    if (isNaN(tp) || tp <= 0) { toast.error("Enter a valid target price"); return; }
    const orderShares = val / tp;
    createOrderMutation.mutate({
      ticker: selectedTicker,
      orderType: tradeType === "buy" ? "limit_buy" : "limit_sell",
      shares: orderShares,
      targetPrice: tp,
    });
  };

  const handleStopLoss = () => {
    const val = parseFloat(amount);
    const tp = parseFloat(targetPrice);
    if (isNaN(val) || val <= 0) { toast.error("Enter a valid amount"); return; }
    if (isNaN(tp) || tp <= 0) { toast.error("Enter a valid stop price"); return; }
    const orderShares = val / tp;
    createOrderMutation.mutate({
      ticker: selectedTicker, orderType: "stop_loss", shares: orderShares, targetPrice: tp,
    });
  };

  const ORDER_TABS: { id: OrderTab; label: string; icon: any }[] = [
    { id: "market", label: "Market", icon: DollarSign },
    { id: "limit", label: "Limit", icon: Target },
    { id: "stop_loss", label: "Stop-Loss", icon: ShieldAlert },
    { id: "short", label: "Short", icon: ArrowDownUp },
  ];

  const pendingOrdersList = pendingOrders?.filter((o) => o.status === "pending") ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5 }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      {/* Market Status + Portfolio Summary Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Market Status */}
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isMarketOpen ? "bg-[#00C805] animate-pulse" : "bg-[#FF5252]"}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isMarketOpen ? "text-[#00C805]" : "text-[#FF5252]"}`}>
              {isMarketOpen ? "Market Open" : "Market Closed"}
            </span>
          </div>
          <div className="w-px h-4 bg-border" />
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
            {pnl >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-[#00C805]" /> : <TrendingDown className="w-3.5 h-3.5 text-[#FF5252]" />}
            <span className="text-xs text-muted-foreground">P&L</span>
            <span className="text-xs font-bold font-[var(--font-mono)]" style={{ color: pnl >= 0 ? "#00C805" : "#FF5252" }}>
              {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
            </span>
          </div>
          {portfolio && portfolio.totalDividends > 0 && (
            <>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Dividends</span>
                <span className="text-xs font-bold text-[#00C805] font-[var(--font-mono)]">
                  +${portfolio.totalDividends.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Order Type Tabs */}
      <div className="flex border-b border-border">
        {ORDER_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setOrderTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all border-b-2 ${
                orderTab === tab.id
                  ? "text-white border-primary bg-secondary/20"
                  : "text-muted-foreground border-transparent hover:text-white hover:bg-secondary/10"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Trading Form */}
      <div className="p-5">
        {!isMarketOpen && orderTab === "market" && (
          <div className="flex items-center gap-2 bg-[#FF5252]/10 border border-[#FF5252]/30 rounded-lg px-3 py-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-[#FF5252]" />
            <p className="text-xs text-[#FF5252]">Market is closed. {marketStatus?.reason || "Limit orders and stop-losses can still be placed."}</p>
          </div>
        )}

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
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tickerInfo.color }} />
                  <div>
                    <span className="text-sm font-bold text-white font-[var(--font-mono)]">${selectedTicker}</span>
                    <span className="text-xs text-muted-foreground ml-2">{tickerInfo.description}</span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showTickerDropdown ? "rotate-180" : ""}`} />
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
                          onClick={() => { setSelectedTicker(t.symbol as TickerSymbol); setShowTickerDropdown(false); }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/50 transition-colors ${selectedTicker === t.symbol ? "bg-secondary/30" : ""}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                            <span className="text-xs font-bold text-white font-[var(--font-mono)]">${t.symbol}</span>
                            <span className="text-[10px] text-muted-foreground">{t.description}</span>
                          </div>
                          <span className="text-xs text-white font-[var(--font-mono)]">${tPrice.toFixed(2)}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Current Price Display */}
            <div className="bg-secondary/30 rounded-lg p-4 mb-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Current Price</p>
              <p className="text-2xl font-bold text-white font-[var(--font-mono)]">${tickerPrice.toFixed(2)}</p>
              <div className="mt-1 space-y-0.5">
                {currentHolding.shares > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Long: <span className="text-white font-semibold">{currentHolding.shares.toFixed(2)}</span> shares (avg ${currentHolding.avgCostBasis.toFixed(2)})
                  </p>
                )}
                {currentHolding.shortShares > 0 && (
                  <p className="text-xs text-[#FF5252]">
                    Short: <span className="font-semibold">{currentHolding.shortShares.toFixed(2)}</span> shares (avg ${currentHolding.shortAvgPrice.toFixed(2)})
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Trade Form (changes based on tab) */}
          <div>
            {/* Market Order Tab */}
            {orderTab === "market" && (
              <>
                <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5 mb-4">
                  <button onClick={() => setTradeType("buy")} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${tradeType === "buy" ? "bg-[#00C805] text-black" : "text-muted-foreground hover:text-white"}`}>Buy</button>
                  <button onClick={() => setTradeType("sell")} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${tradeType === "sell" ? "bg-[#FF5252] text-white" : "text-muted-foreground hover:text-white"}`}>Sell</button>
                </div>
                <div className="relative mb-3">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="number" min="0" step="0.01" value={amount} onChange={(e) => { const val = e.target.value; if (val === "" || parseFloat(val) >= 0) setAmount(val); }} placeholder="Amount in USD" className="w-full pl-9 pr-4 py-3 rounded-lg bg-secondary border border-border text-white text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50" />
                </div>
                {shares > 0 && <p className="text-xs text-muted-foreground mb-3 font-[var(--font-mono)]">≈ {shares.toFixed(4)} shares @ ${tickerPrice.toFixed(2)}</p>}
                <div className="flex gap-2 mb-4">
                  {["10", "25", "50", "100"].map((val) => (
                    <button key={val} onClick={() => setAmount(val)} className="flex-1 py-1.5 rounded-md bg-secondary text-xs text-muted-foreground hover:text-white hover:bg-secondary/80 transition-colors font-[var(--font-mono)]">${val}</button>
                  ))}
                </div>
                <button onClick={handleMarketTrade} disabled={tradeMutation.isPending || shares <= 0 || !isMarketOpen} className={`w-full py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${tradeType === "buy" ? "bg-[#00C805] text-black hover:bg-[#00b004]" : "bg-[#FF5252] text-white hover:bg-[#e04848]"}`}>
                  {tradeMutation.isPending ? "Processing..." : `${tradeType === "buy" ? "Buy" : "Sell"} $${selectedTicker}`}
                </button>
              </>
            )}

            {/* Limit Order Tab */}
            {orderTab === "limit" && (
              <>
                <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5 mb-4">
                  <button onClick={() => setTradeType("buy")} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${tradeType === "buy" ? "bg-[#00C805] text-black" : "text-muted-foreground hover:text-white"}`}>Limit Buy</button>
                  <button onClick={() => setTradeType("sell")} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${tradeType === "sell" ? "bg-[#FF5252] text-white" : "text-muted-foreground hover:text-white"}`}>Limit Sell</button>
                </div>
                <div className="relative mb-3">
                  <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="number" min="0" step="0.01" value={targetPrice} onChange={(e) => { const val = e.target.value; if (val === "" || parseFloat(val) >= 0) setTargetPrice(val); }} placeholder={tradeType === "buy" ? "Buy when price drops to..." : "Sell when price rises to..."} className="w-full pl-9 pr-4 py-3 rounded-lg bg-secondary border border-border text-white text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50" />
                </div>
                <div className="relative mb-3">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="number" min="0" step="0.01" value={amount} onChange={(e) => { const val = e.target.value; if (val === "" || parseFloat(val) >= 0) setAmount(val); }} placeholder="Amount in USD" className="w-full pl-9 pr-4 py-3 rounded-lg bg-secondary border border-border text-white text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50" />
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  {tradeType === "buy" ? "Order executes when price drops to target. Current: " : "Order executes when price rises to target. Current: "}
                  <span className="text-white font-mono">${tickerPrice.toFixed(2)}</span>
                </p>
                <button onClick={handleLimitOrder} disabled={createOrderMutation.isPending || !amount || !targetPrice} className={`w-full py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${tradeType === "buy" ? "bg-[#00C805] text-black hover:bg-[#00b004]" : "bg-[#FF5252] text-white hover:bg-[#e04848]"}`}>
                  {createOrderMutation.isPending ? "Placing..." : `Place Limit ${tradeType === "buy" ? "Buy" : "Sell"}`}
                </button>
              </>
            )}

            {/* Stop-Loss Tab */}
            {orderTab === "stop_loss" && (
              <>
                <div className="bg-[#FF5252]/10 border border-[#FF5252]/20 rounded-lg p-3 mb-4">
                  <p className="text-xs text-[#FF5252] font-bold mb-1">Stop-Loss Order</p>
                  <p className="text-[10px] text-muted-foreground">Automatically sells your shares if the price drops to your stop price, limiting your losses.</p>
                </div>
                <div className="relative mb-3">
                  <ShieldAlert className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5252]" />
                  <input type="number" min="0" step="0.01" value={targetPrice} onChange={(e) => { const val = e.target.value; if (val === "" || parseFloat(val) >= 0) setTargetPrice(val); }} placeholder="Stop price (sell if drops below)" className="w-full pl-9 pr-4 py-3 rounded-lg bg-secondary border border-[#FF5252]/30 text-white text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-[#FF5252] placeholder:text-muted-foreground/50" />
                </div>
                <div className="relative mb-3">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="number" min="0" step="0.01" value={amount} onChange={(e) => { const val = e.target.value; if (val === "" || parseFloat(val) >= 0) setAmount(val); }} placeholder="Amount in USD to protect" className="w-full pl-9 pr-4 py-3 rounded-lg bg-secondary border border-border text-white text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50" />
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Current price: <span className="text-white font-mono">${tickerPrice.toFixed(2)}</span>
                  {currentHolding.shares > 0 && <> · You hold <span className="text-white">{currentHolding.shares.toFixed(2)}</span> shares</>}
                </p>
                <button onClick={handleStopLoss} disabled={createOrderMutation.isPending || !amount || !targetPrice} className="w-full py-3 rounded-lg text-sm font-bold bg-[#FF5252] text-white hover:bg-[#e04848] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {createOrderMutation.isPending ? "Placing..." : "Set Stop-Loss"}
                </button>
              </>
            )}

            {/* Short Sell Tab */}
            {orderTab === "short" && (
              <>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 mb-4">
                  <p className="text-xs text-purple-400 font-bold mb-1">Short Selling</p>
                  <p className="text-[10px] text-muted-foreground">Borrow shares to sell now and buy back later. Profit if price drops, lose if it rises. Collateral required.</p>
                </div>
                <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5 mb-4">
                  <button onClick={() => setTradeType("sell")} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${tradeType === "sell" ? "bg-purple-500 text-white" : "text-muted-foreground hover:text-white"}`}>Short Sell</button>
                  <button onClick={() => setTradeType("buy")} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${tradeType === "buy" ? "bg-[#00C805] text-black" : "text-muted-foreground hover:text-white"}`}>Cover (Buy Back)</button>
                </div>
                <div className="relative mb-3">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="number" min="0" step="0.01" value={amount} onChange={(e) => { const val = e.target.value; if (val === "" || parseFloat(val) >= 0) setAmount(val); }} placeholder="Amount in USD" className="w-full pl-9 pr-4 py-3 rounded-lg bg-secondary border border-border text-white text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50" />
                </div>
                {shares > 0 && <p className="text-xs text-muted-foreground mb-3 font-[var(--font-mono)]">≈ {shares.toFixed(4)} shares @ ${tickerPrice.toFixed(2)}</p>}
                <div className="flex gap-2 mb-4">
                  {["10", "25", "50", "100"].map((val) => (
                    <button key={val} onClick={() => setAmount(val)} className="flex-1 py-1.5 rounded-md bg-secondary text-xs text-muted-foreground hover:text-white hover:bg-secondary/80 transition-colors font-[var(--font-mono)]">${val}</button>
                  ))}
                </div>
                <button
                  onClick={tradeType === "sell" ? handleShort : handleCover}
                  disabled={(tradeType === "sell" ? shortMutation.isPending : coverMutation.isPending) || shares <= 0 || !isMarketOpen}
                  className={`w-full py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${tradeType === "sell" ? "bg-purple-500 text-white hover:bg-purple-600" : "bg-[#00C805] text-black hover:bg-[#00b004]"}`}
                >
                  {(tradeType === "sell" ? shortMutation.isPending : coverMutation.isPending) ? "Processing..." : tradeType === "sell" ? `Short $${selectedTicker}` : `Cover $${selectedTicker}`}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Pending Orders */}
        {pendingOrdersList.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border">
            <button onClick={() => setShowOrders(!showOrders)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors mb-2">
              <Target className="w-3.5 h-3.5" />
              Pending Orders ({pendingOrdersList.length})
              <ChevronDown className={`w-3 h-3 transition-transform ${showOrders ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showOrders && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-1.5">
                    {pendingOrdersList.map((order) => (
                      <div key={order.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/20">
                        <div className="flex items-center gap-2">
                          {order.orderType === "stop_loss" ? <ShieldAlert className="w-3.5 h-3.5 text-[#FF5252]" /> : <Target className="w-3.5 h-3.5 text-yellow-400" />}
                          <span className="text-xs text-white capitalize font-semibold">{order.orderType.replace("_", " ")}</span>
                          <span className="text-xs font-bold font-[var(--font-mono)]" style={{ color: TICKERS.find((t) => t.symbol === order.ticker)?.color ?? "#fff" }}>${order.ticker}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs text-white font-[var(--font-mono)]">{order.shares.toFixed(2)} @ ${order.targetPrice.toFixed(2)}</span>
                          </div>
                          <button onClick={() => cancelOrderMutation.mutate({ orderId: order.id })} className="p-1 text-muted-foreground hover:text-[#FF5252] transition-colors" title="Cancel order">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Recent Trades Toggle */}
        <div className={`${pendingOrdersList.length > 0 ? "mt-3" : "mt-5"} pt-4 border-t border-border`}>
          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors">
            <Clock className="w-3.5 h-3.5" />
            Recent Trades
            <ChevronDown className={`w-3 h-3 transition-transform ${showHistory ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {showHistory && tradeHistory && tradeHistory.length > 0 && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-3">
                <div className="space-y-1.5">
                  {tradeHistory.map((trade) => (
                    <div key={trade.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/20">
                      <div className="flex items-center gap-2">
                        {trade.type === "buy" ? <ArrowUpRight className="w-3.5 h-3.5 text-[#00C805]" /> : <ArrowDownRight className="w-3.5 h-3.5 text-[#FF5252]" />}
                        <span className="text-xs text-white capitalize font-semibold">{trade.type}</span>
                        <span className="text-xs font-bold font-[var(--font-mono)]" style={{ color: TICKERS.find((t) => t.symbol === trade.ticker)?.color ?? "#fff" }}>${trade.ticker}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-white font-[var(--font-mono)]">{trade.shares.toFixed(2)} @ ${trade.pricePerShare.toFixed(2)}</span>
                        <p className="text-[10px] text-muted-foreground">${trade.totalAmount.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
