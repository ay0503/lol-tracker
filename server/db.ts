import { eq, desc, sql, and, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import {
  InsertUser, users, portfolios, holdings, trades, priceHistory,
  orders, comments, news, dividends, matches, marketStatus,
  portfolioSnapshots, notifications, bets,
  type Order, type InsertOrder
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

let _db: ReturnType<typeof drizzle> | null = null;
let _rawClient: ReturnType<typeof createClient> | null = null;

export function getDbSync() {
  if (!_db) {
    const dbPath = ENV.databasePath;
    // Ensure the directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    _rawClient = createClient({ url: `file:${dbPath}` });
    _db = drizzle(_rawClient);
    // Enable WAL mode for better concurrent read performance
    _rawClient.executeMultiple("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  }
  return _db;
}

/** Get the raw libsql client for executing arbitrary SQL (admin use only) */
export function getRawClient() {
  if (!_rawClient) getDbSync(); // ensure initialized
  return _rawClient!;
}

export async function getDb() {
  return getDbSync();
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();

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
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn as string; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date().toISOString();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date().toISOString();
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLocalUser(data: {
  email: string;
  passwordHash: string;
  displayName: string;
}): Promise<void> {
  const db = await getDb();
  const openId = `local_${crypto.randomUUID()}`;
  await db.insert(users).values({
    openId,
    email: data.email,
    passwordHash: data.passwordHash,
    displayName: data.displayName,
    name: data.displayName,
    loginMethod: "email",
    lastSignedIn: new Date().toISOString(),
  });
}

export async function setUserPassword(userId: number, passwordHash: string, displayName?: string): Promise<void> {
  const db = await getDb();
  const updateSet: Record<string, unknown> = {
    passwordHash,
    loginMethod: "email",
    updatedAt: new Date().toISOString(),
  };
  if (displayName) updateSet.displayName = displayName;
  await db.update(users).set(updateSet).where(eq(users.id, userId));
}

// ─── Portfolio Helpers ───

export async function getOrCreatePortfolio(userId: number) {
  const db = await getDb();
  const existing = await db.select().from(portfolios).where(eq(portfolios.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(portfolios).values({ userId, cashBalance: "200.00", totalDividends: "0.00" });
  const created = await db.select().from(portfolios).where(eq(portfolios.userId, userId)).limit(1);
  return created[0];
}

// ─── Holdings Helpers ───

export async function getOrCreateHolding(userId: number, ticker: string) {
  const db = await getDb();
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
  return db.select().from(holdings).where(eq(holdings.userId, userId));
}

// ─── Trade Execution ───

// Per-user mutex to prevent concurrent duplicate trades (e.g., double-click)
// Uses a queue-based pattern: each call chains onto the previous one, ensuring serialization.
const userTradeLocks = new Map<number, { queue: Promise<void> }>();

async function withUserLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  let entry = userTradeLocks.get(userId);
  if (!entry) {
    entry = { queue: Promise.resolve() };
    userTradeLocks.set(userId, entry);
  }

  let resolve: () => void;
  const nextSlot = new Promise<void>(r => { resolve = r; });
  const waitForTurn = entry.queue;
  entry.queue = nextSlot;

  await waitForTurn;
  try {
    return await fn();
  } finally {
    resolve!();
  }
}

export function executeTrade(
  userId: number, ticker: string, type: "buy" | "sell", shares: number, pricePerShare: number
) {
  return withUserLock(userId, async () => {
    const db = await getDb();

    // Wrap in a transaction for atomicity
    return db.transaction(async (tx) => {
      const [portfolio] = await tx.select().from(portfolios).where(eq(portfolios.userId, userId)).limit(1);
      if (!portfolio) throw new Error("Portfolio not found");

      const existingHolding = await tx.select().from(holdings)
        .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker))).limit(1);
      let holding = existingHolding[0];
      if (!holding) {
        await tx.insert(holdings).values({ userId, ticker, shares: "0.0000", avgCostBasis: "0.0000", shortShares: "0.0000", shortAvgPrice: "0.0000" });
        const created = await tx.select().from(holdings)
          .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker))).limit(1);
        holding = created[0];
      }

      const totalAmount = shares * pricePerShare;
      const currentCash = parseFloat(portfolio.cashBalance);
      const currentShares = parseFloat(holding.shares);
      const currentAvgCost = parseFloat(holding.avgCostBasis);

      if (type === "buy") {
        if (totalAmount > currentCash) throw new Error("Insufficient funds");
        const now = new Date().toISOString();
        await tx.update(portfolios).set({ cashBalance: (currentCash - totalAmount).toFixed(2), updatedAt: now }).where(eq(portfolios.userId, userId));
        const newShares = currentShares + shares;
        const newAvgCost = currentShares > 0 ? ((currentAvgCost * currentShares) + (pricePerShare * shares)) / newShares : pricePerShare;
        await tx.update(holdings).set({ shares: newShares.toFixed(4), avgCostBasis: newAvgCost.toFixed(4), updatedAt: now })
          .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker)));
      } else {
        if (shares > currentShares) throw new Error("Insufficient shares");
        const now = new Date().toISOString();
        await tx.update(portfolios).set({ cashBalance: (currentCash + totalAmount).toFixed(2), updatedAt: now }).where(eq(portfolios.userId, userId));
        await tx.update(holdings).set({ shares: (currentShares - shares).toFixed(4), updatedAt: now })
          .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker)));
      }

      await tx.insert(trades).values({
        userId, ticker, type, shares: shares.toFixed(4),
        pricePerShare: pricePerShare.toFixed(4), totalAmount: totalAmount.toFixed(2),
      });

      const [updatedPortfolio] = await tx.select().from(portfolios).where(eq(portfolios.userId, userId)).limit(1);
      const [updatedHolding] = await tx.select().from(holdings)
        .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker))).limit(1);
      return { portfolio: updatedPortfolio, holding: updatedHolding };
    });
  });
}

