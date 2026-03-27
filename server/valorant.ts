/**
 * Valorant Team Balancer — API client + balancing algorithm.
 * Uses Henrik's unofficial Valorant API (api.henrikdev.xyz).
 */

import { cache } from "./cache";

const HENRIK_BASE = "https://api.henrikdev.xyz/valorant";
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

// ─── Types ───

export interface PlayerProfile {
  riotId: string;
  name: string;
  tag: string;
  region: string;
  rank: string;
  rankTier: number;
  rr: number;
  elo: number;
  avgACS: number;
  avgKD: number;
  avgADR: number;
  hsPercent: number;
  winRate: number;
  gamesAnalyzed: number;
  topAgents: { agent: string; games: number; winRate: number }[];
  primaryRole: string;
  overallScore: number;
  error?: string;
}

export interface TeamResult {
  teamA: PlayerProfile[];
  teamB: PlayerProfile[];
  scoreDiff: number;
  teamAScore: number;
  teamBScore: number;
  predictedWinRate: { teamA: number; teamB: number };
}

// ─── Henrik API Client ───

async function henrikFetch(path: string): Promise<any> {
  const apiKey = process.env.HENRIK_API_KEY;
  const url = `${HENRIK_BASE}${path}`;
  const headers: Record<string, string> = { "User-Agent": "DORI-TeamBalancer/1.0" };
  if (apiKey) headers["Authorization"] = apiKey;

  console.log(`[Valorant] Fetching: ${url}`);

  try {
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    console.log(`[Valorant] Response: ${resp.status} ${resp.statusText}`);

    if (resp.status === 429) {
      const retryAfter = parseInt(resp.headers.get("retry-after") || "5");
      console.log(`[Valorant] Rate limited, waiting ${retryAfter}s`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return henrikFetch(path);
    }

    const text = await resp.text();

    if (!resp.ok) {
      console.error(`[Valorant] Error response: ${text.slice(0, 300)}`);
      throw new Error(`Henrik API ${resp.status}: ${text.slice(0, 200)}`);
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      console.error(`[Valorant] Failed to parse JSON: ${text.slice(0, 300)}`);
      throw new Error("Invalid JSON response from Henrik API");
    }

    console.log(`[Valorant] Response status field: ${json.status}, has data: ${!!json.data}`);
    return json.data ?? json;
  } catch (err: any) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new Error("Henrik API request timed out (15s)");
    }
    throw err;
  }
}

// ─── Fetch Player Stats ───

