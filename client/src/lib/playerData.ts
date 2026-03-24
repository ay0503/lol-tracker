// Player data for 목도리 도마뱀#dori (NA)
// Scraped from OP.GG on March 23, 2026

export const PLAYER = {
  name: "목도리 도마뱀",
  tag: "#dori",
  region: "NA",
  level: 387,
  ladderRank: 67890,
  ladderPercent: 6.97,
  profileIcon: "https://opgg-static.akamaized.net/meta/images/profile_icons/profileIcon387.jpg",
};

export const RANKED_SOLO = {
  tier: "Emerald",
  division: 2,
  lp: 39,
  wins: 113,
  losses: 108,
  winRate: 51,
  topTier: "Emerald 2",
  topLP: 59,
};

export const RANKED_FLEX = {
  tier: "Diamond",
  division: 4,
  lp: 21,
  wins: 39,
  losses: 29,
  winRate: 57,
};

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
  // Range: Plat4 0LP (totalLP=0) → Diamond1 100LP (totalLP=1100)
  // Price: $10 → $100
  const clampedLP = Math.max(0, Math.min(1100, totalLP));
  return 10 + (clampedLP / 1100) * 90;
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

// ─── LP History (Short-term from OP.GG tier graph) ───
export const LP_HISTORY: LPDataPoint[] = [
  { date: "Mar 11", tier: "E4", lp: 60, totalLP: 460, label: "E4 60LP" },
  { date: "Mar 12", tier: "E4", lp: 84, totalLP: 484, label: "E4 84LP" },
  { date: "Mar 13", tier: "E4", lp: 85, totalLP: 485, label: "E4 85LP" },
  { date: "Mar 14", tier: "E3", lp: 25, totalLP: 525, label: "E3 25LP" },
  { date: "Mar 15", tier: "E3", lp: 45, totalLP: 545, label: "E3 45LP" },
  { date: "Mar 16", tier: "E4", lp: 61, totalLP: 461, label: "E4 61LP" },
  { date: "Mar 17", tier: "E3", lp: 43, totalLP: 543, label: "E3 43LP" },
  { date: "Mar 18", tier: "E3", lp: 63, totalLP: 563, label: "E3 63LP" },
  { date: "Mar 19", tier: "E2", lp: 3, totalLP: 603, label: "E2 3LP" },
  { date: "Mar 20", tier: "E3", lp: 63, totalLP: 563, label: "E3 63LP" },
  { date: "Mar 21", tier: "E3", lp: 33, totalLP: 533, label: "E3 33LP" },
  { date: "Mar 22", tier: "E3", lp: 73, totalLP: 573, label: "E3 73LP" },
  { date: "Mar 23", tier: "E2", lp: 39, totalLP: 639, label: "E2 39LP" },
].map(d => ({ ...d, price: totalLPToPrice(d.totalLP) }));

// ─── Extended Historical Data (simulated from season history) ───
// S2025 ended at Emerald 4 9LP → totalLP = 409
// S2024 S3 ended at Platinum 3 60LP → totalLP = 160
// S2024 S2 ended at Platinum 2 14LP → totalLP = 214
// S2024 S1 ended at Emerald 4 0LP → totalLP = 400
// S2023 S2 ended at Emerald 4 0LP → totalLP = 400

