/**
 * Riot Games API integration service.
 * Handles all communication with the Riot API for summoner data,
 * ranked stats, and match history.
 */
import axios from "axios";
import { ENV } from "./_core/env";

// Read API key dynamically so it picks up env changes without restart
function getRiotApiKey() {
  return process.env.RIOT_API_KEY || "";
}

// Base URLs
const AMERICAS_URL = "https://americas.api.riotgames.com";
const NA1_URL = "https://na1.api.riotgames.com";

// Default headers
function headers() {
  return { "X-Riot-Token": getRiotApiKey() };
}

// ─── Types ───

export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface Summoner {
  id: string;
  accountId: string;
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

export interface LeagueEntry {
  queueType: string;
  tier: string;
  rank: string; // "I", "II", "III", "IV"
  leaguePoints: number;
  wins: number;
  losses: number;
  leagueId: string;
  summonerId: string;
  veteran: boolean;
  inactive: boolean;
  freshBlood: boolean;
  hotStreak: boolean;
}

export interface MatchParticipant {
  puuid: string;
  summonerName: string;
  riotIdGameName: string;
  riotIdTagline: string;
  championName: string;
  champLevel: number;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  win: boolean;
  teamId: number;
  individualPosition: string;
  teamPosition: string;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
}

export interface MatchInfo {
  gameId: number;
  gameDuration: number;
  gameCreation: number;
  gameEndTimestamp: number;
  gameMode: string;
  gameType: string;
  queueId: number;
  participants: MatchParticipant[];
}

export interface MatchData {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: MatchInfo;
}

// ─── API Calls ───

/**
 * Step 1: Get PUUID from Riot ID (gameName + tagLine)
 */
export async function getAccountByRiotId(
  gameName: string,
  tagLine: string
): Promise<RiotAccount> {
  const url = `${AMERICAS_URL}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const res = await axios.get<RiotAccount>(url, { headers: headers() });
  return res.data;
}

/**
 * Step 2: Get summoner data from PUUID
 */
export async function getSummonerByPuuid(puuid: string): Promise<Summoner> {
  const url = `${NA1_URL}/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  const res = await axios.get<Summoner>(url, { headers: headers() });
  return res.data;
}

/**
 * Step 3: Get ranked entries for a player (by PUUID)
 */
export async function getLeagueEntries(
  puuid: string
): Promise<LeagueEntry[]> {
  const url = `${NA1_URL}/lol/league/v4/entries/by-puuid/${puuid}`;
  const res = await axios.get<LeagueEntry[]>(url, { headers: headers() });
  return res.data;
}

/**
 * Step 4a: Get match IDs for a player
 */
export async function getMatchIds(
  puuid: string,
  count = 20,
  queue?: number,
  start = 0
): Promise<string[]> {
  const params: Record<string, any> = { count, start };
  if (queue !== undefined) params.queue = queue;
  const url = `${AMERICAS_URL}/lol/match/v5/matches/by-puuid/${puuid}/ids`;
  const res = await axios.get<string[]>(url, { headers: headers(), params });
  return res.data;
}

/**
 * Step 4b: Get full match details
 */
export async function getMatchDetails(matchId: string): Promise<MatchData> {
  const url = `${AMERICAS_URL}/lol/match/v5/matches/${matchId}`;
  const res = await axios.get<MatchData>(url, { headers: headers() });
  return res.data;
}

// ─── Tier/LP Conversion ───

/**
 * LP-to-Stock-Price mapping.
 * 
 * Range: Platinum 4 (0 LP) = $10.00 → Diamond 1 (100 LP) = $100.00
 * 
 * Tier ladder (each tier has 4 divisions, each division = 100 LP):
 *   Platinum 4 → Platinum 1: divisions 0-3 (0-400 LP total from P4 0LP)
 *   Emerald 4 → Emerald 1: divisions 4-7 (400-800 LP total)
 *   Diamond 4 → Diamond 1: divisions 8-11 (800-1200 LP total)
 * 
 * Total LP range: 0 (P4 0LP) to 1200 (D1 100LP)
 * Price range: $10.00 to $100.00
 * Scale: price = 10 + (totalLP / 1200) * 90
 */

const TIER_ORDER: Record<string, number> = {
  IRON: 0,
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
  PLATINUM: 4,
  EMERALD: 5,
  DIAMOND: 6,
  MASTER: 7,
  GRANDMASTER: 8,
  CHALLENGER: 9,
};

const DIVISION_ORDER: Record<string, number> = {
  IV: 0,
  III: 1,
  II: 2,
  I: 3,
};

/**
 * Convert tier + division + LP into a total LP value
 * relative to Platinum 4 as the baseline (0).
 */
export function tierToTotalLP(
  tier: string,
  division: string,
  lp: number
): number {
  const tierIdx = TIER_ORDER[tier.toUpperCase()] ?? 4;
  const divIdx = DIVISION_ORDER[division] ?? 0;

  // Platinum 4 is our baseline (tier 4, div 0)
  const baseTierIdx = TIER_ORDER["PLATINUM"];
  const totalDivisionsFromBase = (tierIdx - baseTierIdx) * 4 + divIdx;

  return Math.max(0, totalDivisionsFromBase * 100 + lp);
}

/**
 * Convert total LP (relative to P4 baseline) to stock price.
 * P4 0LP = $10, D1 100LP = $100
 */
export function totalLPToPrice(totalLP: number): number {
  const maxLP = 1200; // D1 100LP
  const minPrice = 10;
  const maxPrice = 100;
  const clampedLP = Math.max(0, Math.min(totalLP, maxLP));
  return minPrice + (clampedLP / maxLP) * (maxPrice - minPrice);
}

/**
 * Convert tier + division + LP directly to stock price.
 */
export function tierToPrice(
  tier: string,
  division: string,
  lp: number
): number {
  return totalLPToPrice(tierToTotalLP(tier, division, lp));
}

/**
 * Convert a stock price back to a tier label for display.
 */
export function priceToTierLabel(price: number): string {
  const maxLP = 1200;
  const minPrice = 10;
  const maxPrice = 100;
  const totalLP = ((price - minPrice) / (maxPrice - minPrice)) * maxLP;
  const clampedLP = Math.max(0, Math.min(totalLP, maxLP));

  const baseTierIdx = TIER_ORDER["PLATINUM"];
  const totalDivisions = Math.floor(clampedLP / 100);
  const remainingLP = Math.round(clampedLP % 100);

  const tierIdx = baseTierIdx + Math.floor(totalDivisions / 4);
  const divIdx = totalDivisions % 4;

  const tierNames = Object.entries(TIER_ORDER);
  const tierName =
    tierNames.find(([, v]) => v === tierIdx)?.[0] || "PLATINUM";
  const divNames = Object.entries(DIVISION_ORDER);
  const divName = divNames.find(([, v]) => v === divIdx)?.[0] || "IV";

  return `${tierName.charAt(0)}${tierName.slice(1).toLowerCase()} ${divName} ${remainingLP}LP`;
}

// ─── Spectator / Live Game ───

export interface CurrentGameParticipant {
  puuid: string;
  summonerId: string;
  championId: number;
  teamId: number;
  spell1Id: number;
  spell2Id: number;
}

export interface CurrentGameInfo {
  gameId: number;
  gameType: string;
  gameStartTime: number;
  mapId: number;
  gameLength: number; // seconds since game started
  gameMode: string;
  gameQueueConfigId: number;
  participants: CurrentGameParticipant[];
}

/**
 * Check if a player is currently in a live game using the Spectator v5 API.
 * Returns the game info if in game, or null if not.
 */
export async function getActiveGame(puuid: string): Promise<CurrentGameInfo | null> {
  try {
    const url = `${NA1_URL}/lol/spectator/v5/active-games/by-summoner/${puuid}`;
    const res = await axios.get<CurrentGameInfo>(url, { headers: headers() });
    return res.data;
  } catch (err: any) {
    // 404 means player is not in a game
    if (err?.response?.status === 404) return null;
    console.warn("[RiotAPI] Spectator check failed:", err?.message);
    return null;
  }
}

// Queue ID to human-readable game mode
const QUEUE_NAMES: Record<number, string> = {
  420: "Ranked Solo/Duo",
  440: "Ranked Flex",
  400: "Normal Draft",
  430: "Normal Blind",
  450: "ARAM",
  490: "Quickplay",
  700: "Clash",
  900: "URF",
  1020: "One for All",
  1300: "Nexus Blitz",
  1400: "Ultimate Spellbook",
  1700: "Arena",
  1900: "Pick URF",
};

export function getQueueName(queueId: number): string {
  return QUEUE_NAMES[queueId] || `Queue ${queueId}`;
}

// ─── Composite Fetchers ───

/**
 * Fetch all player data in one call: account, summoner, ranked, recent matches.
 */
export async function fetchFullPlayerData(gameName: string, tagLine: string) {
  // 1. Get PUUID
  const account = await getAccountByRiotId(gameName, tagLine);

  // 2. Get summoner info
  const summoner = await getSummonerByPuuid(account.puuid);

  // 3. Get ranked entries (using PUUID directly)
  const leagueEntries = await getLeagueEntries(account.puuid);

  // Find solo/duo and flex entries
  const soloEntry = leagueEntries.find(
    (e) => e.queueType === "RANKED_SOLO_5x5"
  );
  const flexEntry = leagueEntries.find(
    (e) => e.queueType === "RANKED_FLEX_SR"
  );

  // 4. Calculate current stock price
  const currentPrice = soloEntry
    ? tierToPrice(soloEntry.tier, soloEntry.rank, soloEntry.leaguePoints)
    : 10;

  return {
    account,
    summoner,
    soloEntry,
    flexEntry,
    currentPrice,
  };
}

/**
 * Fetch recent match history with details.
 * Rate-limited: fetches details one at a time.
 */
export async function fetchRecentMatches(
  puuid: string,
  count = 15,
  queue = 420 // ranked solo/duo
) {
  const matchIds = await getMatchIds(puuid, count, queue);

  const matches: MatchData[] = [];
  for (const id of matchIds) {
    try {
      const match = await getMatchDetails(id);
      matches.push(match);
      // Small delay to respect rate limits (20 req/sec for dev key)
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      console.warn(`[RiotAPI] Failed to fetch match ${id}:`, err);
    }
  }

  return matches;
}
