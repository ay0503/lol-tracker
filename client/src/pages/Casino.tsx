import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { useState } from "react";
import { Trophy, TrendingUp, TrendingDown, Lock, Crown, Medal, Award, Gift, Loader2, ArrowRightLeft, ShoppingBag } from "lucide-react";
import AppNav from "@/components/AppNav";
import CasinoSubNav from "@/components/CasinoSubNav";
import { motion } from "framer-motion";
import { toast } from "sonner";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";
import StyledName from "@/components/StyledName";

const GAMES = [
  { id: "blackjack", title: "Blackjack", titleKo: "블랙잭", emoji: "🃏", desc: "Beat the dealer to 21", descKo: "딜러를 이겨라", bet: "$0.10 – $5", href: "/casino/blackjack", active: true, bg: "from-emerald-950/50 to-emerald-900/30", border: "border-emerald-700/40", badge: "from-emerald-500 to-green-600" },
  { id: "crash", title: "Crash", titleKo: "크래시", emoji: "🚀", desc: "Cash out before it crashes", descKo: "추락 전에 캐시아웃", bet: "$0.10 – $5", href: "/casino/crash", active: true, bg: "from-orange-950/50 to-red-900/30", border: "border-orange-700/40", badge: "from-orange-500 to-red-600" },
  { id: "roulette", title: "Roulette", titleKo: "룰렛", emoji: "🎡", desc: "European wheel, 2.7% edge", descKo: "유럽식 룰렛", bet: "$0.10 – $5", href: "/casino/roulette", active: true, bg: "from-green-950/50 to-emerald-900/30", border: "border-green-700/40", badge: "from-green-500 to-emerald-600" },
  { id: "mines", title: "Mines", titleKo: "지뢰찾기", emoji: "💣", desc: "Avoid mines, cash out", descKo: "지뢰를 피해라", bet: "$0.10 – $5", href: "/casino/mines", active: true, bg: "from-red-950/50 to-rose-900/30", border: "border-red-700/40", badge: "from-red-500 to-orange-600" },
  { id: "poker", title: "Video Poker", titleKo: "비디오 포커", emoji: "🃑", desc: "Jacks or Better", descKo: "잭스 오어 베터", bet: "$0.10 – $5", href: "/casino/poker", active: true, bg: "from-indigo-950/50 to-blue-900/30", border: "border-indigo-700/40", badge: "from-indigo-500 to-blue-600" },
  { id: "dice", title: "Dice", titleKo: "주사위", emoji: "🎲", desc: "Roll over/under", descKo: "높낮이 베팅", bet: "$0.10 – $5", href: "/casino/dice", active: true, bg: "from-cyan-950/50 to-blue-900/30", border: "border-cyan-700/40", badge: "from-cyan-500 to-blue-600" },
  { id: "limbo", title: "Limbo", titleKo: "림보", emoji: "📈", desc: "Set target, beat the crash", descKo: "목표를 넘겨라", bet: "$0.10 – $5", href: "/casino/limbo", active: true, bg: "from-violet-950/50 to-purple-900/30", border: "border-violet-700/40", badge: "from-violet-500 to-purple-600" },
  { id: "hilo", title: "Hi-Lo", titleKo: "하이로", emoji: "🃏", desc: "Higher or lower cards", descKo: "높을까 낮을까", bet: "$0.10 – $5", href: "/casino/hilo", active: true, bg: "from-violet-950/50 to-indigo-900/30", border: "border-violet-700/40", badge: "from-violet-500 to-indigo-600" },
  { id: "wheel", title: "Wheel", titleKo: "휠", emoji: "🎡", desc: "Spin for multipliers", descKo: "배율을 돌려라", bet: "$0.10 – $5", href: "/casino/wheel", active: true, bg: "from-yellow-950/50 to-orange-900/30", border: "border-yellow-700/40", badge: "from-yellow-500 to-orange-600" },
  { id: "plinko", title: "Plinko", titleKo: "플링코", emoji: "📌", desc: "Drop the ball, hit big", descKo: "공을 떨어뜨려라", bet: "$0.10 – $5", href: "/casino/plinko", active: true, bg: "from-pink-950/50 to-rose-900/30", border: "border-pink-700/40", badge: "from-pink-500 to-rose-600" },
];

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-4 h-4 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-4 h-4 text-gray-300" />;
  if (rank === 3) return <Award className="w-4 h-4 text-amber-600" />;
  return <span className="text-[10px] text-zinc-500 font-mono w-4 text-center">#{rank}</span>;
}

