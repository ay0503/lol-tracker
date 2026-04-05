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

});

// ─── Game lifecycle — snapshot capture uses preGameSnapshot guard ───
// Note: duplicate NOTIFICATION prevention is now DB-backed (gameId comparison),
// not via shouldCaptureSnapshot. The snapshot capture guard only checks preGameSnapshot.

describe("game lifecycle: snapshot capture", () => {
  it("snapshot captured on game start, blocked while snapshot exists", () => {
    // Game starts: should capture
    expect(shouldCaptureSnapshot(false, true, false)).toBe(true);
    // Snapshot exists: should NOT capture again
    expect(shouldCaptureSnapshot(false, true, true)).toBe(false);
  });

  it("after snapshot consumed (match processed), new game can capture", () => {
    // Snapshot was consumed by match processing (hasExistingSnapshot = false)
    // New game starts — shouldCaptureSnapshot allows it
    // (duplicate notification is prevented by DB gameId, not here)
    expect(shouldCaptureSnapshot(false, true, false)).toBe(true);
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
