import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Loader2, Users, Swords, Copy, Shuffle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import AppNav from "@/components/AppNav";

const TEST_PLAYERS = [
  "I SEE U BABY BOI#LVgod", "envy ion#469", "9ENN#aaaaa", "MICKNUTTY333#meow",
  "SR exa#VIC", "Tofu#taps", "shawz#000", "TheDragonWarrior#fmboy",
  "EG stunna#2006", "awkua#777", "QOR Notexxd#KTTA", "Shae#Shon",
  "milan#frelo", "nonentity#0704", "needy#owo", "raiku#hsp",
  "asianvyn#rank1", "smk#zerra", "tonza#tones", "ahm4xx はあ#15yr",
  "xup#tanl", "twitch toozy#2005", "Harmful#boop", "EG jakee#thief",
  "supamen#612", "LEV spikezin#ayra", "Subroza#RULT", "mikeE#scan",
  "icy#madi", "SR Smoke#jamon", "LEV Sato#emyna", "PowerPixele#Autum",
  "PaMstou#Kunai", "twitch haeyoday#hyd", "M80 Boni#angie", "M80 alvin#NO1",
  "zanks#15yo", "klamran#4566", "twitch zeeraval#BRON", "endless#lll",
  "ENVY Eggsterr#NJLTC", "dihawk#wya", "Siz#9487", "YPM#maid",
  "God Of Arcadia#Gav", "carve#1111", "heartless#css", "kuroza#fps",
  "LEV blowz#1111", "biG ORaNgE#katie", "kinetic#ysh", "ttv regannator#123",
];

const REGIONS = [
  { value: "na", label: "NA" },
  { value: "eu", label: "EU" },
  { value: "ap", label: "AP" },
  { value: "kr", label: "KR" },
];

// Rank badge color mapping
const RANK_COLORS: Record<string, string> = {
  Iron: "text-zinc-400",
  Bronze: "text-amber-700",
  Silver: "text-zinc-300",
  Gold: "text-yellow-400",
  Platinum: "text-cyan-400",
  Diamond: "text-purple-400",
  Ascendant: "text-emerald-400",
  Immortal: "text-red-400",
  Radiant: "text-yellow-300",
  Unranked: "text-zinc-500",
};

function getRankColor(rank: string): string {
  for (const [key, color] of Object.entries(RANK_COLORS)) {
    if (rank.includes(key)) return color;
  }
  return "text-zinc-400";
}

const ROLE_COLORS: Record<string, string> = {
  Duelist: "text-red-400 bg-red-500/15",
  Sentinel: "text-emerald-400 bg-emerald-500/15",
  Controller: "text-blue-400 bg-blue-500/15",
  Initiator: "text-yellow-400 bg-yellow-500/15",
  Flex: "text-zinc-400 bg-zinc-500/15",
};

interface PlayerProfile {
  riotId: string; name: string; tag: string; region: string;
  rank: string; rankTier: number; rr: number; elo: number;
  avgACS: number; avgKD: number; avgADR: number; hsPercent: number; winRate: number;
  gamesAnalyzed: number;
  topAgents: { agent: string; games: number; winRate: number }[];
  primaryRole: string; overallScore: number;
  rankIconUrl?: string;
}

interface TeamResult {
  teamA: PlayerProfile[]; teamB: PlayerProfile[];
  scoreDiff: number; teamAScore: number; teamBScore: number;
  predictedWinRate: { teamA: number; teamB: number };
}

