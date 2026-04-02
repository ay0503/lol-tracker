/**
 * AI Quant Bot Trader
 *
 * A serious, data-driven quantitative trading bot that:
 * - Analyzes price history, recent matches, LP trends, and current holdings
 * - Makes trading decisions using LLM with a quant-style system prompt
 * - Executes trades using the same DB helpers as regular users
 * - Posts analytical sentiment comments explaining its reasoning
 * - Runs every poll cycle, but ONLY when a live game is detected
 * - Starts with $200 capital (same as regular users)
 */

import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import {
  getOrCreatePortfolio, getUserHoldings, executeTrade, executeShort,
  executeCover, postComment, getRecentMatchesFromDB, getPriceHistory,
  getLatestPrice, getDb, getRawClient,
} from "./db";
import { computeAllETFPricesSync, TICKERS, type Ticker } from "./etfPricing";
import { cache } from "./cache";
import { users, portfolios } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Bot Configuration ───

const BOT_DISPLAY_NAME = "QuantBot 🤖";
const BOT_OPEN_ID = "bot_quanttrader_001";
const BOT_STARTING_CASH = 200;
const BOT_TRADE_COOLDOWN_MS = 10 * 60 * 1000; // 10 min between trades
let lastBotTradeTime = 0;

/** Reset cooldown — used by tests */
export function resetBotCooldown() { lastBotTradeTime = 0; }

// ─── Decision Logging ───
async function ensureBotLogTable() {
  try {
    const client = getRawClient();
    await client.execute(`CREATE TABLE IF NOT EXISTS bot_decision_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      ticker TEXT NOT NULL,
      amount REAL NOT NULL,
      reasoning TEXT NOT NULL,
      sentiment TEXT,
      confidence INTEGER,
      prompt TEXT,
      source TEXT NOT NULL,
      success INTEGER,
      resultMessage TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )`);
  } catch { /* ignore */ }
}
ensureBotLogTable();

