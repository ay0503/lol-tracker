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
import { runBotTrader, forceRunBot, ensureBotUser, getBotUserId } from "./botTrader";

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

// Helper to set up standard mocks for a bot run
function setupBotRunMocks(overrides: {
  cash?: string;
  holdings?: any[];
  matches?: any[];
  priceHistory?: any[];
  latestPrice?: any;
} = {}) {
  const mockDb = createMockDb();
  mockDb._mockLimit.mockResolvedValue([{ id: 1, openId: "bot_quanttrader_001" }]);
  (getDb as any).mockResolvedValue(mockDb);

  (getOrCreatePortfolio as any).mockResolvedValue({
    cashBalance: overrides.cash ?? "200.00",
    totalDividends: "0.00",
  });
  (getUserHoldings as any).mockResolvedValue(overrides.holdings ?? []);
  (getRecentMatchesFromDB as any).mockResolvedValue(overrides.matches ?? []);
  (getPriceHistory as any).mockResolvedValue(overrides.priceHistory ?? [
    { timestamp: 1000, price: "50.00" },
    { timestamp: 2000, price: "50.50" },
    { timestamp: 3000, price: "51.00" },
  ]);
  (getLatestPrice as any).mockResolvedValue(overrides.latestPrice ?? {
    tier: "EMERALD",
    division: "II",
    lp: 45,
    price: "51.00",
  });
  (postComment as any).mockResolvedValue(undefined);
}