function generateExtendedHistory(): LPDataPoint[] {
  const points: LPDataPoint[] = [];

  // Generate ~180 days of simulated data (6 months back from Mar 23, 2026)
  // Start from S2025 end (Emerald 4 9LP) and simulate progression to current
  const startDate = new Date(2025, 8, 23); // Sep 23, 2025
  const endDate = new Date(2026, 2, 10); // Mar 10, 2026 (before real data)
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // Key waypoints
  const waypoints = [
    { day: 0, totalLP: 409 },    // S2025 end: E4 9LP
    { day: 30, totalLP: 380 },   // Dip to P1
    { day: 60, totalLP: 420 },   // Climb back
    { day: 90, totalLP: 350 },   // Season reset dip
    { day: 110, totalLP: 400 },  // Recover
    { day: 130, totalLP: 440 },  // Climbing
    { day: 150, totalLP: 420 },  // Small dip
    { day: 165, totalLP: 450 },  // Pre-current
    { day: totalDays, totalLP: 460 }, // Connects to Mar 11 real data
  ];

  for (let day = 0; day <= totalDays; day++) {
    // Interpolate between waypoints
    let prevWP = waypoints[0];
    let nextWP = waypoints[1];
    for (let i = 0; i < waypoints.length - 1; i++) {
      if (day >= waypoints[i].day && day <= waypoints[i + 1].day) {
        prevWP = waypoints[i];
        nextWP = waypoints[i + 1];
        break;
      }
    }

    const progress = (day - prevWP.day) / (nextWP.day - prevWP.day || 1);
    const baseTotalLP = prevWP.totalLP + (nextWP.totalLP - prevWP.totalLP) * progress;
    // Add daily noise
    const noise = Math.sin(day * 0.7) * 15 + Math.cos(day * 1.3) * 10 + (Math.random() - 0.5) * 20;
    const totalLP = Math.max(0, Math.round(baseTotalLP + noise));

    const currentDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateStr = `${months[currentDate.getMonth()]} ${currentDate.getDate()}`;

    // Determine tier/division from totalLP
    const tierIdx = Math.floor(totalLP / 400);
    const divIdx = Math.floor((totalLP % 400) / 100);
    const lp = totalLP % 100;
    const tiers = ["P", "E", "D"];
    const divs = ["4", "3", "2", "1"];
    const tierLabel = tiers[Math.min(tierIdx, 2)] || "E";
    const divLabel = divs[Math.min(divIdx, 3)] || "4";

    points.push({
      date: dateStr,
      tier: `${tierLabel}${divLabel}`,
      lp,
      totalLP,
      label: `${tierLabel}${divLabel} ${lp}LP`,
      price: totalLPToPrice(totalLP),
    });
  }

  return points;
}

export const EXTENDED_LP_HISTORY = generateExtendedHistory();

// Full history = extended + real recent data
export const FULL_LP_HISTORY = [...EXTENDED_LP_HISTORY, ...LP_HISTORY];

// ─── Time Range Helpers ───
export type TimeRange = "1W" | "1M" | "3M" | "6M" | "YTD" | "ALL";

export function getDataForRange(range: TimeRange): LPDataPoint[] {
  const all = FULL_LP_HISTORY;
  const len = all.length;
  switch (range) {
    case "1W": return LP_HISTORY.slice(-7);
    case "1M": return all.slice(-30);
    case "3M": return all.slice(-90);
    case "6M": return all.slice(-180);
    case "YTD": {
      // From Jan 1, 2026
      const ytdStart = all.findIndex(d => d.date.startsWith("Jan") && !d.date.includes("2025"));
      return ytdStart >= 0 ? all.slice(ytdStart) : all.slice(-90);
    }
    case "ALL": return all;
    default: return all;
  }
}

// ─── ETF Definitions ───
export const TICKERS = [
  { symbol: "DORI", name: "DORI", description: "1x LP Tracker", leverage: 1, inverse: false, color: "#00C805" },
  { symbol: "DDRI", name: "DDRI", description: "2x Leveraged LP", leverage: 2, inverse: false, color: "#4CAF50" },
  { symbol: "TDRI", name: "TDRI", description: "3x Leveraged LP", leverage: 3, inverse: false, color: "#8BC34A" },
  { symbol: "SDRI", name: "SDRI", description: "2x Inverse LP", leverage: 2, inverse: true, color: "#FF5252" },
  { symbol: "XDRI", name: "XDRI", description: "3x Inverse LP", leverage: 3, inverse: true, color: "#FF1744" },
] as const;

export function getETFPrice(ticker: string, currentPrice: number, previousPrice: number): number {
  if (previousPrice <= 0) return currentPrice;
  const pctChange = (currentPrice - previousPrice) / previousPrice;
  switch (ticker) {
    case "DORI": return currentPrice;
    case "DDRI": return previousPrice * (1 + pctChange * 2);
    case "TDRI": return previousPrice * (1 + pctChange * 3);
    case "SDRI": return previousPrice * (1 + pctChange * -2);
    case "XDRI": return previousPrice * (1 + pctChange * -3);
    default: return currentPrice;
  }
}