export default function Casino() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [depositAmount, setDepositAmount] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);

  const { data: balance } = trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: portfolio } = trpc.trading.portfolio.useQuery(undefined, { enabled: isAuthenticated });
  const { data: leaderboard } = trpc.casino.leaderboard.useQuery();
  const { data: bonusStatus } = trpc.casino.dailyBonusStatus.useQuery(undefined, { enabled: isAuthenticated });
  const { data: multiplierData } = trpc.casino.depositMultiplier.useQuery(undefined, { staleTime: 60_000 });
  const mult = multiplierData?.multiplier ?? 10;

  const claimBonus = trpc.casino.dailyBonus.useMutation({
    onSuccess: (data) => {
      toast.success(`+$${data.bonus.toFixed(2)} claimed!`);
      utils.casino.blackjack.balance.invalidate();
      utils.casino.dailyBonusStatus.invalidate();
      utils.casino.leaderboard.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const depositMutation = trpc.casino.deposit.useMutation({
    onSuccess: (data) => {
      toast.success(`$${data.deposited.toFixed(2)} → $${data.received.toFixed(0)} casino cash (${mult}x)`);
      setDepositAmount("");
      setShowDeposit(false);
      utils.casino.blackjack.balance.invalidate();
      utils.trading.portfolio.invalidate();
      utils.casino.leaderboard.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const cash = balance ?? 20;
  const tradingCash = portfolio?.cashBalance ?? 0;
  const canClaim = isAuthenticated && !bonusStatus?.claimed;

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      <AppNav />
      <CasinoSubNav />
      <div className="container py-6 sm:py-8 max-w-5xl mx-auto px-4">
        {/* ─── Hero ─── */}
        <div className="relative mb-6 rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/15 via-amber-500/8 to-yellow-600/15" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, white 0.5px, transparent 0.5px)", backgroundSize: "10px 10px" }} />
          <div className="relative px-5 sm:px-8 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="text-2xl">🎰</span>
                  <h1 className="text-xl sm:text-2xl font-bold text-white font-[var(--font-heading)]">
                    {language === "ko" ? "$DORI 카지노" : "$DORI Casino"}
                  </h1>
                </div>
                <p className="text-xs text-zinc-400 mb-3">
                  {language === "ko" ? "가상 캐시로 카지노 게임을 즐기세요" : "Play casino games with your virtual cash"}
                </p>
                {/* Daily Bonus + Shop */}
                {isAuthenticated && (
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={canClaim ? { scale: 1.02 } : {}}
                      whileTap={canClaim ? { scale: 0.98 } : {}}
                      onClick={() => canClaim && claimBonus.mutate()}
                      disabled={!canClaim || claimBonus.isPending}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        canClaim
                          ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-lg shadow-yellow-500/20 hover:from-yellow-400 hover:to-amber-400"
                          : "bg-zinc-800 text-zinc-500 cursor-default"
                      }`}
                    >
                      {claimBonus.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                      {canClaim
                        ? (language === "ko" ? "일일 보너스 $1.00 받기" : "Claim Daily $1.00")
                        : (language === "ko" ? "✓ 오늘 보너스 수령 완료" : "✓ Claimed Today")}
                    </motion.button>
                  </div>
                )}
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-0.5">
                  {language === "ko" ? "잔고" : "Balance"}
                </p>
                <motion.p key={cash} initial={{ scale: 1.05 }} animate={{ scale: 1 }} className="text-3xl sm:text-4xl font-bold text-white font-mono leading-none">
                  ${cash.toFixed(2)}
                </motion.p>
                {isAuthenticated && (
                  <button
                    onClick={() => setShowDeposit(!showDeposit)}
                    className="mt-2 flex items-center gap-1 text-[10px] text-yellow-400 hover:text-yellow-300 transition-colors font-mono"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    {language === "ko" ? "입금하기" : "Deposit from trading"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Deposit Panel ─── */}
        {showDeposit && isAuthenticated && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-zinc-900/80 border border-zinc-700/50 rounded-xl p-4 mb-6 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-yellow-400" />
                <h3 className="text-xs font-bold text-white">
                  {language === "ko" ? `트레이딩 → 카지노 입금 (${mult}배)` : `Trading → Casino (${mult}x)`}
                </h3>
              </div>
              <span className="text-[10px] text-yellow-400/60 font-mono">
                {language === "ko" ? "트레이딩" : "Trading"}: ${tradingCash.toFixed(2)}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 mb-3">
              {language === "ko"
                ? `$1 트레이딩 캐시 = $${mult} 카지노 캐시`
                : `$1 trading cash = $${mult} casino cash`}
            </p>
            <div className="flex gap-1.5 mb-2">
              {[1, 2, 5, 10].map(amt => (
                <button
                  key={amt}
                  onClick={() => setDepositAmount(String(amt))}
                  disabled={tradingCash < amt}
                  className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all ${
                    parseFloat(depositAmount) === amt
                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
                      : tradingCash < amt
                        ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
                        : "bg-zinc-800 text-zinc-300 border border-zinc-700/50 hover:text-white"
                  }`}
                >
                  ${amt}→${amt * mult}
                </button>
              ))}
              <button
                onClick={() => setDepositAmount(Math.floor(tradingCash).toString())}
                disabled={tradingCash < 0.5}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  tradingCash < 0.5 ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed" : "bg-zinc-800 text-zinc-300 border border-zinc-700/50 hover:text-white"
                }`}
              >
                ALL
              </button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Amount"
                  min={0.5}
                  step={0.5}
                  className="w-full pl-7 pr-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700/50 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                />
              </div>
              <div className="flex items-center text-xs text-zinc-500 font-mono px-2">→</div>
              <div className="flex items-center text-sm font-mono font-bold text-yellow-400 min-w-[4rem]">
                ${((parseFloat(depositAmount) || 0) * mult).toFixed(0)}
              </div>
              <button
                onClick={() => {
                  const amt = parseFloat(depositAmount);
                  if (isNaN(amt) || amt < 0.5) return toast.error("Min $0.50");
                  if (amt > tradingCash) return toast.error(`Max $${tradingCash.toFixed(2)}`);
                  depositMutation.mutate({ amount: amt });
                }}
                disabled={!depositAmount || depositMutation.isPending}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs font-bold disabled:opacity-30 transition-colors"
              >
                {depositMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                  language === "ko" ? "입금" : "Deposit"}
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── Games ─── */}
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
          {language === "ko" ? "게임" : "Games"}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-8">
          {GAMES.map((game, i) => (
            <motion.div key={game.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              {game.active ? (
                <Link href={game.href}>
                  <div className={`group relative rounded-xl border ${game.border} bg-gradient-to-br ${game.bg} p-4 cursor-pointer hover:border-emerald-600/60 transition-all hover:shadow-lg hover:shadow-emerald-900/20 h-full`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{game.emoji}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-gradient-to-r ${game.badge} text-white`}>LIVE</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-0.5">{language === "ko" ? game.titleKo : game.title}</h3>
                    <p className="text-[10px] text-zinc-400 mb-2">{language === "ko" ? game.descKo : game.desc}</p>
                    <p className="text-[9px] text-zinc-500 font-mono">{game.bet}</p>
                  </div>
                </Link>
              ) : (
                <div className={`rounded-xl border ${game.border} bg-gradient-to-br ${game.bg} p-4 opacity-40 h-full`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl grayscale">{game.emoji}</span>
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-zinc-800 text-zinc-500">
                      <Lock className="w-2 h-2" /> SOON
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-zinc-500 mb-0.5">{language === "ko" ? game.titleKo : game.title}</h3>
                  <p className="text-[10px] text-zinc-600 mb-2">{language === "ko" ? game.descKo : game.desc}</p>
                  <p className="text-[9px] text-zinc-700 font-mono">{game.bet}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* ─── Leaderboard ─── */}
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-yellow-400" />
          {language === "ko" ? "카지노 랭킹" : "Casino Rankings"}
        </h2>
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden mb-8">
          {leaderboard && leaderboard.length > 0 ? (
            <div className="divide-y divide-zinc-800/40">
              {leaderboard.slice(0, 10).map((player, i) => {
                const isProfit = player.profit >= 0;
                return (
                  <motion.div
                    key={player.userId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/20 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <RankIcon rank={i + 1} />
                      <StyledName
                        name={player.userName}
                        nameEffectCss={(player as any).nameEffect?.cssClass}
                        titleName={(player as any).title?.name}
                        titleCss={(player as any).title?.cssClass}
                        className="text-xs truncate"
                      />
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[10px] font-mono flex items-center gap-0.5 ${isProfit ? "text-[#00C805]" : "text-[#FF5252]"}`}>
                        {isProfit ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {isProfit ? "+" : ""}{player.profit.toFixed(2)}
                      </span>
                      <span className="text-xs font-mono font-bold text-white w-14 text-right">${player.casinoBalance.toFixed(2)}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Trophy className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-xs text-zinc-600">{language === "ko" ? "플레이하여 랭킹에 올라보세요" : "Play to appear on the rankings"}</p>
            </div>
          )}
        </div>

        <p className="text-center text-[9px] text-zinc-700 font-mono">
          {language === "ko" ? "가상 캐시 · 실제 돈 아님" : "Virtual cash · Not real money"}
        </p>

        <GamblingDisclaimer />
      </div>
    </div>
  );
}
