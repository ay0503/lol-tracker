/**
 * Integration tests for critical db.ts functions.
 * Uses a real in-memory SQLite DB with schema applied.
 * Tests: executeTrade, executeShort, executeCover, placeBet, resolveBets, distributeDividends.
 */
import { describe, expect, it, beforeAll, beforeEach, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

// Create in-memory DB and mock the module-level singletons
const rawClient = createClient({ url: ":memory:" });
const db = drizzle(rawClient);

vi.mock("./_core/env", () => ({
  ENV: { databasePath: ":memory:", cookieSecret: "test", isProduction: false, openaiApiUrl: "", openaiApiKey: "" },
}));

// Override the db module's internal singletons
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDb: () => db,
    getDbSync: () => db,
    getRawClient: () => rawClient,
  };
});

import {
  getOrCreatePortfolio,
  executeTrade,
  executeShort,
  executeCover,
  placeBet,
  resolveBets,
  getRubberBandMultiplier,
  distributeDividends,
} from "./db";

// ─── Schema Setup ───

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    openId TEXT NOT NULL UNIQUE,
    name TEXT,
    displayName TEXT,
    email TEXT UNIQUE,
    passwordHash TEXT,
    loginMethod TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    lastSignedIn TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS portfolios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL UNIQUE,
    cashBalance TEXT NOT NULL DEFAULT '200.00',
    casinoBalance TEXT NOT NULL DEFAULT '20.00',
    totalDividends TEXT NOT NULL DEFAULT '0.00',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    shares TEXT NOT NULL DEFAULT '0.0000',
    avgCostBasis TEXT NOT NULL DEFAULT '0.0000',
    shortShares TEXT NOT NULL DEFAULT '0.0000',
    shortAvgPrice TEXT NOT NULL DEFAULT '0.0000',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    ticker TEXT NOT NULL DEFAULT 'DORI',
    type TEXT NOT NULL,
    shares TEXT NOT NULL,
    pricePerShare TEXT NOT NULL,
    totalAmount TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    prediction TEXT NOT NULL,
    amount TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    matchId TEXT,
    payout TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS dividends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    shares TEXT NOT NULL,
    dividendPerShare TEXT NOT NULL,
    totalPayout TEXT NOT NULL,
    reason TEXT NOT NULL,
    matchId TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    relatedId INTEGER,
    read INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

beforeAll(async () => {
  await rawClient.executeMultiple(SCHEMA_SQL);
  // Create test user
  await rawClient.execute({
    sql: `INSERT INTO users (openId, name, email, role) VALUES (?, ?, ?, ?)`,
    args: ["test-1", "Trader", "trader@test.com", "user"],
  });
});

beforeEach(async () => {
  // Reset portfolio, holdings, trades, bets for clean state
  await rawClient.executeMultiple(`
    DELETE FROM portfolios;
    DELETE FROM holdings;
    DELETE FROM trades;
    DELETE FROM bets;
    DELETE FROM dividends;
    DELETE FROM notifications;
  `);
});

// ─── executeTrade ───

