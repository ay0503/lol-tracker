import { describe, expect, it } from "vitest";
import {
  evaluateGameConfirmation,
  shouldCaptureSnapshot,
  resolveRemake,
  shouldDeferGameEnd,
  calculateStreakFromMatches,
  type GameConfirmationState,
} from "./pollEngineLogic";

// ─── evaluateGameConfirmation ───

describe("evaluateGameConfirmation", () => {
  const initial: GameConfirmationState = { rawIsInGame: null, confirmed: false, errors: 0 };

  it("first poll raw=true: updates rawIsInGame but does NOT confirm", () => {
    const result = evaluateGameConfirmation(true, true, initial);
    expect(result.rawIsInGame).toBe(true);
    expect(result.confirmed).toBe(false); // need 2 consecutive
    expect(result.errors).toBe(0);
  });

  it("second consecutive raw=true: confirms in game", () => {
    const afterFirst = evaluateGameConfirmation(true, true, initial);
    const result = evaluateGameConfirmation(true, true, afterFirst);
    expect(result.confirmed).toBe(true);
  });

  it("single raw=false after raw=true: does NOT unconfirm", () => {
    const confirmed: GameConfirmationState = { rawIsInGame: true, confirmed: true, errors: 0 };
    const result = evaluateGameConfirmation(false, true, confirmed);
    expect(result.rawIsInGame).toBe(false);
    expect(result.confirmed).toBe(true); // still confirmed (need 2 consecutive false)
  });

  it("two consecutive raw=false while confirmed: unconfirms", () => {
    const confirmed: GameConfirmationState = { rawIsInGame: true, confirmed: true, errors: 0 };
    const afterFirst = evaluateGameConfirmation(false, true, confirmed);
    const result = evaluateGameConfirmation(false, true, afterFirst);
    expect(result.confirmed).toBe(false);
  });

  it("spectator API error: preserves state, increments errors", () => {
    const state: GameConfirmationState = { rawIsInGame: true, confirmed: true, errors: 0 };
    const result = evaluateGameConfirmation(true, false, state);
    expect(result.rawIsInGame).toBe(true); // unchanged
    expect(result.confirmed).toBe(true);   // unchanged
    expect(result.errors).toBe(1);
  });

  it("3 consecutive API errors while confirmed: auto-releases", () => {
    let state: GameConfirmationState = { rawIsInGame: true, confirmed: true, errors: 0 };
    state = evaluateGameConfirmation(true, false, state); // error 1
    state = evaluateGameConfirmation(true, false, state); // error 2
    state = evaluateGameConfirmation(true, false, state); // error 3 -> auto-release
    expect(state.confirmed).toBe(false);
    expect(state.errors).toBe(0);
  });

  it("API success resets error count", () => {
    const state: GameConfirmationState = { rawIsInGame: true, confirmed: true, errors: 2 };
    const result = evaluateGameConfirmation(true, true, state);
    expect(result.errors).toBe(0);
  });

  it("alternating true/false never confirms", () => {
    let state = initial;
    state = evaluateGameConfirmation(true, true, state);   // raw=true, confirmed=false
    state = evaluateGameConfirmation(false, true, state);  // raw=false, no 2 consecutive
    state = evaluateGameConfirmation(true, true, state);   // raw=true, prev was false
    state = evaluateGameConfirmation(false, true, state);  // raw=false, prev was true
    expect(state.confirmed).toBe(false); // never had 2 consecutive
  });

  it("API error while not confirmed: just increments errors", () => {
    const state: GameConfirmationState = { rawIsInGame: null, confirmed: false, errors: 0 };
    const result = evaluateGameConfirmation(true, false, state);
    expect(result.confirmed).toBe(false);
    expect(result.errors).toBe(1);
  });
});

// ─── shouldCaptureSnapshot ───

describe("shouldCaptureSnapshot", () => {
  it("transition to in-game with no existing snapshot: true", () => {
    expect(shouldCaptureSnapshot(false, true, false)).toBe(true);
  });

  it("transition to in-game with existing snapshot: false (prevent duplicate)", () => {
    expect(shouldCaptureSnapshot(false, true, true)).toBe(false);
  });

  it("already in game: false", () => {
    expect(shouldCaptureSnapshot(true, true, false)).toBe(false);
  });

  it("game ended (transition out): false", () => {
    expect(shouldCaptureSnapshot(true, false, false)).toBe(false);
  });

  // ─── Duplicate notification edge cases ───

  it("gameStartNotified=true blocks even if snapshot is null", () => {
    expect(shouldCaptureSnapshot(false, true, false, true)).toBe(false);
  });

  it("gameStartNotified=false with no snapshot: allows capture", () => {
    expect(shouldCaptureSnapshot(false, true, false, false)).toBe(true);
  });

  it("both snapshot AND notified set: blocked by both guards", () => {
    expect(shouldCaptureSnapshot(false, true, true, true)).toBe(false);
  });

  it("spectator flicker scenario: game confirmed→unconfirmed→reconfirmed, notified=true blocks", () => {
    // Simulate: game starts, snapshot captured, notified=true
    // Then spectator flickers: confirmed goes false→true
    // wasConfirmed=false (just flipped back), isConfirmed=true, snapshot may be null, but notified=true
    expect(shouldCaptureSnapshot(false, true, false, true)).toBe(false);
  });

  it("new game after previous ended: notified=false allows capture", () => {
    // Previous game ended → notified reset to false → new game starts
    expect(shouldCaptureSnapshot(false, true, false, false)).toBe(true);
  });
});

// ─── Full game lifecycle simulation ───

