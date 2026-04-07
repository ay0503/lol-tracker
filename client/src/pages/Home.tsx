/*
 * $DORI LP Tracker — Main page with Robinhood-style fintech UI.
 * Navigation to Ledger and Portfolio pages.
 * All stat components now wired to live backend data with static fallbacks.
 * Full i18n support (EN/KR).
 */
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "@/contexts/LanguageContext";
import type { Language } from "@/contexts/LanguageContext";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import PlayerHeader from "@/components/PlayerHeader";
import StreakBar from "@/components/StreakBar";
import ChampionCard from "@/components/ChampionCard";
import type { ChampionStatData } from "@/components/ChampionCard";
import MatchRow from "@/components/MatchRow";
import RecentPerformance from "@/components/RecentPerformance";
import SeasonHistory from "@/components/SeasonHistory";
import NotificationBell from "@/components/NotificationBell";
import { type MatchResult } from "@/lib/playerData";
import { translateRank, formatDuration, formatTimeAgo, formatMatchResult } from "@/lib/formatters";
import { getChampionName } from "@/lib/championKo";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Swords,
  History,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  LogIn,
  LogOut,
  User,
  BookOpen,
  Wallet,
  Pencil,
  Check,
  X,
  Newspaper,
  MessageCircle,
  Crown,
  Clock,
  Activity,
  Moon,
  Sun,
  Globe,
  Gamepad2,
  AlertTriangle,
  Menu,
  Lock,
} from "lucide-react";
import { Link } from "wouter";

const HERO_BG = "/assets/hero-bg.webp";

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  isLive,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  isLive?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-4 mb-4">
      <div className="p-1.5 rounded-lg bg-secondary">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-foreground font-[var(--font-heading)]">
            {title}
          </h2>
          {isLive && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary">
              <Activity className="w-2.5 h-2.5" />
              {t.common.live}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subValue,
  color,
  isLive,
}: {
  label: string;
  value: string;
  subValue?: string;
  color?: string;
  isLive?: boolean;
}) {
  return (
    <div
      className="bg-card border border-border rounded-2xl p-4 sm:p-5 group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      style={{ borderLeft: color ? `3px solid ${color}` : undefined }}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        {isLive && (
          <span className="flex items-center gap-0.5 text-xs font-semibold text-primary">
            <Activity className="w-2 h-2" />
          </span>
        )}
      </div>
      <p
        className="text-lg sm:text-2xl font-bold font-[var(--font-mono)] truncate"
        style={{ color: color || undefined }}
      >
        {value}
      </p>
      {subValue && (
        <p className="text-xs sm:text-xs text-muted-foreground mt-0.5 truncate">{subValue}</p>
      )}
    </div>
  );
}


/**
 * Live game alert banner — shows when the tracked player is in an active game.
 */