// ─── ETF Price History Generator ───
export interface ETFDataPoint {
  date: string;
  price: number;
  label: string;
}

/**
 * Generate price history for any ETF ticker by applying leverage to base DORI price changes.
 * For DORI, returns the base price directly.
 * For leveraged/inverse ETFs, compounds daily returns with the leverage multiplier.
 */
export function getETFDataForRange(ticker: string, range: TimeRange): ETFDataPoint[] {
  const baseData = getDataForRange(range).map(d => ({
    ...d,
    price: d.price ?? totalLPToPrice(d.totalLP),
  }));

  if (ticker === "DORI" || baseData.length === 0) {
    return baseData.map(d => ({
      date: d.date,
      price: d.price!,
      label: `$${d.price!.toFixed(2)}`,
    }));
  }

  const tickerInfo = TICKERS.find(t => t.symbol === ticker);
  if (!tickerInfo) return [];

  const multiplier = tickerInfo.inverse ? -tickerInfo.leverage : tickerInfo.leverage;

  // Start ETF at the same price as DORI on day 1
  const result: ETFDataPoint[] = [];
  let etfPrice = baseData[0].price!;
  result.push({ date: baseData[0].date, price: etfPrice, label: `$${etfPrice.toFixed(2)}` });

  for (let i = 1; i < baseData.length; i++) {
    const prevBase = baseData[i - 1].price!;
    const currBase = baseData[i].price!;
    if (prevBase <= 0) {
      result.push({ date: baseData[i].date, price: etfPrice, label: `$${etfPrice.toFixed(2)}` });
      continue;
    }
    const dailyReturn = (currBase - prevBase) / prevBase;
    etfPrice = Math.max(0.01, etfPrice * (1 + dailyReturn * multiplier));
    result.push({ date: baseData[i].date, price: etfPrice, label: `$${etfPrice.toFixed(2)}` });
  }

  return result;
}

/**
 * Generate FULL ETF price history (for candlestick chart) by applying leverage to FULL_LP_HISTORY.
 */
export function getFullETFHistory(ticker: string): ETFDataPoint[] {
  if (ticker === "DORI") {
    return FULL_LP_HISTORY.map(d => ({
      date: d.date,
      price: d.price ?? totalLPToPrice(d.totalLP),
      label: `$${(d.price ?? totalLPToPrice(d.totalLP)).toFixed(2)}`,
    }));
  }

  const tickerInfo = TICKERS.find(t => t.symbol === ticker);
  if (!tickerInfo) return [];

  const multiplier = tickerInfo.inverse ? -tickerInfo.leverage : tickerInfo.leverage;
  const baseData = FULL_LP_HISTORY.map(d => ({
    ...d,
    price: d.price ?? totalLPToPrice(d.totalLP),
  }));

  const result: ETFDataPoint[] = [];
  let etfPrice = baseData[0].price;
  result.push({ date: baseData[0].date, price: etfPrice, label: `$${etfPrice.toFixed(2)}` });

  for (let i = 1; i < baseData.length; i++) {
    const prevBase = baseData[i - 1].price;
    const currBase = baseData[i].price;
    if (prevBase <= 0) {
      result.push({ date: baseData[i].date, price: etfPrice, label: `$${etfPrice.toFixed(2)}` });
      continue;
    }
    const dailyReturn = (currBase - prevBase) / prevBase;
    etfPrice = Math.max(0.01, etfPrice * (1 + dailyReturn * multiplier));
    result.push({ date: baseData[i].date, price: etfPrice, label: `$${etfPrice.toFixed(2)}` });
  }

  return result;
}

// ─── Season History ───

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

// ─── Champion Stats ───

export interface ChampionStat {
  name: string;
  cs: string;
  kda: string;
  kdaRatio: number;
  kills: number;
  deaths: number;
  assists: number;
  winRate: number;
  games: number;
  image: string;
}

