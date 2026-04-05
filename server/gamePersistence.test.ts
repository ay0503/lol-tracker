import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();
vi.mock("./db", () => ({
  getRawClient: () => ({ execute: mockExecute }),
}));

import { saveGameState, clearGameState, loadGameStates } from "./gamePersistence";

beforeEach(() => {
  mockExecute.mockReset();
  mockExecute.mockResolvedValue({ rows: [] });
});

describe("saveGameState", () => {
  it("creates table then upserts state as JSON", async () => {
    await saveGameState(1, "blackjack", { hand: [10, 5], bet: 25 });
    // First call: CREATE TABLE, second call: INSERT/upsert
    expect(mockExecute).toHaveBeenCalledTimes(2);
    const upsertCall = mockExecute.mock.calls[1][0];
    expect(upsertCall.sql).toContain("INSERT INTO casino_active_games");
    expect(upsertCall.args[0]).toBe(1); // userId
    expect(upsertCall.args[1]).toBe("blackjack"); // gameType
    expect(JSON.parse(upsertCall.args[2])).toEqual({ hand: [10, 5], bet: 25 });
  });

  it("does not throw on DB error (logs instead)", async () => {
    mockExecute.mockRejectedValueOnce(new Error("DB down"));
    mockExecute.mockRejectedValueOnce(new Error("DB down"));
    await expect(saveGameState(1, "mines", {})).resolves.toBeUndefined();
  });
});

describe("clearGameState", () => {
  it("deletes by userId + gameType", async () => {
    await clearGameState(42, "crash");
    const deleteCall = mockExecute.mock.calls[1][0]; // after CREATE TABLE
    expect(deleteCall.sql).toContain("DELETE FROM casino_active_games");
    expect(deleteCall.args).toEqual([42, "crash"]);
  });

  it("does not throw on DB error", async () => {
    mockExecute.mockRejectedValue(new Error("fail"));
    await expect(clearGameState(1, "blackjack")).resolves.toBeUndefined();
  });
});

describe("loadGameStates", () => {
  it("returns empty map when no rows", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    const result = await loadGameStates("blackjack");
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it("parses JSON state and returns Map keyed by userId", async () => {
    // CREATE TABLE call succeeds, then SELECT returns rows, then DELETE for cleanup
    mockExecute
      .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
      .mockResolvedValueOnce({
        rows: [
          { userId: 1, state: JSON.stringify({ bet: 10, hand: [7, 8] }) },
          { userId: 2, state: JSON.stringify({ bet: 25, hand: [10, 5] }) },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }); // DELETE expired

    const result = await loadGameStates<{ bet: number; hand: number[] }>("blackjack");
    expect(result.size).toBe(2);
    expect(result.get(1)).toEqual({ bet: 10, hand: [7, 8] });
    expect(result.get(2)).toEqual({ bet: 25, hand: [10, 5] });
  });

  it("skips corrupt JSON entries without crashing", async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { userId: 1, state: "not valid json {{{" },
          { userId: 2, state: JSON.stringify({ ok: true }) },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await loadGameStates("mines");
    expect(result.size).toBe(1);
    expect(result.get(2)).toEqual({ ok: true });
  });

  it("cleans up expired entries after loading", async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await loadGameStates("crash");
    // 3rd call should be the DELETE for expired
    const deleteCall = mockExecute.mock.calls[2][0];
    expect(deleteCall.sql).toContain("DELETE FROM casino_active_games");
    expect(deleteCall.args[0]).toBe("crash");
  });

  it("returns empty map on DB error", async () => {
    mockExecute.mockRejectedValue(new Error("fail"));
    const result = await loadGameStates("blackjack");
    expect(result.size).toBe(0);
  });
});
