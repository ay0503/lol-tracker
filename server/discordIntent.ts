/**
 * Discord bot intent parser — converts natural language to structured actions via LLM.
 * Supports compound instructions like "sell everything and all in on DORI".
 */
import { invokeLLM } from "./_core/llm";

// ─── Intent Types ───

export type BotIntent =
  | { type: "portfolio" }
  | { type: "prices" }
  | { type: "price"; ticker: string }
  | { type: "leaderboard" }
  | { type: "live_game" }
  | { type: "casino_balance" }
  | { type: "match_history"; count: number }
  | { type: "holdings" }
  | { type: "buy"; ticker: string; amount: number; unit: "dollars" | "shares" }
  | { type: "sell"; ticker: string; amount: number; unit: "dollars" | "shares" }
  | { type: "sell_all"; ticker: string }
  | { type: "sell_all_holdings" }
  | { type: "buy_max"; ticker: string }
  | { type: "short"; ticker: string; amount: number; unit: "dollars" | "shares" }
  | { type: "cover"; ticker: string; amount: number; unit: "dollars" | "shares" }
  | { type: "cover_all"; ticker: string }
  | { type: "bet"; prediction: "win" | "loss"; amount: number }
  | { type: "compare"; targetName: string }
  | { type: "audit"; targetName: string }
  | { type: "recent_trades"; count: number }
  | { type: "casino_leaderboard" }
  | { type: "my_trades"; count: number }
  | { type: "casino_deposit"; amount: number }
  | { type: "roulette"; color: "red" | "black" | "green"; amount: number }
  | { type: "help" }
  | { type: "unknown"; message: string };

const VALID_TICKERS = new Set(["DORI", "DDRI", "TDRI", "SDRI", "XDRI"]);

