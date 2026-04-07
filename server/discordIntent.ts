/**
 * Discord bot intent parser — converts natural language to structured actions via LLM.
 * Supports compound instructions and covers all site functionality.
 */
import { invokeLLM } from "./_core/llm";

// ─── Intent Types ───

export type BotIntent =
  // Reads
  | { type: "portfolio" }
  | { type: "prices" }
  | { type: "price"; ticker: string }
  | { type: "leaderboard" }
  | { type: "live_game" }
  | { type: "casino_balance" }
  | { type: "match_history"; count: number }
  | { type: "holdings" }
  | { type: "compare"; targetName: string }
  | { type: "audit"; targetName: string }
  | { type: "recent_trades"; count: number }
  | { type: "casino_leaderboard" }
  | { type: "my_trades"; count: number }
  | { type: "news"; count: number }
  | { type: "notifications" }
  | { type: "betting_status" }
  | { type: "champion_pool" }
  | { type: "streaks" }
  | { type: "my_bets" }
  | { type: "my_orders" }
  | { type: "my_dividends"; count: number }
  | { type: "shop_catalog" }
  | { type: "my_cosmetics" }
  | { type: "player_stats" }
  // Actions
  | { type: "buy"; ticker: string; amount: number; unit: "dollars" | "shares" }
  | { type: "sell"; ticker: string; amount: number; unit: "dollars" | "shares" }
  | { type: "sell_all"; ticker: string }
  | { type: "sell_all_holdings" }
  | { type: "buy_max"; ticker: string }
  | { type: "short"; ticker: string; amount: number; unit: "dollars" | "shares" }
  | { type: "cover"; ticker: string; amount: number; unit: "dollars" | "shares" }
  | { type: "cover_all"; ticker: string }
  | { type: "bet"; prediction: "win" | "loss"; amount: number }
  | { type: "casino_deposit"; amount: number }
  | { type: "roulette"; color: "red" | "black" | "green"; amount: number }
  | { type: "dice"; amount: number; target: number; direction: "over" | "under" }
  | { type: "crash"; amount: number; autoCashout?: number }
  | { type: "plinko"; amount: number; risk: "low" | "medium" | "high" }
  | { type: "daily_bonus" }
  | { type: "create_order"; ticker: string; orderType: "limit_buy" | "limit_sell" | "stop_loss"; shares: number; targetPrice: number }
  | { type: "cancel_order"; orderId: number }
  | { type: "buy_cosmetic"; itemName: string }
  | { type: "equip_cosmetic"; itemName: string; cosmeticType: "title" | "name_effect" }
  | { type: "help" }
  | { type: "unknown"; message: string };

const VALID_TICKERS = new Set(["DORI", "DDRI", "TDRI", "SDRI", "XDRI"]);

