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
  it("upserts state as JSON", async () => {
    await saveGameState(1, "blackjack", { hand: [10, 5], bet: 25 });
    // Find the INSERT call (may or may not have CREATE TABLE before it)
    const insertCall = mockExecute.mock.calls.find(
      (call: any[]) => typeof call[0] === "object" && call[0].sql?.includes("INSERT INTO casino_active_games")
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![0].args[0]).toBe(1);
    expect(insertCall![0].args[1]).toBe("blackjack");
    expect(JSON.parse(insertCall![0].args[2])).toEqual({ hand: [10, 5], bet: 25 });
  });

  it("does not throw on DB error (logs instead)", async () => {
    mockExecute.mockRejectedValue(new Error("DB down"));
    await expect(saveGameState(1, "mines", {})).resolves.toBeUndefined();
  });
});

describe("clearGameState", () => {
  it("deletes by userId + gameType", async () => {
    await clearGameState(42, "crash");
    const deleteCall = mockExecute.mock.calls.find(
      (call: any[]) => typeof call[0] === "object" && call[0].sql?.includes("DELETE FROM casino_active_games")
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall![0].args).toEqual([42, "crash"]);
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
    // Mock: SELECT returns rows (ensureTable may or may not call CREATE TABLE)
    mockExecute.mockImplementation((arg: any) => {
      if (typeof arg === "string" && arg.includes("CREATE TABLE")) return Promise.resolve({ rows: [] });
      if (typeof arg === "object" && arg.sql?.includes("SELECT")) {
        return Promise.resolve({
          rows: [
            { userId: 1, state: JSON.stringify({ bet: 10, hand: [7, 8] }) },
            { userId: 2, state: JSON.stringify({ bet: 25, hand: [10, 5] }) },
          ],
        });
      }
      return Promise.resolve({ rows: [] }); // DELETE cleanup
    });

    const result = await loadGameStates<{ bet: number; hand: number[] }>("blackjack");
    expect(result.size).toBe(2);
    expect(result.get(1)).toEqual({ bet: 10, hand: [7, 8] });
    expect(result.get(2)).toEqual({ bet: 25, hand: [10, 5] });
  });

  it("skips corrupt JSON entries without crashing", async () => {
    mockExecute.mockImplementation((arg: any) => {
      if (typeof arg === "object" && arg.sql?.includes("SELECT")) {
        return Promise.resolve({
          rows: [
            { userId: 1, state: "not valid json {{{" },
            { userId: 2, state: JSON.stringify({ ok: true }) },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await loadGameStates("mines");
    expect(result.size).toBe(1);
    expect(result.get(2)).toEqual({ ok: true });
  });

  it("cleans up expired entries after loading", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    await loadGameStates("crash");
    const deleteCall = mockExecute.mock.calls.find(
      (call: any[]) => typeof call[0] === "object" && call[0].sql?.includes("DELETE FROM casino_active_games WHERE gameType")
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall![0].args[0]).toBe("crash");
  });

  it("returns empty map on DB error", async () => {
    mockExecute.mockRejectedValue(new Error("fail"));
    const result = await loadGameStates("blackjack");
    expect(result.size).toBe(0);
  });
});
