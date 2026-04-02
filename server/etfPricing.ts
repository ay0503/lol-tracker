/**
 * Unified ETF Pricing Module
 *
 * Single source of truth for ETF price calculations.
 * Compounds DAILY returns (not per-snapshot) to match real leveraged ETF behavior.
 * Within a day, ETF moves linearly with the underlying (no intraday compounding).
 * Used by routers.ts (API responses), pollEngine.ts (order execution), and portfolio snapshots.
 */
import { getPriceHistory } from "./db";

export const TICKERS = ["DORI", "DDRI", "TDRI", "SDRI", "XDRI"] as const;
export type Ticker = (typeof TICKERS)[number];

interface ETFConfig {
  leverage: number;
  inverse: boolean;
}

const ETF_CONFIG: Record<Ticker, ETFConfig> = {
  DORI: { leverage: 1, inverse: false },
  DDRI: { leverage: 2, inverse: false },
  TDRI: { leverage: 3, inverse: false },
  SDRI: { leverage: 2, inverse: true },
  XDRI: { leverage: 3, inverse: true },
};

export interface ETFPriceResult {
  ticker: Ticker;
  price: number;
}

// ─── Helpers ───

function getDayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Extract daily close prices from snapshots.
 * Returns array of last price per calendar day.
 */
function getDailyCloses(snapshots: { price: string; timestamp: number }[]): number[] {
  if (snapshots.length === 0) return [];

  const closes: number[] = [];
  let currentDay = getDayKey(snapshots[0].timestamp);
  closes.push(parseFloat(snapshots[0].price));

  for (let i = 1; i < snapshots.length; i++) {
    const day = getDayKey(snapshots[i].timestamp);
    const price = parseFloat(snapshots[i].price);

    if (day !== currentDay) {
      closes.push(price);
      currentDay = day;
    } else {
      closes[closes.length - 1] = price;
    }
  }

  return closes;
}

// ─── Current Price ───

/**
 * Compute the current price for a single ETF ticker by compounding
 * daily returns from the full price history.
 *
 * For DORI: returns the latest base price directly.
 * For leveraged/inverse ETFs: starts at the same price as DORI on day 1,
 * then applies leverage * daily_return for each subsequent DAY.
 */
export function computeETFPriceFromHistory(
  ticker: Ticker,
  priceSnapshots: { price: string; timestamp: number }[]
): number {
  if (priceSnapshots.length === 0) return 0;

  const latestBasePrice = parseFloat(priceSnapshots[priceSnapshots.length - 1].price);

  // DORI is always the raw base price
  if (ticker === "DORI") return latestBasePrice;

  const config = ETF_CONFIG[ticker];
  if (!config) return latestBasePrice;

  const multiplier = config.inverse ? -config.leverage : config.leverage;
  const firstPrice = parseFloat(priceSnapshots[0].price);
  const dailyCloses = getDailyCloses(priceSnapshots);

  // Compound daily: first return is from first snapshot to day 1 close,
  // then close-to-close for subsequent days.
  let etfPrice = firstPrice;
  let prevBase = firstPrice;

  for (const close of dailyCloses) {
    if (prevBase <= 0) { prevBase = close; continue; }
    const dailyReturn = (close - prevBase) / prevBase;
    etfPrice = Math.max(0.01, etfPrice * (1 + dailyReturn * multiplier));
    prevBase = close;
  }

  return etfPrice;
}

// ─── Batch Current Prices ───

/**
 * Compute current prices for ALL ETF tickers from the full price history.
 * Returns a map of ticker → price.
 */
export async function computeAllETFPrices(): Promise<Record<Ticker, number>> {
  const history = await getPriceHistory();
  const result = {} as Record<Ticker, number>;

  for (const ticker of TICKERS) {
    result[ticker] = computeETFPriceFromHistory(ticker, history);
  }

  return result;
}

/**
 * Compute current prices for ALL ETF tickers from a provided price history array.
 * Synchronous version for when you already have the history loaded.
 */
export function computeAllETFPricesSync(
  priceSnapshots: { price: string; timestamp: number }[]
): Record<Ticker, number> {
  const result = {} as Record<Ticker, number>;

  for (const ticker of TICKERS) {
    result[ticker] = computeETFPriceFromHistory(ticker, priceSnapshots);
  }

  return result;
}

// ─── Full History (for charts) ───

export interface ETFHistoryPoint {
  timestamp: number;
  price: number;
  tier: string;
  division: string;
  lp: number;
  totalLP: number;
}

/**
 * Compute the full ETF price history for a given ticker.
 * Returns a price at every snapshot, but compounding only happens at day boundaries.
 * Within a day, the ETF moves linearly with the underlying (no intraday compounding).
 */
export function computeETFHistoryFromSnapshots(
  ticker: Ticker,
  snapshots: { timestamp: number; price: string; tier: string; division: string; lp: number; totalLP: number }[]
): ETFHistoryPoint[] {
  if (snapshots.length === 0) return [];

  const prices = snapshots.map(s => parseFloat(s.price));

  if (ticker === "DORI") {
    return snapshots.map((s, i) => ({
      timestamp: s.timestamp,
      price: prices[i],
      tier: s.tier,
      division: s.division,
      lp: s.lp,
      totalLP: s.totalLP,
    }));
  }

  const config = ETF_CONFIG[ticker];
  if (!config) {
    return snapshots.map((s, i) => ({
      timestamp: s.timestamp,
      price: prices[i],
      tier: s.tier,
      division: s.division,
      lp: s.lp,
      totalLP: s.totalLP,
    }));
  }

  const multiplier = config.inverse ? -config.leverage : config.leverage;
  const result: ETFHistoryPoint[] = [];

  // Track day boundaries for daily compounding
  let dayOpenBase = prices[0];   // base price at start of current day
  let dayOpenETF = prices[0];    // ETF price at start of current day
  let currentDay = getDayKey(snapshots[0].timestamp);

  result.push({
    timestamp: snapshots[0].timestamp,
    price: prices[0],
    tier: snapshots[0].tier,
    division: snapshots[0].division,
    lp: snapshots[0].lp,
    totalLP: snapshots[0].totalLP,
  });

  for (let i = 1; i < snapshots.length; i++) {
    const day = getDayKey(snapshots[i].timestamp);

    if (day !== currentDay) {
      // Day boundary: compound the previous day's full return
      if (dayOpenBase > 0) {
        const prevDayReturn = (prices[i - 1] - dayOpenBase) / dayOpenBase;
        dayOpenETF = Math.max(0.01, dayOpenETF * (1 + prevDayReturn * multiplier));
      }
      dayOpenBase = prices[i - 1]; // prev day's close = new day's open
      currentDay = day;
    }

    // Intraday: ETF moves linearly from day open (no compounding)
    let etfPrice: number;
    if (dayOpenBase > 0) {
      const intradayReturn = (prices[i] - dayOpenBase) / dayOpenBase;
      etfPrice = Math.max(0.01, dayOpenETF * (1 + intradayReturn * multiplier));
    } else {
      etfPrice = dayOpenETF;
    }

    result.push({
      timestamp: snapshots[i].timestamp,
      price: etfPrice,
      tier: snapshots[i].tier,
      division: snapshots[i].division,
      lp: snapshots[i].lp,
      totalLP: snapshots[i].totalLP,
    });
  }

  return result;
}