describe("executeTrade (integration)", () => {
  it("buy: deducts cash, creates holding with correct avgCostBasis", async () => {
    const result = await executeTrade(1, "DORI", "buy", 2, 50);
    expect(parseFloat(result.portfolio.cashBalance)).toBeCloseTo(100, 1); // 200 - 100
    expect(parseFloat(result.holding.shares)).toBeCloseTo(2, 3);
    expect(parseFloat(result.holding.avgCostBasis)).toBeCloseTo(50, 3);
  });

  it("buy: weighted average cost basis on second buy", async () => {
    await executeTrade(1, "DORI", "buy", 2, 50); // 2 shares @ $50
    const result = await executeTrade(1, "DORI", "buy", 2, 60); // 2 more @ $60
    // avgCost = (50*2 + 60*2) / 4 = 220/4 = 55
    expect(parseFloat(result.holding.avgCostBasis)).toBeCloseTo(55, 2);
    expect(parseFloat(result.holding.shares)).toBeCloseTo(4, 3);
    expect(parseFloat(result.portfolio.cashBalance)).toBeCloseTo(200 - 100 - 120, 1);
  });

  it("buy: throws on insufficient funds", async () => {
    await expect(executeTrade(1, "DORI", "buy", 100, 50)).rejects.toThrow("Insufficient funds");
  });

  it("buy: exact cash amount succeeds (cash becomes 0)", async () => {
    const result = await executeTrade(1, "DORI", "buy", 4, 50); // 4 * 50 = 200 exactly
    expect(parseFloat(result.portfolio.cashBalance)).toBeCloseTo(0, 1);
  });

  it("sell: adds cash, reduces shares", async () => {
    await executeTrade(1, "DORI", "buy", 4, 50);
    const result = await executeTrade(1, "DORI", "sell", 2, 60);
    expect(parseFloat(result.portfolio.cashBalance)).toBeCloseTo(0 + 120, 1); // 0 + 2*60
    expect(parseFloat(result.holding.shares)).toBeCloseTo(2, 3);
    // avgCostBasis should NOT change on sell
    expect(parseFloat(result.holding.avgCostBasis)).toBeCloseTo(50, 3);
  });

  it("sell: throws on insufficient shares", async () => {
    await executeTrade(1, "DORI", "buy", 2, 50);
    await expect(executeTrade(1, "DORI", "sell", 5, 50)).rejects.toThrow("Insufficient shares");
  });

  it("sell all shares: holding remains with 0 shares", async () => {
    await executeTrade(1, "DORI", "buy", 2, 50);
    const result = await executeTrade(1, "DORI", "sell", 2, 55);
    expect(parseFloat(result.holding.shares)).toBe(0);
    expect(parseFloat(result.portfolio.cashBalance)).toBeCloseTo(200 - 100 + 110, 1);
  });

  it("records trade in trades table", async () => {
    await executeTrade(1, "DORI", "buy", 1, 50);
    const rows = await rawClient.execute(`SELECT * FROM trades WHERE userId = 1`);
    expect(rows.rows.length).toBe(1);
    const row = rows.rows[0] as any;
    expect(row.type).toBe("buy");
    expect(row.ticker).toBe("DORI");
  });
});

// ─── executeShort ───

describe("executeShort (integration)", () => {
  it("deducts 50% margin, creates short position", async () => {
    const result = await executeShort(1, "DORI", 2, 50);
    // margin = 2*50*0.5 = 50
    expect(parseFloat(result.portfolio.cashBalance)).toBeCloseTo(150, 1);
    expect(parseFloat(result.holding.shortShares)).toBeCloseTo(2, 3);
    expect(parseFloat(result.holding.shortAvgPrice)).toBeCloseTo(50, 3);
  });

  it("weighted average on adding to short", async () => {
    await executeShort(1, "DORI", 2, 50); // 2 @ $50, margin = $50
    const result = await executeShort(1, "DORI", 2, 60); // 2 @ $60, margin = $60
    // shortAvg = (50*2 + 60*2) / 4 = 55
    expect(parseFloat(result.holding.shortAvgPrice)).toBeCloseTo(55, 2);
    expect(parseFloat(result.holding.shortShares)).toBeCloseTo(4, 3);
    // cash = 200 - 50 - 60 = 90
    expect(parseFloat(result.portfolio.cashBalance)).toBeCloseTo(90, 1);
  });

  it("throws on insufficient margin", async () => {
    // Need margin = 100*50*0.5 = 2500, but only have $200
    await expect(executeShort(1, "DORI", 100, 50)).rejects.toThrow("Insufficient margin");
  });
});

// ─── executeCover ───

