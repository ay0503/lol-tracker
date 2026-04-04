import { describe, expect, it, vi, beforeEach } from "vitest";
import { getRubberBandMultiplier } from "./db";
import { cache } from "./cache";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mocks ───

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getOrCreatePortfolio: vi.fn(),
    getUserHoldings: vi.fn(),
    executeTrade: vi.fn(),
    executeShort: vi.fn(),
    executeCover: vi.fn(),
    getUserTrades: vi.fn(),
    getAllTrades: vi.fn(),
    getPriceHistory: vi.fn(),
    getLatestPrice: vi.fn(),
    getMarketStatus: vi.fn(),
    createOrder: vi.fn(),
    getUserOrders: vi.fn(),
    cancelOrder: vi.fn(),
    postComment: vi.fn(),
    getComments: vi.fn(),
    getNews: vi.fn(),
    getUserDividends: vi.fn(),
    getLeaderboard: vi.fn(),
    placeBet: vi.fn(),
    getPendingBets: vi.fn(),
    updateDisplayName: vi.fn(),
  };
});

vi.mock("./riotApi", () => ({
  fetchFullPlayerData: vi.fn(),
  fetchRecentMatches: vi.fn(),
  tierToPrice: vi.fn(),
  tierToTotalLP: vi.fn(),
}));

vi.mock("./pollEngine", () => ({
  pollNow: vi.fn(),
  getPollStatus: vi.fn(),
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
}));

import {
  getOrCreatePortfolio,
  getUserHoldings,
  executeTrade,
  executeShort,
  executeCover,
  getMarketStatus,
  getPriceHistory,
  placeBet,
} from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1, openId: "test", email: "test@test.com", name: "Trader",
    loginMethod: "email", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── getRubberBandMultiplier (pure) ───

describe("getRubberBandMultiplier", () => {
  it("portfolio < $50 returns 3x", () => {
    expect(getRubberBandMultiplier(25)).toBe(3);
    expect(getRubberBandMultiplier(49.99)).toBe(3);
  });

  it("portfolio $50-$99 returns 2x", () => {
    expect(getRubberBandMultiplier(50)).toBe(2);
    expect(getRubberBandMultiplier(99)).toBe(2);
  });

  it("portfolio $100-$149 returns 1.5x", () => {
    expect(getRubberBandMultiplier(100)).toBe(1.5);
    expect(getRubberBandMultiplier(149)).toBe(1.5);
  });

  it("portfolio $150-$250 returns 1x", () => {
    expect(getRubberBandMultiplier(150)).toBe(1);
    expect(getRubberBandMultiplier(200)).toBe(1);
    expect(getRubberBandMultiplier(250)).toBe(1);
  });

  it("portfolio $251-$400 returns 0.75x", () => {
    expect(getRubberBandMultiplier(251)).toBe(0.75);
    expect(getRubberBandMultiplier(400)).toBe(0.75);
  });

  it("portfolio > $400 returns 0.5x", () => {
    expect(getRubberBandMultiplier(401)).toBe(0.5);
    expect(getRubberBandMultiplier(1000)).toBe(0.5);
  });
});

// ─── Trade Route Validations ───

describe("trading.trade route validations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.invalidateAll();

    (getMarketStatus as any).mockResolvedValue({ isOpen: true, adminHalt: false });
    (getOrCreatePortfolio as any).mockResolvedValue({
      cashBalance: "200.00", casinoBalance: "20.00", totalDividends: "0.00",
    });
    (getUserHoldings as any).mockResolvedValue([]);
    (executeTrade as any).mockResolvedValue({
      portfolio: { cashBalance: "150.00" },
      holding: { shares: "1.0000", avgCostBasis: "50.0000" },
    });
  });

  it("blocks trade during live game", async () => {
    cache.set("player.liveGame.check", true, 60_000);
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.trading.trade({ ticker: "DORI", type: "buy", shares: 1, price: 50 })
    ).rejects.toThrow(/live game/i);
  });

  it("blocks trade during admin halt", async () => {
    (getMarketStatus as any).mockResolvedValue({ isOpen: true, adminHalt: true });
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.trading.trade({ ticker: "DORI", type: "buy", shares: 1, price: 50 })
    ).rejects.toThrow();
  });

  it("rejects trade when price changed > 0.5%", async () => {
    // Cache server price at $50, submit $50.30 (0.6% diff)
    cache.set("prices.etfPrices", { DORI: 50, DDRI: 50, TDRI: 50, SDRI: 50, XDRI: 50 }, 60_000);
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.trading.trade({ ticker: "DORI", type: "buy", shares: 1, price: 50.30 })
    ).rejects.toThrow(/price/i);
  });

  it("accepts trade when price within 0.5%", async () => {
    cache.set("prices.etfPrices", { DORI: 50, DDRI: 50, TDRI: 50, SDRI: 50, XDRI: 50 }, 60_000);
    (getPriceHistory as any).mockResolvedValue([{ price: "50.00", timestamp: Date.now() }]);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.trading.trade({ ticker: "DORI", type: "buy", shares: 1, price: 50.20 });
    expect(result).toBeDefined();
  });

  it("allows sell during open market", async () => {
    cache.set("prices.etfPrices", { DORI: 50, DDRI: 50, TDRI: 50, SDRI: 50, XDRI: 50 }, 60_000);
    (getPriceHistory as any).mockResolvedValue([{ price: "50.00", timestamp: Date.now() }]);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.trading.trade({ ticker: "DORI", type: "sell", shares: 1, price: 50 });
    expect(executeTrade).toHaveBeenCalled();
  });
});

