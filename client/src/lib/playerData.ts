/**
 * Player data utilities and type definitions.
 * Static data has been removed — all live data comes from the backend polling engine.
 * Only types, utility functions, ETF ticker metadata, and past season history remain.
 */

// ─── LP-to-Price Mapping ───
// Plat 4 0LP = $10, Diamond 1 100LP = $100
// Linear scale: each LP point in the Plat4→Diamond1 range = ~$0.1125

const TIER_ORDER: Record<string, number> = {
  PLATINUM: 0, Platinum: 0,
  EMERALD: 1, Emerald: 1,
  DIAMOND: 2, Diamond: 2,
};

const DIVISION_ORDER: Record<string, number> = {
  IV: 0, "4": 0,
  III: 1, "3": 1,
  II: 2, "2": 2,
  I: 3, "1": 3,
};

export function tierToTotalLP(tier: string, division: string | number, lp: number): number {
  const tierIdx = TIER_ORDER[tier] ?? 0;
  const divIdx = typeof division === "number" ? (4 - division) : (DIVISION_ORDER[String(division)] ?? 0);
  return tierIdx * 400 + divIdx * 100 + lp;
}

export function totalLPToPrice(totalLP: number): number {
  // Must match server-side formula in riotApi.ts: 0–1200 LP → $10–$100
  const clampedLP = Math.max(0, Math.min(1200, totalLP));
  return 10 + (clampedLP / 1200) * 90;
}

export function lpDataToPrice(d: LPDataPoint): number {
  return totalLPToPrice(d.totalLP);
}

// ─── Data Types ───

export interface LPDataPoint {
  date: string;
  tier: string;
  lp: number;
  totalLP: number;
  label: string;
  price?: number;
}

export type TimeRange = "3H" | "6H" | "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "ALL";

export interface ETFDataPoint {
  date: string;
  price: number;
  label: string;
}

// ─── ETF Definitions ───
export const TICKERS = [
  { symbol: "DORI", name: "DORI", description: "1x LP Tracker", leverage: 1, inverse: false, color: "#00C805" },
  { symbol: "DDRI", name: "DDRI", description: "2x Leveraged LP", leverage: 2, inverse: false, color: "#4CAF50" },
  { symbol: "TDRI", name: "TDRI", description: "3x Leveraged LP", leverage: 3, inverse: false, color: "#8BC34A" },
  { symbol: "SDRI", name: "SDRI", description: "2x Inverse LP", leverage: 2, inverse: true, color: "#FF5252" },
  { symbol: "XDRI", name: "XDRI", description: "3x Inverse LP", leverage: 3, inverse: true, color: "#FF1744" },
] as const;

// ─── Season History (static — no Riot API for past seasons) ───

export interface SeasonTier {
  season: string;
  tier: string;
  lp: number;
}

export const SEASON_HISTORY: SeasonTier[] = [
  { season: "S2025", tier: "Emerald 4", lp: 9 },
  { season: "S2024 S3", tier: "Platinum 3", lp: 60 },
  { season: "S2024 S2", tier: "Platinum 2", lp: 14 },
  { season: "S2024 S1", tier: "Emerald 4", lp: 0 },
  { season: "S2023 S2", tier: "Emerald 4", lp: 0 },
];

// ─── Match Types ───

export interface MatchResult {
  id: number;
  timeAgo: string;
  result: "Victory" | "Defeat" | "Remake";
  duration: string;
  champion: string;
  championImage: string;
  kills: number;
  deaths: number;
  assists: number;
  kdaRatio: string;
  cs: string;
  tier: string;
  tags: string[];
  queueType: string;
}

// ─── Streak Utilities ───

export interface Streak {
  type: "win" | "loss";
  count: number;
  startIndex: number;
  endIndex: number;
}

export function calculateStreaks(sequence: string[]): Streak[] {
  const streaks: Streak[] = [];
  let i = 0;
  while (i < sequence.length) {
    const type = sequence[i] === "W" ? "win" : "loss";
    let count = 0;
    const startIndex = i;
    while (i < sequence.length && sequence[i] === (type === "win" ? "W" : "L")) {
      count++;
      i++;
    }
    streaks.push({ type, count, startIndex, endIndex: i - 1 });
  }
  return streaks;
}
