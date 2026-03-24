/**
 * Unified ETF Pricing Module
 *
 * Single source of truth for ETF price calculations.
 * Compounds daily returns from the full price history, matching the frontend chart logic.
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

/**
 * Compute the current price for a single ETF ticker by compounding
 * daily returns from the full price history.
 *
 * For DORI: returns the latest base price directly.
 * For leveraged/inverse ETFs: starts at the same price as DORI on day 1,
 * then applies leverage * daily_return for each subsequent snapshot.
 *
 * This matches the frontend chart logic in playerData.ts getFullETFHistory().
 */
export function computeETFPriceFromHistory(
  ticker: Ticker,
  priceSnapshots: { price: string }[]
): number {
  if (priceSnapshots.length === 0) return 0;

  const prices = priceSnapshots.map(s => parseFloat(s.price));
  const latestBasePrice = prices[prices.length - 1];

  // DORI is always the raw base price
  if (ticker === "DORI") return latestBasePrice;

  const config = ETF_CONFIG[ticker];
  if (!config) return latestBasePrice;

  const multiplier = config.inverse ? -config.leverage : config.leverage;

  // Start ETF at the same price as DORI on day 1, then compound
  let etfPrice = prices[0];
  for (let i = 1; i < prices.length; i++) {
    const prevBase = prices[i - 1];
    if (prevBase <= 0) continue;
    const dailyReturn = (prices[i] - prevBase) / prevBase;
    etfPrice = Math.max(0.01, etfPrice * (1 + dailyReturn * multiplier));
  }

  return etfPrice;
}

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
  priceSnapshots: { price: string }[]
): Record<Ticker, number> {
  const result = {} as Record<Ticker, number>;

  for (const ticker of TICKERS) {
    result[ticker] = computeETFPriceFromHistory(ticker, priceSnapshots);
  }

  return result;
}
