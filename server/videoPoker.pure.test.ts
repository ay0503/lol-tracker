import { describe, it, expect, vi } from "vitest";

// Mock gamePersistence to avoid DB side effects
vi.mock("./gamePersistence", () => ({
  saveGameState: vi.fn(),
  clearGameState: vi.fn(),
  loadGameStates: vi.fn().mockResolvedValue(new Map()),
}));

import { evaluateHand, Card } from "./videoPoker";

// Helper to build a hand from compact notation
function card(rank: number, suit: number): Card {
  return { rank, suit };
}

describe("evaluateHand", () => {
  // ──────────────────────────────────────────────
  // Royal Flush
  // ──────────────────────────────────────────────
  it("Royal Flush (10,J,Q,K,A same suit) returns multiplier 250", () => {
    const hand = [card(10, 0), card(11, 0), card(12, 0), card(13, 0), card(14, 0)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("Royal Flush");
    expect(result.multiplier).toBe(250);
  });

  // ──────────────────────────────────────────────
  // Straight Flush
  // ──────────────────────────────────────────────
  it("Straight Flush (5-9 same suit) returns multiplier 50", () => {
    const hand = [card(5, 2), card(6, 2), card(7, 2), card(8, 2), card(9, 2)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("Straight Flush");
    expect(result.multiplier).toBe(50);
  });

  it("Ace-low straight flush (A,2,3,4,5 same suit) returns multiplier 50", () => {
    const hand = [card(14, 1), card(2, 1), card(3, 1), card(4, 1), card(5, 1)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("Straight Flush");
    expect(result.multiplier).toBe(50);
  });

  // ──────────────────────────────────────────────
  // Four of a Kind
  // ──────────────────────────────────────────────
  it("Four of a Kind returns multiplier 25", () => {
    const hand = [card(7, 0), card(7, 1), card(7, 2), card(7, 3), card(2, 0)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("Four of a Kind");
    expect(result.multiplier).toBe(25);
  });

  // ──────────────────────────────────────────────
  // Full House
  // ──────────────────────────────────────────────
  it("Full House (3+2) returns multiplier 9", () => {
    const hand = [card(10, 0), card(10, 1), card(10, 2), card(4, 0), card(4, 1)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("Full House");
    expect(result.multiplier).toBe(9);
  });

  // ──────────────────────────────────────────────
  // Flush
  // ──────────────────────────────────────────────
  it("Flush (same suit, non-sequential) returns multiplier 5", () => {
    const hand = [card(2, 3), card(5, 3), card(8, 3), card(11, 3), card(13, 3)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("Flush");
    expect(result.multiplier).toBe(5);
  });

  // ──────────────────────────────────────────────
  // Straight
  // ──────────────────────────────────────────────
  it("Straight (sequential, mixed suits) returns multiplier 4", () => {
    const hand = [card(6, 0), card(7, 1), card(8, 2), card(9, 3), card(10, 0)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("Straight");
    expect(result.multiplier).toBe(4);
  });

  it("Ace-low straight (A,2,3,4,5 mixed suits) returns multiplier 4", () => {
    const hand = [card(14, 0), card(2, 1), card(3, 2), card(4, 3), card(5, 0)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("Straight");
    expect(result.multiplier).toBe(4);
  });

  it("Ace-high straight (10,J,Q,K,A mixed suits) returns multiplier 4", () => {
    // Mixed suits so it is not a Royal Flush
    const hand = [card(10, 0), card(11, 1), card(12, 0), card(13, 2), card(14, 3)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("Straight");
    expect(result.multiplier).toBe(4);
  });

  // ──────────────────────────────────────────────
  // Three of a Kind
  // ──────────────────────────────────────────────
  it("Three of a Kind returns multiplier 3", () => {
    const hand = [card(9, 0), card(9, 1), card(9, 2), card(3, 0), card(6, 1)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("Three of a Kind");
    expect(result.multiplier).toBe(3);
  });

  // ──────────────────────────────────────────────
  // Two Pair
  // ──────────────────────────────────────────────
  it("Two Pair returns multiplier 2", () => {
    const hand = [card(5, 0), card(5, 1), card(12, 2), card(12, 3), card(8, 0)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("Two Pair");
    expect(result.multiplier).toBe(2);
  });

  // ──────────────────────────────────────────────
  // Tens or Better (qualifying pairs)
  // ──────────────────────────────────────────────
  it("Pair of 10s (Tens or Better) returns multiplier 1", () => {
    const hand = [card(10, 0), card(10, 1), card(3, 2), card(6, 3), card(8, 0)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("Tens or Better");
    expect(result.multiplier).toBe(1);
  });

  it("Pair of Jacks (Tens or Better) returns multiplier 1", () => {
    const hand = [card(11, 0), card(11, 2), card(2, 1), card(5, 3), card(7, 0)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("Tens or Better");
    expect(result.multiplier).toBe(1);
  });

  it("Pair of Aces (Tens or Better) returns multiplier 1", () => {
    const hand = [card(14, 0), card(14, 3), card(4, 1), card(7, 2), card(9, 0)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("Tens or Better");
    expect(result.multiplier).toBe(1);
  });

  // ──────────────────────────────────────────────
  // Low pair (below 10) - no win
  // ──────────────────────────────────────────────
  it("Low pair (9s) returns No Win with multiplier 0", () => {
    const hand = [card(9, 0), card(9, 1), card(2, 2), card(5, 3), card(13, 0)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("No Win");
    expect(result.multiplier).toBe(0);
  });

  // ──────────────────────────────────────────────
  // No pair - no win
  // ──────────────────────────────────────────────
  it("No pair (high card) returns No Win with multiplier 0", () => {
    const hand = [card(2, 0), card(5, 1), card(8, 2), card(11, 3), card(13, 0)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("No Win");
    expect(result.multiplier).toBe(0);
  });

  // ──────────────────────────────────────────────
  // Near-miss: almost flush (4 same suit + 1 different)
  // ──────────────────────────────────────────────
  it("Almost flush (4 same suit + 1 different) returns No Win", () => {
    const hand = [card(2, 0), card(5, 0), card(8, 0), card(11, 0), card(13, 1)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("No Win");
    expect(result.multiplier).toBe(0);
  });

  // ──────────────────────────────────────────────
  // Near-miss: almost straight (4 sequential + 1 gap)
  // ──────────────────────────────────────────────
  it("Almost straight (4 sequential + 1 gap) returns No Win", () => {
    // 5,6,7,8 are sequential but 11 breaks the straight
    const hand = [card(5, 0), card(6, 1), card(7, 2), card(8, 3), card(11, 0)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("No Win");
    expect(result.multiplier).toBe(0);
  });

  // ──────────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────────
  it("Pair of Queens (Tens or Better) returns multiplier 1", () => {
    const hand = [card(12, 0), card(12, 3), card(3, 1), card(6, 2), card(9, 1)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("Tens or Better");
    expect(result.multiplier).toBe(1);
  });

  it("Low pair (2s) returns No Win with multiplier 0", () => {
    const hand = [card(2, 0), card(2, 1), card(6, 2), card(9, 3), card(13, 0)];
    const result = evaluateHand(hand);
    expect(result.name).toBe("No Win");
    expect(result.multiplier).toBe(0);
  });

  it("throws on hand with fewer than 5 cards", () => {
    const hand = [card(2, 0), card(5, 1), card(8, 2), card(11, 3)];
    expect(() => evaluateHand(hand)).toThrow("Hand must contain exactly 5 cards");
  });

  it("throws on hand with more than 5 cards", () => {
    const hand = [card(2, 0), card(5, 1), card(8, 2), card(11, 3), card(13, 0), card(4, 1)];
    expect(() => evaluateHand(hand)).toThrow("Hand must contain exactly 5 cards");
  });
});