export const CHAMPION_STATS: ChampionStat[] = [
  {
    name: "Swain",
    cs: "182 (6.2)",
    kda: "5.4 / 6.5 / 10.6",
    kdaRatio: 2.46,
    kills: 5.4,
    deaths: 6.5,
    assists: 10.6,
    winRate: 60,
    games: 77,
    image: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Swain.png",
  },
  {
    name: "Vex",
    cs: "218 (6.9)",
    kda: "9 / 6.8 / 7.6",
    kdaRatio: 2.44,
    kills: 9,
    deaths: 6.8,
    assists: 7.6,
    winRate: 57,
    games: 61,
    image: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Vex.png",
  },
  {
    name: "Yone",
    cs: "228 (7.4)",
    kda: "5.3 / 8.1 / 5.2",
    kdaRatio: 1.29,
    kills: 5.3,
    deaths: 8.1,
    assists: 5.2,
    winRate: 50,
    games: 48,
    image: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Yone.png",
  },
  {
    name: "Ahri",
    cs: "210 (7)",
    kda: "6.6 / 6.4 / 7.5",
    kdaRatio: 2.19,
    kills: 6.6,
    deaths: 6.4,
    assists: 7.5,
    winRate: 40,
    games: 47,
    image: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Ahri.png",
  },
  {
    name: "Naafiri",
    cs: "200 (6.8)",
    kda: "7.3 / 6.6 / 5.9",
    kdaRatio: 2.01,
    kills: 7.3,
    deaths: 6.6,
    assists: 5.9,
    winRate: 57,
    games: 28,
    image: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Naafiri.png",
  },
];

// ─── Match History ───

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

