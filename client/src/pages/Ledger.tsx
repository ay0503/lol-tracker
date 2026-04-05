/*
 * Ledger: Public trade ledger with Trades (incl. dividends) and Bets tabs.
 * Full i18n support (EN/KR).
 */
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, BookOpen, RefreshCw, Dice5, TrendingUp, TrendingDown, Filter, X, Clock, CircleCheck, CircleX } from "lucide-react";
import StyledName from "@/components/StyledName";
import { useCosmetics } from "@/hooks/useCosmetics";
import { TICKERS } from "@/lib/playerData";
import { formatTimeAgoFromDate, translateTickerDescription } from "@/lib/formatters";

function getTickerColor(ticker: string): string {
  return TICKERS.find(tk => tk.symbol === ticker)?.color ?? "#fff";
}

type LedgerTab = "trades" | "bets";

const TRADES_PAGE_SIZE = 50;

export default function Ledger() {
  const { t, language } = useTranslation();
  const [tab, setTabState] = useState<LedgerTab>(() => {
    const hash = window.location.hash.slice(1);
    return (["trades", "bets"] as const).includes(hash as LedgerTab)
      ? (hash as LedgerTab) : "trades";
  });
  const setTab = (newTab: LedgerTab) => {
    setTabState(newTab);
    window.history.replaceState(null, "", `#${newTab}`);
  };
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if ((["trades", "bets"] as const).includes(hash as LedgerTab)) {
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

  // Pagination
  const [tradesPage, setTradesPage] = useState(1);

  const { data: trades, isLoading: tradesLoading, refetch: refetchTrades, isRefetching: tradesRefetching } = trpc.ledger.all.useQuery({ limit: 200 }, { enabled: tab === "trades" });
  const { data: dividends, isLoading: dividendsLoading, refetch: refetchDividends, isRefetching: dividendsRefetching } = trpc.ledger.dividends.useQuery({ limit: 200 }, { enabled: tab === "trades" });
  const { data: allBets, isLoading: betsLoading, refetch: refetchBets, isRefetching: betsRefetching } = trpc.ledger.bets.useQuery({ limit: 200 }, { enabled: tab === "bets" });

  const { getCosmetics } = useCosmetics();

  // Merge trades + dividends, apply filters, sort by timestamp
  const filteredAll = useMemo(() => {
    const tradeRows: any[] = [];
    const divRows: any[] = [];

    if (trades && (filterType === "" || filterType === "buy" || filterType === "sell")) {
      for (const row of trades) {
        if (filterTicker && row.ticker !== filterTicker) continue;
        if (filterType && row.type !== filterType) continue;
        if (filterUser && !(row.userName || "").toLowerCase().includes(filterUser.toLowerCase())) continue;
        tradeRows.push({ ...row, _kind: "trade" });
      }
    }

    if (dividends && (filterType === "" || filterType === "dividend")) {
      for (const row of dividends) {
        if (filterTicker && row.ticker !== filterTicker) continue;
        if (filterUser && !(row.userName || "").toLowerCase().includes(filterUser.toLowerCase())) continue;
        divRows.push({ ...row, _kind: "dividend" });
      }
    }

    const merged = [...tradeRows, ...divRows];
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return merged;
  }, [trades, dividends, filterTicker, filterType, filterUser]);

  // Reset page when filters change
  useEffect(() => { setTradesPage(1); }, [filterTicker, filterType, filterUser]);

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

  const isLoading = tab === "trades" ? (tradesLoading || dividendsLoading) : betsLoading;
  const isRefetching = tab === "trades" ? (tradesRefetching || dividendsRefetching) : betsRefetching;
  const refetch = tab === "trades" ? () => { refetchTrades(); refetchDividends(); } : refetchBets;

  // Pagination slicing
  const pagedAll = filteredAll.slice((tradesPage - 1) * TRADES_PAGE_SIZE, tradesPage * TRADES_PAGE_SIZE);
  const totalTradesPages = Math.max(1, Math.ceil(filteredAll.length / TRADES_PAGE_SIZE));

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-4xl">

        <div className="flex items-center justify-between mb-8">
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
        <div className="flex gap-1 mb-8 bg-secondary/50 p-1 rounded-xl w-fit">
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
            onClick={() => setTab("bets")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === "bets" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Dice5 className="w-3.5 h-3.5" />
            {language === "ko" ? "베팅" : "Bets"}
          </button>
        </div>

        {/* Ticker Legend — clickable to filter */}
        <div className="flex gap-2 sm:gap-3 mb-8 flex-wrap">
          {TICKERS.map(tk => (
            <div
              key={tk.symbol}
              onClick={() => setFilterTicker(filterTicker === tk.symbol ? "" : tk.symbol)}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                filterTicker === tk.symbol
                  ? "bg-secondary ring-2 ring-primary/60 shadow-sm"
                  : "bg-secondary/50 hover:bg-secondary/80"
              }`}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tk.color }} />
              <span className="text-xs font-bold font-[var(--font-mono)]" style={{ color: tk.color }}>
                ${tk.symbol}
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">{translateTickerDescription(tk.symbol, tk.description, language)}</span>
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
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
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
              {/* Ticker filter — trades tab */}
              {tab === "trades" && (
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

              {/* Type filter — trades: buy/sell/dividend */}
              {tab === "trades" && (
                <select
                  value={filterType}
                  onChange={ev => setFilterType(ev.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <option value="">{language === "ko" ? "모든 유형" : "All Types"}</option>
                  <option value="buy">{language === "ko" ? "매수" : "Buy"}</option>
                  <option value="sell">{language === "ko" ? "매도" : "Sell"}</option>
                  <option value="dividend">{language === "ko" ? "배당금" : "Dividend"}</option>
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

              {/* User search */}
              <input
                type="text"
                value={filterUser}
                onChange={ev => setFilterUser(ev.target.value)}
                placeholder={language === "ko" ? "유저 검색..." : "Search user..."}
                className="px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs w-36 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/50"
              />

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
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
          /* ─── Trades Tab (merged with Dividends) ─── */
          pagedAll.length > 0 ? (
            <>
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                <div className="col-span-2">{t.ledger.user}</div>
                <div className="col-span-1">{t.ledger.type}</div>
                <div className="col-span-2">{t.ledger.ticker}</div>
                <div className="col-span-2 text-right">{t.ledger.shares}</div>
                <div className="col-span-2 text-right">{t.ledger.price}</div>
                <div className="col-span-1 text-right">{t.ledger.total}</div>
                <div className="col-span-2 text-right">{language === 'ko' ? '시간' : 'Time'}</div>
              </div>

              <div className="space-y-2.5">
                {pagedAll.map((entry, i) => {
                  if (entry._kind === "dividend") {
                    // Dividend row
                    return (
                      <motion.div
                        key={`div-${entry.id}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", damping: 26, stiffness: 260, delay: i * 0.02, duration: 0.3 }}
                      >
                        {/* Desktop row */}
                        <div className="hidden sm:grid grid-cols-12 gap-2 items-center px-4 py-3 bg-card border border-border rounded-lg hover:bg-secondary/30 transition-colors">
                          <div className="col-span-2 flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-green-400">$</span>
                            </div>
                            <StyledName name={entry.userName} nameEffectCss={getCosmetics(entry.userId).nameEffect?.cssClass} isCloseFriend={getCosmetics(entry.userId).isCloseFriend} showTitle={false} className="text-xs truncate" />
                          </div>
                          <div className="col-span-1">
                            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">
                              DIV
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs font-bold font-[var(--font-mono)]" style={{ color: getTickerColor(entry.ticker) }}>
                              ${entry.ticker}
                            </span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-xs text-muted-foreground truncate block" title={entry.reason}>
                              {entry.reason}
                            </span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-xs text-muted-foreground">—</span>
                          </div>
                          <div className="col-span-1 text-right">
                            <span className="text-xs text-green-400 font-bold font-[var(--font-mono)]">
                              +${entry.totalPayout.toFixed(2)}
                            </span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-xs text-muted-foreground">{formatTimeAgoFromDate(entry.createdAt, language)}</span>
                          </div>
                        </div>

                        {/* Mobile card */}
                        <div className="sm:hidden bg-card border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-green-400">$</span>
                              </div>
                              <StyledName name={entry.userName} nameEffectCss={getCosmetics(entry.userId).nameEffect?.cssClass} isCloseFriend={getCosmetics(entry.userId).isCloseFriend} showTitle={false} className="text-xs truncate max-w-[80px]" />
                              <span className="inline-flex items-center gap-0.5 text-xs font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                                DIV
                              </span>
                            </div>
                            <span className="text-xs text-green-400 font-bold font-[var(--font-mono)]">+${entry.totalPayout.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold font-[var(--font-mono)]" style={{ color: getTickerColor(entry.ticker) }}>${entry.ticker}</span>
                              <span className="text-muted-foreground truncate max-w-[150px]">{entry.reason}</span>
                            </div>
                            <span className="text-muted-foreground shrink-0">{formatTimeAgoFromDate(entry.createdAt, language)}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  }

                  // Trade row
                  return (
                    <motion.div
                      key={`trade-${entry.id}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", damping: 26, stiffness: 260, delay: i * 0.02, duration: 0.3 }}
                    >
                      {/* Desktop row */}
                      <div className="hidden sm:grid grid-cols-12 gap-2 items-center px-4 py-3 bg-card border border-border rounded-lg hover:bg-secondary/30 transition-colors">
                        <div className="col-span-2 flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-foreground">
                              {String(entry.userName || t.common.anonymous).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <StyledName
                            name={String(entry.userName || t.common.anonymous)}
                            nameEffectCss={getCosmetics(entry.userId).nameEffect?.cssClass}
                            showTitle={false}
                            className="text-xs truncate"
                          />
                        </div>
                        <div className="col-span-1">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase px-2 py-0.5 rounded ${
                            entry.type === "buy" ? "bg-[color:var(--color-win)]/15 text-[color:var(--color-win)]" : "bg-[color:var(--color-loss)]/15 text-[color:var(--color-loss)]"
                          }`}>
                            {entry.type === "buy" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {entry.type === "buy" ? t.trading.buy : t.trading.sell}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs font-bold font-[var(--font-mono)]" style={{ color: getTickerColor(entry.ticker) }}>
                            ${entry.ticker}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-xs text-foreground font-[var(--font-mono)]">{entry.shares.toFixed(2)}</span>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-xs text-muted-foreground font-[var(--font-mono)]">${entry.pricePerShare.toFixed(2)}</span>
                        </div>
                        <div className="col-span-1 text-right">
                          <span className="text-xs text-foreground font-semibold font-[var(--font-mono)]">${entry.totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-xs text-muted-foreground">{formatTimeAgoFromDate(entry.createdAt, language)}</span>
                        </div>
                      </div>

                      {/* Mobile card */}
                      <div className="sm:hidden bg-card border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-foreground">
                                {String(entry.userName || t.common.anonymous).charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <StyledName
                              name={String(entry.userName || t.common.anonymous)}
                              nameEffectCss={getCosmetics(entry.userId).nameEffect?.cssClass}
                              showTitle={false}
                              className="text-xs truncate max-w-[80px]"
                            />
                            <span className={`inline-flex items-center gap-0.5 text-xs font-bold uppercase px-1.5 py-0.5 rounded ${
                              entry.type === "buy" ? "bg-[color:var(--color-win)]/15 text-[color:var(--color-win)]" : "bg-[color:var(--color-loss)]/15 text-[color:var(--color-loss)]"
                            }`}>
                              {entry.type === "buy" ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                              {entry.type === "buy" ? t.trading.buy : t.trading.sell}
                            </span>
                          </div>
                          <span className="text-xs text-foreground font-bold font-[var(--font-mono)]">${entry.totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-[var(--font-mono)]" style={{ color: getTickerColor(entry.ticker) }}>${entry.ticker}</span>
                            <span className="text-muted-foreground font-[var(--font-mono)]">{entry.shares.toFixed(2)} @ ${entry.pricePerShare.toFixed(2)}</span>
                          </div>
                          <span className="text-muted-foreground">{formatTimeAgoFromDate(entry.createdAt, language)}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 px-1">
                <span className="text-xs text-muted-foreground">
                  {(tradesPage - 1) * TRADES_PAGE_SIZE + 1}–{Math.min(tradesPage * TRADES_PAGE_SIZE, filteredAll.length)} {language === "ko" ? "/" : "of"} {filteredAll.length}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setTradesPage(p => Math.max(1, p - 1))}
                    disabled={tradesPage <= 1}
                    className="px-3 py-1 rounded-lg bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    {language === "ko" ? "이전" : "Prev"}
                  </button>
                  <span className="px-2 py-1 text-xs text-muted-foreground font-mono">{tradesPage}/{totalTradesPages}</span>
                  <button
                    onClick={() => setTradesPage(p => Math.min(totalTradesPages, p + 1))}
                    disabled={tradesPage >= totalTradesPages}
                    className="px-3 py-1 rounded-lg bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    {language === "ko" ? "다음" : "Next"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">{t.ledger.noTrades}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{t.ledger.beFirst}</p>
            </div>
          )
        ) : tab === "bets" ? (
          /* ─── Bets Tab ─── */
          filteredBets && filteredBets.length > 0 ? (
            <>
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                <div className="col-span-2">{t.ledger.user}</div>
                <div className="col-span-2">{language === "ko" ? "예측" : "Prediction"}</div>
                <div className="col-span-2 text-right">{language === "ko" ? "금액" : "Amount"}</div>
                <div className="col-span-2">{language === "ko" ? "결과" : "Result"}</div>
                <div className="col-span-2 text-right">{language === "ko" ? "수익" : "Payout"}</div>
                <div className="col-span-2 text-right">{language === 'ko' ? '시간' : 'Time'}</div>
              </div>

              <div className="space-y-2.5">
                {filteredBets.map((bet, i) => {
                  const isPending = bet.status === "pending";
                  const isWon = bet.status === "won";
                  return (
                    <motion.div
                      key={bet.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", damping: 26, stiffness: 260, delay: i * 0.02, duration: 0.3 }}
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
                          <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase px-2 py-0.5 rounded ${
                            bet.prediction === "win" ? "bg-[color:var(--color-win)]/15 text-[color:var(--color-win)]" : "bg-[color:var(--color-loss)]/15 text-[color:var(--color-loss)]"
                          }`}>
                            {bet.prediction === "win" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {bet.prediction === "win" ? "WIN" : "LOSS"}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-xs text-foreground font-[var(--font-mono)]">${bet.amount.toFixed(2)}</span>
                        </div>
                        <div className="col-span-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            isPending ? "bg-yellow-500/15 text-yellow-400" :
                            isWon ? "bg-[color:var(--color-win)]/15 text-[color:var(--color-win)]" : "bg-[color:var(--color-loss)]/15 text-[color:var(--color-loss)]"
                          }`}>
                            {isPending ? <><Clock className="w-3 h-3 inline mr-1" />PENDING</> : isWon ? <><CircleCheck className="w-3 h-3 inline mr-1" />WON</> : <><CircleX className="w-3 h-3 inline mr-1" />LOST</>}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          {isWon && bet.payout ? (
                            <span className="text-xs text-[color:var(--color-win)] font-bold font-[var(--font-mono)]">+${bet.payout.toFixed(2)}</span>
                          ) : !isPending ? (
                            <span className="text-xs text-[color:var(--color-loss)] font-[var(--font-mono)]">-${bet.amount.toFixed(2)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-xs text-muted-foreground">{formatTimeAgoFromDate(bet.createdAt, language)}</span>
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
                            <span className={`inline-flex items-center gap-0.5 text-xs font-bold uppercase px-1.5 py-0.5 rounded ${
                              bet.prediction === "win" ? "bg-[color:var(--color-win)]/15 text-[color:var(--color-win)]" : "bg-[color:var(--color-loss)]/15 text-[color:var(--color-loss)]"
                            }`}>
                              {bet.prediction === "win" ? "WIN" : "LOSS"}
                            </span>
                          </div>
                          {isWon && bet.payout ? (
                            <span className="text-xs text-[color:var(--color-win)] font-bold font-[var(--font-mono)]">+${bet.payout.toFixed(2)}</span>
                          ) : !isPending ? (
                            <span className="text-xs text-[color:var(--color-loss)] font-[var(--font-mono)]">-${bet.amount.toFixed(2)}</span>
                          ) : (
                            <span className="text-xs text-yellow-400 font-[var(--font-mono)]">${bet.amount.toFixed(2)}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-bold ${isPending ? "text-yellow-400" : isWon ? "text-[color:var(--color-win)]" : "text-[color:var(--color-loss)]"}`}>
                            {isPending ? <><Clock className="w-3 h-3 inline mr-1" />PENDING</> : isWon ? <><CircleCheck className="w-3 h-3 inline mr-1" />WON</> : <><CircleX className="w-3 h-3 inline mr-1" />LOST</>}
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
        ) : null}
      </div>
    </div>
  );
}