describe("executeCover (integration)", () => {
  it("profitable cover: price dropped, user gains", async () => {
    await executeShort(1, "DORI", 2, 100); // short at $100, margin = $100, cash = $100
    const result = await executeCover(1, "DORI", 2, 80); // cover at $80 (price dropped)
    // marginReturn = 2 * 100 * 0.5 = 100
    // saleProceeds = 2 * 100 = 200
    // totalCost = 2 * 80 = 160
    // newCash = 100 + 100 + 200 - 160 = 240
    expect(parseFloat(result.portfolio.cashBalance)).toBeCloseTo(240, 1);
    expect(parseFloat(result.holding.shortShares)).toBe(0);
  });

  it("losing cover: price rose, user loses", async () => {
    await executeShort(1, "DORI", 2, 50); // short at $50, margin = $50, cash = $150
    const result = await executeCover(1, "DORI", 2, 60); // cover at $60 (price rose)
    // marginReturn = 2 * 50 * 0.5 = 50
    // saleProceeds = 2 * 50 = 100
    // totalCost = 2 * 60 = 120
    // newCash = 150 + 50 + 100 - 120 = 180
    expect(parseFloat(result.portfolio.cashBalance)).toBeCloseTo(180, 1);
  });

  it("break-even cover: same price, only margin returned", async () => {
    await executeShort(1, "DORI", 2, 50); // cash = $150
    const result = await executeCover(1, "DORI", 2, 50); // cover at same price
    // marginReturn = 50, saleProceeds = 100, totalCost = 100
    // newCash = 150 + 50 + 100 - 100 = 200
    expect(parseFloat(result.portfolio.cashBalance)).toBeCloseTo(200, 1);
  });

  it("throws when covering more than shorted", async () => {
    await executeShort(1, "DORI", 2, 50);
    await expect(executeCover(1, "DORI", 5, 50)).rejects.toThrow("Cannot cover more");
  });

  it("throws when cover results in negative cash (trapped position)", async () => {
    // Short 4 @ $50, margin = $100, cash = $100
    await executeShort(1, "DORI", 4, 50);
    // Cover at $200 → totalCost = 800, marginReturn = 100, saleProceeds = 200
    // newCash = 100 + 100 + 200 - 800 = -400 → throws
    await expect(executeCover(1, "DORI", 4, 200)).rejects.toThrow("Insufficient funds to cover");
  });
});

// ─── placeBet + resolveBets ───

describe("placeBet + resolveBets (integration)", () => {
  it("placeBet deducts from cash", async () => {
    const bet = await placeBet(1, "win", 25);
    expect(bet.prediction).toBe("win");
    expect(bet.status).toBe("pending");

    const portfolio = await rawClient.execute(`SELECT cashBalance FROM portfolios WHERE userId = 1`);
    expect(parseFloat(String((portfolio.rows[0] as any).cashBalance))).toBeCloseTo(175, 1);
  });

  it("placeBet throws on duplicate pending bet", async () => {
    await placeBet(1, "win", 10);
    await expect(placeBet(1, "loss", 10)).rejects.toThrow("pending bet");
  });

  it("placeBet throws on insufficient cash", async () => {
    await expect(placeBet(1, "win", 999)).rejects.toThrow("Insufficient cash");
  });

  it("resolveBets: correct WIN prediction gets 2x payout", async () => {
    await placeBet(1, "win", 50);
    const resolved = await resolveBets("match-1", true); // player won
    expect(resolved).toBe(1);

    const portfolio = await rawClient.execute(`SELECT cashBalance FROM portfolios WHERE userId = 1`);
    // Started 200, bet 50 (→150), won 100 (→250)
    expect(parseFloat(String((portfolio.rows[0] as any).cashBalance))).toBeCloseTo(250, 1);
  });

  it("resolveBets: incorrect prediction, no payout", async () => {
    await placeBet(1, "win", 50);
    const resolved = await resolveBets("match-2", false); // player lost
    expect(resolved).toBe(1);

    const portfolio = await rawClient.execute(`SELECT cashBalance FROM portfolios WHERE userId = 1`);
    // 200 - 50 = 150, no refund
    expect(parseFloat(String((portfolio.rows[0] as any).cashBalance))).toBeCloseTo(150, 1);
  });

  it("resolveBets: bet on LOSS and player loses = correct prediction", async () => {
    await placeBet(1, "loss", 30);
    const resolved = await resolveBets("match-3", false);
    expect(resolved).toBe(1);

    const portfolio = await rawClient.execute(`SELECT cashBalance FROM portfolios WHERE userId = 1`);
    // 200 - 30 + 60 = 230
    expect(parseFloat(String((portfolio.rows[0] as any).cashBalance))).toBeCloseTo(230, 1);
  });

  it("resolveBets with no pending bets returns 0", async () => {
    const resolved = await resolveBets("match-4", true);
    expect(resolved).toBe(0);
  });
});
