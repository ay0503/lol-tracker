import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  getOrCreatePortfolio: vi.fn(),
  getUserHoldings: vi.fn(),
  executeTrade: vi.fn(),
  getUserTrades: vi.fn(),
  getAllTrades: vi.fn(),
  getPriceHistory: vi.fn(),
  getLatestPrice: vi.fn(),
  addPriceSnapshot: vi.fn(),
}));

// Mock the riotApi module
vi.mock("./riotApi", () => ({
  fetchFullPlayerData: vi.fn(),
  fetchRecentMatches: vi.fn(),
  tierToPrice: vi.fn(),
  tierToTotalLP: vi.fn(),
}));

import {
  getOrCreatePortfolio,
  getUserHoldings,
  executeTrade,
  getUserTrades,
  getAllTrades,
  getPriceHistory,
  getLatestPrice,
} from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test Trader",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("trading.portfolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns portfolio with holdings for authenticated user", async () => {
    const mockPortfolio = {
      id: 1,
      userId: 1,
      cashBalance: "200.00",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockHoldings = [
      { ticker: "DORI", shares: "1.5000", avgCostBasis: "55.00" },
      { ticker: "SDRI", shares: "2.0000", avgCostBasis: "60.00" },
    ];

    (getOrCreatePortfolio as any).mockResolvedValue(mockPortfolio);
    (getUserHoldings as any).mockResolvedValue(mockHoldings);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trading.portfolio();

    expect(result.cashBalance).toBe(200);
    expect(result.holdings).toHaveLength(2);
    expect(result.holdings[0]).toEqual({
      ticker: "DORI",
      shares: 1.5,
      avgCostBasis: 55,
    });
    expect(result.holdings[1]).toEqual({
      ticker: "SDRI",
      shares: 2,
      avgCostBasis: 60,
    });
    expect(getOrCreatePortfolio).toHaveBeenCalledWith(1);
    expect(getUserHoldings).toHaveBeenCalledWith(1);
  });

  it("returns empty holdings for new user", async () => {
    const mockPortfolio = {
      id: 1,
      userId: 1,
      cashBalance: "200.00",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (getOrCreatePortfolio as any).mockResolvedValue(mockPortfolio);
    (getUserHoldings as any).mockResolvedValue([]);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trading.portfolio();

    expect(result.cashBalance).toBe(200);
    expect(result.holdings).toHaveLength(0);
  });

  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.trading.portfolio()).rejects.toThrow();
  });
});

describe("trading.trade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes a buy trade with ticker", async () => {
    const mockResult = {
      portfolio: { cashBalance: "100.00" },
      holding: { shares: "1.6100" },
    };

    (executeTrade as any).mockResolvedValue(mockResult);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trading.trade({
      ticker: "DORI",
      type: "buy",
      shares: 1.61,
      pricePerShare: 62.28,
    });

    expect(result).toEqual({
      cashBalance: 100,
      sharesOwned: 1.61,
      ticker: "DORI",
    });
    expect(executeTrade).toHaveBeenCalledWith(1, "DORI", "buy", 1.61, 62.28);
  });

  it("executes a sell trade for leveraged ETF", async () => {
    const mockResult = {
      portfolio: { cashBalance: "300.00" },
      holding: { shares: "0.0000" },
    };

    (executeTrade as any).mockResolvedValue(mockResult);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trading.trade({
      ticker: "DDRI",
      type: "sell",
      shares: 1.5,
      pricePerShare: 66.67,
    });

    expect(result).toEqual({
      cashBalance: 300,
      sharesOwned: 0,
      ticker: "DDRI",
    });
    expect(executeTrade).toHaveBeenCalledWith(1, "DDRI", "sell", 1.5, 66.67);
  });

  it("rejects invalid share amounts", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.trading.trade({
        ticker: "DORI",
        type: "buy",
        shares: -1,
        pricePerShare: 62.28,
      })
    ).rejects.toThrow();
  });

  it("rejects invalid ticker", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.trading.trade({
        ticker: "INVALID" as any,
        type: "buy",
        shares: 1,
        pricePerShare: 50,
      })
    ).rejects.toThrow();
  });
});

describe("trading.history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns trade history with ticker field", async () => {
    const mockTrades = [
      {
        id: 1,
        userId: 1,
        ticker: "DORI",
        type: "buy" as const,
        shares: "1.6100",
        pricePerShare: "62.28",
        totalAmount: "100.27",
        createdAt: new Date("2026-03-23T10:00:00Z"),
      },
      {
        id: 2,
        userId: 1,
        ticker: "SDRI",
        type: "buy" as const,
        shares: "0.5000",
        pricePerShare: "55.00",
        totalAmount: "27.50",
        createdAt: new Date("2026-03-23T11:00:00Z"),
      },
    ];

    (getUserTrades as any).mockResolvedValue(mockTrades);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trading.history();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 1,
      ticker: "DORI",
      type: "buy",
      shares: 1.61,
      pricePerShare: 62.28,
      totalAmount: 100.27,
      createdAt: new Date("2026-03-23T10:00:00Z"),
    });
    expect(result[1].ticker).toBe("SDRI");
    expect(getUserTrades).toHaveBeenCalledWith(1, 50);
  });
});

describe("ledger.all", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all trades from all users (public)", async () => {
    const mockTrades = [
      {
        id: 1,
        userName: "Test Trader",
        ticker: "DORI",
        type: "buy" as const,
        shares: "1.0000",
        pricePerShare: "62.28",
        totalAmount: "62.28",
        createdAt: new Date("2026-03-23T10:00:00Z"),
      },
    ];

    (getAllTrades as any).mockResolvedValue(mockTrades);

    // Ledger is public, so unauthenticated users can access it
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ledger.all();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 1,
      userName: "Test Trader",
      ticker: "DORI",
      type: "buy",
      shares: 1,
      pricePerShare: 62.28,
      totalAmount: 62.28,
      createdAt: new Date("2026-03-23T10:00:00Z"),
    });
    expect(getAllTrades).toHaveBeenCalledWith(100);
  });
});

describe("prices.etfPrices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates ETF prices from base DORI price", async () => {
    const mockHistory = [
      { price: "60.00", timestamp: Date.now() - 86400000 },
      { price: "62.28", timestamp: Date.now() },
    ];

    (getPriceHistory as any).mockResolvedValue(mockHistory);

    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.prices.etfPrices();

    expect(result).toHaveLength(5);

    // DORI should be the current price
    const dori = result.find((r) => r.ticker === "DORI");
    expect(dori?.price).toBe(62.28);

    // DDRI (2x leveraged) should amplify the gain
    const ddri = result.find((r) => r.ticker === "DDRI");
    expect(ddri?.price).toBeGreaterThan(62.28);

    // SDRI (2x inverse) should go opposite direction
    const sdri = result.find((r) => r.ticker === "SDRI");
    expect(sdri?.price).toBeLessThan(62.28);
  });

  it("returns empty array when no price history", async () => {
    (getPriceHistory as any).mockResolvedValue([]);

    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.prices.etfPrices();

    expect(result).toEqual([]);
  });
});
