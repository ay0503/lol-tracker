import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, Lock, Crown, Medal, Award } from "lucide-react";
import { motion } from "framer-motion";

const GAMES = [
  { id: "blackjack", title: "Blackjack", titleKo: "블랙잭", emoji: "🃏", description: "Beat the dealer to 21. Hit, stand, or double down.", descriptionKo: "딜러를 이겨 21에 가까워지세요.", minBet: "$0.10", maxBet: "$5.00", href: "/casino/blackjack", active: true, color: "from-emerald-500 to-green-600", bgGradient: "from-emerald-950/40 to-emerald-900/20" },
  { id: "coinflip", title: "Coin Flip", titleKo: "코인 플립", emoji: "🪙", description: "Heads or tails. Simple 50/50 odds.", descriptionKo: "앞면 또는 뒷면. 간단한 50/50.", minBet: "$0.10", maxBet: "$5.00", href: "#", active: false, color: "from-yellow-500 to-amber-600", bgGradient: "from-yellow-950/30 to-amber-900/15" },
  { id: "dice", title: "Dice Roll", titleKo: "주사위", emoji: "🎲", description: "Roll the dice. Over/under betting.", descriptionKo: "주사위를 굴려 높낮이에 베팅하세요.", minBet: "$0.10", maxBet: "$5.00", href: "#", active: false, color: "from-purple-500 to-violet-600", bgGradient: "from-purple-950/30 to-violet-900/15" },
  { id: "mines", title: "Mines", titleKo: "지뢰찾기", emoji: "💣", description: "Avoid the mines. Cash out anytime.", descriptionKo: "지뢰를 피하고 언제든 캐시아웃.", minBet: "$0.10", maxBet: "$5.00", href: "#", active: false, color: "from-red-500 to-rose-600", bgGradient: "from-red-950/30 to-rose-900/15" },
];

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="w-4 h-4 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-4 h-4 text-gray-300" />;
  if (rank === 3) return <Award className="w-4 h-4 text-amber-600" />;
  return <span className="text-[10px] text-zinc-500 font-mono w-4 text-center">#{rank}</span>;
}

export default function Casino() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { data: casinoBalance } = trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: leaderboard } = trpc.casino.leaderboard.useQuery();
  const balance = casinoBalance ?? 20;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <div className="container py-6 sm:py-8 max-w-5xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> $DORI
        </Link>

        {/* Hero */}
        <div className="relative mb-8 rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-600/20 via-amber-500/10 to-yellow-600/20" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, white 0.5px, transparent 0.5px)", backgroundSize: "10px 10px" }} />
          <div className="relative px-6 sm:px-8 py-8 sm:py-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">🎰</span>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white font-[var(--font-heading)]">
                    {language === "ko" ? "$DORI 카지노" : "$DORI Casino"}
                  </h1>
                </div>
                <p className="text-sm text-zinc-400">
                  {language === "ko" ? "가상 캐시로 카지노 게임을 즐기세요" : "Play casino games with your virtual cash"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">
                  {language === "ko" ? "카지노 잔고" : "Casino Balance"}
                </p>
                <motion.p key={balance} initial={{ scale: 1.1 }} animate={{ scale: 1 }} className="text-3xl sm:text-4xl font-bold text-white font-mono">
                  ${balance.toFixed(2)}
                </motion.p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Games */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">
              {language === "ko" ? "게임" : "Games"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GAMES.map((game, i) => (
                <motion.div key={game.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  {game.active ? (
                    <Link href={game.href}>
                      <div className={`group relative rounded-xl border border-zinc-700/50 bg-gradient-to-br ${game.bgGradient} p-5 cursor-pointer hover:border-zinc-600 transition-all hover:shadow-lg hover:shadow-black/20`}>
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-3xl">{game.emoji}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r ${game.color} text-white`}>LIVE</span>
                        </div>
                        <h3 className="text-base font-bold text-white mb-1">{language === "ko" ? game.titleKo : game.title}</h3>
                        <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{language === "ko" ? game.descriptionKo : game.description}</p>
                        <div className="text-[10px] text-zinc-500 font-mono">{game.minBet} – {game.maxBet}</div>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 text-lg">→</div>
                      </div>
                    </Link>
                  ) : (
                    <div className={`rounded-xl border border-zinc-800/50 bg-gradient-to-br ${game.bgGradient} p-5 opacity-50`}>
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-3xl grayscale">{game.emoji}</span>
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-500"><Lock className="w-2.5 h-2.5" /> SOON</span>
                      </div>
                      <h3 className="text-base font-bold text-zinc-400 mb-1">{language === "ko" ? game.titleKo : game.title}</h3>
                      <p className="text-xs text-zinc-600 mb-3 leading-relaxed">{language === "ko" ? game.descriptionKo : game.description}</p>
                      <div className="text-[10px] text-zinc-600 font-mono">{game.minBet} – {game.maxBet}</div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Leaderboard Sidebar */}
          <div>
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              {language === "ko" ? "카지노 랭킹" : "Casino Rankings"}
            </h2>
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden">
              {leaderboard && leaderboard.length > 0 ? (
                <div className="divide-y divide-zinc-800/50">
                  {leaderboard.slice(0, 15).map((player, i) => {
                    const isProfit = player.profit >= 0;
                    return (
                      <motion.div key={player.userId} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/30 transition-colors">
                        <div className="flex items-center gap-2.5">
                          {getRankIcon(i + 1)}
                          <span className="text-xs text-zinc-300 font-medium truncate max-w-[100px]">{player.userName}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className={`text-[10px] font-mono flex items-center gap-0.5 ${isProfit ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                            {isProfit ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                            {isProfit ? "+" : ""}{player.profit.toFixed(2)}
                          </span>
                          <span className="text-xs font-mono font-bold text-white min-w-[3.5rem] text-right">${player.casinoBalance.toFixed(2)}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Trophy className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-zinc-600">{language === "ko" ? "아직 플레이어가 없습니다" : "No players yet"}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-zinc-700 font-mono">
            {language === "ko" ? "모든 게임은 가상 캐시로 진행됩니다. 실제 돈이 아닙니다." : "All games use virtual cash. No real money involved."}
          </p>
        </div>
      </div>
    </div>
  );
}
