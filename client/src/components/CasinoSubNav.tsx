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
    <div className="sticky top-[60px] z-40 px-4 pt-1">
      <div
        className="mx-auto max-w-[1200px] -mt-1 rounded-b-2xl bg-card/40 backdrop-blur-2xl backdrop-saturate-[1.6]"
        style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)', borderLeft: '0.5px solid rgba(255,255,255,0.06)', borderRight: '0.5px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
      >
        <div className="flex items-center justify-center gap-1 overflow-x-auto py-1.5 scrollbar-hide px-3">
          {CASINO_GAMES.map((game) => {
            const isActive = location === game.href;
            return (
              <Link
                key={game.href}
                href={game.href}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  isActive
                    ? "bg-yellow-500/15 text-yellow-400"
                    : "text-muted-foreground hover:text-foreground/80 hover:bg-secondary/50"
                }`}
              >
                <game.icon className="w-3 h-3" />
                {language === "ko" ? game.labelKo : game.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
