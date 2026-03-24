/*
 * Design Philosophy: "Clean Broker" — Robinhood's minimalist fintech UI.
 * Rebranded as $DORI LP Tracker.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PlayerHeader from "@/components/PlayerHeader";
import LPChart from "@/components/LPChart";
import StreakBar from "@/components/StreakBar";
import ChampionCard from "@/components/ChampionCard";
import MatchRow from "@/components/MatchRow";
import RecentPerformance from "@/components/RecentPerformance";
import SeasonHistory from "@/components/SeasonHistory";
import TradingPanel from "@/components/TradingPanel";
import { CHAMPION_STATS, MATCH_HISTORY, RANKED_SOLO, RANKED_FLEX } from "@/lib/playerData";
import { motion } from "framer-motion";
import { BarChart3, Swords, History, Trophy, TrendingUp, Shield, LogIn, LogOut, User, Wallet } from "lucide-react";
import { trpc } from "@/lib/trpc";

const HERO_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663324505869/EqpY4GjGxu3PtSNi8r37GF/hero-bg-BaXtnoCMhWwQSL3MGvhxSm.webp";

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: any;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="p-1.5 rounded-lg bg-secondary">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-base font-bold text-white font-[var(--font-heading)]">
          {title}
        </h2>
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
}: {
  label: string;
  value: string;
  subValue?: string;
  color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
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

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();

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
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-white font-[var(--font-heading)]">
              $DORI
            </span>
            <span className="text-xs text-muted-foreground font-[var(--font-mono)] hidden sm:inline">
              LP Tracker
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://op.gg/lol/summoners/na/%EB%AA%A9%EB%8F%84%EB%A6%AC%20%EB%8F%84%EB%A7%88%EB%B1%80-dori"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-white transition-colors font-[var(--font-mono)]"
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
                  <User className="w-3.5 h-3.5" />
                  <span className="font-[var(--font-mono)] hidden sm:inline">{user?.name || "Trader"}</span>
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

        {/* Stats grid */}
        <section className="mt-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Solo/Duo"
              value={`${RANKED_SOLO.tier} ${RANKED_SOLO.division}`}
              subValue={`${RANKED_SOLO.lp} LP · ${RANKED_SOLO.winRate}% WR`}
              color="#00C805"
            />
            <StatCard
              label="Flex Queue"
              value={`${RANKED_FLEX.tier} ${RANKED_FLEX.division}`}
              subValue={`${RANKED_FLEX.lp} LP · ${RANKED_FLEX.winRate}% WR`}
              color="#B9F2FF"
            />
            <StatCard
              label="Total Games"
              value={(RANKED_SOLO.wins + RANKED_SOLO.losses).toString()}
              subValue={`${RANKED_SOLO.wins}W ${RANKED_SOLO.losses}L`}
            />
            <StatCard
              label="Avg KDA (20G)"
              value="2.23"
              subValue="6.3 / 6.3 / 7.7"
              color="#FFD54F"
            />
          </div>
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

        {/* Champion stats */}
        <section className="mt-8">
          <SectionHeader
            icon={Shield}
            title="Champion Pool"
            subtitle="Season 2026 Ranked Solo/Duo"
          />
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
            {CHAMPION_STATS.map((champ, i) => (
              <ChampionCard key={champ.name} champion={champ} index={i} />
            ))}
          </div>
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
          <SectionHeader
            icon={History}
            title="Match History"
            subtitle="Recent ranked games"
          />
          <div className="space-y-1.5">
            {MATCH_HISTORY.map((match, i) => (
              <MatchRow key={match.id} match={match} index={i} />
            ))}
          </div>
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
            </a>
            . Not affiliated with Riot Games.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            $DORI LP Tracker is not endorsed by Riot Games and does not reflect the views of Riot Games.
          </p>
        </footer>
      </main>
    </div>
  );
}