// ─── Short Selling ───

export function executeShort(
  userId: number, ticker: string, shares: number, pricePerShare: number
) {
  return withUserLock(userId, async () => {
    const db = await getDb();

    return db.transaction(async (tx) => {
      const [portfolio] = await tx.select().from(portfolios).where(eq(portfolios.userId, userId)).limit(1);
      if (!portfolio) throw new Error("Portfolio not found");

      const existingHolding = await tx.select().from(holdings)
        .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker))).limit(1);
      let holding = existingHolding[0];
      if (!holding) {
        await tx.insert(holdings).values({ userId, ticker, shares: "0.0000", avgCostBasis: "0.0000", shortShares: "0.0000", shortAvgPrice: "0.0000" });
        const created = await tx.select().from(holdings)
          .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker))).limit(1);
        holding = created[0];
      }

      const totalAmount = shares * pricePerShare;
      const currentCash = parseFloat(portfolio.cashBalance);
      const currentShortShares = parseFloat(holding.shortShares);
      const currentShortAvg = parseFloat(holding.shortAvgPrice);

      const marginRequired = totalAmount * 0.5;
      if (marginRequired > currentCash) throw new Error("Insufficient margin. Need 50% collateral.");

      const newCash = currentCash - marginRequired + totalAmount;
      const now = new Date().toISOString();
      await tx.update(portfolios).set({ cashBalance: newCash.toFixed(2), updatedAt: now }).where(eq(portfolios.userId, userId));

      const newShortShares = currentShortShares + shares;
      const newShortAvg = currentShortShares > 0
        ? ((currentShortAvg * currentShortShares) + (pricePerShare * shares)) / newShortShares
        : pricePerShare;

      await tx.update(holdings).set({
        shortShares: newShortShares.toFixed(4),
        shortAvgPrice: newShortAvg.toFixed(4),
        updatedAt: now,
      }).where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker)));

      await tx.insert(trades).values({
        userId, ticker, type: "short", shares: shares.toFixed(4),
        pricePerShare: pricePerShare.toFixed(4), totalAmount: totalAmount.toFixed(2),
      });

      const [updatedPortfolio] = await tx.select().from(portfolios).where(eq(portfolios.userId, userId)).limit(1);
      const [updatedHolding] = await tx.select().from(holdings)
        .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker))).limit(1);
      return { portfolio: updatedPortfolio, holding: updatedHolding };
    });
  });
}

