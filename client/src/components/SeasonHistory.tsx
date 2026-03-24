/*
 * Design: Compact season history table with tier badges.
 * Current season row wired to live data from backend.
 * Past seasons remain static (no API source for historical seasons).
 */
import { SEASON_HISTORY } from "@/lib/playerData";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { translateRank } from "@/lib/formatters";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";

function getTierColor(tier: string): string {
  if (tier.includes("Emerald") || tier.includes("EMERALD") || tier.includes("\uc5d0\uba54\ub784\ub4dc")) return "#00C805";
  if (tier.includes("Diamond") || tier.includes("DIAMOND") || tier.includes("\ub2e4\uc774\uc544\ubaac\ub4dc")) return "#B9F2FF";
  if (tier.includes("Platinum") || tier.includes("PLATINUM") || tier.includes("\ud50c\ub798\ud2f0\ub118")) return "#4EE1C0";
  if (tier.includes("Gold") || tier.includes("GOLD") || tier.includes("\uace8\ub4dc")) return "#FFD700";
  if (tier.includes("Silver") || tier.includes("SILVER") || tier.includes("\uc2e4\ubc84")) return "#C0C0C0";
  return "#9CA3AF";
}

function formatDivision(rank: string): string {
  const map: Record<string, string> = { I: "1", II: "2", III: "3", IV: "4" };
  return map[rank] || rank;
}

function formatTierName(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
}

export default function SeasonHistory() {
  const { t, language } = useTranslation();

  const { data: livePlayer, isLoading } = trpc.player.current.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const hasSolo = !!livePlayer?.solo;
  const currentTierRaw = hasSolo
    ? `${formatTierName(livePlayer!.solo!.tier)} ${formatDivision(livePlayer!.solo!.rank)}`
    : null;
  const currentTier = currentTierRaw ? translateRank(currentTierRaw, language) : null;
  const currentLP = livePlayer?.solo?.lp ?? null;
  const isLive = hasSolo;

  return (
    <div className="space-y-2">
      {/* Current season */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-between py-2 px-3 rounded-lg bg-primary/5 border border-primary/10"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold font-[var(--font-mono)] text-primary px-1.5 py-0.5 bg-primary/10 rounded">
            S2026
          </span>
          {currentTier && currentTierRaw ? (
            <span className="text-sm font-semibold text-foreground" style={{ color: getTierColor(currentTierRaw) }}>
              {currentTier}
            </span>
          ) : isLoading ? (
            <div className="animate-pulse bg-secondary rounded w-20 h-4" />
          ) : (
            <span className="text-sm text-muted-foreground">--</span>
          )}
          {isLive && (
            <span className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-semibold bg-primary/10 text-primary">
              <Activity className="w-2 h-2" />
              {t.common.live}
            </span>
          )}
        </div>
        {currentLP !== null ? (
          <span className="text-sm font-bold font-[var(--font-mono)] text-primary">
            {currentLP} {t.player.lp}
          </span>
        ) : isLoading ? (
          <div className="animate-pulse bg-secondary rounded w-12 h-4" />
        ) : null}
      </motion.div>

      {/* Past seasons (static — no API for historical data) */}
      {SEASON_HISTORY.map((season, i) => (
        <motion.div
          key={season.season}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-[var(--font-mono)] text-muted-foreground w-16">
              {season.season}
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: getTierColor(season.tier) }}
            >
              {translateRank(season.tier, language)}
            </span>
          </div>
          <span className="text-xs font-[var(--font-mono)] text-muted-foreground">
            {season.lp} {t.player.lp}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
