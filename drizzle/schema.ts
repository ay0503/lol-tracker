import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Portfolio table - tracks each user's cash balance.
 * Every new user starts with $200 cash.
 */
export const portfolios = mysqlTable("portfolios", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  cashBalance: decimal("cashBalance", { precision: 12, scale: 2 }).notNull().default("200.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = typeof portfolios.$inferInsert;

/**
 * Holdings table - tracks shares per ticker per user.
 * Supports multiple tickers: DORI, DDRI, TDRI, SDRI, XDRI
 */
export const holdings = mysqlTable("holdings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  shares: decimal("shares", { precision: 12, scale: 4 }).notNull().default("0.0000"),
  avgCostBasis: decimal("avgCostBasis", { precision: 12, scale: 4 }).notNull().default("0.0000"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Holding = typeof holdings.$inferSelect;
export type InsertHolding = typeof holdings.$inferInsert;

/**
 * Trades table - records every buy/sell transaction across all tickers.
 */
export const trades = mysqlTable("trades", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 10 }).notNull().default("DORI"),
  type: mysqlEnum("type", ["buy", "sell"]).notNull(),
  shares: decimal("shares", { precision: 12, scale: 4 }).notNull(),
  pricePerShare: decimal("pricePerShare", { precision: 12, scale: 4 }).notNull(),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;

/**
 * Price history table - stores LP snapshots over time for charting.
 * Each record is a price point for the base DORI ticker.
 * Derived ETF prices are calculated from DORI's price changes.
 */
export const priceHistory = mysqlTable("priceHistory", {
  id: int("id").autoincrement().primaryKey(),
  /** Timestamp of the snapshot */
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  /** Tier string e.g. "EMERALD" */
  tier: varchar("tier", { length: 20 }).notNull(),
  /** Division string e.g. "II" */
  division: varchar("division", { length: 5 }).notNull(),
  /** Raw LP within the division */
  lp: int("lp").notNull(),
  /** Total LP relative to Plat 4 baseline */
  totalLP: int("totalLP").notNull(),
  /** Stock price ($10-$100 range) */
  price: decimal("price", { precision: 8, scale: 4 }).notNull(),
  /** Optional: wins at time of snapshot */
  wins: int("wins"),
  /** Optional: losses at time of snapshot */
  losses: int("losses"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = typeof priceHistory.$inferInsert;
