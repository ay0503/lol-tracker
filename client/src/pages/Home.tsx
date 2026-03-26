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
import LPChart from "@/components/LPChart";
import StreakBar from "@/components/StreakBar";
import ChampionCard from "@/components/ChampionCard";
import type { ChampionStatData } from "@/components/ChampionCard";
import MatchRow from "@/components/MatchRow";
import RecentPerformance from "@/components/RecentPerformance";
import SeasonHistory from "@/components/SeasonHistory";
import TradingPanel from "@/components/TradingPanel";
import BettingPanel from "@/components/BettingPanel";
import { TickerProvider } from "@/contexts/TickerContext";
import NotificationBell from "@/components/NotificationBell";
import PriceRankLegend from "@/components/PriceRankLegend";
import { type MatchResult } from "@/lib/playerData";
import { translateRank, formatDuration, formatTimeAgo, formatMatchResult } from "@/lib/formatters";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Swords,
  History,
  Trophy,
  TrendingUp,
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
    <div className="flex items-center gap-2.5 mb-4">
      <div className="p-1.5 rounded-lg bg-secondary">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-foreground font-[var(--font-heading)]">
            {title}
          </h2>
          {isLive && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
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
    <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
        {isLive && (
          <span className="flex items-center gap-0.5 text-[9px] font-semibold text-primary">
            <Activity className="w-2 h-2" />
          </span>
        )}
      </div>
      <p
        className="text-base sm:text-xl font-bold font-[var(--font-mono)] truncate"
        style={{ color: color || undefined }}
      >
        {value}
      </p>
      {subValue && (
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{subValue}</p>
      )}
    </div>
  );
}

/**
 * Live game alert banner — shows when the tracked player is in an active game.
 */
