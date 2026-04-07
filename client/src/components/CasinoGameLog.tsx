import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import StyledName from "./StyledName";
import type { LucideIcon } from "lucide-react";
import { Layers, TrendingUp, CircleDot, CircleDollarSign, Dice5, Target, Gamepad2 } from "lucide-react";

const GAME_ICONS: Record<string, LucideIcon> = {
  blackjack: Layers,
  crash: TrendingUp,
  mines: CircleDot,
  roulette: CircleDollarSign,
  dice: Dice5,
  hilo: Layers,
  plinko: Target,
  poker: Layers,
};

const GAME_LABELS: Record<string, { en: string; ko: string }> = {
  blackjack: { en: "Blackjack", ko: "블랙잭" },
  crash: { en: "Crash", ko: "크래시" },
  mines: { en: "Mines", ko: "지뢰찾기" },
  roulette: { en: "Roulette", ko: "룰렛" },
  dice: { en: "Dice", ko: "주사위" },
  hilo: { en: "Hi-Lo", ko: "하이로" },
  plinko: { en: "Plinko", ko: "플링코" },
  poker: { en: "Poker", ko: "포커" },
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
    <div className="bg-card border border-border/60 rounded-xl p-3 mt-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
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
                  : "hover:bg-secondary/40"
              }`}
            >
              <span className="text-sm flex-shrink-0" title={(GAME_LABELS[entry.game] || { en: entry.game, ko: entry.game })[language === "ko" ? "ko" : "en"]}>
                {(() => { const Icon = GAME_ICONS[entry.game] || Gamepad2; return <Icon className="w-3.5 h-3.5" />; })()}
              </span>

              <span className="font-bold text-foreground truncate min-w-0 max-w-[100px]">
                <StyledName
                  name={entry.userName}
                  nameEffectCss={entry.nameEffectCss}
                  showTitle={false}
                />
              </span>

              <span className="text-muted-foreground text-xs flex-shrink-0">
                {(GAME_LABELS[entry.game] || { en: entry.game, ko: entry.game })[language === "ko" ? "ko" : "en"]}
              </span>

              <span className="text-muted-foreground font-mono text-xs flex-shrink-0">
                ${entry.bet.toFixed(2)}
              </span>

              <span className="text-muted-foreground/60 flex-shrink-0">&rarr;</span>

              {entry.multiplier !== null && (
                <span className={`font-mono text-xs font-bold flex-shrink-0 ${
                  isBigWin ? "text-yellow-400" : won ? "text-emerald-400" : "text-muted-foreground"
                }`}>
                  {entry.multiplier.toFixed(2)}x
                </span>
              )}

              <span className={`font-mono text-xs font-bold ml-auto flex-shrink-0 ${
                won ? "text-[color:var(--color-win)]" : "text-[color:var(--color-loss)]"
              }`}>
                {won ? `+$${(entry.payout - entry.bet).toFixed(2)}` : `-$${entry.bet.toFixed(2)}`}
              </span>

              <span className="text-xs text-muted-foreground/60 flex-shrink-0 w-6 text-right">
                {timeAgo(entry.createdAt)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
