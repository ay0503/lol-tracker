import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  getOrCreatePortfolio: vi.fn(),
  executeTrade: vi.fn(),
  getUserTrades: vi.fn(),
}));

import { getOrCreatePortfolio, executeTrade, getUserTrades } from "./db";

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

  it("returns portfolio for authenticated user", async () => {
    const mockPortfolio = {
      id: 1,
      userId: 1,
      cashBalance: "200.00",
      sharesOwned: "0.0000",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (getOrCreatePortfolio as any).mockResolvedValue(mockPortfolio);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trading.portfolio();

    expect(result).toEqual({
      cashBalance: 200,
      sharesOwned: 0,
    });
    expect(getOrCreatePortfolio).toHaveBeenCalledWith(1);
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

  it("executes a buy trade", async () => {
    const mockUpdatedPortfolio = {
      id: 1,
      userId: 1,
      cashBalance: "100.00",
      sharesOwned: "0.4184",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (executeTrade as any).mockResolvedValue(mockUpdatedPortfolio);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trading.trade({
      type: "buy",
      shares: 0.4184,
      pricePerShare: 239,
    });

    expect(result).toEqual({
      cashBalance: 100,
      sharesOwned: 0.4184,
    });
    expect(executeTrade).toHaveBeenCalledWith(1, "buy", 0.4184, 239);
  });

  it("executes a sell trade", async () => {
    const mockUpdatedPortfolio = {
      id: 1,
      userId: 1,
      cashBalance: "300.00",
      sharesOwned: "0.0000",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (executeTrade as any).mockResolvedValue(mockUpdatedPortfolio);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trading.trade({
      type: "sell",
      shares: 0.4184,
      pricePerShare: 239,
    });

    expect(result).toEqual({
      cashBalance: 300,
      sharesOwned: 0,
    });
    expect(executeTrade).toHaveBeenCalledWith(1, "sell", 0.4184, 239);
  });

  it("rejects invalid share amounts", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.trading.trade({
        type: "buy",
        shares: -1,
        pricePerShare: 239,
      })
    ).rejects.toThrow();
  });
});

describe("trading.history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns trade history for authenticated user", async () => {
    const mockTrades = [
      {
        id: 1,
        userId: 1,
        type: "buy" as const,
        shares: "0.4184",
        pricePerShare: "239.00",
        totalAmount: "100.00",
        createdAt: new Date("2026-03-23T10:00:00Z"),
      },
    ];

    (getUserTrades as any).mockResolvedValue(mockTrades);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trading.history();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 1,
      type: "buy",
      shares: 0.4184,
      pricePerShare: 239,
      totalAmount: 100,
      createdAt: new Date("2026-03-23T10:00:00Z"),
    });
    expect(getUserTrades).toHaveBeenCalledWith(1);
  });
});