function LiveSentimentFeed() {
  const { isAuthenticated } = useAuth();
  const { language } = useTranslation();
  const [message, setMessage] = useState("");
  const [sentiment, setSentiment] = useState<"bullish" | "bearish" | "neutral">("neutral");

  const commentsQuery = trpc.comments.list.useQuery({ limit: 10 }, {
    refetchInterval: 8_000,
  });
  const postMutation = trpc.comments.post.useMutation({
    onSuccess: () => {
      setMessage("");
      commentsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const comments = commentsQuery.data ?? [];

  return (
    <div className="mt-3 pt-3 border-t border-primary/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{language === "ko" ? "실시간 채팅" : "Live Chat"}</span>
        <div className="flex gap-1">
          {(["bullish", "neutral", "bearish"] as const).map(sm => (
            <button
              key={sm}
              onClick={() => setSentiment(sm)}
              className={`text-xs px-1.5 py-0.5 rounded transition-all ${
                sentiment === sm
                  ? sm === "bullish" ? "bg-green-500/20 text-green-400"
                  : sm === "bearish" ? "bg-red-500/20 text-red-400"
                  : "bg-muted text-foreground/80"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              }`}
            >
              {sm === "bullish" ? <TrendingUp className="w-3 h-3" /> : sm === "bearish" ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            </button>
          ))}
        </div>
      </div>

      {/* Comment list */}
      <div className="space-y-1 max-h-[120px] overflow-y-auto scrollbar-hide mb-2">
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 text-center py-2">{language === "ko" ? "아직 댓글이 없습니다 — 첫 번째로 작성하세요!" : "No comments yet — be the first!"}</p>
        ) : comments.map(cm => (
          <div key={cm.id} className="flex items-start gap-1.5 text-xs">
            <span className={`flex-shrink-0 ${
              cm.sentiment === "bullish" ? "text-green-400" : cm.sentiment === "bearish" ? "text-red-400" : "text-muted-foreground"
            }`}>
              {cm.sentiment === "bullish" ? <TrendingUp className="w-3 h-3" /> : cm.sentiment === "bearish" ? <TrendingDown className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
            </span>
            <span className="font-bold text-foreground/80 flex-shrink-0">{cm.userName}</span>
            <span className="text-muted-foreground break-all">{cm.content}</span>
          </div>
        ))}
      </div>

      {/* Input */}
      {isAuthenticated && (
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!message.trim()) return;
            postMutation.mutate({ content: message.trim(), ticker: "DORI", sentiment });
          }}
          className="flex gap-1.5"
        >
          <input
            type="text"
            value={message}
            onChange={ev => setMessage(ev.target.value)}
            placeholder={language === "ko" ? "한마디 남기기..." : "Say something..."}
            maxLength={200}
            className="flex-1 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <button
            type="submit"
            disabled={!message.trim() || postMutation.isPending}
            className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-bold disabled:opacity-30 hover:bg-primary/30 transition-colors"
          >
            {language === "ko" ? "전송" : "Send"}
          </button>
        </form>
      )}
    </div>
  );
}