function LiveGameBanner() {
  const { t } = useTranslation();
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
      className="mt-6"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-primary/5 backdrop-blur-sm">
        {/* Animated pulse background */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 animate-pulse" />

        <div className="relative flex items-center gap-4 px-5 py-4">
          {/* Pulsing game icon */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
            <div className="relative p-2.5 rounded-full bg-primary/20 border border-primary/40">
              <Gamepad2 className="w-5 h-5 text-primary" />
            </div>
          </div>

          {/* Game info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground">
                {t.common.inGame}
              </span>
              <span className="text-sm font-semibold text-foreground">
                목도리 도마뱀 {t.common.liveGameAlert}
              </span>
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

          {/* Live indicator dot */}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">{t.common.live}</span>
          </div>
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
    }, 60_000);
    return () => clearTimeout(timer);
  }, [visible, dismissed]);

  if (!event || dismissed) return null;

  const isPositive = event.lpDelta >= 0;
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
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className={`relative overflow-hidden rounded-xl border ${borderColor} ${bgColor} backdrop-blur-sm`}>
        {/* Animated pulse background */}
        <div className={`absolute inset-0 ${pulseColor} animate-pulse`} />

        <div className="relative px-5 py-4">
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${isPositive ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
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
          <div className="flex items-center gap-6">
            {/* LP Change */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{t.common.lpChange}</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-2xl font-bold font-[var(--font-mono)] ${accentColor}`}>
                  {isPositive ? "+" : ""}{event.lpDelta}
                </span>
                <span className="text-xs text-muted-foreground">LP</span>
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                {event.tierBefore} {event.divisionBefore} {event.lpBefore}LP → {event.tierAfter} {event.divisionAfter} {event.lpAfter}LP
              </span>
            </div>

            {/* Divider */}
            <div className="w-px h-12 bg-border/50" />

            {/* Price Impact */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{t.common.priceImpact}</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-2xl font-bold font-[var(--font-mono)] ${accentColor}`}>
                  {event.priceChange >= 0 ? "+" : ""}${event.priceChange.toFixed(2)}
                </span>
                <span className={`text-xs font-medium ${accentColor}`}>
                  ({event.priceChangePct >= 0 ? "+" : ""}{event.priceChangePct.toFixed(1)}%)
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                ${event.priceBefore.toFixed(2)} → ${event.priceAfter.toFixed(2)}
              </span>
            </div>

            {/* Rank Change */}
            {(event.tierBefore !== event.tierAfter || event.divisionBefore !== event.divisionAfter) && (
              <>
                <div className="w-px h-12 bg-border/50" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{t.common.rank}</span>
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
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-secondary">
            <History className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground font-[var(--font-heading)]">
                {t.sections.matchHistory}
              </h2>
              {isLive && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
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
      <div className="space-y-1.5">
        {isLoading ? (
          <div className="space-y-1.5">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        label={t.stats.soloDuo}
        value={soloTier && soloRank ? translateRank(`${formatTier(soloTier)} ${formatDiv(soloRank)}`, language) : "--"}
        subValue={soloLP !== undefined ? `${soloLP} LP · ${soloWR}% ${t.player.winRate}` : undefined}
        color="#00C805"
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
        color="#FFD54F"
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

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  return (
    <button
      onClick={toggleTheme}
      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
      title={theme === "dark" ? t.common.switchToLight : t.common.switchToDark}
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}

function LanguageToggle() {
  const { language, setLanguage, t } = useTranslation();
  return (
    <button
      onClick={() => setLanguage(language === "en" ? "ko" : "en")}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all font-[var(--font-mono)]"
      title={t.common.toggleLanguage}
    >
      <Globe className="w-3.5 h-3.5" />
      {language === "en" ? "KR" : "EN"}
    </button>
  );
}

export default function Home() {
  const { t } = useTranslation();
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

      {/* Top nav bar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-14">
          {/* Left: Logo + Desktop nav links */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <BarChart3 className="w-5 h-5 text-primary" />
              <span className="text-sm font-bold text-foreground font-[var(--font-heading)]">
                $DORI
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-1 ml-2">
              <Link href="/ledger" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                <BookOpen className="w-3.5 h-3.5" />
                {t.nav.ledger}
              </Link>
              <Link href="/leaderboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                <Crown className="w-3.5 h-3.5" />
                {t.nav.leaderboard}
              </Link>
              <Link href="/news" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                <Newspaper className="w-3.5 h-3.5" />
                {t.nav.news}
              </Link>
              <Link href="/sentiment" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                <MessageCircle className="w-3.5 h-3.5" />
                {t.nav.sentiment}
              </Link>
              <Link href="/casino" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-yellow-400 hover:text-yellow-300 hover:bg-yellow-950/30 transition-all">
                <Gamepad2 className="w-3.5 h-3.5" />
                Casino
              </Link>
              {isAuthenticated && (
                <Link href="/portfolio" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                  <Wallet className="w-3.5 h-3.5" />
                  {t.nav.portfolio}
                </Link>
              )}
              {user?.role === "admin" && (
                <Link href="/admin" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-all">
                  <Shield className="w-3.5 h-3.5" />
                  Admin
                </Link>
              )}
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://op.gg/lol/summoners/na/%EB%AA%A9%EB%8F%84%EB%A6%AC%20%EB%8F%84%EB%A7%88%EB%B1%80-dori"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors font-[var(--font-mono)] hidden md:inline"
            >
              OP.GG
            </a>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              S2026
            </div>
            {isAuthenticated ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-foreground">
                  {isEditingName ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={50}
                        className="w-24 px-1.5 py-0.5 rounded bg-secondary border border-border text-xs text-foreground font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editName.trim()) {
                            updateNameMutation.mutate({ displayName: editName.trim() });
                          } else if (e.key === "Escape") {
                            setIsEditingName(false);
                          }
                        }}
                      />
                      <button onClick={() => { if (editName.trim()) updateNameMutation.mutate({ displayName: editName.trim() }); }} className="p-0.5 text-[#00C805] hover:bg-secondary rounded">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => setIsEditingName(false)} className="p-0.5 text-[#FF5252] hover:bg-secondary rounded">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <User className="w-3.5 h-3.5" />
                      <span className="font-[var(--font-mono)]">
                        {(user as any)?.displayName || user?.name || t.common.trader}
                      </span>
                      <button
                        onClick={() => { setEditName((user as any)?.displayName || user?.name || ""); setIsEditingName(true); }}
                        className="p-0.5 text-muted-foreground hover:text-foreground rounded"
                        title={t.common.editDisplayName}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
                <NotificationBell />
                <LanguageToggle />
                <ThemeToggleButton />
                <button
                  onClick={() => logout()}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
                {/* Mobile hamburger */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <LanguageToggle />
                <ThemeToggleButton />
                <a
                  href="/login"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.nav.signIn}</span>
                  <span className="sm:hidden"><LogIn className="w-3.5 h-3.5" /></span>
                </a>
                {/* Mobile hamburger (unauthenticated) */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile slide-down menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden border-t border-border bg-background/95 backdrop-blur-xl"
            >
              <div className="container py-3 space-y-1">
                <Link href="/ledger" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                  <BookOpen className="w-4 h-4" />
                  {t.nav.ledger}
                </Link>
                <Link href="/leaderboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                  <Crown className="w-4 h-4" />
                  {t.nav.leaderboard}
                </Link>
                <Link href="/news" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                  <Newspaper className="w-4 h-4" />
                  {t.nav.news}
                </Link>
                <Link href="/sentiment" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                  <MessageCircle className="w-4 h-4" />
                  {t.nav.sentiment}
                </Link>
                <Link href="/casino" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-yellow-400 hover:text-yellow-300 hover:bg-yellow-950/30 transition-all">
                  <Gamepad2 className="w-4 h-4" />
                  Casino
                </Link>
                {isAuthenticated && (
                  <Link href="/portfolio" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                    <Wallet className="w-4 h-4" />
                    {t.nav.portfolio}
                  </Link>
                )}
                {user?.role === "admin" && (
                  <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-all">
                    <Shield className="w-4 h-4" />
                    Admin
                  </Link>
                )}
                <a
                  href="https://op.gg/lol/summoners/na/%EB%AA%A9%EB%8F%84%EB%A6%AC%20%EB%8F%84%EB%A7%88%EB%B1%80-dori"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
                >
                  <Activity className="w-4 h-4" />
                  OP.GG
                </a>
                {isAuthenticated && (
                  <div className="border-t border-border pt-2 mt-2">
                    <div className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground">
                      <User className="w-4 h-4" />
                      {(user as any)?.displayName || user?.name || t.common.trader}
                    </div>
                    <button
                      onClick={() => { logout(); setMobileMenuOpen(false); }}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-[#FF5252] hover:bg-[#FF5252]/10 transition-all w-full"
                    >
                      <LogOut className="w-4 h-4" />
                      {t.nav.signOut}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main content */}
      <main className="container relative z-10 pb-20">
        <section className="pt-6 sm:pt-8">
          <PlayerHeader />
        </section>

        {/* Live Game Alert */}
        <LiveGameBanner />
        <PostGameBanner />

        <TickerProvider>
          <section className="mt-6">
            <LPChart />
          </section>

          {isAuthenticated && (
            <section className="mt-6">
              <TradingPanel />
            </section>
          )}
        </TickerProvider>

        {isAuthenticated && (
          <section className="mt-6">
            <BettingPanel />
          </section>
        )}

        <section className="mt-6">
          <PriceRankLegend />
        </section>

        <section className="mt-8">
          <StatsGrid />
        </section>

        {/* Two-column layout: Streaks + Recent Performance */}
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
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
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
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
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
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

        <section className="mt-8">
          <MatchHistorySection />
        </section>

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
