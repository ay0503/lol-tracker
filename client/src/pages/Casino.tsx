import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { useState } from "react";
import { Trophy, TrendingUp, TrendingDown, Lock, Crown, Medal, Award, Gift, Loader2, ArrowRightLeft, ShoppingBag, Info, Layers, Rocket, CircleDollarSign, CircleDot, Dice5, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import AppNav from "@/components/AppNav";
import CasinoSubNav from "@/components/CasinoSubNav";
import { motion } from "framer-motion";
import { toast } from "sonner";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";
import CasinoGameLog from "@/components/CasinoGameLog";
import StyledName from "@/components/StyledName";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const GAMES: { id: string; title: string; titleKo: string; icon: LucideIcon; desc: string; descKo: string; bet: string; href: string; active: boolean; bg: string; border: string; badge: string }[] = [
  { id: "blackjack", title: "Blackjack", titleKo: "블랙잭", icon: Layers, desc: "Beat the dealer to 21", descKo: "딜러를 이겨라", bet: "$0.10 - $50", href: "/casino/blackjack", active: true, bg: "from-emerald-950/50 to-emerald-900/30", border: "border-emerald-700/40", badge: "from-emerald-500 to-green-600" },
  { id: "crash", title: "Crash", titleKo: "크래시", icon: Rocket, desc: "Cash out before it crashes", descKo: "추락 전에 캐시아웃", bet: "$0.10 - $50", href: "/casino/crash", active: true, bg: "from-orange-950/50 to-red-900/30", border: "border-orange-700/40", badge: "from-orange-500 to-red-600" },
  { id: "roulette", title: "Roulette", titleKo: "룰렛", icon: CircleDollarSign, desc: "Pick a color and spin", descKo: "색을 고르고 스핀", bet: "$0.10 - $50", href: "/casino/roulette", active: true, bg: "from-green-950/50 to-emerald-900/30", border: "border-green-700/40", badge: "from-green-500 to-emerald-600" },
  { id: "mines", title: "Mines", titleKo: "지뢰찾기", icon: CircleDot, desc: "Avoid mines, cash out", descKo: "지뢰를 피해라", bet: "$0.10 - $50", href: "/casino/mines", active: true, bg: "from-red-950/50 to-rose-900/30", border: "border-red-700/40", badge: "from-red-500 to-orange-600" },
  { id: "poker", title: "Video Poker", titleKo: "비디오 포커", icon: Layers, desc: "Draw, hold, and chase a hand", descKo: "카드를 들고 패를 노려라", bet: "$0.10 - $50", href: "/casino/poker", active: true, bg: "from-indigo-950/50 to-blue-900/30", border: "border-indigo-700/40", badge: "from-indigo-500 to-blue-600" },
  { id: "dice", title: "Dice", titleKo: "주사위", icon: Dice5, desc: "Roll over/under", descKo: "높낮이 베팅", bet: "$0.10 - $50", href: "/casino/dice", active: true, bg: "from-cyan-950/50 to-blue-900/30", border: "border-cyan-700/40", badge: "from-cyan-500 to-blue-600" },
  { id: "hilo", title: "Hi-Lo", titleKo: "하이로", icon: Layers, desc: "Higher or lower cards", descKo: "높을까 낮을까", bet: "$0.10 - $50", href: "/casino/hilo", active: true, bg: "from-violet-950/50 to-indigo-900/30", border: "border-violet-700/40", badge: "from-violet-500 to-indigo-600" },
  { id: "plinko", title: "Plinko", titleKo: "플링코", icon: Target, desc: "Drop the ball, hit big", descKo: "공을 떨어뜨려라", bet: "$0.10 - $50", href: "/casino/plinko", active: true, bg: "from-pink-950/50 to-rose-900/30", border: "border-pink-700/40", badge: "from-pink-500 to-rose-600" },
];

const EDGE_DETAILS = [
  {
    id: "blackjack",
    title: "Blackjack",
    titleKo: "블랙잭",
    detail: "Blackjack pays 2:1 on naturals while normal wins stay at 2x.",
    detailKo: "블랙잭은 내추럴에 2:1을 지급하고, 일반 승리는 2배를 유지합니다.",
  },
  {
    id: "crash",
    title: "Crash",
    titleKo: "크래시",
    detail: "The crash curve is slightly softer and cashouts still get the small player-side boost.",
    detailKo: "크래시 곡선이 조금 더 완만하고, 캐시아웃에도 작은 플레이어 우위 보정이 들어갑니다.",
  },
  {
    id: "roulette",
    title: "Roulette",
    titleKo: "룰렛",
    detail: "Red and black pay 2x, and green refunds color bets. Green itself pays 37x.",
    detailKo: "빨강과 검정은 2배를 지급하고, 초록이 나오면 컬러 베팅은 환불됩니다. 초록 적중은 37배입니다.",
  },
  {
    id: "mines",
    title: "Mines",
    titleKo: "지뢰찾기",
    detail: "The normal mines math gets a small player-side multiplier boost.",
    detailKo: "기본 지뢰찾기 배율에 소폭 플레이어 우위 보정이 들어갑니다.",
  },
  {
    id: "poker",
    title: "Video Poker",
    titleKo: "비디오 포커",
    detail: "The table stays classic, but pairs of 10s now qualify instead of only jacks or better.",
    detailKo: "지급표는 클래식 그대로 두고, 잭 이상 대신 10 한 쌍부터 당첨으로 인정됩니다.",
  },
  {
    id: "dice",
    title: "Dice",
    titleKo: "주사위",
    detail: "Dice uses the 101-based multiplier table instead of a house-cut formula.",
    detailKo: "주사위는 하우스 컷 공식 대신 101 기반 배율표를 사용합니다.",
  },
  {
    id: "hilo",
    title: "Hi-Lo",
    titleKo: "하이로",
    detail: "Hi-Lo pays from the real remaining deck odds, then adds a small player-side boost.",
    detailKo: "하이로는 실제 남은 덱 확률로 지급을 계산한 뒤 소폭 플레이어 우위 보정을 더합니다.",
  },
  {
    id: "plinko",
    title: "Plinko",
    titleKo: "플링코",
    detail: "Each risk tier keeps its usual shape, but the bucket values are nudged upward.",
    detailKo: "각 리스크 티어의 형태는 유지하되, 버킷 배율을 전체적으로 조금 올렸습니다.",
  },
];

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-4 h-4 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-4 h-4 text-gray-300" />;
  if (rank === 3) return <Award className="w-4 h-4 text-amber-600" />;
  return <span className="text-xs text-muted-foreground font-mono w-4 text-center">#{rank}</span>;
}

