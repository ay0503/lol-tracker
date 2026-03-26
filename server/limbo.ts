/**
 * Limbo game engine — instant resolution.
 * Player sets target multiplier, crash point determines win/loss. 1% house edge.
 */

const MAX_PAYOUT = 250;

export interface LimboResult {
  crashPoint: number;
  targetMultiplier: number;
  betAmount: number;
  won: boolean;
  payout: number;
  timestamp: number;
}

export interface LimboHistory {
  crashPoint: number;
  won: boolean;
  timestamp: number;
}

const recentResults: LimboHistory[] = [];
const MAX_HISTORY = 20;

function generateCrashPoint(): number {
  const raw = 0.99 / (1 - Math.random());
  return Math.min(Math.floor(raw * 100) / 100, 1000);
}

export function play(betAmount: number, targetMultiplier: number): LimboResult {
  const crashPoint = generateCrashPoint();
  const won = crashPoint >= targetMultiplier;
  const rawPayout = won ? betAmount * targetMultiplier : 0;
  const payout = Math.min(Math.round(rawPayout * 100) / 100, MAX_PAYOUT);

  recentResults.unshift({ crashPoint, won, timestamp: Date.now() });
  if (recentResults.length > MAX_HISTORY) recentResults.pop();

  return {
    crashPoint, targetMultiplier, betAmount, won, payout,
    timestamp: Date.now(),
  };
}

export function getHistory(): LimboHistory[] {
  return recentResults;
}
