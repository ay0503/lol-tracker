/*
 * Design: Robinhood stock-price style header.
 * Stock price is the HERO — large, bold, dominant.
 * LP and rank are secondary metadata below.
 */
import { PLAYER, RANKED_SOLO, LP_HISTORY, totalLPToPrice } from "@/lib/playerData";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { translateRank } from "@/lib/formatters";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, DollarSign } from "lucide-react";

const EMERALD_RANK_IMG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663324505869/EqpY4GjGxu3PtSNi8r37GF/emerald-rank-glow-gvNBENfi9Ne5AtDKGtp3U6.webp";

export default function PlayerHeader() {
  const { t, language } = useTranslation();

  // Try to get live data from backend
  const { data: livePlayer } = trpc.player.current.useQuery(undefined, {
    refetchInterval: 60_000,
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
              <span>{t.player.live}</span>
            </div>
          </div>
        </div>
      </div>

      {/* HERO: Stock Price */}
      <div className="mt-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground font-[var(--font-heading)] tracking-tight tabular-nums">
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
          <span className="text-xs text-muted-foreground">{t.player.past2Weeks}</span>
        </div>
      </div>

      {/* Secondary: Rank & Stats row */}
      <div className="flex items-center gap-5 mt-5 flex-wrap">
        <div className="flex items-center gap-2">
          <img
            src={EMERALD_RANK_IMG}
            alt={t.player.rank}
            className="w-8 h-8 object-contain"
          />
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{t.player.rank}</p>
            <p className="text-sm font-semibold font-[var(--font-mono)] text-foreground">
              {translateRank(`${tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()} ${division}`, language)} · {lp} {t.player.lp}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">{t.player.record}</p>
          <p className="text-sm font-semibold font-[var(--font-mono)]">
            <span style={{ color: "#00C805" }}>{wins}{t.stats.wins}</span>
            <span className="text-muted-foreground"> / </span>
            <span style={{ color: "#FF5252" }}>{losses}{t.stats.losses}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">{t.player.winRate}</p>
          <p className="text-sm font-semibold font-[var(--font-mono)] text-foreground">
            {winRate}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">{t.player.peak}</p>
          <p className="text-sm font-semibold font-[var(--font-mono)] text-foreground">
            {translateRank(RANKED_SOLO.topTier, language)} ({RANKED_SOLO.topLP} {t.player.lp})
          </p>
        </div>
        <div className="hidden sm:block">
          <p className="text-xs text-muted-foreground mb-0.5">{t.player.ladder}</p>
          <p className="text-sm font-semibold font-[var(--font-mono)] text-foreground">
            #{PLAYER.ladderRank.toLocaleString()} ({t.player.top} {PLAYER.ladderPercent}%)
          </p>
        </div>
      </div>
    </motion.div>
  );
}
