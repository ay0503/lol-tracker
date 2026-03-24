/*
 * Design: Compact season history table with tier badges.
 * Current season row now wired to live data from backend.
 * Past seasons remain static (no API source for historical seasons).
 */
import { SEASON_HISTORY } from "@/lib/playerData";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";

function getTierColor(tier: string): string {
  if (tier.includes("Emerald") || tier.includes("EMERALD")) return "#00C805";
  if (tier.includes("Diamond") || tier.includes("DIAMOND")) return "#B9F2FF";
  if (tier.includes("Platinum") || tier.includes("PLATINUM")) return "#4EE1C0";
  if (tier.includes("Gold") || tier.includes("GOLD")) return "#FFD700";
  if (tier.includes("Silver") || tier.includes("SILVER")) return "#C0C0C0";
  return "#9CA3AF";
}

function formatDivision(rank: string): string {
  // Convert API format (I, II, III, IV) to display format (1, 2, 3, 4)
  const map: Record<string, string> = { I: "1", II: "2", III: "3", IV: "4" };
  return map[rank] || rank;
}

function formatTierName(tier: string): string {
  // Capitalize first letter, lowercase rest
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
}

export default function SeasonHistory() {
  const { data: livePlayer } = trpc.player.current.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Live current season data
  const currentTier = livePlayer?.solo
    ? `${formatTierName(livePlayer.solo.tier)} ${formatDivision(livePlayer.solo.rank)}`
    : "Emerald 2";
  const currentLP = livePlayer?.solo?.lp ?? 39;
  const isLive = !!livePlayer?.solo;

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
          <span className="text-sm font-semibold text-foreground" style={{ color: getTierColor(currentTier) }}>
            {currentTier}
          </span>
          {isLive && (
            <span className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-semibold bg-primary/10 text-primary">
              <Activity className="w-2 h-2" />
              LIVE
            </span>
          )}
        </div>
        <span className="text-sm font-bold font-[var(--font-mono)] text-primary">
          {currentLP} LP
        </span>
      </motion.div>

      {/* Past seasons */}
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
              {season.tier}
            </span>
          </div>
          <span className="text-xs font-[var(--font-mono)] text-muted-foreground">
            {season.lp} LP
          </span>
        </motion.div>
      ))}
    </div>
  );
}
