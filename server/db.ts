import { eq, desc, sql, and, inArray, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, portfolios, holdings, trades, priceHistory,
  orders, comments, news, dividends, matches, marketStatus,
  type Order, type InsertOrder
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Portfolio Helpers ───

export async function getOrCreatePortfolio(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(portfolios).where(eq(portfolios.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(portfolios).values({ userId, cashBalance: "200.00", totalDividends: "0.00" });
  const created = await db.select().from(portfolios).where(eq(portfolios.userId, userId)).limit(1);
  return created[0];
}

// ─── Holdings Helpers ───

export async function getOrCreateHolding(userId: number, ticker: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(holdings)
    .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker))).limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(holdings).values({ userId, ticker, shares: "0.0000", avgCostBasis: "0.0000", shortShares: "0.0000", shortAvgPrice: "0.0000" });
  const created = await db.select().from(holdings)
    .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker))).limit(1);
  return created[0];
}

export async function getUserHoldings(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(holdings).where(eq(holdings.userId, userId));
}

// ─── Trade Execution ───

export async function executeTrade(
  userId: number, ticker: string, type: "buy" | "sell", shares: number, pricePerShare: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const portfolio = await getOrCreatePortfolio(userId);
  const holding = await getOrCreateHolding(userId, ticker);
  const totalAmount = shares * pricePerShare;
  const currentCash = parseFloat(portfolio.cashBalance);
  const currentShares = parseFloat(holding.shares);
  const currentAvgCost = parseFloat(holding.avgCostBasis);

  if (type === "buy") {
    if (totalAmount > currentCash) throw new Error("Insufficient funds");
    await db.update(portfolios).set({ cashBalance: (currentCash - totalAmount).toFixed(2) }).where(eq(portfolios.userId, userId));
    const newShares = currentShares + shares;
    const newAvgCost = currentShares > 0 ? ((currentAvgCost * currentShares) + (pricePerShare * shares)) / newShares : pricePerShare;
    await db.update(holdings).set({ shares: newShares.toFixed(4), avgCostBasis: newAvgCost.toFixed(4) })
      .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker)));
  } else {
    if (shares > currentShares) throw new Error("Insufficient shares");
    await db.update(portfolios).set({ cashBalance: (currentCash + totalAmount).toFixed(2) }).where(eq(portfolios.userId, userId));
    await db.update(holdings).set({ shares: (currentShares - shares).toFixed(4) })
      .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker)));
  }

  await db.insert(trades).values({
    userId, ticker, type, shares: shares.toFixed(4),
    pricePerShare: pricePerShare.toFixed(4), totalAmount: totalAmount.toFixed(2),
  });

  const updatedPortfolio = await getOrCreatePortfolio(userId);
  const updatedHolding = await getOrCreateHolding(userId, ticker);
  return { portfolio: updatedPortfolio, holding: updatedHolding };
}

// ─── Short Selling ───

export async function executeShort(
  userId: number, ticker: string, shares: number, pricePerShare: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const portfolio = await getOrCreatePortfolio(userId);
  const holding = await getOrCreateHolding(userId, ticker);
  const totalAmount = shares * pricePerShare;
  const currentCash = parseFloat(portfolio.cashBalance);
  const currentShortShares = parseFloat(holding.shortShares);
  const currentShortAvg = parseFloat(holding.shortAvgPrice);

  // Require 50% margin (collateral)
  const marginRequired = totalAmount * 0.5;
  if (marginRequired > currentCash) throw new Error("Insufficient margin. Need 50% collateral.");

  // Lock margin
  await db.update(portfolios).set({ cashBalance: (currentCash - marginRequired).toFixed(2) }).where(eq(portfolios.userId, userId));

  // Credit the sale proceeds (they get the cash from selling borrowed shares)
  const newCash = currentCash - marginRequired + totalAmount;
  await db.update(portfolios).set({ cashBalance: newCash.toFixed(2) }).where(eq(portfolios.userId, userId));

  // Update short position
  const newShortShares = currentShortShares + shares;
  const newShortAvg = currentShortShares > 0
    ? ((currentShortAvg * currentShortShares) + (pricePerShare * shares)) / newShortShares
    : pricePerShare;

  await db.update(holdings).set({
    shortShares: newShortShares.toFixed(4),
    shortAvgPrice: newShortAvg.toFixed(4),
  }).where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker)));

  await db.insert(trades).values({
    userId, ticker, type: "short", shares: shares.toFixed(4),
    pricePerShare: pricePerShare.toFixed(4), totalAmount: totalAmount.toFixed(2),
  });

  return { portfolio: await getOrCreatePortfolio(userId), holding: await getOrCreateHolding(userId, ticker) };
}

