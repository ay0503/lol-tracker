/**
 * Roulette game engine — server-side logic.
 * European roulette: single zero, 37 pockets (0-36), 2.7% house edge.
 * Instant resolution — no active game state.
 */

const MAX_PAYOUT = 250;

export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
export const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

export type BetType = 'straight' | 'red' | 'black' | 'odd' | 'even' | 'high' | 'low' | 'dozen1' | 'dozen2' | 'dozen3' | 'column1' | 'column2' | 'column3';

export interface RouletteBet {
  type: BetType;
  number?: number;
  amount: number;
}

export interface BetResult {
  bet: RouletteBet;
  won: boolean;
  payout: number;
}

export interface RouletteResult {
  number: number;
  color: 'red' | 'black' | 'green';
  bets: BetResult[];
  totalBet: number;
  totalPayout: number;
  timestamp: number;
}

export interface RouletteHistory {
  number: number;
  color: 'red' | 'black' | 'green';
  timestamp: number;
}

const recentResults: RouletteHistory[] = [];
const MAX_HISTORY = 20;

export function getColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  if (RED_NUMBERS.includes(n)) return 'red';
  return 'black';
}

function isWinningBet(bet: RouletteBet, win: number): boolean {
  switch (bet.type) {
    case 'straight': return bet.number === win;
    case 'red': return win !== 0 && RED_NUMBERS.includes(win);
    case 'black': return win !== 0 && BLACK_NUMBERS.includes(win);
    case 'odd': return win !== 0 && win % 2 === 1;
    case 'even': return win !== 0 && win % 2 === 0;
    case 'low': return win >= 1 && win <= 18;
    case 'high': return win >= 19 && win <= 36;
    case 'dozen1': return win >= 1 && win <= 12;
    case 'dozen2': return win >= 13 && win <= 24;
    case 'dozen3': return win >= 25 && win <= 36;
    case 'column1': return win !== 0 && win % 3 === 1;
    case 'column2': return win !== 0 && win % 3 === 2;
    case 'column3': return win !== 0 && win % 3 === 0;
    default: return false;
  }
}

function getMultiplier(type: BetType): number {
  switch (type) {
    case 'straight': return 36;
    case 'red': case 'black': case 'odd': case 'even': case 'high': case 'low': return 2;
    case 'dozen1': case 'dozen2': case 'dozen3':
    case 'column1': case 'column2': case 'column3': return 3;
    default: return 0;
  }
}

export function spin(bets: RouletteBet[]): RouletteResult {
  const winningNumber = Math.floor(Math.random() * 37);
  const color = getColor(winningNumber);

  const betResults: BetResult[] = bets.map(bet => {
    const won = isWinningBet(bet, winningNumber);
    return {
      bet,
      won,
      payout: won ? bet.amount * getMultiplier(bet.type) : 0,
    };
  });

  const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);
  const rawPayout = betResults.reduce((sum, r) => sum + r.payout, 0);
  const totalPayout = Math.min(rawPayout, MAX_PAYOUT);

  const result: RouletteResult = {
    number: winningNumber,
    color,
    bets: betResults,
    totalBet: Math.round(totalBet * 100) / 100,
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
