/*
 * Ledger: Public trade ledger showing all trades from all users.
 * Full i18n support (EN/KR).
 */
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, ArrowLeft, BookOpen, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { TICKERS } from "@/lib/playerData";
import { formatTimeAgoFromDate, translateTickerDescription } from "@/lib/formatters";

function getTickerColor(ticker: string): string {
  return TICKERS.find(t => t.symbol === ticker)?.color ?? "#fff";
}

export default function Ledger() {
  const { t, language } = useTranslation();
  const { data: trades, isLoading, refetch, isRefetching } = trpc.ledger.all.useQuery({ limit: 200 });

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
            {t.common.refresh}
          </button>
        </div>

        {/* Ticker Legend */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {TICKERS.map(tk => (
            <div key={tk.symbol} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/50">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tk.color }} />
              <span className="text-xs font-bold font-[var(--font-mono)]" style={{ color: tk.color }}>
                ${tk.symbol}
              </span>
              <span className="text-[10px] text-muted-foreground">{translateTickerDescription(tk.symbol, tk.description, language)}</span>
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
        ) : trades && trades.length > 0 ? (
          <div className="space-y-1.5">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              <div className="col-span-2">{t.ledger.user}</div>
              <div className="col-span-2">{t.ledger.type}</div>
              <div className="col-span-2">{t.ledger.ticker}</div>
              <div className="col-span-2 text-right">{t.ledger.shares}</div>
              <div className="col-span-2 text-right">{t.ledger.price}</div>
              <div className="col-span-2 text-right">{t.ledger.total}</div>
            </div>

            {trades.map((trade, i) => (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02, duration: 0.3 }}
                className="grid grid-cols-12 gap-2 items-center px-4 py-3 bg-card border border-border rounded-lg hover:bg-secondary/30 transition-colors"
              >
                <div className="col-span-2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                    <span className="text-[10px] font-bold text-foreground">
                      {String(trade.userName || t.common.anonymous).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-foreground truncate font-[var(--font-mono)]">
                    {String(trade.userName || t.common.anonymous)}
                  </span>
                </div>

                <div className="col-span-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      trade.type === "buy"
                        ? "bg-[#00C805]/15 text-[#00C805]"
                        : "bg-[#FF5252]/15 text-[#FF5252]"
                    }`}
                  >
                    {trade.type === "buy" ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {trade.type === "buy" ? t.trading.buy : t.trading.sell}
                  </span>
                </div>

                <div className="col-span-2">
                  <span
                    className="text-xs font-bold font-[var(--font-mono)]"
                    style={{ color: getTickerColor(trade.ticker) }}
                  >
                    ${trade.ticker}
                  </span>
                </div>

                <div className="col-span-2 text-right">
                  <span className="text-xs text-foreground font-[var(--font-mono)]">
                    {trade.shares.toFixed(2)}
                  </span>
                </div>

                <div className="col-span-2 text-right">
                  <span className="text-xs text-muted-foreground font-[var(--font-mono)]">
                    ${trade.pricePerShare.toFixed(2)}
                  </span>
                </div>

                <div className="col-span-2 text-right">
                  <div>
                    <span className="text-xs text-foreground font-semibold font-[var(--font-mono)]">
                      ${trade.totalAmount.toFixed(2)}
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {formatTimeAgoFromDate(trade.createdAt, language)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">{t.ledger.noTrades}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{t.ledger.beFirst}</p>
          </div>
        )}
      </div>
    </div>
  );
}
