import { describe, expect, it } from "vitest";
import {
  computeETFPriceFromHistory,
  computeETFHistoryFromSnapshots,
  computeAllETFPricesSync,
  TICKERS,
} from "./etfPricing";
import type { Ticker } from "./etfPricing";

// ─── Helpers ───

function snap(price: number, timestamp: number): { price: string; timestamp: number } {
  return { price: price.toFixed(2), timestamp };
}

function fullSnap(price: number, timestamp: number) {
  return { price: price.toFixed(2), timestamp, tier: "EMERALD", division: "II", lp: 50, totalLP: 550 };
}

/**
 * Create a timestamp for a specific day at a given hour.
 * Day 0 = Jan 1 2025 00:00 UTC.
 */
function dayTs(day: number, hour = 12): number {
  return new Date(2025, 0, 1 + day, hour, 0, 0).getTime();
}

// ─── computeETFPriceFromHistory ───

describe("computeETFPriceFromHistory", () => {
  // 1. Empty snapshots
  it("returns 0 for empty snapshots for every ticker", () => {
    for (const ticker of TICKERS) {
      expect(computeETFPriceFromHistory(ticker, [])).toBe(0);
    }
  });

  // 2. Single snapshot — all tickers equal to that price
  it("returns the single snapshot price for all tickers", () => {
    const snapshots = [snap(100, dayTs(0))];
    for (const ticker of TICKERS) {
      expect(computeETFPriceFromHistory(ticker, snapshots)).toBe(100);
    }
  });

  // 3. DORI always returns latest raw price
  it("DORI always returns the latest raw price regardless of history", () => {
    const snapshots = [
      snap(100, dayTs(0)),
      snap(110, dayTs(1)),
      snap(105, dayTs(2)),
      snap(120, dayTs(3)),
    ];
    expect(computeETFPriceFromHistory("DORI", snapshots)).toBe(120);
  });

  it("DORI ignores intermediate prices and returns the last one", () => {
    const snapshots = [
      snap(50, dayTs(0)),
      snap(200, dayTs(1)),
      snap(10, dayTs(2)),
    ];
    expect(computeETFPriceFromHistory("DORI", snapshots)).toBe(10);
  });

  // 4. DDRI 2x: 10% daily gain => ~20% ETF gain
  it("DDRI amplifies a 10% daily gain to ~20%", () => {
    const snapshots = [
      snap(100, dayTs(0)),
      snap(110, dayTs(1)), // +10% day
    ];
    const price = computeETFPriceFromHistory("DDRI", snapshots);
    // ETF: 100 * (1 + 0.10 * 2) = 120
    expect(price).toBeCloseTo(120, 2);
  });

  // 5. TDRI 3x: 10% daily gain => ~30% ETF gain
  it("TDRI amplifies a 10% daily gain to ~30%", () => {
    const snapshots = [
      snap(100, dayTs(0)),
      snap(110, dayTs(1)),
    ];
    const price = computeETFPriceFromHistory("TDRI", snapshots);
    // ETF: 100 * (1 + 0.10 * 3) = 130
    expect(price).toBeCloseTo(130, 2);
  });

  // 6. SDRI -2x inverse: 10% gain => ~20% loss
  it("SDRI inverts a 10% daily gain to ~20% loss", () => {
    const snapshots = [
      snap(100, dayTs(0)),
      snap(110, dayTs(1)),
    ];
    const price = computeETFPriceFromHistory("SDRI", snapshots);
    // ETF: 100 * (1 + 0.10 * (-2)) = 80
    expect(price).toBeCloseTo(80, 2);
  });

  // 7. XDRI -3x inverse: 10% gain => ~30% loss
  it("XDRI inverts a 10% daily gain to ~30% loss", () => {
    const snapshots = [
      snap(100, dayTs(0)),
      snap(110, dayTs(1)),
    ];
    const price = computeETFPriceFromHistory("XDRI", snapshots);
    // ETF: 100 * (1 + 0.10 * (-3)) = 70
    expect(price).toBeCloseTo(70, 2);
  });

  // 8. Same-day snapshots compound ONCE (not per snapshot)
  it("multiple same-day snapshots compound only once using the last close", () => {
    const snapshots = [
      snap(100, dayTs(0, 9)),
      snap(105, dayTs(0, 12)),  // same day
      snap(110, dayTs(0, 18)),  // same day
      snap(120, dayTs(1, 12)),  // next day — daily return is from 110 to 120
    ];
    const price = computeETFPriceFromHistory("DDRI", snapshots);
    // getDailyCloses: day0 close = 110 (last of day0), day1 close = 120
    // First daily close = 110 (replaces initial 100)
    // Day boundary: etfPrice starts at 100 (firstPrice)
    // Loop: close=110 => return = (110-100)/100 = 0.10, etf = 100*(1+0.10*2) = 120
    //        close=120 => return = (120-110)/110 ≈ 0.0909, etf = 120*(1+0.0909*2) ≈ 141.82
    expect(price).toBeCloseTo(141.82, 1);
  });

  it("two snapshots on the same day do NOT compound twice", () => {
    // Contrast: if these were on different days, DDRI would compound each separately
    const sameDay = [
      snap(100, dayTs(0, 8)),
      snap(110, dayTs(0, 20)),  // same day
    ];
    const diffDay = [
      snap(100, dayTs(0)),
      snap(110, dayTs(1)),  // different day
    ];
    const sameDayPrice = computeETFPriceFromHistory("DDRI", sameDay);
    const diffDayPrice = computeETFPriceFromHistory("DDRI", diffDay);

    // Same day: getDailyCloses = [110] (only one day), loop processes close=110
    // from firstPrice=100, return = 0.10, etf = 100*(1+0.20) = 120
    expect(sameDayPrice).toBeCloseTo(120, 2);
    // Different days: getDailyCloses = [100, 110], same calculation
    expect(diffDayPrice).toBeCloseTo(120, 2);
  });

  // 9. Multi-day compounding (3+ days)
  it("compounds daily returns over multiple days for DDRI", () => {
    const snapshots = [
      snap(100, dayTs(0)),
      snap(110, dayTs(1)),  // +10%
      snap(121, dayTs(2)),  // +10%
    ];
    const price = computeETFPriceFromHistory("DDRI", snapshots);
    // Day 1: return = 0.10, etf = 100 * (1 + 0.10 * 2) = 120
    // Day 2: return = (121-110)/110 = 0.10, etf = 120 * (1 + 0.10 * 2) = 144
    expect(price).toBeCloseTo(144, 2);
  });

  it("compounds daily returns over multiple days for TDRI", () => {
    const snapshots = [
      snap(100, dayTs(0)),
      snap(110, dayTs(1)),  // +10%
      snap(121, dayTs(2)),  // +10%
    ];
    const price = computeETFPriceFromHistory("TDRI", snapshots);
    // Day 1: etf = 100 * (1 + 0.10 * 3) = 130
    // Day 2: etf = 130 * (1 + 0.10 * 3) = 169
    expect(price).toBeCloseTo(169, 2);
  });

  it("inverse ETFs compound daily over multiple days", () => {
    const snapshots = [
      snap(100, dayTs(0)),
      snap(110, dayTs(1)),  // +10%
      snap(121, dayTs(2)),  // +10%
    ];
    const sdri = computeETFPriceFromHistory("SDRI", snapshots);
    // Day 1: etf = 100 * (1 + 0.10 * (-2)) = 80
    // Day 2: etf = 80 * (1 + 0.10 * (-2)) = 64
    expect(sdri).toBeCloseTo(64, 2);

    const xdri = computeETFPriceFromHistory("XDRI", snapshots);
    // Day 1: etf = 100 * (1 + 0.10 * (-3)) = 70
    // Day 2: etf = 70 * (1 + 0.10 * (-3)) = 49
    expect(xdri).toBeCloseTo(49, 2);
  });

  // 10. Floor at 0.01 (massive inverse movement)
  it("floors ETF price at 0.01 for massive positive move on inverse ticker", () => {
    const snapshots = [
      snap(100, dayTs(0)),
      snap(200, dayTs(1)),  // +100% day
    ];
    // SDRI: 100 * (1 + 1.0 * (-2)) = 100 * (-1) = -100 => clamped to 0.01
    const sdri = computeETFPriceFromHistory("SDRI", snapshots);
    expect(sdri).toBe(0.01);

    // XDRI: 100 * (1 + 1.0 * (-3)) = 100 * (-2) = -200 => clamped to 0.01
    const xdri = computeETFPriceFromHistory("XDRI", snapshots);
    expect(xdri).toBe(0.01);
  });

  it("floors at 0.01 after multi-day crash for inverse ETFs", () => {
    const snapshots = [
      snap(100, dayTs(0)),
      snap(150, dayTs(1)),  // +50%
      snap(225, dayTs(2)),  // +50% from 150
    ];
    // SDRI day 1: 100 * (1 + 0.50 * (-2)) = 100 * 0 = 0 => clamped to 0.01
    // SDRI day 2: 0.01 * (1 + 0.50 * (-2)) = 0.01 * 0 = 0 => clamped to 0.01
    expect(computeETFPriceFromHistory("SDRI", snapshots)).toBe(0.01);
  });

  // 14. Zero price guard (prevBase <= 0)
  it("handles zero base price gracefully (prevBase <= 0 skip)", () => {
    const snapshots = [
      snap(0, dayTs(0)),
      snap(100, dayTs(1)),
    ];
    // prevBase starts at 0, so the loop skips division and sets prevBase = 100
    // etfPrice stays at firstPrice (0), but getDailyCloses = [0, 100]
    // First iteration: close=0, prevBase=0 => skip, prevBase becomes 0 again
    // Actually: firstPrice = 0, dailyCloses = [0, 100]
    // close=0: prevBase=0 => skip, prevBase=0
    // close=100: prevBase=0 => skip, prevBase=100
    // etfPrice stays 0
    const price = computeETFPriceFromHistory("DDRI", snapshots);
    expect(price).toBe(0);
  });

  it("handles negative daily return correctly for leveraged ETFs", () => {
    const snapshots = [
      snap(100, dayTs(0)),
      snap(90, dayTs(1)),  // -10%
    ];
    // DDRI: 100 * (1 + (-0.10) * 2) = 100 * 0.80 = 80
    expect(computeETFPriceFromHistory("DDRI", snapshots)).toBeCloseTo(80, 2);
    // TDRI: 100 * (1 + (-0.10) * 3) = 100 * 0.70 = 70
    expect(computeETFPriceFromHistory("TDRI", snapshots)).toBeCloseTo(70, 2);
    // SDRI (inverse): 100 * (1 + (-0.10) * (-2)) = 100 * 1.20 = 120
    expect(computeETFPriceFromHistory("SDRI", snapshots)).toBeCloseTo(120, 2);
    // XDRI (inverse): 100 * (1 + (-0.10) * (-3)) = 100 * 1.30 = 130
    expect(computeETFPriceFromHistory("XDRI", snapshots)).toBeCloseTo(130, 2);
  });

  it("leveraged ETFs decay over volatile multi-day movement", () => {
    // Classic volatility decay: price goes up 10% then down 10%
    const snapshots = [
      snap(100, dayTs(0)),
      snap(110, dayTs(1)),  // +10%
      snap(99, dayTs(2)),   // -10% from 110
    ];
    // DORI: 99
    expect(computeETFPriceFromHistory("DORI", snapshots)).toBe(99);
    // DDRI day 1: 100 * (1 + 0.10 * 2) = 120
    // DDRI day 2: 120 * (1 + (-0.10) * 2) = 120 * 0.80 = 96
    // Note: base is down 1% but DDRI is down 4% — volatility decay
    expect(computeETFPriceFromHistory("DDRI", snapshots)).toBeCloseTo(96, 2);
  });
});

