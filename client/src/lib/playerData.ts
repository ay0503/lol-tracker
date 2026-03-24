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

export interface LPDataPoint {
  date: string;
  tier: string;
  lp: number;
  totalLP: number;
  label: string;
}

// LP history from tier graph (daily)
// Total LP: E4=0+LP, E3=100+LP, E2=200+LP, E1=300+LP
export const LP_HISTORY: LPDataPoint[] = [
  { date: "Mar 11", tier: "E4", lp: 60, totalLP: 60, label: "E4 60LP" },
  { date: "Mar 12", tier: "E4", lp: 84, totalLP: 84, label: "E4 84LP" },
  { date: "Mar 13", tier: "E4", lp: 85, totalLP: 85, label: "E4 85LP" },
  { date: "Mar 14", tier: "E3", lp: 25, totalLP: 125, label: "E3 25LP" },
  { date: "Mar 15", tier: "E3", lp: 45, totalLP: 145, label: "E3 45LP" },
  { date: "Mar 16", tier: "E4", lp: 61, totalLP: 61, label: "E4 61LP" },
  { date: "Mar 17", tier: "E3", lp: 43, totalLP: 143, label: "E3 43LP" },
  { date: "Mar 18", tier: "E3", lp: 63, totalLP: 163, label: "E3 63LP" },
  { date: "Mar 19", tier: "E2", lp: 3, totalLP: 203, label: "E2 3LP" },
  { date: "Mar 20", tier: "E3", lp: 63, totalLP: 163, label: "E3 63LP" },
  { date: "Mar 21", tier: "E3", lp: 33, totalLP: 133, label: "E3 33LP" },
  { date: "Mar 22", tier: "E3", lp: 73, totalLP: 173, label: "E3 73LP" },
  { date: "Mar 23", tier: "E2", lp: 39, totalLP: 239, label: "E2 39LP" },
];

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
    id: 1,
    timeAgo: "30 min ago",
    result: "Victory",
    duration: "26m 08s",
    champion: "Swain",
    championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Swain.png",
    kills: 6,
    deaths: 4,
    assists: 6,
    kdaRatio: "3.00",
    cs: "179 (6.8)",
    tier: "Emerald 3",
    tags: ["5th", "Resilient"],
    queueType: "Ranked Solo/Duo",
  },
  {
    id: 2,
    timeAgo: "2 hrs ago",
    result: "Victory",
    duration: "33m 22s",
    champion: "Vex",
    championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Vex.png",
    kills: 10,
    deaths: 8,
    assists: 13,
    kdaRatio: "2.88",
    cs: "211 (6.3)",
    tier: "Emerald 3",
    tags: ["Double Kill", "3rd", "Resilient"],
    queueType: "Ranked Solo/Duo",
  },
  {
    id: 3,
    timeAgo: "2 hrs ago",
    result: "Defeat",
    duration: "41m 53s",
    champion: "Yone",
    championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Yone.png",
    kills: 8,
    deaths: 10,
    assists: 9,
    kdaRatio: "1.70",
    cs: "321 (7.7)",
    tier: "Emerald 3",
    tags: ["Double Kill", "8th", "Struggle"],
    queueType: "Ranked Solo/Duo",
  },
  {
    id: 4,
    timeAgo: "3 hrs ago",
    result: "Defeat",
    duration: "33m 02s",
    champion: "Naafiri",
    championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Naafiri.png",
    kills: 5,
    deaths: 7,
    assists: 9,
    kdaRatio: "2.00",
    cs: "202 (6.1)",
    tier: "Platinum 1",
    tags: ["Double Kill", "ACE", "Unlucky"],
    queueType: "Ranked Solo/Duo",
  },
  {
    id: 5,
    timeAgo: "4 hrs ago",
    result: "Defeat",
    duration: "35m 21s",
    champion: "Naafiri",
    championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Naafiri.png",
    kills: 8,
    deaths: 10,
    assists: 9,
    kdaRatio: "1.70",
    cs: "215 (6.1)",
    tier: "Emerald 3",
    tags: ["Double Kill", "8th", "Downfall"],
    queueType: "Ranked Solo/Duo",
  },
  {
    id: 6,
    timeAgo: "6 hrs ago",
    result: "Victory",
    duration: "29m 02s",
    champion: "Swain",
    championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Swain.png",
    kills: 4,
    deaths: 4,
    assists: 4,
    kdaRatio: "2.00",
    cs: "216 (7.4)",
    tier: "Emerald 2",
    tags: ["5th", "Average"],
    queueType: "Ranked Solo/Duo",
  },
  {
    id: 7,
    timeAgo: "7 hrs ago",
    result: "Defeat",
    duration: "28m 39s",
    champion: "Yone",
    championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Yone.png",
    kills: 8,
    deaths: 7,
    assists: 1,
    kdaRatio: "1.29",
    cs: "197 (6.9)",
    tier: "Emerald 2",
    tags: ["Double Kill", "ACE", "Unyielding"],
    queueType: "Ranked Solo/Duo",
  },
  {
    id: 8,
    timeAgo: "8 hrs ago",
    result: "Victory",
    duration: "25m 40s",
    champion: "Swain",
    championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Swain.png",
    kills: 6,
    deaths: 1,
    assists: 9,
    kdaRatio: "15.00",
    cs: "206 (8.0)",
    tier: "Emerald 2",
    tags: ["2nd", "Unstoppable"],
    queueType: "Ranked Solo/Duo",
  },
  {
    id: 9,
    timeAgo: "1 day ago",
    result: "Victory",
    duration: "31m 37s",
    champion: "Swain",
    championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Swain.png",
    kills: 9,
    deaths: 6,
    assists: 22,
    kdaRatio: "5.17",
    cs: "210 (6.6)",
    tier: "Emerald 4",
    tags: ["Double Kill", "MVP", "Late bloomer"],
    queueType: "Ranked Solo/Duo",
  },
  {
    id: 10,
    timeAgo: "1 day ago",
    result: "Defeat",
    duration: "30m 24s",
    champion: "Ahri",
    championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Ahri.png",
    kills: 5,
    deaths: 6,
    assists: 5,
    kdaRatio: "1.67",
    cs: "224 (7.4)",
    tier: "Emerald 2",
    tags: ["Double Kill", "8th", "Struggle"],
    queueType: "Ranked Solo/Duo",
  },
  {
    id: 11,
    timeAgo: "1 day ago",
    result: "Victory",
    duration: "34m 02s",
    champion: "Vex",
    championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Vex.png",
    kills: 11,
    deaths: 3,
    assists: 13,
    kdaRatio: "8.00",
    cs: "259 (7.6)",
    tier: "Platinum 1",
    tags: ["Triple Kill", "2nd", "Unstoppable"],
    queueType: "Ranked Solo/Duo",
  },
  {
    id: 12,
    timeAgo: "1 day ago",
    result: "Victory",
    duration: "31m 43s",
    champion: "Naafiri",
    championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Naafiri.png",
    kills: 12,
    deaths: 12,
    assists: 10,
    kdaRatio: "1.83",
    cs: "210 (6.6)",
    tier: "Emerald 4",
    tags: ["Double Kill", "4th", "Rollercoaster"],
    queueType: "Ranked Solo/Duo",
  },
  {
    id: 13,
    timeAgo: "1 day ago",
    result: "Victory",
    duration: "16m 40s",
    champion: "Ahri",
    championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Ahri.png",
    kills: 5,
    deaths: 0,
    assists: 4,
    kdaRatio: "Perfect",
    cs: "146 (8.8)",
    tier: "Emerald 3",
    tags: ["3rd", "Unstoppable"],
    queueType: "Ranked Solo/Duo",
  },
  {
    id: 14,
    timeAgo: "1 day ago",
    result: "Victory",
    duration: "24m 54s",
    champion: "Swain",
    championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Swain.png",
    kills: 3,
    deaths: 6,
    assists: 7,
    kdaRatio: "1.67",
    cs: "133 (5.3)",
    tier: "Emerald 3",
    tags: ["7th", "Resilient"],
    queueType: "Ranked Solo/Duo",
  },
  {
    id: 15,
    timeAgo: "1 day ago",
    result: "Defeat",
    duration: "34m 16s",
    champion: "Naafiri",
    championImage: "https://opgg-static.akamaized.net/meta/images/lol/latest/champion/Naafiri.png",
    kills: 2,
    deaths: 14,
    assists: 9,
    kdaRatio: "0.79",
    cs: "177 (5.2)",
    tier: "Emerald 2",
    tags: ["10th", "Unyielding"],
    queueType: "Ranked Solo/Duo",
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
