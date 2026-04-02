import AppNav from "@/components/AppNav";
/*
 * Ledger: Public trade ledger with Trades and Dividends tabs.
 * Full i18n support (EN/KR).
 */
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, ArrowLeft, BookOpen, RefreshCw, Coins, Dice5, TrendingUp, TrendingDown, Bot, Filter, X } from "lucide-react";
import { Link } from "wouter";
import StyledName from "@/components/StyledName";
import { useCosmetics } from "@/hooks/useCosmetics";
import { TICKERS } from "@/lib/playerData";
import { formatTimeAgoFromDate, translateTickerDescription } from "@/lib/formatters";

function getTickerColor(ticker: string): string {
  return TICKERS.find(tk => tk.symbol === ticker)?.color ?? "#fff";
}

type LedgerTab = "trades" | "dividends" | "bets" | "bot";

export default function Ledger() {
  const { t, language } = useTranslation();
  const [tab, setTabState] = useState<LedgerTab>(() => {
    const hash = window.location.hash.slice(1);
    return (["trades", "dividends", "bets", "bot"] as const).includes(hash as LedgerTab)
      ? (hash as LedgerTab) : "trades";
  });
  const setTab = (newTab: LedgerTab) => {
    setTabState(newTab);
    window.history.replaceState(null, "", `#${newTab}`);
  };
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if ((["trades", "dividends", "bets", "bot"] as const).includes(hash as LedgerTab)) {
        setTabState(hash as LedgerTab);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  // Filters
  const [filterTicker, setFilterTicker] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterUser, setFilterUser] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const hasFilters = filterTicker || filterType || filterUser;
  const clearFilters = () => { setFilterTicker(""); setFilterType(""); setFilterUser(""); };

  const { data: trades, isLoading: tradesLoading, refetch: refetchTrades, isRefetching: tradesRefetching } = trpc.ledger.all.useQuery({ limit: 200 });
  const { data: dividends, isLoading: dividendsLoading, refetch: refetchDividends, isRefetching: dividendsRefetching } = trpc.ledger.dividends.useQuery({ limit: 200 });
  const { data: allBets, isLoading: betsLoading, refetch: refetchBets, isRefetching: betsRefetching } = trpc.ledger.bets.useQuery({ limit: 200 });
  const [botPage, setBotPage] = useState(1);
  const BOT_PAGE_SIZE = 25;
  const { data: botTrades, isLoading: botLoading, refetch: refetchBot, isRefetching: botRefetching } = trpc.ledger.botTrades.useQuery({ limit: BOT_PAGE_SIZE * botPage });

  const { getCosmetics } = useCosmetics();

  // Apply filters
  const filteredTrades = useMemo(() => {
    if (!trades) return [];
    return trades.filter((row: any) => {
      if (filterTicker && row.ticker !== filterTicker) return false;
      if (filterType && row.type !== filterType) return false;
      if (filterUser && !(row.userName || "").toLowerCase().includes(filterUser.toLowerCase())) return false;
      return true;
    });
  }, [trades, filterTicker, filterType, filterUser]);

  const filteredDividends = useMemo(() => {
    if (!dividends) return [];
    return dividends.filter((row: any) => {
      if (filterTicker && row.ticker !== filterTicker) return false;
      if (filterUser && !(row.userName || "").toLowerCase().includes(filterUser.toLowerCase())) return false;
      return true;
    });
  }, [dividends, filterTicker, filterUser]);

  const filteredBets = useMemo(() => {
    if (!allBets) return [];
    return allBets.filter((row: any) => {
      if (filterType) {
        if (filterType === "win" && row.prediction !== "win") return false;
        if (filterType === "loss" && row.prediction !== "loss") return false;
        if (filterType === "won" && row.status !== "won") return false;
        if (filterType === "lost" && row.status !== "lost") return false;
        if (filterType === "pending" && row.status !== "pending") return false;
      }
      if (filterUser && !(row.userName || "").toLowerCase().includes(filterUser.toLowerCase())) return false;
      return true;
    });
  }, [allBets, filterType, filterUser]);

  const filteredBotTrades = useMemo(() => {
    if (!botTrades) return [];
    return botTrades.filter((row: any) => {
      if (filterTicker && row.ticker !== filterTicker) return false;
      if (filterType && row.type !== filterType) return false;
      return true;
    });
  }, [botTrades, filterTicker, filterType]);

  const isLoading = tab === "trades" ? tradesLoading : tab === "dividends" ? dividendsLoading : tab === "bets" ? betsLoading : botLoading;
  const isRefetching = tab === "trades" ? tradesRefetching : tab === "dividends" ? dividendsRefetching : tab === "bets" ? betsRefetching : botRefetching;
  const refetch = tab === "trades" ? refetchTrades : tab === "dividends" ? refetchDividends : tab === "bets" ? refetchBets : refetchBot;

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <div className="container py-8 max-w-4xl">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground font-[var(--font-heading)]">
                {t.ledger.title}
              </h1>
              <p className="text-xs text-muted-foreground">
                {t.ledger.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{t.common.refresh}</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-secondary/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setTab("trades")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === "trades" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            {language === "ko" ? "거래" : "Trades"}
          </button>
          <button
            onClick={() => setTab("dividends")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === "dividends" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            {language === "ko" ? "배당금" : "Dividends"}
          </button>
          <button
            onClick={() => setTab("bets")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === "bets" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Dice5 className="w-3.5 h-3.5" />
            {language === "ko" ? "베팅" : "Bets"}
          </button>
          <button
            onClick={() => setTab("bot")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === "bot" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            {language === "ko" ? "퀀트봇" : "QuantBot"}
          </button>
        </div>

        {/* Ticker Legend */}
        <div className="flex gap-2 sm:gap-3 mb-6 flex-wrap">
          {TICKERS.map(tk => (
            <div key={tk.symbol} className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-secondary/50">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tk.color }} />
              <span className="text-xs font-bold font-[var(--font-mono)]" style={{ color: tk.color }}>
                ${tk.symbol}
              </span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">{translateTickerDescription(tk.symbol, tk.description, language)}</span>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="mb-4">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              showFilters || hasFilters ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {language === "ko" ? "필터" : "Filters"}
            {hasFilters && (
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center">
                {[filterTicker, filterType, filterUser].filter(Boolean).length}
              </span>
            )}
          </button>

          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-2 flex flex-wrap gap-2 items-center"
            >
              {/* Ticker filter — trades, dividends, bot tabs */}
              {(tab === "trades" || tab === "dividends" || tab === "bot") && (
                <select
                  value={filterTicker}
                  onChange={ev => setFilterTicker(ev.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <option value="">{language === "ko" ? "모든 종목" : "All Tickers"}</option>
                  {TICKERS.map(tk => (
                    <option key={tk.symbol} value={tk.symbol}>${tk.symbol}</option>
                  ))}
                </select>
              )}

              {/* Type filter — trades/bot: buy/sell, bets: prediction/status */}
              {(tab === "trades" || tab === "bot") && (
                <select
                  value={filterType}
                  onChange={ev => setFilterType(ev.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <option value="">{language === "ko" ? "모든 유형" : "All Types"}</option>
                  <option value="buy">{language === "ko" ? "매수" : "Buy"}</option>
                  <option value="sell">{language === "ko" ? "매도" : "Sell"}</option>
                </select>
              )}
              {tab === "bets" && (
                <select
                  value={filterType}
                  onChange={ev => setFilterType(ev.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <option value="">{language === "ko" ? "모든 상태" : "All Status"}</option>
                  <option value="win">{language === "ko" ? "승리 예측" : "Predicted Win"}</option>
                  <option value="loss">{language === "ko" ? "패배 예측" : "Predicted Loss"}</option>
                  <option value="won">{language === "ko" ? "적중" : "Won"}</option>
                  <option value="lost">{language === "ko" ? "실패" : "Lost"}</option>
                  <option value="pending">{language === "ko" ? "대기중" : "Pending"}</option>
                </select>
              )}

              {/* User search — trades, dividends, bets (not bot) */}
              {tab !== "bot" && (
                <input
                  type="text"
                  value={filterUser}
                  onChange={ev => setFilterUser(ev.target.value)}
                  placeholder={language === "ko" ? "유저 검색..." : "Search user..."}
                  className="px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs w-36 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/50"
                />
              )}

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                  {language === "ko" ? "초기화" : "Clear"}
                </button>
              )}
            </motion.div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-card border border-border rounded-lg p-4 flex gap-4">
                <div className="h-4 bg-secondary rounded w-16" />
                <div className="h-4 bg-secondary rounded w-24" />
                <div className="flex-1" />
                <div className="h-4 bg-secondary rounded w-20" />
              </div>
            ))}
          </div>
        ) : tab === "trades" ? (
          /* ─── Trades Tab ─── */
          filteredTrades && filteredTrades.length > 0 ? (
            <>
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                <div className="col-span-2">{t.ledger.user}</div>
                <div className="col-span-1">{t.ledger.type}</div>
                <div className="col-span-2">{t.ledger.ticker}</div>
                <div className="col-span-2 text-right">{t.ledger.shares}</div>
                <div className="col-span-2 text-right">{t.ledger.price}</div>
                <div className="col-span-1 text-right">{t.ledger.total}</div>
                <div className="col-span-2 text-right">{language === 'ko' ? '시간' : 'Time'}</div>
              </div>

              <div className="space-y-1.5">
                {filteredTrades.map((trade, i) => (
                  <motion.div
                    key={trade.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.3 }}
                  >
                    {/* Desktop row */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 items-center px-4 py-3 bg-card border border-border rounded-lg hover:bg-secondary/30 transition-colors">
                      <div className="col-span-2 flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-foreground">
                            {String(trade.userName || t.common.anonymous).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <StyledName
                          name={String(trade.userName || t.common.anonymous)}
                          nameEffectCss={getCosmetics(trade.userId).nameEffect?.cssClass}
                          showTitle={false}
                          className="text-xs truncate"
                        />
                      </div>
                      <div className="col-span-1">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          trade.type === "buy" ? "bg-[#00C805]/15 text-[#00C805]" : "bg-[#FF5252]/15 text-[#FF5252]"
                        }`}>
                          {trade.type === "buy" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {trade.type === "buy" ? t.trading.buy : t.trading.sell}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs font-bold font-[var(--font-mono)]" style={{ color: getTickerColor(trade.ticker) }}>
                          ${trade.ticker}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-xs text-foreground font-[var(--font-mono)]">{trade.shares.toFixed(2)}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-xs text-muted-foreground font-[var(--font-mono)]">${trade.pricePerShare.toFixed(2)}</span>
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="text-xs text-foreground font-semibold font-[var(--font-mono)]">${trade.totalAmount.toFixed(2)}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-[10px] text-muted-foreground">{formatTimeAgoFromDate(trade.createdAt, language)}</span>
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="sm:hidden bg-card border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-foreground">
                              {String(trade.userName || t.common.anonymous).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <StyledName
                            name={String(trade.userName || t.common.anonymous)}
                            nameEffectCss={getCosmetics(trade.userId).nameEffect?.cssClass}
                            showTitle={false}
                            className="text-xs truncate max-w-[80px]"
                          />
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            trade.type === "buy" ? "bg-[#00C805]/15 text-[#00C805]" : "bg-[#FF5252]/15 text-[#FF5252]"
                          }`}>
                            {trade.type === "buy" ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                            {trade.type === "buy" ? t.trading.buy : t.trading.sell}
                          </span>
                        </div>
                        <span className="text-xs text-foreground font-bold font-[var(--font-mono)]">${trade.totalAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-[var(--font-mono)]" style={{ color: getTickerColor(trade.ticker) }}>${trade.ticker}</span>
                          <span className="text-muted-foreground font-[var(--font-mono)]">{trade.shares.toFixed(2)} @ ${trade.pricePerShare.toFixed(2)}</span>
                        </div>
                        <span className="text-muted-foreground">{formatTimeAgoFromDate(trade.createdAt, language)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">{t.ledger.noTrades}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{t.ledger.beFirst}</p>
            </div>
          )
        ) : tab === "dividends" ? (
          /* ─── Dividends Tab ─── */
          filteredDividends && filteredDividends.length > 0 ? (
            <>
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                <div className="col-span-2">{t.ledger.user}</div>
                <div className="col-span-2">{t.ledger.ticker}</div>
                <div className="col-span-4">{language === "ko" ? "사유" : "Reason"}</div>
                <div className="col-span-2 text-right">{language === "ko" ? "지급액" : "Payout"}</div>
                <div className="col-span-2 text-right">{language === 'ko' ? '시간' : 'Time'}</div>
              </div>

              <div className="space-y-1.5">
                {filteredDividends.map((div, i) => (
                  <motion.div
                    key={div.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.3 }}
                  >
                    {/* Desktop row */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 items-center px-4 py-3 bg-card border border-border rounded-lg hover:bg-secondary/30 transition-colors">
                      <div className="col-span-2 flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                          <Coins className="w-3 h-3 text-green-400" />
                        </div>
                        <StyledName name={div.userName} nameEffectCss={getCosmetics(div.userId).nameEffect?.cssClass} isCloseFriend={getCosmetics(div.userId).isCloseFriend} showTitle={false} className="text-xs truncate" />
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs font-bold font-[var(--font-mono)]" style={{ color: getTickerColor(div.ticker) }}>
                          ${div.ticker}
                        </span>
                      </div>
                      <div className="col-span-4">
                        <span className="text-[10px] text-muted-foreground truncate block">
                          {div.reason}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-xs text-green-400 font-bold font-[var(--font-mono)]">
                          +${div.totalPayout.toFixed(2)}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-[10px] text-muted-foreground">
                          {formatTimeAgoFromDate(div.createdAt, language)}
                        </span>
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="sm:hidden bg-card border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                            <Coins className="w-3 h-3 text-green-400" />
                          </div>
                          <StyledName name={div.userName} nameEffectCss={getCosmetics(div.userId).nameEffect?.cssClass} isCloseFriend={getCosmetics(div.userId).isCloseFriend} showTitle={false} className="text-xs truncate max-w-[80px]" />
                        </div>
                        <span className="text-xs text-green-400 font-bold font-[var(--font-mono)]">+${div.totalPayout.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-[var(--font-mono)]" style={{ color: getTickerColor(div.ticker) }}>${div.ticker}</span>
                          <span className="text-muted-foreground truncate max-w-[150px]">{div.reason}</span>
                        </div>
                        <span className="text-muted-foreground shrink-0">{formatTimeAgoFromDate(div.createdAt, language)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <Coins className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                {language === "ko" ? "아직 배당금이 없습니다" : "No dividends yet"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {language === "ko" ? "게임이 끝나면 배당금이 지급됩니다" : "Dividends are paid after each game"}
              </p>
            </div>
          )
        ) : tab === "bets" ? (
          /* ─── Bets Tab ─── */
          filteredBets && filteredBets.length > 0 ? (
            <>
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                <div className="col-span-2">{t.ledger.user}</div>
                <div className="col-span-2">{language === "ko" ? "예측" : "Prediction"}</div>
                <div className="col-span-2 text-right">{language === "ko" ? "금액" : "Amount"}</div>
                <div className="col-span-2">{language === "ko" ? "결과" : "Result"}</div>
                <div className="col-span-2 text-right">{language === "ko" ? "수익" : "Payout"}</div>
                <div className="col-span-2 text-right">{language === 'ko' ? '시간' : 'Time'}</div>
              </div>

              <div className="space-y-1.5">
                {filteredBets.map((bet, i) => {
                  const isPending = bet.status === "pending";
                  const isWon = bet.status === "won";
                  return (
                    <motion.div
                      key={bet.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.3 }}
                    >
                      {/* Desktop row */}
                      <div className="hidden sm:grid grid-cols-12 gap-2 items-center px-4 py-3 bg-card border border-border rounded-lg hover:bg-secondary/30 transition-colors">
                        <div className="col-span-2 flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                            <Dice5 className="w-3 h-3 text-yellow-400" />
                          </div>
                          <StyledName name={bet.userName} nameEffectCss={getCosmetics(bet.userId).nameEffect?.cssClass} isCloseFriend={getCosmetics(bet.userId).isCloseFriend} showTitle={false} className="text-xs truncate" />
                        </div>
                        <div className="col-span-2">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            bet.prediction === "win" ? "bg-[#00C805]/15 text-[#00C805]" : "bg-[#FF5252]/15 text-[#FF5252]"
                          }`}>
                            {bet.prediction === "win" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {bet.prediction === "win" ? "WIN" : "LOSS"}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-xs text-foreground font-[var(--font-mono)]">${bet.amount.toFixed(2)}</span>
                        </div>
                        <div className="col-span-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isPending ? "bg-yellow-500/15 text-yellow-400" :
                            isWon ? "bg-[#00C805]/15 text-[#00C805]" : "bg-[#FF5252]/15 text-[#FF5252]"
                          }`}>
                            {isPending ? "⏳ PENDING" : isWon ? "✅ WON" : "❌ LOST"}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          {isWon && bet.payout ? (
                            <span className="text-xs text-[#00C805] font-bold font-[var(--font-mono)]">+${bet.payout.toFixed(2)}</span>
                          ) : !isPending ? (
                            <span className="text-xs text-[#FF5252] font-[var(--font-mono)]">-${bet.amount.toFixed(2)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-[10px] text-muted-foreground">{formatTimeAgoFromDate(bet.createdAt, language)}</span>
                        </div>
                      </div>

                      {/* Mobile card */}
                      <div className="sm:hidden bg-card border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                              <Dice5 className="w-3 h-3 text-yellow-400" />
                            </div>
                            <StyledName name={bet.userName} nameEffectCss={getCosmetics(bet.userId).nameEffect?.cssClass} isCloseFriend={getCosmetics(bet.userId).isCloseFriend} showTitle={false} className="text-xs truncate max-w-[80px]" />
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              bet.prediction === "win" ? "bg-[#00C805]/15 text-[#00C805]" : "bg-[#FF5252]/15 text-[#FF5252]"
                            }`}>
                              {bet.prediction === "win" ? "WIN" : "LOSS"}
                            </span>
                          </div>
                          {isWon && bet.payout ? (
                            <span className="text-xs text-[#00C805] font-bold font-[var(--font-mono)]">+${bet.payout.toFixed(2)}</span>
                          ) : !isPending ? (
                            <span className="text-xs text-[#FF5252] font-[var(--font-mono)]">-${bet.amount.toFixed(2)}</span>
                          ) : (
                            <span className="text-xs text-yellow-400 font-[var(--font-mono)]">${bet.amount.toFixed(2)}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`font-bold ${isPending ? "text-yellow-400" : isWon ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                            {isPending ? "⏳ PENDING" : isWon ? "✅ WON" : "❌ LOST"}
                          </span>
                          <span className="text-muted-foreground">{formatTimeAgoFromDate(bet.createdAt, language)}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <Dice5 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                {language === "ko" ? "아직 베팅이 없습니다" : "No bets yet"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {language === "ko" ? "홈에서 다음 게임 결과를 예측하세요" : "Predict the next game result from the home page"}
              </p>
            </div>
          )
        ) : tab === "bot" ? (
          /* ─── Bot Tab ─── */
          filteredBotTrades && filteredBotTrades.length > 0 ? (
            <>
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                <div className="col-span-2">{t.ledger.type}</div>
                <div className="col-span-2">{t.ledger.ticker}</div>
                <div className="col-span-2 text-right">{t.ledger.shares}</div>
                <div className="col-span-2 text-right">{t.ledger.price}</div>
                <div className="col-span-2 text-right">{t.ledger.total}</div>
                <div className="col-span-2 text-right">{language === 'ko' ? '시간' : 'Time'}</div>
              </div>
              <div className="space-y-1.5">
                {filteredBotTrades.slice((botPage - 1) * BOT_PAGE_SIZE, botPage * BOT_PAGE_SIZE).map((trade: any, i: number) => (
                  <motion.div
                    key={trade.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.3 }}
                  >
                    <div className="hidden sm:grid grid-cols-12 gap-2 items-center px-4 py-3 bg-card border border-border rounded-lg hover:bg-secondary/30 transition-colors">
                      <div className="col-span-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          trade.type === "buy" ? "bg-[#00C805]/15 text-[#00C805]" : "bg-[#FF5252]/15 text-[#FF5252]"
                        }`}>
                          {trade.type === "buy" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {trade.type === "buy" ? t.trading.buy : t.trading.sell}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs font-bold font-[var(--font-mono)] text-foreground">${trade.ticker}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-xs text-foreground font-[var(--font-mono)]">{trade.shares.toFixed(2)}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-xs text-muted-foreground font-[var(--font-mono)]">${trade.pricePerShare.toFixed(2)}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-xs text-foreground font-[var(--font-mono)]">${trade.totalAmount.toFixed(2)}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-[10px] text-muted-foreground">{formatTimeAgoFromDate(trade.createdAt, language)}</span>
                      </div>
                    </div>
                    {/* Mobile */}
                    <div className="sm:hidden bg-card border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            trade.type === "buy" ? "bg-[#00C805]/15 text-[#00C805]" : "bg-[#FF5252]/15 text-[#FF5252]"
                          }`}>
                            {trade.type === "buy" ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                            {trade.type === "buy" ? t.trading.buy : t.trading.sell}
                          </span>
                          <span className="text-xs font-bold font-[var(--font-mono)]">${trade.ticker}</span>
                        </div>
                        <span className="text-xs font-[var(--font-mono)] text-foreground">${trade.totalAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{trade.shares.toFixed(2)} @ ${trade.pricePerShare.toFixed(2)}</span>
                        <span>{formatTimeAgoFromDate(trade.createdAt, language)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 px-1">
                <span className="text-[10px] text-muted-foreground">
                  {(botPage - 1) * BOT_PAGE_SIZE + 1}–{Math.min(botPage * BOT_PAGE_SIZE, filteredBotTrades.length)} of {filteredBotTrades.length}{filteredBotTrades.length >= botPage * BOT_PAGE_SIZE ? "+" : ""}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setBotPage(p => Math.max(1, p - 1))}
                    disabled={botPage <= 1}
                    className="px-3 py-1 rounded-lg bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    {language === "ko" ? "이전" : "Prev"}
                  </button>
                  <span className="px-2 py-1 text-xs text-muted-foreground font-mono">{botPage}</span>
                  <button
                    onClick={() => setBotPage(p => p + 1)}
                    disabled={filteredBotTrades.length < botPage * BOT_PAGE_SIZE}
                    className="px-3 py-1 rounded-lg bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    {language === "ko" ? "다음" : "Next"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                {language === "ko" ? "퀀트봇 거래 기록이 없습니다" : "No QuantBot trades yet"}
              </p>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
