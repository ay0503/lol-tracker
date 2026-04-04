import { describe, expect, it } from "vitest";
import { tierToTotalLP, totalLPToPrice, calculateStreaks } from "./playerData";

// ─── tierToTotalLP ───

describe("tierToTotalLP", () => {
  it("Platinum IV 0LP = 0", () => {
    expect(tierToTotalLP("PLATINUM", "IV", 0)).toBe(0);
  });

  it("Platinum IV 50LP = 50", () => {
    expect(tierToTotalLP("Platinum", "IV", 50)).toBe(50);
  });

  it("Platinum I 0LP = 300", () => {
    expect(tierToTotalLP("PLATINUM", "I", 0)).toBe(300);
  });

  it("Emerald IV 0LP = 400", () => {
    expect(tierToTotalLP("Emerald", "IV", 0)).toBe(400);
  });

  it("Diamond I 100LP = 1200", () => {
    expect(tierToTotalLP("Diamond", "I", 100)).toBe(1200);
  });

  it("numeric division: 4 = IV", () => {
    expect(tierToTotalLP("Platinum", 4, 0)).toBe(0);
  });

  it("numeric division: 1 = I", () => {
    expect(tierToTotalLP("Emerald", 1, 50)).toBe(750);
  });

  it("string numeric division: '3' = III", () => {
    expect(tierToTotalLP("EMERALD", "3", 25)).toBe(525);
  });

  it("unknown tier defaults to tier index 0", () => {
    expect(tierToTotalLP("UNKNOWN", "IV", 0)).toBe(0);
  });

  it("Emerald II 50LP = 600", () => {
    // tierIdx=1 (400) + divIdx=2 (200) + 50LP = 650
    expect(tierToTotalLP("EMERALD", "II", 50)).toBe(650);
  });
});

// ─── totalLPToPrice ───

describe("totalLPToPrice", () => {
  it("0 LP = $10", () => {
    expect(totalLPToPrice(0)).toBe(10);
  });

  it("600 LP = $55 (midpoint)", () => {
    expect(totalLPToPrice(600)).toBe(55);
  });

  it("1200 LP = $100", () => {
    expect(totalLPToPrice(1200)).toBe(100);
  });

  it("negative LP clamped to $10", () => {
    expect(totalLPToPrice(-100)).toBe(10);
  });

  it("LP > 1200 clamped to $100", () => {
    expect(totalLPToPrice(1500)).toBe(100);
  });

  it("300 LP = $32.50", () => {
    expect(totalLPToPrice(300)).toBe(32.5);
  });
});

// ─── calculateStreaks ───

describe("calculateStreaks", () => {
  it("empty array returns no streaks", () => {
    expect(calculateStreaks([])).toEqual([]);
  });

  it("all wins: single win streak", () => {
    const result = calculateStreaks(["W", "W", "W"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "win", count: 3, startIndex: 0, endIndex: 2 });
  });

  it("all losses: single loss streak", () => {
    const result = calculateStreaks(["L", "L"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "loss", count: 2, startIndex: 0, endIndex: 1 });
  });

  it("mixed: W,L,W,W,L → 4 streaks", () => {
    const result = calculateStreaks(["W", "L", "W", "W", "L"]);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ type: "win", count: 1, startIndex: 0, endIndex: 0 });
    expect(result[1]).toEqual({ type: "loss", count: 1, startIndex: 1, endIndex: 1 });
    expect(result[2]).toEqual({ type: "win", count: 2, startIndex: 2, endIndex: 3 });
    expect(result[3]).toEqual({ type: "loss", count: 1, startIndex: 4, endIndex: 4 });
  });

  it("alternating: 4 streaks of 1", () => {
    const result = calculateStreaks(["W", "L", "W", "L"]);
    expect(result).toHaveLength(4);
    for (const streak of result) {
      expect(streak.count).toBe(1);
    }
  });

  it("single element", () => {
    const result = calculateStreaks(["W"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "win", count: 1, startIndex: 0, endIndex: 0 });
  });
});
