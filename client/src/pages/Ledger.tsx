/*
 * Ledger: Public trade ledger with Trades and Dividends tabs.
 * Full i18n support (EN/KR).
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, ArrowLeft, BookOpen, RefreshCw, Coins, Dice5, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import { TICKERS } from "@/lib/playerData";
import { formatTimeAgoFromDate, translateTickerDescription } from "@/lib/formatters";

function getTickerColor(ticker: string): string {
  return TICKERS.find(t => t.symbol === ticker)?.color ?? "#fff";
}

type LedgerTab = "trades" | "dividends" | "bets";

export default function Ledger() {
  const { t, language } = useTranslation();
  const [tab, setTab] = useState<LedgerTab>("trades");
  const { data: trades, isLoading: tradesLoading, refetch: refetchTrades, isRefetching: tradesRefetching } = trpc.ledger.all.useQuery({ limit: 200 });
  const { data: dividends, isLoading: dividendsLoading, refetch: refetchDividends, isRefetching: dividendsRefetching } = trpc.ledger.dividends.useQuery({ limit: 200 });
  const { data: allBets, isLoading: betsLoading, refetch: refetchBets, isRefetching: betsRefetching } = trpc.ledger.bets.useQuery({ limit: 200 });

  const isLoading = tab === "trades" ? tradesLoading : tab === "dividends" ? dividendsLoading : betsLoading;
  const isRefetching = tab === "trades" ? tradesRefetching : tab === "dividends" ? dividendsRefetching : betsRefetching;
  const refetch = tab === "trades" ? refetchTrades : tab === "dividends" ? refetchDividends : refetchBets;

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-4xl">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" />
          {t.common.back} $DORI
        </Link>

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
          trades && trades.length > 0 ? (
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
                {trades.map((trade, i) => (
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
                        <span className="text-xs text-foreground truncate font-[var(--font-mono)]">
                          {String(trade.userName || t.common.anonymous)}
                        </span>
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
                          <span className="text-xs text-foreground font-semibold truncate max-w-[80px]">
                            {String(trade.userName || t.common.anonymous)}
                          </span>
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
          dividends && dividends.length > 0 ? (
            <>
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                <div className="col-span-2">{t.ledger.user}</div>
                <div className="col-span-2">{t.ledger.ticker}</div>
                <div className="col-span-4">{language === "ko" ? "사유" : "Reason"}</div>
                <div className="col-span-2 text-right">{language === "ko" ? "지급액" : "Payout"}</div>
                <div className="col-span-2 text-right">{language === 'ko' ? '시간' : 'Time'}</div>
              </div>

              <div className="space-y-1.5">
                {dividends.map((div, i) => (
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
                        <span className="text-xs text-foreground truncate font-[var(--font-mono)]">
                          {div.userName}
                        </span>
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
                          <span className="text-xs text-foreground font-semibold truncate max-w-[80px]">
                            {div.userName}
                          </span>
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
        ) : (
          /* ─── Bets Tab ─── */
          allBets && allBets.length > 0 ? (
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
                {allBets.map((bet, i) => {
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
                          <span className="text-xs text-foreground truncate font-[var(--font-mono)]">{bet.userName}</span>
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
                            <span className="text-xs text-foreground font-semibold truncate max-w-[80px]">{bet.userName}</span>
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
        )}
      </div>
    </div>
  );
}
