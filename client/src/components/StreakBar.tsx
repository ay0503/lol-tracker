/*
 * Design: Horizontal streak visualization like a trading volume bar.
 * Green blocks for wins, red for losses. Current streak highlighted.
 */
import { WIN_LOSS_SEQUENCE, calculateStreaks } from "@/lib/playerData";
import { motion } from "framer-motion";

export default function StreakBar() {
  const streaks = calculateStreaks(WIN_LOSS_SEQUENCE);
  const currentStreak = streaks[0];

  return (
    <div>
      {/* Current streak callout */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{
            backgroundColor:
              currentStreak.type === "win"
                ? "rgba(0, 200, 5, 0.12)"
                : "rgba(255, 82, 82, 0.12)",
          }}
        >
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{
              backgroundColor:
                currentStreak.type === "win" ? "#00C805" : "#FF5252",
            }}
          />
          <span
            className="text-sm font-semibold font-[var(--font-mono)]"
            style={{
              color: currentStreak.type === "win" ? "#00C805" : "#FF5252",
            }}
          >
            {currentStreak.count}
            {currentStreak.type === "win" ? "W" : "L"} Streak
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          Last {WIN_LOSS_SEQUENCE.length} games
        </span>
      </div>

      {/* Streak blocks */}
      <div className="flex gap-[3px] items-end h-10">
        {WIN_LOSS_SEQUENCE.map((result, i) => {
          const isWin = result === "W";
          const isCurrent = i < currentStreak.count;
          return (
            <motion.div
              key={i}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.04, duration: 0.3, ease: "easeOut" }}
              style={{ transformOrigin: "bottom" }}
              className={`flex-1 rounded-sm transition-all duration-200 ${
                isCurrent ? "h-10" : "h-7"
              }`}
              title={`Game ${WIN_LOSS_SEQUENCE.length - i}: ${isWin ? "Win" : "Loss"}`}
            >
              <div
                className="w-full h-full rounded-sm"
                style={{
                  backgroundColor: isWin ? "#00C805" : "#FF5252",
                  opacity: isCurrent ? 1 : 0.5,
                }}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Streak summary */}
      <div className="flex justify-between mt-3 text-xs text-muted-foreground">
        <span>Newest</span>
        <span>Oldest</span>
      </div>

      {/* Streak breakdown */}
      <div className="flex gap-2 mt-4 flex-wrap">
        {streaks.map((streak, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-[var(--font-mono)]"
            style={{
              backgroundColor:
                streak.type === "win"
                  ? "rgba(0, 200, 5, 0.08)"
                  : "rgba(255, 82, 82, 0.08)",
              color: streak.type === "win" ? "#00C805" : "#FF5252",
            }}
          >
            {streak.count}
            {streak.type === "win" ? "W" : "L"}
          </div>
        ))}
      </div>
    </div>
  );
}
