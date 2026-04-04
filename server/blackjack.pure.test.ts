import { describe, it, expect, vi } from "vitest";

// Mock gamePersistence to avoid DB side effects
vi.mock("./gamePersistence", () => ({
  saveGameState: vi.fn(),
  clearGameState: vi.fn(),
  loadGameStates: vi.fn().mockResolvedValue(new Map()),
}));

import { handValue, canSplit, Card, BlackjackGame } from "./blackjack";

// Helper to build a card from shorthand
function card(rank: Card["rank"], suit: Card["suit"] = "♠", hidden = false): Card {
  return hidden ? { rank, suit, hidden: true } : { rank, suit };
}

// Helper to build a minimal BlackjackGame for canSplit tests
function makeGame(overrides: Partial<BlackjackGame> = {}): BlackjackGame {
  return {
    id: "bj_test",
    userId: 1,
    bet: 1,
    deck: [],
    playerHand: [],
    dealerHand: [],
    status: "playing",
    payout: 0,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════
// handValue tests
// ═══════════════════════════════════════════════
describe("handValue", () => {
  it("simple numeric cards: 5 + 7 = 12", () => {
    const hand = [card("5"), card("7")];
    expect(handValue(hand)).toBe(12);
  });

  it("face cards count as 10: K + Q = 20", () => {
    const hand = [card("K", "♠"), card("Q", "♥")];
    expect(handValue(hand)).toBe(20);
  });

  it("Ace + face card = 21 (natural blackjack)", () => {
    const hand = [card("A", "♠"), card("K", "♦")];
    expect(handValue(hand)).toBe(21);
  });

  it("two Aces = 12 (one counts as 1)", () => {
    const hand = [card("A", "♠"), card("A", "♥")];
    expect(handValue(hand)).toBe(12);
  });

  it("three Aces = 13 (two count as 1)", () => {
    const hand = [card("A", "♠"), card("A", "♥"), card("A", "♦")];
    expect(handValue(hand)).toBe(13);
  });

  it("Ace soft-to-hard conversion avoids bust: A + 7 + 8 = 16", () => {
    const hand = [card("A"), card("7"), card("8")];
    // A(11) + 7 + 8 = 26 > 21 -> A becomes 1 -> 1 + 7 + 8 = 16
    expect(handValue(hand)).toBe(16);
  });

  it("hidden card is excluded from the total", () => {
    const hand = [card("10"), card("K", "♠", true)];
    // Only the 10 counts; K is hidden
    expect(handValue(hand)).toBe(10);
  });

  it("empty hand = 0", () => {
    expect(handValue([])).toBe(0);
  });

  it("bust hand: 10 + 8 + 5 = 23", () => {
    const hand = [card("10"), card("8"), card("5")];
    expect(handValue(hand)).toBe(23);
  });

  it("Jack = 10: J + 9 = 19", () => {
    const hand = [card("J"), card("9")];
    expect(handValue(hand)).toBe(19);
  });

  it("Ace stays high when total <= 21: A + 5 = 16", () => {
    const hand = [card("A"), card("5")];
    expect(handValue(hand)).toBe(16);
  });
});

// ═══════════════════════════════════════════════
// canSplit tests
// ═══════════════════════════════════════════════
describe("canSplit", () => {
  it("two same-rank cards while playing with no prior split returns true", () => {
    const game = makeGame({
      playerHand: [card("8", "♠"), card("8", "♦")],
    });
    expect(canSplit(game)).toBe(true);
  });

  it("two face cards with same value (K + Q, both 10) returns true", () => {
    const game = makeGame({
      playerHand: [card("K", "♠"), card("Q", "♥")],
    });
    expect(canSplit(game)).toBe(true);
  });

  it("two cards with different values returns false", () => {
    const game = makeGame({
      playerHand: [card("8", "♠"), card("9", "♦")],
    });
    expect(canSplit(game)).toBe(false);
  });

  it("more than 2 cards returns false", () => {
    const game = makeGame({
      playerHand: [card("8", "♠"), card("8", "♦"), card("3", "♣")],
    });
    expect(canSplit(game)).toBe(false);
  });

  it("status not 'playing' returns false", () => {
    const game = makeGame({
      status: "player_bust",
      playerHand: [card("8", "♠"), card("8", "♦")],
    });
    expect(canSplit(game)).toBe(false);
  });

  it("already has a splitHand returns false (no re-splitting)", () => {
    const game = makeGame({
      playerHand: [card("8", "♠"), card("8", "♦")],
      splitHand: [card("8", "♣"), card("5", "♠")],
    });
    expect(canSplit(game)).toBe(false);
  });
});
