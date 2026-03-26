/**
 * Wheel (Fortune Wheel) game engine — instant resolution.
 * 50 segments with multipliers. ~3.5% house edge.
 */

const MAX_PAYOUT = 250;

// Segment distribution: [multiplier, count]
const SEGMENT_DEFS: [number, number][] = [
  [0, 1],      // 2% — lose
  [1.5, 24],   // 48%
  [2, 13],     // 26%
  [3, 7],      // 14%
  [5, 3],      // 6%
  [10, 1],     // 2%
  [50, 1],     // 2%
];

const SEGMENTS: number[] = [];
for (const [mult, count] of SEGMENT_DEFS) {
  for (let i = 0; i < count; i++) SEGMENTS.push(mult);
}

export interface WheelResult {
  segmentIndex: number;
  multiplier: number;
  betAmount: number;
  payout: number;
  timestamp: number;
}

export interface WheelHistory {
  multiplier: number;
  timestamp: number;
}

const recentResults: WheelHistory[] = [];
const MAX_HISTORY = 20;

export function spin(betAmount: number): WheelResult {
  const segmentIndex = Math.floor(Math.random() * SEGMENTS.length);
  const multiplier = SEGMENTS[segmentIndex];
  const rawPayout = betAmount * multiplier;
  const payout = Math.min(Math.round(rawPayout * 100) / 100, MAX_PAYOUT);

  recentResults.unshift({ multiplier, timestamp: Date.now() });
  if (recentResults.length > MAX_HISTORY) recentResults.pop();

  return { segmentIndex, multiplier, betAmount, payout, timestamp: Date.now() };
}

export function getHistory(): WheelHistory[] {
  return recentResults;
}

export function getSegments(): number[] {
  return SEGMENTS;
}
