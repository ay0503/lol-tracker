import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { Link } from "wouter";
import { ArrowLeft, TrendingUp, TrendingDown, Loader2, Dice5, Calendar, Wallet } from "lucide-react";

/** Sparkline SVG — larger version for profile page */
function Sparkline({ data }: { data: { totalValue: number; timestamp: number }[] }) {
  if (data.length < 2) return <span className="text-sm text-muted-foreground">Not enough data</span>;

  const values = data.map(d => d.totalValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const w = 400, h = 80;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  }).join(" ");

  const isUp = values[values.length - 1] >= values[0];
  const color = isUp ? "var(--color-win)" : "var(--color-loss)";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatTradeDate(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function UserProfilePage() {
  const params = useParams<{ userId: string }>();
  const userId = Number(params.userId);
  const { data, isLoading, error } = trpc.leaderboard.userProfile.useQuery(
    { userId },
    { enabled: !isNaN(userId) },
  );
  const { data: etfPrices } = trpc.prices.etfPrices.useQuery(undefined, { refetchInterval: 30_000 });

  const getPrice = (ticker: string) => {
    if (!etfPrices) return null;
    const found = etfPrices.find((e: any) => e.ticker === ticker);
    return found ? found.price : null;
  };

  if (isNaN(userId)) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container py-12 text-center">
          <p className="text-muted-foreground">Invalid user ID</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 max-w-3xl">
        <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Leaderboard
        </Link>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">User not found</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h1 className="text-2xl font-bold text-foreground font-[var(--font-heading)]">{data.userName}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Joined {formatDate(data.joinDate)}</span>
                <span className="flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Cash: <span className="text-foreground font-mono">${data.cashBalance.toFixed(2)}</span></span>
              </div>
              {data.portfolioHistory.length >= 2 && (() => {
                const first = data.portfolioHistory[0].totalValue;
                const last = data.portfolioHistory[data.portfolioHistory.length - 1].totalValue;
                const pnl = last - first;
                const pnlPct = first !== 0 ? (pnl / first) * 100 : 0;
                const isUp = pnl >= 0;
                return (
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-lg font-bold text-foreground font-mono">${last.toFixed(2)}</span>
                    <div className="flex items-center gap-1">
                      {isUp ? <TrendingUp className="w-4 h-4 text-[color:var(--color-win)]" /> : <TrendingDown className="w-4 h-4 text-[color:var(--color-loss)]" />}
                      <span className="text-sm font-mono font-bold" style={{ color: isUp ? "var(--color-win)" : "var(--color-loss)" }}>
                        {isUp ? "+" : ""}${pnl.toFixed(2)} ({isUp ? "+" : ""}{pnlPct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Portfolio Chart */}
            {data.portfolioHistory.length >= 2 && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">7-Day Portfolio</h2>
                <Sparkline data={data.portfolioHistory} />
              </div>
            )}

            {/* Holdings */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Holdings</h2>
              {data.holdings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No positions</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-border">
                        <th className="text-left py-2 font-medium">Ticker</th>
                        <th className="text-right py-2 font-medium">Shares</th>
                        <th className="text-right py-2 font-medium">Avg Cost</th>
                        <th className="text-right py-2 font-medium">Value</th>
                        <th className="text-right py-2 font-medium">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.holdings.map(h => {
                        const price = getPrice(h.ticker);
                        if (h.shares > 0) {
                          const currentVal = price ? h.shares * price : null;
                          const costBasis = h.shares * h.avgCostBasis;
                          const pnl = currentVal !== null ? currentVal - costBasis : null;
                          return (
                            <tr key={h.ticker + "-long"} className="border-b border-border/50">
                              <td className="py-2 font-mono font-bold">${h.ticker}</td>
                              <td className="py-2 text-right font-mono">{h.shares.toFixed(2)}</td>
                              <td className="py-2 text-right font-mono">${h.avgCostBasis.toFixed(2)}</td>
                              <td className="py-2 text-right font-mono">{currentVal !== null ? `$${currentVal.toFixed(2)}` : "—"}</td>
                              <td className="py-2 text-right font-mono font-bold" style={{ color: pnl === null ? undefined : pnl >= 0 ? "var(--color-win)" : "var(--color-loss)" }}>
                                {pnl !== null ? `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` : "—"}
                              </td>
                            </tr>
                          );
                        }
                        if (h.shortShares > 0) {
                          const currentVal = price ? h.shortShares * price : null;
                          const entryVal = h.shortShares * h.shortAvgPrice;
                          const pnl = currentVal !== null ? entryVal - currentVal : null;
                          return (
                            <tr key={h.ticker + "-short"} className="border-b border-border/50">
                              <td className="py-2 font-mono font-bold">${h.ticker} <span className="text-red-400 text-xs">(short)</span></td>
                              <td className="py-2 text-right font-mono">{h.shortShares.toFixed(2)}</td>
                              <td className="py-2 text-right font-mono">${h.shortAvgPrice.toFixed(2)}</td>
                              <td className="py-2 text-right font-mono">{currentVal !== null ? `$${currentVal.toFixed(2)}` : "—"}</td>
                              <td className="py-2 text-right font-mono font-bold" style={{ color: pnl === null ? undefined : pnl >= 0 ? "var(--color-win)" : "var(--color-loss)" }}>
                                {pnl !== null ? `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` : "—"}
                              </td>
                            </tr>
                          );
                        }
                        return null;
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Trade History */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Trade History</h2>
              {data.trades.length === 0 ? (
                <p className="text-sm text-muted-foreground">No trades yet</p>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto">
                  {data.trades.map((trade, i) => {
                    const isBuy = trade.type === "buy" || trade.type === "short";
                    return (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/30 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold uppercase text-xs px-1.5 py-0.5 rounded ${isBuy ? "bg-[color:var(--color-win)]/10 text-[color:var(--color-win)]" : "bg-[color:var(--color-loss)]/10 text-[color:var(--color-loss)]"}`}>
                            {trade.type}
                          </span>
                          <span className="font-mono font-bold">${trade.ticker}</span>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <span className="font-mono text-muted-foreground">{trade.shares.toFixed(2)} @ ${trade.pricePerShare.toFixed(2)}</span>
                          <span className="text-xs text-muted-foreground w-28 text-right hidden sm:inline">{formatTradeDate(trade.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bet Stats + Recent Bets */}
            {data.betStats && data.betStats.total > 0 && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Dice5 className="w-3.5 h-3.5" /> Bets
                </h2>
                <div className="flex items-center gap-4 text-sm mb-4">
                  <span className="text-[color:var(--color-win)] font-mono font-bold">{data.betStats.won}W</span>
                  <span className="text-[color:var(--color-loss)] font-mono font-bold">{data.betStats.lost}L</span>
                  {data.betStats.pending > 0 && <span className="text-yellow-400 font-mono">{data.betStats.pending} pending</span>}
                  <span className="text-muted-foreground">|</span>
                  <span className="font-mono font-bold" style={{ color: data.betStats.totalWinnings - data.betStats.totalLost >= 0 ? "var(--color-win)" : "var(--color-loss)" }}>
                    Net: {data.betStats.totalWinnings - data.betStats.totalLost >= 0 ? "+" : ""}${(data.betStats.totalWinnings - data.betStats.totalLost).toFixed(2)}
                  </span>
                </div>
                {data.bets.length > 0 && (
                  <div className="space-y-2.5">
                    {data.bets.map((bet, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                        <span className="text-foreground">{bet.prediction}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-muted-foreground">${bet.amount.toFixed(2)}</span>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            bet.status === "won" ? "bg-[color:var(--color-win)]/10 text-[color:var(--color-win)]" :
                            bet.status === "lost" ? "bg-[color:var(--color-loss)]/10 text-[color:var(--color-loss)]" :
                            "bg-yellow-400/10 text-yellow-400"
                          }`}>
                            {bet.status}{bet.payout !== null ? ` ($${bet.payout.toFixed(2)})` : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