function LiveBettingPanel() {
  const { isAuthenticated } = useAuth();
  const { t, language } = useTranslation();
  const [betAmount, setBetAmount] = useState(5);

  const statusQuery = trpc.betting.status.useQuery(undefined, {
    refetchInterval: 5_000,
  });
  const placeBetMutation = trpc.betting.place.useMutation({
    onSuccess: () => {
      toast.success(language === "ko" ? "베팅 완료!" : "Bet placed!");
      statusQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const status = statusQuery.data;
  if (!status) return null;

  const bettingOpen = status.open;
  const timeLeft = status.secondsLeft;
  const timeStr = timeLeft !== null ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, "0")}` : null;

  return (
    <div className="mt-3 pt-3 border-t border-primary/10">
      {/* Sentiment bar */}
      {status.totalBets > 0 && (
        <div className="mb-2.5">
          <div className="flex justify-between text-xs font-bold mb-1">
            <span className="text-green-400">WIN {status.winPct}%</span>
            <span className="text-xs text-muted-foreground">{status.totalBets} {language === "ko" ? "베팅" : (status.totalBets !== 1 ? "bets" : "bet")} · ${status.totalPool.toFixed(0)} {language === "ko" ? "풀" : "pool"}</span>
            <span className="text-red-400">{status.lossPct}% LOSS</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden flex">
            <div className="bg-green-500 transition-all duration-500" style={{ width: `${status.winPct}%` }} />
            <div className="bg-red-500 transition-all duration-500" style={{ width: `${status.lossPct}%` }} />
          </div>
        </div>
      )}

      {bettingOpen ? (
        <div className="flex items-center gap-2">
          {/* Amount selector */}
          <div className="flex gap-1">
            {[1, 5, 10, 25].map(amt => (
              <button
                key={amt}
                onClick={() => setBetAmount(amt)}
                className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                  betAmount === amt
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "bg-secondary text-muted-foreground hover:text-foreground/80"
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>

          {/* Win/Loss buttons */}
          <button
            onClick={() => isAuthenticated && placeBetMutation.mutate({ prediction: "win", amount: betAmount })}
            disabled={!isAuthenticated || placeBetMutation.isPending}
            className="flex-1 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-30 text-foreground text-xs font-bold transition-colors"
          >
            WIN
          </button>
          <button
            onClick={() => isAuthenticated && placeBetMutation.mutate({ prediction: "loss", amount: betAmount })}
            disabled={!isAuthenticated || placeBetMutation.isPending}
            className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-30 text-foreground text-xs font-bold transition-colors"
          >
            LOSS
          </button>

          {timeLeft !== null && timeLeft > 0 && (
            <span className="text-xs text-yellow-400 font-mono whitespace-nowrap">{timeStr} {language === "ko" ? "남음" : "left"}</span>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 py-1.5">
          <Lock className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-bold">{language === "ko" ? "베팅 잠김" : "BETTING LOCKED"}</span>
        </div>
      )}
    </div>
  );
}

function LiveGameBanner() {
  const { t, language } = useTranslation();
  const liveGameQuery = trpc.player.liveGame.useQuery(undefined, {
    refetchInterval: (query) => query.state.data?.inGame ? 15_000 : 120_000,
    staleTime: 60_000,
  });
  const liveGame = liveGameQuery.data;

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!liveGame?.inGame || !liveGame.gameStartTime) return;
    const update = () => {
      const now = Date.now();
      const seconds = Math.max(0, Math.floor((now - liveGame.gameStartTime) / 1000) + liveGame.gameLengthSeconds);
      setElapsed(seconds);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [liveGame]);

  if (!liveGame?.inGame) return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <motion.section
      className="mt-8"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 26, stiffness: 260 }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 backdrop-blur-sm accent-stripe-left">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-transparent to-primary/10 animate-pulse" style={{ animationDuration: "4s" }} />

        <div className="relative px-5 py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              {liveGame.championName ? (
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/16.6.1/img/champion/${liveGame.championName}.png`}
                  alt={liveGame.championName}
                  className="w-11 h-11 rounded-full border-2 border-primary/40"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="p-2.5 rounded-full bg-primary/20 border border-primary/40">
                  <Gamepad2 className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-background animate-pulse" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground">
                  {t.common.inGame}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  목도리 도마뱀 {t.common.liveGameAlert}
                </span>
                {liveGame.championName && (
                  <span className="text-xs text-muted-foreground">
                    — {getChampionName(liveGame.championName, language)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  {liveGame.gameMode}
                </span>
                <span className="flex items-center gap-1 font-[var(--font-mono)]">
                  <Clock className="w-3 h-3" />
                  {timeStr}
                </span>
                {liveGame.isRanked && (
                  <span className="flex items-center gap-1 text-yellow-500">
                    <AlertTriangle className="w-3 h-3" />
                    {t.common.rankedWarning}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">{t.common.live}</span>
            </div>
          </div>

          {/* Inline betting panel */}
          <LiveBettingPanel />

          {/* Live sentiment feed */}
          <LiveSentimentFeed />
        </div>
      </div>
    </motion.section>
  );
}

/**
 * Post-game LP notification banner — appears when a game ends,
 * showing LP delta and price movement. Auto-dismisses after 60s or on user click.
 */
function PostGameBanner() {
  const { t } = useTranslation();
  const eventQuery = trpc.player.gameEndEvent.useQuery(undefined, {
    refetchInterval: (query) => query.state.data ? 15_000 : 120_000,
    staleTime: 60_000,
  });
  const event = eventQuery.data;
  const dismissMutation = trpc.player.dismissGameEndEvent.useMutation({
    onSuccess: () => {
      utils.player.gameEndEvent.invalidate();
    },
  });
  const utils = trpc.useUtils();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  // Track the event timestamp to reset dismissed state on new events
  const [lastEventTs, setLastEventTs] = useState<number | null>(null);

  useEffect(() => {
    if (event && event.timestamp !== lastEventTs) {
      setDismissed(false);
      setVisible(true);
      setLastEventTs(event.timestamp);
    }
  }, [event, lastEventTs]);

  // Auto-dismiss after 60 seconds
  useEffect(() => {
    if (!visible || dismissed) return;
    const timer = setTimeout(() => {
      setDismissed(true);
      dismissMutation.mutate();
    }, 60_000);
    return () => clearTimeout(timer);
  }, [visible, dismissed]);

  if (!event || dismissed) return null;

  // Use actual match result when available, fall back to LP delta
  const isPositive = event.win !== undefined ? event.win : event.lpDelta >= 0;
  const borderColor = isPositive ? "border-green-500/40" : "border-red-500/40";
  const bgColor = isPositive ? "bg-green-500/5" : "bg-red-500/5";
  const accentColor = isPositive ? "text-green-400" : "text-red-400";
  const pulseColor = isPositive ? "bg-green-500/10" : "bg-red-500/10";

  const handleDismiss = () => {
    setDismissed(true);
    dismissMutation.mutate();
  };

  return (
    <motion.section
      className="mt-4"
      initial={{ opacity: 0, y: -16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", damping: 26, stiffness: 260 }}
    >
      <div className={`relative overflow-hidden rounded-xl border ${borderColor} ${bgColor} backdrop-blur-sm`}>
        {/* Animated pulse background */}
        <div className={`absolute inset-0 ${pulseColor} animate-pulse`} />

        <div className="relative px-5 py-4">
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${isPositive ? 'bg-green-500 text-foreground' : 'bg-red-500 text-foreground'}`}>
                {t.common.gameEnded}
              </div>
              <span className={`text-sm font-semibold ${accentColor}`}>
                {isPositive ? t.common.gameEndWin : t.common.gameEndLoss}
              </span>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-md hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
              title={t.common.dismiss}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stats row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
            {/* LP Change */}
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">{t.common.lpChange}</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-2xl font-bold font-[var(--font-mono)] ${accentColor}`}>
                  {isPositive ? "+" : ""}{event.lpDelta}
                </span>
                <span className="text-xs text-muted-foreground">LP</span>
              </div>
              <span className="text-xs text-muted-foreground mt-0.5">
                {event.tierBefore} {event.divisionBefore} {event.lpBefore}LP → {event.tierAfter} {event.divisionAfter} {event.lpAfter}LP
              </span>
            </div>

            {/* Divider */}
            <div className="w-px h-12 bg-border/50 hidden sm:block" />

            {/* Price Impact */}
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">{t.common.priceImpact}</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-2xl font-bold font-[var(--font-mono)] ${accentColor}`}>
                  {event.priceChange >= 0 ? "+" : ""}${event.priceChange.toFixed(2)}
                </span>
                <span className={`text-xs font-medium ${accentColor}`}>
                  ({event.priceChangePct >= 0 ? "+" : ""}{event.priceChangePct.toFixed(1)}%)
                </span>
              </div>
              <span className="text-xs text-muted-foreground mt-0.5">
                ${event.priceBefore.toFixed(2)} → ${event.priceAfter.toFixed(2)}
              </span>
            </div>

            {/* Rank Change */}
            {(event.tierBefore !== event.tierAfter || event.divisionBefore !== event.divisionAfter) && (
              <>
                <div className="w-px h-12 bg-border/50 hidden sm:block" />
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">{t.common.rank}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {event.tierBefore} {event.divisionBefore} → {event.tierAfter} {event.divisionAfter}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/**
 * Match history section that pulls from DB (live polling data) with static fallback.
 */
function MatchHistorySection() {
  const { t, language } = useTranslation();
  const { data: liveMatches, isLoading } = trpc.matches.stored.useQuery(
    { limit: 20 },
    { refetchInterval: 60_000, staleTime: 30_000 }
  );

  const dbMatches: MatchResult[] = (liveMatches ?? []).map((m, i) => {
    const kda =
      m.deaths === 0
        ? t.common.perfectKda
        : ((m.kills + m.assists) / m.deaths).toFixed(2);
    const duration = formatDuration(m.gameDuration, language);
    const timeAgo = formatTimeAgo(m.gameCreation, language);
    const champKey = m.champion;
    const championImage = `https://ddragon.leagueoflegends.com/cdn/16.6.1/img/champion/${champKey}.png`;

    return {
      id: m.id,
      timeAgo,
      gameCreation: m.gameCreation,
      result: m.isRemake ? ("Remake" as const) : m.win ? ("Victory" as const) : ("Defeat" as const),
      duration,
      champion: m.champion,
      championImage,
      kills: m.kills,
      deaths: m.deaths,
      assists: m.assists,
      kdaRatio: kda,
      cs: `${m.cs}`,
      tier: "",
      tags: [],
      queueType: t.common.rankedSolo,
    };
  });

  const matchesToShow = dbMatches;
  const isLive = dbMatches.length > 0;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="p-1.5 rounded-lg bg-secondary">
            <History className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground font-[var(--font-heading)]">
                {t.sections.matchHistory}
              </h2>
              {isLive && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary">
                  <Activity className="w-2.5 h-2.5" />
                  {t.common.live}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLive
                ? t.common.autoUpdated
                : t.sections.recentRankedGames}
            </p>
          </div>
        </div>
        {isLoading && (
          <Clock className="w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card border border-border">
                <div className="animate-pulse bg-secondary rounded-lg w-10 h-10" />
                <div className="flex-1">
                  <div className="animate-pulse bg-secondary rounded w-24 h-4 mb-1" />
                  <div className="animate-pulse bg-secondary rounded w-32 h-3" />
                </div>
              </div>
            ))}
          </div>
        ) : matchesToShow.length > 0 ? (
          matchesToShow.map((match: MatchResult, i: number) => (
            <MatchRow key={match.id} match={match} index={i} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t.common.noMatchData}
          </p>
        )}
      </div>
    </>
  );
}

/**
 * Stats grid that uses live data from backend with static fallback.
 */
function StatsGrid() {
  const { t } = useTranslation();
  const { data: livePlayer } = trpc.player.current.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const { data: avgKda } = trpc.stats.avgKda.useQuery(
    { count: 20 },
    { refetchInterval: 60_000, staleTime: 30_000 }
  );

  const hasLivePlayer = !!livePlayer?.solo;
  const hasLiveKda = !!avgKda;

  const soloTier = livePlayer?.solo?.tier;
  const soloRank = livePlayer?.solo?.rank;
  const soloLP = livePlayer?.solo?.lp;
  const soloWins = livePlayer?.solo?.wins;
  const soloLosses = livePlayer?.solo?.losses;
  const soloWR =
    soloWins !== undefined && soloLosses !== undefined && (soloWins + soloLosses) > 0
      ? Math.round((soloWins / (soloWins + soloLosses)) * 100)
      : 0;

  const flexTier = livePlayer?.flex?.tier;
  const flexRank = livePlayer?.flex?.rank;
  const flexLP = livePlayer?.flex?.lp;
  const flexWins = livePlayer?.flex?.wins;
  const flexLosses = livePlayer?.flex?.losses;
  const flexWR =
    flexWins !== undefined && flexLosses !== undefined && (flexWins + flexLosses) > 0
      ? Math.round((flexWins / (flexWins + flexLosses)) * 100)
      : 0;

  const formatTier = (tier: string) =>
    tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  const formatDiv = (rank: string) => {
    const map: Record<string, string> = { I: "1", II: "2", III: "3", IV: "4" };
    return map[rank] || rank;
  };
  const { language } = useTranslation();

  const isPlayerLoading = !livePlayer;
  const kdaRatio = avgKda?.kdaRatio;
  const kdaStr = avgKda
    ? `${avgKda.avgKills} / ${avgKda.avgDeaths} / ${avgKda.avgAssists}`
    : null;
  const kdaGames = avgKda?.gamesAnalyzed;

  if (isPlayerLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <div className="animate-pulse bg-secondary rounded w-16 h-3 mb-2" />
            <div className="animate-pulse bg-secondary rounded w-24 h-6 mb-1" />
            <div className="animate-pulse bg-secondary rounded w-20 h-3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard
        label={t.stats.soloDuo}
        value={soloTier && soloRank ? translateRank(`${formatTier(soloTier)} ${formatDiv(soloRank)}`, language) : "--"}
        subValue={soloLP !== undefined ? `${soloLP} LP · ${soloWR}% ${t.player.winRate}` : undefined}
        color="var(--color-win)"
        isLive={hasLivePlayer}
      />
      <StatCard
        label={t.stats.flexQueue}
        value={flexTier && flexRank ? translateRank(`${formatTier(flexTier)} ${formatDiv(flexRank)}`, language) : "--"}
        subValue={flexLP !== undefined ? `${flexLP} LP · ${flexWR}% ${t.player.winRate}` : undefined}
        color="#B9F2FF"
        isLive={hasLivePlayer}
      />
      <StatCard
        label={t.stats.totalGames}
        value={soloWins !== undefined && soloLosses !== undefined ? (soloWins + soloLosses).toString() : "--"}
        subValue={soloWins !== undefined && soloLosses !== undefined ? `${soloWins}${t.stats.wins} ${soloLosses}${t.stats.losses}` : undefined}
        isLive={hasLivePlayer}
      />
      <StatCard
        label={`${t.stats.avgKda20}`}
        value={kdaRatio !== undefined ? kdaRatio.toFixed(2) : "--"}
        subValue={kdaStr ?? undefined}
        color={kdaRatio !== undefined ? (kdaRatio >= 3 ? "var(--color-win)" : kdaRatio >= 2 ? "#FFD54F" : "var(--color-loss)") : "#FFD54F"}
        isLive={hasLiveKda}
      />
    </div>
  );
}

/**
 * Champion pool section wired to live data.
 */
function ChampionPoolSection() {
  const { t } = useTranslation();
  const { data: liveChampions } = trpc.stats.championPool.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const isLive = !!(liveChampions && liveChampions.length > 0);

  const champions: ChampionStatData[] = useMemo(() => {
    if (liveChampions && liveChampions.length > 0) {
      return liveChampions.map((c) => ({
        name: c.name,
        image: c.image,
        games: c.games,
        winRate: c.winRate,
        kdaRatio: c.kdaRatio,
        kda: c.kda,
        cs: c.cs,
      }));
    }
    return [];
  }, [liveChampions]);

  return (
    <>
      <SectionHeader
        icon={Shield}
        title={t.sections.championPool}
        subtitle={isLive ? t.common.autoUpdated : t.sections.seasonRankedSoloDuo}
        isLive={isLive}
      />
      {champions.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
          {champions.map((champ, i) => (
            <ChampionCard key={champ.name} champion={champ} index={i} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t.common.noChampionData}
        </p>
      )}
    </>
  );
}



const TICKER_COLORS: Record<string, string> = {
  DORI: "var(--color-win)",
  DDRI: "#FFD54F",
  TDRI: "#FF9800",
  SDRI: "var(--color-loss)",
  XDRI: "#E040FB",
};

function PriceTicker() {
  const { data: etfPrices } = trpc.prices.etfPrices.useQuery(undefined, { staleTime: 30_000 });
  if (!etfPrices || etfPrices.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-5 sm:gap-6 py-2.5 overflow-x-auto scrollbar-hide px-3">
      {etfPrices.map((etf: any) => {
        const pct = etf.changePct ?? 0;
        const isUp = pct >= 0;
        return (
          <div key={etf.ticker} className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[11px] font-bold font-[var(--font-mono)]" style={{ color: TICKER_COLORS[etf.ticker] || "var(--foreground)" }}>
              ${etf.ticker}
            </span>
            <span className="text-[11px] font-[var(--font-mono)] text-foreground/60">
              ${etf.price.toFixed(2)}
            </span>
            <span className="text-[11px] font-[var(--font-mono)] font-semibold" style={{ color: isUp ? "var(--color-win)" : "var(--color-loss)" }}>
              {isUp ? "+" : ""}{pct.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const { t, language } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const utils = trpc.useUtils();

  const updateNameMutation = trpc.auth.updateDisplayName.useMutation({
    onSuccess: (data) => {
      toast.success(`${t.common.displayNameUpdated}: ${data.displayName}`);
      setIsEditingName(false);
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t.common.failedToUpdateName);
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle hero background */}
      <div
        className="fixed inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `url(${HERO_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(60px)",
        }}
      />
      {/* ETF Price Ticker — floats below nav as part of the glass bar */}
      <div className="sticky top-[60px] z-40 px-4">
        <div className="mx-auto max-w-[1200px] -mt-1 rounded-b-2xl bg-card/60 backdrop-blur-xl backdrop-saturate-[1.2]" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)', borderLeft: '0.5px solid rgba(255,255,255,0.04)', borderRight: '0.5px solid rgba(255,255,255,0.04)' }}>
          <PriceTicker />
        </div>
      </div>

      {/* Main content */}
      <main className="container relative z-10 pb-20">
        <section className="pt-6 sm:pt-8">
          <PlayerHeader />
        </section>

        {/* Live Game Alert */}
        <LiveGameBanner />
        <PostGameBanner />

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-8" />

        <section>
          <StatsGrid />
        </section>

        {/* Two-column layout: Streaks + Recent Performance */}
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", damping: 26, stiffness: 260, delay: 0.2 }}
            className="bg-card border border-border rounded-xl p-3 sm:p-5"
          >
            <SectionHeader
              icon={TrendingUp}
              title={t.sections.winLossStreaks}
              subtitle={t.sections.recentMomentum}
            />
            <StreakBar />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", damping: 26, stiffness: 260, delay: 0.3 }}
            className="bg-card border border-border rounded-xl p-3 sm:p-5"
          >
            <SectionHeader
              icon={Swords}
              title={t.sections.sevenDayPerformance}
              subtitle={t.sections.championWinRates}
            />
            <RecentPerformance />
          </motion.div>
        </section>

        <section className="mt-8">
          <ChampionPoolSection />
        </section>

        <section className="mt-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", damping: 26, stiffness: 260, delay: 0.4 }}
            className="bg-card border border-border rounded-xl p-3 sm:p-5"
          >
            <SectionHeader
              icon={Trophy}
              title={t.sections.seasonHistory}
              subtitle={t.sections.pastRankedPlacements}
            />
            <SeasonHistory />
          </motion.div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-8" />

        <section>
          <MatchHistorySection />
        </section>

        {/* Feed CTA */}
        <Link href="/feed">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
            className="mt-8 bg-card border border-border rounded-xl p-5 flex items-center justify-between group hover:bg-secondary/30 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <Newspaper className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground font-[var(--font-heading)]">
                  {language === "ko" ? "피드" : "Feed"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {language === "ko" ? "경기 뉴스와 트레이더 토론" : "Match news & trader discussion"}
                </p>
              </div>
            </div>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors text-sm">&rarr;</span>
          </motion.div>
        </Link>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            {t.footer.dataSource}{" "}
            <a
              href="https://op.gg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              OP.GG
            </a>{" "}
            &{" "}
            <a
              href="https://developer.riotgames.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Riot Games API
            </a>
            . {t.footer.notAffiliated}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t.footer.disclaimer}
          </p>
        </footer>
      </main>
    </div>
  );
}
