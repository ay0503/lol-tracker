/**
 * Discord bot intent parser — converts natural language to structured actions via LLM.
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
  | { type: "short"; ticker: string; amount: number; unit: "dollars" | "shares" }
  | { type: "cover"; ticker: string; amount: number; unit: "dollars" | "shares" }
  | { type: "cover_all"; ticker: string }
  | { type: "bet"; prediction: "win" | "loss"; amount: number }
  | { type: "help" }
  | { type: "unknown"; message: string };

const VALID_TICKERS = new Set(["DORI", "DDRI", "TDRI", "SDRI", "XDRI"]);

const SYSTEM_PROMPT = `You are a trading assistant bot for the $DORI LP Tracker platform. Parse the user's message and return a JSON object representing their intent.

Available tickers: DORI (1x), DDRI (2x bull), TDRI (3x bull), SDRI (-2x bear), XDRI (-3x bear).

Return exactly ONE JSON object with a "type" field. Valid types and their fields:

READ queries (no confirmation needed):
- {"type":"portfolio"} — show user's portfolio (cash, holdings, P&L)
- {"type":"prices"} — show all ETF prices
- {"type":"price","ticker":"DORI"} — show price of one ticker
- {"type":"leaderboard"} — show top traders
- {"type":"live_game"} — check if the player is in a game
- {"type":"casino_balance"} — show casino cash
- {"type":"match_history","count":5} — show recent matches (default 5)
- {"type":"holdings"} — show detailed holdings
- {"type":"help"} — show available commands

TRADE actions (will require confirmation):
- {"type":"buy","ticker":"DORI","amount":20,"unit":"dollars"} — buy $20 of DORI
- {"type":"buy","ticker":"DORI","amount":5,"unit":"shares"} — buy 5 shares of DORI
- {"type":"sell","ticker":"DORI","amount":10,"unit":"dollars"} — sell $10 of DORI
- {"type":"sell","ticker":"DORI","amount":3,"unit":"shares"} — sell 3 shares of DORI
- {"type":"sell_all","ticker":"DORI"} — sell all shares of a ticker
- {"type":"short","ticker":"DORI","amount":10,"unit":"dollars"} — short $10 of DORI
- {"type":"cover","ticker":"DORI","amount":5,"unit":"shares"} — cover 5 short shares
- {"type":"cover_all","ticker":"DORI"} — cover all short shares
- {"type":"bet","prediction":"win","amount":10} — bet $10 on next game win
- {"type":"bet","prediction":"loss","amount":5} — bet $5 on next game loss

If the ticker is ambiguous or not specified for a trade, default to DORI.
If the amount is not clear, return {"type":"unknown","message":"reason"}.
If the message doesn't match any action, return {"type":"unknown","message":"brief explanation"}.

Respond with ONLY the JSON object, no markdown, no explanation.`;

/**
 * Parse a user message into a structured intent using the LLM.
 * Falls back to { type: "unknown" } on any error.
 */
export async function parseIntent(message: string): Promise<BotIntent> {
  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
      max_tokens: 256,
    });

    const raw = result.choices[0]?.message?.content;
    if (!raw) return { type: "unknown", message: "No LLM response" };

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.type !== "string") {
      return { type: "unknown", message: "Invalid response format" };
    }

    // Validate and normalize
    return validateIntent(parsed);
  } catch (err: any) {
    console.error("[discordIntent] parseIntent error:", err.message);
    return { type: "unknown", message: "Failed to understand your message" };
  }
}

function validateIntent(raw: any): BotIntent {
  const type = raw.type;

  // Read queries — no validation needed
  if (["portfolio", "prices", "leaderboard", "live_game", "casino_balance", "holdings", "help"].includes(type)) {
    return { type } as BotIntent;
  }

  if (type === "match_history") {
    return { type: "match_history", count: Math.min(Math.max(1, Number(raw.count) || 5), 20) };
  }

  if (type === "price") {
    const ticker = normalizeTicker(raw.ticker);
    if (!ticker) return { type: "unknown", message: `Invalid ticker: ${raw.ticker}` };
    return { type: "price", ticker };
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
  // Common aliases
  if (upper === "DORI" || upper === "D") return "DORI";
  return null;
}
