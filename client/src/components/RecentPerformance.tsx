/*
 * Design: Compact table showing recent 7-day champion performance.
 * Win rate bars with green/red coloring.
 * Fully wired to live backend data — no static fallbacks.
 */
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";

export default function RecentPerformance() {
  const { t } = useTranslation();

  const { data: livePerformance, isLoading } = trpc.stats.recentPerformance.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const champData = livePerformance ?? [];
  const isLive = champData.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="animate-pulse bg-secondary rounded-md w-7 h-7" />
            <div className="flex-1">
              <div className="animate-pulse bg-secondary rounded w-20 h-3 mb-1" />
              <div className="animate-pulse bg-secondary rounded w-full h-1" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (champData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {t.common.noRecentData}
      </p>
    );
  }

  return (
    <div>
      {isLive && (
        <div className="flex items-center gap-1 mb-3">
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
            <Activity className="w-2.5 h-2.5" />
            {t.common.live}
          </span>
          <span className="text-[10px] text-muted-foreground">{t.common.autoUpdated}</span>
        </div>
      )}
      <div className="space-y-2">
        {champData.map((champ, i) => {
          const total = champ.wins + champ.losses;
          const isGood = champ.winRate >= 55;
          const isBad = champ.winRate < 45;
          return (
            <motion.div
              key={champ.champion}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <img
                src={champ.image}
                alt={champ.champion}
                className="w-7 h-7 rounded-md"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground">
                    {champ.champion}
                  </span>
                  <span
                    className="text-xs font-bold font-[var(--font-mono)]"
                    style={{
                      color: isGood ? "#00C805" : isBad ? "#FF5252" : "#9CA3AF",
                    }}
                  >
                    {champ.winRate}%
                  </span>
                </div>
                <div className="w-full h-1 bg-secondary rounded-full overflow-hidden flex">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(champ.wins / total) * 100}%` }}
                    transition={{ delay: i * 0.06 + 0.2, duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: "#00C805" }}
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(champ.losses / total) * 100}%` }}
                    transition={{ delay: i * 0.06 + 0.2, duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: "#FF5252" }}
                  />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[10px] text-muted-foreground font-[var(--font-mono)]">
                    {champ.wins}{t.stats.wins} {champ.losses}{t.stats.losses}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {total} {t.performance.games}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