export function executeCover(
  userId: number, ticker: string, shares: number, pricePerShare: number
) {
  return withUserLock(userId, async () => {
    const db = await getDb();

    return db.transaction(async (tx) => {
      const [portfolio] = await tx.select().from(portfolios).where(eq(portfolios.userId, userId)).limit(1);
      if (!portfolio) throw new Error("Portfolio not found");

      const [holding] = await tx.select().from(holdings)
        .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker))).limit(1);
      if (!holding) throw new Error("No holding found");

      const totalCost = shares * pricePerShare;
      const currentCash = parseFloat(portfolio.cashBalance);
      const currentShortShares = parseFloat(holding.shortShares);
      const currentShortAvg = parseFloat(holding.shortAvgPrice);

      if (shares > currentShortShares) throw new Error("Cannot cover more shares than shorted");

      const marginReturn = shares * currentShortAvg * 0.5;
      const newCash = currentCash - totalCost + marginReturn;

      if (newCash < 0) throw new Error("Insufficient funds to cover (after margin return)");

      const now = new Date().toISOString();
      await tx.update(portfolios).set({ cashBalance: newCash.toFixed(2), updatedAt: now }).where(eq(portfolios.userId, userId));
      await tx.update(holdings).set({
        shortShares: (currentShortShares - shares).toFixed(4),
        updatedAt: now,
      }).where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker)));

      await tx.insert(trades).values({
        userId, ticker, type: "cover", shares: shares.toFixed(4),
        pricePerShare: pricePerShare.toFixed(4), totalAmount: totalCost.toFixed(2),
      });

      const [updatedPortfolio] = await tx.select().from(portfolios).where(eq(portfolios.userId, userId)).limit(1);
      const [updatedHolding] = await tx.select().from(holdings)
        .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker))).limit(1);
      return { portfolio: updatedPortfolio, holding: updatedHolding };
    });
  });
}

// ─── Orders (Limit Orders & Stop-Losses) ───

export async function createOrder(data: {
  userId: number; ticker: string; orderType: "limit_buy" | "limit_sell" | "stop_loss";
  shares: number; targetPrice: number;
}) {
  const db = await getDb();

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
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function cancelOrder(orderId: number, userId: number) {
  const db = await getDb();
  const order = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
  if (!order.length || order[0].status !== "pending") throw new Error("Order not found or already processed");
  await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));
  return { success: true };
}

export async function getPendingOrders() {
  const db = await getDb();
  return db.select().from(orders).where(eq(orders.status, "pending"));
}

export async function fillOrder(orderId: number, filledPrice: number) {
  const db = await getDb();
  const result = await db.update(orders).set({
    status: "filled", filledAt: new Date().toISOString(), filledPrice: filledPrice.toFixed(4),
  }).where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
  return result;
}

// ─── Trade History ───

export async function getUserTrades(userId: number, limit = 50) {
  const db = await getDb();
  return db.select({
    id: trades.id, ticker: trades.ticker, type: trades.type,
    shares: trades.shares, pricePerShare: trades.pricePerShare,
    totalAmount: trades.totalAmount, createdAt: trades.createdAt,
  }).from(trades).where(eq(trades.userId, userId)).orderBy(desc(trades.createdAt)).limit(limit);
}

