import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, Crown, Medal, Award } from "lucide-react";
import { motion } from "framer-motion";

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
  if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
  return <span className="text-sm text-muted-foreground font-mono w-5 text-center">#{rank}</span>;
}

function getRankBg(rank: number) {
  if (rank === 1) return "bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/30";
  if (rank === 2) return "bg-gradient-to-r from-gray-400/10 to-transparent border-gray-400/30";
  if (rank === 3) return "bg-gradient-to-r from-amber-600/10 to-transparent border-amber-600/30";
  return "bg-card border-border";
}

export default function Leaderboard() {
  const { data: rankings, isLoading } = trpc.leaderboard.rankings.useQuery();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-bold text-white font-[var(--font-heading)]">Leaderboard</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/ledger" className="text-xs text-muted-foreground hover:text-white transition-colors">Ledger</Link>
            <Link href="/portfolio" className="text-xs text-muted-foreground hover:text-white transition-colors">Portfolio</Link>
            <Link href="/news" className="text-xs text-muted-foreground hover:text-white transition-colors">News</Link>
            <Link href="/sentiment" className="text-xs text-muted-foreground hover:text-white transition-colors">Sentiment</Link>
          </div>
        </div>
      </nav>

      <main className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white font-[var(--font-heading)]">Trader Rankings</h1>
          <p className="text-sm text-muted-foreground mt-1">All traders ranked by total portfolio value. Starting balance: $200.</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !rankings || rankings.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">No traders yet. Be the first to trade!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rankings.map((trader, idx) => {
              const rank = idx + 1;
              const isPositive = trader.pnl >= 0;
              return (
                <motion.div
                  key={trader.userId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`border rounded-xl p-4 ${getRankBg(rank)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getRankIcon(rank)}
                      <div>
                        <p className="text-sm font-bold text-white">{trader.userName}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            Cash: <span className="text-white font-mono">${trader.cashBalance.toFixed(2)}</span>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Holdings: <span className="text-white font-mono">${trader.holdingsValue.toFixed(2)}</span>
                          </span>
                          {trader.shortExposure !== 0 && (
                            <span className="text-xs text-muted-foreground">
                              Shorts: <span className="text-white font-mono">${trader.shortExposure.toFixed(2)}</span>
                            </span>
                          )}
                          {trader.totalDividends > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Dividends: <span className="text-green-400 font-mono">${trader.totalDividends.toFixed(2)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white font-mono">${trader.totalValue.toFixed(2)}</p>
                      <div className="flex items-center gap-1 justify-end">
                        {isPositive ? (
                          <TrendingUp className="w-3 h-3 text-[#00C805]" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-[#FF5252]" />
                        )}
                        <span
                          className="text-xs font-mono font-bold"
                          style={{ color: isPositive ? "#00C805" : "#FF5252" }}
                        >
                          {isPositive ? "+" : ""}${trader.pnl.toFixed(2)} ({isPositive ? "+" : ""}{trader.pnlPct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
