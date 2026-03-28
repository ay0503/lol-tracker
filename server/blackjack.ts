/**
 * Blackjack game engine — server-side logic.
 * Games stored in memory with DB persistence for server restarts.
 * Clean player-favored payout table.
 */
import { saveGameState, clearGameState, loadGameStates } from "./gamePersistence";

const GAME_TYPE = "blackjack";
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
  // Split fields (optional — only present when split)
  splitHand?: Card[];
  splitBet?: number;
  splitStatus?: "playing" | "standing" | "bust" | "win" | "lose" | "push";
  splitPayout?: number;
  activeHand?: "main" | "split"; // which hand is being played
  mainStatus?: "playing" | "standing" | "bust"; // main hand intermediate status during split
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

function cardRankValue(card: Card): number {
  if (["K", "Q", "J", "10"].includes(card.rank)) return 10;
  if (card.rank === "A") return 11;
  return parseInt(card.rank);
}

export function canSplit(game: BlackjackGame): boolean {
  return (
    game.status === "playing" &&
    !game.splitHand && // no re-splitting
    game.playerHand.length === 2 &&
    cardRankValue(game.playerHand[0]) === cardRankValue(game.playerHand[1])
  );
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
    game.payout = bet * 3; // 2:1 payout
  } else if (dealerBJ) {
    game.status = "dealer_win";
    game.payout = 0;
  }

  activeGames.set(userId, game);
  saveGameState(userId, GAME_TYPE, game);
  return gameToPublic(game);
}

export function splitGame(userId: number): Omit<BlackjackGame, "deck"> {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");
  if (!canSplit(game)) throw new Error("Cannot split this hand");

  // Move second card to split hand
  const secondCard = game.playerHand.pop()!;
  game.splitHand = [secondCard];
  game.splitBet = game.bet;
  game.splitStatus = "playing";
  game.splitPayout = 0;
  game.activeHand = "main";
  game.mainStatus = "playing";

  // Deal one card to each hand
  game.playerHand.push(game.deck.pop()!);
  game.splitHand.push(game.deck.pop()!);

  // If split aces, each hand gets one card only — auto-stand both
  if (game.playerHand[0].rank === "A") {
    game.mainStatus = "standing";
    game.activeHand = "split";
    game.splitStatus = "playing";
    // Auto-stand split hand too (split aces rule)
    finishSplitGame(game);
    clearGameState(userId, GAME_TYPE);
  } else {
    saveGameState(userId, GAME_TYPE, game);
  }

  return gameToPublic(game);
}

/** After both split hands are done, run dealer and resolve */
function finishSplitGame(game: BlackjackGame): void {
  // Dealer draws
  while (handValue(game.dealerHand) < 17) {
    game.dealerHand.push(game.deck.pop()!);
  }
  const dealerVal = handValue(game.dealerHand);
  const dealerBust = dealerVal > 21;

  // Resolve main hand
  const mainVal = handValue(game.playerHand);
  const mainBust = game.mainStatus === "bust";
  let mainPayout = 0;
  if (mainBust) {
    // already lost
  } else if (dealerBust || mainVal > dealerVal) {
    mainPayout = game.bet * 2;
  } else if (mainVal === dealerVal) {
    mainPayout = game.bet; // push
  }

  // Resolve split hand
  const splitVal = handValue(game.splitHand!);
  const splitBust = game.splitStatus === "bust";
  let splitPayout = 0;
  if (splitBust) {
    // already lost
  } else if (dealerBust || splitVal > dealerVal) {
    splitPayout = game.splitBet! * 2;
  } else if (splitVal === dealerVal) {
    splitPayout = game.splitBet!; // push
  }

  game.splitPayout = splitPayout;
  game.splitStatus = splitBust ? "bust" : splitPayout > game.splitBet! ? "win" : splitPayout === game.splitBet! ? "push" : "lose";

  // Set overall game status + payout (sum of both hands)
  game.payout = mainPayout + splitPayout;
  const totalBet = game.bet + (game.splitBet ?? 0);
  if (game.payout > totalBet) {
    game.status = dealerBust ? "dealer_bust" : "player_win";
  } else if (game.payout === totalBet) {
    game.status = "push";
  } else if (game.payout > 0) {
    // Partial win (one hand won, one lost) — show as push since net could vary
    game.status = "push";
  } else {
    game.status = "dealer_win";
  }
  game.activeHand = undefined;
}

