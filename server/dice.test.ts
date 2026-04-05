import { describe, expect, it, vi, afterEach } from "vitest";
import { roll } from "./dice";

describe("dice.roll", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("over target win: roll > target", () => {
    // Math.random() * 10000 = 7500 → floor / 100 = 75.00
    vi.spyOn(Math, "random").mockReturnValue(0.75);
    const result = roll(10, 50, "over");
    expect(result.roll).toBe(75);
    expect(result.won).toBe(true);
    expect(result.direction).toBe("over");
    expect(result.payout).toBeGreaterThan(0);
  });

  it("over target loss: roll <= target", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const result = roll(10, 50, "over");
    expect(result.roll).toBe(25);
    expect(result.won).toBe(false);
    expect(result.payout).toBe(0);
  });

  it("under target win: roll < target", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const result = roll(10, 50, "under");
    expect(result.roll).toBe(25);
    expect(result.won).toBe(true);
    expect(result.payout).toBeGreaterThan(0);
  });

  it("under target loss: roll >= target", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.75);
    const result = roll(10, 50, "under");
    expect(result.won).toBe(false);
    expect(result.payout).toBe(0);
  });

  it("multiplier for over 50: ~2.02x", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.75);
    const result = roll(10, 50, "over");
    // 101 / (99.99 - 50) = 101 / 49.99 ≈ 2.02
    expect(result.multiplier).toBeCloseTo(2.02, 1);
  });

  it("win chance for over 50: ~49.99%", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.75);
    const result = roll(10, 50, "over");
    expect(result.winChance).toBeCloseTo(49.99, 1);
  });

  it("MAX_PAYOUT caps at 250", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999); // roll 99.90 > 1
    const result = roll(500, 1, "over");
    // multiplier ≈ 101/98.99 ≈ 1.02, payout ≈ 510 → capped to 250
    expect(result.payout).toBeLessThanOrEqual(250);
  });

  it("returns correct target and direction", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = roll(5, 75, "under");
    expect(result.target).toBe(75);
    expect(result.direction).toBe("under");
  });
});
