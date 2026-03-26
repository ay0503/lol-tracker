/**
 * Roulette game engine — server-side logic.
 * European roulette: single zero, 37 pockets (0-36), 2.7% house edge.
 * Instant resolution — no active game state.
 */

const MAX_PAYOUT = 1800;

export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
export const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

export type BetType = "red" | "black" | "green";

export interface RouletteBet {
  type: BetType;
  amount: number;
}

export interface RouletteResult {
  bet: RouletteBet;
  number: number;
  color: BetType;
  won: boolean;
  totalBet: number;
  totalPayout: number;
  timestamp: number;
}

export interface RouletteHistory {
  number: number;
  color: BetType;
  timestamp: number;
}

const recentResults: RouletteHistory[] = [];
const MAX_HISTORY = 20;

export function getColor(n: number): BetType {
  if (n === 0) return "green";
  if (RED_NUMBERS.includes(n)) return "red";
  return "black";
}

function getMultiplier(type: BetType): number {
  if (type === "green") return 36;
  return 2;
}

export function spin(bet: RouletteBet): RouletteResult {
  const winningNumber = Math.floor(Math.random() * 37);
  const color = getColor(winningNumber);
  const won = bet.type === color;
  const rawPayout = won ? bet.amount * getMultiplier(bet.type) : 0;
  const totalPayout = Math.min(rawPayout, MAX_PAYOUT);

  const result: RouletteResult = {
    bet,
    number: winningNumber,
    color,
    won,
    totalBet: Math.round(bet.amount * 100) / 100,
    totalPayout: Math.round(totalPayout * 100) / 100,
    timestamp: Date.now(),
  };

  recentResults.unshift({ number: winningNumber, color, timestamp: Date.now() });
  if (recentResults.length > MAX_HISTORY) recentResults.pop();

  return result;
}

export function getHistory(): RouletteHistory[] {
  return recentResults;
}