const SYSTEM_PROMPT = `You are a trading assistant bot for the $DORI LP Tracker platform. Parse the user's message into one or more actions.

Available tickers: DORI (1x), DDRI (2x bull), TDRI (3x bull), SDRI (-2x bear), XDRI (-3x bear).

Return a JSON object with an "actions" array. Each action has a "type" field.

READ queries:
- {"type":"portfolio"} — show portfolio
- {"type":"prices"} — show all ETF prices
- {"type":"price","ticker":"DORI"} — price of one ticker
- {"type":"leaderboard"} — top traders
- {"type":"live_game"} — is the player in a game?
- {"type":"casino_balance"} — casino cash
- {"type":"match_history","count":5} — recent matches
- {"type":"holdings"} — detailed holdings
- {"type":"compare","targetName":"Kyle"} — compare with another user
- {"type":"audit","targetName":"Kyle"} — full audit of a user's trades, bets, dividends, P&L (anyone can audit anyone)
- {"type":"recent_trades","count":10} — recent trades across ALL users (feed)
- {"type":"casino_leaderboard"} — top casino balances
- {"type":"my_trades","count":10} — user's own trade history
- {"type":"help"} — show commands

TRADE actions:
- {"type":"buy","ticker":"DORI","amount":20,"unit":"dollars"} — buy $20 of DORI
- {"type":"buy","ticker":"DORI","amount":5,"unit":"shares"} — buy 5 shares
- {"type":"sell","ticker":"DORI","amount":10,"unit":"dollars"} — sell $10
- {"type":"sell","ticker":"DORI","amount":3,"unit":"shares"} — sell 3 shares
- {"type":"sell_all","ticker":"DORI"} — sell all shares of one ticker
- {"type":"sell_all_holdings"} — sell ALL shares across ALL tickers (dump everything)
- {"type":"buy_max","ticker":"DORI"} — spend all available cash on one ticker (all in / yolo)
- {"type":"short","ticker":"DORI","amount":10,"unit":"dollars"} — short $10
- {"type":"cover","ticker":"DORI","amount":5,"unit":"shares"} — cover 5 short shares
- {"type":"cover_all","ticker":"DORI"} — cover all short shares
- {"type":"bet","prediction":"win","amount":10} — bet on next game
- {"type":"casino_deposit","amount":5} — deposit trading cash to casino (multiplied by 10x)
- {"type":"roulette","color":"red","amount":5} — play roulette (red/black/green)

COMPOUND EXAMPLES:
- "sell everything and all in on DORI" → {"actions":[{"type":"sell_all_holdings"},{"type":"buy_max","ticker":"DORI"}]}
- "sell all TDRI and buy SDRI with the money" → {"actions":[{"type":"sell_all","ticker":"TDRI"},{"type":"buy_max","ticker":"SDRI"}]}
- "what's my portfolio and show leaderboard" → {"actions":[{"type":"portfolio"},{"type":"leaderboard"}]}
- "yolo everything on XDRI" → {"actions":[{"type":"sell_all_holdings"},{"type":"buy_max","ticker":"XDRI"}]}
- "dump my DORI and short it" → {"actions":[{"type":"sell_all","ticker":"DORI"},{"type":"short","ticker":"DORI","amount":50,"unit":"dollars"}]}

For a single action, still wrap it: {"actions":[{"type":"portfolio"}]}
If the ticker is ambiguous or not specified, default to DORI.
If unclear, return {"actions":[{"type":"unknown","message":"brief reason"}]}.
Order actions logically — sells before buys when the user wants to use proceeds.

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

    // Support both { actions: [...] } and legacy single { type: "..." }
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

  // Read queries
  if (["portfolio", "prices", "leaderboard", "live_game", "casino_balance", "holdings", "help"].includes(type)) {
    return { type } as BotIntent;
  }

  if (type === "match_history") {
    return { type: "match_history", count: Math.min(Math.max(1, Number(raw.count) || 5), 20) };
  }

  if (type === "recent_trades") {
    return { type: "recent_trades", count: Math.min(Math.max(1, Number(raw.count) || 10), 20) };
  }

  if (type === "casino_leaderboard" || type === "sell_all_holdings") {
    return { type } as BotIntent;
  }

  if (type === "my_trades") {
    return { type: "my_trades", count: Math.min(Math.max(1, Number(raw.count) || 10), 20) };
  }

  if (type === "casino_deposit") {
    const amount = Number(raw.amount);
    if (!amount || amount < 0.5 || amount > 200) return { type: "unknown", message: "Casino deposit must be $0.50-$200" };
    return { type: "casino_deposit", amount };
  }

  if (type === "roulette") {
    const color = ["red", "black", "green"].includes(raw.color) ? raw.color : "red";
    const amount = Number(raw.amount);
    if (!amount || amount < 0.10 || amount > 50) return { type: "unknown", message: "Roulette bet must be $0.10-$50" };
    return { type: "roulette", color, amount } as BotIntent;
  }

  if (type === "compare") {
    const targetName = raw.targetName;
    if (!targetName || typeof targetName !== "string") return { type: "unknown", message: "Who do you want to compare with?" };
    return { type: "compare", targetName };
  }

  if (type === "audit") {
    const targetName = raw.targetName;
    if (!targetName || typeof targetName !== "string") return { type: "unknown", message: "Who do you want to audit?" };
    return { type: "audit", targetName };
  }

  if (type === "price") {
    const ticker = normalizeTicker(raw.ticker);
    if (!ticker) return { type: "unknown", message: `Invalid ticker: ${raw.ticker}` };
    return { type: "price", ticker };
  }

  if (type === "buy_max") {
    const ticker = normalizeTicker(raw.ticker);
    if (!ticker) return { type: "unknown", message: `Invalid ticker: ${raw.ticker}` };
    return { type: "buy_max", ticker };
  }

  // Trade actions — validate ticker + amount
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

  if (type === "bet") {
    const prediction = raw.prediction === "loss" ? "loss" : "win";
    const amount = Number(raw.amount);
    if (!amount || amount < 1 || amount > 50) return { type: "unknown", message: "Bet amount must be $1-$50" };
    return { type: "bet", prediction, amount };
  }

  return { type: "unknown", message: raw.message || "I didn't understand that" };
}

function normalizeTicker(ticker: any): string | null {
  if (!ticker || typeof ticker !== "string") return null;
  const upper = ticker.toUpperCase().replace("$", "");
  if (VALID_TICKERS.has(upper)) return upper;
  if (upper === "D") return "DORI";
  return null;
}