// ─── computeETFHistoryFromSnapshots ───

describe("computeETFHistoryFromSnapshots", () => {
  it("returns empty array for empty snapshots", () => {
    expect(computeETFHistoryFromSnapshots("DORI", [])).toEqual([]);
    expect(computeETFHistoryFromSnapshots("DDRI", [])).toEqual([]);
  });

  it("DORI returns raw prices with metadata", () => {
    const snapshots = [
      fullSnap(100, dayTs(0)),
      fullSnap(105, dayTs(0, 14)),
      fullSnap(110, dayTs(1)),
    ];
    const history = computeETFHistoryFromSnapshots("DORI", snapshots);
    expect(history).toHaveLength(3);
    expect(history[0].price).toBe(100);
    expect(history[1].price).toBe(105);
    expect(history[2].price).toBe(110);
    expect(history[0].tier).toBe("EMERALD");
    expect(history[0].division).toBe("II");
    expect(history[0].lp).toBe(50);
    expect(history[0].totalLP).toBe(550);
  });

  // 11. Intraday linear movement
  it("moves linearly within a day (no intraday compounding)", () => {
    const snapshots = [
      fullSnap(100, dayTs(0, 9)),
      fullSnap(105, dayTs(0, 12)),  // +5% intraday
      fullSnap(110, dayTs(0, 15)),  // +10% from open
    ];
    const history = computeETFHistoryFromSnapshots("DDRI", snapshots);

    // First point is always the raw price
    expect(history[0].price).toBe(100);

    // Intraday: ETF = dayOpenETF * (1 + intradayReturn * multiplier)
    // At 105: return = (105-100)/100 = 0.05, etf = 100 * (1 + 0.05 * 2) = 110
    expect(history[1].price).toBeCloseTo(110, 2);

    // At 110: return = (110-100)/100 = 0.10, etf = 100 * (1 + 0.10 * 2) = 120
    expect(history[2].price).toBeCloseTo(120, 2);
  });

  // 12. Day boundary transition in history
  it("compounds at day boundary and resets intraday tracking", () => {
    const snapshots = [
      fullSnap(100, dayTs(0, 10)),   // Day 0 open
      fullSnap(110, dayTs(0, 18)),   // Day 0 close (+10% from open)
      fullSnap(115, dayTs(1, 10)),   // Day 1: new day boundary triggers compound
      fullSnap(120, dayTs(1, 14)),   // Day 1: intraday move from day1 open base
    ];
    const history = computeETFHistoryFromSnapshots("DDRI", snapshots);

    // Point 0: raw price
    expect(history[0].price).toBe(100);

    // Point 1 (day 0 intraday): return = (110-100)/100 = 0.10
    // etf = 100 * (1 + 0.10 * 2) = 120
    expect(history[1].price).toBeCloseTo(120, 2);

    // Point 2 (day 1 start): day boundary compounds prev day return
    // prevDayReturn = (110-100)/100 = 0.10
    // dayOpenETF = max(0.01, 100 * (1 + 0.10 * 2)) = 120
    // dayOpenBase = 110 (prev day's close)
    // intradayReturn = (115-110)/110 ≈ 0.04545
    // etf = 120 * (1 + 0.04545 * 2) ≈ 130.91
    expect(history[2].price).toBeCloseTo(130.91, 1);

    // Point 3 (day 1 intraday): return from dayOpenBase=110
    // intradayReturn = (120-110)/110 ≈ 0.09091
    // etf = 120 * (1 + 0.09091 * 2) ≈ 141.82
    expect(history[3].price).toBeCloseTo(141.82, 1);
  });

  it("inverse ETF history shows correct intraday and daily behavior", () => {
    const snapshots = [
      fullSnap(100, dayTs(0)),
      fullSnap(110, dayTs(1)),  // +10% day
    ];
    const history = computeETFHistoryFromSnapshots("SDRI", snapshots);
    expect(history[0].price).toBe(100);
    // Day boundary: prevDayReturn = (100-100)/100 = 0 for first point
    // Actually, snapshot[0] is first, snapshot[1] triggers day boundary
    // prevDayReturn = (100-100)/100 = 0 (prices[0] - dayOpenBase) / dayOpenBase = 0
    // dayOpenETF = max(0.01, 100 * (1 + 0 * (-2))) = 100
    // dayOpenBase = 100
    // intradayReturn = (110-100)/100 = 0.10
    // etf = 100 * (1 + 0.10 * (-2)) = 80
    expect(history[1].price).toBeCloseTo(80, 2);
  });

  it("preserves metadata fields in history output", () => {
    const snapshots = [
      { price: "100.00", timestamp: dayTs(0), tier: "GOLD", division: "I", lp: 75, totalLP: 475 },
      { price: "110.00", timestamp: dayTs(1), tier: "PLATINUM", division: "IV", lp: 10, totalLP: 510 },
    ];
    const history = computeETFHistoryFromSnapshots("DDRI", snapshots);
    expect(history[0].tier).toBe("GOLD");
    expect(history[0].division).toBe("I");
    expect(history[1].tier).toBe("PLATINUM");
    expect(history[1].division).toBe("IV");
    expect(history[1].lp).toBe(10);
    expect(history[1].totalLP).toBe(510);
  });

  it("floors intraday price at 0.01 for inverse ETFs", () => {
    const snapshots = [
      fullSnap(100, dayTs(0, 9)),
      fullSnap(200, dayTs(0, 18)),  // +100% intraday
    ];
    const history = computeETFHistoryFromSnapshots("SDRI", snapshots);
    // intradayReturn = (200-100)/100 = 1.0
    // etf = 100 * (1 + 1.0 * (-2)) = 100 * (-1) = -100 => clamped to 0.01
    expect(history[1].price).toBe(0.01);
  });
});

