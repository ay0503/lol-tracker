import { eq, desc, sql, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, portfolios, holdings, trades, priceHistory } from "../drizzle/schema";
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
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
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

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Portfolio Helpers ───

export async function getOrCreatePortfolio(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(portfolios).where(eq(portfolios.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];

  // Create new portfolio with $200 starting balance
  await db.insert(portfolios).values({ userId, cashBalance: "200.00" });
  const created = await db.select().from(portfolios).where(eq(portfolios.userId, userId)).limit(1);
  return created[0];
}

// ─── Holdings Helpers ───

export async function getOrCreateHolding(userId: number, ticker: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(holdings)
    .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker)))
    .limit(1);
  if (existing.length > 0) return existing[0];

  await db.insert(holdings).values({ userId, ticker, shares: "0.0000", avgCostBasis: "0.0000" });
  const created = await db.select().from(holdings)
    .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker)))
    .limit(1);
  return created[0];
}

export async function getUserHoldings(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(holdings).where(eq(holdings.userId, userId));
}

// ─── Trade Execution ───

export async function executeTrade(
  userId: number,
  ticker: string,
  type: "buy" | "sell",
  shares: number,
  pricePerShare: number
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
    if (totalAmount > currentCash) {
      throw new Error("Insufficient funds");
    }
    // Update cash
    await db.update(portfolios)
      .set({ cashBalance: (currentCash - totalAmount).toFixed(2) })
      .where(eq(portfolios.userId, userId));

    // Update holding with new avg cost basis
    const newShares = currentShares + shares;
    const newAvgCost = currentShares > 0
      ? ((currentAvgCost * currentShares) + (pricePerShare * shares)) / newShares
      : pricePerShare;

    await db.update(holdings)
      .set({
        shares: newShares.toFixed(4),
        avgCostBasis: newAvgCost.toFixed(4),
      })
      .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker)));
  } else {
    if (shares > currentShares) {
      throw new Error("Insufficient shares");
    }
    // Update cash
    await db.update(portfolios)
      .set({ cashBalance: (currentCash + totalAmount).toFixed(2) })
      .where(eq(portfolios.userId, userId));

    // Update holding (avg cost basis stays the same on sell)
    await db.update(holdings)
      .set({ shares: (currentShares - shares).toFixed(4) })
      .where(and(eq(holdings.userId, userId), eq(holdings.ticker, ticker)));
  }

  // Record the trade
  await db.insert(trades).values({
    userId,
    ticker,
    type,
    shares: shares.toFixed(4),
    pricePerShare: pricePerShare.toFixed(4),
    totalAmount: totalAmount.toFixed(2),
  });

  // Return updated portfolio + holding
  const updatedPortfolio = await getOrCreatePortfolio(userId);
  const updatedHolding = await getOrCreateHolding(userId, ticker);
  return { portfolio: updatedPortfolio, holding: updatedHolding };
}

// ─── Trade History ───

export async function getUserTrades(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select({
    id: trades.id,
    ticker: trades.ticker,
    type: trades.type,
    shares: trades.shares,
    pricePerShare: trades.pricePerShare,
    totalAmount: trades.totalAmount,
    createdAt: trades.createdAt,
  }).from(trades)
    .where(eq(trades.userId, userId))
    .orderBy(desc(trades.createdAt))
    .limit(limit);
}

export async function getAllTrades(limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select({
    id: trades.id,
    userId: trades.userId,
    userName: sql`COALESCE(${users.displayName}, ${users.name})`.as('userName'),
    ticker: trades.ticker,
    type: trades.type,
    shares: trades.shares,
    pricePerShare: trades.pricePerShare,
    totalAmount: trades.totalAmount,
    createdAt: trades.createdAt,
  }).from(trades)
    .leftJoin(users, eq(trades.userId, users.id))
    .orderBy(desc(trades.createdAt))
    .limit(limit);
}

// ─── Price History ───

export async function addPriceSnapshot(data: {
  timestamp: number;
  tier: string;
  division: string;
  lp: number;
  totalLP: number;
  price: number;
  wins?: number;
  losses?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(priceHistory).values({
    timestamp: data.timestamp,
    tier: data.tier,
    division: data.division,
    lp: data.lp,
    totalLP: data.totalLP,
    price: data.price.toFixed(4),
    wins: data.wins ?? null,
    losses: data.losses ?? null,
  });
}

export async function getPriceHistory(since?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (since) {
    return db.select().from(priceHistory)
      .where(sql`${priceHistory.timestamp} >= ${since}`)
      .orderBy(priceHistory.timestamp);
  }

  return db.select().from(priceHistory)
    .orderBy(priceHistory.timestamp);
}

export async function updateDisplayName(userId: number, displayName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({ displayName })
    .where(eq(users.id, userId));
}

export async function getLatestPrice() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(priceHistory)
    .orderBy(desc(priceHistory.timestamp))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}
