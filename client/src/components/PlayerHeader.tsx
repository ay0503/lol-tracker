/*
 * Design: Robinhood stock-price style header.
 * Stock price is the HERO — large, bold, dominant.
 * LP and rank are secondary metadata below.
 * Fully wired to live backend data — no static fallbacks.
 */
import { useState } from "react";

import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { translateRank } from "@/lib/formatters";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, DollarSign, Loader2 } from "lucide-react";

const EMERALD_RANK_IMG = "/assets/emerald-rank.webp";

export default function PlayerHeader() {
  const { t, language } = useTranslation();

  const { data: livePlayer, isLoading: playerLoading } = trpc.player.current.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  // Single source of truth for all current prices
  const { data: etfPrices, isLoading: priceLoading } = trpc.prices.etfPrices.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  // Get ~30 days of history for price change calculation
  const [thirtyDaysAgo] = useState(() => Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60);
  const { data: etfHistory } = trpc.prices.etfHistory.useQuery(
    { ticker: "DORI", since: thirtyDaysAgo },
    { refetchInterval: 60_000, staleTime: 30_000 }
  );

  const isLoading = playerLoading || priceLoading;

  // Compute current price from live ETF prices (same source as trading panel)
  const currentPrice = etfPrices && Array.isArray(etfPrices)
    ? (etfPrices.find((p: any) => p.ticker === "DORI")?.price ?? null)
    : null;

  // First price from ETF history for change calculation
  const firstPrice = etfHistory && etfHistory.length > 0 ? etfHistory[0].price : null;
  const priceChange = currentPrice !== null && firstPrice !== null ? currentPrice - firstPrice : null;
  const pctChange = priceChange !== null && firstPrice !== null && firstPrice > 0
    ? ((priceChange / firstPrice) * 100)
    : null;
  const isPositive = priceChange !== null ? priceChange >= 0 : true;

  // Live rank info
  const tier = livePlayer?.solo?.tier;
  const division = livePlayer?.solo?.rank;
  const lp = livePlayer?.solo?.lp;
  const wins = livePlayer?.solo?.wins;
  const losses = livePlayer?.solo?.losses;
  const winRate = wins !== undefined && losses !== undefined && (wins + losses) > 0
    ? Math.round((wins / (wins + losses)) * 100)
    : null;
  const playerName = livePlayer?.gameName ?? null;
  const playerTag = livePlayer?.tagLine ? `#${livePlayer.tagLine}` : null;

  // Loading skeleton
  function Skeleton({ className }: { className?: string }) {
    return <div className={`animate-pulse bg-secondary rounded ${className ?? ""}`} />;
  }

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
              {playerName ? (
                <span className="text-sm text-muted-foreground font-[var(--font-mono)]">
                  {playerName}
                </span>
              ) : isLoading ? (
                <Skeleton className="w-24 h-4" />
              ) : null}
              {playerTag ? (
                <span className="text-xs text-muted-foreground/60 font-[var(--font-mono)]">
                  {playerTag}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-1.5 py-0.5 bg-secondary rounded text-secondary-foreground font-semibold">
                NA
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
          {currentPrice !== null ? (
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground font-[var(--font-heading)] tracking-tight tabular-nums">
              ${currentPrice.toFixed(2)}
            </h2>
          ) : (
            <Skeleton className="w-64 h-16" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {priceChange !== null && pctChange !== null ? (
            <>
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
            </>
          ) : isLoading ? (
            <Skeleton className="w-48 h-8" />
          ) : null}
        </div>
      </div>

      {/* Secondary: Rank & Stats row */}
      <div className="flex items-center gap-3 sm:gap-5 mt-4 sm:mt-5 flex-wrap">
        {tier && division && lp !== undefined ? (
          <>
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
          </>
        ) : isLoading ? (
          <>
            <Skeleton className="w-32 h-10" />
            <Skeleton className="w-24 h-10" />
            <Skeleton className="w-16 h-10" />
          </>
        ) : null}
      </div>
    </motion.div>
  );
}
