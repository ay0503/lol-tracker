/**
 * Plinko game engine — instant resolution.
 * Ball drops through 12 rows of pegs into 13 buckets.
 * Target RTP stays slightly player-favored across all risk tiers.
 */

const MAX_PAYOUT = 500;
const ROWS = 12;

export type PlinkoRisk = "low" | "medium" | "high";

const MULTIPLIERS: Record<PlinkoRisk, number[]> = {
  low:    [8.2, 3.08, 2.05, 1.54, 1.44, 0.82, 0.41, 0.82, 1.44, 1.54, 2.05, 3.08, 8.2],
  medium: [27.12, 6.26, 3.13, 2.09, 1.04, 0.63, 0.63, 0.63, 1.04, 2.09, 3.13, 6.26, 27.12],
  high:   [41.45, 14.88, 3.72, 1.91, 1.17, 0.64, 0.21, 0.64, 1.17, 1.91, 3.72, 14.88, 41.45],
};

export interface PlinkoResult {
  path: ("L" | "R")[];
  bucket: number;
  multiplier: number;
  betAmount: number;
  payout: number;
  risk: PlinkoRisk;
  timestamp: number;
}

export interface PlinkoHistory {
  bucket: number;
  multiplier: number;
  risk: PlinkoRisk;
  timestamp: number;
}

const recentResults: PlinkoHistory[] = [];
const MAX_HISTORY = 20;

function pushHistory(bucket: number, multiplier: number, risk: PlinkoRisk, timestamp: number) {
  recentResults.unshift({ bucket, multiplier, risk, timestamp });
  if (recentResults.length > MAX_HISTORY) recentResults.pop();
}

function resolveDrop(betAmount: number, risk: PlinkoRisk): PlinkoResult {
  const path: ("L" | "R")[] = [];
  let position = 0; // Start centered

  for (let row = 0; row < ROWS; row++) {
    if (Math.random() < 0.5) {
      path.push("L");
      position--;
    } else {
      path.push("R");
      position++;
    }
  }

  // position ranges from -12 to +12, map to bucket 0-12
  // After 12 binary decisions starting at 0, position is even (-12 to +12 step 2)
  const bucket = (position + ROWS) / 2; // 0 to 12
  const multipliers = MULTIPLIERS[risk];
  const multiplier = multipliers[Math.max(0, Math.min(bucket, multipliers.length - 1))];

  const rawPayout = betAmount * multiplier;
  const payout = Math.min(Math.round(rawPayout * 100) / 100, MAX_PAYOUT);
  const timestamp = Date.now();

  pushHistory(bucket, multiplier, risk, timestamp);

  return { path, bucket, multiplier, betAmount, payout, risk, timestamp };
}

export function drop(betAmount: number, risk: PlinkoRisk): PlinkoResult {
  return resolveDrop(betAmount, risk);
}

export function dropMany(betAmount: number, risk: PlinkoRisk, count: number): PlinkoResult[] {
  return Array.from({ length: count }, () => resolveDrop(betAmount, risk));
}

export function getHistory(): PlinkoHistory[] {
  return recentResults;
}

export function getMultipliers(risk: PlinkoRisk): number[] {
  return MULTIPLIERS[risk];
}
