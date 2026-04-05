import { Link, useLocation } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
import type { LucideIcon } from "lucide-react";
import { CircleDollarSign, Layers, Rocket, CircleDot, Dice5, ShoppingBag, Target } from "lucide-react";

const CASINO_GAMES: { href: string; label: string; labelKo: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/casino", label: "Lobby", labelKo: "로비", icon: CircleDollarSign, exact: true },
  { href: "/casino/blackjack", label: "BJ", labelKo: "블랙잭", icon: Layers },
  { href: "/casino/crash", label: "Crash", labelKo: "크래시", icon: Rocket },
  { href: "/casino/roulette", label: "Roulette", labelKo: "룰렛", icon: CircleDollarSign },
  { href: "/casino/mines", label: "Mines", labelKo: "지뢰", icon: CircleDot },
  { href: "/casino/poker", label: "Poker", labelKo: "포커", icon: Layers },
  { href: "/casino/dice", label: "Dice", labelKo: "주사위", icon: Dice5 },
  { href: "/casino/hilo", label: "Hi-Lo", labelKo: "하이로", icon: Layers },
  { href: "/casino/plinko", label: "Plinko", labelKo: "플링코", icon: Target },
  { href: "/casino/shop", label: "Shop", labelKo: "상점", icon: ShoppingBag },
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
                <game.icon className="w-3.5 h-3.5" />
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
