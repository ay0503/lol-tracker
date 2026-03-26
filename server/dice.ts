/**
 * Dice game engine — instant resolution.
 * Player sets target (1-99), rolls over/under. 1% house edge.
 */

const MAX_PAYOUT = 250;

export type DiceDirection = "over" | "under";

export interface DiceResult {
  roll: number;
  target: number;
  direction: DiceDirection;
  won: boolean;
  multiplier: number;
  payout: number;
  winChance: number;
  timestamp: number;
}

export interface DiceHistory {
  roll: number;
  won: boolean;
  timestamp: number;
}

const recentResults: DiceHistory[] = [];
const MAX_HISTORY = 20;

function getMultiplier(target: number, direction: DiceDirection): number {
  if (direction === "over") return 99 / (99 - target);
  return 99 / target;
}

function getWinChance(target: number, direction: DiceDirection): number {
  if (direction === "over") return 99 - target;
  return target;
}

export function roll(betAmount: number, target: number, direction: DiceDirection): DiceResult {
  const result = Math.floor(Math.random() * 10000) / 100; // 0.00 - 99.99
  const won = direction === "over" ? result > target : result < target;
  const multiplier = Math.round(getMultiplier(target, direction) * 100) / 100;
  const rawPayout = won ? betAmount * multiplier : 0;
  const payout = Math.min(Math.round(rawPayout * 100) / 100, MAX_PAYOUT);

  const entry: DiceHistory = { roll: result, won, timestamp: Date.now() };
  recentResults.unshift(entry);
  if (recentResults.length > MAX_HISTORY) recentResults.pop();

  return {
    roll: result, target, direction, won, multiplier, payout,
    winChance: Math.round(getWinChance(target, direction) * 100) / 100,
    timestamp: Date.now(),
  };
}

export function getHistory(): DiceHistory[] {
  return recentResults;
}
