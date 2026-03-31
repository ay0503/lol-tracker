/**
 * Shared casino utilities — cooldown, locking, game result recording.
 * Used by casino router and main router.
 */
import { TRPCError } from "@trpc/server";
import { getRawClient } from "./db";
import { cache } from "./cache";

/** Casino cooldown tracking (in-memory) */
const casinoLastGameTime = new Map<number, number>();

/** Casino in-flight lock — prevents double-click race condition */
const casinoInFlight = new Set<number>();

export function acquireCasinoLock(userId: number) {
  if (casinoInFlight.has(userId)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Game already in progress. Please wait." });
  casinoInFlight.add(userId);
}

export function releaseCasinoLock(userId: number) { casinoInFlight.delete(userId); }

// Clean up stale cooldown entries every 10 min
setInterval(() => {
  const cutoff = Date.now() - 3600_000;
  for (const [userId, time] of Array.from(casinoLastGameTime.entries())) {
    if (time < cutoff) casinoLastGameTime.delete(userId);
  }
}, 600_000);

export async function checkCasinoCooldown(userId: number): Promise<void> {
  acquireCasinoLock(userId);
  const client = getRawClient();
  try {
    const result = await client.execute({ sql: `SELECT cooldownSeconds FROM casino_cooldowns WHERE userId = ?`, args: [userId] });
    if (result.rows.length === 0) return;
    const cooldownSec = Number(result.rows[0].cooldownSeconds);
    if (cooldownSec <= 0) return;

    const lastGame = casinoLastGameTime.get(userId);
    if (lastGame) {
      const elapsed = (Date.now() - lastGame) / 1000;
      if (elapsed < cooldownSec) {
        const remaining = Math.ceil(cooldownSec - elapsed);
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Casino cooldown: wait ${remaining}s before next game.` });
      }
    }
  } catch (err) {
    if (err instanceof TRPCError) {
      releaseCasinoLock(userId);
      throw err;
    }
  }
}

export function recordCasinoGame(userId: number): void {
  casinoLastGameTime.set(userId, Date.now());
  releaseCasinoLock(userId);
}

/** Ensure casino_game_history table exists */
async function ensureCasinoGameHistoryTable() {
  try {
    const client = getRawClient();
    await client.execute(`CREATE TABLE IF NOT EXISTS casino_game_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      gameType TEXT NOT NULL,
      bet TEXT NOT NULL,
      payout TEXT NOT NULL,
      result TEXT NOT NULL,
      multiplier TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )`);
  } catch { /* ignore */ }
}
ensureCasinoGameHistoryTable();

export async function recordCasinoGameResult(userId: number, gameType: string, bet: number, payout: number, result: string, multiplier?: number) {
  try {
    const client = getRawClient();
    await client.execute({
      sql: `INSERT INTO casino_game_history (userId, gameType, bet, payout, result, multiplier) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [userId, gameType, bet.toFixed(2), payout.toFixed(2), result, multiplier?.toFixed(2) ?? null],
    });
    cache.invalidate("casino.gameFeed");
  } catch { /* table may not exist yet */ }
}

/** Cache TTL constants */
export const THIRTY_MIN = 30 * 60 * 1000;
export const TEN_MIN = 10 * 60 * 1000;
export const FIVE_MIN = 5 * 60 * 1000;
export const TWO_MIN = 2 * 60 * 1000;
export const ONE_MIN = 60 * 1000;
export const DAILY_CASINO_BONUS = 20.00;
