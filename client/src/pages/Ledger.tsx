/*
 * Ledger: Public trade ledger showing all trades from all users.
 * Styled like a real-time trading feed.
 */
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, ArrowLeft, BookOpen, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { TICKERS } from "@/lib/playerData";

function getTickerColor(ticker: string): string {
  return TICKERS.find(t => t.symbol === ticker)?.color ?? "#fff";
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

export default function Ledger() {
  const { data: trades, isLoading, refetch, isRefetching } = trpc.ledger.all.useQuery({ limit: 200 });

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-4xl">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to $DORI
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-[var(--font-heading)]">
                Public Ledger
              </h1>
              <p className="text-xs text-muted-foreground">
                All trades across all users
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs text-muted-foreground hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Ticker Legend */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {TICKERS.map(t => (
            <div key={t.symbol} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/50">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="text-xs font-bold font-[var(--font-mono)]" style={{ color: t.color }}>
                ${t.symbol}
              </span>
              <span className="text-[10px] text-muted-foreground">{t.description}</span>
            </div>
          ))}
        </div>

        {/* Trade Feed */}
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
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              <div className="col-span-2">User</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Ticker</div>
              <div className="col-span-2 text-right">Shares</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-2 text-right">Total</div>
            </div>

            {trades.map((trade, i) => (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02, duration: 0.3 }}
                className="grid grid-cols-12 gap-2 items-center px-4 py-3 bg-card border border-border rounded-lg hover:bg-secondary/30 transition-colors"
              >
                {/* User */}
                <div className="col-span-2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">
                      {String(trade.userName || 'A').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-white truncate font-[var(--font-mono)]">
                    {String(trade.userName || 'Anonymous')}
                  </span>
                </div>

                {/* Type */}
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
                    {trade.type}
                  </span>
                </div>

                {/* Ticker */}
                <div className="col-span-2">
                  <span
                    className="text-xs font-bold font-[var(--font-mono)]"
                    style={{ color: getTickerColor(trade.ticker) }}
                  >
                    ${trade.ticker}
                  </span>
                </div>

                {/* Shares */}
                <div className="col-span-2 text-right">
                  <span className="text-xs text-white font-[var(--font-mono)]">
                    {trade.shares.toFixed(2)}
                  </span>
                </div>

                {/* Price */}
                <div className="col-span-2 text-right">
                  <span className="text-xs text-muted-foreground font-[var(--font-mono)]">
                    ${trade.pricePerShare.toFixed(2)}
                  </span>
                </div>

                {/* Total */}
                <div className="col-span-2 text-right">
                  <div>
                    <span className="text-xs text-white font-semibold font-[var(--font-mono)]">
                      ${trade.totalAmount.toFixed(2)}
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {formatTime(trade.createdAt)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">No trades yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Be the first to trade $DORI!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
