import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getOrCreatePortfolio: vi.fn(),
  getUserHoldings: vi.fn(),
  executeTrade: vi.fn(),
  executeShort: vi.fn(),
  executeCover: vi.fn(),
  postComment: vi.fn(),
  getRecentMatchesFromDB: vi.fn(),
  getPriceHistory: vi.fn(),
  getLatestPrice: vi.fn(),
  getDb: vi.fn(),
}));

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// Mock the env module
vi.mock("./_core/env", () => ({
  ENV: {
    openaiApiUrl: "https://api.example.com",
    openaiApiKey: "test-key",
    databasePath: "./test.db",
  },
}));

// Mock the cache module
vi.mock("./cache", () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    getOrSet: vi.fn(),
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
  },
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(),
  and: vi.fn(),
  ne: vi.fn(),
}));

import {
  getOrCreatePortfolio,
  getUserHoldings,
  executeTrade,
  executeShort,
  executeCover,
  postComment,
  getRecentMatchesFromDB,
  getPriceHistory,
  getLatestPrice,
  getDb,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { cache } from "./cache";

// Import after mocks
import { runBotTrader, resetBotCycleCount, forceRunBot, ensureBotUser, getBotUserId } from "./botTrader";

// Helper to create mock DB
function createMockDb() {
  const mockSelect = vi.fn().mockReturnThis();
  const mockFrom = vi.fn().mockReturnThis();
  const mockWhere = vi.fn().mockReturnThis();
  const mockLimit = vi.fn();
  const mockInsert = vi.fn().mockReturnThis();
  const mockValues = vi.fn().mockResolvedValue(undefined);

  return {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    insert: mockInsert,
    values: mockValues,
    _mockLimit: mockLimit,
    _mockValues: mockValues,
  };
}

describe("Bot Trader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBotCycleCount();
  });

  describe("runBotTrader cycle counting", () => {
    it("should skip when not on 5th cycle", async () => {
      // Cycle 1 — should skip
      const result = await runBotTrader();
      expect(result).toBe(false);
    });

    it("should run on 5th cycle", async () => {
      // Set up mocks for a successful run
      const mockDb = createMockDb();
      mockDb._mockLimit.mockResolvedValue([{ id: 1, openId: "bot_quanttrader_001" }]);
      (getDb as any).mockResolvedValue(mockDb);
      (cache.get as any).mockReturnValue(false); // not in game

      (getOrCreatePortfolio as any).mockResolvedValue({
        cashBalance: "200.00",
        totalDividends: "0.00",
      });
      (getUserHoldings as any).mockResolvedValue([]);
      (getRecentMatchesFromDB as any).mockResolvedValue([]);
      (getPriceHistory as any).mockResolvedValue([
        { timestamp: 1000, price: "50.00" },
        { timestamp: 2000, price: "50.50" },
        { timestamp: 3000, price: "51.00" },
      ]);
      (getLatestPrice as any).mockResolvedValue({
        tier: "EMERALD",
        division: "II",
        lp: 45,
        price: "51.00",
      });

      // Mock LLM response
      (invokeLLM as any).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: "buy",
              ticker: "DORI",
              amount: 30,
              reasoning: "Positive momentum detected. Allocating to DORI.",
              sentiment: "bullish",
              confidence: 65,
            }),
          },
        }],
      });

      (executeTrade as any).mockResolvedValue({
        portfolio: { cashBalance: "170.00" },
        holding: { shares: "0.5882" },
      });
      (postComment as any).mockResolvedValue(undefined);

      // Run 5 cycles
      for (let i = 0; i < 4; i++) {
        await runBotTrader();
      }
      const result = await runBotTrader(); // 5th cycle
      expect(result).toBe(true);
    });

    it("should skip when player is in a live game", async () => {
      (cache.get as any).mockReturnValue(true); // in game

      // Force to 5th cycle
      for (let i = 0; i < 4; i++) {
        await runBotTrader();
      }
      const result = await runBotTrader();
      expect(result).toBe(false);
    });
  });

  describe("forceRunBot", () => {
    it("should force the bot to run regardless of cycle", async () => {
      const mockDb = createMockDb();
      mockDb._mockLimit.mockResolvedValue([{ id: 1, openId: "bot_quanttrader_001" }]);
      (getDb as any).mockResolvedValue(mockDb);
      (cache.get as any).mockReturnValue(false);

      (getOrCreatePortfolio as any).mockResolvedValue({
        cashBalance: "200.00",
        totalDividends: "0.00",
      });
      (getUserHoldings as any).mockResolvedValue([]);
      (getRecentMatchesFromDB as any).mockResolvedValue([]);
      (getPriceHistory as any).mockResolvedValue([
        { timestamp: 1000, price: "50.00" },
        { timestamp: 2000, price: "50.50" },
      ]);
      (getLatestPrice as any).mockResolvedValue({
        tier: "EMERALD",
        division: "II",
        lp: 45,
        price: "50.50",
      });

      (invokeLLM as any).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: "hold",
              ticker: "DORI",
              amount: 0,
              reasoning: "Insufficient data for confident trade.",
              sentiment: "neutral",
              confidence: 20,
            }),
          },
        }],
      });
      (postComment as any).mockResolvedValue(undefined);

      const result = await forceRunBot();
      expect(result).toBe(true);
      // Hold action should still post a comment
      expect(postComment).toHaveBeenCalled();
    });
  });

  describe("AI decision parsing", () => {
    it("should handle LLM returning a sell decision", async () => {
      const mockDb = createMockDb();
      mockDb._mockLimit.mockResolvedValue([{ id: 1, openId: "bot_quanttrader_001" }]);
      (getDb as any).mockResolvedValue(mockDb);
      (cache.get as any).mockReturnValue(false);

      (getOrCreatePortfolio as any).mockResolvedValue({
        cashBalance: "150.00",
        totalDividends: "10.00",
      });
      (getUserHoldings as any).mockResolvedValue([
        { ticker: "DORI", shares: "2.0000", avgCostBasis: "48.0000", shortShares: "0.0000", shortAvgPrice: "0.0000" },
      ]);
      (getRecentMatchesFromDB as any).mockResolvedValue([
        { win: false, champion: "Ahri", kills: 2, deaths: 8, assists: 3, gameDuration: 1800, gameCreation: Date.now() - 3600000 },
        { win: false, champion: "Zed", kills: 1, deaths: 6, assists: 2, gameDuration: 1500, gameCreation: Date.now() - 7200000 },
      ]);
      (getPriceHistory as any).mockResolvedValue([
        { timestamp: 1000, price: "52.00" },
        { timestamp: 2000, price: "51.00" },
        { timestamp: 3000, price: "49.50" },
      ]);
      (getLatestPrice as any).mockResolvedValue({
        tier: "EMERALD",
        division: "III",
        lp: 20,
        price: "49.50",
      });

      (invokeLLM as any).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: "sell",
              ticker: "DORI",
              amount: 50,
              reasoning: "Losing streak detected. Reducing DORI exposure to manage downside risk.",
              sentiment: "bearish",
              confidence: 70,
            }),
          },
        }],
      });

      (executeTrade as any).mockResolvedValue({
        portfolio: { cashBalance: "200.00" },
        holding: { shares: "1.0000" },
      });
      (postComment as any).mockResolvedValue(undefined);

      // Force run
      resetBotCycleCount();
      for (let i = 0; i < 4; i++) await runBotTrader();
      const result = await runBotTrader();

      expect(result).toBe(true);
      expect(executeTrade).toHaveBeenCalledWith(
        1,
        "DORI",
        "sell",
        expect.any(Number),
        expect.any(Number)
      );
    });

    it("should handle LLM failure gracefully with fallback", async () => {
      const mockDb = createMockDb();
      mockDb._mockLimit.mockResolvedValue([{ id: 1, openId: "bot_quanttrader_001" }]);
      (getDb as any).mockResolvedValue(mockDb);
      (cache.get as any).mockReturnValue(false);

      (getOrCreatePortfolio as any).mockResolvedValue({
        cashBalance: "200.00",
        totalDividends: "0.00",
      });
      (getUserHoldings as any).mockResolvedValue([]);
      (getRecentMatchesFromDB as any).mockResolvedValue([]);
      (getPriceHistory as any).mockResolvedValue([
        { timestamp: 1000, price: "50.00" },
        { timestamp: 2000, price: "50.50" },
        { timestamp: 3000, price: "51.00" },
      ]);
      (getLatestPrice as any).mockResolvedValue({
        tier: "EMERALD",
        division: "II",
        lp: 45,
        price: "51.00",
      });

      // LLM throws error
      (invokeLLM as any).mockRejectedValue(new Error("API timeout"));
      (postComment as any).mockResolvedValue(undefined);

      resetBotCycleCount();
      for (let i = 0; i < 4; i++) await runBotTrader();
      const result = await runBotTrader();

      expect(result).toBe(true);
      // Should still post a comment with fallback reasoning
      expect(postComment).toHaveBeenCalled();
    });

    it("should handle short selling decision", async () => {
      const mockDb = createMockDb();
      mockDb._mockLimit.mockResolvedValue([{ id: 1, openId: "bot_quanttrader_001" }]);
      (getDb as any).mockResolvedValue(mockDb);
      (cache.get as any).mockReturnValue(false);

      (getOrCreatePortfolio as any).mockResolvedValue({
        cashBalance: "180.00",
        totalDividends: "5.00",
      });
      (getUserHoldings as any).mockResolvedValue([]);
      (getRecentMatchesFromDB as any).mockResolvedValue([
        { win: false, champion: "Yasuo", kills: 0, deaths: 10, assists: 1, gameDuration: 1200, gameCreation: Date.now() - 1800000 },
      ]);
      (getPriceHistory as any).mockResolvedValue([
        { timestamp: 1000, price: "55.00" },
        { timestamp: 2000, price: "53.00" },
        { timestamp: 3000, price: "50.00" },
      ]);
      (getLatestPrice as any).mockResolvedValue({
        tier: "EMERALD",
        division: "III",
        lp: 10,
        price: "50.00",
      });

      (invokeLLM as any).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: "short",
              ticker: "TDRI",
              amount: 40,
              reasoning: "0/10 Yasuo game signals severe tilt. Shorting TDRI for maximum downside exposure.",
              sentiment: "bearish",
              confidence: 80,
            }),
          },
        }],
      });

      (executeShort as any).mockResolvedValue({
        portfolio: { cashBalance: "160.00" },
        holding: { shortShares: "0.8000" },
      });
      (postComment as any).mockResolvedValue(undefined);

      resetBotCycleCount();
      for (let i = 0; i < 4; i++) await runBotTrader();
      const result = await runBotTrader();

      expect(result).toBe(true);
      expect(executeShort).toHaveBeenCalledWith(
        1,
        "TDRI",
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  describe("trade execution safety", () => {
    it("should not buy more than available cash", async () => {
      const mockDb = createMockDb();
      mockDb._mockLimit.mockResolvedValue([{ id: 1, openId: "bot_quanttrader_001" }]);
      (getDb as any).mockResolvedValue(mockDb);
      (cache.get as any).mockReturnValue(false);

      (getOrCreatePortfolio as any).mockResolvedValue({
        cashBalance: "5.00", // Very low cash
        totalDividends: "0.00",
      });
      (getUserHoldings as any).mockResolvedValue([]);
      (getRecentMatchesFromDB as any).mockResolvedValue([]);
      (getPriceHistory as any).mockResolvedValue([
        { timestamp: 1000, price: "50.00" },
        { timestamp: 2000, price: "51.00" },
      ]);
      (getLatestPrice as any).mockResolvedValue({
        tier: "EMERALD",
        division: "II",
        lp: 45,
        price: "51.00",
      });

      (invokeLLM as any).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: "buy",
              ticker: "DORI",
              amount: 100, // Wants to buy $100 but only has $5
              reasoning: "Strong signal but limited capital.",
              sentiment: "bullish",
              confidence: 50,
            }),
          },
        }],
      });

      (executeTrade as any).mockResolvedValue({
        portfolio: { cashBalance: "0.25" },
        holding: { shares: "0.0931" },
      });
      (postComment as any).mockResolvedValue(undefined);

      resetBotCycleCount();
      for (let i = 0; i < 4; i++) await runBotTrader();
      const result = await runBotTrader();

      expect(result).toBe(true);
      // Should have capped the buy amount to available cash * 0.95
      if ((executeTrade as any).mock.calls.length > 0) {
        const [, , , shares, price] = (executeTrade as any).mock.calls[0];
        const totalAmount = shares * price;
        expect(totalAmount).toBeLessThanOrEqual(5.00);
      }
    });

    it("should not sell more shares than held", async () => {
      const mockDb = createMockDb();
      mockDb._mockLimit.mockResolvedValue([{ id: 1, openId: "bot_quanttrader_001" }]);
      (getDb as any).mockResolvedValue(mockDb);
      (cache.get as any).mockReturnValue(false);

      (getOrCreatePortfolio as any).mockResolvedValue({
        cashBalance: "100.00",
        totalDividends: "0.00",
      });
      (getUserHoldings as any).mockResolvedValue([
        { ticker: "DORI", shares: "1.0000", avgCostBasis: "50.0000", shortShares: "0.0000", shortAvgPrice: "0.0000" },
      ]);
      (getRecentMatchesFromDB as any).mockResolvedValue([]);
      (getPriceHistory as any).mockResolvedValue([
        { timestamp: 1000, price: "50.00" },
        { timestamp: 2000, price: "48.00" },
      ]);
      (getLatestPrice as any).mockResolvedValue({
        tier: "EMERALD",
        division: "III",
        lp: 20,
        price: "48.00",
      });

      (invokeLLM as any).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: "sell",
              ticker: "DORI",
              amount: 500, // Wants to sell $500 worth but only holds 1 share
              reasoning: "Cutting losses.",
              sentiment: "bearish",
              confidence: 60,
            }),
          },
        }],
      });

      (executeTrade as any).mockResolvedValue({
        portfolio: { cashBalance: "148.00" },
        holding: { shares: "0.0000" },
      });
      (postComment as any).mockResolvedValue(undefined);

      resetBotCycleCount();
      for (let i = 0; i < 4; i++) await runBotTrader();
      const result = await runBotTrader();

      expect(result).toBe(true);
      if ((executeTrade as any).mock.calls.length > 0) {
        const [, , , shares] = (executeTrade as any).mock.calls[0];
        expect(shares).toBeLessThanOrEqual(1.0);
      }
    });
  });

  describe("getBotUserId", () => {
    it("should return null when bot does not exist", async () => {
      const mockDb = createMockDb();
      mockDb._mockLimit.mockResolvedValue([]);
      (getDb as any).mockResolvedValue(mockDb);

      const id = await getBotUserId();
      expect(id).toBeNull();
    });

    it("should return bot ID when bot exists", async () => {
      const mockDb = createMockDb();
      mockDb._mockLimit.mockResolvedValue([{ id: 42 }]);
      (getDb as any).mockResolvedValue(mockDb);

      const id = await getBotUserId();
      expect(id).toBe(42);
    });
  });
});
