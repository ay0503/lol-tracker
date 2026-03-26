import { Link, useLocation } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";

const CASINO_GAMES = [
  { href: "/casino", label: "Lobby", labelKo: "로비", emoji: "🎰", exact: true },
  { href: "/casino/blackjack", label: "Blackjack", labelKo: "블랙잭", emoji: "🃏" },
  { href: "/casino/crash", label: "Crash", labelKo: "크래시", emoji: "🚀" },
  { href: "/casino/roulette", label: "Roulette", labelKo: "룰렛", emoji: "🎡" },
  { href: "/casino/mines", label: "Mines", labelKo: "지뢰", emoji: "💣" },
  { href: "/casino/poker", label: "Poker", labelKo: "포커", emoji: "🃑" },
  { href: "/casino/shop", label: "Shop", labelKo: "상점", emoji: "🛍️" },
];

export default function CasinoSubNav() {
  const [location] = useLocation();
  const { language } = useTranslation();

  return (
    <div className="sticky top-14 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
      <div className="container">
        <div className="flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-hide">
          {CASINO_GAMES.map((game) => {
            const isActive = game.exact ? location === game.href : location === game.href;
            return (
              <Link
                key={game.href}
                href={game.href}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-yellow-500/15 text-yellow-400"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                }`}
              >
                <span className="text-xs">{game.emoji}</span>
                {language === "ko" ? game.labelKo : game.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
