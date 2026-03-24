/*
 * Design: Robinhood stock-price style header.
 * Large LP number, change badge, rank info.
 */
import { PLAYER, RANKED_SOLO, LP_HISTORY } from "@/lib/playerData";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

const EMERALD_RANK_IMG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663324505869/EqpY4GjGxu3PtSNi8r37GF/emerald-rank-glow-gvNBENfi9Ne5AtDKGtp3U6.webp";

export default function PlayerHeader() {
  const firstLP = LP_HISTORY[0]?.totalLP ?? 0;
  const lastLP = LP_HISTORY[LP_HISTORY.length - 1]?.totalLP ?? 0;
  const lpChange = lastLP - firstLP;
  const isPositive = lpChange >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="flex items-center gap-3 mb-1">
        <div className="relative">
          <img
            src={EMERALD_RANK_IMG}
            alt="Emerald Rank"
            className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-white font-[var(--font-heading)]">
              {PLAYER.name}
            </h1>
            <span className="text-sm text-muted-foreground font-[var(--font-mono)]">
              {PLAYER.tag}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-1.5 py-0.5 bg-secondary rounded text-secondary-foreground font-semibold">
              {PLAYER.region}
            </span>
            <span>Level {PLAYER.level}</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">
              Ladder #{PLAYER.ladderRank.toLocaleString()} (Top {PLAYER.ladderPercent}%)
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline gap-3">
          <h2 className="text-4xl sm:text-5xl font-bold text-white font-[var(--font-heading)] tracking-tight">
            {RANKED_SOLO.tier} {RANKED_SOLO.division}
          </h2>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="text-2xl sm:text-3xl font-bold font-[var(--font-mono)] text-white">
            {RANKED_SOLO.lp} LP
          </span>
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold font-[var(--font-mono)]"
            style={{
              backgroundColor: isPositive
                ? "rgba(0, 200, 5, 0.12)"
                : "rgba(255, 82, 82, 0.12)",
              color: isPositive ? "#00C805" : "#FF5252",
            }}
          >
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            {isPositive ? "+" : ""}{lpChange} LP
          </div>
          <span className="text-xs text-muted-foreground">past 2 weeks</span>
        </div>
      </div>

      <div className="flex gap-6 mt-5 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Record</p>
          <p className="text-sm font-semibold font-[var(--font-mono)]">
            <span style={{ color: "#00C805" }}>{RANKED_SOLO.wins}W</span>
            <span className="text-muted-foreground"> / </span>
            <span style={{ color: "#FF5252" }}>{RANKED_SOLO.losses}L</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Win Rate</p>
          <p className="text-sm font-semibold font-[var(--font-mono)] text-white">
            {RANKED_SOLO.winRate}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Peak</p>
          <p className="text-sm font-semibold font-[var(--font-mono)] text-white">
            {RANKED_SOLO.topTier} ({RANKED_SOLO.topLP} LP)
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />
          <span className="text-xs text-muted-foreground">Live tracking</span>
        </div>
      </div>
    </motion.div>
  );
}