describe("Bot Trader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("always trades", () => {
    it("should trade even when no live game is active", async () => {
      (cache.get as any).mockReturnValue(false); // no live game
      setupBotRunMocks();

      (invokeLLM as any).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: "buy",
              ticker: "DORI",
              amount: 30,
              reasoning: "Positioning for potential LP gain based on recent trends.",
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

      const result = await runBotTrader();
      expect(result).toBe(true);
      expect(executeTrade).toHaveBeenCalled();
      // Bot sentiment comments are disabled
      expect(postComment).not.toHaveBeenCalled();
    });

    it("should trade when live game cache returns undefined", async () => {
      (cache.get as any).mockReturnValue(undefined); // no cache entry
      setupBotRunMocks();

      (invokeLLM as any).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: "hold",
              ticker: "DORI",
              amount: 0,
              reasoning: "Holding current positions.",
              sentiment: "neutral",
              confidence: 50,
            }),
          },
        }],
      });

      const result = await runBotTrader();
      // hold returns true (bot ran, just chose to hold)
      expect(result).toBe(true);
    });

    it("should trade when a live game IS active", async () => {
      (cache.get as any).mockReturnValue(true); // live game!
      setupBotRunMocks();

      (invokeLLM as any).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: "buy",
              ticker: "DORI",
              amount: 30,
              reasoning: "Live game detected. Positioning for potential LP gain.",
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

      const result = await runBotTrader();
      expect(result).toBe(true);
      expect(executeTrade).toHaveBeenCalled();
    });
  });

  describe("forceRunBot", () => {
    it("should run regardless of live game status", async () => {
      (cache.get as any).mockReturnValue(false); // no live game
      setupBotRunMocks();

      (invokeLLM as any).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: "hold",
              ticker: "DORI",
              amount: 0,
              reasoning: "No strong signal. Maintaining positions.",
              sentiment: "neutral",
              confidence: 20,
            }),
          },
        }],
      });

      const result = await forceRunBot();
      expect(result).toBe(true);
      // Bot sentiment comments are disabled
      expect(postComment).not.toHaveBeenCalled();
    });
  });

  describe("AI decision parsing", () => {
    it("should handle LLM returning a sell decision during live game", async () => {
      (cache.get as any).mockReturnValue(true); // live game
      setupBotRunMocks({
        cash: "150.00",
        holdings: [
          { ticker: "DORI", shares: "2.0000", avgCostBasis: "48.0000", shortShares: "0.0000", shortAvgPrice: "0.0000" },
        ],
        matches: [
          { win: false, champion: "Ahri", kills: 2, deaths: 8, assists: 3, gameDuration: 1800, gameCreation: Date.now() - 3600000 },
          { win: false, champion: "Zed", kills: 1, deaths: 6, assists: 2, gameDuration: 1500, gameCreation: Date.now() - 7200000 },
        ],
        priceHistory: [
          { timestamp: 1000, price: "52.00" },
          { timestamp: 2000, price: "51.00" },
          { timestamp: 3000, price: "49.50" },
        ],
        latestPrice: { tier: "EMERALD", division: "III", lp: 20, price: "49.50" },
      });

      (invokeLLM as any).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: "sell",
              ticker: "DORI",
              amount: 50,
              reasoning: "Losing streak detected. Reducing DORI exposure.",
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

      const result = await runBotTrader();
      expect(result).toBe(true);
      expect(executeTrade).toHaveBeenCalledWith(
        1, "DORI", "sell", expect.any(Number), expect.any(Number)
      );
    });

    it("should handle LLM failure gracefully with fallback", async () => {
      (cache.get as any).mockReturnValue(true); // live game
      setupBotRunMocks();

      // LLM throws error
      (invokeLLM as any).mockRejectedValue(new Error("API timeout"));

      const result = await runBotTrader();
      expect(result).toBe(true);
      // Bot sentiment comments are disabled
      expect(postComment).not.toHaveBeenCalled();
    });

    it("should handle short selling decision", async () => {
      (cache.get as any).mockReturnValue(true); // live game
      setupBotRunMocks({
        cash: "180.00",
        matches: [
          { win: false, champion: "Yasuo", kills: 0, deaths: 10, assists: 1, gameDuration: 1200, gameCreation: Date.now() - 1800000 },
        ],
        priceHistory: [
          { timestamp: 1000, price: "55.00" },
          { timestamp: 2000, price: "53.00" },
          { timestamp: 3000, price: "50.00" },
        ],
        latestPrice: { tier: "EMERALD", division: "III", lp: 10, price: "50.00" },
      });

      (invokeLLM as any).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: "short",
              ticker: "TDRI",
              amount: 40,
              reasoning: "0/10 Yasuo game signals severe tilt. Shorting TDRI.",
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

      const result = await runBotTrader();
      expect(result).toBe(true);
      expect(executeShort).toHaveBeenCalledWith(
        1, "TDRI", expect.any(Number), expect.any(Number)
      );
    });
  });

  describe("trade execution safety", () => {
    it("should not buy more than available cash", async () => {
      (cache.get as any).mockReturnValue(true); // live game
      setupBotRunMocks({ cash: "5.00" });

      (invokeLLM as any).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: "buy",
              ticker: "DORI",
              amount: 100, // Wants $100 but only has $5
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

      const result = await runBotTrader();
      expect(result).toBe(true);
      if ((executeTrade as any).mock.calls.length > 0) {
        const [, , , shares, price] = (executeTrade as any).mock.calls[0];
        const totalAmount = shares * price;
        expect(totalAmount).toBeLessThanOrEqual(5.00);
      }
    });

    it("should not sell more shares than held", async () => {
      (cache.get as any).mockReturnValue(true); // live game
      setupBotRunMocks({
        cash: "100.00",
        holdings: [
          { ticker: "DORI", shares: "1.0000", avgCostBasis: "50.0000", shortShares: "0.0000", shortAvgPrice: "0.0000" },
        ],
        priceHistory: [
          { timestamp: 1000, price: "50.00" },
          { timestamp: 2000, price: "48.00" },
        ],
        latestPrice: { tier: "EMERALD", division: "III", lp: 20, price: "48.00" },
      });

      (invokeLLM as any).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: "sell",
              ticker: "DORI",
              amount: 500, // Wants $500 but only holds 1 share
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
