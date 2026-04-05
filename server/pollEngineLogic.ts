/**
 * Pure state machine functions extracted from pollEngine.ts for testability.
 * These contain the core game detection and match processing logic.
 */

// ─── Game Confirmation State Machine ───

export interface GameConfirmationState {
  rawIsInGame: boolean | null;
  confirmed: boolean;
  errors: number;
}

/**
 * Evaluate whether the confirmed in-game status should change.
 * Uses two-consecutive-confirmation: the confirmed status only flips
 * when two consecutive raw checks agree and differ from current confirmed.
 * Auto-releases after 3 consecutive API errors.
 */
export function evaluateGameConfirmation(
  rawIsInGame: boolean,
  spectatorApiOk: boolean,
  prev: GameConfirmationState
): GameConfirmationState {
  if (!spectatorApiOk) {
    const newErrors = prev.errors + 1;
    // Auto-release after 3 consecutive failures while in game
    if (prev.confirmed && newErrors >= 3) {
      return { rawIsInGame: false, confirmed: false, errors: 0 };
    }
    return { ...prev, errors: newErrors };
  }

  // API succeeded — reset error count
  let confirmed = prev.confirmed;
  if (prev.rawIsInGame !== null && rawIsInGame === prev.rawIsInGame && rawIsInGame !== prev.confirmed) {
    confirmed = rawIsInGame;
  }

  return { rawIsInGame, confirmed, errors: 0 };
}

// ─── Snapshot Capture ───

/**
 * Determine if we should capture a pre-game snapshot.
 * Only capture on the transition from not-in-game to in-game,
 * and only if we don't already have a snapshot (prevents duplicates).
 */
export function shouldCaptureSnapshot(
  wasConfirmed: boolean,
  isConfirmed: boolean,
  hasExistingSnapshot: boolean,
  gameStartNotified: boolean = false
): boolean {
  return !wasConfirmed && isConfirmed && !hasExistingSnapshot && !gameStartNotified;
}

// ─── Remake Detection ───

/**
 * Detect if a match is a remake: game < 5 minutes AND 0/0/0 KDA.
 */
export function resolveRemake(
  gameDuration: number,
  kills: number,
  deaths: number,
  assists: number
): boolean {
  return gameDuration < 300 && kills === 0 && deaths === 0 && assists === 0;
}

// ─── Deferred Game End ───

/**
 * Determine if the game-end event should be deferred.
 * When LP hasn't changed after match processing (Riot API lag),
 * defer until the next poll cycle when LP updates.
 */
export function shouldDeferGameEnd(
  lpDelta: number,
  lastMatchWinResult: boolean | undefined
): boolean {
  return lpDelta === 0 && lastMatchWinResult !== undefined;
}

// ─── Streak Calculation ───

export interface StreakResult {
  type: "win" | "loss";
  count: number;
}

/**
 * Calculate the current streak from recent matches (newest first).
 * Filters out remakes. Returns null if streak < 3.
 */
export function calculateStreakFromMatches(
  recentMatches: { win: boolean; isRemake?: boolean }[]
): StreakResult | null {
  const nonRemake = recentMatches.filter(m => !m.isRemake);
  if (nonRemake.length === 0) return null;

  const firstResult = nonRemake[0].win;
  let count = 0;
  for (const match of nonRemake) {
    if (match.win === firstResult) {
      count++;
    } else {
      break;
    }
  }

  if (count < 3) return null;
  return { type: firstResult ? "win" : "loss", count };
}
