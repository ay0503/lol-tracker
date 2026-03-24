import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
 * Portfolio table - tracks each user's cash balance and DORI share holdings.
 * Every new user starts with $200 cash and 0 shares.
 */
export const portfolios = mysqlTable("portfolios", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  cashBalance: decimal("cashBalance", { precision: 12, scale: 2 }).notNull().default("200.00"),
  sharesOwned: decimal("sharesOwned", { precision: 12, scale: 4 }).notNull().default("0.0000"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = typeof portfolios.$inferInsert;

/**
 * Trades table - records every buy/sell transaction.
 */
export const trades = mysqlTable("trades", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["buy", "sell"]).notNull(),
  shares: decimal("shares", { precision: 12, scale: 4 }).notNull(),
  pricePerShare: decimal("pricePerShare", { precision: 12, scale: 2 }).notNull(),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;
