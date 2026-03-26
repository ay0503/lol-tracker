/**
 * Game state persistence — saves/restores in-memory casino game state to DB.
 * Survives server restarts. Uses raw SQL (getRawClient pattern).
 */
import { getRawClient } from "./db";

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  const client = getRawClient();
  await client.execute(`
    CREATE TABLE IF NOT EXISTS casino_active_games (
      userId INTEGER NOT NULL,
      gameType TEXT NOT NULL,
      state TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
      PRIMARY KEY (userId, gameType)
    )
  `);
  tableReady = true;
}

/** Save a game state to DB (upsert) */
export async function saveGameState(userId: number, gameType: string, state: unknown): Promise<void> {
  try {
    await ensureTable();
    const client = getRawClient();
    await client.execute({
      sql: `INSERT INTO casino_active_games (userId, gameType, state) VALUES (?, ?, ?)
            ON CONFLICT(userId, gameType) DO UPDATE SET state = ?, createdAt = datetime('now')`,
      args: [userId, gameType, JSON.stringify(state), JSON.stringify(state)],
    });
  } catch (err) {
    console.error(`[GamePersist] Failed to save ${gameType} for user ${userId}:`, err);
  }
}

/** Remove a game state from DB (game ended or cleaned up) */
export async function clearGameState(userId: number, gameType: string): Promise<void> {
  try {
    await ensureTable();
    const client = getRawClient();
    await client.execute({
      sql: `DELETE FROM casino_active_games WHERE userId = ? AND gameType = ?`,
      args: [userId, gameType],
    });
  } catch (err) {
    console.error(`[GamePersist] Failed to clear ${gameType} for user ${userId}:`, err);
  }
}

/** Load all active games of a given type from DB */
export async function loadGameStates<T>(gameType: string): Promise<Map<number, T>> {
  const map = new Map<number, T>();
  try {
    await ensureTable();
    const client = getRawClient();
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const result = await client.execute({
      sql: `SELECT userId, state FROM casino_active_games WHERE gameType = ? AND createdAt > ?`,
      args: [gameType, cutoff],
    });
    for (const row of result.rows as any[]) {
      try {
        const state = JSON.parse(String(row.state)) as T;
        map.set(Number(row.userId), state);
      } catch { /* skip corrupt entries */ }
    }
    // Clean up expired entries
    await client.execute({
      sql: `DELETE FROM casino_active_games WHERE gameType = ? AND createdAt <= ?`,
      args: [gameType, cutoff],
    });
  } catch (err) {
    console.error(`[GamePersist] Failed to load ${gameType} states:`, err);
  }
  return map;
}
