import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  displayName: varchar("displayName", { length: 50 }),
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
  /** Total dividends received all-time */
  totalDividends: decimal("totalDividends", { precision: 12, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = typeof portfolios.$inferInsert;

/**
 * Holdings table - tracks shares per ticker per user.
 * Supports multiple tickers: DORI, DDRI, TDRI, SDRI, XDRI
 * Negative shares = short position
 */
export const holdings = mysqlTable("holdings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  shares: decimal("shares", { precision: 12, scale: 4 }).notNull().default("0.0000"),
  avgCostBasis: decimal("avgCostBasis", { precision: 12, scale: 4 }).notNull().default("0.0000"),
  /** Borrowed shares for short positions */
  shortShares: decimal("shortShares", { precision: 12, scale: 4 }).notNull().default("0.0000"),
  /** Average price at which shares were shorted */
  shortAvgPrice: decimal("shortAvgPrice", { precision: 12, scale: 4 }).notNull().default("0.0000"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Holding = typeof holdings.$inferSelect;
export type InsertHolding = typeof holdings.$inferInsert;

/**
 * Trades table - records every buy/sell/short/cover transaction.
 */
export const trades = mysqlTable("trades", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 10 }).notNull().default("DORI"),
  type: mysqlEnum("type", ["buy", "sell", "short", "cover", "dividend"]).notNull(),
  shares: decimal("shares", { precision: 12, scale: 4 }).notNull(),
  pricePerShare: decimal("pricePerShare", { precision: 12, scale: 4 }).notNull(),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;

/**
 * Orders table - pending limit orders and stop-losses.
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  /** limit_buy: buy when price <= target, limit_sell: sell when price >= target, stop_loss: sell when price <= target */
  orderType: mysqlEnum("orderType", ["limit_buy", "limit_sell", "stop_loss"]).notNull(),
  /** Number of shares to trade */
  shares: decimal("shares", { precision: 12, scale: 4 }).notNull(),
  /** Target price to trigger the order */
  targetPrice: decimal("targetPrice", { precision: 8, scale: 4 }).notNull(),
  status: mysqlEnum("status", ["pending", "filled", "cancelled", "expired"]).notNull().default("pending"),
  /** When the order was filled */
  filledAt: timestamp("filledAt"),
  /** Price at which the order was actually filled */
  filledPrice: decimal("filledPrice", { precision: 8, scale: 4 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Comments table - StockTwits-style trade sentiment feed.
 */
export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 10 }),
  content: text("content").notNull(),
  sentiment: mysqlEnum("sentiment", ["bullish", "bearish", "neutral"]).default("neutral").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

/**
 * News table - AI-generated meme news headlines from match results.
 */
export const news = mysqlTable("news", {
  id: int("id").autoincrement().primaryKey(),
  headline: varchar("headline", { length: 500 }).notNull(),
  body: text("body"),
  /** Match ID from Riot API that triggered this news */
  matchId: varchar("matchId", { length: 64 }),
  /** Whether the player won the match */
  isWin: boolean("isWin"),
  /** Champion played */
  champion: varchar("champion", { length: 32 }),
  /** KDA string */
  kda: varchar("kda", { length: 32 }),
  /** Price impact */
  priceChange: decimal("priceChange", { precision: 8, scale: 4 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type News = typeof news.$inferSelect;
export type InsertNews = typeof news.$inferInsert;

/**
 * Dividends table - tracks dividend payouts to users.
 * DORI/DDRI/TDRI holders get dividends on player wins.
 * SDRI/XDRI holders get dividends on player losses.
 */
export const dividends = mysqlTable("dividends", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  shares: decimal("shares", { precision: 12, scale: 4 }).notNull(),
  /** Dividend per share */
  dividendPerShare: decimal("dividendPerShare", { precision: 8, scale: 4 }).notNull(),
  /** Total payout */
  totalPayout: decimal("totalPayout", { precision: 12, scale: 2 }).notNull(),
  /** Reason: win or loss */
  reason: varchar("reason", { length: 100 }).notNull(),
  /** Related match ID */
  matchId: varchar("matchId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Dividend = typeof dividends.$inferSelect;
export type InsertDividend = typeof dividends.$inferInsert;

/**
 * Matches table - stores processed match results for news generation.
 * Prevents duplicate processing of the same match.
 */
export const matches = mysqlTable("matches", {
  id: int("id").autoincrement().primaryKey(),
  matchId: varchar("matchId", { length: 64 }).notNull().unique(),
  win: boolean("win").notNull(),
  champion: varchar("champion", { length: 32 }).notNull(),
  kills: int("kills").notNull(),
  deaths: int("deaths").notNull(),
  assists: int("assists").notNull(),
  cs: int("cs").notNull().default(0),
  position: varchar("position", { length: 16 }),
  gameDuration: int("gameDuration").notNull(),
  /** Price before this match */
  priceBefore: decimal("priceBefore", { precision: 8, scale: 4 }),
  /** Price after this match */
  priceAfter: decimal("priceAfter", { precision: 8, scale: 4 }),
  /** Whether dividends were distributed for this match */
  dividendsPaid: boolean("dividendsPaid").notNull().default(false),
  /** Whether news was generated for this match */
  newsGenerated: boolean("newsGenerated").notNull().default(false),
  gameCreation: bigint("gameCreation", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;

/**
 * Market status table - tracks whether the market is open or closed.
 */
export const marketStatus = mysqlTable("marketStatus", {
  id: int("id").autoincrement().primaryKey(),
  isOpen: boolean("isOpen").notNull().default(false),
  /** Reason for current status */
  reason: varchar("reason", { length: 200 }),
  /** Last time the player was seen in a game */
  lastActivity: timestamp("lastActivity"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MarketStatus = typeof marketStatus.$inferSelect;

/**
 * Price history table - stores LP snapshots over time for charting.
 */
export const priceHistory = mysqlTable("priceHistory", {
  id: int("id").autoincrement().primaryKey(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  tier: varchar("tier", { length: 20 }).notNull(),
  division: varchar("division", { length: 5 }).notNull(),
  lp: int("lp").notNull(),
  totalLP: int("totalLP").notNull(),
  price: decimal("price", { precision: 8, scale: 4 }).notNull(),
  wins: int("wins"),
  losses: int("losses"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = typeof priceHistory.$inferInsert;

/**
 * Portfolio snapshots - records portfolio value over time for P&L charting.
 * Recorded during each poll cycle for every user with a portfolio.
 */
export const portfolioSnapshots = mysqlTable("portfolioSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  totalValue: decimal("totalValue", { precision: 12, scale: 2 }).notNull(),
  cashBalance: decimal("cashBalance", { precision: 12, scale: 2 }).notNull(),
  holdingsValue: decimal("holdingsValue", { precision: 12, scale: 2 }).notNull(),
  shortPnl: decimal("shortPnl", { precision: 12, scale: 2 }).notNull().default("0.00"),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type InsertPortfolioSnapshot = typeof portfolioSnapshots.$inferInsert;

/**
 * Notifications table - tracks order fills, dividends, and other events.
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["order_filled", "stop_loss_triggered", "dividend_received", "system"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  /** Related entity ID (orderId, dividendId, etc.) */
  relatedId: int("relatedId"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
