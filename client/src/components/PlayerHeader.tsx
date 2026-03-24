/*
 * Design: Robinhood stock-price style header.
 * Stock price is the HERO — large, bold, dominant.
 * LP and rank are secondary metadata below.
 */
import { PLAYER, RANKED_SOLO, LP_HISTORY, totalLPToPrice } from "@/lib/playerData";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, DollarSign } from "lucide-react";

const EMERALD_RANK_IMG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663324505869/EqpY4GjGxu3PtSNi8r37GF/emerald-rank-glow-gvNBENfi9Ne5AtDKGtp3U6.webp";

export default function PlayerHeader() {
  // Try to get live data from backend
  const { data: livePlayer } = trpc.player.current.useQuery(undefined, {
    refetchInterval: 60_000, // refetch every minute
    staleTime: 30_000,
  });
  const { data: latestPrice } = trpc.prices.latest.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Compute current price — prefer live data, fall back to static
  const currentPrice = latestPrice
    ? parseFloat(latestPrice.price)
    : totalLPToPrice(LP_HISTORY[LP_HISTORY.length - 1]?.totalLP ?? 0);

  // First price from history for change calculation
  const firstPrice = totalLPToPrice(LP_HISTORY[0]?.totalLP ?? 0);
  const priceChange = currentPrice - firstPrice;
  const pctChange = firstPrice > 0 ? ((priceChange / firstPrice) * 100) : 0;
  const isPositive = priceChange >= 0;

  // Live or static rank info
  const tier = livePlayer?.solo?.tier ?? RANKED_SOLO.tier;
  const division = livePlayer?.solo?.rank ?? String(RANKED_SOLO.division);
  const lp = livePlayer?.solo?.lp ?? RANKED_SOLO.lp;
  const wins = livePlayer?.solo?.wins ?? RANKED_SOLO.wins;
  const losses = livePlayer?.solo?.losses ?? RANKED_SOLO.losses;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const playerName = livePlayer?.gameName ?? PLAYER.name;
  const playerTag = livePlayer?.tagLine ? `#${livePlayer.tagLine}` : PLAYER.tag;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Ticker identity row */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-primary font-[var(--font-heading)]">
                $DORI
              </span>
              <span className="text-sm text-muted-foreground font-[var(--font-mono)]">
                {playerName}
              </span>
              <span className="text-xs text-muted-foreground/60 font-[var(--font-mono)]">
                {playerTag}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-1.5 py-0.5 bg-secondary rounded text-secondary-foreground font-semibold">
                {PLAYER.region}
              </span>
              <Activity className="w-3 h-3 text-primary animate-pulse" />
              <span>Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* HERO: Stock Price */}
      <div className="mt-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white font-[var(--font-heading)] tracking-tight tabular-nums">
            ${currentPrice.toFixed(2)}
          </h2>
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold font-[var(--font-mono)]"
            style={{
              backgroundColor: isPositive
                ? "rgba(0, 200, 5, 0.12)"
                : "rgba(255, 82, 82, 0.12)",
              color: isPositive ? "#00C805" : "#FF5252",
            }}
          >
            {isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            {isPositive ? "+" : ""}${Math.abs(priceChange).toFixed(2)} ({isPositive ? "+" : ""}{pctChange.toFixed(2)}%)
          </div>
          <span className="text-xs text-muted-foreground">past 2 weeks</span>
        </div>
      </div>

      {/* Secondary: Rank & Stats row */}
      <div className="flex items-center gap-5 mt-5 flex-wrap">
        <div className="flex items-center gap-2">
          <img
            src={EMERALD_RANK_IMG}
            alt="Rank"
            className="w-8 h-8 object-contain"
          />
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Rank</p>
            <p className="text-sm font-semibold font-[var(--font-mono)] text-white">
              {tier} {division} · {lp} LP
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Record</p>
          <p className="text-sm font-semibold font-[var(--font-mono)]">
            <span style={{ color: "#00C805" }}>{wins}W</span>
            <span className="text-muted-foreground"> / </span>
            <span style={{ color: "#FF5252" }}>{losses}L</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Win Rate</p>
          <p className="text-sm font-semibold font-[var(--font-mono)] text-white">
            {winRate}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Peak</p>
          <p className="text-sm font-semibold font-[var(--font-mono)] text-white">
            {RANKED_SOLO.topTier} ({RANKED_SOLO.topLP} LP)
          </p>
        </div>
        <div className="hidden sm:block">
          <p className="text-xs text-muted-foreground mb-0.5">Ladder</p>
          <p className="text-sm font-semibold font-[var(--font-mono)] text-white">
            #{PLAYER.ladderRank.toLocaleString()} (Top {PLAYER.ladderPercent}%)
          </p>
        </div>
      </div>
    </motion.div>
  );
}