export async function getAllTrades(limit = 100) {
  const db = await getDb();
  return db.select({
    id: trades.id, userId: trades.userId,
    userName: sql`COALESCE(${users.displayName}, ${users.name})`.as('userName'),
    ticker: trades.ticker, type: trades.type,
    shares: trades.shares, pricePerShare: trades.pricePerShare,
    totalAmount: trades.totalAmount, createdAt: trades.createdAt,
  }).from(trades).leftJoin(users, eq(trades.userId, users.id))
    .where(ne(users.role, 'admin'))
    .orderBy(desc(trades.createdAt)).limit(limit);
}

// ─── Comments / Sentiment ───

export async function postComment(userId: number, content: string, ticker: string | null, sentiment: "bullish" | "bearish" | "neutral") {
  const db = await getDb();
  await db.insert(comments).values({ userId, content, ticker, sentiment });
}

export async function getComments(limit = 50) {
  const db = await getDb();
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
  await db.insert(news).values({
    headline: data.headline, body: data.body ?? null,
    matchId: data.matchId ?? null, isWin: data.isWin ?? null,
    champion: data.champion ?? null, kda: data.kda ?? null,
    priceChange: data.priceChange?.toFixed(4) ?? null,
  });
}

export async function getNews(limit = 20) {
  const db = await getDb();
  return db.select().from(news).orderBy(desc(news.createdAt)).limit(limit);
}

// ─── Dividends ───

/**
 * Distribute dividends after a game.
 * - Base: $0.10 per holder per game
 * - Share bonus: direction-dependent, scaled by LP change
 *   WIN: DORI $0.002, DDRI $0.003, TDRI $0.004 per LP per share
 *   LOSS: SDRI $0.003, XDRI $0.004 per LP per share
 * - Rubber banding multiplier based on portfolio value
 * - Cap: $3 per user per game (after multiplier)
 */
const BASE_DIVIDEND = 0.10;
const DIVIDEND_CAP = 3.00;
const WIN_RATES: Record<string, number> = { DORI: 0.002, DDRI: 0.003, TDRI: 0.004 };
const LOSS_RATES: Record<string, number> = { SDRI: 0.003, XDRI: 0.004 };

function getRubberBandMultiplier(portfolioValue: number): number {
  if (portfolioValue < 50) return 3;
  if (portfolioValue < 100) return 2;
  if (portfolioValue < 150) return 1.5;
  if (portfolioValue <= 250) return 1;
  if (portfolioValue <= 400) return 0.75;
  return 0.5;
}

