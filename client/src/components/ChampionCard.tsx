/*
 * Design: Compact card showing champion stats in a trading-card style.
 * Win rate shown as a progress bar. KDA and games prominently displayed.
 */
import { motion } from "framer-motion";
import { useTranslation } from "@/contexts/LanguageContext";
import { getChampionName } from "@/lib/championKo";

export interface ChampionStatData {
  name: string;
  image: string;
  games: number;
  winRate: number;
  kdaRatio: number;
  kda: string;
  cs?: string;
}

interface Props {
  champion: ChampionStatData;
  index: number;
}

export default function ChampionCard({ champion, index }: Props) {
  const { t, language } = useTranslation();
  const isGoodWinRate = champion.winRate >= 55;
  const isBadWinRate = champion.winRate < 45;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 26, stiffness: 260, delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      className="bg-card border border-border rounded-xl p-4 min-w-[200px] hover:border-[#3a3d48] transition-colors duration-200"
    >
      <div className="flex items-center gap-3 mb-3">
        <img
          src={champion.image}
          alt={champion.name}
          className="w-10 h-10 rounded-lg"
          loading="lazy"
        />
        <div>
          <h3 className="text-sm font-semibold text-foreground font-[var(--font-heading)]">
            {getChampionName(champion.name, language)}
          </h3>
          <p className="text-xs text-muted-foreground">
            {champion.games} {t.champion.games}
          </p>
        </div>
      </div>

      {/* Win rate bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-muted-foreground">{t.champion.winRate}</span>
          <span
            className="text-sm font-bold font-[var(--font-mono)]"
            style={{
              color: isGoodWinRate
                ? "var(--color-win)"
                : isBadWinRate
                ? "var(--color-loss)"
                : "#9CA3AF",
            }}
          >
            {champion.winRate}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${champion.winRate}%` }}
            transition={{ type: "spring", damping: 26, stiffness: 260, delay: index * 0.08 + 0.3, duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              backgroundColor: isGoodWinRate
                ? "var(--color-win)"
                : isBadWinRate
                ? "var(--color-loss)"
                : "var(--muted-foreground)",
            }}
          />
        </div>
      </div>

      {/* KDA */}
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold font-[var(--font-mono)] text-foreground">
          {champion.kdaRatio.toFixed(2)}
        </span>
        <span className="text-xs text-muted-foreground">{t.champion.kda}</span>
      </div>
      <p className="text-xs text-muted-foreground font-[var(--font-mono)] mt-0.5">
        {champion.kda}
      </p>
    </motion.div>
  );
}
