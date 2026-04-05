import { describe, expect, it, vi, afterEach } from "vitest";
import { drop, dropMany, getMultipliers } from "./plinko";

describe("plinko.getMultipliers", () => {
  it("low risk returns 13 multipliers", () => {
    expect(getMultipliers("low")).toHaveLength(13);
  });

  it("medium risk returns 13 multipliers", () => {
    expect(getMultipliers("medium")).toHaveLength(13);
  });

  it("high risk returns 13 multipliers", () => {
    expect(getMultipliers("high")).toHaveLength(13);
  });

  it("multiplier arrays are symmetric", () => {
    for (const risk of ["low", "medium", "high"] as const) {
      const mults = getMultipliers(risk);
      for (let i = 0; i < mults.length; i++) {
        expect(mults[i]).toBe(mults[mults.length - 1 - i]);
      }
    }
  });

  it("high risk has higher extremes than low risk", () => {
    const low = getMultipliers("low");
    const high = getMultipliers("high");
    expect(high[0]).toBeGreaterThan(low[0]); // edge bucket
    expect(high[6]).toBeLessThan(low[6]); // center bucket
  });
});

describe("plinko.drop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 12-step path", () => {
    const result = drop(10, "low");
    expect(result.path).toHaveLength(12);
    for (const step of result.path) {
      expect(["L", "R"]).toContain(step);
    }
  });

  it("bucket is between 0 and 12", () => {
    const result = drop(10, "medium");
    expect(result.bucket).toBeGreaterThanOrEqual(0);
    expect(result.bucket).toBeLessThanOrEqual(12);
  });

  it("all-right path lands in bucket 12", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // always > 0.5 → R
    const result = drop(10, "low");
    expect(result.bucket).toBe(12);
    expect(result.path.every(s => s === "R")).toBe(true);
  });

  it("all-left path lands in bucket 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1); // always < 0.5 → L
    const result = drop(10, "low");
    expect(result.bucket).toBe(0);
    expect(result.path.every(s => s === "L")).toBe(true);
  });

  it("payout capped at MAX_PAYOUT (500)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // bucket 12
    const result = drop(100, "high");
    // 100 * 41.45 = 4145 → capped to 500
    expect(result.payout).toBeLessThanOrEqual(500);
  });
});

describe("plinko.dropMany", () => {
  it("returns correct number of results", () => {
    const results = dropMany(5, "low", 3);
    expect(results).toHaveLength(3);
  });
});