function PlayerCard({ player, compact }: { player: PlayerProfile; compact?: boolean }) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-700/30">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {player.rankIconUrl ? (
            <img src={player.rankIconUrl} alt={player.rank} className="w-5 h-5 flex-shrink-0" />
          ) : (
            <span className={`text-xs font-bold ${getRankColor(player.rank)}`}>
              {player.rank.replace("Immortal", "Imm").replace("Ascendant", "Asc")}
            </span>
          )}
          <span className="text-sm font-bold text-white truncate">{player.name}</span>
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${ROLE_COLORS[player.primaryRole] || ROLE_COLORS.Flex}`}>
          {player.primaryRole}
        </span>
      </div>
      {!compact && (
        <>
          <div className="grid grid-cols-4 gap-1.5 mb-1.5">
            <div className="text-center">
              <p className="text-[8px] text-zinc-500">ACS</p>
              <p className="text-xs font-mono font-bold text-white">{player.avgACS}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-zinc-500">K/D</p>
              <p className="text-xs font-mono font-bold text-white">{player.avgKD}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-zinc-500">ADR</p>
              <p className="text-xs font-mono font-bold text-white">{player.avgADR}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-zinc-500">Win%</p>
              <p className="text-xs font-mono font-bold text-white">{player.winRate}%</p>
            </div>
          </div>
          <div className="flex gap-1">
            {player.topAgents.map(ag => (
              <span key={ag.agent} className="text-[9px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                {ag.agent} ({ag.games})
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TeamCard({ team, label, color, score, winPct }: {
  team: PlayerProfile[]; label: string; color: "blue" | "red"; score: number; winPct: number;
}) {
  const borderColor = color === "blue" ? "border-blue-500/40" : "border-red-500/40";
  const bgColor = color === "blue" ? "from-blue-950/30 to-blue-900/10" : "from-red-950/30 to-red-900/10";
  const textColor = color === "blue" ? "text-blue-400" : "text-red-400";
  const avgACS = Math.round(team.reduce((s, p) => s + p.avgACS, 0) / team.length);
  const avgKD = Math.round(team.reduce((s, p) => s + p.avgKD, 0) / team.length * 100) / 100;

  return (
    <div className={`rounded-xl border ${borderColor} bg-gradient-to-br ${bgColor} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`text-sm font-bold ${textColor}`}>{label}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-400 font-mono">Score: {score.toFixed(1)}</span>
          <span className={`text-xs font-bold ${textColor}`}>{winPct}%</span>
        </div>
      </div>
      <div className="space-y-1.5 mb-2">
        {team.map(pl => <PlayerCard key={pl.riotId} player={pl} />)}
      </div>
      <div className="flex gap-3 text-[10px] text-zinc-500">
        <span>Avg ACS: <b className="text-white">{avgACS}</b></span>
        <span>Avg K/D: <b className="text-white">{avgKD}</b></span>
      </div>
    </div>
  );
}