export async function executeCover(
  userId: number, ticker: string, shares: number, pricePerShare: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const portfolio = await getOrCreatePortfolio(userId);
  const holding = await getOrCreateHolding(userId, ticker);
  const totalCost = shares * pricePerShare;
  const currentCash = parseFloat(portfolio.cashBalance);
  const currentShortShares = parseFloat(holding.shortShares);

  if (shares > currentShortShares) throw new Error("Cannot cover more shares than shorted");
  if (totalCost > currentCash) throw new Error("Insufficient funds to cover");

  // Pay to buy back shares
  await db.update(portfolios).set({ cashBalance: (currentCash - totalCost).toFixed(2) }).where(eq(portfolios.userId, userId));

  // Reduce short position
  await db.update(holdings).set({
    shortShares: (currentShortShares - shares).toFixed(4),
  }).where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker)));

  await db.insert(trades).values({
    userId, ticker, type: "cover", shares: shares.toFixed(4),
    pricePerShare: pricePerShare.toFixed(4), totalAmount: totalCost.toFixed(2),
  });

  return { portfolio: await getOrCreatePortfolio(userId), holding: await getOrCreateHolding(userId, ticker) };
}

// ─── Orders (Limit Orders & Stop-Losses) ───

export async function createOrder(data: {
  userId: number; ticker: string; orderType: "limit_buy" | "limit_sell" | "stop_loss";
  shares: number; targetPrice: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(orders).values({
    userId: data.userId, ticker: data.ticker, orderType: data.orderType,
    shares: data.shares.toFixed(4), targetPrice: data.targetPrice.toFixed(4),
    status: "pending",
  });

  return db.select().from(orders)
    .where(and(eq(orders.userId, data.userId), eq(orders.status, "pending")))
    .orderBy(desc(orders.createdAt)).limit(1).then(r => r[0]);
}

export async function getUserOrders(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function cancelOrder(orderId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const order = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
  if (!order.length || order[0].status !== "pending") throw new Error("Order not found or already processed");
  await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));
  return { success: true };
}

export async function getPendingOrders() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(orders).where(eq(orders.status, "pending"));
}

export async function fillOrder(orderId: number, filledPrice: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({
    status: "filled", filledAt: new Date(), filledPrice: filledPrice.toFixed(4),
  }).where(eq(orders.id, orderId));
}

// ─── Trade History ───

export async function getUserTrades(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    id: trades.id, ticker: trades.ticker, type: trades.type,
    shares: trades.shares, pricePerShare: trades.pricePerShare,
    totalAmount: trades.totalAmount, createdAt: trades.createdAt,
  }).from(trades).where(eq(trades.userId, userId)).orderBy(desc(trades.createdAt)).limit(limit);
}

export async function getAllTrades(limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    id: trades.id, userId: trades.userId,
    userName: sql`COALESCE(${users.displayName}, ${users.name})`.as('userName'),
    ticker: trades.ticker, type: trades.type,
    shares: trades.shares, pricePerShare: trades.pricePerShare,
    totalAmount: trades.totalAmount, createdAt: trades.createdAt,
  }).from(trades).leftJoin(users, eq(trades.userId, users.id)).orderBy(desc(trades.createdAt)).limit(limit);
}

// ─── Comments / Sentiment ───

export async function postComment(userId: number, content: string, ticker: string | null, sentiment: "bullish" | "bearish" | "neutral") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(comments).values({ userId, content, ticker, sentiment });
}

export async function getComments(limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    id: comments.id, userId: comments.userId,
    userName: sql`COALESCE(${users.displayName}, ${users.name})`.as('userName'),
    ticker: comments.ticker, content: comments.content,
    sentiment: comments.sentiment, createdAt: comments.createdAt,
  }).from(comments).leftJoin(users, eq(comments.userId, users.id)).orderBy(desc(comments.createdAt)).limit(limit);
}

// ─── News ───

