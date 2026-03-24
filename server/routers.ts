import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getOrCreatePortfolio,
  getUserHoldings,
  executeTrade,
  getUserTrades,
  getAllTrades,
  getPriceHistory,
  getLatestPrice,
  addPriceSnapshot,
  updateDisplayName,
} from "./db";
import {
  fetchFullPlayerData,
  fetchRecentMatches,
  tierToPrice,
  tierToTotalLP,
} from "./riotApi";

// ─── ETF Definitions ───
const TICKERS = ["DORI", "DDRI", "TDRI", "SDRI", "XDRI"] as const;
type Ticker = (typeof TICKERS)[number];

/**
 * Calculate ETF price from base DORI price and its previous price.
 * DORI = 1x base
 * DDRI = 2x leveraged
 * TDRI = 3x leveraged
 * SDRI = 2x inverse
 * XDRI = 3x inverse
 */
function getETFPrice(ticker: Ticker, currentBasePrice: number, previousBasePrice: number): number {
  if (previousBasePrice <= 0) return currentBasePrice;
  const pctChange = (currentBasePrice - previousBasePrice) / previousBasePrice;

  switch (ticker) {
    case "DORI":
      return currentBasePrice;
    case "DDRI":
      return previousBasePrice * (1 + pctChange * 2);
    case "TDRI":
      return previousBasePrice * (1 + pctChange * 3);
    case "SDRI":
      return previousBasePrice * (1 + pctChange * -2);
    case "XDRI":
      return previousBasePrice * (1 + pctChange * -3);
    default:
      return currentBasePrice;
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    /** Update display name */
    updateDisplayName: protectedProcedure
      .input(z.object({ displayName: z.string().min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        await updateDisplayName(ctx.user.id, input.displayName);
        return { success: true, displayName: input.displayName };
      }),
  }),

  // ─── Player Data (Riot API) ───
  player: router({
    /** Get current player data from Riot API */
    current: publicProcedure.query(async () => {
      try {
        const data = await fetchFullPlayerData("목도리 도마뱀", "dori");
        return {
          gameName: data.account.gameName,
          tagLine: data.account.tagLine,
          puuid: data.account.puuid,
          summonerLevel: data.summoner.summonerLevel,
          profileIconId: data.summoner.profileIconId,
          solo: data.soloEntry
            ? {
                tier: data.soloEntry.tier,
                rank: data.soloEntry.rank,
                lp: data.soloEntry.leaguePoints,
                wins: data.soloEntry.wins,
                losses: data.soloEntry.losses,
                hotStreak: data.soloEntry.hotStreak,
              }
            : null,
          flex: data.flexEntry
            ? {
                tier: data.flexEntry.tier,
                rank: data.flexEntry.rank,
                lp: data.flexEntry.leaguePoints,
                wins: data.flexEntry.wins,
                losses: data.flexEntry.losses,
              }
            : null,
          currentPrice: data.currentPrice,
        };
      } catch (err: any) {
        console.error("[Player] Failed to fetch:", err?.message);
        return null;
      }
    }),

    /** Fetch and store a new price snapshot */
    refresh: publicProcedure.mutation(async () => {
      try {
        const data = await fetchFullPlayerData("목도리 도마뱀", "dori");
        if (data.soloEntry) {
          const totalLP = tierToTotalLP(
            data.soloEntry.tier,
            data.soloEntry.rank,
            data.soloEntry.leaguePoints
          );
          await addPriceSnapshot({
            timestamp: Date.now(),
            tier: data.soloEntry.tier,
            division: data.soloEntry.rank,
            lp: data.soloEntry.leaguePoints,
            totalLP,
            price: data.currentPrice,
            wins: data.soloEntry.wins,
            losses: data.soloEntry.losses,
          });
          return { success: true, price: data.currentPrice, totalLP };
        }
        return { success: false, price: 0, totalLP: 0 };
      } catch (err: any) {
        console.error("[Player] Refresh failed:", err?.message);
        return { success: false, price: 0, totalLP: 0 };
      }
    }),

    /** Get recent matches from Riot API */
    matches: publicProcedure
      .input(z.object({ count: z.number().min(1).max(20).default(10) }).optional())
      .query(async ({ input }) => {
        try {
          const account = await fetchFullPlayerData("목도리 도마뱀", "dori");
          const matches = await fetchRecentMatches(
            account.account.puuid,
            input?.count ?? 10
          );

          return matches.map((m) => {
            const player = m.info.participants.find(
              (p) => p.puuid === account.account.puuid
            );
            return {
              matchId: m.metadata.matchId,
              gameCreation: m.info.gameCreation,
              gameDuration: m.info.gameDuration,
              queueId: m.info.queueId,
              win: player?.win ?? false,
              champion: player?.championName ?? "Unknown",
              kills: player?.kills ?? 0,
              deaths: player?.deaths ?? 0,
              assists: player?.assists ?? 0,
              cs: (player?.totalMinionsKilled ?? 0) + (player?.neutralMinionsKilled ?? 0),
              position: player?.teamPosition ?? "",
            };
          });
        } catch (err: any) {
          console.error("[Player] Matches fetch failed:", err?.message);
          return [];
        }
      }),
  }),

  // ─── Price & ETF Data ───
  prices: router({
    /** Get price history for charting */
    history: publicProcedure
      .input(z.object({ since: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return getPriceHistory(input?.since);
      }),

    /** Get latest price */
    latest: publicProcedure.query(async () => {
      return getLatestPrice();
    }),

    /** Get all ETF prices based on current and previous DORI price */
    etfPrices: publicProcedure.query(async () => {
      const history = await getPriceHistory();
      if (history.length === 0) return [];

      const latest = history[history.length - 1];
      const previous = history.length > 1 ? history[history.length - 2] : latest;

      const currentBase = parseFloat(latest.price);
      const previousBase = parseFloat(previous.price);

      return TICKERS.map((ticker) => ({
        ticker,
        price: getETFPrice(ticker, currentBase, previousBase),
        change: getETFPrice(ticker, currentBase, previousBase) - previousBase,
        changePct:
          previousBase > 0
            ? ((getETFPrice(ticker, currentBase, previousBase) - previousBase) /
                previousBase) *
              100
            : 0,
      }));
    }),

    /** Get all tickers info */
    tickers: publicProcedure.query(() => {
      return [
        { ticker: "DORI", name: "DORI", description: "1x LP Tracker", leverage: 1, inverse: false },
        { ticker: "DDRI", name: "DDRI", description: "2x Leveraged LP", leverage: 2, inverse: false },
        { ticker: "TDRI", name: "TDRI", description: "3x Leveraged LP", leverage: 3, inverse: false },
        { ticker: "SDRI", name: "SDRI", description: "2x Inverse LP", leverage: 2, inverse: true },
        { ticker: "XDRI", name: "XDRI", description: "3x Inverse LP", leverage: 3, inverse: true },
      ];
    }),
  }),

  // ─── Trading ───
  trading: router({
    /** Get user's portfolio (cash balance + all holdings) */
    portfolio: protectedProcedure.query(async ({ ctx }) => {
      const portfolio = await getOrCreatePortfolio(ctx.user.id);
      const allHoldings = await getUserHoldings(ctx.user.id);
      return {
        cashBalance: parseFloat(portfolio.cashBalance),
        holdings: allHoldings.map((h) => ({
          ticker: h.ticker,
          shares: parseFloat(h.shares),
          avgCostBasis: parseFloat(h.avgCostBasis),
        })),
      };
    }),

    /** Execute a trade */
    trade: protectedProcedure
      .input(
        z.object({
          ticker: z.enum(TICKERS),
          type: z.enum(["buy", "sell"]),
          shares: z.number().positive(),
          pricePerShare: z.number().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await executeTrade(
          ctx.user.id,
          input.ticker,
          input.type,
          input.shares,
          input.pricePerShare
        );
        return {
          cashBalance: parseFloat(result.portfolio.cashBalance),
          sharesOwned: parseFloat(result.holding.shares),
          ticker: input.ticker,
        };
      }),

    /** Get user's trade history */
    history: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        const raw = await getUserTrades(ctx.user.id, input?.limit ?? 50);
        return raw.map((t) => ({
          id: t.id,
          ticker: t.ticker,
          type: t.type,
          shares: parseFloat(t.shares),
          pricePerShare: parseFloat(t.pricePerShare),
          totalAmount: parseFloat(t.totalAmount),
          createdAt: t.createdAt,
        }));
      }),
  }),

  // ─── Public Ledger ───
  ledger: router({
    /** Get all trades from all users (public) */
    all: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(500).default(100) }).optional())
      .query(async ({ input }) => {
        const raw = await getAllTrades(input?.limit ?? 100);
        return raw.map((t) => ({
          id: t.id,
          userName: t.userName ?? "Anonymous",
          ticker: t.ticker,
          type: t.type,
          shares: parseFloat(t.shares),
          pricePerShare: parseFloat(t.pricePerShare),
          totalAmount: parseFloat(t.totalAmount),
          createdAt: t.createdAt,
        }));
      }),
  }),
});

export type AppRouter = typeof appRouter;
