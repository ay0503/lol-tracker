/**
 * Crash game engine — server-side logic.
 * Multiplier rises from 1.00x until crash point.
 * Player cashes out before crash to win.
 * 1% house edge. Games stored in memory.
 */

const MAX_PAYOUT = 500;

export interface CrashGame {
  id: string;
  userId: number;
  bet: number;
  crashPoint: number;
  autoCashout: number | null;
  status: "flying" | "crashed" | "cashed_out";
  cashoutMultiplier: number;
  payout: number;
  startedAt: number;
}

export interface PublicCrashGame {
  id: string;
  bet: number;
  autoCashout: number | null;
  status: "flying" | "crashed" | "cashed_out";
  cashoutMultiplier: number;
  payout: number;
  startedAt: number;
  crashPoint?: number; // only revealed when game ends
}

interface CrashHistoryEntry {
  crashPoint: number;
  cashedOut: boolean;
  multiplier: number;
  profit: number;
}

const activeGames = new Map<number, CrashGame>();
const crashHistory = new Map<number, CrashHistoryEntry[]>();

/**
 * Generate crash point with 1% house edge.
 * Formula: max(1.00, floor(99 / (100 - r) * 100) / 100)
 * where r is uniform [0, 100)
 */
function generateCrashPoint(): number {
  const r = Math.random() * 100;
  // 1% chance of instant crash (when r >= 99)
  if (r >= 99) return 1.00;
  const raw = 99 / (100 - r);
  return Math.max(1.00, Math.floor(raw * 100) / 100);
}

/**
 * Compute multiplier from elapsed time.
 * multiplier = 1 + 0.06 * t^1.5
 */
export function multiplierAtTime(elapsedMs: number): number {
  const t = elapsedMs / 1000;
  return 1 + 0.06 * Math.pow(t, 1.5);
}

/**
 * Compute time (ms) at which a given multiplier is reached.
 * Inverse of multiplierAtTime.
 */
function timeAtMultiplier(mult: number): number {
  if (mult <= 1) return 0;
  const t = Math.pow((mult - 1) / 0.06, 1 / 1.5);
  return t * 1000;
}

function gameToPublic(game: CrashGame): PublicCrashGame {
  return {
    id: game.id,
    bet: game.bet,
    autoCashout: game.autoCashout,
    status: game.status,
    cashoutMultiplier: Math.floor(game.cashoutMultiplier * 100) / 100,
    payout: Math.floor(game.payout * 100) / 100,
    startedAt: game.startedAt,
    crashPoint: game.status !== "flying" ? Math.floor(game.crashPoint * 100) / 100 : undefined,
  };
}

function addToHistory(userId: number, entry: CrashHistoryEntry) {
  const history = crashHistory.get(userId) ?? [];
  history.unshift(entry);
  if (history.length > 20) history.length = 20;
  crashHistory.set(userId, history);
}

export function startCrashGame(userId: number, bet: number, autoCashout?: number): PublicCrashGame {
  // Clear any existing finished game
  const existing = activeGames.get(userId);
  if (existing && existing.status === "flying") throw new Error("Game already in progress");
  activeGames.delete(userId);

  const crashPoint = generateCrashPoint();

  const game: CrashGame = {
    id: `crash_${Date.now()}_${userId}`,
    userId, bet, crashPoint,
    autoCashout: autoCashout && autoCashout >= 1.01 ? autoCashout : null,
    status: "flying",
    cashoutMultiplier: 0,
    payout: 0,
    startedAt: Date.now(),
  };

  // If auto-cashout is set and <= crashPoint, it will be handled on cashout call
  // If crashPoint is 1.00 (instant crash), resolve immediately
  if (crashPoint <= 1.00) {
    game.status = "crashed";
    game.cashoutMultiplier = 0;
    game.payout = 0;
    addToHistory(userId, { crashPoint, cashedOut: false, multiplier: 0, profit: -bet });
  }

  activeGames.set(userId, game);
  return gameToPublic(game);
}

export function cashoutCrash(userId: number): PublicCrashGame {
  const game = activeGames.get(userId);
  if (!game || game.status !== "flying") throw new Error("No active game");

  const elapsed = Date.now() - game.startedAt;
  let currentMult = multiplierAtTime(elapsed);
  currentMult = Math.floor(currentMult * 100) / 100;

  // Check if already crashed
  if (currentMult >= game.crashPoint) {
    game.status = "crashed";
    game.cashoutMultiplier = 0;
    game.payout = 0;
    addToHistory(userId, { crashPoint: game.crashPoint, cashedOut: false, multiplier: 0, profit: -game.bet });
    return gameToPublic(game);
  }

  // Check auto-cashout
  const cashMult = game.autoCashout && game.autoCashout <= currentMult
    ? game.autoCashout
    : currentMult;

  game.status = "cashed_out";
  game.cashoutMultiplier = cashMult;
  game.payout = Math.min(game.bet * cashMult, MAX_PAYOUT);
  addToHistory(userId, {
    crashPoint: game.crashPoint, cashedOut: true,
    multiplier: cashMult, profit: game.payout - game.bet,
  });

  return gameToPublic(game);
}

/**
 * Check if a flying game has crashed (for client polling).
 */
export function checkCrashStatus(userId: number): PublicCrashGame | null {
  const game = activeGames.get(userId);
  if (!game) return null;

  if (game.status === "flying") {
    const elapsed = Date.now() - game.startedAt;
    const currentMult = multiplierAtTime(elapsed);

    // Auto-cashout check
    if (game.autoCashout && currentMult >= game.autoCashout && game.autoCashout <= game.crashPoint) {
      game.status = "cashed_out";
      game.cashoutMultiplier = game.autoCashout;
      game.payout = Math.min(game.bet * game.autoCashout, MAX_PAYOUT);
      addToHistory(userId, {
        crashPoint: game.crashPoint, cashedOut: true,
        multiplier: game.autoCashout, profit: game.payout - game.bet,
      });
      return gameToPublic(game);
    }

    // Crash check
    if (currentMult >= game.crashPoint) {
      game.status = "crashed";
      game.cashoutMultiplier = 0;
      game.payout = 0;
      addToHistory(userId, { crashPoint: game.crashPoint, cashedOut: false, multiplier: 0, profit: -game.bet });
      return gameToPublic(game);
    }
  }

  return gameToPublic(game);
}

export function getCrashHistory(userId: number): CrashHistoryEntry[] {
  return crashHistory.get(userId) ?? [];
}

export function getActiveCrashGame(userId: number): PublicCrashGame | null {
  const game = activeGames.get(userId);
  if (!game) return null;
  // Auto-resolve if needed
  return checkCrashStatus(userId);
}

// Clean up stale games
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [userId, game] of Array.from(activeGames.entries())) {
    if (game.status === "flying" && game.startedAt < cutoff) {
      game.status = "crashed";
      game.payout = 0;
      addToHistory(userId, { crashPoint: game.crashPoint, cashedOut: false, multiplier: 0, profit: -game.bet });
    }
    if (game.status !== "flying" && game.startedAt < cutoff) {
      activeGames.delete(userId);
    }
  }
}, 30 * 1000);