export async function distributeDividends(
  matchId: string, isWin: boolean, reason: string, lpChange?: number,
) {
  const db = await getDb();
  const absLP = Math.abs(lpChange ?? 0);
  const bonusRates = isWin ? WIN_RATES : LOSS_RATES;

  // Get all users with any long holdings
  const allHoldings = await db.select().from(holdings)
    .where(sql`CAST(${holdings.shares} AS REAL) > 0`);

  // Group by userId
  const userHoldings = new Map<number, typeof allHoldings>();
  for (const h of allHoldings) {
    const arr = userHoldings.get(h.userId) ?? [];
    arr.push(h);
    userHoldings.set(h.userId, arr);
  }

  let totalDistributed = 0;

  for (const [userId, userHolds] of Array.from(userHoldings.entries())) {
    // Calculate share bonus across all tickers
    let shareBonus = 0;
    let primaryTicker = "DORI";
    let primaryShares = 0;

    for (const h of userHolds) {
      const shares = parseFloat(h.shares);
      if (shares <= 0) continue;
      const rate = bonusRates[h.ticker];
      if (rate && absLP > 0) {
        const bonus = shares * rate * absLP;
        shareBonus += bonus;
        if (shares > primaryShares) {
          primaryShares = shares;
          primaryTicker = h.ticker;
        }
      }
      if (shares > primaryShares && !rate) {
        // Track largest holding even if wrong direction (for recording)
        if (primaryShares === 0) {
          primaryShares = shares;
          primaryTicker = h.ticker;
        }
      }
    }

    // Get portfolio value for rubber banding
    const portfolio = await getOrCreatePortfolio(userId);
    const cash = parseFloat(portfolio.cashBalance);
    // Approximate portfolio value as cash + sum of (shares * avgCost) — rough but avoids full ETF price computation
    let holdingsValue = 0;
    for (const h of userHolds) {
      holdingsValue += parseFloat(h.shares) * parseFloat(h.avgCostBasis);
    }
    const approxPortfolioValue = cash + holdingsValue;

    const multiplier = getRubberBandMultiplier(approxPortfolioValue);
    let rawPayout = (BASE_DIVIDEND + shareBonus) * multiplier;
    const payout = Math.min(rawPayout, DIVIDEND_CAP);

    if (payout < 0.01) continue;

    totalDistributed += payout;

    await withUserLock(userId, async () => {
      const freshPortfolio = await getOrCreatePortfolio(userId);
      const newCash = parseFloat(freshPortfolio.cashBalance) + payout;
      await db.update(portfolios).set({
        cashBalance: newCash.toFixed(2),
        totalDividends: (parseFloat(freshPortfolio.totalDividends) + payout).toFixed(2),
        updatedAt: new Date().toISOString(),
      }).where(eq(portfolios.userId, userId));

      await db.insert(dividends).values({
        userId, ticker: primaryTicker, shares: primaryShares.toFixed(4),
        dividendPerShare: (payout / Math.max(primaryShares, 0.0001)).toFixed(4),
        totalPayout: payout.toFixed(2),
        reason: `${reason} [${multiplier}x rubber band]`, matchId,
      });

      await db.insert(trades).values({
        userId, ticker: primaryTicker, type: "dividend",
        shares: primaryShares.toFixed(4),
        pricePerShare: (payout / Math.max(primaryShares, 0.0001)).toFixed(4),
        totalAmount: payout.toFixed(2),
      });

      // Notify user
      await db.insert(notifications).values({
        userId, type: "dividend_received",
        title: `Dividend: +$${payout.toFixed(2)}`,
        message: `${isWin ? "Win" : "Loss"} dividend${multiplier !== 1 ? ` (${multiplier}x boost)` : ""}: +$${payout.toFixed(2)}`,
      });
    });
  }

  return { totalDistributed, holdersCount: userHoldings.size };
}

export async function getUserDividends(userId: number, limit = 50) {
  const db = await getDb();
  return db.select().from(dividends).where(eq(dividends.userId, userId)).orderBy(desc(dividends.createdAt)).limit(limit);
}

export async function getAllDividends(limit = 100) {
  const db = await getDb();
  return db.select({
    id: dividends.id, userId: dividends.userId,
    userName: sql`COALESCE(${users.displayName}, ${users.name})`.as('userName'),
    ticker: dividends.ticker, shares: dividends.shares,
    dividendPerShare: dividends.dividendPerShare, totalPayout: dividends.totalPayout,
    reason: dividends.reason, matchId: dividends.matchId,
    createdAt: dividends.createdAt,
  }).from(dividends).leftJoin(users, eq(dividends.userId, users.id))
    .orderBy(desc(dividends.createdAt)).limit(limit);
}

// ─── Matches ───

export async function getProcessedMatchIds() {
  const db = await getDb();
  const result = await db.select({ matchId: matches.matchId }).from(matches);
  return new Set(result.map(r => r.matchId));
}

export async function addMatch(data: {
  matchId: string; win: boolean; champion: string;
  kills: number; deaths: number; assists: number;
  cs?: number; position?: string; gameDuration: number;
  priceBefore?: number; priceAfter?: number; gameCreation: number;
  isRemake?: boolean;
}) {
  const db = await getDb();
  await db.insert(matches).values({
    matchId: data.matchId, win: data.win, champion: data.champion,
    kills: data.kills, deaths: data.deaths, assists: data.assists,
    cs: data.cs ?? 0, position: data.position ?? null,
    gameDuration: data.gameDuration,
    priceBefore: data.priceBefore?.toFixed(4) ?? null,
    priceAfter: data.priceAfter?.toFixed(4) ?? null,
    gameCreation: data.gameCreation,
    isRemake: data.isRemake ?? false,
  });
}