const SYSTEM_PROMPT = `You are a trading assistant bot for the $DORI LP Tracker platform. Parse the user's message into one or more actions.

Available tickers: DORI (1x), DDRI (2x bull), TDRI (3x bull), SDRI (-2x bear), XDRI (-3x bear).

Return a JSON object with an "actions" array. Each action has a "type" field.

READ queries:
- {"type":"portfolio"} — show portfolio (cash, holdings, P&L)
- {"type":"prices"} — show all 5 ETF prices
- {"type":"price","ticker":"DORI"} — price of one ticker
- {"type":"leaderboard"} — top traders by portfolio value
- {"type":"live_game"} — is the tracked player in a game?
- {"type":"casino_balance"} — user's casino cash
- {"type":"match_history","count":5} — recent LoL matches (default 5)
- {"type":"holdings"} — detailed per-ticker holdings with P&L
- {"type":"compare","targetName":"Kyle"} — compare portfolios with another user
- {"type":"audit","targetName":"Kyle"} — full audit of any user's trades/bets/dividends
- {"type":"recent_trades","count":10} — recent trades across ALL users
- {"type":"casino_leaderboard"} — casino leaderboard
- {"type":"my_trades","count":10} — user's own trade history
- {"type":"news","count":5} — latest AI-generated match news/headlines
- {"type":"notifications"} — user's unread notifications
- {"type":"betting_status"} — is betting open? time remaining? pool stats
- {"type":"champion_pool"} — champion stats (games, win rate, KDA)
- {"type":"streaks"} — current win/loss streak
- {"type":"my_bets"} — user's bet history
- {"type":"my_orders"} — user's pending limit orders
- {"type":"my_dividends","count":10} — user's dividend history
- {"type":"shop_catalog"} — browse cosmetics shop
- {"type":"my_cosmetics"} — user's owned cosmetics
- {"type":"player_stats"} — tracked player's rank, LP, avg KDA
- {"type":"help"} — show all available commands

TRADE actions:
- {"type":"buy","ticker":"DORI","amount":20,"unit":"dollars"} — buy $20 of DORI
- {"type":"buy","ticker":"DORI","amount":5,"unit":"shares"} — buy 5 shares
- {"type":"sell","ticker":"DORI","amount":10,"unit":"dollars"} — sell $10
- {"type":"sell","ticker":"DORI","amount":3,"unit":"shares"} — sell 3 shares
- {"type":"sell_all","ticker":"DORI"} — sell all shares of one ticker
- {"type":"sell_all_holdings"} — sell ALL shares across ALL tickers
- {"type":"buy_max","ticker":"DORI"} — spend all cash on one ticker (all in / yolo)
- {"type":"short","ticker":"DORI","amount":10,"unit":"dollars"} — short $10
- {"type":"cover","ticker":"DORI","amount":5,"unit":"shares"} — cover 5 short shares
- {"type":"cover_all","ticker":"DORI"} — cover all short shares

BETTING & CASINO:
- {"type":"bet","prediction":"win","amount":10} — bet on next game outcome
- {"type":"casino_deposit","amount":5} — deposit trading cash to casino (10x multiplier)
- {"type":"roulette","color":"red","amount":5} — roulette (red/black/green)
- {"type":"dice","amount":5,"target":50,"direction":"over"} — dice roll over/under a target (1-99)
- {"type":"crash","amount":5,"autoCashout":2.5} — crash game with optional auto-cashout multiplier
- {"type":"plinko","amount":5,"risk":"medium"} — plinko drop (risk: low/medium/high)
- {"type":"daily_bonus"} — claim daily $1 casino bonus

ORDERS:
- {"type":"create_order","ticker":"DORI","orderType":"limit_buy","shares":5,"targetPrice":10.50} — limit buy order
- {"type":"create_order","ticker":"DORI","orderType":"limit_sell","shares":5,"targetPrice":15.00} — limit sell order
- {"type":"create_order","ticker":"DORI","orderType":"stop_loss","shares":5,"targetPrice":8.00} — stop loss order
- {"type":"cancel_order","orderId":42} — cancel a pending order

COSMETICS:
- {"type":"buy_cosmetic","itemName":"Rainbow"} — buy a cosmetic from the shop
- {"type":"equip_cosmetic","itemName":"Rainbow","cosmeticType":"name_effect"} — equip a cosmetic
- {"type":"equip_cosmetic","itemName":"High Roller","cosmeticType":"title"} — equip a title

COMPOUND EXAMPLES:
- "sell everything and all in on DORI" → {"actions":[{"type":"sell_all_holdings"},{"type":"buy_max","ticker":"DORI"}]}
- "what's my portfolio and show leaderboard" → {"actions":[{"type":"portfolio"},{"type":"leaderboard"}]}
- "yolo everything on XDRI" → {"actions":[{"type":"sell_all_holdings"},{"type":"buy_max","ticker":"XDRI"}]}
- "put $50 on red and $10 on green" → {"actions":[{"type":"roulette","color":"red","amount":50},{"type":"roulette","color":"green","amount":10}]}
- "deposit $5 to casino and put it all on black" → {"actions":[{"type":"casino_deposit","amount":5},{"type":"roulette","color":"black","amount":50}]}

For a single action, still wrap it: {"actions":[{"type":"portfolio"}]}
If the ticker is ambiguous or not specified for a trade, default to DORI.
If unclear, return {"actions":[{"type":"unknown","message":"brief reason"}]}.
Order actions logically — sells before buys, deposits before casino games.

Respond with ONLY the JSON object.`;