// ─── computeAllETFPricesSync ───

describe("computeAllETFPricesSync", () => {
  // 13. Returns all 5 tickers
  it("returns a record with all 5 tickers", () => {
    const snapshots = [snap(100, dayTs(0))];
    const result = computeAllETFPricesSync(snapshots);
    expect(Object.keys(result)).toHaveLength(5);
    expect(result.DORI).toBeDefined();
    expect(result.DDRI).toBeDefined();
    expect(result.TDRI).toBeDefined();
    expect(result.SDRI).toBeDefined();
    expect(result.XDRI).toBeDefined();
  });

  it("returns all zeros for empty snapshots", () => {
    const result = computeAllETFPricesSync([]);
    for (const ticker of TICKERS) {
      expect(result[ticker]).toBe(0);
    }
  });

  it("single snapshot gives equal price for all tickers", () => {
    const snapshots = [snap(55.5, dayTs(0))];
    const result = computeAllETFPricesSync(snapshots);
    for (const ticker of TICKERS) {
      expect(result[ticker]).toBeCloseTo(55.5, 1);
    }
  });

  it("returns correct leveraged prices for multi-day history", () => {
    const snapshots = [
      snap(100, dayTs(0)),
      snap(110, dayTs(1)),  // +10%
    ];
    const result = computeAllETFPricesSync(snapshots);

    expect(result.DORI).toBe(110);
    expect(result.DDRI).toBeCloseTo(120, 2);  // 2x
    expect(result.TDRI).toBeCloseTo(130, 2);  // 3x
    expect(result.SDRI).toBeCloseTo(80, 2);   // -2x
    expect(result.XDRI).toBeCloseTo(70, 2);   // -3x
  });

  it("handles fractional prices correctly", () => {
    const snapshots = [
      snap(5.25, dayTs(0)),
      snap(5.50, dayTs(1)),
    ];
    const result = computeAllETFPricesSync(snapshots);
    // Return = (5.50-5.25)/5.25 ≈ 0.04762
    expect(result.DORI).toBeCloseTo(5.50, 2);
    // DDRI: 5.25 * (1 + 0.04762 * 2) ≈ 5.75
    expect(result.DDRI).toBeCloseTo(5.75, 2);
  });
});