export async function markMatchDividendsPaid(matchId: string) {
  const db = await getDb();
  await db.update(matches).set({ dividendsPaid: true }).where(eq(matches.matchId, matchId));
}

export async function markMatchNewsGenerated(matchId: string) {
  const db = await getDb();
  await db.update(matches).set({ newsGenerated: true }).where(eq(matches.matchId, matchId));
}

export async function getRecentMatchesFromDB(limit: number = 20) {
  const db = await getDb();
  return db.select().from(matches).orderBy(sql`${matches.gameCreation} DESC`).limit(limit);
}

export async function getUnprocessedMatches() {
  const db = await getDb();
  return db.select().from(matches)
    .where(sql`${matches.dividendsPaid} = 0 OR ${matches.newsGenerated} = 0`)
    .orderBy(matches.gameCreation);
}

// ─── Market Status ───

export async function getMarketStatus() {
  const db = await getDb();
  const result = await db.select().from(marketStatus).limit(1);
  if (result.length === 0) {
    await db.insert(marketStatus).values({ isOpen: true, reason: "Market initialized" });
    return { isOpen: true, adminHalt: false, reason: "Market initialized", lastActivity: null };
  }
  return result[0];
}

export async function setMarketStatus(isOpen: boolean, reason: string) {
  const db = await getDb();
  const existing = await db.select().from(marketStatus).limit(1);
  if (existing.length === 0) {
    await db.insert(marketStatus).values({ isOpen, reason, lastActivity: new Date().toISOString() });
  } else {
    await db.update(marketStatus).set({ isOpen, reason, lastActivity: new Date().toISOString() }).where(eq(marketStatus.id, existing[0].id));
  }
}

export async function toggleAdminHalt(halt: boolean) {
  const db = await getDb();
  const existing = await db.select().from(marketStatus).limit(1);
  const reason = halt ? "Admin halted trading" : "Admin resumed trading";
  if (existing.length === 0) {
    await db.insert(marketStatus).values({ isOpen: !halt, adminHalt: halt, reason, lastActivity: new Date().toISOString() });
  } else {
    await db.update(marketStatus).set({ adminHalt: halt, reason, lastActivity: new Date().toISOString() }).where(eq(marketStatus.id, existing[0].id));
  }
}

// ─── Leaderboard ───

export async function getLeaderboard() {
  const db = await getDb();

  const allUsers = await db.select({
    userId: users.id,
    userName: sql`COALESCE(${users.displayName}, ${users.name})`.as('userName'),
    cashBalance: portfolios.cashBalance,
    totalDividends: portfolios.totalDividends,
  }).from(users).leftJoin(portfolios, eq(users.id, portfolios.userId));

  // Fetch holdings for all users, grouped by userId for O(1) lookup
  const userIds = allUsers.map(u => u.userId);
  const allHoldings = userIds.length > 0
    ? await db.select().from(holdings).where(sql`${holdings.userId} IN (${sql.join(userIds, sql`, `)})`)
    : [];

  const holdingsByUser = new Map<number, typeof allHoldings>();
  for (const h of allHoldings) {
    const arr = holdingsByUser.get(h.userId) ?? [];
    arr.push(h);
    holdingsByUser.set(h.userId, arr);
  }

  return { users: allUsers, holdingsByUser };
}

// ─── Price History ───

export async function addPriceSnapshot(data: {
  timestamp: number; tier: string; division: string;
  lp: number; totalLP: number; price: number;
  wins?: number; losses?: number;
}) {
  const db = await getDb();
  await db.insert(priceHistory).values({
    timestamp: data.timestamp, tier: data.tier, division: data.division,
    lp: data.lp, totalLP: data.totalLP, price: data.price.toFixed(4),
    wins: data.wins ?? null, losses: data.losses ?? null,
  });
}

export async function getPriceHistory(since?: number) {
  const db = await getDb();
  if (since) {
    return db.select().from(priceHistory).where(sql`${priceHistory.timestamp} >= ${since}`).orderBy(priceHistory.timestamp);
  }
  return db.select().from(priceHistory).orderBy(priceHistory.timestamp);
}

