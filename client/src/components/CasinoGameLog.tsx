import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import StyledName from "./StyledName";


const GAME_ICONS: Record<string, string> = {
  blackjack: "🃏",
  crash: "📈",
  mines: "💣",
  roulette: "🎰",
  dice: "🎲",
  hilo: "🔮",
  plinko: "📌",
  poker: "🂡",
};

const GAME_LABELS: Record<string, string> = {
  blackjack: "Blackjack",
  crash: "Crash",
  mines: "Mines",
  roulette: "Roulette",
  dice: "Dice",
  hilo: "Hi-Lo",
  plinko: "Plinko",
  poker: "Poker",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z").getTime();
  const diff = Math.max(0, now - then);
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function CasinoGameLog() {
  const { language } = useTranslation();
  const { data: feed } = trpc.casino.gameFeed.useQuery(
    { limit: 15 },
    { refetchInterval: 10_000, staleTime: 8_000 },
  );

  if (!feed || feed.length === 0) return null;

  return (
    <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-3 mt-4">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
        {language === "ko" ? "실시간 플레이" : "Live Plays"}
      </h3>
      <div className="space-y-0.5 max-h-[300px] overflow-y-auto scrollbar-hide">
        {feed.map(entry => {
          const won = entry.result === "win";
          const profit = won ? entry.payout - entry.bet : -entry.bet;
          const isBigWin = entry.multiplier !== null && entry.multiplier >= 10;

          return (
            <div
              key={entry.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                isBigWin
                  ? "bg-yellow-500/10 border border-yellow-500/20"
                  : "hover:bg-zinc-800/40"
              }`}
            >
              <span className="text-sm flex-shrink-0" title={GAME_LABELS[entry.game] || entry.game}>
                {GAME_ICONS[entry.game] || "🎮"}
              </span>

              <span className="font-bold text-white truncate min-w-0 max-w-[100px]">
                <StyledName
                  name={entry.userName}
                  nameEffectCss={entry.nameEffectCss}
                  showTitle={false}
                />
              </span>

              <span className="text-zinc-500 text-[11px] flex-shrink-0">
                {GAME_LABELS[entry.game] || entry.game}
              </span>

              <span className="text-zinc-400 font-mono text-[11px] flex-shrink-0">
                ${entry.bet.toFixed(2)}
              </span>

              <span className="text-zinc-600 flex-shrink-0">&rarr;</span>

              {entry.multiplier !== null && (
                <span className={`font-mono text-[11px] font-bold flex-shrink-0 ${
                  isBigWin ? "text-yellow-400" : won ? "text-emerald-400" : "text-zinc-500"
                }`}>
                  {entry.multiplier.toFixed(2)}x
                </span>
              )}

              <span className={`font-mono text-[11px] font-bold ml-auto flex-shrink-0 ${
                won ? "text-[#00C805]" : "text-[#FF5252]"
              }`}>
                {won ? `+$${(entry.payout - entry.bet).toFixed(2)}` : `-$${entry.bet.toFixed(2)}`}
              </span>

              <span className="text-[11px] text-zinc-600 flex-shrink-0 w-6 text-right">
                {timeAgo(entry.createdAt)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
