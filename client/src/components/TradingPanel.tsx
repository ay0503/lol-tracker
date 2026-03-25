import { useState, useMemo, useEffect, useRef } from "react";
import { useTicker } from "@/contexts/TickerContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronDown,
  Clock,
  Target,
  ShieldAlert,
  AlertTriangle,
  Pause,
  XCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Repeat,
  Gift,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TICKERS = [
  { symbol: "DORI", color: "#00C805", leverage: 1 },
  { symbol: "DDRI", color: "#FFD54F", leverage: 2 },
  { symbol: "TDRI", color: "#FF6D00", leverage: 3 },
  { symbol: "SDRI", color: "#FF5252", leverage: -2 },
  { symbol: "XDRI", color: "#E040FB", leverage: -3 },
];

type TickerSymbol = "DORI" | "DDRI" | "TDRI" | "SDRI" | "XDRI";
type OrderTab = "market" | "limit" | "stop_loss" | "short";

const CONFIRM_THRESHOLD = 50;

interface PendingConfirmation {
  type: string;
  ticker: string;
  amount: string;
  shares: string;
  price: string;
  action: () => void;
}

function getTradeTypeStyle(type: string, t: any) {
  switch (type) {
    case "buy":
      return { icon: ArrowUpCircle, color: "#00C805", label: t.trading.bought };
    case "sell":
      return { icon: ArrowDownCircle, color: "#FF5252", label: t.trading.sold };
    case "short":
      return { icon: TrendingDown, color: "#E040FB", label: t.trading.shorted };
    case "cover":
      return { icon: Repeat, color: "#00C805", label: t.trading.covered };
    case "dividend":
      return { icon: Gift, color: "#FFD54F", label: t.trading.dividends };
    default:
      return { icon: ArrowUpCircle, color: "#888", label: type };
  }
}

