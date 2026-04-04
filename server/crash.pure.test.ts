import { describe, expect, it } from "vitest";
import { multiplierAtTime } from "./crash";

describe("crash.multiplierAtTime", () => {
  // Formula: 1 + 0.06 * (elapsedMs / 1000) ^ 1.5

  it("0ms returns exactly 1.0x", () => {
    expect(multiplierAtTime(0)).toBe(1);
  });

  it("1000ms (1s) returns 1.06x", () => {
    // 1 + 0.06 * 1^1.5 = 1.06
    expect(multiplierAtTime(1000)).toBeCloseTo(1.06, 4);
  });

  it("4000ms (4s) returns ~1.48x", () => {
    // 1 + 0.06 * 4^1.5 = 1 + 0.06 * 8 = 1.48
    expect(multiplierAtTime(4000)).toBeCloseTo(1.48, 2);
  });

  it("10000ms (10s) returns ~2.90x", () => {
    // 1 + 0.06 * 10^1.5 = 1 + 0.06 * 31.623 = 2.897
    expect(multiplierAtTime(10000)).toBeCloseTo(2.897, 1);
  });

  it("large elapsed (60s) computes without overflow", () => {
    const result = multiplierAtTime(60000);
    // 1 + 0.06 * 60^1.5 = 1 + 0.06 * 464.76 = 28.886
    expect(result).toBeCloseTo(28.886, 0);
    expect(Number.isFinite(result)).toBe(true);
  });

  it("is monotonically increasing", () => {
    let prev = multiplierAtTime(0);
    for (let ms = 500; ms <= 30000; ms += 500) {
      const curr = multiplierAtTime(ms);
      expect(curr).toBeGreaterThan(prev);
      prev = curr;
    }
  });

  it("very small elapsed (100ms) is close to 1.0x", () => {
    const result = multiplierAtTime(100);
    // 1 + 0.06 * 0.1^1.5 = 1 + 0.06 * 0.0316 = 1.0019
    expect(result).toBeGreaterThan(1);
    expect(result).toBeLessThan(1.01);
  });

  it("matches known control points for the game curve", () => {
    // At 2s: 1 + 0.06 * 2^1.5 = 1 + 0.06 * 2.828 = 1.1697
    expect(multiplierAtTime(2000)).toBeCloseTo(1.17, 1);
    // At 20s: 1 + 0.06 * 20^1.5 = 1 + 0.06 * 89.44 = 6.367
    expect(multiplierAtTime(20000)).toBeCloseTo(6.37, 1);
  });
});