export const MATCH_HISTORY: MatchResult[] = [
  {
    id: 1, timeAgo: "30 min ago", result: "Victory", duration: "26m 08s",
    champion: "Swain", championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Swain.png",
    kills: 6, deaths: 4, assists: 6, kdaRatio: "3.00", cs: "179 (6.8)", tier: "Emerald 3",
    tags: ["5th", "Resilient"], queueType: "Ranked Solo/Duo",
  },
  {
    id: 2, timeAgo: "2 hrs ago", result: "Victory", duration: "33m 22s",
    champion: "Vex", championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Vex.png",
    kills: 10, deaths: 8, assists: 13, kdaRatio: "2.88", cs: "211 (6.3)", tier: "Emerald 3",
    tags: ["Double Kill", "3rd", "Resilient"], queueType: "Ranked Solo/Duo",
  },
  {
    id: 3, timeAgo: "2 hrs ago", result: "Defeat", duration: "41m 53s",
    champion: "Yone", championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Yone.png",
    kills: 8, deaths: 10, assists: 9, kdaRatio: "1.70", cs: "321 (7.7)", tier: "Emerald 3",
    tags: ["Double Kill", "8th", "Struggle"], queueType: "Ranked Solo/Duo",
  },
  {
    id: 4, timeAgo: "3 hrs ago", result: "Defeat", duration: "33m 02s",
    champion: "Naafiri", championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Naafiri.png",
    kills: 5, deaths: 7, assists: 9, kdaRatio: "2.00", cs: "202 (6.1)", tier: "Platinum 1",
    tags: ["Double Kill", "ACE", "Unlucky"], queueType: "Ranked Solo/Duo",
  },
  {
    id: 5, timeAgo: "4 hrs ago", result: "Defeat", duration: "35m 21s",
    champion: "Naafiri", championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Naafiri.png",
    kills: 8, deaths: 10, assists: 9, kdaRatio: "1.70", cs: "215 (6.1)", tier: "Emerald 3",
    tags: ["Double Kill", "8th", "Downfall"], queueType: "Ranked Solo/Duo",
  },
  {
    id: 6, timeAgo: "6 hrs ago", result: "Victory", duration: "29m 02s",
    champion: "Swain", championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Swain.png",
    kills: 4, deaths: 4, assists: 4, kdaRatio: "2.00", cs: "216 (7.4)", tier: "Emerald 2",
    tags: ["5th", "Average"], queueType: "Ranked Solo/Duo",
  },
  {
    id: 7, timeAgo: "7 hrs ago", result: "Defeat", duration: "28m 39s",
    champion: "Yone", championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Yone.png",
    kills: 8, deaths: 7, assists: 1, kdaRatio: "1.29", cs: "197 (6.9)", tier: "Emerald 2",
    tags: ["Double Kill", "ACE", "Unyielding"], queueType: "Ranked Solo/Duo",
  },
  {
    id: 8, timeAgo: "8 hrs ago", result: "Victory", duration: "25m 40s",
    champion: "Swain", championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Swain.png",
    kills: 6, deaths: 1, assists: 9, kdaRatio: "15.00", cs: "206 (8.0)", tier: "Emerald 2",
    tags: ["2nd", "Unstoppable"], queueType: "Ranked Solo/Duo",
  },
  {
    id: 9, timeAgo: "1 day ago", result: "Victory", duration: "31m 37s",
    champion: "Swain", championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Swain.png",
    kills: 9, deaths: 6, assists: 22, kdaRatio: "5.17", cs: "210 (6.6)", tier: "Emerald 4",
    tags: ["Double Kill", "MVP", "Late bloomer"], queueType: "Ranked Solo/Duo",
  },
  {
    id: 10, timeAgo: "1 day ago", result: "Defeat", duration: "30m 24s",
    champion: "Ahri", championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Ahri.png",
    kills: 5, deaths: 6, assists: 5, kdaRatio: "1.67", cs: "224 (7.4)", tier: "Emerald 2",
    tags: ["Double Kill", "8th", "Struggle"], queueType: "Ranked Solo/Duo",
  },
  {
    id: 11, timeAgo: "1 day ago", result: "Victory", duration: "34m 02s",
    champion: "Vex", championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Vex.png",
    kills: 11, deaths: 3, assists: 13, kdaRatio: "8.00", cs: "259 (7.6)", tier: "Platinum 1",
    tags: ["Triple Kill", "2nd", "Unstoppable"], queueType: "Ranked Solo/Duo",
  },
  {
    id: 12, timeAgo: "1 day ago", result: "Victory", duration: "31m 43s",
    champion: "Naafiri", championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Naafiri.png",
    kills: 12, deaths: 12, assists: 10, kdaRatio: "1.83", cs: "210 (6.6)", tier: "Emerald 4",
    tags: ["Double Kill", "4th", "Rollercoaster"], queueType: "Ranked Solo/Duo",
  },
  {
    id: 13, timeAgo: "1 day ago", result: "Victory", duration: "16m 40s",
    champion: "Ahri", championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Ahri.png",
    kills: 5, deaths: 0, assists: 4, kdaRatio: "Perfect", cs: "146 (8.8)", tier: "Emerald 3",
    tags: ["3rd", "Unstoppable"], queueType: "Ranked Solo/Duo",
  },
  {
    id: 14, timeAgo: "1 day ago", result: "Victory", duration: "24m 54s",
    champion: "Swain", championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Swain.png",
    kills: 3, deaths: 6, assists: 7, kdaRatio: "1.67", cs: "133 (5.3)", tier: "Emerald 3",
    tags: ["7th", "Resilient"], queueType: "Ranked Solo/Duo",
  },
  {
    id: 15, timeAgo: "1 day ago", result: "Defeat", duration: "34m 16s",
    champion: "Naafiri", championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Naafiri.png",
    kills: 2, deaths: 14, assists: 9, kdaRatio: "0.79", cs: "177 (5.2)", tier: "Emerald 2",
    tags: ["10th", "Unyielding"], queueType: "Ranked Solo/Duo",
  },
];

// Win/Loss sequence (newest first): W, W, L, L, L, W, L, W, W, L, W, W, W, W, L
export const WIN_LOSS_SEQUENCE = [
  "W", "W", "L", "L", "L", "W", "L", "W", "W", "L", "W", "W", "W", "W", "L"
];

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

export const RECENT_7_DAYS = [
  { champion: "Swain", wins: 10, losses: 3, winRate: 77, image: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Swain.png" },
  { champion: "Naafiri", wins: 5, losses: 7, winRate: 42, image: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Naafiri.png" },
  { champion: "Yone", wins: 3, losses: 1, winRate: 75, image: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Yone.png" },
  { champion: "Ahri", wins: 2, losses: 2, winRate: 50, image: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Ahri.png" },
  { champion: "Vex", wins: 2, losses: 1, winRate: 67, image: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Vex.png" },
];
