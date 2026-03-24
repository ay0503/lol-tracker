/*
 * Design: Compact season history table with tier badges.
 */
import { SEASON_HISTORY } from "@/lib/playerData";
import { motion } from "framer-motion";

function getTierColor(tier: string): string {
  if (tier.includes("Emerald")) return "#00C805";
  if (tier.includes("Diamond")) return "#B9F2FF";
  if (tier.includes("Platinum")) return "#4EE1C0";
  if (tier.includes("Gold")) return "#FFD700";
  if (tier.includes("Silver")) return "#C0C0C0";
  return "#9CA3AF";
}

export default function SeasonHistory() {
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
          <span className="text-sm font-semibold text-white">Emerald 2</span>
        </div>
        <span className="text-sm font-bold font-[var(--font-mono)] text-primary">
          39 LP
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
