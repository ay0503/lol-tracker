import { describe, expect, it } from "vitest";

vi.mock("./db", () => ({
  getRawClient: vi.fn(() => ({
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  })),
}));

import { vi } from "vitest";
import { acquireCasinoLock, releaseCasinoLock, recordCasinoGame, THIRTY_MIN, TEN_MIN, FIVE_MIN, TWO_MIN, ONE_MIN, DAILY_CASINO_BONUS } from "./casinoUtils";

describe("casinoUtils.lock", () => {
  it("acquireCasinoLock succeeds on first call", () => {
    expect(() => acquireCasinoLock(999)).not.toThrow();
    releaseCasinoLock(999);
  });

  it("acquireCasinoLock throws on double-lock", () => {
    acquireCasinoLock(998);
    expect(() => acquireCasinoLock(998)).toThrow(/already in progress/i);
    releaseCasinoLock(998);
  });

  it("releaseCasinoLock allows re-acquire", () => {
    acquireCasinoLock(997);
    releaseCasinoLock(997);
    expect(() => acquireCasinoLock(997)).not.toThrow();
    releaseCasinoLock(997);
  });

  it("different users can lock simultaneously", () => {
    acquireCasinoLock(100);
    acquireCasinoLock(101);
    expect(() => acquireCasinoLock(100)).toThrow();
    expect(() => acquireCasinoLock(101)).toThrow();
    releaseCasinoLock(100);
    releaseCasinoLock(101);
  });
});

describe("casinoUtils.recordCasinoGame", () => {
  it("releases lock after recording", () => {
    acquireCasinoLock(996);
    recordCasinoGame(996);
    // Should be able to acquire again
    expect(() => acquireCasinoLock(996)).not.toThrow();
    releaseCasinoLock(996);
  });
});

describe("casinoUtils.constants", () => {
  it("TTL constants are correct", () => {
    expect(THIRTY_MIN).toBe(30 * 60 * 1000);
    expect(TEN_MIN).toBe(10 * 60 * 1000);
    expect(FIVE_MIN).toBe(5 * 60 * 1000);
    expect(TWO_MIN).toBe(2 * 60 * 1000);
    expect(ONE_MIN).toBe(60 * 1000);
  });

  it("daily casino bonus is $20", () => {
    expect(DAILY_CASINO_BONUS).toBe(20);
  });
});