export async function addNews(data: {
  headline: string; body?: string; matchId?: string; isWin?: boolean;
  champion?: string; kda?: string; priceChange?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(news).values({
    headline: data.headline, body: data.body ?? null,
    matchId: data.matchId ?? null, isWin: data.isWin ?? null,
    champion: data.champion ?? null, kda: data.kda ?? null,
    priceChange: data.priceChange?.toFixed(4) ?? null,
  });
}

export async function getNews(limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(news).orderBy(desc(news.createdAt)).limit(limit);
}

// ─── Dividends ───

export async function distributeDividends(matchId: string, isWin: boolean, reason: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // High dividend rates: $0.50/share for DORI on win, $0.75 for 2x, $1.00 for 3x
  // Inverse gets dividends on loss: $0.75 for SDRI, $1.00 for XDRI
  const winTickers = [
    { ticker: "DORI", rate: 0.50 },
    { ticker: "DDRI", rate: 0.75 },
    { ticker: "TDRI", rate: 1.00 },
  ];
  const lossTickers = [
    { ticker: "SDRI", rate: 0.75 },
    { ticker: "XDRI", rate: 1.00 },
  ];

  const eligibleTickers = isWin ? winTickers : lossTickers;
  let totalDistributed = 0;

  for (const { ticker, rate } of eligibleTickers) {
    // Get all holders of this ticker with shares > 0
    const holders = await db.select().from(holdings)
      .where(and(eq(holdings.ticker, ticker), sql`CAST(${holdings.shares} AS DECIMAL(12,4)) > 0`));

    for (const holder of holders) {
      const sharesHeld = parseFloat(holder.shares);
      if (sharesHeld <= 0) continue;

      const payout = sharesHeld * rate;
      totalDistributed += payout;

      // Credit cash
      const portfolio = await getOrCreatePortfolio(holder.userId);
      const newCash = parseFloat(portfolio.cashBalance) + payout;
      await db.update(portfolios).set({
        cashBalance: newCash.toFixed(2),
        totalDividends: (parseFloat(portfolio.totalDividends) + payout).toFixed(2),
      }).where(eq(portfolios.userId, holder.userId));

      // Record dividend
      await db.insert(dividends).values({
        userId: holder.userId, ticker, shares: sharesHeld.toFixed(4),
        dividendPerShare: rate.toFixed(4), totalPayout: payout.toFixed(2),
        reason, matchId,
      });

      // Record as a trade for visibility
      await db.insert(trades).values({
        userId: holder.userId, ticker, type: "dividend",
        shares: sharesHeld.toFixed(4), pricePerShare: rate.toFixed(4),
        totalAmount: payout.toFixed(2),
      });
    }
  }

  return { totalDistributed, tickersPaid: eligibleTickers.map(t => t.ticker) };
}

export async function getUserDividends(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(dividends).where(eq(dividends.userId, userId)).orderBy(desc(dividends.createdAt)).limit(limit);
}

// ─── Matches ───

export async function getProcessedMatchIds() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select({ matchId: matches.matchId }).from(matches);
  return new Set(result.map(r => r.matchId));
}

export async function addMatch(data: {
  matchId: string; win: boolean; champion: string;
  kills: number; deaths: number; assists: number;
  cs?: number; position?: string; gameDuration: number;
  priceBefore?: number; priceAfter?: number; gameCreation: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(matches).values({
    matchId: data.matchId, win: data.win, champion: data.champion,
    kills: data.kills, deaths: data.deaths, assists: data.assists,
    cs: data.cs ?? 0, position: data.position ?? null,
    gameDuration: data.gameDuration,
    priceBefore: data.priceBefore?.toFixed(4) ?? null,
    priceAfter: data.priceAfter?.toFixed(4) ?? null,
    gameCreation: data.gameCreation,
  });
}

export async function markMatchDividendsPaid(matchId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(matches).set({ dividendsPaid: true }).where(eq(matches.matchId, matchId));
}

export async function markMatchNewsGenerated(matchId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(matches).set({ newsGenerated: true }).where(eq(matches.matchId, matchId));
}

export async function getUnprocessedMatches() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(matches)
    .where(sql`${matches.dividendsPaid} = false OR ${matches.newsGenerated} = false`)
    .orderBy(matches.gameCreation);
}

// ─── Market Status ───

export async function getMarketStatus() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(marketStatus).limit(1);
  if (result.length === 0) {
    // Initialize market status
    await db.insert(marketStatus).values({ isOpen: true, reason: "Market initialized" });
    return { isOpen: true, reason: "Market initialized", lastActivity: null };
  }
  return result[0];
}

export async function setMarketStatus(isOpen: boolean, reason: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(marketStatus).limit(1);
  if (existing.length === 0) {
    await db.insert(marketStatus).values({ isOpen, reason, lastActivity: new Date() });
  } else {
    await db.update(marketStatus).set({ isOpen, reason, lastActivity: new Date() }).where(eq(marketStatus.id, existing[0].id));
  }
}

// ─── Leaderboard ───

export async function getLeaderboard() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all users with portfolios
  const allUsers = await db.select({
    userId: users.id,
    userName: sql`COALESCE(${users.displayName}, ${users.name})`.as('userName'),
    cashBalance: portfolios.cashBalance,
    totalDividends: portfolios.totalDividends,
  }).from(users).leftJoin(portfolios, eq(users.id, portfolios.userId));

  // Get all holdings for each user
  const allHoldings = await db.select().from(holdings);

  return { users: allUsers, holdings: allHoldings };
}

// ─── Price History ───

export async function addPriceSnapshot(data: {
  timestamp: number; tier: string; division: string;
  lp: number; totalLP: number; price: number;
  wins?: number; losses?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(priceHistory).values({
    timestamp: data.timestamp, tier: data.tier, division: data.division,
    lp: data.lp, totalLP: data.totalLP, price: data.price.toFixed(4),
    wins: data.wins ?? null, losses: data.losses ?? null,
  });
}

export async function getPriceHistory(since?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (since) {
    return db.select().from(priceHistory).where(sql`${priceHistory.timestamp} >= ${since}`).orderBy(priceHistory.timestamp);
  }
  return db.select().from(priceHistory).orderBy(priceHistory.timestamp);
}

export async function updateDisplayName(userId: number, displayName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ displayName }).where(eq(users.id, userId));
}

export async function getLatestPrice() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(priceHistory).orderBy(desc(priceHistory.timestamp)).limit(1);
  return result.length > 0 ? result[0] : null;
}