export async function updateDisplayName(userId: number, displayName: string) {
  const db = await getDb();
  await db.update(users).set({ displayName }).where(eq(users.id, userId));
}

export async function getLatestPrice() {
  const db = await getDb();
  const result = await db.select().from(priceHistory).orderBy(desc(priceHistory.timestamp)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Prune old price history: keep all snapshots from last 7 days,
 * then keep only 1 per hour for 7-30 days, and 1 per day for 30+ days.
 * Returns number of rows deleted.
 */
export async function pruneOldPriceHistory(): Promise<number> {
  const client = getRawClient();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  // For 7-30 days: keep only the last snapshot per hour
  const hourlyResult = await client.execute({
    sql: `DELETE FROM priceHistory WHERE timestamp < ? AND timestamp >= ? AND id NOT IN (
      SELECT MAX(id) FROM priceHistory WHERE timestamp < ? AND timestamp >= ? GROUP BY CAST(timestamp / 3600000 AS INTEGER)
    )`,
    args: [sevenDaysAgo, thirtyDaysAgo, sevenDaysAgo, thirtyDaysAgo],
  });

  // For 30+ days: keep only the last snapshot per day
  const dailyResult = await client.execute({
    sql: `DELETE FROM priceHistory WHERE timestamp < ? AND id NOT IN (
      SELECT MAX(id) FROM priceHistory WHERE timestamp < ? GROUP BY CAST(timestamp / 86400000 AS INTEGER)
    )`,
    args: [thirtyDaysAgo, thirtyDaysAgo],
  });

  const total = (hourlyResult.rowsAffected ?? 0) + (dailyResult.rowsAffected ?? 0);
  if (total > 0) console.log(`[DB] Pruned ${total} old price history rows`);
  return total;
}

// ─── Game Bets ───

export async function placeBet(userId: number, prediction: "win" | "loss", amount: number) {
  const db = await getDb();
  // Check for existing pending bet
  const existing = await db.select().from(bets).where(and(eq(bets.userId, userId), eq(bets.status, "pending"))).limit(1);
  if (existing.length > 0) throw new Error("You already have a pending bet. Wait for the current game to end.");

  // Deduct from cash
  return withUserLock(userId, async () => {
    const portfolio = await getOrCreatePortfolio(userId);
    const cash = parseFloat(portfolio.cashBalance);
    if (amount > cash) throw new Error(`Insufficient cash. You have $${cash.toFixed(2)}.`);

    await db.update(portfolios).set({
      cashBalance: (cash - amount).toFixed(2),
      updatedAt: new Date().toISOString(),
    }).where(eq(portfolios.userId, userId));

    const [bet] = await db.insert(bets).values({
      userId, prediction, amount: amount.toFixed(2),
    }).returning();

    return bet;
  });
}

export async function getPendingBets() {
  const db = await getDb();
  return db.select().from(bets).where(eq(bets.status, "pending"));
}

export async function getUserBets(userId: number, limit = 20) {
  const db = await getDb();
  return db.select().from(bets).where(eq(bets.userId, userId)).orderBy(desc(bets.createdAt)).limit(limit);
}

export async function resolveBets(matchId: string, playerWon: boolean) {
  const db = await getDb();
  const pending = await db.select().from(bets).where(eq(bets.status, "pending"));
  let resolved = 0;

  for (const bet of pending) {
    const betAmount = parseFloat(bet.amount);
    const correctPrediction = (bet.prediction === "win" && playerWon) || (bet.prediction === "loss" && !playerWon);

    if (correctPrediction) {
      const payout = betAmount * 2;
      await withUserLock(bet.userId, async () => {
        const portfolio = await getOrCreatePortfolio(bet.userId);
        const cash = parseFloat(portfolio.cashBalance);
        await db.update(portfolios).set({
          cashBalance: (cash + payout).toFixed(2),
          updatedAt: new Date().toISOString(),
        }).where(eq(portfolios.userId, bet.userId));
      });

      await db.update(bets).set({ status: "won", matchId, payout: payout.toFixed(2) }).where(eq(bets.id, bet.id));

      await db.insert(notifications).values({
        userId: bet.userId,
        type: "system",
        title: "Bet Won! 🎉",
        message: `You bet $${betAmount.toFixed(2)} on ${bet.prediction.toUpperCase()} and won $${payout.toFixed(2)}!`,
      });
    } else {
      // Cash already deducted on bet placement
      await db.update(bets).set({ status: "lost", matchId }).where(eq(bets.id, bet.id));

      await db.insert(notifications).values({
        userId: bet.userId,
        type: "system",
        title: "Bet Lost",
        message: `You bet $${betAmount.toFixed(2)} on ${bet.prediction.toUpperCase()} — better luck next time.`,
      });
    }
    resolved++;
  }

  return resolved;
}

// ─── Live Stats (computed from stored matches) ───

export async function getAllMatchesFromDB() {
  const db = await getDb();
  return db.select().from(matches).orderBy(sql`${matches.gameCreation} DESC`);
}

export async function getMatchesSince(sinceTimestamp: number) {
  const db = await getDb();
  return db.select().from(matches)
    .where(sql`${matches.gameCreation} >= ${sinceTimestamp}`)
    .orderBy(sql`${matches.gameCreation} DESC`);
}

// ─── Portfolio Snapshots ───

export async function recordPortfolioSnapshots(
  tickerPrices: Record<string, number>
) {
  const db = await getDb();

  const allPortfolios = await db.select().from(portfolios);
  const allHoldingsData = await db.select().from(holdings);
  const now = Date.now();

  for (const p of allPortfolios) {
    const cash = parseFloat(p.cashBalance);
    const userHoldings = allHoldingsData.filter(h => h.userId === p.userId);

    let holdingsValue = 0;
    let shortPnl = 0;
    for (const h of userHoldings) {
      const shares = parseFloat(h.shares);
      const shortShares = parseFloat(h.shortShares);
      const shortAvg = parseFloat(h.shortAvgPrice);
      const price = tickerPrices[h.ticker] || 0;
      holdingsValue += shares * price;
      shortPnl += shortShares * (shortAvg - price);
    }

    const totalValue = cash + holdingsValue + shortPnl;

    await db.insert(portfolioSnapshots).values({
      userId: p.userId,
      totalValue: totalValue.toFixed(2),
      cashBalance: cash.toFixed(2),
      holdingsValue: holdingsValue.toFixed(2),
      shortPnl: shortPnl.toFixed(2),
      timestamp: now,
    });
  }
}

export async function getPortfolioHistory(userId: number, since?: number) {
  const db = await getDb();
  if (since) {
    return db.select().from(portfolioSnapshots)
      .where(and(eq(portfolioSnapshots.userId, userId), sql`${portfolioSnapshots.timestamp} >= ${since}`))
      .orderBy(portfolioSnapshots.timestamp);
  }
  return db.select().from(portfolioSnapshots)
    .where(eq(portfolioSnapshots.userId, userId))
    .orderBy(portfolioSnapshots.timestamp);
}

// ─── Notifications ───

export async function createNotification(data: {
  userId: number;
  type: "order_filled" | "stop_loss_triggered" | "dividend_received" | "system";
  title: string;
  message: string;
  relatedId?: number;
}) {
  const db = await getDb();
  await db.insert(notifications).values({
    userId: data.userId,
    type: data.type,
    title: data.title,
    message: data.message,
    relatedId: data.relatedId ?? null,
    read: false,
  });
}

export async function getUserNotifications(userId: number, limit = 50) {
  const db = await getDb();
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return result[0]?.count ?? 0;
}

export async function markNotificationRead(notificationId: number, userId: number) {
  const db = await getDb();
  await db.update(notifications).set({ read: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  await db.update(notifications).set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
}
