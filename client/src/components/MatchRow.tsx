/*
 * Design: Clean match history row with left border color indicating win/loss.
 * Compact layout with champion icon, KDA, and duration.
 */
import type { MatchResult } from "@/lib/playerData";
import { useTranslation } from "@/contexts/LanguageContext";
import { formatMatchResult } from "@/lib/formatters";
import { motion } from "framer-motion";

interface Props {
  match: MatchResult;
  index: number;
}

export default function MatchRow({ match, index }: Props) {
  const { t, language } = useTranslation();
  const isWin = match.result === "Victory";
  const isRemake = match.result === "Remake";
  const borderColor = isRemake ? "#6B7280" : isWin ? "#00C805" : "#FF5252";
  const bgColor = isRemake
    ? "rgba(107, 114, 128, 0.04)"
    : isWin
    ? "rgba(0, 200, 5, 0.04)"
    : "rgba(255, 82, 82, 0.04)";

  const { short: resultShort } = formatMatchResult(match.result, language);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: "easeOut" }}
      className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 rounded-lg hover:bg-accent/50 transition-colors duration-150 group"
      style={{
        borderLeft: `3px solid ${borderColor}`,
        backgroundColor: bgColor,
      }}
    >
      {/* Champion icon */}
      <img
        src={match.championImage}
        alt={match.champion}
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex-shrink-0"
        loading="lazy"
      />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground font-[var(--font-heading)]">
            {match.champion}
          </span>
          <span
            className="text-xs font-semibold font-[var(--font-mono)] px-1.5 py-0.5 rounded"
            style={{
              color: borderColor,
              backgroundColor: isWin
                ? "rgba(0, 200, 5, 0.1)"
                : isRemake
                ? "rgba(107, 114, 128, 0.1)"
                : "rgba(255, 82, 82, 0.1)",
            }}
          >
            {resultShort}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {match.duration} · {match.timeAgo}
        </p>
      </div>

      {/* KDA */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold font-[var(--font-mono)] text-foreground">
          <span style={{ color: "#00C805" }}>{match.kills}</span>
          <span className="text-muted-foreground"> / </span>
          <span style={{ color: "#FF5252" }}>{match.deaths}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="text-foreground">{match.assists}</span>
        </p>
        <p className="text-xs text-muted-foreground font-[var(--font-mono)]">
          {match.kdaRatio} {t.champion.kda}
        </p>
      </div>

      {/* CS - hidden on mobile */}
      <div className="text-right flex-shrink-0 hidden sm:block w-20">
        <p className="text-xs text-muted-foreground font-[var(--font-mono)]">
          {match.cs}
        </p>
        <p className="text-xs text-muted-foreground">CS</p>
      </div>
    </motion.div>
  );
}