export async function fetchPlayerProfile(name: string, tag: string, region: string): Promise<PlayerProfile> {
  const cacheKey = `valorant.player.${name}#${tag}`;
  const cached = cache.get<PlayerProfile>(cacheKey);
  if (cached) return cached;

  const emptyProfile: PlayerProfile = {
    riotId: `${name}#${tag}`, name, tag, region,
    rank: "Unranked", rankTier: 0, rr: 0, elo: 0,
    avgACS: 0, avgKD: 0, avgADR: 0, hsPercent: 0, winRate: 0, gamesAnalyzed: 0,
    topAgents: [], primaryRole: "Flex", overallScore: 0,
  };

  // Fetch MMR (rank, RR, elo)
  let mmrData: any = null;
  try {
    mmrData = await henrikFetch(`/v2/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
    console.log(`[Valorant] MMR raw:`, JSON.stringify(mmrData).slice(0, 200));
  } catch (err: any) {
    console.error(`[Valorant] MMR failed for ${name}#${tag}: ${err.message}`);
  }

  // Wait between requests
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Fetch match history
  let matches: any[] = [];
  try {
    const matchData = await henrikFetch(`/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?mode=competitive&size=10`);
    if (Array.isArray(matchData)) {
      matches = matchData;
    } else if (matchData && typeof matchData === "object") {
      // Some responses wrap in a different structure
      matches = matchData.data || matchData.matches || [];
    }
    console.log(`[Valorant] ${name}#${tag}: ${matches.length} matches found`);
  } catch (err: any) {
    console.error(`[Valorant] Matches failed for ${name}#${tag}: ${err.message}`);
  }

  // Wait between players
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Parse MMR — handle both v2 response formats
  let rank = "Unranked", rankTier = 0, rr = 0, elo = 0;
  if (mmrData) {
    // v2 format: { current_data: { currenttierpatched, currenttier, ranking_in_tier, elo } }
    const cd = mmrData.current_data || mmrData;
    rank = cd.currenttierpatched || cd.current_tier_patched || "Unranked";
    rankTier = cd.currenttier || cd.current_tier || 0;
    rr = cd.ranking_in_tier || cd.rr || 0;
    elo = cd.elo || (rankTier * 100 + rr);
    console.log(`[Valorant] Parsed MMR: rank=${rank}, tier=${rankTier}, rr=${rr}, elo=${elo}`);
  }

  // Analyze matches
  let totalACS = 0, totalKills = 0, totalDeaths = 0, totalDamage = 0, totalRounds = 0;
  let totalHS = 0, totalShots = 0, wins = 0;
  const agentCounts = new Map<string, { games: number; wins: number }>();

  for (const match of matches) {
    try {
      const players = match?.players?.all_players || [];
      // Find this player in the match — try multiple matching strategies
      const me = players.find((p: any) => {
        const pName = (p.name || "").toLowerCase();
        const pTag = (p.tag || "").toLowerCase();
        return pName === name.toLowerCase() && pTag === tag.toLowerCase();
      });

      if (!me) continue;

      const stats = me.stats || {};
      const roundsPlayed = match.metadata?.rounds_played || match.metadata?.roundsplayed || 1;
      const acs = stats.score ? stats.score / roundsPlayed : 0;
      totalACS += acs;
      totalKills += stats.kills || 0;
      totalDeaths += Math.max(stats.deaths || 1, 1);
      totalDamage += me.damage_made || me.damage || 0;
      totalRounds += roundsPlayed;
      totalHS += stats.headshots || 0;
      totalShots += (stats.headshots || 0) + (stats.bodyshots || 0) + (stats.legshots || 0) || 1;

      const myTeam = (me.team || "").toLowerCase();
      const teamData = match.teams?.[myTeam] || match.teams?.red || match.teams?.blue;
      const won = teamData?.has_won ?? false;
      if (won) wins++;

      const agent = me.character || me.agent?.name || "Unknown";
      const ac = agentCounts.get(agent) || { games: 0, wins: 0 };
      ac.games++;
      if (won) ac.wins++;
      agentCounts.set(agent, ac);
    } catch (matchErr) {
      // Skip malformed match
      continue;
    }
  }

  const gamesAnalyzed = Math.max(matches.length, 1);
  const avgACS = Math.round(totalACS / gamesAnalyzed);
  const avgKD = Math.round((totalKills / Math.max(totalDeaths, 1)) * 100) / 100;
  const avgADR = totalRounds > 0 ? Math.round(totalDamage / totalRounds) : 0;
  const hsPercent = totalShots > 0 ? Math.round((totalHS / totalShots) * 1000) / 10 : 0;
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 1000) / 10 : 0;

  // Top agents
  const topAgents = Array.from(agentCounts.entries())
    .map(([agent, data]) => ({
      agent,
      games: data.games,
      winRate: Math.round((data.wins / Math.max(data.games, 1)) * 100),
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 3);

  // Primary role
  const AGENT_ROLES: Record<string, string> = {
    Jett: "Duelist", Reyna: "Duelist", Raze: "Duelist", Phoenix: "Duelist", Yoru: "Duelist", Neon: "Duelist", Iso: "Duelist",
    Sage: "Sentinel", Cypher: "Sentinel", Killjoy: "Sentinel", Chamber: "Sentinel", Deadlock: "Sentinel", Vyse: "Sentinel",
    Brimstone: "Controller", Omen: "Controller", Viper: "Controller", Astra: "Controller", Harbor: "Controller", Clove: "Controller",
    Sova: "Initiator", Breach: "Initiator", Skye: "Initiator", "KAY/O": "Initiator", Fade: "Initiator", Gekko: "Initiator",
  };

  const roleCounts = new Map<string, number>();
  for (const [agent, data] of Array.from(agentCounts.entries())) {
    const role = AGENT_ROLES[agent] || "Flex";
    roleCounts.set(role, (roleCounts.get(role) || 0) + data.games);
  }
  let primaryRole = "Flex";
  let maxRoleGames = 0;
  for (const [role, count] of Array.from(roleCounts.entries())) {
    if (count > maxRoleGames) { primaryRole = role; maxRoleGames = count; }
  }

  // Composite score
  const normalizedRank = Math.min(rankTier / 27, 1);
  const normalizedACS = Math.min(avgACS / 300, 1);
  const normalizedKD = Math.min(avgKD / 2, 1);
  const normalizedWR = winRate / 100;
  const normalizedHS = Math.min(hsPercent / 30, 1);

  const overallScore = Math.round(
    (normalizedRank * 35 + normalizedACS * 25 + normalizedKD * 20 + normalizedWR * 15 + normalizedHS * 5) * 100
  ) / 100;

  const profile: PlayerProfile = {
    riotId: `${name}#${tag}`, name, tag, region,
    rank, rankTier, rr, elo,
    avgACS, avgKD, avgADR, hsPercent, winRate, gamesAnalyzed: matches.length,
    topAgents, primaryRole, overallScore,
  };

  cache.set(cacheKey, profile, CACHE_TTL);
  console.log(`[Valorant] Profile built: ${name}#${tag} → score=${overallScore}, rank=${rank}, ACS=${avgACS}, games=${matches.length}`);
  return profile;
}

// ─── Team Balancing ───

export function balanceTeams(players: PlayerProfile[]): TeamResult[] {
  if (players.length !== 10) throw new Error("Need exactly 10 players");

  const results: TeamResult[] = [];
  const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  function combine(start: number, combo: number[]) {
    if (combo.length === 5) {
      const teamAIdx = [...combo];
      const teamBIdx = indices.filter(idx => !combo.includes(idx));
      const teamA = teamAIdx.map(idx => players[idx]);
      const teamB = teamBIdx.map(idx => players[idx]);

      const teamAScore = teamA.reduce((s, p) => s + p.overallScore, 0);
      const teamBScore = teamB.reduce((s, p) => s + p.overallScore, 0);
      const scoreDiff = Math.abs(teamAScore - teamBScore);

      const roleCount = (team: PlayerProfile[]) => {
        const counts = new Map<string, number>();
        for (const p of team) counts.set(p.primaryRole, (counts.get(p.primaryRole) || 0) + 1);
        let penalty = 0;
        for (const [, count] of Array.from(counts.entries())) {
          if (count >= 3) penalty += (count - 2) * 2;
        }
        return penalty;
      };

      const totalPenalty = roleCount(teamA) + roleCount(teamB);
      const adjustedDiff = scoreDiff + totalPenalty;
      const totalScore = teamAScore + teamBScore;
      const teamAWin = totalScore > 0 ? Math.round((teamAScore / totalScore) * 100) : 50;

      results.push({
        teamA, teamB,
        scoreDiff: Math.round(adjustedDiff * 100) / 100,
        teamAScore: Math.round(teamAScore * 100) / 100,
        teamBScore: Math.round(teamBScore * 100) / 100,
        predictedWinRate: { teamA: teamAWin, teamB: 100 - teamAWin },
      });
      return;
    }
    for (let i = start; i <= 9; i++) {
      combine(i + 1, [...combo, i]);
    }
  }

  combine(0, []);
  results.sort((a, b) => a.scoreDiff - b.scoreDiff);
  return results.slice(0, 5);
}
