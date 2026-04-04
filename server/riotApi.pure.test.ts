import { describe, expect, it } from "vitest";
import { tierToTotalLP, totalLPToPrice, tierToPrice, priceToTierLabel } from "./riotApi";

// ─── tierToTotalLP ───
// Baseline: PLATINUM IV 0LP = 0
// Each division = 100 LP, each tier = 400 LP
// IRON(0) BRONZE(1) SILVER(2) GOLD(3) PLATINUM(4) EMERALD(5) DIAMOND(6)

describe("tierToTotalLP", () => {
  it("Platinum IV 0LP = 0 (baseline)", () => {
    expect(tierToTotalLP("PLATINUM", "IV", 0)).toBe(0);
  });

  it("Platinum III 0LP = 100", () => {
    expect(tierToTotalLP("PLATINUM", "III", 0)).toBe(100);
  });

  it("Platinum I 0LP = 300", () => {
    expect(tierToTotalLP("PLATINUM", "I", 0)).toBe(300);
  });

  it("Emerald IV 0LP = 400", () => {
    expect(tierToTotalLP("EMERALD", "IV", 0)).toBe(400);
  });

  it("Diamond IV 0LP = 800", () => {
    expect(tierToTotalLP("DIAMOND", "IV", 0)).toBe(800);
  });

  it("Diamond I 100LP = 1200 (max)", () => {
    expect(tierToTotalLP("DIAMOND", "I", 100)).toBe(1200);
  });

  it("case insensitive (lowercase)", () => {
    expect(tierToTotalLP("platinum", "IV", 0)).toBe(0);
    expect(tierToTotalLP("emerald", "II", 50)).toBe(650);
  });

  it("below Platinum (Gold) clamps to 0", () => {
    // Gold is tier 3, Plat is tier 4: (3-4)*4 + 0 = -4 divisions → -400 LP → clamped to 0
    expect(tierToTotalLP("GOLD", "IV", 0)).toBe(0);
  });

  it("unknown tier defaults to PLATINUM index", () => {
    // Unknown → tierIdx 4 (PLATINUM), same as baseline
    expect(tierToTotalLP("UNKNOWN_TIER", "IV", 0)).toBe(0);
  });

  it("Emerald II 50LP = 650", () => {
    // (5-4)*4 + 2 = 6 divisions → 600 + 50 = 650
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
    expect(totalLPToPrice(-500)).toBe(10);
  });

  it("LP > 1200 clamped to $100", () => {
    expect(totalLPToPrice(2000)).toBe(100);
  });

  it("300 LP = $32.50", () => {
    expect(totalLPToPrice(300)).toBe(32.5);
  });

  it("100 LP = $17.50", () => {
    // 10 + (100/1200) * 90 = 10 + 7.5 = 17.5
    expect(totalLPToPrice(100)).toBeCloseTo(17.5, 1);
  });
});

// ─── tierToPrice ───

describe("tierToPrice", () => {
  it("Platinum IV 0LP = $10", () => {
    expect(tierToPrice("PLATINUM", "IV", 0)).toBe(10);
  });

  it("Diamond I 100LP = $100", () => {
    expect(tierToPrice("DIAMOND", "I", 100)).toBe(100);
  });

  it("Emerald II 50LP matches manual calculation", () => {
    // totalLP = 650 → 10 + (650/1200)*90 = 10 + 48.75 = 58.75
    expect(tierToPrice("EMERALD", "II", 50)).toBeCloseTo(58.75, 1);
  });
});

// ─── priceToTierLabel ───

describe("priceToTierLabel", () => {
  it("$10 → Platinum IV 0LP", () => {
    expect(priceToTierLabel(10)).toBe("Platinum IV 0LP");
  });

  it("$100 → Diamond I 100LP", () => {
    expect(priceToTierLabel(100)).toBe("Diamond I 100LP");
  });

  it("$55 → midpoint is Emerald II", () => {
    const label = priceToTierLabel(55);
    expect(label).toContain("Emerald");
  });

  it("round trip: tierToPrice → priceToTierLabel produces recognizable rank", () => {
    const price = tierToPrice("EMERALD", "III", 50);
    const label = priceToTierLabel(price);
    expect(label).toContain("Emerald");
    expect(label).toContain("50LP");
  });
});