async function logBotDecision(
  decision: TradeDecision,
  source: "llm" | "fallback",
  prompt: string | null,
  success: boolean,
  resultMessage: string,
) {
  try {
    const client = getRawClient();
    await client.execute({
      sql: `INSERT INTO bot_decision_log (action, ticker, amount, reasoning, sentiment, confidence, prompt, source, success, resultMessage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        decision.action, decision.ticker, decision.amount,
        decision.reasoning, decision.sentiment, decision.confidence,
        prompt, source, success ? 1 : 0, resultMessage,
      ],
    });
  } catch { /* table may not exist */ }
}



// ─── Bot User Management ───

/**
 * Ensure the bot user exists in the database. Creates it on first run.
 * Returns the bot's user ID.
 */
export async function ensureBotUser(): Promise<number> {
  const db = await getDb();

  // Check if bot already exists
  const existing = await db.select().from(users).where(eq(users.openId, BOT_OPEN_ID)).limit(1);
  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create bot user
  console.log("[Bot] Creating QuantBot user...");
  await db.insert(users).values({
    openId: BOT_OPEN_ID,
    name: BOT_DISPLAY_NAME,
    displayName: BOT_DISPLAY_NAME,
    email: "quantbot@dori.trading",
    loginMethod: "bot",
    role: "user", // Regular user so it appears on leaderboard
  });

  const created = await db.select().from(users).where(eq(users.openId, BOT_OPEN_ID)).limit(1);
  if (!created.length) throw new Error("[Bot] Failed to create bot user");

  // Create portfolio with starting cash
  await db.insert(portfolios).values({
    userId: created[0].id,
    cashBalance: BOT_STARTING_CASH.toFixed(2),
    totalDividends: "0.00",
  });

  console.log(`[Bot] QuantBot created with ID ${created[0].id}, $${BOT_STARTING_CASH} starting capital`);
  return created[0].id;
}

// ─── Market Data Gathering ───

interface MarketContext {
  currentPrices: Record<Ticker, number>;
  priceHistory: { timestamp: number; price: string }[];
  recentMatches: {
    win: boolean;
    champion: string;
    kills: number;
    deaths: number;
    assists: number;
    gameDuration: number;
    gameCreation: number;
  }[];
  portfolio: {
    cash: number;
    totalDividends: number;
  };
  holdings: {
    ticker: string;
    shares: number;
    avgCostBasis: number;
    shortShares: number;
    shortAvgPrice: number;
  }[];
  latestPrice: {
    tier: string;
    division: string;
    lp: number;
    price: number;
  } | null;
}

async function gatherMarketData(botUserId: number): Promise<MarketContext> {
  // Get price history (last 50 data points for context)
  const fullHistory = await getPriceHistory();
  const recentHistory = fullHistory.slice(-50);

  // Compute current ETF prices
  const currentPrices = fullHistory.length > 0
    ? computeAllETFPricesSync(fullHistory)
    : { DORI: 0, DDRI: 0, TDRI: 0, SDRI: 0, XDRI: 0 } as Record<Ticker, number>;

  // Get recent matches
  const matches = await getRecentMatchesFromDB(10);

  // Get bot's portfolio and holdings
  const portfolio = await getOrCreatePortfolio(botUserId);
  const holdings = await getUserHoldings(botUserId);

  // Get latest price snapshot
  const latest = await getLatestPrice();

  return {
    currentPrices,
    priceHistory: recentHistory,
    recentMatches: matches.map(m => ({
      win: m.win,
      champion: m.champion,
      kills: m.kills,
      deaths: m.deaths,
      assists: m.assists,
      gameDuration: m.gameDuration,
      gameCreation: m.gameCreation,
    })),
    portfolio: {
      cash: parseFloat(portfolio.cashBalance),
      totalDividends: parseFloat(portfolio.totalDividends),
    },
    holdings: holdings.map(h => ({
      ticker: h.ticker,
      shares: parseFloat(h.shares),
      avgCostBasis: parseFloat(h.avgCostBasis),
      shortShares: parseFloat(h.shortShares),
      shortAvgPrice: parseFloat(h.shortAvgPrice),
    })),
    latestPrice: latest ? {
      tier: latest.tier,
      division: latest.division,
      lp: latest.lp,
      price: parseFloat(latest.price),
    } : null,
  };
}

// ─── AI Decision Making ───

interface TradeDecision {
  action: "buy" | "sell" | "short" | "cover" | "hold";
  ticker: string;
  amount: number; // dollar amount to trade
  reasoning: string;
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number; // 0-100
}

function buildAnalysisPrompt(ctx: MarketContext): string {
  // Calculate price trends
  const prices = ctx.priceHistory.map(p => parseFloat(p.price));
  const currentDoriPrice = ctx.currentPrices.DORI;
  const priceChange1h = prices.length >= 30 ? ((currentDoriPrice - prices[prices.length - 30]) / prices[prices.length - 30] * 100) : 0;
  const priceChange24h = prices.length >= 5 ? ((currentDoriPrice - prices[prices.length - 5]) / prices[prices.length - 5] * 100) : 0;

  // Win/loss streak
  const recentResults = ctx.recentMatches.slice(0, 5).map(m => m.win ? "W" : "L");
  const winRate = ctx.recentMatches.length > 0
    ? (ctx.recentMatches.filter(m => m.win).length / ctx.recentMatches.length * 100).toFixed(1)
    : "N/A";

  // Average KDA
  const avgKills = ctx.recentMatches.length > 0
    ? (ctx.recentMatches.reduce((s, m) => s + m.kills, 0) / ctx.recentMatches.length).toFixed(1)
    : "0";
  const avgDeaths = ctx.recentMatches.length > 0
    ? (ctx.recentMatches.reduce((s, m) => s + m.deaths, 0) / ctx.recentMatches.length).toFixed(1)
    : "0";
  const avgAssists = ctx.recentMatches.length > 0
    ? (ctx.recentMatches.reduce((s, m) => s + m.assists, 0) / ctx.recentMatches.length).toFixed(1)
    : "0";

  // Portfolio summary
  const holdingsSummary = ctx.holdings
    .filter(h => h.shares > 0 || h.shortShares > 0)
    .map(h => {
      const parts: string[] = [];
      if (h.shares > 0) {
        const value = h.shares * (ctx.currentPrices[h.ticker as Ticker] || 0);
        const pnl = value - (h.shares * h.avgCostBasis);
        parts.push(`LONG ${h.shares.toFixed(2)} shares @ avg $${h.avgCostBasis.toFixed(2)} (value: $${value.toFixed(2)}, P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)})`);
      }
      if (h.shortShares > 0) {
        const currentPrice = ctx.currentPrices[h.ticker as Ticker] || 0;
        const pnl = h.shortShares * (h.shortAvgPrice - currentPrice);
        parts.push(`SHORT ${h.shortShares.toFixed(2)} shares @ avg $${h.shortAvgPrice.toFixed(2)} (P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)})`);
      }
      return `  ${h.ticker}: ${parts.join(', ')}`;
    }).join('\n') || "  No positions";

  // Total portfolio value
  let totalHoldingsValue = 0;
  let totalShortPnl = 0;
  for (const h of ctx.holdings) {
    const price = ctx.currentPrices[h.ticker as Ticker] || 0;
    totalHoldingsValue += h.shares * price;
    totalShortPnl += h.shortShares * (h.shortAvgPrice - price);
  }
  const totalPortfolioValue = ctx.portfolio.cash + totalHoldingsValue + totalShortPnl;

  return `You are a quantitative trading analyst managing a portfolio that tracks a League of Legends player's performance as a stock.

