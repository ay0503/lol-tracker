import { describe, expect, it, vi, afterEach } from "vitest";
import { getColor, spin, RED_NUMBERS, BLACK_NUMBERS, type BetType } from "./roulette";

describe("roulette.getColor", () => {
  it("0 returns green", () => {
    expect(getColor(0)).toBe("green");
  });

  it("all RED_NUMBERS return red", () => {
    for (const num of RED_NUMBERS) {
      expect(getColor(num)).toBe("red");
    }
  });

  it("all BLACK_NUMBERS return black", () => {
    for (const num of BLACK_NUMBERS) {
      expect(getColor(num)).toBe("black");
    }
  });

  it("RED + BLACK + green(0) covers all 37 numbers", () => {
    const all = new Set([0, ...RED_NUMBERS, ...BLACK_NUMBERS]);
    expect(all.size).toBe(37);
    for (let i = 0; i <= 36; i++) {
      expect(all.has(i)).toBe(true);
    }
  });

  it("RED and BLACK have 18 numbers each", () => {
    expect(RED_NUMBERS).toHaveLength(18);
    expect(BLACK_NUMBERS).toHaveLength(18);
  });

  it("specific red spot checks: 1, 3, 7, 36", () => {
    expect(getColor(1)).toBe("red");
    expect(getColor(3)).toBe("red");
    expect(getColor(7)).toBe("red");
    expect(getColor(36)).toBe("red");
  });

  it("specific black spot checks: 2, 4, 8, 35", () => {
    expect(getColor(2)).toBe("black");
    expect(getColor(4)).toBe("black");
    expect(getColor(8)).toBe("black");
    expect(getColor(35)).toBe("black");
  });
});

describe("roulette.spin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("red bet on red number: win with 2x payout", () => {
    // Math.random() * 37 → floor = 1 (red)
    vi.spyOn(Math, "random").mockReturnValue(1 / 37);
    const result = spin({ type: "red", amount: 10 });
    expect(result.number).toBe(1);
    expect(result.color).toBe("red");
    expect(result.outcome).toBe("win");
    expect(result.won).toBe(true);
    expect(result.totalPayout).toBe(20);
  });

  it("red bet on black number: lose", () => {
    // Math.random() * 37 → floor = 2 (black)
    vi.spyOn(Math, "random").mockReturnValue(2 / 37);
    const result = spin({ type: "red", amount: 10 });
    expect(result.number).toBe(2);
    expect(result.color).toBe("black");
    expect(result.outcome).toBe("lose");
    expect(result.won).toBe(false);
    expect(result.totalPayout).toBe(0);
  });

  it("red bet on green: push (bet returned)", () => {
    // Math.random() * 37 → floor = 0 (green)
    vi.spyOn(Math, "random").mockReturnValue(0);
    const result = spin({ type: "red", amount: 25 });
    expect(result.number).toBe(0);
    expect(result.color).toBe("green");
    expect(result.outcome).toBe("push");
    expect(result.won).toBe(false);
    expect(result.totalPayout).toBe(25);
  });

  it("green bet on green: win with 37x payout", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const result = spin({ type: "green", amount: 5 });
    expect(result.number).toBe(0);
    expect(result.outcome).toBe("win");
    expect(result.won).toBe(true);
    expect(result.totalPayout).toBe(185); // 5 * 37
  });

  it("MAX_PAYOUT caps large green wins at 1800", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const result = spin({ type: "green", amount: 100 });
    // 100 * 37 = 3700, capped to 1800
    expect(result.totalPayout).toBe(1800);
  });
});
