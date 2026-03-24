import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, portfolios, trades } from "../drizzle/schema";
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
  await db.insert(portfolios).values({ userId, cashBalance: "200.00", sharesOwned: "0.0000" });
  const created = await db.select().from(portfolios).where(eq(portfolios.userId, userId)).limit(1);
  return created[0];
}

export async function executeTrade(
  userId: number,
  type: "buy" | "sell",
  shares: number,
  pricePerShare: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const portfolio = await getOrCreatePortfolio(userId);
  const totalAmount = shares * pricePerShare;
  const currentCash = parseFloat(portfolio.cashBalance);
  const currentShares = parseFloat(portfolio.sharesOwned);

  if (type === "buy") {
    if (totalAmount > currentCash) {
      throw new Error("Insufficient funds");
    }
    await db.update(portfolios)
      .set({
        cashBalance: (currentCash - totalAmount).toFixed(2),
        sharesOwned: (currentShares + shares).toFixed(4),
      })
      .where(eq(portfolios.userId, userId));
  } else {
    if (shares > currentShares) {
      throw new Error("Insufficient shares");
    }
    await db.update(portfolios)
      .set({
        cashBalance: (currentCash + totalAmount).toFixed(2),
        sharesOwned: (currentShares - shares).toFixed(4),
      })
      .where(eq(portfolios.userId, userId));
  }

  // Record the trade
  await db.insert(trades).values({
    userId,
    type,
    shares: shares.toFixed(4),
    pricePerShare: pricePerShare.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
  });

  // Return updated portfolio
  return getOrCreatePortfolio(userId);
}

export async function getUserTrades(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(trades)
    .where(eq(trades.userId, userId))
    .orderBy(desc(trades.createdAt))
    .limit(limit);
}
