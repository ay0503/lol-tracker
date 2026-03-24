import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * SQLite: timestamps stored as ISO strings via DEFAULT, booleans as integers.
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  displayName: text("displayName"),
  email: text("email").unique(),
  passwordHash: text("passwordHash"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
  updatedAt: text("updatedAt").default(sql`(datetime('now'))`).notNull(),
  lastSignedIn: text("lastSignedIn").default(sql`(datetime('now'))`).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Portfolio table - tracks each user's cash balance.
 * Every new user starts with $200 cash.
 */
export const portfolios = sqliteTable("portfolios", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().unique(),
  cashBalance: text("cashBalance").notNull().default("200.00"),
  totalDividends: text("totalDividends").notNull().default("0.00"),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
  updatedAt: text("updatedAt").default(sql`(datetime('now'))`).notNull(),
});

export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = typeof portfolios.$inferInsert;

/**
 * Holdings table - tracks shares per ticker per user.
 */
export const holdings = sqliteTable("holdings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  ticker: text("ticker").notNull(),
  shares: text("shares").notNull().default("0.0000"),
  avgCostBasis: text("avgCostBasis").notNull().default("0.0000"),
  shortShares: text("shortShares").notNull().default("0.0000"),
  shortAvgPrice: text("shortAvgPrice").notNull().default("0.0000"),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
  updatedAt: text("updatedAt").default(sql`(datetime('now'))`).notNull(),
});

export type Holding = typeof holdings.$inferSelect;
export type InsertHolding = typeof holdings.$inferInsert;

/**
 * Trades table - records every buy/sell/short/cover transaction.
 */
export const trades = sqliteTable("trades", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  ticker: text("ticker").notNull().default("DORI"),
  type: text("type", { enum: ["buy", "sell", "short", "cover", "dividend"] }).notNull(),
  shares: text("shares").notNull(),
  pricePerShare: text("pricePerShare").notNull(),
  totalAmount: text("totalAmount").notNull(),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;

/**
 * Orders table - pending limit orders and stop-losses.
 */
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  ticker: text("ticker").notNull(),
  orderType: text("orderType", { enum: ["limit_buy", "limit_sell", "stop_loss"] }).notNull(),
  shares: text("shares").notNull(),
  targetPrice: text("targetPrice").notNull(),
  status: text("status", { enum: ["pending", "filled", "cancelled", "expired"] }).notNull().default("pending"),
  filledAt: text("filledAt"),
  filledPrice: text("filledPrice"),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
  updatedAt: text("updatedAt").default(sql`(datetime('now'))`).notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Comments table - StockTwits-style trade sentiment feed.
 */
export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  ticker: text("ticker"),
  content: text("content").notNull(),
  sentiment: text("sentiment", { enum: ["bullish", "bearish", "neutral"] }).default("neutral").notNull(),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

/**
 * News table - AI-generated meme news headlines from match results.
 */
export const news = sqliteTable("news", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  headline: text("headline").notNull(),
  body: text("body"),
  matchId: text("matchId"),
  isWin: integer("isWin", { mode: "boolean" }),
  champion: text("champion"),
  kda: text("kda"),
  priceChange: text("priceChange"),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type News = typeof news.$inferSelect;
export type InsertNews = typeof news.$inferInsert;

/**
 * Dividends table - tracks dividend payouts to users.
 */
export const dividends = sqliteTable("dividends", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  ticker: text("ticker").notNull(),
  shares: text("shares").notNull(),
  dividendPerShare: text("dividendPerShare").notNull(),
  totalPayout: text("totalPayout").notNull(),
  reason: text("reason").notNull(),
  matchId: text("matchId"),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type Dividend = typeof dividends.$inferSelect;
export type InsertDividend = typeof dividends.$inferInsert;

/**
 * Matches table - stores processed match results.
 */
export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: text("matchId").notNull().unique(),
  win: integer("win", { mode: "boolean" }).notNull(),
  champion: text("champion").notNull(),
  kills: integer("kills").notNull(),
  deaths: integer("deaths").notNull(),
  assists: integer("assists").notNull(),
  cs: integer("cs").notNull().default(0),
  position: text("position"),
  gameDuration: integer("gameDuration").notNull(),
  priceBefore: text("priceBefore"),
  priceAfter: text("priceAfter"),
  dividendsPaid: integer("dividendsPaid", { mode: "boolean" }).notNull().default(false),
  newsGenerated: integer("newsGenerated", { mode: "boolean" }).notNull().default(false),
  gameCreation: integer("gameCreation").notNull(),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;

/**
 * Market status table.
 */
export const marketStatus = sqliteTable("marketStatus", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  isOpen: integer("isOpen", { mode: "boolean" }).notNull().default(false),
  reason: text("reason"),
  lastActivity: text("lastActivity"),
  updatedAt: text("updatedAt").default(sql`(datetime('now'))`).notNull(),
});

export type MarketStatus = typeof marketStatus.$inferSelect;

/**
 * Price history table - stores LP snapshots over time.
 */
export const priceHistory = sqliteTable("priceHistory", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: integer("timestamp").notNull(),
  tier: text("tier").notNull(),
  division: text("division").notNull(),
  lp: integer("lp").notNull(),
  totalLP: integer("totalLP").notNull(),
  price: text("price").notNull(),
  wins: integer("wins"),
  losses: integer("losses"),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = typeof priceHistory.$inferInsert;

/**
 * Portfolio snapshots - records portfolio value over time.
 */
export const portfolioSnapshots = sqliteTable("portfolioSnapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  totalValue: text("totalValue").notNull(),
  cashBalance: text("cashBalance").notNull(),
  holdingsValue: text("holdingsValue").notNull(),
  shortPnl: text("shortPnl").notNull().default("0.00"),
  timestamp: integer("timestamp").notNull(),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type InsertPortfolioSnapshot = typeof portfolioSnapshots.$inferInsert;

/**
 * Notifications table.
 */
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  type: text("type", { enum: ["order_filled", "stop_loss_triggered", "dividend_received", "system"] }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedId: integer("relatedId"),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
