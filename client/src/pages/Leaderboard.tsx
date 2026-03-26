import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, Crown, Medal, Award, ChevronDown, ChevronUp, Loader2, Dice5, BarChart3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

/** Mini sparkline SVG from portfolio history */
function Sparkline({ data }: { data: { totalValue: number; timestamp: number }[] }) {
  if (data.length < 2) return <span className="text-[10px] text-muted-foreground">—</span>;

  const values = data.map(d => d.totalValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const w = 80, h = 24;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  const isUp = values[values.length - 1] >= values[0];
  const color = isUp ? "#00C805" : "#FF5252";

  return (
    <svg width={w} height={h} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Expanded user profile panel */
function UserProfile({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { data, isLoading } = trpc.leaderboard.userProfile.useQuery({ userId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border/50 mt-3">
      {/* Holdings */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Holdings</p>
        {data.holdings.length === 0 ? (
          <p className="text-xs text-muted-foreground">No positions</p>
        ) : (
          <div className="space-y-1">
            {data.holdings.map(h => (
              <div key={h.ticker} className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold">${h.ticker}</span>
                <div className="text-right">
                  {h.shares > 0 && (
                    <span className="text-foreground font-mono">{h.shares.toFixed(2)} shares @ ${h.avgCostBasis.toFixed(2)}</span>
                  )}
                  {h.shortShares > 0 && (
                    <span className="text-red-400 font-mono ml-2">short {h.shortShares.toFixed(2)} @ ${h.shortAvgPrice.toFixed(2)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent trades */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent Trades</p>
        {data.trades.length === 0 ? (
          <p className="text-xs text-muted-foreground">No trades yet</p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {data.trades.slice(0, 10).map((trade, i) => {
              const isBuy = trade.type === "buy" || trade.type === "short";
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold uppercase text-[10px] ${isBuy ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                      {trade.type}
                    </span>
                    <span className="font-mono">${trade.ticker}</span>
                  </div>
                  <span className="text-muted-foreground font-mono">
                    {trade.shares.toFixed(2)} @ ${trade.pricePerShare.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bet stats */}
      {data.betStats && data.betStats.total > 0 && (
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
            <Dice5 className="w-3 h-3 inline mr-1" />Bets
          </p>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-[#00C805] font-mono font-bold">{data.betStats.won}W</span>
            <span className="text-[#FF5252] font-mono font-bold">{data.betStats.lost}L</span>
            {data.betStats.pending > 0 && <span className="text-yellow-400 font-mono">{data.betStats.pending} pending</span>}
            <span className="text-muted-foreground">|</span>
            <span className={`font-mono font-bold ${data.betStats.totalWinnings - data.betStats.totalLost >= 0 ? "text-[#00C805]" : "text-[#FF5252]"}`}>
              {data.betStats.totalWinnings - data.betStats.totalLost >= 0 ? "+" : ""}${(data.betStats.totalWinnings - data.betStats.totalLost).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Portfolio sparkline */}
      {data.portfolioHistory.length >= 2 && (
        <div className="sm:col-span-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">7-Day Portfolio</p>
          <Sparkline data={data.portfolioHistory} />
        </div>
      )}
    </div>
  );
}

type LeaderboardTab = "trading" | "casino";

export default function Leaderboard() {
  const { t, language } = useTranslation();
  const { data: rankings, isLoading } = trpc.leaderboard.rankings.useQuery();
  const { data: casinoRankings, isLoading: casinoLoading } = trpc.casino.leaderboard.useQuery();
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [tab, setTab] = useState<LeaderboardTab>("trading");

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {t.common.back}
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-bold text-foreground font-[var(--font-heading)]">{t.nav.leaderboard}</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <Link href="/ledger" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t.nav.ledger}</Link>
            <Link href="/portfolio" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t.nav.portfolio}</Link>
            <Link href="/news" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t.nav.news}</Link>
            <Link href="/sentiment" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t.nav.sentiment}</Link>
          </div>
        </div>
      </nav>

      <main className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground font-[var(--font-heading)]">{t.leaderboard.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.leaderboard.subtitle}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-secondary/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => { setTab("trading"); setExpandedUserId(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === "trading" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {language === "ko" ? "트레이딩" : "Trading"}
          </button>
          <button
            onClick={() => { setTab("casino"); setExpandedUserId(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === "casino" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Dice5 className="w-3.5 h-3.5" />
            {language === "ko" ? "카지노" : "Casino"}
          </button>
        </div>

        {tab === "trading" ? (
        /* ─── Trading Leaderboard ─── */
        isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !rankings || rankings.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">{t.leaderboard.noTraders}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rankings.map((trader, idx) => {
              const rank = idx + 1;
              const isPositive = trader.pnl >= 0;
              const isExpanded = expandedUserId === trader.userId;

              return (
                <motion.div
                  key={trader.userId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${getRankBg(rank)} ${isExpanded ? "ring-1 ring-primary/30" : ""}`}
                  onClick={() => setExpandedUserId(isExpanded ? null : trader.userId)}
                >
                  {/* Desktop layout */}
                  <div className="hidden sm:flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getRankIcon(rank)}
                      <div>
                        <p className="text-sm font-bold text-foreground">{trader.userName}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {t.leaderboard.cash}: <span className="text-foreground font-mono">${trader.cashBalance.toFixed(2)}</span>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t.leaderboard.holdings}: <span className="text-foreground font-mono">${trader.holdingsValue.toFixed(2)}</span>
                          </span>
                          {trader.shortExposure !== 0 && (
                            <span className="text-xs text-muted-foreground">
                              {t.leaderboard.shorts}: <span className="text-foreground font-mono">${trader.shortExposure.toFixed(2)}</span>
                            </span>
                          )}
                          {trader.totalDividends > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {t.leaderboard.dividends}: <span className="text-green-400 font-mono">${trader.totalDividends.toFixed(2)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground font-mono">${trader.totalValue.toFixed(2)}</p>
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
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Mobile layout */}
                  <div className="sm:hidden">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getRankIcon(rank)}
                        <p className="text-sm font-bold text-foreground">{trader.userName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold text-foreground font-mono">${trader.totalValue.toFixed(2)}</p>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {t.leaderboard.cash}: <span className="text-foreground font-mono">${trader.cashBalance.toFixed(0)}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {t.leaderboard.holdings}: <span className="text-foreground font-mono">${trader.holdingsValue.toFixed(0)}</span>
                        </span>
                        {trader.shortExposure !== 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {t.leaderboard.shorts}: <span className="text-foreground font-mono">${trader.shortExposure.toFixed(0)}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isPositive ? (
                          <TrendingUp className="w-3 h-3 text-[#00C805]" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-[#FF5252]" />
                        )}
                        <span
                          className="text-[10px] font-mono font-bold"
                          style={{ color: isPositive ? "#00C805" : "#FF5252" }}
                        >
                          {isPositive ? "+" : ""}{trader.pnlPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expandable profile */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <UserProfile userId={trader.userId} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )
        ) : (
        /* ─── Casino Leaderboard ─── */
        casinoLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !casinoRankings || casinoRankings.length === 0 ? (
          <div className="text-center py-16">
            <Dice5 className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">{language === "ko" ? "아직 카지노 플레이어가 없습니다" : "No casino players yet"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {casinoRankings.map((player, idx) => {
              const rank = idx + 1;
              const isProfit = player.profit >= 0;
              return (
                <motion.div
                  key={player.userId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`border rounded-xl p-4 ${getRankBg(rank)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getRankIcon(rank)}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-bold ${(player as any).nameEffect?.cssClass || "text-foreground"}`}>{player.userName}</p>
                          {(player as any).title && (
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold ${(player as any).title.cssClass || "bg-zinc-800 text-zinc-400 border border-zinc-700"}`}>
                              {(player as any).title.name}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {language === "ko" ? "시작" : "Started"}: $20.00
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground font-mono">${player.casinoBalance.toFixed(2)}</p>
                      <div className="flex items-center gap-1 justify-end">
                        {isProfit ? (
                          <TrendingUp className="w-3 h-3 text-[#00C805]" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-[#FF5252]" />
                        )}
                        <span
                          className="text-xs font-mono font-bold"
                          style={{ color: isProfit ? "#00C805" : "#FF5252" }}
                        >
                          {isProfit ? "+" : ""}${player.profit.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
        )}
      </main>
    </div>
  );
}
