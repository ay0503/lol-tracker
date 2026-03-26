/**
 * Mines game engine — server-side logic.
 * 5x5 grid, player-selected mine count (1-24).
 * Slight player edge. Games stored in memory with DB persistence for server restarts.
 */
import { saveGameState, clearGameState, loadGameStates } from "./gamePersistence";

const GAME_TYPE = "mines";
const GRID_SIZE = 25;
const PLAYER_EDGE_BOOST = 1.01;
const MAX_PAYOUT = 5000;

export interface MinesGame {
  id: string;
  userId: number;
  bet: number;
  mineCount: number;
  minePositions: number[];
  revealedTiles: number[];
  status: "playing" | "won" | "lost";
  multiplier: number;
  payout: number;
  createdAt: number;
}

export interface PublicMinesGame {
  id: string;
  userId: number;
  bet: number;
  mineCount: number;
  gridSize: number;
  revealedTiles: number[];
  status: "playing" | "won" | "lost";
  multiplier: number;
  nextMultiplier: number;
  payout: number;
  minePositions?: number[];
}

const activeGames = new Map<number, MinesGame>();

function calculateMultiplier(mineCount: number, revealedCount: number): number {
  if (revealedCount === 0) return 1;
  let mult = 1;
  for (let i = 0; i < revealedCount; i++) {
    mult *= (GRID_SIZE - i) / (GRID_SIZE - mineCount - i);
  }
  return mult * PLAYER_EDGE_BOOST;
}

function gameToPublic(game: MinesGame): PublicMinesGame {
  const safeCount = game.revealedTiles.length;
  const maxSafe = GRID_SIZE - game.mineCount;
  const nextMult = game.status === "playing" && safeCount < maxSafe
    ? calculateMultiplier(game.mineCount, safeCount + 1)
    : game.multiplier;

  return {
    id: game.id, userId: game.userId, bet: game.bet,
    mineCount: game.mineCount, gridSize: GRID_SIZE,
    revealedTiles: game.revealedTiles,
    status: game.status,
    multiplier: Math.round(game.multiplier * 100) / 100,
    nextMultiplier: Math.round(nextMult * 100) / 100,
    payout: Math.round(game.payout * 100) / 100,
    minePositions: game.status !== "playing" ? game.minePositions : undefined,
  };
}

function generateMinePositions(count: number): number[] {
  const positions = new Set<number>();
  while (positions.size < count) {
    positions.add(Math.floor(Math.random() * GRID_SIZE));
  }
  return Array.from(positions);
}

export function startMinesGame(userId: number, bet: number, mineCount: number): PublicMinesGame {
  activeGames.delete(userId);
  if (mineCount < 1 || mineCount > 24) throw new Error("Mine count must be 1-24");
  const game: MinesGame = {
    id: `mines_${Date.now()}_${userId}`, userId, bet, mineCount,
    minePositions: generateMinePositions(mineCount),
    revealedTiles: [], status: "playing", multiplier: 1, payout: 0,
    createdAt: Date.now(),
  };
  activeGames.set(userId, game);
  saveGameState(userId, GAME_TYPE, game);
  return gameToPublic(game);
}

export function revealTile(userId: number, position: number): PublicMinesGame {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");
  if (position < 0 || position >= GRID_SIZE) throw new Error("Invalid position");
  if (game.revealedTiles.includes(position)) throw new Error("Tile already revealed");

  if (game.minePositions.includes(position)) {
    game.status = "lost";
    game.payout = 0;
    game.multiplier = 0;
    clearGameState(userId, GAME_TYPE);
    return gameToPublic(game);
  }

  game.revealedTiles.push(position);
  game.multiplier = calculateMultiplier(game.mineCount, game.revealedTiles.length);

  const maxSafe = GRID_SIZE - game.mineCount;
  if (game.revealedTiles.length >= maxSafe) {
    game.status = "won";
    game.payout = Math.min(game.bet * game.multiplier, MAX_PAYOUT);
    clearGameState(userId, GAME_TYPE);
  } else {
    saveGameState(userId, GAME_TYPE, game);
  }

  return gameToPublic(game);
}

export function cashOutMines(userId: number): PublicMinesGame {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");
  if (game.revealedTiles.length === 0) throw new Error("Reveal at least one tile first");
  game.status = "won";
  game.payout = Math.min(game.bet * game.multiplier, MAX_PAYOUT);
  clearGameState(userId, GAME_TYPE);
  return gameToPublic(game);
}

export function getActiveMinesGame(userId: number): PublicMinesGame | null {
  const game = activeGames.get(userId);
  return game ? gameToPublic(game) : null;
}

/** Restore persisted games from DB on startup */
export async function restoreMinesGames(): Promise<number> {
  const saved = await loadGameStates<MinesGame>(GAME_TYPE);
  for (const [userId, game] of Array.from(saved.entries())) {
    if (game.status === "playing") {
      activeGames.set(userId, game);
    }
  }
  return saved.size;
}

// Clean up stale games
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [userId, game] of Array.from(activeGames.entries())) {
    if (game.createdAt < cutoff) activeGames.delete(userId);
  }
}, 5 * 60 * 1000);
