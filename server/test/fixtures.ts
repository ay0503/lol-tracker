/** Price history snapshots across multiple days for ETF tests */
export function makePriceSnapshots(dailyPrices: number[]): { price: string; timestamp: number }[] {
  const baseTime = new Date("2026-03-25T00:00:00Z").getTime();
  const DAY = 24 * 60 * 60 * 1000;
  return dailyPrices.map((price, idx) => ({
    price: price.toFixed(2),
    timestamp: baseTime + idx * DAY + 12 * 60 * 60 * 1000, // noon each day
  }));
}

/** Multiple snapshots per day for intraday testing */
export function makeIntradaySnapshots(days: number[][]): { price: string; timestamp: number }[] {
  const baseTime = new Date("2026-03-25T00:00:00Z").getTime();
  const DAY = 24 * 60 * 60 * 1000;
  const snapshots: { price: string; timestamp: number }[] = [];
  for (let d = 0; d < days.length; d++) {
    const interval = DAY / (days[d].length + 1);
    for (let s = 0; s < days[d].length; s++) {
      snapshots.push({
        price: days[d][s].toFixed(2),
        timestamp: baseTime + d * DAY + (s + 1) * interval,
      });
    }
  }
  return snapshots;
}

/** Card helper for blackjack/poker tests */
export function card(rank: number | string, suit: number = 0, hidden = false) {
  return { rank, suit, hidden };
}