function getActiveHandCards(game: BlackjackGame): Card[] {
  if (!game.splitHand || game.activeHand === "main") return game.playerHand;
  return game.splitHand;
}

export function hitGame(userId: number): Omit<BlackjackGame, "deck"> {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");

  // Split mode: hit the active hand
  if (game.splitHand && game.activeHand) {
    const hand = getActiveHandCards(game);
    hand.push(game.deck.pop()!);

    if (handValue(hand) > 21) {
      if (game.activeHand === "main") {
        game.mainStatus = "bust";
        // Move to split hand
        game.activeHand = "split";
        if (game.splitStatus !== "playing") {
          // Both hands done
          finishSplitGame(game);
          clearGameState(userId, GAME_TYPE);
        } else {
          saveGameState(userId, GAME_TYPE, game);
        }
      } else {
        game.splitStatus = "bust";
        // Both hands done
        finishSplitGame(game);
        clearGameState(userId, GAME_TYPE);
      }
    } else {
      saveGameState(userId, GAME_TYPE, game);
    }
    return gameToPublic(game);
  }

  // Normal mode
  game.playerHand.push(game.deck.pop()!);

  if (handValue(game.playerHand) > 21) {
    game.status = "player_bust";
    game.payout = 0;
    clearGameState(userId, GAME_TYPE);
  } else {
    saveGameState(userId, GAME_TYPE, game);
  }

  return gameToPublic(game);
}

export function standGame(userId: number): Omit<BlackjackGame, "deck"> {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");

  // Split mode: stand the active hand
  if (game.splitHand && game.activeHand) {
    if (game.activeHand === "main") {
      game.mainStatus = "standing";
      game.activeHand = "split";
      if (game.splitStatus !== "playing") {
        finishSplitGame(game);
        clearGameState(userId, GAME_TYPE);
      } else {
        saveGameState(userId, GAME_TYPE, game);
      }
    } else {
      game.splitStatus = "standing";
      finishSplitGame(game);
      clearGameState(userId, GAME_TYPE);
    }
    return gameToPublic(game);
  }

  // Normal mode — dealer draws until 17+
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

  clearGameState(userId, GAME_TYPE);
  return gameToPublic(game);
}

export function doubleDown(userId: number): Omit<BlackjackGame, "deck"> {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");

  // Split mode: double the active hand
  if (game.splitHand && game.activeHand) {
    const hand = getActiveHandCards(game);
    if (hand.length !== 2) throw new Error("Can only double down on initial hand");

    if (game.activeHand === "main") {
      game.bet *= 2;
    } else {
      game.splitBet = (game.splitBet ?? game.bet) * 2;
    }

    hand.push(game.deck.pop()!);

    if (handValue(hand) > 21) {
      if (game.activeHand === "main") {
        game.mainStatus = "bust";
        game.activeHand = "split";
        if (game.splitStatus !== "playing") {
          finishSplitGame(game);
          clearGameState(userId, GAME_TYPE);
        } else {
          saveGameState(userId, GAME_TYPE, game);
        }
      } else {
        game.splitStatus = "bust";
        finishSplitGame(game);
        clearGameState(userId, GAME_TYPE);
      }
    } else {
      // Auto-stand after double
      return standGame(userId);
    }
    return gameToPublic(game);
  }

  // Normal mode
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
  clearGameState(userId, GAME_TYPE);
}

/** Restore persisted games from DB on startup */
export async function restoreBlackjackGames(): Promise<number> {
  const saved = await loadGameStates<BlackjackGame>(GAME_TYPE);
  for (const [userId, game] of Array.from(saved.entries())) {
    if (game.status === "playing") {
      activeGames.set(userId, game);
    }
  }
  return saved.size;
}

// Clean up stale games older than 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [userId, game] of Array.from(activeGames.entries())) {
    if (game.createdAt < cutoff) activeGames.delete(userId);
  }
}, 5 * 60 * 1000);