export default function Casino() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [depositAmount, setDepositAmount] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);
  const [showEdgeDialog, setShowEdgeDialog] = useState(false);

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
  const casinoIntro = language === "ko"
    ? "한 판의 운과 코스메틱 자랑을 위한 사이드 퀘스트 공간입니다."
    : "A side quest for hot streaks, silly luck, and cosmetic flexes.";
  const casinoRules = language === "ko"
    ? "카지노 머니는 트레이딩 머니와 완전히 별개이며, 게임과 코스메틱 구매에만 사용할 수 있습니다. 카지노 머니가 부족하면 트레이딩 머니를 1:10 비율로 옮겨 충전할 수 있지만, 챌린지의 무결성을 위해 카지노 머니를 트레이딩 머니로 되돌리는 것은 불가능합니다."
    : "Casino cash is completely separate from trading cash and can only be used for games and cosmetics. If you run low, you can top up casino cash from trading cash at a 1:10 rate, but casino cash cannot be moved back into trading cash so the challenge stays honest.";
  const casinoEdge = language === "ko"
    ? "지금은 모든 카지노 게임이 중립 또는 약한 플레이어 우위로 조정되어 있습니다. 장기적으로 빨아들이는 구조가 아니라, 코스메틱을 위한 보너스 놀이터에 가깝습니다."
    : "Every casino game is now tuned to be neutral or slightly player-favored, so this is a bonus playground for cosmetics instead of a long-run sink.";

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <CasinoSubNav />
      <div className="container py-8 sm:py-8 max-w-5xl mx-auto px-4">
        {/* ─── Hero ─── */}
        <div className="relative mb-8 rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/15 via-amber-500/8 to-yellow-600/15" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, white 0.5px, transparent 0.5px)", backgroundSize: "10px 10px" }} />
          <div className="relative px-5 sm:px-8 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-4 mb-1">
                  <CircleDollarSign className="w-6 h-6 text-yellow-400" />
                  <h1 className="text-xl sm:text-2xl font-bold text-foreground font-[var(--font-heading)]">
                    {language === "ko" ? "$DORI 카지노" : "$DORI Casino"}
                  </h1>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
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
                          : "bg-muted text-muted-foreground cursor-default"
                      }`}
                    >
                      {claimBonus.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                      {canClaim
                        ? (language === "ko" ? "일일 보너스 $20.00 받기" : "Claim Daily $20.00")
                        : (language === "ko" ? "✓ 오늘 보너스 수령 완료" : "✓ Claimed Today")}
                    </motion.button>
                  </div>
                )}
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">
                  {language === "ko" ? "잔고" : "Balance"}
                </p>
                <motion.p key={cash} initial={{ scale: 1.05 }} animate={{ scale: 1 }} className="text-3xl sm:text-4xl font-bold text-foreground font-mono leading-none">
                  ${cash.toFixed(2)}
                </motion.p>
                {isAuthenticated && (
                  <button
                    onClick={() => setShowDeposit(!showDeposit)}
                    className="mt-2 flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 transition-colors font-mono"
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
            className="bg-card border border-border rounded-xl p-4 mb-8 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-yellow-400" />
                <h3 className="text-xs font-bold text-foreground">
                  {language === "ko" ? `트레이딩 → 카지노 입금 (${mult}배)` : `Trading → Casino (${mult}x)`}
                </h3>
              </div>
              <span className="text-xs text-yellow-400/60 font-mono">
                {language === "ko" ? "트레이딩" : "Trading"}: ${tradingCash.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
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
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-secondary text-secondary-foreground border border-border hover:text-foreground"
                  }`}
                >
                  ${amt}→${amt * mult}
                </button>
              ))}
              <button
                onClick={() => setDepositAmount(Math.floor(tradingCash).toString())}
                disabled={tradingCash < 0.5}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  tradingCash < 0.5 ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-secondary text-secondary-foreground border border-border hover:text-foreground"
                }`}
              >
                ALL
              </button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Amount"
                  min={0.5}
                  step={0.5}
                  className="w-full pl-7 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                />
              </div>
              <div className="flex items-center text-xs text-muted-foreground font-mono px-2">→</div>
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

        <div className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.10),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_32%)]" />
          <div className="relative grid gap-4 px-5 py-5 sm:grid-cols-[1.4fr_0.9fr] sm:px-6">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-yellow-300">
                <span>INFO</span>
              </div>
              <h2 className="mb-2 text-lg font-bold text-foreground font-[var(--font-heading)]">
                {language === "ko" ? "카지노 머니는 가볍게, 규칙은 분명하게" : "Casino cash stays playful. The rules do not."}
              </h2>
              <p className="mb-3 max-w-2xl text-sm text-foreground/80">
                {casinoIntro}
              </p>
              <p className="max-w-2xl text-xs leading-6 text-muted-foreground sm:text-sm">
                {casinoRules}
              </p>
              <p className="mt-3 max-w-2xl text-xs leading-6 text-muted-foreground sm:text-sm">
                {casinoEdge}
              </p>
            </div>

            <div className="grid gap-2 self-start">
              <div className="rounded-xl border border-border bg-black/20 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {language === "ko" ? "핵심 규칙" : "Key Rules"}
                </p>
                <p className="mt-1 text-xs text-foreground/80">
                  {language === "ko" ? "트레이딩 → 카지노는 가능, 카지노 → 트레이딩은 불가" : "Trading -> casino is allowed. Casino -> trading is locked."}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-black/20 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {language === "ko" ? "충전 비율" : "Transfer Rate"}
                </p>
                <p className="mt-1 text-xs text-foreground/80">
                  {language === "ko" ? `$1 트레이딩 캐시 = $${mult} 카지노 캐시` : `$1 trading cash = $${mult} casino cash`}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-900/70 bg-emerald-500/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
                    {language === "ko" ? "플레이어 우위" : "Player Edge"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowEdgeDialog(true)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-200 transition-colors hover:border-emerald-300/40 hover:bg-emerald-400/15"
                    aria-label={language === "ko" ? "플레이어 우위 정보 열기" : "Open player edge details"}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-foreground/80">
                  {language === "ko" ? "모든 테이블은 중립 또는 소폭 플레이어 우위입니다." : "Every table is neutral or slightly in the player's favor."}
                </p>
              </div>
              <Link href="/casino/shop">
                <motion.div
                  whileHover={{ scale: 1.015, y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  className="relative flex items-center gap-2 overflow-hidden rounded-xl border border-violet-400/30 bg-gradient-to-r from-violet-600/30 via-fuchsia-500/20 to-indigo-500/30 px-4 py-3 text-sm font-bold text-violet-100 shadow-[0_10px_30px_rgba(124,58,237,0.18)] transition-colors hover:border-violet-300/50"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(216,180,254,0.18),transparent_40%)]" />
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/10">
                    <ShoppingBag className="h-4 w-4" />
                  </span>
                  <span className="relative">
                    {language === "ko" ? "코스메틱 상점 열기" : "Open the Cosmetics Shop"}
                  </span>
                </motion.div>
              </Link>
            </div>
          </div>
        </div>

        {/* ─── Games ─── */}
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          {language === "ko" ? "게임" : "Games"}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {GAMES.map((game, i) => (
            <motion.div key={game.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 26, stiffness: 260, delay: i * 0.08 }}>
              {game.active ? (
                <Link href={game.href}>
                  <div className={`group relative rounded-xl border ${game.border} bg-gradient-to-br ${game.bg} p-4 cursor-pointer hover:border-emerald-600/60 transition-all hover:shadow-lg hover:shadow-emerald-900/20 h-full`}>
                    <div className="flex items-center justify-between mb-2">
                      <game.icon className="w-5 h-5 text-foreground/80" />
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-gradient-to-r ${game.badge} text-foreground`}>LIVE</span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground mb-0.5">{language === "ko" ? game.titleKo : game.title}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{language === "ko" ? game.descKo : game.desc}</p>
                    <p className="text-xs text-muted-foreground font-mono">{game.bet}</p>
                  </div>
                </Link>
              ) : (
                <div className={`rounded-xl border ${game.border} bg-gradient-to-br ${game.bg} p-4 opacity-40 h-full`}>
                  <div className="flex items-center justify-between mb-2">
                    <game.icon className="w-5 h-5 text-muted-foreground" />
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold uppercase bg-secondary text-muted-foreground">
                      <Lock className="w-2 h-2" /> SOON
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-muted-foreground mb-0.5">{language === "ko" ? game.titleKo : game.title}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{language === "ko" ? game.descKo : game.desc}</p>
                  <p className="text-xs text-muted-foreground/60 font-mono">{game.bet}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* ─── Leaderboard ─── */}
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-yellow-400" />
          {language === "ko" ? "카지노 랭킹" : "Casino Rankings"}
        </h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
          {leaderboard && leaderboard.length > 0 ? (
            <div className="divide-y divide-border">
              {leaderboard.slice(0, 10).map((player, i) => {
                const isProfit = player.profit >= 0;
                return (
                  <motion.div
                    key={player.userId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: "spring", damping: 26, stiffness: 260, delay: i * 0.03 }}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
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
                      <span className={`text-xs font-mono flex items-center gap-0.5 ${isProfit ? "text-[color:var(--color-win)]" : "text-[color:var(--color-loss)]"}`}>
                        {isProfit ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {isProfit ? "+" : ""}{player.profit.toFixed(2)}
                      </span>
                      <span className="text-xs font-mono font-bold text-foreground w-14 text-right">${player.casinoBalance.toFixed(2)}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Trophy className="w-8 h-8 text-muted-foreground/60 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{language === "ko" ? "플레이하여 랭킹에 올라보세요" : "Play to appear on the rankings"}</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground/60 font-mono">
          {language === "ko" ? "가상 캐시 · 실제 돈 아님" : "Virtual cash · Not real money"}
        </p>

        <CasinoGameLog />
        <GamblingDisclaimer />

        <Dialog open={showEdgeDialog} onOpenChange={setShowEdgeDialog}>
          <DialogContent className="border-border bg-background text-foreground sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-[var(--font-heading)] text-foreground">
                {language === "ko" ? "카지노 플레이어 우위 안내" : "Casino Player Edge Details"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {language === "ko"
                  ? "각 게임이 왜 중립 또는 플레이어 우위인지 한눈에 볼 수 있습니다."
                  : "A quick breakdown of how each game was tuned to be neutral or player-favored."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              {EDGE_DETAILS.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-sm font-semibold text-foreground">
                    {language === "ko" ? entry.titleKo : entry.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {language === "ko" ? entry.detailKo : entry.detail}
                  </p>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
