/*
 * $DORI LP Tracker — Main page with Robinhood-style fintech UI.
 * Navigation to Ledger and Portfolio pages.
 * All stat components now wired to live backend data with static fallbacks.
 */
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
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
import {
  CHAMPION_STATS,
  MATCH_HISTORY,
  RANKED_SOLO,
  RANKED_FLEX,
  type MatchResult,
} from "@/lib/playerData";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { Link } from "wouter";

const HERO_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663324505869/EqpY4GjGxu3PtSNi8r37GF/hero-bg-BaXtnoCMhWwQSL3MGvhxSm.webp";

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
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="p-1.5 rounded-lg bg-secondary">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-white font-[var(--font-heading)]">
            {title}
          </h2>
          {isLive && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
              <Activity className="w-2.5 h-2.5" />
              LIVE
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
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {isLive && (
          <span className="flex items-center gap-0.5 text-[9px] font-semibold text-primary">
            <Activity className="w-2 h-2" />
          </span>
        )}
      </div>
      <p
        className="text-xl font-bold font-[var(--font-mono)]"
        style={{ color: color || "white" }}
      >
        {value}
      </p>
      {subValue && (
        <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>
      )}
    </div>
  );
}

/**
 * Match history section that pulls from DB (live polling data) with static fallback.
 */