export default function Valorant() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();

  const [inputs, setInputs] = useState<string[]>(Array(10).fill(""));
  const [region, setRegion] = useState("na");
  const [results, setResults] = useState<TeamResult[] | null>(null);
  const [selectedResult, setSelectedResult] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  const balanceMutation = trpc.valorant.balanceTeams.useMutation({
    onSuccess: (data) => {
      setResults(data as TeamResult[]);
      setSelectedResult(0);
      setLoading(false);
      setProgress("");
      toast.success("Teams balanced!");
    },
    onError: (err) => {
      setLoading(false);
      setProgress("");
      toast.error(err.message);
    },
  });

  const handleBalance = useCallback(() => {
    const parsed = inputs.map(inp => {
      const parts = inp.trim().split("#");
      return { name: parts[0] || "", tag: parts[1] || "", region };
    });
    const valid = parsed.filter(pl => pl.name && pl.tag);
    if (valid.length !== 10) {
      toast.error(`Need 10 valid Riot IDs (Name#Tag). Got ${valid.length}.`);
      return;
    }
    setLoading(true);
    setProgress("Fetching player data...");
    setResults(null);
    balanceMutation.mutate({ players: valid });
  }, [inputs, region]);

  const handlePaste = useCallback(() => {
    navigator.clipboard.readText().then(text => {
      const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean).slice(0, 10);
      const newInputs = [...inputs];
      lines.forEach((line, idx) => { if (idx < 10) newInputs[idx] = line; });
      setInputs(newInputs);
      toast.success(`Pasted ${lines.length} names`);
    }).catch(() => toast.error("Clipboard access denied"));
  }, [inputs]);

  const copyToDiscord = useCallback(() => {
    if (!results) return;
    const result = results[selectedResult];
    const format = (team: PlayerProfile[], label: string) =>
      `**${label}**\n${team.map(pl => `- ${pl.riotId} (${pl.rank}, ${pl.avgACS} ACS, ${pl.primaryRole})`).join("\n")}`;
    const text = `${format(result.teamA, "Team Alpha")} \n\n${format(result.teamB, "Team Bravo")}\n\nPrediction: ${result.predictedWinRate.teamA}% - ${result.predictedWinRate.teamB}%`;
    navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard!"));
  }, [results, selectedResult]);

  const currentResult = results?.[selectedResult];

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <div className="container py-6 max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/20">
            <Swords className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground font-[var(--font-heading)]">
              {language === "ko" ? "발로란트 팀 밸런서" : "Valorant Team Balancer"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {language === "ko" ? "10명의 라이엇 ID를 입력하고 균형 잡힌 5v5를 만드세요" : "Input 10 Riot IDs for balanced 5v5 teams"}
            </p>
          </div>
        </div>

        {/* Input Form */}
        {!currentResult && (
          <div className="space-y-4">
            {/* Region */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Region:</span>
              {REGIONS.map(rg => (
                <button key={rg.value} onClick={() => setRegion(rg.value)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    region === rg.value ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}>{rg.label}</button>
              ))}
              <div className="ml-auto flex gap-1.5">
                <button onClick={() => {
                  const shuffled = [...TEST_PLAYERS].sort(() => Math.random() - 0.5);
                  setInputs(shuffled.slice(0, 10));
                  toast.success("Loaded 10 random Radiant players");
                }} className="px-3 py-1 rounded-lg text-[10px] font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-all">
                  Test Radiants
                </button>
                <button onClick={handlePaste} className="px-3 py-1 rounded-lg text-[10px] font-bold bg-secondary text-muted-foreground hover:text-foreground transition-all">
                  Paste 10
                </button>
              </div>
            </div>

            {/* Player Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {inputs.map((val, idx) => (
                <div key={idx} className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono w-4">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={val}
                    onChange={ev => {
                      const newInputs = [...inputs];
                      newInputs[idx] = ev.target.value;
                      setInputs(newInputs);
                    }}
                    placeholder="Name#TAG"
                    className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-red-500/50 placeholder:text-muted-foreground/40"
                  />
                </div>
              ))}
            </div>

            {/* Balance Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleBalance}
              disabled={loading || !isAuthenticated}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold text-sm disabled:opacity-30 transition-colors shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progress}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Users className="w-4 h-4" />
                  {language === "ko" ? "팀 밸런스" : "BALANCE TEAMS"}
                </span>
              )}
            </motion.button>
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {currentResult && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {/* Win Probability Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-blue-400">Alpha {currentResult.predictedWinRate.teamA}%</span>
                  <span className="text-red-400">{currentResult.predictedWinRate.teamB}% Bravo</span>
                </div>
                <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden flex">
                  <div className="bg-blue-500 transition-all" style={{ width: `${currentResult.predictedWinRate.teamA}%` }} />
                  <div className="bg-red-500 transition-all" style={{ width: `${currentResult.predictedWinRate.teamB}%` }} />
                </div>
                <p className="text-center text-[10px] text-muted-foreground mt-1">
                  Score diff: {currentResult.scoreDiff.toFixed(1)} · Balance #{selectedResult + 1} of {results!.length}
                </p>
              </div>

              {/* Teams */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <TeamCard team={currentResult.teamA} label="Team Alpha" color="blue" score={currentResult.teamAScore} winPct={currentResult.predictedWinRate.teamA} />
                <TeamCard team={currentResult.teamB} label="Team Bravo" color="red" score={currentResult.teamBScore} winPct={currentResult.predictedWinRate.teamB} />
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-center flex-wrap">
                <button onClick={() => setSelectedResult((selectedResult + 1) % results!.length)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-sm font-bold text-muted-foreground hover:text-foreground transition-all">
                  <Shuffle className="w-3.5 h-3.5" /> Re-roll
                </button>
                <button onClick={copyToDiscord}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-sm font-bold text-muted-foreground hover:text-foreground transition-all">
                  <Copy className="w-3.5 h-3.5" /> Discord
                </button>
                <button onClick={() => { setResults(null); setSelectedResult(0); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-sm font-bold text-muted-foreground hover:text-foreground transition-all">
                  New Balance
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