// ─── Short/Cover Route Validations ───

describe("trading.short route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.invalidateAll();
    (getMarketStatus as any).mockResolvedValue({ isOpen: true, adminHalt: false });
    (getOrCreatePortfolio as any).mockResolvedValue({ cashBalance: "200.00", casinoBalance: "20.00", totalDividends: "0.00" });
    (getUserHoldings as any).mockResolvedValue([]);
    (executeShort as any).mockResolvedValue({
      portfolio: { cashBalance: "175.00" },
      holding: { shortShares: "1.0000", shortAvgPrice: "50.0000" },
    });
  });

  it("blocks short during live game", async () => {
    cache.set("player.liveGame.check", true, 60_000);
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.trading.short({ ticker: "DORI", shares: 1, price: 50 })
    ).rejects.toThrow(/live game/i);
  });

  it("allows short when market is open", async () => {
    cache.set("prices.etfPrices", { DORI: 50, DDRI: 50, TDRI: 50, SDRI: 50, XDRI: 50 }, 60_000);
    (getPriceHistory as any).mockResolvedValue([{ price: "50.00", timestamp: Date.now() }]);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.trading.short({ ticker: "DORI", shares: 1, price: 50 });
    expect(executeShort).toHaveBeenCalled();
  });
});

describe("trading.cover route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.invalidateAll();
    (getMarketStatus as any).mockResolvedValue({ isOpen: true, adminHalt: false });
    (getOrCreatePortfolio as any).mockResolvedValue({ cashBalance: "200.00", casinoBalance: "20.00", totalDividends: "0.00" });
    (getUserHoldings as any).mockResolvedValue([]);
    (executeCover as any).mockResolvedValue({
      portfolio: { cashBalance: "210.00" },
      holding: { shortShares: "0.0000", shortAvgPrice: "0.0000" },
    });
  });

  it("blocks cover during live game", async () => {
    cache.set("player.liveGame.check", true, 60_000);
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.trading.cover({ ticker: "DORI", shares: 1, price: 50 })
    ).rejects.toThrow(/live game/i);
  });

  it("allows cover when market is open", async () => {
    cache.set("prices.etfPrices", { DORI: 50, DDRI: 50, TDRI: 50, SDRI: 50, XDRI: 50 }, 60_000);
    (getPriceHistory as any).mockResolvedValue([{ price: "50.00", timestamp: Date.now() }]);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.trading.cover({ ticker: "DORI", shares: 1, price: 50 });
    expect(executeCover).toHaveBeenCalled();
  });
});

// ─── Betting Route ───

describe("betting.place route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.invalidateAll();
    (getOrCreatePortfolio as any).mockResolvedValue({ cashBalance: "200.00", casinoBalance: "20.00", totalDividends: "0.00" });
    (getUserHoldings as any).mockResolvedValue([]);
    (placeBet as any).mockResolvedValue({ id: 1, prediction: "win", amount: "10.00", status: "pending" });
  });

  it("allows bet when no live game", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.betting.place({ prediction: "win", amount: 10 });
    expect(placeBet).toHaveBeenCalled();
  });

  it("allows bet in first 5 minutes of game", async () => {
    cache.set("player.liveGame.check", true, 60_000);
    cache.set("player.liveGame.details", {
      inGame: true,
      gameStartTime: Date.now() / 1000 - 60, // started 1 min ago
      gameLengthSeconds: 60,
    }, 60_000);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.betting.place({ prediction: "win", amount: 10 });
    expect(placeBet).toHaveBeenCalled();
  });

  it("placeBet error wraps as TRPCError", async () => {
    (placeBet as any).mockRejectedValue(new Error("You already have a pending bet"));
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.betting.place({ prediction: "win", amount: 10 })
    ).rejects.toThrow(/pending bet/i);
  });
});
