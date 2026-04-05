import { Link, useLocation } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";

const CASINO_GAMES = [
  { href: "/casino", label: "Lobby", labelKo: "로비", emoji: "🎰", exact: true },
  { href: "/casino/blackjack", label: "BJ", labelKo: "블랙잭", emoji: "🃏" },
  { href: "/casino/crash", label: "Crash", labelKo: "크래시", emoji: "🚀" },
  { href: "/casino/roulette", label: "Roulette", labelKo: "룰렛", emoji: "🎡" },
  { href: "/casino/mines", label: "Mines", labelKo: "지뢰", emoji: "💣" },
  { href: "/casino/poker", label: "Poker", labelKo: "포커", emoji: "🃑" },
  { href: "/casino/dice", label: "Dice", labelKo: "주사위", emoji: "🎲" },
  { href: "/casino/hilo", label: "Hi-Lo", labelKo: "하이로", emoji: "🃏" },
  { href: "/casino/plinko", label: "Plinko", labelKo: "플링코", emoji: "📌" },
  { href: "/casino/shop", label: "Shop", labelKo: "상점", emoji: "🛍️" },
];

export default function CasinoSubNav() {
  const [location] = useLocation();
  const { language } = useTranslation();

  return (
    <div className="sticky top-14 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="container relative">
        {/* Edge fade indicators for scroll */}
        <div className="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none sm:hidden" />
        <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none sm:hidden" />

        <div className="flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-hide px-1">
          {CASINO_GAMES.map((game) => {
            const isActive = game.exact ? location === game.href : location === game.href;
            return (
              <Link
                key={game.href}
                href={game.href}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs sm:text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  isActive
                    ? "bg-yellow-500/15 text-yellow-400"
                    : "text-muted-foreground hover:text-foreground/80 hover:bg-secondary/50"
                }`}
              >
                <span className="text-xs sm:text-xs">{game.emoji}</span>
                <span className="hidden sm:inline">{language === "ko" ? game.labelKo : game.label}</span>
                <span className="sm:hidden">{language === "ko" ? game.labelKo : game.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