/**
 * Parse a user message into one or more structured intents.
 */
export async function parseIntent(message: string): Promise<BotIntent[]> {
  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
      max_tokens: 512,
    });

    const raw = result.choices[0]?.message?.content;
    if (!raw) return [{ type: "unknown", message: "No LLM response" }];

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed.actions)) {
      const validated = parsed.actions.map(validateIntent).filter(Boolean) as BotIntent[];
      return validated.length > 0 ? validated : [{ type: "unknown", message: "No valid actions found" }];
    }

    if (parsed.type) {
      return [validateIntent(parsed)];
    }

    return [{ type: "unknown", message: "Invalid response format" }];
  } catch (err: any) {
    console.error("[discordIntent] parseIntent error:", err.message);
    return [{ type: "unknown", message: "Failed to understand your message" }];
  }
}

function validateIntent(raw: any): BotIntent {
  const type = raw.type;

  // Simple read queries (no params)
  const simpleReads = [
    "portfolio", "prices", "leaderboard", "live_game", "casino_balance",
    "holdings", "help", "casino_leaderboard", "sell_all_holdings",
    "notifications", "betting_status", "champion_pool", "streaks",
    "my_bets", "my_orders", "shop_catalog", "my_cosmetics",
    "player_stats", "daily_bonus",
  ];
  if (simpleReads.includes(type)) return { type } as BotIntent;

  // Count-based reads
  if (type === "match_history") return { type, count: clampCount(raw.count, 5) };
  if (type === "recent_trades") return { type, count: clampCount(raw.count, 10) };
  if (type === "my_trades") return { type, count: clampCount(raw.count, 10) };
  if (type === "news") return { type, count: clampCount(raw.count, 5) };
  if (type === "my_dividends") return { type, count: clampCount(raw.count, 10) };

  // Name-based reads
  if (type === "compare" || type === "audit") {
    const targetName = raw.targetName;
    if (!targetName || typeof targetName !== "string") return { type: "unknown", message: `Who do you want to ${type}?` };
    return { type, targetName } as BotIntent;
  }

  // Price for single ticker
  if (type === "price" || type === "buy_max") {
    const ticker = normalizeTicker(raw.ticker);
    if (!ticker) return { type: "unknown", message: `Invalid ticker: ${raw.ticker}` };
    return { type, ticker } as BotIntent;
  }

  // Trade actions with ticker + amount
  if (["buy", "sell", "short", "cover"].includes(type)) {
    const ticker = normalizeTicker(raw.ticker);
    if (!ticker) return { type: "unknown", message: `Invalid ticker: ${raw.ticker}` };
    const amount = Number(raw.amount);
    if (!amount || amount <= 0) return { type: "unknown", message: "Invalid amount" };
    const unit = raw.unit === "shares" ? "shares" : "dollars";
    return { type, ticker, amount, unit } as BotIntent;
  }

  if (type === "sell_all" || type === "cover_all") {
    const ticker = normalizeTicker(raw.ticker);
    if (!ticker) return { type: "unknown", message: `Invalid ticker: ${raw.ticker}` };
    return { type, ticker } as BotIntent;
  }

  // Bet
  if (type === "bet") {
    const prediction = raw.prediction === "loss" ? "loss" : "win";
    const amount = Number(raw.amount);
    if (!amount || amount < 1 || amount > 50) return { type: "unknown", message: "Bet must be $1-$50" };
    return { type: "bet", prediction, amount };
  }

  // Casino deposit
  if (type === "casino_deposit") {
    const amount = Number(raw.amount);
    if (!amount || amount < 0.5 || amount > 200) return { type: "unknown", message: "Deposit must be $0.50-$200" };
    return { type: "casino_deposit", amount };
  }

  // Roulette
  if (type === "roulette") {
    const color = (["red", "black", "green"].includes(raw.color) ? raw.color : "red") as "red" | "black" | "green";
    const amount = Number(raw.amount);
    if (!amount || amount < 0.10 || amount > 50) return { type: "unknown", message: "Roulette bet: $0.10-$50" };
    return { type: "roulette", color, amount };
  }

  // Dice
  if (type === "dice") {
    const amount = Number(raw.amount);
    if (!amount || amount < 0.10 || amount > 50) return { type: "unknown", message: "Dice bet: $0.10-$50" };
    const target = Math.min(99, Math.max(1, Number(raw.target) || 50));
    const direction = raw.direction === "under" ? "under" : "over";
    return { type: "dice", amount, target, direction };
  }

  // Crash
  if (type === "crash") {
    const amount = Number(raw.amount);
    if (!amount || amount < 0.10 || amount > 50) return { type: "unknown", message: "Crash bet: $0.10-$50" };
    const autoCashout = raw.autoCashout ? Math.max(1.01, Number(raw.autoCashout)) : undefined;
    return { type: "crash", amount, autoCashout };
  }

  // Plinko
  if (type === "plinko") {
    const amount = Number(raw.amount);
    if (!amount || amount < 0.10 || amount > 50) return { type: "unknown", message: "Plinko bet: $0.10-$50" };
    const risk = (["low", "medium", "high"].includes(raw.risk) ? raw.risk : "medium") as "low" | "medium" | "high";
    return { type: "plinko", amount, risk };
  }

  // Orders
  if (type === "create_order") {
    const ticker = normalizeTicker(raw.ticker);
    if (!ticker) return { type: "unknown", message: `Invalid ticker: ${raw.ticker}` };
    const orderType = ["limit_buy", "limit_sell", "stop_loss"].includes(raw.orderType) ? raw.orderType : null;
    if (!orderType) return { type: "unknown", message: "Order type must be limit_buy, limit_sell, or stop_loss" };
    const shares = Number(raw.shares);
    const targetPrice = Number(raw.targetPrice);
    if (!shares || shares <= 0 || !targetPrice || targetPrice <= 0) return { type: "unknown", message: "Invalid shares or target price" };
    return { type: "create_order", ticker, orderType, shares, targetPrice };
  }

  if (type === "cancel_order") {
    const orderId = Number(raw.orderId);
    if (!orderId) return { type: "unknown", message: "Which order ID?" };
    return { type: "cancel_order", orderId };
  }

  // Cosmetics
  if (type === "buy_cosmetic") {
    if (!raw.itemName) return { type: "unknown", message: "Which cosmetic?" };
    return { type: "buy_cosmetic", itemName: String(raw.itemName) };
  }

  if (type === "equip_cosmetic") {
    if (!raw.itemName) return { type: "unknown", message: "Which cosmetic?" };
    const cosmeticType = raw.cosmeticType === "title" ? "title" : "name_effect";
    return { type: "equip_cosmetic", itemName: String(raw.itemName), cosmeticType };
  }

  return { type: "unknown", message: raw.message || "I didn't understand that" };
}

function clampCount(val: any, defaultVal: number): number {
  return Math.min(Math.max(1, Number(val) || defaultVal), 20);
}

function normalizeTicker(ticker: any): string | null {
  if (!ticker || typeof ticker !== "string") return null;
  const upper = ticker.toUpperCase().replace("$", "");
  if (VALID_TICKERS.has(upper)) return upper;
  if (upper === "D") return "DORI";
  return null;
}
