/**
 * Hilo (High/Low) game engine — stateful, card-based.
 * Guess if next card is higher or lower. Cash out anytime.
 * Games stored in memory with DB persistence for server restarts.
 */
import { saveGameState, clearGameState, loadGameStates } from "./gamePersistence";

const GAME_TYPE = "hilo";
const MAX_PAYOUT = 250;
const PLAYER_EDGE_BOOST = 1.01;

interface Card { rank: number; suit: string; label: string; }

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = [
  { rank: 2, label: "2" }, { rank: 3, label: "3" }, { rank: 4, label: "4" },
  { rank: 5, label: "5" }, { rank: 6, label: "6" }, { rank: 7, label: "7" },
  { rank: 8, label: "8" }, { rank: 9, label: "9" }, { rank: 10, label: "10" },
  { rank: 11, label: "J" }, { rank: 12, label: "Q" }, { rank: 13, label: "K" },
  { rank: 14, label: "A" },
];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rk of RANKS) {
      deck.push({ rank: rk.rank, suit, label: rk.label });
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export interface HiloGame {
  id: string;
  userId: number;
  bet: number;
  deck: Card[];
  currentCard: Card;
  history: Card[];
  multiplier: number;
  status: "playing" | "won" | "lost";
  payout: number;
  createdAt: number;
}

export interface PublicHiloGame {
  id: string;
  currentCard: { rank: number; suit: string; label: string };
  history: { rank: number; suit: string; label: string }[];
  multiplier: number;
  nextHigherMult: number;
  nextLowerMult: number;
  status: "playing" | "won" | "lost";
  bet: number;
  payout: number;
  cardsRemaining: number;
}

const activeGames = new Map<number, HiloGame>();

function countWinningCards(deck: Card[], currentRank: number, direction: "higher" | "lower"): number {
  return deck.filter((card) => (
    direction === "higher" ? card.rank >= currentRank : card.rank <= currentRank
  )).length;
}

function calcMultiplier(currentRank: number, direction: "higher" | "lower", deck: Card[]): number {
  const winningCards = countWinningCards(deck, currentRank, direction);
  if (winningCards <= 0) return 50;
  return Math.round((deck.length / winningCards) * PLAYER_EDGE_BOOST * 100) / 100;
}

function toPublic(game: HiloGame): PublicHiloGame {
  return {
    id: game.id,
    currentCard: game.currentCard,
    history: game.history,
    multiplier: Math.round(game.multiplier * 100) / 100,
    nextHigherMult: calcMultiplier(game.currentCard.rank, "higher", game.deck),
    nextLowerMult: calcMultiplier(game.currentCard.rank, "lower", game.deck),
    status: game.status,
    bet: game.bet,
    payout: Math.round(game.payout * 100) / 100,
    cardsRemaining: game.deck.length,
  };
}

export function startHiloGame(userId: number, bet: number): PublicHiloGame {
  activeGames.delete(userId);
  const deck = createDeck();
  const firstCard = deck.pop()!;
  const game: HiloGame = {
    id: `hilo_${Date.now()}_${userId}`, userId, bet,
    deck, currentCard: firstCard, history: [],
    multiplier: 1, status: "playing", payout: 0,
    createdAt: Date.now(),
  };
  activeGames.set(userId, game);
  saveGameState(userId, GAME_TYPE, game);
  return toPublic(game);
}

export function guessHilo(userId: number, direction: "higher" | "lower"): PublicHiloGame {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");
  if (game.deck.length === 0) throw new Error("No cards left");

  const currentRank = game.currentCard.rank;
  const guessMultiplier = calcMultiplier(currentRank, direction, game.deck);
  const nextCard = game.deck.pop()!;
  const nextRank = nextCard.rank;

  const correct =
    (direction === "higher" && nextRank >= currentRank) ||
    (direction === "lower" && nextRank <= currentRank);

  game.history.push(game.currentCard);
  game.currentCard = nextCard;

  if (correct) {
    game.multiplier *= guessMultiplier;
    if (game.deck.length === 0) {
      game.status = "won";
      game.payout = Math.min(game.bet * game.multiplier, MAX_PAYOUT);
      clearGameState(userId, GAME_TYPE);
    } else {
      saveGameState(userId, GAME_TYPE, game);
    }
  } else {
    game.status = "lost";
    game.multiplier = 0;
    game.payout = 0;
    clearGameState(userId, GAME_TYPE);
  }

  return toPublic(game);
}

export function cashOutHilo(userId: number): PublicHiloGame {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");
  if (game.history.length === 0) throw new Error("Make at least one guess first");
  game.status = "won";
  game.payout = Math.min(game.bet * game.multiplier, MAX_PAYOUT);
  clearGameState(userId, GAME_TYPE);
  return toPublic(game);
}

export function getActiveHiloGame(userId: number): PublicHiloGame | null {
  const game = activeGames.get(userId);
  return game ? toPublic(game) : null;
}

/** Restore persisted games from DB on startup */
export async function restoreHiloGames(): Promise<number> {
  const saved = await loadGameStates<HiloGame>(GAME_TYPE);
  for (const [userId, game] of Array.from(saved.entries())) {
    if (game.status === "playing") {
      activeGames.set(userId, game);
    }
  }
  return saved.size;
}

// Cleanup stale games
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [uid, game] of Array.from(activeGames.entries())) {
    if (game.createdAt < cutoff) activeGames.delete(uid);
  }
}, 5 * 60 * 1000);
