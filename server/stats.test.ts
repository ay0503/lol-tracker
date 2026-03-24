import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { cache } from "./cache";

/**
 * Tests for the stats router endpoints (championPool, streaks, recentPerformance, avgKda).
 * These endpoints compute live stats from stored match data in the database.
 * We mock the db module to control the data returned.
 */

// Mock the db module
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getAllMatchesFromDB: vi.fn(),
    getMatchesSince: vi.fn(),
    getRecentMatchesFromDB: vi.fn(),
  };
});

import { getAllMatchesFromDB, getMatchesSince, getRecentMatchesFromDB } from "./db";

const mockGetAllMatches = vi.mocked(getAllMatchesFromDB);
const mockGetMatchesSince = vi.mocked(getMatchesSince);
const mockGetRecentMatches = vi.mocked(getRecentMatchesFromDB);

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

const SAMPLE_MATCHES = [
  {
    id: 1, matchId: "NA1_001", win: true, champion: "Ahri",
    kills: 10, deaths: 3, assists: 8, cs: 200, position: "MIDDLE",
    gameDuration: 1800, priceBefore: "50.0000", priceAfter: "51.0000",
    dividendsPaid: true, newsGenerated: true, gameCreation: Date.now() - 3600000,
    createdAt: new Date(),
  },
  {
    id: 2, matchId: "NA1_002", win: false, champion: "Ahri",
    kills: 5, deaths: 7, assists: 4, cs: 180, position: "MIDDLE",
    gameDuration: 2100, priceBefore: "51.0000", priceAfter: "49.0000",
    dividendsPaid: true, newsGenerated: true, gameCreation: Date.now() - 7200000,
    createdAt: new Date(),
  },
  {
    id: 3, matchId: "NA1_003", win: true, champion: "Swain",
    kills: 8, deaths: 5, assists: 15, cs: 210, position: "MIDDLE",
    gameDuration: 2000, priceBefore: "49.0000", priceAfter: "50.5000",
    dividendsPaid: true, newsGenerated: true, gameCreation: Date.now() - 10800000,
    createdAt: new Date(),
  },
  {
    id: 4, matchId: "NA1_004", win: true, champion: "Ahri",
    kills: 12, deaths: 2, assists: 10, cs: 220, position: "MIDDLE",
    gameDuration: 1500, priceBefore: "50.5000", priceAfter: "52.0000",
    dividendsPaid: true, newsGenerated: true, gameCreation: Date.now() - 86400000 * 2,
    createdAt: new Date(),
  },
];

describe("stats.championPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.invalidateAll();
  });

  it("returns aggregated champion stats from stored matches", async () => {
    mockGetAllMatches.mockResolvedValue(SAMPLE_MATCHES as any);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stats.championPool();

    expect(result).toHaveLength(2); // Ahri and Swain
    const ahri = result.find(c => c.name === "Ahri");
    expect(ahri).toBeDefined();
    expect(ahri!.games).toBe(3);
    expect(ahri!.wins).toBe(2);
    expect(ahri!.losses).toBe(1);
    expect(ahri!.winRate).toBe(67);
    expect(ahri!.image).toContain("Ahri.png");

    const swain = result.find(c => c.name === "Swain");
    expect(swain).toBeDefined();
    expect(swain!.games).toBe(1);
    expect(swain!.wins).toBe(1);
    expect(swain!.winRate).toBe(100);
  });

  it("returns empty array when no matches exist", async () => {
    mockGetAllMatches.mockResolvedValue([]);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stats.championPool();
    expect(result).toEqual([]);
  });

  it("sorts champions by games played descending", async () => {
    mockGetAllMatches.mockResolvedValue(SAMPLE_MATCHES as any);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stats.championPool();
    expect(result[0].name).toBe("Ahri"); // 3 games
    expect(result[1].name).toBe("Swain"); // 1 game
  });
});

describe("stats.streaks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.invalidateAll();
  });

  it("returns win/loss sequence from stored matches", async () => {
    mockGetAllMatches.mockResolvedValue(SAMPLE_MATCHES as any);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stats.streaks();

    expect(result.sequence).toEqual(["W", "L", "W", "W"]);
    expect(result.totalGames).toBe(4);
  });

  it("returns empty sequence when no matches", async () => {
    mockGetAllMatches.mockResolvedValue([]);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stats.streaks();
    expect(result.sequence).toEqual([]);
    expect(result.totalGames).toBe(0);
  });
});

describe("stats.recentPerformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.invalidateAll();
  });

  it("returns 7-day champion performance", async () => {
    // Only first 3 matches are within 7 days
    const recentMatches = SAMPLE_MATCHES.slice(0, 3);
    mockGetMatchesSince.mockResolvedValue(recentMatches as any);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stats.recentPerformance();

    expect(result.length).toBeGreaterThan(0);
    const ahri = result.find(c => c.champion === "Ahri");
    expect(ahri).toBeDefined();
    expect(ahri!.wins).toBe(1);
    expect(ahri!.losses).toBe(1);
    expect(ahri!.winRate).toBe(50);
  });

  it("returns empty array when no recent matches", async () => {
    mockGetMatchesSince.mockResolvedValue([]);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stats.recentPerformance();
    expect(result).toEqual([]);
  });
});

describe("stats.avgKda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.invalidateAll();
  });

  it("computes average KDA from recent matches", async () => {
    mockGetRecentMatches.mockResolvedValue(SAMPLE_MATCHES as any);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stats.avgKda({ count: 20 });

    expect(result).not.toBeNull();
    expect(result!.gamesAnalyzed).toBe(4);
    // Total: K=35, D=17, A=37 → avg K=8.8, D=4.3, A=9.3
    expect(result!.avgKills).toBe(8.8);
    expect(result!.avgDeaths).toBe(4.3);
    expect(result!.avgAssists).toBe(9.3);
    // KDA ratio = (35 + 37) / 17 = 4.24
    expect(result!.kdaRatio).toBe(4.24);
  });

  it("returns null when no matches", async () => {
    mockGetRecentMatches.mockResolvedValue([]);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stats.avgKda({ count: 20 });
    expect(result).toBeNull();
  });
});
