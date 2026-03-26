/**
 * Plinko game engine — instant resolution.
 * Ball drops through 12 rows of pegs into 13 buckets. 2-3% house edge.
 */

const MAX_PAYOUT = 500;
const ROWS = 12;

export type PlinkoRisk = "low" | "medium" | "high";

const MULTIPLIERS: Record<PlinkoRisk, number[]> = {
  low:    [5.6, 2.1, 1.4, 1.1, 1, 0.5, 0.3, 0.5, 1, 1.1, 1.4, 2.1, 5.6],
  medium: [13, 3, 1.5, 1, 0.5, 0.3, 0.3, 0.3, 0.5, 1, 1.5, 3, 13],
  high:   [110, 41, 10, 5, 3, 1.5, 0.5, 1.5, 3, 5, 10, 41, 110],
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

export function drop(betAmount: number, risk: PlinkoRisk): PlinkoResult {
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

  recentResults.unshift({ bucket, multiplier, risk, timestamp: Date.now() });
  if (recentResults.length > MAX_HISTORY) recentResults.pop();

  return { path, bucket, multiplier, betAmount, payout, risk, timestamp: Date.now() };
}

export function getHistory(): PlinkoHistory[] {
  return recentResults;
}

export function getMultipliers(risk: PlinkoRisk): number[] {
  return MULTIPLIERS[risk];
}