export default function TradingPanel() {
  const { t } = useTranslation();
  const { activeTicker: selectedTicker, setActiveTicker: setSelectedTicker } = useTicker();
  const [orderTab, setOrderTab] = useState<OrderTab>("market");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [showTickerDropdown, setShowTickerDropdown] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const [tradingLocked, setTradingLocked] = useState(false);
  const [inputMode, setInputMode] = useState<"dollars" | "shares">("dollars");
  const lastTradeTime = useRef(0);
  const TRADE_COOLDOWN_MS = 2000; // 2 second cooldown between trades

  const ORDER_TABS: { id: OrderTab; label: string; icon: any }[] = [
    { id: "market", label: t.trading.market, icon: TrendingUp },
    { id: "limit", label: t.trading.limit, icon: Target },
    { id: "stop_loss", label: t.trading.stopLoss, icon: ShieldAlert },
    { id: "short", label: t.trading.short, icon: TrendingDown },
  ];

  // Check if player is in a live game (trading halt)
  const { data: liveGameData } = trpc.player.liveGame.useQuery(undefined, { refetchInterval: 30000 });
  const isTradingHalted = liveGameData?.inGame === true;

  // Single source of truth for all current prices
  const { data: etfPrices } = trpc.prices.etfPrices.useQuery(undefined, { refetchInterval: 30_000, staleTime: 15_000 });
  const { data: portfolio } = trpc.trading.portfolio.useQuery(undefined, { refetchInterval: 30_000, staleTime: 15_000 });
  const { data: tradeHistory } = trpc.trading.history.useQuery(undefined, { refetchInterval: 30_000, staleTime: 15_000 });
  const { data: pendingOrders } = trpc.trading.orders.useQuery(undefined, { refetchInterval: 15000 });
  const { data: marketStatus } = trpc.market.status.useQuery(undefined, { refetchInterval: 60000 });

  const utils = trpc.useUtils();

  const tradeMutation = trpc.trading.trade.useMutation({
    onSuccess: (data) => {
      toast.success(`${tradeType === "buy" ? t.trading.bought : t.trading.sold} ${shares.toFixed(2)} ${t.trading.sharesLabel} $${selectedTicker}`);
      setAmount("");
      utils.trading.portfolio.invalidate();
      utils.trading.history.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const shortMutation = trpc.trading.short.useMutation({
    onSuccess: (data) => {
      toast.success(`${t.trading.shorted} ${shares.toFixed(2)} ${t.trading.sharesLabel} $${selectedTicker}`);
      setAmount("");
      utils.trading.portfolio.invalidate();
      utils.trading.history.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const coverMutation = trpc.trading.cover.useMutation({
    onSuccess: (data) => {
      toast.success(`${t.trading.covered} ${shares.toFixed(2)} ${t.trading.sharesLabel} $${selectedTicker}`);
      setAmount("");
      utils.trading.portfolio.invalidate();
      utils.trading.history.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const createOrderMutation = trpc.trading.createOrder.useMutation({
    onSuccess: () => {
      toast.success(t.trading.orderPlaced);
      setAmount("");
      setTargetPrice("");
      utils.trading.orders.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelOrderMutation = trpc.trading.cancelOrder.useMutation({
    onSuccess: () => {
      toast.success(t.trading.orderCancelled);
      utils.trading.orders.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const tickerInfo = useMemo(() => {
    const found = TICKERS.find((t) => t.symbol === selectedTicker);
    const tickerKey = selectedTicker.toLowerCase() as keyof typeof t.tickers;
    return {
      color: found?.color ?? "#fff",
      description: t.tickers[tickerKey] || selectedTicker,
    };
  }, [selectedTicker, t]);

  const getLivePrice = (symbol: string): number => {
    if (!etfPrices || !Array.isArray(etfPrices)) return 0;
    const found = etfPrices.find((p: any) => p.ticker === symbol);
    return found?.price || 0;
  };

  const tickerPrice = getLivePrice(selectedTicker);
  // Compute shares and dollar amount based on input mode
  const rawInput = parseFloat(amount) || 0;
  const shares = inputMode === "dollars"
    ? (tickerPrice > 0 && rawInput > 0 ? rawInput / tickerPrice : 0)
    : rawInput;
  const dollarAmount = inputMode === "dollars"
    ? rawInput
    : rawInput * tickerPrice;
  const isMarketOpen = marketStatus?.isOpen ?? true;

  const currentHolding = useMemo(() => {
    if (!portfolio?.holdings) return { shares: 0, avgCostBasis: 0, shortShares: 0, shortAvgPrice: 0 };
    const h = portfolio.holdings.find((h: any) => h.ticker === selectedTicker);
    return h || { shares: 0, avgCostBasis: 0, shortShares: 0, shortAvgPrice: 0 };
  }, [portfolio, selectedTicker]);

  const totalValue = useMemo(() => {
    if (!portfolio?.holdings || !etfPrices) return portfolio?.cashBalance ?? 200;
    let holdingsVal = 0;
    let shortPnl = 0;
    for (const h of portfolio.holdings as any[]) {
      const price = getLivePrice(h.ticker);
      holdingsVal += h.shares * price;
      // Short P&L: profit when price drops below short avg
      if (h.shortShares > 0) {
        shortPnl += h.shortShares * (h.shortAvgPrice - price);
      }
    }
    return (portfolio.cashBalance || 0) + holdingsVal + shortPnl;
  }, [portfolio, etfPrices]);

  const pnl = totalValue - 200;

  const pendingOrdersList = useMemo(() => {
    if (!pendingOrders) return [];
    return pendingOrders.filter((o: any) => o.status === "pending");
  }, [pendingOrders]);

  // Filter tickers: when selling, only show tickers the user holds
  const heldTickers = useMemo(() => {
    if (!portfolio?.holdings) return new Set<string>();
    return new Set(
      portfolio.holdings
        .filter((h: any) => h.shares > 0)
        .map((h: any) => h.ticker)
    );
  }, [portfolio]);

  const shortedTickers = useMemo(() => {
    if (!portfolio?.holdings) return new Set<string>();
    return new Set(
      portfolio.holdings
        .filter((h: any) => h.shortShares > 0)
        .map((h: any) => h.ticker)
    );
  }, [portfolio]);

  const isSellMode = (orderTab === "market" && tradeType === "sell") || 
    (orderTab === "limit" && tradeType === "sell") || 
    orderTab === "stop_loss";
  const isCoverMode = orderTab === "short" && tradeType === "sell";

  const availableTickers = useMemo(() => {
    if (isSellMode) {
      return TICKERS.filter(tk => heldTickers.has(tk.symbol));
    }
    if (isCoverMode) {
      return TICKERS.filter(tk => shortedTickers.has(tk.symbol));
    }
    return TICKERS;
  }, [isSellMode, isCoverMode, heldTickers, shortedTickers]);

  // Auto-switch to first available ticker ONLY when user explicitly enters sell/cover mode
  // and the currently selected ticker is not available to sell/cover.
  // We track the mode transition to avoid reactive switches on portfolio data refreshes.
  const prevModeRef = useRef({ isSellMode, isCoverMode });
  useEffect(() => {
    const wasInRestrictedMode = prevModeRef.current.isSellMode || prevModeRef.current.isCoverMode;
    const isInRestrictedMode = isSellMode || isCoverMode;
    prevModeRef.current = { isSellMode, isCoverMode };

    // Only auto-switch when entering a restricted mode (sell/cover), not on every re-render
    if (isInRestrictedMode && availableTickers.length > 0 && !availableTickers.find(tk => tk.symbol === selectedTicker)) {
      setSelectedTicker(availableTickers[0].symbol as TickerSymbol);
    }
  }, [isSellMode, isCoverMode, availableTickers, selectedTicker]);

  // Debounce guard for all trade actions
  const guardedExecute = (fn: () => void) => {
    const now = Date.now();
    if (tradingLocked || now - lastTradeTime.current < TRADE_COOLDOWN_MS) {
      toast.error("Please wait before placing another trade");
      return;
    }
    lastTradeTime.current = now;
    setTradingLocked(true);
    fn();
    // Unlock after cooldown (mutations also unlock via onSettled)
    setTimeout(() => setTradingLocked(false), TRADE_COOLDOWN_MS);
  };

  // Confirmation-aware trade handlers
  const executeMarketTrade = () => {
    guardedExecute(() => tradeMutation.mutate({ ticker: selectedTicker, type: tradeType, shares, pricePerShare: tickerPrice }));
  };

  const executeShort = () => {
    guardedExecute(() => shortMutation.mutate({ ticker: selectedTicker, shares, pricePerShare: tickerPrice }));
  };

  const executeCover = () => {
    guardedExecute(() => coverMutation.mutate({ ticker: selectedTicker, shares, pricePerShare: tickerPrice }));
  };

  const maybeConfirm = (type: string, action: () => void) => {
    if (rawInput <= 0 || isNaN(rawInput)) {
      toast.error(t.trading.validAmount);
      return;
    }
    if (tickerPrice <= 0) {
      toast.error(t.trading.priceNotAvailable);
      return;
    }
    if (shares < 0.0001) {
      toast.error(t.trading.tooSmall);
      return;
    }
    if (dollarAmount >= CONFIRM_THRESHOLD) {
      setPendingConfirm({
        type,
        ticker: `$${selectedTicker}`,
        amount: `$${dollarAmount.toFixed(2)}`,
        shares: `${shares.toFixed(4)}`,
        price: `$${tickerPrice.toFixed(2)}`,
        action,
      });
    } else {
      action();
    }
  };

  const handleMarketTrade = () => maybeConfirm(tradeType === "buy" ? t.trading.buy : t.trading.sell, executeMarketTrade);
  const handleShort = () => maybeConfirm(t.trading.shortSell, executeShort);
  const handleCover = () => maybeConfirm(t.trading.cover, executeCover);

  const handleLimitOrder = () => {
    const amt = parseFloat(amount);
    const target = parseFloat(targetPrice);
    if (isNaN(amt) || amt <= 0) { toast.error(t.trading.enterValidAmount); return; }
    if (isNaN(target) || target <= 0) { toast.error(t.trading.enterValidTarget); return; }
    const orderShares = target > 0 ? amt / target : 0;
    createOrderMutation.mutate({
      ticker: selectedTicker,
      orderType: tradeType === "buy" ? "limit_buy" : "limit_sell",
      shares: orderShares,
      targetPrice: target,
    });
  };

  const handleStopLoss = () => {
    const amt = parseFloat(amount);
    const target = parseFloat(targetPrice);
    if (isNaN(amt) || amt <= 0) { toast.error(t.trading.enterValidAmount); return; }
    if (isNaN(target) || target <= 0) { toast.error(t.trading.enterValidStop); return; }
    const stopShares = target > 0 ? amt / target : 0;
    createOrderMutation.mutate({
      ticker: selectedTicker,
      orderType: "stop_loss",
      shares: stopShares,
      targetPrice: target,
    });
  };

  const priceLoading = !etfPrices;

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5 }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      {/* Market Status + Portfolio Summary Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isTradingHalted ? "bg-yellow-500 animate-pulse" : isMarketOpen ? "bg-[#00C805] animate-pulse" : "bg-[#FF5252]"}`} />
             <span className={`text-[10px] font-bold uppercase tracking-wider ${isTradingHalted ? "text-yellow-500" : isMarketOpen ? "text-[#00C805]" : "text-[#FF5252]"}`}>
               {isTradingHalted ? "HALTED" : isMarketOpen ? t.trading.marketOpen : t.trading.marketClosedLabel}
             </span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t.trading.cash}</span>
            <span className="text-xs font-bold text-foreground font-[var(--font-mono)]">
              ${portfolio ? portfolio.cashBalance.toFixed(2) : "200.00"}
            </span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t.trading.portfolio}</span>
            <span className="text-xs font-bold text-foreground font-[var(--font-mono)]">
              ${totalValue.toFixed(2)}
            </span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5">
            {pnl >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-[#00C805]" /> : <TrendingDown className="w-3.5 h-3.5 text-[#FF5252]" />}
            <span className="text-xs text-muted-foreground">{t.trading.pnl}</span>
            <span className="text-xs font-bold font-[var(--font-mono)]" style={{ color: pnl >= 0 ? "#00C805" : "#FF5252" }}>
              {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
            </span>
          </div>
          {portfolio && portfolio.totalDividends > 0 && (
            <>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{t.trading.dividends}</span>
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
                  ? "text-foreground border-primary bg-secondary/20"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/10"
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
        {isTradingHalted && (
           <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 mb-4">
             <Pause className="w-4 h-4 text-yellow-500" />
             <p className="text-xs text-yellow-500">Trading halted — player is in a live game. Trades resume after the match ends.</p>
           </div>
         )}
         {!isMarketOpen && !isTradingHalted && orderTab === "market" && (
           <div className="flex items-center gap-2 bg-[#FF5252]/10 border border-[#FF5252]/30 rounded-lg px-3 py-2 mb-4">
             <AlertTriangle className="w-4 h-4 text-[#FF5252]" />
             <p className="text-xs text-[#FF5252]">{t.trading.marketClosed}. {marketStatus?.reason || ""}</p>
           </div>
         )}

        {priceLoading && (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <p className="text-xs text-yellow-500">{t.trading.loadingPrices}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left: Ticker selector + Price */}
          <div>
            <div className="relative mb-4">
              <button
                onClick={() => setShowTickerDropdown(!showTickerDropdown)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-secondary border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tickerInfo.color }} />
                  <div>
                    <span className="text-sm font-bold text-foreground font-[var(--font-mono)]">${selectedTicker}</span>
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
                    {availableTickers.length > 0 ? availableTickers.map((tk) => {
                      const tPrice = getLivePrice(tk.symbol);
                      const tkKey = tk.symbol.toLowerCase() as keyof typeof t.tickers;
                      return (
                        <button
                          key={tk.symbol}
                          onClick={() => { setSelectedTicker(tk.symbol as TickerSymbol); setShowTickerDropdown(false); }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/50 transition-colors ${selectedTicker === tk.symbol ? "bg-secondary/30" : ""}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tk.color }} />
                            <span className="text-xs font-bold text-foreground font-[var(--font-mono)]">${tk.symbol}</span>
                            <span className="text-[10px] text-muted-foreground">{t.tickers[tkKey] || tk.symbol}</span>
                          </div>
                          <span className="text-xs text-foreground font-[var(--font-mono)]">
                            {tPrice > 0 ? `$${tPrice.toFixed(2)}` : "..."}
                          </span>
                        </button>
                      );
                    }) : (
                      <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                        {t.trading.noHoldings || "No holdings to sell"}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Current Price Display */}
            <div className="bg-secondary/30 rounded-lg p-4 mb-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t.trading.currentPrice}</p>
              <p className="text-2xl font-bold text-foreground font-[var(--font-mono)]">
                {tickerPrice > 0 ? `$${tickerPrice.toFixed(2)}` : t.common.loading}
              </p>
              <div className="mt-1 space-y-0.5">
                {currentHolding.shares > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t.trading.long}: <span className="text-foreground font-semibold">{currentHolding.shares.toFixed(2)}</span> {t.trading.sharesLabel} ({t.trading.avg} ${currentHolding.avgCostBasis.toFixed(2)})
                  </p>
                )}
                {currentHolding.shortShares > 0 && (
                  <p className="text-xs text-[#FF5252]">
                    {t.trading.short}: <span className="font-semibold">{currentHolding.shortShares.toFixed(2)}</span> {t.trading.sharesLabel} ({t.trading.avg} ${currentHolding.shortAvgPrice.toFixed(2)})
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Trade Form */}
          <div>
            {/* Market Order Tab */}
            {orderTab === "market" && (
              <>
                <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5 mb-4">
                  <button onClick={() => setTradeType("buy")} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${tradeType === "buy" ? "bg-[#00C805] text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t.trading.buy}</button>
                  <button onClick={() => setTradeType("sell")} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${tradeType === "sell" ? "bg-[#FF5252] text-white" : "text-muted-foreground hover:text-foreground"}`}>{t.trading.sell}</button>
                </div>
                {/* Dollar / Shares toggle */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => { setInputMode("dollars"); setAmount(""); }}
                    className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${inputMode === "dollars" ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >
                    <DollarSign className="inline w-3 h-3 mr-0.5" />USD
                  </button>
                  <button
                    onClick={() => { setInputMode("shares"); setAmount(""); }}
                    className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${inputMode === "shares" ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >
                    Shares
                  </button>
                </div>
                <div className="relative mb-3">
                  {inputMode === "dollars" ? (
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  ) : (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">#</span>
                  )}
                  <input type="number" min="0" step={inputMode === "dollars" ? "0.01" : "0.0001"} value={amount} onChange={(e) => { const val = e.target.value; if (val === "" || parseFloat(val) >= 0) setAmount(val); }} placeholder={inputMode === "dollars" ? t.trading.amountUsd : "Number of shares"} className="w-full pl-9 pr-4 py-3 rounded-lg bg-secondary border border-border text-foreground text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50" />
                </div>
                {shares > 0 && (
                  <p className="text-xs text-muted-foreground mb-3 font-[var(--font-mono)]">
                    {inputMode === "dollars"
                      ? `≈ ${shares.toFixed(4)} shares @ $${tickerPrice.toFixed(2)}`
                      : `≈ $${dollarAmount.toFixed(2)} @ $${tickerPrice.toFixed(2)}/share`}
                  </p>
                )}
                <div className="flex gap-2 mb-4">
                  {inputMode === "dollars"
                    ? ["10", "25", "50", "100"].map((val) => (
                        <button key={val} onClick={() => setAmount(val)} className="flex-1 py-1.5 rounded-md bg-secondary text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors font-[var(--font-mono)]">${val}</button>
                      ))
                    : ["0.5", "1", "2", "5"].map((val) => (
                        <button key={val} onClick={() => setAmount(val)} className="flex-1 py-1.5 rounded-md bg-secondary text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors font-[var(--font-mono)]">{val}</button>
                      ))
                  }
                </div>
                <button onClick={handleMarketTrade} disabled={tradeMutation.isPending || tradingLocked || shares <= 0 || !isMarketOpen || priceLoading || isTradingHalted} className={`w-full py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${tradeType === "buy" ? "bg-[#00C805] text-primary-foreground hover:bg-[#00b004]" : "bg-[#FF5252] text-white hover:bg-[#e04848]"}`}>
                  {tradeMutation.isPending ? t.trading.processing : `${tradeType === "buy" ? t.trading.buyTicker : t.trading.sellTicker} $${selectedTicker}`}
                </button>
                {/* Sell All button — only show when user holds shares of selected ticker in sell mode */}
                {tradeType === "sell" && currentHolding.shares > 0 && (
                  <button
                    onClick={() => {
                      const allShares = currentHolding.shares;
                      if (allShares <= 0 || tickerPrice <= 0) return;
                      const dollarVal = allShares * tickerPrice;
                      if (dollarVal >= CONFIRM_THRESHOLD) {
                        setPendingConfirm({
                          type: t.trading.sell,
                          ticker: `$${selectedTicker}`,
                          amount: `$${dollarVal.toFixed(2)}`,
                          shares: `${allShares.toFixed(4)}`,
                          price: `$${tickerPrice.toFixed(2)}`,
                          action: () => guardedExecute(() => tradeMutation.mutate({ ticker: selectedTicker, type: "sell", shares: allShares, pricePerShare: tickerPrice })),
                        });
                      } else {
                        guardedExecute(() => tradeMutation.mutate({ ticker: selectedTicker, type: "sell", shares: allShares, pricePerShare: tickerPrice }));
                      }
                    }}
                    disabled={tradeMutation.isPending || tradingLocked || !isMarketOpen || priceLoading || isTradingHalted}
                    className="w-full mt-2 py-2 rounded-lg text-xs font-bold bg-[#FF5252]/20 text-[#FF5252] border border-[#FF5252]/30 hover:bg-[#FF5252]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sell All {currentHolding.shares.toFixed(2)} shares (≈${(currentHolding.shares * tickerPrice).toFixed(2)})
                  </button>
                )}
              </>
            )}

            {/* Limit Order Tab */}
            {orderTab === "limit" && (
              <>
                <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5 mb-4">
                  <button onClick={() => setTradeType("buy")} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${tradeType === "buy" ? "bg-[#00C805] text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t.trading.limitBuy}</button>
                  <button onClick={() => setTradeType("sell")} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${tradeType === "sell" ? "bg-[#FF5252] text-white" : "text-muted-foreground hover:text-foreground"}`}>{t.trading.limitSell}</button>
                </div>
                <div className="relative mb-3">
                  <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="number" min="0" step="0.01" value={targetPrice} onChange={(e) => { const val = e.target.value; if (val === "" || parseFloat(val) >= 0) setTargetPrice(val); }} placeholder={tradeType === "buy" ? t.trading.buyWhenDrops : t.trading.sellWhenRises} className="w-full pl-9 pr-4 py-3 rounded-lg bg-secondary border border-border text-foreground text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50" />
                </div>
                <div className="relative mb-3">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="number" min="0" step="0.01" value={amount} onChange={(e) => { const val = e.target.value; if (val === "" || parseFloat(val) >= 0) setAmount(val); }} placeholder={t.trading.amountUsd} className="w-full pl-9 pr-4 py-3 rounded-lg bg-secondary border border-border text-foreground text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50" />
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  {tradeType === "buy" ? t.trading.limitBuyExec : t.trading.limitSellExec}
                  <span className="text-foreground font-mono">{tickerPrice > 0 ? `$${tickerPrice.toFixed(2)}` : "..."}</span>
                </p>
                <button onClick={handleLimitOrder}disabled={createOrderMutation.isPending || !amount || !targetPrice || isTradingHalted} className={`w-full py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${tradeType === "buy" ? "bg-[#00C805] text-primary-foreground hover:bg-[#00b004]" : "bg-[#FF5252] text-white hover:bg-[#e04848]"}`}>
                   {createOrderMutation.isPending ? t.trading.placing : `${tradeType === "buy" ? t.trading.placeLimitBuy : t.trading.placeLimitSell}`}
                </button>
              </>
            )}

            {/* Stop-Loss Tab */}
            {orderTab === "stop_loss" && (
              <>
                <div className="bg-[#FF5252]/10 border border-[#FF5252]/20 rounded-lg p-3 mb-4">
                  <p className="text-xs text-[#FF5252] font-bold mb-1">{t.trading.stopLossTitle}</p>
                  <p className="text-[10px] text-muted-foreground">{t.trading.stopLossDesc}</p>
                </div>
                <div className="relative mb-3">
                  <ShieldAlert className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5252]" />
                  <input type="number" min="0" step="0.01" value={targetPrice} onChange={(e) => { const val = e.target.value; if (val === "" || parseFloat(val) >= 0) setTargetPrice(val); }} placeholder={t.trading.stopPrice} className="w-full pl-9 pr-4 py-3 rounded-lg bg-secondary border border-[#FF5252]/30 text-foreground text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-[#FF5252] placeholder:text-muted-foreground/50" />
                </div>
                <div className="relative mb-3">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="number" min="0" step="0.01" value={amount} onChange={(e) => { const val = e.target.value; if (val === "" || parseFloat(val) >= 0) setAmount(val); }} placeholder={t.trading.amountToProtect} className="w-full pl-9 pr-4 py-3 rounded-lg bg-secondary border border-border text-foreground text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50" />
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  {t.trading.currentPrice}: <span className="text-foreground font-mono">{tickerPrice > 0 ? `$${tickerPrice.toFixed(2)}` : "..."}</span>
                  {currentHolding.shares > 0 && <> · {t.trading.youHold} <span className="text-foreground">{currentHolding.shares.toFixed(2)}</span> {t.trading.sharesLabel}</>}
                </p>
                <button onClick={handleStopLoss} disabled={createOrderMutation.isPending || !amount || !targetPrice || isTradingHalted} className="w-full py-3 rounded-lg text-sm font-bold bg-[#FF5252] text-white hover:bg-[#e04848] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                   {createOrderMutation.isPending ? t.trading.placing : t.trading.setStopLoss}                </button>
              </>
            )}

            {/* Short Sell Tab */}
            {orderTab === "short" && (
              <>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 mb-4">
                  <p className="text-xs text-purple-400 font-bold mb-1">{t.trading.shortSellingTitle}</p>
                  <p className="text-[10px] text-muted-foreground">{t.trading.shortSellingDesc}</p>
                </div>
                <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5 mb-4">
                  <button onClick={() => setTradeType("sell")} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${tradeType === "sell" ? "bg-purple-500 text-white" : "text-muted-foreground hover:text-foreground"}`}>{t.trading.shortSell}</button>
                  <button onClick={() => setTradeType("buy")} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${tradeType === "buy" ? "bg-[#00C805] text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t.trading.coverBuyBack}</button>
                </div>
                {/* Dollar / Shares toggle */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => { setInputMode("dollars"); setAmount(""); }}
                    className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${inputMode === "dollars" ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >
                    <DollarSign className="inline w-3 h-3 mr-0.5" />USD
                  </button>
                  <button
                    onClick={() => { setInputMode("shares"); setAmount(""); }}
                    className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${inputMode === "shares" ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >
                    Shares
                  </button>
                </div>
                <div className="relative mb-3">
                  {inputMode === "dollars" ? (
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  ) : (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">#</span>
                  )}
                  <input type="number" min="0" step={inputMode === "dollars" ? "0.01" : "0.0001"} value={amount} onChange={(e) => { const val = e.target.value; if (val === "" || parseFloat(val) >= 0) setAmount(val); }} placeholder={inputMode === "dollars" ? t.trading.amountUsd : "Number of shares"} className="w-full pl-9 pr-4 py-3 rounded-lg bg-secondary border border-border text-foreground text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50" />
                </div>
                {shares > 0 && (
                  <p className="text-xs text-muted-foreground mb-3 font-[var(--font-mono)]">
                    {inputMode === "dollars"
                      ? `≈ ${shares.toFixed(4)} shares @ $${tickerPrice.toFixed(2)}`
                      : `≈ $${dollarAmount.toFixed(2)} @ $${tickerPrice.toFixed(2)}/share`}
                  </p>
                )}
                <div className="flex gap-2 mb-4">
                  {inputMode === "dollars"
                    ? ["10", "25", "50", "100"].map((val) => (
                        <button key={val} onClick={() => setAmount(val)} className="flex-1 py-1.5 rounded-md bg-secondary text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors font-[var(--font-mono)]">${val}</button>
                      ))
                    : ["0.5", "1", "2", "5"].map((val) => (
                        <button key={val} onClick={() => setAmount(val)} className="flex-1 py-1.5 rounded-md bg-secondary text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors font-[var(--font-mono)]">{val}</button>
                      ))
                  }
                </div>
                <button
                  onClick={tradeType === "sell" ? handleShort : handleCover}
                  disabled={(tradeType === "sell" ? shortMutation.isPending : coverMutation.isPending) || tradingLocked || shares <= 0 || !isMarketOpen || priceLoading || isTradingHalted}
                  className={`w-full py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${tradeType === "sell" ? "bg-purple-500 text-white hover:bg-purple-600" : "bg-[#00C805] text-primary-foreground hover:bg-[#00b004]"}`}
                >
                  {(tradeType === "sell" ? shortMutation.isPending : coverMutation.isPending) ? t.trading.processing : tradeType === "sell" ? `${t.trading.shortTicker} $${selectedTicker}` : `${t.trading.coverTicker} $${selectedTicker}`}
                </button>
                {/* Cover All button — only show when user has short positions in cover mode */}
                {tradeType === "buy" && currentHolding.shortShares > 0 && (
                  <button
                    onClick={() => {
                      const allShares = currentHolding.shortShares;
                      if (allShares <= 0 || tickerPrice <= 0) return;
                      const dollarVal = allShares * tickerPrice;
                      if (dollarVal >= CONFIRM_THRESHOLD) {
                        setPendingConfirm({
                          type: t.trading.cover,
                          ticker: `$${selectedTicker}`,
                          amount: `$${dollarVal.toFixed(2)}`,
                          shares: `${allShares.toFixed(4)}`,
                          price: `$${tickerPrice.toFixed(2)}`,
                          action: () => guardedExecute(() => coverMutation.mutate({ ticker: selectedTicker, shares: allShares, pricePerShare: tickerPrice })),
                        });
                      } else {
                        guardedExecute(() => coverMutation.mutate({ ticker: selectedTicker, shares: allShares, pricePerShare: tickerPrice }));
                      }
                    }}
                    disabled={coverMutation.isPending || tradingLocked || !isMarketOpen || priceLoading || isTradingHalted}
                    className="w-full mt-2 py-2 rounded-lg text-xs font-bold bg-[#00C805]/20 text-[#00C805] border border-[#00C805]/30 hover:bg-[#00C805]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cover All {currentHolding.shortShares.toFixed(2)} shares (≈${(currentHolding.shortShares * tickerPrice).toFixed(2)})
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Pending Orders */}
        {pendingOrdersList.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border">
            <button onClick={() => setShowOrders(!showOrders)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2">
              <Target className="w-3.5 h-3.5" />
              {t.trading.pendingOrders} ({pendingOrdersList.length})
              <ChevronDown className={`w-3 h-3 transition-transform ${showOrders ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showOrders && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-1.5">
                    {pendingOrdersList.map((order: any) => (
                      <div key={order.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/20">
                        <div className="flex items-center gap-2">
                          {order.orderType === "stop_loss" ? <ShieldAlert className="w-3.5 h-3.5 text-[#FF5252]" /> : <Target className="w-3.5 h-3.5 text-yellow-400" />}
                          <span className="text-xs text-foreground capitalize font-semibold">{order.orderType === "stop_loss" ? t.trading.stopLoss : t.trading.limit}</span>
                          <span className="text-xs font-bold font-[var(--font-mono)]" style={{ color: TICKERS.find((tk) => tk.symbol === order.ticker)?.color ?? "#fff" }}>${order.ticker}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs text-foreground font-[var(--font-mono)]">{order.shares.toFixed(2)} @ ${order.targetPrice.toFixed(2)}</span>
                          </div>
                          <button onClick={() => cancelOrderMutation.mutate({ orderId: order.id })} className="p-1 text-muted-foreground hover:text-[#FF5252] transition-colors" title={t.trading.cancelOrder}>
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
          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Clock className="w-3.5 h-3.5" />
            {t.trading.recentTrades}
            <ChevronDown className={`w-3 h-3 transition-transform ${showHistory ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {showHistory && tradeHistory && tradeHistory.length > 0 && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-3">
                <div className="space-y-1.5">
                  {tradeHistory.map((trade: any) => {
                    const style = getTradeTypeStyle(trade.type, t);
                    const Icon = style.icon;
                    return (
                      <div key={trade.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/20">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" style={{ color: style.color }} />
                          <span className="text-xs text-foreground capitalize font-semibold">{style.label}</span>
                          <span className="text-xs font-bold font-[var(--font-mono)]" style={{ color: TICKERS.find((tk) => tk.symbol === trade.ticker)?.color ?? "#fff" }}>${trade.ticker}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-foreground font-[var(--font-mono)]">{trade.shares.toFixed(2)} @ ${trade.pricePerShare.toFixed(2)}</span>
                          <p className="text-[10px] text-muted-foreground">${trade.totalAmount.toFixed(2)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>

    {/* Trade Confirmation Dialog */}
    <AlertDialog open={!!pendingConfirm} onOpenChange={(open) => { if (!open) setPendingConfirm(null); }}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground font-[var(--font-heading)]">
            {t.trading.confirmTitle}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            <div className="space-y-3 mt-2">
              <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">{t.trading.confirmType}</span>
                  <span className="text-xs font-bold text-foreground">{pendingConfirm?.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">{t.trading.confirmTicker}</span>
                  <span className="text-xs font-bold text-foreground font-[var(--font-mono)]">{pendingConfirm?.ticker}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">{t.trading.confirmAmount}</span>
                  <span className="text-xs font-bold text-foreground font-[var(--font-mono)]">{pendingConfirm?.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">{t.trading.confirmShares}</span>
                  <span className="text-xs font-bold text-foreground font-[var(--font-mono)]">{pendingConfirm?.shares}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">{t.trading.confirmPrice}</span>
                  <span className="text-xs font-bold text-foreground font-[var(--font-mono)]">{pendingConfirm?.price}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-yellow-500">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{t.trading.confirmWarning} ${CONFIRM_THRESHOLD}. {t.trading.pleaseConfirm}</span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-secondary text-foreground border-border hover:bg-secondary/80">{t.trading.confirmCancel}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
            onClick={() => {
              pendingConfirm?.action();
              setPendingConfirm(null);
            }}
          >
            {t.trading.confirmExecute}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