describe("game lifecycle: duplicate notification prevention", () => {
  it("complete lifecycle: start→flicker→end→new game", () => {
    const initial: GameConfirmationState = { rawIsInGame: null, confirmed: false, errors: 0 };
    let notified = false;
    let hasSnapshot = false;

    // 1. Game starts: two consecutive true polls
    let state = evaluateGameConfirmation(true, true, initial);
    state = evaluateGameConfirmation(true, true, state);
    expect(state.confirmed).toBe(true);

    // Capture snapshot + notify
    const shouldCapture1 = shouldCaptureSnapshot(false, true, false, false);
    expect(shouldCapture1).toBe(true);
    notified = true;
    hasSnapshot = true;

    // 2. Spectator flickers: two consecutive false → unconfirm
    state = evaluateGameConfirmation(false, true, state);
    state = evaluateGameConfirmation(false, true, state);
    expect(state.confirmed).toBe(false);

    // 3. Spectator recovers: two consecutive true → reconfirm
    state = evaluateGameConfirmation(true, true, state);
    state = evaluateGameConfirmation(true, true, state);
    expect(state.confirmed).toBe(true);

    // Should NOT capture again (notified=true blocks it)
    const shouldCapture2 = shouldCaptureSnapshot(false, true, hasSnapshot, notified);
    expect(shouldCapture2).toBe(false);

    // Even if snapshot was consumed (hasSnapshot=false), notified still blocks
    hasSnapshot = false;
    const shouldCapture3 = shouldCaptureSnapshot(false, true, false, notified);
    expect(shouldCapture3).toBe(false);

    // 4. Spectator says game ended (two consecutive false)
    state = evaluateGameConfirmation(false, true, state);
    state = evaluateGameConfirmation(false, true, state);
    expect(state.confirmed).toBe(false);
    // notified stays TRUE here — only reset when match data confirms game end
    // (simulating: match data arrives and game-end event emits)
    notified = false; // reset by match data / game-end event emission

    // 5. New game starts
    state = evaluateGameConfirmation(true, true, state);
    state = evaluateGameConfirmation(true, true, state);
    expect(state.confirmed).toBe(true);

    // Should capture for new game (notified was reset)
    const shouldCapture4 = shouldCaptureSnapshot(false, true, false, false);
    expect(shouldCapture4).toBe(true);
  });

  it("API errors during game: 3 errors auto-release, then recovery does NOT re-notify", () => {
    let state: GameConfirmationState = { rawIsInGame: true, confirmed: true, errors: 0 };
    let notified = true; // game was already started and notified

    // 3 API errors → auto-release
    state = evaluateGameConfirmation(true, false, state);
    state = evaluateGameConfirmation(true, false, state);
    state = evaluateGameConfirmation(true, false, state);
    expect(state.confirmed).toBe(false); // auto-released
    // DO NOT reset notified (game might still be going, just API errors)

    // API recovers, spectator shows in-game again
    state = evaluateGameConfirmation(true, true, state);
    state = evaluateGameConfirmation(true, true, state);
    expect(state.confirmed).toBe(true); // reconfirmed

    // Should NOT re-notify (notified=true persists through API errors)
    expect(shouldCaptureSnapshot(false, true, false, notified)).toBe(false);
  });
});

// ─── resolveRemake ───

describe("resolveRemake", () => {
  it("classic remake: <300s + 0/0/0", () => {
    expect(resolveRemake(180, 0, 0, 0)).toBe(true);
  });

  it("just under 5 min: 299s + 0/0/0 is remake", () => {
    expect(resolveRemake(299, 0, 0, 0)).toBe(true);
  });

  it("exactly 300s is NOT remake", () => {
    expect(resolveRemake(300, 0, 0, 0)).toBe(false);
  });

  it("short game with kills: NOT remake", () => {
    expect(resolveRemake(180, 1, 0, 0)).toBe(false);
  });

  it("short game with deaths: NOT remake", () => {
    expect(resolveRemake(180, 0, 1, 0)).toBe(false);
  });

  it("short game with assists: NOT remake", () => {
    expect(resolveRemake(180, 0, 0, 1)).toBe(false);
  });
});

// ─── shouldDeferGameEnd ───

describe("shouldDeferGameEnd", () => {
  it("LP unchanged + has match result: defer", () => {
    expect(shouldDeferGameEnd(0, true)).toBe(true);
    expect(shouldDeferGameEnd(0, false)).toBe(true);
  });

  it("LP unchanged + no match result: don't defer", () => {
    expect(shouldDeferGameEnd(0, undefined)).toBe(false);
  });

  it("LP changed: don't defer (emit immediately)", () => {
    expect(shouldDeferGameEnd(15, true)).toBe(false);
    expect(shouldDeferGameEnd(-21, false)).toBe(false);
  });
});

// ─── calculateStreakFromMatches ───

describe("calculateStreakFromMatches", () => {
  it("5 consecutive wins: win streak of 5", () => {
    const result = calculateStreakFromMatches([
      { win: true }, { win: true }, { win: true }, { win: true }, { win: true },
    ]);
    expect(result).toEqual({ type: "win", count: 5 });
  });

  it("3 losses then a win: loss streak of 3", () => {
    const result = calculateStreakFromMatches([
      { win: false }, { win: false }, { win: false }, { win: true },
    ]);
    expect(result).toEqual({ type: "loss", count: 3 });
  });

  it("streak < 3 returns null", () => {
    const result = calculateStreakFromMatches([
      { win: true }, { win: true }, { win: false },
    ]);
    expect(result).toBeNull();
  });

  it("remakes are filtered out", () => {
    const result = calculateStreakFromMatches([
      { win: true }, { win: true, isRemake: true }, { win: true }, { win: true },
    ]);
    // After filtering remake: [W, W, W] = streak of 3
    expect(result).toEqual({ type: "win", count: 3 });
  });

  it("empty array returns null", () => {
    expect(calculateStreakFromMatches([])).toBeNull();
  });
});
