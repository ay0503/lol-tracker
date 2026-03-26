/**
 * Video Poker (Jacks or Better) game engine — server-side logic.
 * 52-card deck, deal 5 cards, hold/discard, draw replacements.
 * ~2% house edge via adjusted pay table. Games stored in memory.
 */

export interface Card {
  rank: number; // 2-14 (J=11, Q=12, K=13, A=14)
  suit: number; // 0-3
}

export interface VideoPokerGame {
  id: string;
  userId: number;
  bet: number;
  deck: Card[];
  hand: Card[];
  held: boolean[];
  status: "dealing" | "holding" | "complete";
  result: string | null;
  multiplier: number;
  payout: number;
  createdAt: number;
}

export interface PublicVideoPokerGame {
  id: string;
  userId: number;
  bet: number;
  hand: Card[];
  held: boolean[];
  status: "dealing" | "holding" | "complete";
  result: string | null;
  multiplier: number;
  payout: number;
}

interface HandResult {
  name: string;
  multiplier: number;
}

// Pay table (Jacks or Better, adjusted for ~2% house edge)
const PAY_TABLE: { name: string; multiplier: number }[] = [
  { name: "Royal Flush", multiplier: 250 },
  { name: "Straight Flush", multiplier: 50 },
  { name: "Four of a Kind", multiplier: 25 },
  { name: "Full House", multiplier: 8 },
  { name: "Flush", multiplier: 5 },
  { name: "Straight", multiplier: 4 },
  { name: "Three of a Kind", multiplier: 3 },
  { name: "Two Pair", multiplier: 2 },
  { name: "Jacks or Better", multiplier: 1 },
];

const activeGames = new Map<number, VideoPokerGame>();

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit });
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function gameToPublic(game: VideoPokerGame): PublicVideoPokerGame {
  return {
    id: game.id,
    userId: game.userId,
    bet: game.bet,
    hand: game.hand,
    held: game.held,
    status: game.status,
    result: game.result,
    multiplier: game.multiplier,
    payout: game.payout,
  };
}

/**
 * Evaluate a 5-card poker hand and return the best matching result.
 */
export function evaluateHand(hand: Card[]): HandResult {
  if (hand.length !== 5) throw new Error("Hand must contain exactly 5 cards");

  const ranks = hand.map((c) => c.rank).sort((a, b) => a - b);
  const suits = hand.map((c) => c.suit);

  // Count occurrences of each rank
  const rankCounts = new Map<number, number>();
  for (const r of ranks) {
    rankCounts.set(r, (rankCounts.get(r) || 0) + 1);
  }
  const counts = Array.from(rankCounts.values()).sort((a, b) => b - a);
  const uniqueRanks = rankCounts.size;

  // Check flush (all same suit)
  const isFlush = suits.every((s) => s === suits[0]);

  // Check straight
  // Normal straight: consecutive ranks
  const isNormalStraight =
    uniqueRanks === 5 && ranks[4] - ranks[0] === 4;

  // Ace-low straight (A-2-3-4-5): ranks sorted = [2, 3, 4, 5, 14]
  const isAceLowStraight =
    uniqueRanks === 5 &&
    ranks[0] === 2 &&
    ranks[1] === 3 &&
    ranks[2] === 4 &&
    ranks[3] === 5 &&
    ranks[4] === 14;

  const isStraight = isNormalStraight || isAceLowStraight;

  // Royal Flush: A-K-Q-J-10, all same suit
  const isRoyal =
    isFlush &&
    ranks[0] === 10 &&
    ranks[1] === 11 &&
    ranks[2] === 12 &&
    ranks[3] === 13 &&
    ranks[4] === 14;

  if (isRoyal) {
    return { name: "Royal Flush", multiplier: 250 };
  }

  // Straight Flush
  if (isFlush && isStraight) {
    return { name: "Straight Flush", multiplier: 50 };
  }

  // Four of a Kind
  if (counts[0] === 4) {
    return { name: "Four of a Kind", multiplier: 25 };
  }

  // Full House (three of a kind + pair)
  if (counts[0] === 3 && counts[1] === 2) {
    return { name: "Full House", multiplier: 8 };
  }

  // Flush
  if (isFlush) {
    return { name: "Flush", multiplier: 5 };
  }

  // Straight
  if (isStraight) {
    return { name: "Straight", multiplier: 4 };
  }

  // Three of a Kind
  if (counts[0] === 3) {
    return { name: "Three of a Kind", multiplier: 3 };
  }

  // Two Pair
  if (counts[0] === 2 && counts[1] === 2) {
    return { name: "Two Pair", multiplier: 2 };
  }

  // Jacks or Better (pair of J, Q, K, or A)
  if (counts[0] === 2) {
    // Find which rank is the pair
    for (const [rank, count] of rankCounts.entries()) {
      if (count === 2 && rank >= 11) {
        return { name: "Jacks or Better", multiplier: 1 };
      }
    }
  }

  // No qualifying hand
  return { name: "No Win", multiplier: 0 };
}

/**
 * Deal a new video poker game: 5 cards, status = "holding".
 */
export function dealPoker(userId: number, bet: number): PublicVideoPokerGame {
  activeGames.delete(userId);

  const deck = createDeck();
  const hand: Card[] = [];
  for (let i = 0; i < 5; i++) {
    hand.push(deck.pop()!);
  }

  const game: VideoPokerGame = {
    id: `vp_${Date.now()}_${userId}`,
    userId,
    bet,
    deck,
    hand,
    held: [false, false, false, false, false],
    status: "holding",
    result: null,
    multiplier: 0,
    payout: 0,
    createdAt: Date.now(),
  };

  activeGames.set(userId, game);
  return gameToPublic(game);
}

/**
 * Draw phase: replace un-held cards, evaluate final hand.
 */
export function drawPoker(
  userId: number,
  held: boolean[]
): PublicVideoPokerGame {
  const game = activeGames.get(userId);
  if (!game || game.status !== "holding") throw new Error("No active game in holding phase");
  if (!Array.isArray(held) || held.length !== 5) throw new Error("held must be a boolean array of length 5");

  game.held = held;

  // Replace un-held cards with new cards from the deck
  for (let i = 0; i < 5; i++) {
    if (!held[i]) {
      game.hand[i] = game.deck.pop()!;
    }
  }

  // Evaluate the final hand
  const result = evaluateHand(game.hand);
  game.status = "complete";
  game.result = result.name;
  game.multiplier = result.multiplier;
  game.payout = Math.round(game.bet * result.multiplier * 100) / 100;

  return gameToPublic(game);
}

/**
 * Get the active poker game for a user (hides deck).
 */
export function getActivePokerGame(userId: number): PublicVideoPokerGame | null {
  const game = activeGames.get(userId);
  return game ? gameToPublic(game) : null;
}

// Clean up stale games older than 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [userId, game] of Array.from(activeGames.entries())) {
    if (game.createdAt < cutoff) activeGames.delete(userId);
  }
}, 5 * 60 * 1000);
