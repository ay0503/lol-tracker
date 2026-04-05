import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, Crown, Medal, Award, ChevronDown, ChevronUp, Loader2, Dice5, BarChart3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import StyledName from "@/components/StyledName";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

function getRankIcon(rank: number) {
  if (rank === 1) return <div className="w-8 h-8 rounded-full bg-yellow-500/15 flex items-center justify-center"><Crown className="w-4 h-4 text-yellow-400" /></div>;
  if (rank === 2) return <div className="w-8 h-8 rounded-full bg-gray-400/15 flex items-center justify-center"><Medal className="w-4 h-4 text-gray-300" /></div>;
  if (rank === 3) return <div className="w-8 h-8 rounded-full bg-amber-600/15 flex items-center justify-center"><Award className="w-4 h-4 text-amber-600" /></div>;
  return <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"><span className="text-xs font-bold text-muted-foreground">{rank}</span></div>;
}

function getRankBg(rank: number) {
  if (rank === 1) return "bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/30";
  if (rank === 2) return "bg-gradient-to-r from-gray-400/10 to-transparent border-gray-400/30";
  if (rank === 3) return "bg-gradient-to-r from-amber-600/10 to-transparent border-amber-600/30";
  return "bg-card border-border";
}

/** Mini sparkline SVG from portfolio history */
function Sparkline({ data }: { data: { totalValue: number; timestamp: number }[] }) {
  if (data.length < 2) return <span className="text-xs text-muted-foreground">—</span>;

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
  const color = isUp ? "var(--color-win)" : "var(--color-loss)";

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
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Holdings</p>
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
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent Trades</p>
        {data.trades.length === 0 ? (
          <p className="text-xs text-muted-foreground">No trades yet</p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {data.trades.slice(0, 10).map((trade, i) => {
              const isBuy = trade.type === "buy" || trade.type === "short";
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold uppercase text-xs ${isBuy ? "text-[color:var(--color-win)]" : "text-[color:var(--color-loss)]"}`}>
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
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
            <Dice5 className="w-3 h-3 inline mr-1" />Bets
          </p>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-[color:var(--color-win)] font-mono font-bold">{data.betStats.won}W</span>
            <span className="text-[color:var(--color-loss)] font-mono font-bold">{data.betStats.lost}L</span>
            {data.betStats.pending > 0 && <span className="text-yellow-400 font-mono">{data.betStats.pending} pending</span>}
            <span className="text-muted-foreground">|</span>
            <span className={`font-mono font-bold ${data.betStats.totalWinnings - data.betStats.totalLost >= 0 ? "text-[color:var(--color-win)]" : "text-[color:var(--color-loss)]"}`}>
              {data.betStats.totalWinnings - data.betStats.totalLost >= 0 ? "+" : ""}${(data.betStats.totalWinnings - data.betStats.totalLost).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Portfolio sparkline */}
      {data.portfolioHistory.length >= 2 && (
        <div className="sm:col-span-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">7-Day Portfolio</p>
          <Sparkline data={data.portfolioHistory} />
        </div>
      )}
    </div>
  );
}

// ─── Leaderboard Charts ───

const USER_COLORS = [
  "var(--color-win)", "var(--color-loss)", "#4A9EFF", "#FFD54F", "#E040FB",
  "#00BCD4", "#FF9800", "#F44336", "#9C27B0",
  "#009688", "#CDDC39", "#8BC34A",
];

type ChartRange = "1D" | "1W" | "1M" | "ALL";

/** Clickable legend — click to toggle user visibility */
function ChartLegend({ userNames, hidden, onToggle }: {
  userNames: string[];
  hidden: Set<string>;
  onToggle: (name: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 px-1">
      {userNames.map((name, idx) => {
        const isHidden = hidden.has(name);
        return (
          <button
            key={name}
            onClick={() => onToggle(name)}
            className={`flex items-center gap-1.5 transition-opacity ${isHidden ? "opacity-30" : "opacity-100"}`}
          >
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: USER_COLORS[idx % USER_COLORS.length] }}
            />
            <span className="text-xs text-muted-foreground">{name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Shared hook for chart data */
function useLeaderboardChartData(range: ChartRange) {
  const since = useMemo(() => {
    const now = Date.now();
    if (range === "1D") return now - 24 * 60 * 60 * 1000;
    if (range === "1W") return now - 7 * 24 * 60 * 60 * 1000;
    if (range === "1M") return now - 30 * 24 * 60 * 60 * 1000;
    return 0;
  }, [range]);

  const { data: chartData, isLoading } = trpc.leaderboard.chart.useQuery(
    { since },
    { staleTime: 5 * 60 * 1000 }
  );

  const { valueData, pnlData, rankData, userNames } = useMemo(() => {
    if (!chartData || chartData.length === 0)
      return { valueData: [], pnlData: [], rankData: [], userNames: [] };

    const bucket = (ts: number) => Math.round(ts / (10 * 60 * 1000)) * (10 * 60 * 1000);
    const tsSet = new Set<number>();
    const userMap = new Map<string, Map<number, number>>();

    // Filter out inactive users (stayed within $10 of starting $200)
    const activeUsers = chartData.filter(user => {
      const values = user.data.map(d => d.value);
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      return maxVal - minVal > 10 || Math.abs(values[values.length - 1] - 200) > 10;
    });

    for (const user of activeUsers) {
      const map = new Map<number, number>();
      for (const pt of user.data) {
        const bts = bucket(pt.timestamp);
        tsSet.add(bts);
        map.set(bts, pt.value);
      }
      userMap.set(user.userName, map);
    }

    const timestamps = Array.from(tsSet).sort((a, b) => a - b);
    const names = activeUsers.map(u => u.userName);

    // Forward-fill values
    const lastValues = new Map<string, number>();
    const valRows: Record<string, number>[] = [];
    const rankRows: Record<string, number>[] = [];

    for (const ts of timestamps) {
      const valRow: Record<string, number> = { timestamp: ts };
      for (const name of names) {
        const val = userMap.get(name)?.get(ts);
        if (val !== undefined) {
          lastValues.set(name, val);
          valRow[name] = val;
        } else if (lastValues.has(name)) {
          valRow[name] = lastValues.get(name)!;
        }
      }
      valRows.push(valRow);
    }

    // Compute daily ranks: use end-of-day values, one rank point per day
    const dayKey = (ts: number) => new Date(ts).toDateString();
    let currentDay = "";
    let lastDayRow: Record<string, number> = {};

    for (const valRow of valRows) {
      const day = dayKey(valRow.timestamp);
      if (day !== currentDay) {
        // New day: emit rank row for the previous day
        if (currentDay !== "" && Object.keys(lastDayRow).length > 1) {
          const sorted = names
            .filter(n => lastDayRow[n] !== undefined)
            .sort((a, b) => (lastDayRow[b] ?? 0) - (lastDayRow[a] ?? 0));
          const rankRow: Record<string, number> = { timestamp: lastDayRow.timestamp };
          for (let i = 0; i < sorted.length; i++) {
            rankRow[sorted[i]] = i + 1;
          }
          rankRows.push(rankRow);
        }
        currentDay = day;
      }
      lastDayRow = valRow;
    }
    // Emit final day
    if (Object.keys(lastDayRow).length > 1) {
      const sorted = names
        .filter(n => lastDayRow[n] !== undefined)
        .sort((a, b) => (lastDayRow[b] ?? 0) - (lastDayRow[a] ?? 0));
      const rankRow: Record<string, number> = { timestamp: lastDayRow.timestamp };
      for (let i = 0; i < sorted.length; i++) {
        rankRow[sorted[i]] = i + 1;
      }
      rankRows.push(rankRow);
    }

    // Build daily value data: one point per day (end-of-day value) for cleaner chart
    const dailyValueRows: Record<string, number>[] = [];
    let curDay = "";
    let lastRow: Record<string, number> = {};
    for (const valRow of valRows) {
      const day = dayKey(valRow.timestamp);
      if (day !== curDay) {
        if (curDay !== "" && Object.keys(lastRow).length > 1) {
          dailyValueRows.push(lastRow);
        }
        curDay = day;
      }
      lastRow = valRow;
    }
    if (Object.keys(lastRow).length > 1) {
      dailyValueRows.push(lastRow);
    }

    // Build P&L % data: ((value - 200) / 200) * 100
    const STARTING_CASH = 200;
    const pnlData = valRows.map(row => {
      const pnlRow: Record<string, number> = { timestamp: row.timestamp };
      for (const name of names) {
        if (row[name] !== undefined) {
          pnlRow[name] = ((row[name] - STARTING_CASH) / STARTING_CASH) * 100;
        }
      }
      return pnlRow;
    });

    return { valueData: dailyValueRows, pnlData, rankData: rankRows, userNames: names };
  }, [chartData]);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    if (range === "1D") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return { valueData, pnlData, rankData, userNames, isLoading, formatDate };
}

function LeaderboardCharts() {
  const { language } = useTranslation();
  const [range, setRange] = useState<ChartRange>("1W");
  const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(new Set());
  const { valueData, rankData, userNames, isLoading, formatDate } = useLeaderboardChartData(range);

  const toggleUser = (name: string) => {
    setHiddenUsers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const rangeButtons = (
    <div className="flex gap-1">
      {(["1D", "1W", "1M", "ALL"] as ChartRange[]).map(r => (
        <button
          key={r}
          onClick={() => setRange(r)}
          className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
            range === r
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );

  const loading = (
    <div className="h-[360px] flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  const noData = (
    <div className="h-[360px] flex items-center justify-center text-sm text-muted-foreground">
      {language === "ko" ? "데이터 부족" : "Not enough data"}
    </div>
  );

  const visibleUsers = userNames.filter(n => !hiddenUsers.has(n));

  const hasData = !isLoading && valueData.length >= 2;

  // Smart Y-axis: use 5th/95th percentile of visible users to clip outliers
  const valueDomain = useMemo(() => {
    if (!hasData) return [0, 400];
    const allVals: number[] = [];
    for (const row of valueData) {
      for (const name of userNames) {
        if (!hiddenUsers.has(name) && row[name] !== undefined) {
          allVals.push(row[name]);
        }
      }
    }
    if (allVals.length === 0) return [0, 400];
    allVals.sort((a, b) => a - b);
    const p5 = allVals[Math.floor(allVals.length * 0.05)];
    const p95 = allVals[Math.floor(allVals.length * 0.95)];
    const range = p95 - p5 || 50;
    const pad = range * 0.25;
    return [Math.max(0, Math.floor(p5 - pad)), Math.ceil(p95 + pad)];
  }, [valueData, userNames, hiddenUsers, hasData]);

  return (
    <div className="space-y-4 mb-8">
      {/* ─── Standings Chart (Rank) ─── */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">
            {language === "ko" ? "순위 변동" : "Standings"}
          </h3>
          {rangeButtons}
        </div>

        {isLoading ? loading : !hasData ? noData : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(400, userNames.length * 36)}>
              <LineChart data={rankData} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={formatDate}
                  tick={{ fontSize: 10, fill: "#888" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  reversed
                  domain={[0.5, userNames.length + 0.5]}
                  ticks={Array.from({ length: userNames.length }, (_, i) => i + 1)}
                  tick={{ fontSize: 9, fill: "#666" }}
                  tickFormatter={(v: number) => `#${v}`}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#18181b", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(ts: number) => new Date(ts).toLocaleString()}
                  formatter={(value: number, name: string) => [`#${value}`, name]}
                  itemSorter={(item: any) => (item.value as number)}
                />
                {userNames.map((name, idx) => {
                  const color = USER_COLORS[idx % USER_COLORS.length];
                  const isHidden = hiddenUsers.has(name);
                  return (
                    <Line
                      key={name}
                      type="linear"
                      dataKey={name}
                      stroke={color}
                      strokeWidth={isHidden ? 0 : 2.5}
                      strokeOpacity={isHidden ? 0 : 0.85}
                      dot={isHidden ? false : (props: any) => {
                        const { cx, cy, value } = props;
                        if (!cx || !cy || value == null) return <g />;
                        return (
                          <g>
                            <circle cx={cx} cy={cy} r={11} fill={color} stroke="#18181b" strokeWidth={2} />
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={8} fontWeight="bold">
                              {value}
                            </text>
                          </g>
                        );
                      }}
                      connectNulls
                      activeDot={false}
                      isAnimationActive
                      animationDuration={2000}
                      animationBegin={0}
                      animationEasing="ease-out"
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
            <ChartLegend userNames={userNames} hidden={hiddenUsers} onToggle={toggleUser} />
          </>
        )}
      </div>

      {/* ─── Portfolio Value Chart ─── */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">
            {language === "ko" ? "포트폴리오 추이" : "Portfolio Value"}
          </h3>
        </div>

        {isLoading ? loading : !hasData ? noData : (
          <>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={valueData}>
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={formatDate}
                  tick={{ fontSize: 10, fill: "#888" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={valueDomain}
                  allowDataOverflow
                  tick={{ fontSize: 10, fill: "#888" }}
                  tickFormatter={(v: number) => `$${v}`}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <ReferenceLine y={200} stroke="#555" strokeDasharray="3 3" label={{ value: "Start", position: "right", fill: "#666", fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#18181b", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(ts: number) => new Date(ts).toLocaleString()}
                  formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name]}
                  itemSorter={(item: any) => -(item.value as number)}
                />
                {userNames.map((name, idx) => (
                  <Line
                    key={name}
                    type="natural"
                    dataKey={name}
                    stroke={USER_COLORS[idx % USER_COLORS.length]}
                    strokeWidth={2}
                    strokeOpacity={hiddenUsers.has(name) ? 0 : 0.8}
                    dot={{ r: 3, fill: USER_COLORS[idx % USER_COLORS.length], stroke: "#18181b", strokeWidth: 1.5 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                    hide={hiddenUsers.has(name)}
                    isAnimationActive
                    animationDuration={2000}
                    animationBegin={0}
                    animationEasing="ease-out"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <ChartLegend userNames={userNames} hidden={hiddenUsers} onToggle={toggleUser} />
          </>
        )}
      </div>
    </div>
  );
}

type LeaderboardTab = "trading" | "casino";

export default function Leaderboard() {
  const { t, language } = useTranslation();
  const { data: rankings, isLoading } = trpc.leaderboard.rankings.useQuery();
  const { data: casinoRankings, isLoading: casinoLoading } = trpc.casino.leaderboard.useQuery();
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const VALID_TABS: LeaderboardTab[] = ["trading", "casino"];
  const [tab, setTabState] = useState<LeaderboardTab>(() => {
    const hash = window.location.hash.slice(1);
    return VALID_TABS.includes(hash as LeaderboardTab) ? (hash as LeaderboardTab) : "trading";
  });
  const setTab = (newTab: LeaderboardTab) => {
    setTabState(newTab);
    window.history.replaceState(null, "", `#${newTab}`);
  };
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if (VALID_TABS.includes(hash as LeaderboardTab)) setTabState(hash as LeaderboardTab);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground font-[var(--font-heading)]">{t.leaderboard.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.leaderboard.subtitle}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-secondary/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => { setTab("trading"); setExpandedUserId(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs transition-all ${
              tab === "trading" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {language === "ko" ? "트레이딩" : "Trading"}
          </button>
          <button
            onClick={() => { setTab("casino"); setExpandedUserId(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs transition-all ${
              tab === "casino" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <Dice5 className="w-3.5 h-3.5" />
            {language === "ko" ? "카지노" : "Casino"}
          </button>
        </div>

        {tab === "trading" ? (
        /* ─── Trading Leaderboard ─── */
        <>
        <LeaderboardCharts />
        {isLoading ? (
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
                  transition={{ type: "spring", damping: 26, stiffness: 260, delay: idx * 0.05 }}
                  className={`border rounded-xl p-4 cursor-pointer transition-all transition-shadow duration-200 hover:shadow-md ${getRankBg(rank)} ${isExpanded ? "ring-1 ring-primary/30" : ""}`}
                  onClick={() => setExpandedUserId(isExpanded ? null : trader.userId)}
                >
                  {/* Desktop layout */}
                  <div className="hidden sm:flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getRankIcon(rank)}
                      <div>
                        <Link href={`/profile/${trader.userId}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="hover:underline">
                          <StyledName name={trader.userName} nameEffectCss={(trader as any).nameEffect?.cssClass} titleName={(trader as any).title?.name} titleCss={(trader as any).title?.cssClass} className="text-sm" />
                        </Link>
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
                            <TrendingUp className="w-3 h-3 text-[color:var(--color-win)]" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-[color:var(--color-loss)]" />
                          )}
                          <span
                            className="text-xs sm:text-sm font-mono font-bold"
                            style={{ color: isPositive ? "var(--color-win)" : "var(--color-loss)" }}
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
                        <Link href={`/profile/${trader.userId}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="hover:underline">
                          <StyledName name={trader.userName} nameEffectCss={(trader as any).nameEffect?.cssClass} titleName={(trader as any).title?.name} titleCss={(trader as any).title?.cssClass} className="text-sm" />
                        </Link>
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
                        <span className="text-xs text-muted-foreground">
                          {t.leaderboard.cash}: <span className="text-foreground font-mono">${trader.cashBalance.toFixed(0)}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t.leaderboard.holdings}: <span className="text-foreground font-mono">${trader.holdingsValue.toFixed(0)}</span>
                        </span>
                        {trader.shortExposure !== 0 && (
                          <span className="text-xs text-muted-foreground">
                            {t.leaderboard.shorts}: <span className="text-foreground font-mono">${trader.shortExposure.toFixed(0)}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isPositive ? (
                          <TrendingUp className="w-3 h-3 text-[color:var(--color-win)]" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-[color:var(--color-loss)]" />
                        )}
                        <span
                          className="text-xs font-mono font-bold"
                          style={{ color: isPositive ? "var(--color-win)" : "var(--color-loss)" }}
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
                        transition={{ type: "spring", damping: 26, stiffness: 260 }}
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
        )}
        </>
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
                  transition={{ type: "spring", damping: 26, stiffness: 260, delay: idx * 0.05 }}
                  className={`border rounded-xl p-4 transition-shadow duration-200 hover:shadow-md ${getRankBg(rank)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getRankIcon(rank)}
                      <div>
                        <StyledName
                          name={player.userName}
                          nameEffectCss={(player as any).nameEffect?.cssClass}
                          titleName={(player as any).title?.name}
                          titleCss={(player as any).title?.cssClass}
                          className="text-sm"
                        />
                        <span className="text-xs text-muted-foreground">
                          {language === "ko" ? "시작" : "Started"}: $20.00
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground font-mono">${player.casinoBalance.toFixed(2)}</p>
                      <div className="flex items-center gap-1 justify-end">
                        {isProfit ? (
                          <TrendingUp className="w-3 h-3 text-[color:var(--color-win)]" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-[color:var(--color-loss)]" />
                        )}
                        <span
                          className="text-xs sm:text-sm font-mono font-bold"
                          style={{ color: isProfit ? "var(--color-win)" : "var(--color-loss)" }}
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