## MARKET DATA

**Current Prices:**
${TICKERS.map(t => `- $${t}: $${ctx.currentPrices[t].toFixed(2)}`).join('\n')}

**Ticker Descriptions:**
- DORI: 1x base tracker (tracks LP directly)
- DDRI: 2x leveraged bull (amplifies gains/losses 2x)
- TDRI: 3x leveraged bull (amplifies gains/losses 3x)
- SDRI: 2x inverse (profits when LP drops)
- XDRI: 3x inverse (profits more when LP drops)

**Player Status:**
- Rank: ${ctx.latestPrice ? `${ctx.latestPrice.tier} ${ctx.latestPrice.division} ${ctx.latestPrice.lp}LP` : 'Unknown'}
- Recent results (newest first): ${recentResults.join(' → ') || 'No recent games'}
- Win rate (last 10): ${winRate}%
- Avg KDA: ${avgKills}/${avgDeaths}/${avgAssists}

**Price Trends:**
- Short-term change (recent polls): ${priceChange1h >= 0 ? '+' : ''}${priceChange1h.toFixed(2)}%
- Medium-term change (last ~5 polls): ${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%

**Note on dividends:** DORI, DDRI, TDRI pay dividends on player WINS. Inverse tickers (SDRI, XDRI) do NOT pay dividends.

## MY PORTFOLIO

- Cash: $${ctx.portfolio.cash.toFixed(2)}
- Total Value: $${totalPortfolioValue.toFixed(2)}
- Dividends Received: $${ctx.portfolio.totalDividends.toFixed(2)}
- Positions:
${holdingsSummary}

## RULES

1. You can BUY, SELL, SHORT, or COVER any of the 5 tickers.
2. You can only sell shares you own (long positions).
3. You can only cover shares you have shorted.
4. Shorting requires 50% margin collateral.
5. Maximum trade amount should not exceed 40% of your cash for any single trade.
6. You started with $200 — manage risk carefully.
7. Consider the dividend advantage of bull tickers (DORI/DDRI/TDRI) on wins.
8. If the player is on a losing streak, inverse tickers profit from LP drops.
9. If you have no strong signal, it's fine to HOLD.

## TASK

Analyze the market data and decide on ONE trade action. Be analytical and data-driven. Consider:
- Price momentum and trend direction
- Win/loss streaks and their likely continuation
- KDA quality as a leading indicator
- Current portfolio exposure and risk management
- Dividend income potential vs price movement
- Whether leveraged or inverse positions are appropriate

Respond with your decision.`;
}

const TRADE_DECISION_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "trade_decision",
    strict: true,
    schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["buy", "sell", "short", "cover", "hold"],
          description: "The trading action to take",
        },
        ticker: {
          type: "string",
          enum: ["DORI", "DDRI", "TDRI", "SDRI", "XDRI"],
          description: "Which ticker to trade",
        },
        amount: {
          type: "number",
          description: "Dollar amount to trade (0 if holding)",
        },
        reasoning: {
          type: "string",
          description: "2-3 sentence analytical reasoning for the decision",
        },
        sentiment: {
          type: "string",
          enum: ["bullish", "bearish", "neutral"],
          description: "Overall market sentiment",
        },
        confidence: {
          type: "number",
          description: "Confidence level 0-100",
        },
      },
      required: ["action", "ticker", "amount", "reasoning", "sentiment", "confidence"],
      additionalProperties: false,
    },
  },
};

async function getAIDecision(ctx: MarketContext): Promise<TradeDecision> {
  const prompt = buildAnalysisPrompt(ctx);

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are QuantBot, a serious quantitative trading AI. You analyze League of Legends player performance data as if it were a stock market. You are methodical, data-driven, and risk-aware. You never make emotional decisions. You speak in concise, analytical language. Your reasoning references specific data points (win rates, price trends, KDA metrics). You manage a $200 portfolio and aim for steady, calculated returns.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: TRADE_DECISION_SCHEMA,
      max_tokens: 512,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");

    const decision = JSON.parse(content) as TradeDecision;

    // Validate the decision
    if (!["buy", "sell", "short", "cover", "hold"].includes(decision.action)) {
      throw new Error(`Invalid action: ${decision.action}`);
    }
    if (!TICKERS.includes(decision.ticker as Ticker)) {
      throw new Error(`Invalid ticker: ${decision.ticker}`);
    }
    if (typeof decision.amount !== "number" || decision.amount < 0) {
      decision.amount = 0;
    }

    return decision;
  } catch (err: any) {
    // Suppress verbose LLM errors (quota, rate limit, etc.) to single line
    const msg = err?.message || String(err);
    const shortMsg = msg.includes("429") ? "quota exceeded" : msg.includes("404") ? "endpoint not found" : msg.substring(0, 80);
    console.warn(`[Bot] LLM unavailable (${shortMsg}) — using fallback`);
    // Fallback: hold
    return {
      action: "hold",
      ticker: "DORI",
      amount: 0,
      reasoning: "AI analysis unavailable. Holding current positions as a precautionary measure.",
      sentiment: "neutral",
      confidence: 0,
    };
  }
}

// ─── Fallback Decision (No LLM) ───

function getFallbackDecision(ctx: MarketContext): TradeDecision {
  // Simple momentum-based strategy without LLM
  const prices = ctx.priceHistory.map(p => parseFloat(p.price));
  if (prices.length < 3) {
    return { action: "hold", ticker: "DORI", amount: 0, reasoning: "Insufficient price data for analysis. Waiting for more data points.", sentiment: "neutral", confidence: 10 };
  }

  const current = prices[prices.length - 1];
  const prev = prices[prices.length - 3];
  const trend = (current - prev) / prev;

  // Check recent win/loss
  const recentWins = ctx.recentMatches.slice(0, 5).filter(m => m.win).length;
  const winRate = recentWins / Math.max(1, Math.min(5, ctx.recentMatches.length));

  // Determine action based on momentum + win rate
  if (trend > 0.01 && winRate > 0.5 && ctx.portfolio.cash > 20) {
    // Uptrend + winning → buy DORI or DDRI
    const ticker = trend > 0.03 ? "DDRI" : "DORI";
    const amount = Math.min(ctx.portfolio.cash * 0.25, 30);
    return {
      action: "buy", ticker, amount: Math.round(amount * 100) / 100,
      reasoning: `Positive momentum (+${(trend * 100).toFixed(1)}%) with ${(winRate * 100).toFixed(0)}% win rate. Allocating to ${ticker} for upside exposure.`,
      sentiment: "bullish", confidence: 45,
    };
  } else if (trend < -0.01 && winRate < 0.4 && ctx.portfolio.cash > 20) {
    // Downtrend + losing → buy inverse
    const amount = Math.min(ctx.portfolio.cash * 0.2, 25);
    return {
      action: "buy", ticker: "SDRI", amount: Math.round(amount * 100) / 100,
      reasoning: `Negative momentum (${(trend * 100).toFixed(1)}%) with ${(winRate * 100).toFixed(0)}% win rate. Hedging with inverse exposure.`,
      sentiment: "bearish", confidence: 40,
    };
  }

  return {
    action: "hold", ticker: "DORI", amount: 0,
    reasoning: `Mixed signals: trend ${(trend * 100).toFixed(1)}%, win rate ${(winRate * 100).toFixed(0)}%. No clear edge — maintaining current positions.`,
    sentiment: "neutral", confidence: 30,
  };
}

// ─── Trade Execution ───

async function executeDecision(
  botUserId: number,
  decision: TradeDecision,
  currentPrices: Record<Ticker, number>
): Promise<{ success: boolean; message: string }> {
  if (decision.action === "hold" || decision.amount <= 0) {
    return { success: true, message: "Holding — no trade executed" };
  }

  const ticker = decision.ticker as Ticker;
  const price = currentPrices[ticker];
  if (!price || price <= 0) {
    return { success: false, message: `Invalid price for ${ticker}: $${price}` };
  }

  const shares = decision.amount / price;
  if (shares < 0.0001) {
    return { success: false, message: `Trade amount too small: ${shares.toFixed(4)} shares` };
  }

  try {
    switch (decision.action) {
      case "buy": {
        const portfolio = await getOrCreatePortfolio(botUserId);
        const cash = parseFloat(portfolio.cashBalance);
        // Cap at available cash
        const maxAmount = Math.min(decision.amount, cash * 0.40); // Enforce 40% max per trade
        if (maxAmount < 1) return { success: false, message: `Insufficient cash ($${cash.toFixed(2)}) for buy` };
        const buyShares = maxAmount / price;
        await executeTrade(botUserId, ticker, "buy", buyShares, price);
        return { success: true, message: `Bought ${buyShares.toFixed(2)} shares of $${ticker} @ $${price.toFixed(2)} ($${maxAmount.toFixed(2)})` };
      }

      case "sell": {
        const holdings = await getUserHoldings(botUserId);
        const holding = holdings.find(h => h.ticker === ticker);
        const heldShares = holding ? parseFloat(holding.shares) : 0;
        if (heldShares <= 0) return { success: false, message: `No ${ticker} shares to sell` };
        const sellShares = Math.min(decision.amount / price, heldShares);
        if (sellShares < 0.0001) return { success: false, message: "Sell amount too small" };
        await executeTrade(botUserId, ticker, "sell", sellShares, price);
        return { success: true, message: `Sold ${sellShares.toFixed(2)} shares of $${ticker} @ $${price.toFixed(2)} ($${(sellShares * price).toFixed(2)})` };
      }

      case "short": {
        const portfolio = await getOrCreatePortfolio(botUserId);
        const cash = parseFloat(portfolio.cashBalance);
        // Shorting requires 50% margin
        const maxShortAmount = Math.min(decision.amount, cash * 0.40); // Enforce 40% max per trade
        const shortAmount = Math.min(decision.amount, maxShortAmount);
        if (shortAmount < 1) return { success: false, message: `Insufficient margin for short ($${cash.toFixed(2)} cash)` };
        const shortShares = shortAmount / price;
        await executeShort(botUserId, ticker, shortShares, price);
        return { success: true, message: `Shorted ${shortShares.toFixed(2)} shares of $${ticker} @ $${price.toFixed(2)} ($${shortAmount.toFixed(2)})` };
      }

      case "cover": {
        const holdings = await getUserHoldings(botUserId);
        const holding = holdings.find(h => h.ticker === ticker);
        const shortedShares = holding ? parseFloat(holding.shortShares) : 0;
        if (shortedShares <= 0) return { success: false, message: `No ${ticker} short position to cover` };
        const coverShares = Math.min(decision.amount / price, shortedShares);
        if (coverShares < 0.0001) return { success: false, message: "Cover amount too small" };
        await executeCover(botUserId, ticker, coverShares, price);
        return { success: true, message: `Covered ${coverShares.toFixed(2)} shares of $${ticker} @ $${price.toFixed(2)} ($${(coverShares * price).toFixed(2)})` };
      }

      default:
        return { success: false, message: `Unknown action: ${decision.action}` };
    }
  } catch (err: any) {
    return { success: false, message: `Trade execution failed: ${err.message}` };
  }
}

// ─── Sentiment Comment (Korean meme trader style) ───

// Rate limit: max 2 comments per day
let commentTimesToday: number[] = [];
const MAX_COMMENTS_PER_DAY = 2;

function shouldComment(): boolean {
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  // Reset daily counter
  commentTimesToday = commentTimesToday.filter(t => t >= todayStart);
  if (commentTimesToday.length >= MAX_COMMENTS_PER_DAY) return false;
  // Random chance so comments are spread out, not back-to-back
  return Math.random() < 0.15;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateKoreanComment(
  decision: TradeDecision,
  tradeResult: { success: boolean; message: string },
  ctx: MarketContext,
): { content: string; ticker: string | null; sentiment: "bullish" | "bearish" | "neutral" } {
  const recentWins = ctx.recentMatches.slice(0, 5).filter(m => m.win).length;
  const recentLosses = ctx.recentMatches.slice(0, 5).filter(m => !m.win).length;
  const onWinStreak = recentWins >= 3;
  const onLossStreak = recentLosses >= 3;
  const lastMatch = ctx.recentMatches[0];
  const lastKda = lastMatch ? `${lastMatch.kills}/${lastMatch.deaths}/${lastMatch.assists}` : null;

  // Bullish comments (when buying / win streak / optimistic)
  const bullishComments = [
    "현석이 믿는다 가즈아 🚀",
    "다이아 가자 화이팅!! 롱 추매 ㄱㄱ",
    "이건 무조건 사야됨 ㄹㅇ",
    "현석이 캐리력 보고 올인했다",
    "LP 올라가는거 보니까 다이아 각이다",
    "솔랭 장인 현석이 믿고 매수",
    "연승 개쩔어 추매 안하면 바보",
    "ㅋㅋ 숏충이들 다 울고있겠네",
    "이 가격에 안사면 후회한다 진짜",
    "현석이 폼 미쳤음 풀매수 간다",
    "숏충이들 ㅈ됐다 ㅋㅋㅋㅋ",
    "현석이 개캐리네 ㅅㅂ 미쳤다",
    "롱 좆댔으면 개추요",
    "ㅋㅋ 숏충이 버러지들 울어라",
    "개쩐다 현석이 ㄹㅇ 사기캐",
    "안사는놈들 ㅈㅂㅈㅂ",
    "ㅅㅂ 진작 올인할걸 ㅋㅋ",
    "현석이 존나 잘하네 미쳤다",
  ];

  // Bearish comments (when shorting / loss streak / pessimistic)
  const bearishComments = [
    "현석씨... 이러면 안되는데",
    "숏 안치면 바보 아닌가 ㅋㅋ",
    "ㄹㅇ 팀운 개역겹네",
    "롱충이들 지금이라도 도망쳐",
    "다음판 지면 인버스 추매한다",
    "이거 에메 떨어지는거 아님? ㄷㄷ",
    "현석이 믿지 마세요 3x 레버리지 샀다가 ㅈ됐어요",
    "솔랭 왜 돌리는건지 모르겠다 진심",
    "LP 녹는거 실시간으로 보는중",
    "손절각 잡아야되나... 고민중",
    "ㅋㅋ 롱충이들 ㅈ됐네",
    "현석이 ㅈ밥이네 ㅅㅂ",
    "버러지 같은 팀운 ㅋㅋ",
    "ㅅㅂ 이게 뭐냐 ㅋㅋㅋ 숏 간다",
    "롱충이들 존나 불쌍하다",
    "개좆같네 ㄹㅇ 손절 각",
    "ㅈ같은 라인전 보소 ㅋㅋ",
    "이 새끼 또 졌어? 숏 풀매수",
    "시발 팀 뭐하냐 진짜",
    "ㅋㅋㅋ 망했다 그냥",
  ];

  // Neutral / hold comments
  const neutralComments = [
    "관망중... 현석이 다음판 보고 결정",
    "지금 들어가기엔 좀 애매한데",
    "추세 확인하고 진입할 예정",
    "현금 들고 기다리는게 답인듯",
    "다음 게임 결과 보고 판단하겠음",
    "ㅁㅊ 뭘 사야될지 모르겠네",
    "씨발 어캐해 이거",
    "개애매하다 ㅋㅋ 걍 관망",
  ];

  // After a specific match result
  const postWinComments = [
    lastKda ? `${lastKda} 미쳤다 ㅋㅋㅋ 현석이 캐리` : "현석이 이겼다 가즈아",
    "승리 ㄴㅇㅅ 추매 각",
    "역시 현석이 믿고 롱",
    "이기니까 기분이 좋다 추매 ㄱ",
    lastKda ? `${lastKda} ㅋㅋ 개쩔어 ㅅㅂ` : "ㄴㅇㅅ 개캐리",
    "ㅋㅋㅋ 숏충이 버러지들 오늘도 울었다",
    "현석이 존나 잘했다 ㄹㅇ",
  ];

  const postLossComments = [
    lastKda ? `${lastKda} 이게 뭐냐 ㅋㅋㅋ` : "졌네... 숏 준비",
    "팀 탓 ㄹㅇ 현석이 잘했는데",
    "바텀 차이 ㅈㄴ 심하네",
    "다음판은 이기겠지... 아마도...",
    lastKda ? `${lastKda} ㅋㅋ 이게 사람이냐` : "ㅈ됐다 ㅋㅋ",
    "ㅅㅂ 현석이 뭐하냐 진짜",
    "버러지네 ㄹㅇ ㅋㅋㅋ",
    "ㅈ같은 겜 보소 존나 역겹네",
  ];

  if (decision.action === "hold") {
    return { content: pickRandom(neutralComments), ticker: null, sentiment: "neutral" };
  }

  const isBullish = decision.action === "buy" || (decision.action === "cover");
  const isBearish = decision.action === "short" || (decision.action === "sell");

  if (isBullish) {
    const pool = onWinStreak ? [...bullishComments, ...postWinComments] :
      (lastMatch?.win ? [...bullishComments, ...postWinComments] : bullishComments);
    return { content: pickRandom(pool), ticker: decision.ticker, sentiment: "bullish" };
  }

  if (isBearish) {
    const pool = onLossStreak ? [...bearishComments, ...postLossComments] :
      (lastMatch && !lastMatch.win ? [...bearishComments, ...postLossComments] : bearishComments);
    return { content: pickRandom(pool), ticker: decision.ticker, sentiment: "bearish" };
  }

  return { content: pickRandom(neutralComments), ticker: decision.ticker, sentiment: "neutral" };
}

async function postBotComment(
  botUserId: number,
  decision: TradeDecision,
  tradeResult: { success: boolean; message: string },
  ctx: MarketContext,
): Promise<void> {
  if (!shouldComment()) return;

  try {
    const { content, ticker, sentiment } = generateKoreanComment(decision, tradeResult, ctx);

    await postComment(botUserId, content, ticker, sentiment);
    commentTimesToday.push(Date.now());
    console.log(`[Bot] Posted comment: ${content}`);
  } catch (err) {
    console.error("[Bot] Failed to post comment:", err);
  }
}

// ─── Main Bot Execution ───

/**
 * Run the bot trader. Called from the polling engine every cycle.
 * Trades every cycle regardless of live game status.
 * Returns true if the bot traded, false if it skipped.
 */
export async function runBotTrader(): Promise<boolean> {
  // Enforce cooldown — bot should not trade more than once per 10 min
  const now = Date.now();
  if (now - lastBotTradeTime < BOT_TRADE_COOLDOWN_MS) {
    return false; // Skip silently
  }

  try {
    const botUserId = await ensureBotUser();
    const marketData = await gatherMarketData(botUserId);
    const hasLLM = !!(ENV.openaiApiUrl && ENV.openaiApiKey);

    let decision: TradeDecision;
    let source: "llm" | "fallback";
    const prompt = buildAnalysisPrompt(marketData);

    if (hasLLM) {
      decision = await getAIDecision(marketData);
      source = decision.confidence > 0 ? "llm" : "fallback"; // confidence=0 means LLM failed → fallback hold
    } else {
      decision = getFallbackDecision(marketData);
      source = "fallback";
    }

    // Log all decisions (including holds) for audit trail
    if (decision.action === "hold") {
      console.log(`[Bot] HOLD | source=${source} | confidence=${decision.confidence} | reasoning: ${decision.reasoning}`);
      logBotDecision(decision, source, prompt, true, "Hold — no trade");
      return false;
    }

    const result = await executeDecision(botUserId, decision, marketData.currentPrices);
    logBotDecision(decision, source, prompt, result.success, result.message);

    console.log(`[Bot] ${decision.action.toUpperCase()} $${decision.ticker} $${decision.amount.toFixed(2)} | source=${source} | confidence=${decision.confidence} | ${result.success ? "✅" : "❌"} ${result.message}`);
    console.log(`[Bot] Reasoning: ${decision.reasoning}`);

    if (result.success) {
      lastBotTradeTime = now;
    }

    return result.success;
  } catch (err) {
    console.error("[Bot] Error:", err);
    return false;
  }
}

/**
 * Get the bot user ID (if it exists). Used for filtering if needed.
 */
export async function getBotUserId(): Promise<number | null> {
  try {
    const db = await getDb();
    const result = await db.select({ id: users.id }).from(users).where(eq(users.openId, BOT_OPEN_ID)).limit(1);
    return result.length > 0 ? result[0].id : null;
  } catch {
    return null;
  }
}

/**
 * Force run the bot (bypasses live game check). Used for admin/testing.
 */
export async function forceRunBot(): Promise<boolean> {
  console.log("[Bot] ═══════════════════════════════════════");
  console.log("[Bot] QuantBot FORCE RUN (admin override)...");

  try {
    const botUserId = await ensureBotUser();
    const marketData = await gatherMarketData(botUserId);
    const hasLLM = !!(ENV.openaiApiUrl && ENV.openaiApiKey);
    let decision: TradeDecision;
    if (hasLLM) {
      console.log("[Bot] Requesting AI analysis...");
      decision = await getAIDecision(marketData);
    } else {
      decision = getFallbackDecision(marketData);
    }
    const result = await executeDecision(botUserId, decision, marketData.currentPrices);
    console.log(`[Bot] Force: ${decision.action} $${decision.ticker} → ${result.success ? '✅' : '❌'} ${result.message}`);
    // Bot comments disabled
    // await postBotComment(botUserId, decision, result, marketData);
    return true;
  } catch (err) {
    console.error("[Bot] Force run error:", err);
    return false;
  }
}