function MatchHistorySection() {
  const { data: liveMatches, isLoading } = trpc.matches.stored.useQuery(
    { limit: 20 },
    { refetchInterval: 60_000, staleTime: 30_000 }
  );

  // Convert DB matches to MatchResult format for MatchRow
  const dbMatches: MatchResult[] = (liveMatches ?? []).map((m, i) => {
    const kda =
      m.deaths === 0
        ? "Perfect"
        : ((m.kills + m.assists) / m.deaths).toFixed(2);
    const mins = Math.floor(m.gameDuration / 60);
    const secs = m.gameDuration % 60;
    const duration = `${mins}m ${secs}s`;
    const now = Date.now();
    const diff = now - m.gameCreation;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const timeAgo =
      days > 0 ? `${days}d ago` : hours > 0 ? `${hours}h ago` : "just now";
    const champKey = m.champion;
    const championImage = `https://ddragon.leagueoflegends.com/cdn/14.6.1/img/champion/${champKey}.png`;

    return {
      id: m.id,
      timeAgo,
      result: m.win ? ("Victory" as const) : ("Defeat" as const),
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
      queueType: "Ranked Solo",
    };
  });

  // Use DB matches if available, otherwise fall back to static data
  const matchesToShow = dbMatches.length > 0 ? dbMatches : MATCH_HISTORY;
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
              <h2 className="text-base font-bold text-white font-[var(--font-heading)]">
                Match History
              </h2>
              {isLive && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                  <Activity className="w-2.5 h-2.5" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLive
                ? "Auto-updated from Riot API"
                : "Recent ranked games"}
            </p>
          </div>
        </div>
        {isLoading && (
          <Clock className="w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>
      <div className="space-y-1.5">
        {matchesToShow.map((match, i) => (
          <MatchRow key={match.id} match={match} index={i} />
        ))}
      </div>
    </>
  );
}

/**
 * Stats grid that uses live data from backend with static fallback.
 */
function StatsGrid() {
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

  // Solo/Duo stats
  const soloTier = livePlayer?.solo?.tier ?? RANKED_SOLO.tier;
  const soloRank = livePlayer?.solo?.rank ?? String(RANKED_SOLO.division);
  const soloLP = livePlayer?.solo?.lp ?? RANKED_SOLO.lp;
  const soloWins = livePlayer?.solo?.wins ?? RANKED_SOLO.wins;
  const soloLosses = livePlayer?.solo?.losses ?? RANKED_SOLO.losses;
  const soloWR =
    soloWins + soloLosses > 0
      ? Math.round((soloWins / (soloWins + soloLosses)) * 100)
      : 0;

  // Flex stats
  const flexTier = livePlayer?.flex?.tier ?? RANKED_FLEX.tier;
  const flexRank = livePlayer?.flex?.rank ?? String(RANKED_FLEX.division);
  const flexLP = livePlayer?.flex?.lp ?? RANKED_FLEX.lp;
  const flexWins = livePlayer?.flex?.wins ?? RANKED_FLEX.wins;
  const flexLosses = livePlayer?.flex?.losses ?? RANKED_FLEX.losses;
  const flexWR =
    flexWins + flexLosses > 0
      ? Math.round((flexWins / (flexWins + flexLosses)) * 100)
      : 0;

  // Format tier name
  const formatTier = (tier: string) =>
    tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  const formatDiv = (rank: string) => {
    const map: Record<string, string> = { I: "1", II: "2", III: "3", IV: "4" };
    return map[rank] || rank;
  };

  // KDA stats
  const kdaRatio = avgKda?.kdaRatio ?? 2.23;
  const kdaStr = avgKda
    ? `${avgKda.avgKills} / ${avgKda.avgDeaths} / ${avgKda.avgAssists}`
    : "6.3 / 6.3 / 7.7";
  const kdaGames = avgKda?.gamesAnalyzed ?? 20;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        label="Solo/Duo"
        value={`${formatTier(soloTier)} ${formatDiv(soloRank)}`}
        subValue={`${soloLP} LP · ${soloWR}% WR`}
        color="#00C805"
        isLive={hasLivePlayer}
      />
      <StatCard
        label="Flex Queue"
        value={`${formatTier(flexTier)} ${formatDiv(flexRank)}`}
        subValue={`${flexLP} LP · ${flexWR}% WR`}
        color="#B9F2FF"
        isLive={hasLivePlayer}
      />
      <StatCard
        label="Total Games"
        value={(soloWins + soloLosses).toString()}
        subValue={`${soloWins}W ${soloLosses}L`}
        isLive={hasLivePlayer}
      />
      <StatCard
        label={`Avg KDA (${kdaGames}G)`}
        value={kdaRatio.toFixed(2)}
        subValue={kdaStr}
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
  const { data: liveChampions } = trpc.stats.championPool.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Map live data to ChampionStatData, or fall back to static
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
    // Fallback to static data
    return CHAMPION_STATS.map((c) => ({
      name: c.name,
      image: c.image,
      games: c.games,
      winRate: c.winRate,
      kdaRatio: c.kdaRatio,
      kda: c.kda,
      cs: c.cs,
    }));
  }, [liveChampions]);

  return (
    <>
      <SectionHeader
        icon={Shield}
        title="Champion Pool"
        subtitle={isLive ? "Computed from polled match data" : "Season 2026 Ranked Solo/Duo"}
        isLive={isLive}
      />
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {champions.map((champ, i) => (
          <ChampionCard key={champ.name} champion={champ} index={i} />
        ))}
      </div>
    </>
  );
}

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const utils = trpc.useUtils();

  const updateNameMutation = trpc.auth.updateDisplayName.useMutation({
    onSuccess: (data) => {
      toast.success(`Display name updated to "${data.displayName}"`);
      setIsEditingName(false);
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update name");
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
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <BarChart3 className="w-5 h-5 text-primary" />
              <span className="text-sm font-bold text-white font-[var(--font-heading)]">
                $DORI
              </span>
            </Link>
            <div className="hidden sm:flex items-center gap-1 ml-2">
              <Link
                href="/ledger"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white hover:bg-secondary/50 transition-all"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Ledger
              </Link>
              <Link
                href="/leaderboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white hover:bg-secondary/50 transition-all"
              >
                <Crown className="w-3.5 h-3.5" />
                Leaderboard
              </Link>
              <Link
                href="/news"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white hover:bg-secondary/50 transition-all"
              >
                <Newspaper className="w-3.5 h-3.5" />
                News
              </Link>
              <Link
                href="/sentiment"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white hover:bg-secondary/50 transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Sentiment
              </Link>
              {isAuthenticated && (
                <Link
                  href="/portfolio"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white hover:bg-secondary/50 transition-all"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Portfolio
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://op.gg/lol/summoners/na/%EB%AA%A9%EB%8F%84%EB%A6%AC%20%EB%8F%84%EB%A7%88%EB%B1%80-dori"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-white transition-colors font-[var(--font-mono)] hidden sm:inline"
            >
              OP.GG
            </a>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              S2026
            </div>
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-white">
                  {isEditingName ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={50}
                        className="w-24 px-1.5 py-0.5 rounded bg-secondary border border-border text-xs text-white font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editName.trim()) {
                            updateNameMutation.mutate({
                              displayName: editName.trim(),
                            });
                          } else if (e.key === "Escape") {
                            setIsEditingName(false);
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (editName.trim()) {
                            updateNameMutation.mutate({
                              displayName: editName.trim(),
                            });
                          }
                        }}
                        className="p-0.5 text-[#00C805] hover:bg-secondary rounded"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setIsEditingName(false)}
                        className="p-0.5 text-[#FF5252] hover:bg-secondary rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <User className="w-3.5 h-3.5" />
                      <span className="font-[var(--font-mono)] hidden sm:inline">
                        {(user as any)?.displayName || user?.name || "Trader"}
                      </span>
                      <button
                        onClick={() => {
                          setEditName(
                            (user as any)?.displayName || user?.name || ""
                          );
                          setIsEditingName(true);
                        }}
                        className="p-0.5 text-muted-foreground hover:text-white rounded"
                        title="Edit display name"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
                {/* Mobile nav links */}
                <div className="flex sm:hidden items-center gap-1">
                  <Link
                    href="/ledger"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-white"
                  >
                    <BookOpen className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/portfolio"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-white"
                  >
                    <Wallet className="w-4 h-4" />
                  </Link>
                </div>
                <button
                  onClick={() => logout()}
                  className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <a
                href={getLoginUrl()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-black bg-primary hover:bg-primary/90 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="container relative z-10 pb-20">
        {/* Player header + LP chart hero section */}
        <section className="pt-6 sm:pt-8">
          <PlayerHeader />
        </section>

        {/* LP Chart - the hero */}
        <section className="mt-6">
          <LPChart />
        </section>

        {/* Trading Panel - only visible when logged in */}
        {isAuthenticated && (
          <section className="mt-6">
            <TradingPanel />
          </section>
        )}

        {/* Stats grid — now live */}
        <section className="mt-8">
          <StatsGrid />
        </section>

        {/* Two-column layout: Streaks + Recent Performance */}
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <SectionHeader
              icon={TrendingUp}
              title="Win/Loss Streaks"
              subtitle="Recent match momentum"
            />
            <StreakBar />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <SectionHeader
              icon={Swords}
              title="7-Day Performance"
              subtitle="Champion win rates this week"
            />
            <RecentPerformance />
          </motion.div>
        </section>

        {/* Champion stats — now live */}
        <section className="mt-8">
          <ChampionPoolSection />
        </section>

        {/* Season history */}
        <section className="mt-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <SectionHeader
              icon={Trophy}
              title="Season History"
              subtitle="Past ranked placements"
            />
            <SeasonHistory />
          </motion.div>
        </section>

        {/* Match history */}
        <section className="mt-8">
          <MatchHistorySection />
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            Data sourced from{" "}
            <a
              href="https://op.gg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              OP.GG
            </a>{" "}
            and{" "}
            <a
              href="https://developer.riotgames.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Riot Games API
            </a>
            . Not affiliated with Riot Games.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            $DORI LP Tracker is not endorsed by Riot Games and does not reflect
            the views of Riot Games.
          </p>
        </footer>
      </main>
    </div>
  );
}
