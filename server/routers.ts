import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getOrCreatePortfolio, getUserHoldings, executeTrade, getUserTrades,
  getAllTrades, getPriceHistory, getLatestPrice, addPriceSnapshot,
  updateDisplayName, createOrder, getUserOrders, cancelOrder,
  executeShort, executeCover, postComment, getComments, getNews,
  getUserDividends, getMarketStatus, getLeaderboard, getRecentMatchesFromDB,
  getAllMatchesFromDB, getMatchesSince,
  getPortfolioHistory, getUserNotifications, getUnreadNotificationCount,
  markNotificationRead, markAllNotificationsRead,
} from "./db";
import {
  fetchFullPlayerData, fetchRecentMatches, tierToPrice, tierToTotalLP,
} from "./riotApi";
import { pollNow, getPollStatus, startPolling, stopPolling, getETFPrice } from "./pollEngine";

// ─── ETF Definitions ───
const TICKERS = ["DORI", "DDRI", "TDRI", "SDRI", "XDRI"] as const;
type Ticker = (typeof TICKERS)[number];

function getETFPriceLocal(ticker: Ticker, currentBasePrice: number, previousBasePrice: number): number {
  if (previousBasePrice <= 0) return currentBasePrice;
  const pctChange = (currentBasePrice - previousBasePrice) / previousBasePrice;
  switch (ticker) {
    case "DORI": return currentBasePrice;
    case "DDRI": return previousBasePrice * (1 + pctChange * 2);
    case "TDRI": return previousBasePrice * (1 + pctChange * 3);
    case "SDRI": return previousBasePrice * (1 + pctChange * -2);
    case "XDRI": return previousBasePrice * (1 + pctChange * -3);
    default: return currentBasePrice;
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
    updateDisplayName: protectedProcedure
      .input(z.object({ displayName: z.string().min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        await updateDisplayName(ctx.user.id, input.displayName);
        return { success: true, displayName: input.displayName };
      }),
  }),

  // ─── Player Data (Riot API) ───
  player: router({
    current: publicProcedure.query(async () => {
      try {
        const data = await fetchFullPlayerData("목도리 도마뱀", "dori");
        return {
          gameName: data.account.gameName, tagLine: data.account.tagLine,
          puuid: data.account.puuid, summonerLevel: data.summoner.summonerLevel,
          profileIconId: data.summoner.profileIconId,
          solo: data.soloEntry ? {
            tier: data.soloEntry.tier, rank: data.soloEntry.rank,
            lp: data.soloEntry.leaguePoints, wins: data.soloEntry.wins,
            losses: data.soloEntry.losses, hotStreak: data.soloEntry.hotStreak,
          } : null,
          flex: data.flexEntry ? {
            tier: data.flexEntry.tier, rank: data.flexEntry.rank,
            lp: data.flexEntry.leaguePoints, wins: data.flexEntry.wins,
            losses: data.flexEntry.losses,
          } : null,
          currentPrice: data.currentPrice,
        };
      } catch (err: any) {
        console.error("[Player] Failed to fetch:", err?.message);
        return null;
      }
    }),
    refresh: publicProcedure.mutation(async () => {
      try {
        const data = await fetchFullPlayerData("목도리 도마뱀", "dori");
        if (data.soloEntry) {
          const totalLP = tierToTotalLP(data.soloEntry.tier, data.soloEntry.rank, data.soloEntry.leaguePoints);
          await addPriceSnapshot({
            timestamp: Date.now(), tier: data.soloEntry.tier, division: data.soloEntry.rank,
            lp: data.soloEntry.leaguePoints, totalLP, price: data.currentPrice,
            wins: data.soloEntry.wins, losses: data.soloEntry.losses,
          });
          return { success: true, price: data.currentPrice, totalLP };
        }
        return { success: false, price: 0, totalLP: 0 };
      } catch (err: any) {
        return { success: false, price: 0, totalLP: 0 };
      }
    }),
    matches: publicProcedure
      .input(z.object({ count: z.number().min(1).max(20).default(10) }).optional())
      .query(async ({ input }) => {
        try {
          const account = await fetchFullPlayerData("목도리 도마뱀", "dori");
          const matches = await fetchRecentMatches(account.account.puuid, input?.count ?? 10);
          return matches.map((m) => {
            const player = m.info.participants.find((p) => p.puuid === account.account.puuid);
            return {
              matchId: m.metadata.matchId, gameCreation: m.info.gameCreation,
              gameDuration: m.info.gameDuration, queueId: m.info.queueId,
              win: player?.win ?? false, champion: player?.championName ?? "Unknown",
              kills: player?.kills ?? 0, deaths: player?.deaths ?? 0,
              assists: player?.assists ?? 0,
              cs: (player?.totalMinionsKilled ?? 0) + (player?.neutralMinionsKilled ?? 0),
              position: player?.teamPosition ?? "",
            };
          });
        } catch (err: any) { return []; }
      }),
  }),

  // ─── Live Stats (computed from stored matches) ───
  stats: router({
    /** All-time champion pool stats computed from stored matches */
    championPool: publicProcedure.query(async () => {
      try {
        const allMatches = await getAllMatchesFromDB();
        if (allMatches.length === 0) return [];
        const champMap = new Map<string, { wins: number; losses: number; kills: number; deaths: number; assists: number; cs: number; games: number }>();
        for (const m of allMatches) {
          const existing = champMap.get(m.champion) || { wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0, cs: 0, games: 0 };
          existing.games++;
          if (m.win) existing.wins++; else existing.losses++;
          existing.kills += m.kills;
          existing.deaths += m.deaths;
          existing.assists += m.assists;
          existing.cs += m.cs;
          champMap.set(m.champion, existing);
        }
        return Array.from(champMap.entries())
          .map(([name, s]) => ({
            name,
            image: `https://ddragon.leagueoflegends.com/cdn/16.6.1/img/champion/${name}.png`,
            games: s.games,
            wins: s.wins,
            losses: s.losses,
            winRate: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0,
            kills: +(s.kills / s.games).toFixed(1),
            deaths: +(s.deaths / s.games).toFixed(1),
            assists: +(s.assists / s.games).toFixed(1),
            kdaRatio: s.deaths > 0 ? +((s.kills + s.assists) / s.deaths).toFixed(2) : +(s.kills + s.assists).toFixed(2),
            kda: `${(s.kills / s.games).toFixed(1)} / ${(s.deaths / s.games).toFixed(1)} / ${(s.assists / s.games).toFixed(1)}`,
            cs: `${Math.round(s.cs / s.games)}`,
          }))
          .sort((a, b) => b.games - a.games);
      } catch { return []; }
    }),

    /** Win/loss streak sequence from stored matches (newest first) */
    streaks: publicProcedure.query(async () => {
      try {
        const allMatches = await getAllMatchesFromDB(); // already ordered newest first
        const sequence = allMatches.map(m => m.win ? "W" : "L");
        return { sequence, totalGames: allMatches.length };
      } catch { return { sequence: [] as string[], totalGames: 0 }; }
    }),

    /** 7-day champion performance */
    recentPerformance: publicProcedure.query(async () => {
      try {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recentMatches = await getMatchesSince(sevenDaysAgo);
        if (recentMatches.length === 0) return [];
        const champMap = new Map<string, { wins: number; losses: number }>();
        for (const m of recentMatches) {
          const existing = champMap.get(m.champion) || { wins: 0, losses: 0 };
          if (m.win) existing.wins++; else existing.losses++;
          champMap.set(m.champion, existing);
        }
        return Array.from(champMap.entries())
          .map(([champion, s]) => ({
            champion,
            image: `https://ddragon.leagueoflegends.com/cdn/16.6.1/img/champion/${champion}.png`,
            wins: s.wins,
            losses: s.losses,
            winRate: (s.wins + s.losses) > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0,
          }))
          .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));
      } catch { return []; }
    }),

    /** Aggregate KDA from recent N matches */
    avgKda: publicProcedure
      .input(z.object({ count: z.number().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        try {
          const allMatches = await getRecentMatchesFromDB(input?.count ?? 20);
          if (allMatches.length === 0) return null;
          let totalK = 0, totalD = 0, totalA = 0;
          for (const m of allMatches) {
            totalK += m.kills;
            totalD += m.deaths;
            totalA += m.assists;
          }
          const n = allMatches.length;
          const avgK = totalK / n;
          const avgD = totalD / n;
          const avgA = totalA / n;
          const kdaRatio = totalD > 0 ? (totalK + totalA) / totalD : totalK + totalA;
          return {
            avgKills: +avgK.toFixed(1),
            avgDeaths: +avgD.toFixed(1),
            avgAssists: +avgA.toFixed(1),
            kdaRatio: +kdaRatio.toFixed(2),
            gamesAnalyzed: n,
          };
        } catch { return null; }
      }),
  }),

  // ─── Stored Match History (from DB, updated by polling) ───
  matches: router({
    stored: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        try {
          const raw = await getRecentMatchesFromDB(input?.limit ?? 20);
          return raw.map((m) => ({
            id: m.id,
            matchId: m.matchId,
            win: m.win,
            champion: m.champion,
            kills: m.kills,
            deaths: m.deaths,
            assists: m.assists,
            cs: m.cs,
            position: m.position,
            gameDuration: m.gameDuration,
            gameCreation: Number(m.gameCreation),
            priceBefore: m.priceBefore ? parseFloat(m.priceBefore) : null,
            priceAfter: m.priceAfter ? parseFloat(m.priceAfter) : null,
          }));
        } catch {
          return [];
        }
      }),
  }),

  // ─── Price & ETF Data ───
  prices: router({
    history: publicProcedure
      .input(z.object({ since: z.number().optional() }).optional())
      .query(async ({ input }) => getPriceHistory(input?.since)),
    latest: publicProcedure.query(async () => getLatestPrice()),
    etfPrices: publicProcedure.query(async () => {
      const history = await getPriceHistory();
      if (history.length === 0) return [];
      const latest = history[history.length - 1];
      const previous = history.length > 1 ? history[history.length - 2] : latest;
      const currentBase = parseFloat(latest.price);
      const previousBase = parseFloat(previous.price);
      return TICKERS.map((ticker) => ({
        ticker,
        price: getETFPriceLocal(ticker, currentBase, previousBase),
        change: getETFPriceLocal(ticker, currentBase, previousBase) - previousBase,
        changePct: previousBase > 0 ? ((getETFPriceLocal(ticker, currentBase, previousBase) - previousBase) / previousBase) * 100 : 0,
      }));
    }),
    tickers: publicProcedure.query(() => [
      { ticker: "DORI", name: "DORI", description: "1x LP Tracker", leverage: 1, inverse: false },
      { ticker: "DDRI", name: "DDRI", description: "2x Leveraged LP", leverage: 2, inverse: false },
      { ticker: "TDRI", name: "TDRI", description: "3x Leveraged LP", leverage: 3, inverse: false },
      { ticker: "SDRI", name: "SDRI", description: "2x Inverse LP", leverage: 2, inverse: true },
      { ticker: "XDRI", name: "XDRI", description: "3x Inverse LP", leverage: 3, inverse: true },
    ]),
  }),

  // ─── Trading ───
  trading: router({
    portfolio: protectedProcedure.query(async ({ ctx }) => {
      const portfolio = await getOrCreatePortfolio(ctx.user.id);
      const allHoldings = await getUserHoldings(ctx.user.id);
      return {
        cashBalance: parseFloat(portfolio.cashBalance),
        totalDividends: parseFloat(portfolio.totalDividends),
        holdings: allHoldings.map((h) => ({
          ticker: h.ticker, shares: parseFloat(h.shares),
          avgCostBasis: parseFloat(h.avgCostBasis),
          shortShares: parseFloat(h.shortShares),
          shortAvgPrice: parseFloat(h.shortAvgPrice),
        })),
      };
    }),
    trade: protectedProcedure
      .input(z.object({
        ticker: z.enum(TICKERS), type: z.enum(["buy", "sell"]),
        shares: z.number().positive(), pricePerShare: z.number().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check market status
        const market = await getMarketStatus();
        if (!market.isOpen) throw new Error("Market is currently closed: " + (market.reason || ""));
        const result = await executeTrade(ctx.user.id, input.ticker, input.type, input.shares, input.pricePerShare);
        return {
          cashBalance: parseFloat(result.portfolio.cashBalance),
          sharesOwned: parseFloat(result.holding.shares), ticker: input.ticker,
        };
      }),
    history: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        const raw = await getUserTrades(ctx.user.id, input?.limit ?? 50);
        return raw.map((t) => ({
          id: t.id, ticker: t.ticker, type: t.type,
          shares: parseFloat(t.shares), pricePerShare: parseFloat(t.pricePerShare),
          totalAmount: parseFloat(t.totalAmount), createdAt: t.createdAt,
        }));
      }),

    // ─── Short Selling ───
    short: protectedProcedure
      .input(z.object({
        ticker: z.enum(TICKERS), shares: z.number().positive(),
        pricePerShare: z.number().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const market = await getMarketStatus();
        if (!market.isOpen) throw new Error("Market is currently closed");
        const result = await executeShort(ctx.user.id, input.ticker, input.shares, input.pricePerShare);
        return {
          cashBalance: parseFloat(result.portfolio.cashBalance),
          shortShares: parseFloat(result.holding.shortShares), ticker: input.ticker,
        };
      }),
    cover: protectedProcedure
      .input(z.object({
        ticker: z.enum(TICKERS), shares: z.number().positive(),
        pricePerShare: z.number().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const market = await getMarketStatus();
        if (!market.isOpen) throw new Error("Market is currently closed");
        const result = await executeCover(ctx.user.id, input.ticker, input.shares, input.pricePerShare);
        return {
          cashBalance: parseFloat(result.portfolio.cashBalance),
          shortShares: parseFloat(result.holding.shortShares), ticker: input.ticker,
        };
      }),

    // ─── Limit Orders & Stop-Losses ───
    createOrder: protectedProcedure
      .input(z.object({
        ticker: z.enum(TICKERS),
        orderType: z.enum(["limit_buy", "limit_sell", "stop_loss"]),
        shares: z.number().positive(),
        targetPrice: z.number().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const order = await createOrder({
          userId: ctx.user.id, ticker: input.ticker,
          orderType: input.orderType, shares: input.shares,
          targetPrice: input.targetPrice,
        });
        return order;
      }),
    orders: protectedProcedure.query(async ({ ctx }) => {
      const raw = await getUserOrders(ctx.user.id);
      return raw.map((o) => ({
        id: o.id, ticker: o.ticker, orderType: o.orderType,
        shares: parseFloat(o.shares), targetPrice: parseFloat(o.targetPrice),
        status: o.status, filledPrice: o.filledPrice ? parseFloat(o.filledPrice) : null,
        filledAt: o.filledAt, createdAt: o.createdAt,
      }));
    }),
    cancelOrder: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return cancelOrder(input.orderId, ctx.user.id);
      }),

    // ─── Dividends ───
    dividends: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        const raw = await getUserDividends(ctx.user.id, input?.limit ?? 50);
        return raw.map((d) => ({
          id: d.id, ticker: d.ticker, shares: parseFloat(d.shares),
          dividendPerShare: parseFloat(d.dividendPerShare),
          totalPayout: parseFloat(d.totalPayout),
          reason: d.reason, matchId: d.matchId, createdAt: d.createdAt,
        }));
      }),
  }),

  // ─── Public Ledger ───
  ledger: router({
    all: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(500).default(100) }).optional())
      .query(async ({ input }) => {
        const raw = await getAllTrades(input?.limit ?? 100);
        return raw.map((t) => ({
          id: t.id, userName: t.userName ?? "Anonymous",
          ticker: t.ticker, type: t.type,
          shares: parseFloat(t.shares), pricePerShare: parseFloat(t.pricePerShare),
          totalAmount: parseFloat(t.totalAmount), createdAt: t.createdAt,
        }));
      }),
  }),

  // ─── Comments / Sentiment ───
  comments: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
      .query(async ({ input }) => {
        const raw = await getComments(input?.limit ?? 50);
        return raw.map((c) => ({
          id: c.id, userId: c.userId,
          userName: (c.userName as string) ?? "Anonymous",
          ticker: c.ticker, content: c.content,
          sentiment: c.sentiment, createdAt: c.createdAt,
        }));
      }),
    post: protectedProcedure
      .input(z.object({
        content: z.string().min(1).max(500),
        ticker: z.string().nullable().default(null),
        sentiment: z.enum(["bullish", "bearish", "neutral"]).default("neutral"),
      }))
      .mutation(async ({ ctx, input }) => {
        await postComment(ctx.user.id, input.content, input.ticker, input.sentiment);
        return { success: true };
      }),
  }),

  // ─── News Feed ───
  news: router({
    feed: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        return getNews(input?.limit ?? 20);
      }),
  }),

  // ─── Leaderboard ───
  leaderboard: router({
    rankings: publicProcedure.query(async () => {
      const { users: allUsers, holdings: allHoldings } = await getLeaderboard();

      // Get current prices for all tickers
      const history = await getPriceHistory();
      const latest = history.length > 0 ? history[history.length - 1] : null;
      const previous = history.length > 1 ? history[history.length - 2] : latest;
      const currentBase = latest ? parseFloat(latest.price) : 50;
      const previousBase = previous ? parseFloat(previous.price) : 50;

      const tickerPrices: Record<string, number> = {};
      for (const ticker of TICKERS) {
        tickerPrices[ticker] = getETFPriceLocal(ticker, currentBase, previousBase);
      }

      // Calculate portfolio value for each user
      const rankings = allUsers.map((u) => {
        const cash = u.cashBalance ? parseFloat(u.cashBalance) : 200;
        const totalDivs = u.totalDividends ? parseFloat(u.totalDividends) : 0;
        const userHoldings = allHoldings.filter((h) => h.userId === u.userId);

        let holdingsValue = 0;
        let shortExposure = 0;
        for (const h of userHoldings) {
          const shares = parseFloat(h.shares);
          const shortShares = parseFloat(h.shortShares);
          const shortAvg = parseFloat(h.shortAvgPrice);
          const price = tickerPrices[h.ticker] || 0;
          holdingsValue += shares * price;
          // Short P&L: profit if price went down
          shortExposure += shortShares * (shortAvg - price);
        }

        const totalValue = cash + holdingsValue + shortExposure;
        const pnl = totalValue - 200; // starting balance
        const pnlPct = (pnl / 200) * 100;

        return {
          userId: u.userId,
          userName: (u.userName as string) || "Anonymous",
          cashBalance: cash,
          holdingsValue,
          shortExposure,
          totalValue,
          pnl,
          pnlPct,
          totalDividends: totalDivs,
        };
      });

      // Sort by total value descending
      rankings.sort((a, b) => b.totalValue - a.totalValue);

      return rankings;
    }),
  }),

  // ─── Portfolio History (P&L Chart) ───
  portfolioHistory: router({
    history: protectedProcedure
      .input(z.object({ since: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const raw = await getPortfolioHistory(ctx.user.id, input?.since);
        return raw.map(s => ({
          totalValue: parseFloat(s.totalValue),
          cashBalance: parseFloat(s.cashBalance),
          holdingsValue: parseFloat(s.holdingsValue),
          shortPnl: parseFloat(s.shortPnl),
          timestamp: Number(s.timestamp),
        }));
      }),
  }),

  // ─── Notifications ───
  notifications: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        return getUserNotifications(ctx.user.id, input?.limit ?? 50);
      }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return getUnreadNotificationCount(ctx.user.id);
    }),
    markRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await markNotificationRead(input.notificationId, ctx.user.id);
        return { success: true };
      }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  // ─── Market Status ───
  market: router({
    status: publicProcedure.query(async () => {
      const status = await getMarketStatus();
      return {
        isOpen: status.isOpen,
        reason: status.reason,
        lastActivity: status.lastActivity,
      };
    }),
  }),

  // ─── Polling Control ───
  poll: router({
    status: publicProcedure.query(() => {
      return getPollStatus();
    }),
    trigger: publicProcedure.mutation(async () => {
      const result = await pollNow();
      return result;
    }),
    start: publicProcedure.mutation(() => {
      startPolling();
      return { success: true, message: "Polling started (every 20 minutes)" };
    }),
    stop: publicProcedure.mutation(() => {
      stopPolling();
      return { success: true, message: "Polling stopped" };
    }),
  }),
});

export type AppRouter = typeof appRouter;
