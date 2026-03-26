/**
 * Blackjack game engine — server-side logic.
 * Games stored in memory (short-lived, no DB needed).
 */

const SUITS = ["♠", "♥", "♦", "♣"] as const;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

export interface Card {
  suit: typeof SUITS[number];
  rank: typeof RANKS[number];
  hidden?: boolean;
}

export interface BlackjackGame {
  id: string;
  userId: number;
  bet: number;
  deck: Card[];
  playerHand: Card[];
  dealerHand: Card[];
  status: "playing" | "player_bust" | "dealer_bust" | "player_win" | "dealer_win" | "push" | "blackjack";
  payout: number;
  createdAt: number;
}

// Active games per user (one at a time)
const activeGames = new Map<number, BlackjackGame>();

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardValue(card: Card): number {
  if (card.rank === "A") return 11;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  return parseInt(card.rank);
}

export function handValue(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.hidden) continue;
    total += cardValue(card);
    if (card.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function gameToPublic(game: BlackjackGame): Omit<BlackjackGame, "deck"> {
  const { deck, ...rest } = game;
  return {
    ...rest,
    // Hide dealer's second card if still playing
    dealerHand: rest.status === "playing"
      ? rest.dealerHand.map((c, i) => i === 1 ? { ...c, hidden: true } : c)
      : rest.dealerHand,
  };
}

export function dealGame(userId: number, bet: number): Omit<BlackjackGame, "deck"> {
  // Clear any existing game
  activeGames.delete(userId);

  const deck = createDeck();
  const playerHand = [deck.pop()!, deck.pop()!];
  const dealerHand = [deck.pop()!, deck.pop()!];

  const game: BlackjackGame = {
    id: `bj_${Date.now()}_${userId}`,
    userId, bet, deck, playerHand, dealerHand,
    status: "playing", payout: 0,
    createdAt: Date.now(),
  };

  // Check for natural blackjack
  const playerBJ = handValue(playerHand) === 21;
  const dealerBJ = handValue(dealerHand) === 21;

  if (playerBJ && dealerBJ) {
    game.status = "push";
    game.payout = bet; // Return bet
  } else if (playerBJ) {
    game.status = "blackjack";
    game.payout = bet + bet * 1.5; // 3:2 payout
  } else if (dealerBJ) {
    game.status = "dealer_win";
    game.payout = 0;
  }

  activeGames.set(userId, game);
  return gameToPublic(game);
}

export function hitGame(userId: number): Omit<BlackjackGame, "deck"> {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");

  game.playerHand.push(game.deck.pop()!);

  if (handValue(game.playerHand) > 21) {
    game.status = "player_bust";
    game.payout = 0;
  }

  return gameToPublic(game);
}

export function standGame(userId: number): Omit<BlackjackGame, "deck"> {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");

  // Dealer draws until 17+
  while (handValue(game.dealerHand) < 17) {
    game.dealerHand.push(game.deck.pop()!);
  }

  const playerVal = handValue(game.playerHand);
  const dealerVal = handValue(game.dealerHand);

  if (dealerVal > 21) {
    game.status = "dealer_bust";
    game.payout = game.bet * 2;
  } else if (playerVal > dealerVal) {
    game.status = "player_win";
    game.payout = game.bet * 2;
  } else if (dealerVal > playerVal) {
    game.status = "dealer_win";
    game.payout = 0;
  } else {
    game.status = "push";
    game.payout = game.bet;
  }

  return gameToPublic(game);
}

export function doubleDown(userId: number): Omit<BlackjackGame, "deck"> {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");
  if (game.playerHand.length !== 2) throw new Error("Can only double down on initial hand");

  game.bet *= 2;
  game.playerHand.push(game.deck.pop()!);

  if (handValue(game.playerHand) > 21) {
    game.status = "player_bust";
    game.payout = 0;
    return gameToPublic(game);
  }

  // Auto-stand after double
  return standGame(userId);
}

export function getActiveGame(userId: number): Omit<BlackjackGame, "deck"> | null {
  const game = activeGames.get(userId);
  if (!game) return null;
  return gameToPublic(game);
}

export function clearGame(userId: number): void {
  activeGames.delete(userId);
}

// Clean up stale games older than 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [userId, game] of Array.from(activeGames.entries())) {
    if (game.createdAt < cutoff) activeGames.delete(userId);
  }
}, 5 * 60 * 1000);
