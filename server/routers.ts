import { COOKIE_NAME, THIRTY_DAYS_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sdk } from "./_core/sdk";
import { cache } from "./cache";
import {
  getOrCreatePortfolio, getUserHoldings, executeTrade, getUserTrades,
  getAllTrades, getPriceHistory, getLatestPrice, addPriceSnapshot,
  updateDisplayName, createOrder, getUserOrders, cancelOrder,
  executeShort, executeCover, postComment, getComments, getNews,
  getUserDividends, getMarketStatus, getLeaderboard, getRecentMatchesFromDB,
  getAllMatchesFromDB, getMatchesSince,
  getPortfolioHistory, getUserNotifications, getUnreadNotificationCount,
  markNotificationRead, markAllNotificationsRead,
  getUserByEmail, createLocalUser, setUserPassword,
  getRawClient, getDb, toggleAdminHalt,
  placeBet, getUserBets, getPendingBets, getAllDividends, getAllBets,
  withUserLock,
} from "./db";
import { users, portfolios, news } from "../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";
import {
  fetchFullPlayerData, fetchRecentMatches, tierToPrice, tierToTotalLP,
  getActiveGame, getQueueName,
} from "./riotApi";
import { pollNow, getPollStatus, startPolling, stopPolling, type GameEndEvent } from "./pollEngine";
import { forceRunBot, getBotUserId } from "./botTrader";
import { TICKERS, type Ticker, computeAllETFPricesSync, computeETFHistoryFromSnapshots } from "./etfPricing";
import { casinoRouter } from "./routers/casino";
import {
  checkCasinoCooldown, recordCasinoGame, recordCasinoGameResult,
  releaseCasinoLock, acquireCasinoLock,
  THIRTY_MIN, TEN_MIN, FIVE_MIN, TWO_MIN, ONE_MIN, DAILY_CASINO_BONUS,
} from "./casinoUtils";

// ─── Auth Rate Limiting ───
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 min
const AUTH_MAX_ATTEMPTS = 10; // max 10 attempts per 15 min per IP

function checkAuthRateLimit(req: any): void {
  const ip = req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= AUTH_MAX_ATTEMPTS) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many login attempts. Try again later." });
    }
    entry.count++;
  } else {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
  }
}
// Clean up stale entries every 30 min
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of Array.from(authAttempts.entries())) {
    if (now >= entry.resetAt) authAttempts.delete(ip);
  }
}, 30 * 60 * 1000);


export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => {
      if (!opts.ctx.user) return null;
      const { passwordHash, openId, ...safeUser } = opts.ctx.user;
      return safeUser;
    }),
    logout: protectedProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    register: publicProcedure
      .input(z.object({
        email: z.string().email().max(320),
        password: z.string().min(6).max(128),
        displayName: z.string().min(1).max(50),
      }))
      .mutation(async ({ ctx, input }) => {
        checkAuthRateLimit(ctx.req);
        const existing = await getUserByEmail(input.email);
        if (existing && existing.passwordHash) {
          throw new TRPCError({ code: "CONFLICT", message: "Unable to create account. Please try logging in instead." });
        }
        const passwordHash = await bcrypt.hash(input.password, 12);
        if (existing && !existing.passwordHash) {
          await setUserPassword(existing.id, passwordHash, input.displayName);
        } else {
          await createLocalUser({
            email: input.email,
            passwordHash,
            displayName: input.displayName,
          });
        }
        const user = await getUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user" });
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.displayName || user.name || "",
          expiresInMs: THIRTY_DAYS_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: THIRTY_DAYS_MS });
        return { success: true };
      }),
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        checkAuthRateLimit(ctx.req);
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.displayName || user.name || "",
          expiresInMs: THIRTY_DAYS_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: THIRTY_DAYS_MS });
        return { success: true };
      }),
    updateDisplayName: protectedProcedure
      .input(z.object({ displayName: z.string().min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        await updateDisplayName(ctx.user.id, input.displayName);
        return { success: true, displayName: input.displayName };
      }),
  }),

  // ─── Player Data (Riot API) — cached 30 min ───
  player: router({
    current: publicProcedure.query(async () => {
      return cache.getOrSet("player.current", async () => {
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
      }, THIRTY_MIN);
    }),
    refresh: adminProcedure.mutation(async () => {
      try {
        const data = await fetchFullPlayerData("목도리 도마뱀", "dori");
        if (data.soloEntry) {
          const totalLP = tierToTotalLP(data.soloEntry.tier, data.soloEntry.rank, data.soloEntry.leaguePoints);
          await addPriceSnapshot({
            timestamp: Date.now(), tier: data.soloEntry.tier, division: data.soloEntry.rank,
            lp: data.soloEntry.leaguePoints, totalLP, price: data.currentPrice,
            wins: data.soloEntry.wins, losses: data.soloEntry.losses,
          });
          cache.invalidatePrefix("player.");
          cache.invalidatePrefix("prices.");
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
        const count = input?.count ?? 10;
        return cache.getOrSet(`player.matches.${count}`, async () => {
          try {
            const account = await fetchFullPlayerData("목도리 도마뱀", "dori");
            const matches = await fetchRecentMatches(account.account.puuid, count);
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
        }, THIRTY_MIN);
      }),
    liveGame: publicProcedure.query(async () => {
      // Uses the two-consecutive-confirmation status from the poll engine.
      // The poll engine caches both the boolean and game details every 30s.
      // This route NEVER re-fetches from spectator API — it only reads cache.
      const confirmedInGame = cache.get<boolean>("player.liveGame.check");
      if (!confirmedInGame) return { inGame: false as const };

      // Read game details cached by poll engine (no extra API call)
      const details = cache.get<any>("player.liveGame.details");
      return details || { inGame: true as const };
    }),
    gameEndEvent: publicProcedure.query(() => {
      // Returns the latest game-end event from cache (10-min TTL)
      // Frontend polls this to show the post-game LP notification banner
      const event = cache.get<GameEndEvent>("player.gameEndEvent");
      return event || null;
    }),
    dismissGameEndEvent: protectedProcedure.mutation(() => {
      // Allows frontend to dismiss the banner by clearing the cache entry
      cache.invalidate("player.gameEndEvent");
      return { success: true };
    }),
  }),

  // ─── Live Stats (computed from stored matches) — cached 30 min ───
  stats: router({
    championPool: publicProcedure.query(async () => {
      return cache.getOrSet("stats.championPool", async () => {
        try {
          const allMatchesRaw = await getAllMatchesFromDB();
          const allMatches = allMatchesRaw.filter(m => !m.isRemake);
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
              games: s.games, wins: s.wins, losses: s.losses,
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
      }, THIRTY_MIN);
    }),

    streaks: publicProcedure.query(async () => {
      return cache.getOrSet("stats.streaks", async () => {
        try {
          const allMatchesRaw = await getAllMatchesFromDB();
          const allMatches = allMatchesRaw.filter(m => !m.isRemake);
          const sequence = allMatches.map(m => m.win ? "W" : "L");
          return { sequence, totalGames: allMatches.length };
        } catch { return { sequence: [] as string[], totalGames: 0 }; }
      }, THIRTY_MIN);
    }),

    recentPerformance: publicProcedure.query(async () => {
      return cache.getOrSet("stats.recentPerformance", async () => {
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
              wins: s.wins, losses: s.losses,
              winRate: (s.wins + s.losses) > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0,
            }))
            .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));
        } catch { return []; }
      }, THIRTY_MIN);
    }),

    avgKda: publicProcedure
      .input(z.object({ count: z.number().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        const count = input?.count ?? 20;
        return cache.getOrSet(`stats.avgKda.${count}`, async () => {
          try {
            const allMatches = await getRecentMatchesFromDB(count);
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
        }, THIRTY_MIN);
      }),
  }),

  // ─── Stored Match History (from DB) — cached 30 min ───
  matches: router({
    stored: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit ?? 20;
        return cache.getOrSet(`matches.stored.${limit}`, async () => {
          try {
            const raw = await getRecentMatchesFromDB(limit);
            return raw.map((m) => ({
              id: m.id, matchId: m.matchId, win: m.win, champion: m.champion,
              kills: m.kills, deaths: m.deaths, assists: m.assists, cs: m.cs,
              position: m.position, gameDuration: m.gameDuration,
              gameCreation: Number(m.gameCreation),
              priceBefore: m.priceBefore ? parseFloat(m.priceBefore) : null,
              priceAfter: m.priceAfter ? parseFloat(m.priceAfter) : null,
              isRemake: m.isRemake ?? false,
            }));
          } catch { return []; }
        }, THIRTY_MIN);
      }),
  }),

  // ─── Price & ETF Data — cached 30 min ───
  prices: router({
    history: publicProcedure
      .input(z.object({ since: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const since = input?.since;
        return cache.getOrSet(`prices.history.${since ?? "all"}`, async () => {
          return getPriceHistory(since);
        }, TWO_MIN);
      }),
    latest: publicProcedure.query(async () => {
      return cache.getOrSet("prices.latest", async () => {
        return getLatestPrice();
      }, ONE_MIN);
    }),
    etfPrices: publicProcedure.query(async () => {
      return cache.getOrSet("prices.etfPrices", async () => {
        const history = await getPriceHistory();
        if (history.length === 0) return [];
        const etfPrices = computeAllETFPricesSync(history);
        const historyWithoutLast = history.slice(0, -1);
        const prevPrices = historyWithoutLast.length > 0
          ? computeAllETFPricesSync(historyWithoutLast)
          : etfPrices;
        return TICKERS.map((ticker) => {
          const price = etfPrices[ticker];
          const prevPrice = prevPrices[ticker];
          return {
            ticker, price,
            change: price - prevPrice,
            changePct: prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0,
          };
        });
      }, ONE_MIN);
    }),
    etfHistory: publicProcedure
      .input(z.object({
        ticker: z.enum(TICKERS),
        since: z.number().optional(),
      }))
      .query(async ({ input }) => {
        // Normalize 'since' to 5-min buckets so cache keys align across requests
        const sinceBucket = input.since ? Math.floor(input.since / 300) * 300 : "all";
        return cache.getOrSet(`prices.etfHistory.${input.ticker}.${sinceBucket}`, async () => {
          const history = await getPriceHistory(input.since);
          return computeETFHistoryFromSnapshots(input.ticker, history);
        }, TWO_MIN);
      }),
    tickers: publicProcedure.query(() => [
      { ticker: "DORI", name: "DORI", description: "1x LP Tracker", leverage: 1, inverse: false },
      { ticker: "DDRI", name: "DDRI", description: "2x Leveraged LP", leverage: 2, inverse: false },
      { ticker: "TDRI", name: "TDRI", description: "3x Leveraged LP", leverage: 3, inverse: false },
      { ticker: "SDRI", name: "SDRI", description: "2x Inverse LP", leverage: 2, inverse: true },
      { ticker: "XDRI", name: "XDRI", description: "3x Inverse LP", leverage: 3, inverse: true },
    ]),
  }),

  // ─── Trading (user-specific, no server cache) ───
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
        shares: z.number().positive().finite(), pricePerShare: z.number().positive().finite(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Block trading during admin halt, live games, or market closed
        const market = await getMarketStatus();
        if (market.adminHalt) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Trading halted by admin." });
        const liveGame = cache.get<boolean>("player.liveGame.check") ?? false;
        if (liveGame) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Trading halted — player is in a live game. Trades resume after the match ends." });
        if (!market.isOpen) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Market is currently closed: " + (market.reason || "") });

        // Server-side price validation: use cached ETF prices (avoid full table scan)
        const cachedPrices = cache.get<{ ticker: string; price: number }[]>("prices.etfPrices");
        const serverPrice = cachedPrices
          ? cachedPrices.find(p => p.ticker === input.ticker)?.price ?? input.pricePerShare
          : input.pricePerShare;
        if (cachedPrices && Math.abs(input.pricePerShare - serverPrice) / serverPrice > 0.005) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Price has changed. Please refresh and try again." });
        }

        let result;
        try {
          result = await executeTrade(ctx.user.id, input.ticker, input.type, input.shares, serverPrice);
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message || "Trade failed" });
        }

        // Invalidate ledger and leaderboard caches after trade
        cache.invalidatePrefix("ledger.");
        cache.invalidate("leaderboard.rankings");
        return {
          cashBalance: parseFloat(result.portfolio.cashBalance),
          sharesOwned: parseFloat(result.holding.shares), ticker: input.ticker,
        };
      }),
    history: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        const raw = await getUserTrades(ctx.user.id, input?.limit ?? 50);
         return raw.map((tradeEntry) => ({
           id: tradeEntry.id, ticker: tradeEntry.ticker, type: tradeEntry.type,
           shares: parseFloat(tradeEntry.shares), pricePerShare: parseFloat(tradeEntry.pricePerShare),
           totalAmount: parseFloat(tradeEntry.totalAmount),
           createdAt: typeof tradeEntry.createdAt === 'string' && !tradeEntry.createdAt.endsWith('Z') ? tradeEntry.createdAt + 'Z' : (tradeEntry.createdAt ?? null),
         }));
      }),

    short: protectedProcedure
      .input(z.object({
        ticker: z.enum(TICKERS), shares: z.number().positive().finite(),
        pricePerShare: z.number().positive().finite(),
      }))
      .mutation(async ({ ctx, input }) => {

        const market = await getMarketStatus();
        if (market.adminHalt) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Trading halted by admin." });
        const liveGame = cache.get<boolean>("player.liveGame.check") ?? false;
        if (liveGame) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Trading halted — player is in a live game. Trades resume after the match ends." });
        if (!market.isOpen) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Market is currently closed" });

        // Server-side price validation (cached, no full table scan)
        const cachedPrices = cache.get<{ ticker: string; price: number }[]>("prices.etfPrices");
        const serverPrice = cachedPrices
          ? cachedPrices.find(p => p.ticker === input.ticker)?.price ?? input.pricePerShare
          : input.pricePerShare;
        if (cachedPrices && Math.abs(input.pricePerShare - serverPrice) / serverPrice > 0.005) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Price has changed. Please refresh and try again." });
        }

        let result;
        try {
          result = await executeShort(ctx.user.id, input.ticker, input.shares, serverPrice);
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message || "Short failed" });
        }

        cache.invalidatePrefix("ledger.");
        cache.invalidate("leaderboard.rankings");
        return {
          cashBalance: parseFloat(result.portfolio.cashBalance),
          shortShares: parseFloat(result.holding.shortShares), ticker: input.ticker,
        };
      }),
    cover: protectedProcedure
      .input(z.object({
        ticker: z.enum(TICKERS), shares: z.number().positive().finite(),
        pricePerShare: z.number().positive().finite(),
      }))
      .mutation(async ({ ctx, input }) => {

        const liveGame = cache.get<boolean>("player.liveGame.check") ?? false;
        if (liveGame) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Trading halted — player is in a live game. Trades resume after the match ends." });
        const market = await getMarketStatus();
        if (!market.isOpen) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Market is currently closed" });

        // Server-side price validation (cached, no full table scan)
        const cachedPrices = cache.get<{ ticker: string; price: number }[]>("prices.etfPrices");
        const serverPrice = cachedPrices
          ? cachedPrices.find(p => p.ticker === input.ticker)?.price ?? input.pricePerShare
          : input.pricePerShare;
        if (cachedPrices && Math.abs(input.pricePerShare - serverPrice) / serverPrice > 0.005) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Price has changed. Please refresh and try again." });
        }

        let result;
        try {
          result = await executeCover(ctx.user.id, input.ticker, input.shares, serverPrice);
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message || "Cover failed" });
        }

        cache.invalidatePrefix("ledger.");
        cache.invalidate("leaderboard.rankings");
        return {
          cashBalance: parseFloat(result.portfolio.cashBalance),
          shortShares: parseFloat(result.holding.shortShares), ticker: input.ticker,
        };
      }),

    createOrder: protectedProcedure
      .input(z.object({
        ticker: z.enum(TICKERS),
        orderType: z.enum(["limit_buy", "limit_sell", "stop_loss"]),
        shares: z.number().positive().finite(),
        targetPrice: z.number().positive().finite(),
      }))
      .mutation(async ({ ctx, input }) => {
        const market = await getMarketStatus();
        if (market.adminHalt) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Trading halted by admin. Orders cannot be placed." });
        const liveGame = cache.get<boolean>("player.liveGame.check") ?? false;
        if (liveGame) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Trading halted — player is in a live game. Orders can be placed after the match ends." });
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

  // ─── Public Ledger — cached 5 min ───
  ledger: router({
    all: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(500).default(100) }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit ?? 100;
        return cache.getOrSet(`ledger.all.${limit}`, async () => {
          const raw = await getAllTrades(limit);
           return raw.map((tradeEntry) => ({
             id: tradeEntry.id, userId: tradeEntry.userId, userName: tradeEntry.userName ?? "Anonymous",
             ticker: tradeEntry.ticker, type: tradeEntry.type,
             shares: parseFloat(tradeEntry.shares), pricePerShare: parseFloat(tradeEntry.pricePerShare),
             totalAmount: parseFloat(tradeEntry.totalAmount),
             createdAt: typeof tradeEntry.createdAt === 'string' && !tradeEntry.createdAt.endsWith('Z') ? tradeEntry.createdAt + 'Z' : (tradeEntry.createdAt ?? null),
           }));
        }, FIVE_MIN);
      }),
    dividends: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(500).default(100) }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit ?? 100;
        return cache.getOrSet(`ledger.dividends.${limit}`, async () => {
          const raw = await getAllDividends(limit);
          return raw.map(d => ({
            id: d.id, userId: d.userId, userName: String(d.userName ?? "Anonymous"),
            ticker: d.ticker, shares: parseFloat(d.shares),
            totalPayout: parseFloat(d.totalPayout),
            reason: d.reason,
            createdAt: typeof d.createdAt === 'string' && !d.createdAt.endsWith('Z') ? d.createdAt + 'Z' : (d.createdAt ?? null),
          }));
        }, FIVE_MIN);
      }),
    bets: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(500).default(100) }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit ?? 100;
        return cache.getOrSet(`ledger.bets.${limit}`, async () => {
          const raw = await getAllBets(limit);
          return raw.map(b => ({
            id: b.id, userId: b.userId, userName: String(b.userName ?? "Anonymous"),
            prediction: b.prediction, amount: parseFloat(b.amount),
            status: b.status, payout: b.payout ? parseFloat(b.payout) : null,
            createdAt: typeof b.createdAt === 'string' && !b.createdAt.endsWith('Z') ? b.createdAt + 'Z' : (b.createdAt ?? null),
          }));
        }, FIVE_MIN);
      }),
    botTrades: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(500).default(100) }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit ?? 100;
        return cache.getOrSet(`ledger.bot.${limit}`, async () => {
          const db = await getDb();
          const { trades } = await import("../drizzle/schema");
          const raw = await db.select({
            id: trades.id, userId: trades.userId,
            userName: sql`'QuantBot 🤖'`.as('userName'),
            ticker: trades.ticker, type: trades.type,
            shares: trades.shares, pricePerShare: trades.pricePerShare,
            totalAmount: trades.totalAmount, createdAt: trades.createdAt,
          }).from(trades).leftJoin(users, eq(trades.userId, users.id))
            .where(sql`${users.name} = 'QuantBot 🤖'`)
            .orderBy(desc(trades.createdAt)).limit(limit);
          return raw.map(row => ({
            id: row.id, userId: row.userId, userName: "QuantBot 🤖",
            ticker: row.ticker, type: row.type,
            shares: parseFloat(row.shares), pricePerShare: parseFloat(row.pricePerShare),
            totalAmount: parseFloat(row.totalAmount),
            createdAt: typeof row.createdAt === 'string' && !row.createdAt.endsWith('Z') ? row.createdAt + 'Z' : (row.createdAt ?? null),
          }));
        }, FIVE_MIN);
      }),
  }),

  // ─── Comments / Sentiment — cached 5 min ───
  comments: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit ?? 50;
        return cache.getOrSet(`comments.list.${limit}`, async () => {
          const raw = await getComments(limit);
          return raw.map((c) => ({
            id: c.id, userId: c.userId,
            userName: (c.userName as string) ?? "Anonymous",
            ticker: c.ticker, content: c.content,
            sentiment: c.sentiment, createdAt: c.createdAt,
          }));
        }, FIVE_MIN);
      }),
    post: protectedProcedure
      .input(z.object({
        content: z.string().min(1).max(500),
        ticker: z.enum(TICKERS).nullable().default(null),
        sentiment: z.enum(["bullish", "bearish", "neutral"]).default("neutral"),
      }))
      .mutation(async ({ ctx, input }) => {
        // Sanitize: strip HTML tags and control characters
        const sanitized = input.content.replace(/<[^>]*>/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
        if (!sanitized) throw new TRPCError({ code: "BAD_REQUEST", message: "Comment cannot be empty" });
        await postComment(ctx.user.id, sanitized, input.ticker, input.sentiment);
        cache.invalidatePrefix("comments.");
        return { success: true };
      }),
    react: protectedProcedure
      .input(z.object({ commentId: z.number(), type: z.enum(["like", "fire", "dislike"]) }))
      .mutation(async ({ ctx, input }) => {
        const client = getRawClient();
        await client.execute(`CREATE TABLE IF NOT EXISTS comment_reactions (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer NOT NULL, commentId integer NOT NULL, type text NOT NULL, createdAt text DEFAULT (datetime('now')) NOT NULL)`);
        // Toggle: if already reacted with same type, remove it
        const existing = await client.execute({ sql: `SELECT id FROM comment_reactions WHERE userId = ? AND commentId = ? AND type = ?`, args: [ctx.user.id, input.commentId, input.type] });
        if (existing.rows.length > 0) {
          await client.execute({ sql: `DELETE FROM comment_reactions WHERE userId = ? AND commentId = ? AND type = ?`, args: [ctx.user.id, input.commentId, input.type] });
        } else {
          await client.execute({ sql: `INSERT INTO comment_reactions (userId, commentId, type) VALUES (?, ?, ?)`, args: [ctx.user.id, input.commentId, input.type] });
        }
        cache.invalidatePrefix("comments.");
        return { success: true };
      }),
    reactions: publicProcedure
      .input(z.object({ commentIds: z.array(z.number()) }))
      .query(async ({ input }) => {
        if (input.commentIds.length === 0) return {};
        const client = getRawClient();
        try {
          const placeholders = input.commentIds.map(() => "?").join(",");
          const result = await client.execute({ sql: `SELECT commentId, type, COUNT(*) as count FROM comment_reactions WHERE commentId IN (${placeholders}) GROUP BY commentId, type`, args: input.commentIds });
          const map: Record<number, Record<string, number>> = {};
          for (const row of result.rows as any[]) {
            const cid = Number(row.commentId);
            if (!map[cid]) map[cid] = {};
            map[cid][String(row.type)] = Number(row.count);
          }
          return map;
        } catch { return {}; }
      }),
    myReactions: protectedProcedure
      .input(z.object({ commentIds: z.array(z.number()) }))
      .query(async ({ ctx, input }) => {
        if (input.commentIds.length === 0) return {};
        const client = getRawClient();
        try {
          const placeholders2 = input.commentIds.map(() => "?").join(",");
          const result = await client.execute({ sql: `SELECT commentId, type FROM comment_reactions WHERE userId = ? AND commentId IN (${placeholders2})`, args: [ctx.user.id, ...input.commentIds] });
          const map: Record<number, string[]> = {};
          for (const row of result.rows as any[]) {
            const cid = Number(row.commentId);
            if (!map[cid]) map[cid] = [];
            map[cid].push(String(row.type));
          }
          return map;
        } catch { return {}; }
      }),
  }),

  // ─── News Feed — cached 30 min ───
  news: router({
    feed: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(20),
        since: z.number().optional(), // timestamp — only return articles after this
      }).optional())
      .query(async ({ input }) => {
        const newsLimit = input?.limit ?? 20;
        const since = input?.since;
        const cacheKey = since ? `news.feed.${newsLimit}.${Math.floor(since / 60000)}` : `news.feed.${newsLimit}`;
        return cache.getOrSet(cacheKey, async () => {
          if (since) {
            const db = await getDb();
            const sinceDate = new Date(since).toISOString();
            return db.select().from(news).where(sql`${news.createdAt} >= ${sinceDate}`).orderBy(desc(news.createdAt)).limit(newsLimit);
          }
          return getNews(newsLimit);
        }, FIVE_MIN);
      }),
  }),

  // ─── Game Bets ───
  // ─── Price Alerts ───
  alerts: router({
    create: protectedProcedure
      .input(z.object({
        ticker: z.enum(TICKERS),
        targetPrice: z.number().positive().finite(),
        direction: z.enum(["above", "below"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const client = getRawClient();
        await client.execute(`CREATE TABLE IF NOT EXISTS price_alerts (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer NOT NULL, ticker text NOT NULL, targetPrice text NOT NULL, direction text NOT NULL, triggered integer NOT NULL DEFAULT 0, createdAt text DEFAULT (datetime('now')) NOT NULL)`);
        await client.execute({
          sql: `INSERT INTO price_alerts (userId, ticker, targetPrice, direction) VALUES (?, ?, ?, ?)`,
          args: [ctx.user.id, input.ticker, input.targetPrice.toFixed(4), input.direction],
        });
        return { success: true };
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      const client = getRawClient();
      try {
        const result = await client.execute({ sql: `SELECT * FROM price_alerts WHERE userId = ? ORDER BY createdAt DESC LIMIT 20`, args: [ctx.user.id] });
        return (result.rows as any[]).map(r => ({
          id: Number(r.id), ticker: String(r.ticker),
          targetPrice: parseFloat(String(r.targetPrice)),
          direction: String(r.direction),
          triggered: Boolean(r.triggered),
        }));
      } catch { return []; }
    }),
    delete: protectedProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const client = getRawClient();
        await client.execute({ sql: `DELETE FROM price_alerts WHERE id = ? AND userId = ?`, args: [input.alertId, ctx.user.id] });
        return { success: true };
      }),
  }),

  betting: router({
    place: protectedProcedure
      .input(z.object({
        prediction: z.enum(["win", "loss"]),
        amount: z.number().min(1).max(50).finite(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Allow bets in first 5 minutes of a live game, block after
        const liveGame = cache.get<boolean>("player.liveGame.check") ?? false;
        if (liveGame) {
          const details = cache.get<{ gameStartTime?: number; gameLengthSeconds?: number }>("player.liveGame.details");
          const gameElapsed = details?.gameStartTime
            ? Math.floor((Date.now() - details.gameStartTime) / 1000) + (details.gameLengthSeconds ?? 0)
            : Infinity;
          if (gameElapsed > 300) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Betting locked — game has been live for more than 5 minutes." });
          }
        }

        let bet;
        try {
          bet = await placeBet(ctx.user.id, input.prediction, input.amount);
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message || "Bet failed" });
        }
        cache.invalidate("leaderboard.rankings");
        return bet;
      }),
    myBets: protectedProcedure.query(async ({ ctx }) => {
      const raw = await getUserBets(ctx.user.id);
      return raw.map(b => ({
        id: b.id, prediction: b.prediction,
        amount: parseFloat(b.amount),
        status: b.status, matchId: b.matchId,
        payout: b.payout ? parseFloat(b.payout) : null,
        createdAt: b.createdAt,
      }));
    }),
    pending: publicProcedure.query(async () => {
      const raw = await getPendingBets();
      return {
        total: raw.length,
        winBets: raw.filter(b => b.prediction === "win").length,
        lossBets: raw.filter(b => b.prediction === "loss").length,
        totalPool: raw.reduce((s, b) => s + parseFloat(b.amount), 0),
      };
    }),
    /** Betting status: is betting open, time remaining, sentiment */
    status: publicProcedure.query(async () => {
      const liveGame = cache.get<boolean>("player.liveGame.check") ?? false;
      const details = cache.get<{ gameStartTime?: number; gameLengthSeconds?: number }>("player.liveGame.details");
      const raw = await getPendingBets();

      const winBets = raw.filter(b => b.prediction === "win");
      const lossBets = raw.filter(b => b.prediction === "loss");
      const winPool = winBets.reduce((s, b) => s + parseFloat(b.amount), 0);
      const lossPool = lossBets.reduce((s, b) => s + parseFloat(b.amount), 0);
      const totalPool = winPool + lossPool;
      const winPct = totalPool > 0 ? Math.round((winPool / totalPool) * 100) : 50;

      if (!liveGame) {
        return { open: true, reason: "pre-game" as const, secondsLeft: null, winPct, lossPct: 100 - winPct, totalBets: raw.length, totalPool };
      }

      const gameElapsed = details?.gameStartTime
        ? Math.floor((Date.now() - details.gameStartTime) / 1000) + (details.gameLengthSeconds ?? 0)
        : Infinity;
      const secondsLeft = Math.max(0, 300 - gameElapsed);

      if (gameElapsed <= 300) {
        return { open: true, reason: "early-game" as const, secondsLeft, winPct, lossPct: 100 - winPct, totalBets: raw.length, totalPool };
      }

      return { open: false, reason: "locked" as const, secondsLeft: 0, winPct, lossPct: 100 - winPct, totalBets: raw.length, totalPool };
    }),
  }),

  // ─── Casino (extracted to routers/casino.ts) ───
  casino: casinoRouter,

  // ─── Leaderboard — cached 10 min ───
  leaderboard: router({
    rankings: publicProcedure.query(async () => {
      return cache.getOrSet("leaderboard.rankings", async () => {
        const { users: allUsers, holdingsByUser } = await getLeaderboard();
        // Reuse cached ETF prices to avoid recomputing from full history
        const cachedPrices = cache.get<{ ticker: string; price: number }[]>("prices.etfPrices");
        let tickerPrices: Record<string, number>;
        if (cachedPrices) {
          tickerPrices = Object.fromEntries(cachedPrices.map(p => [p.ticker, p.price]));
        } else {
          const history = await getPriceHistory();
          tickerPrices = history.length > 0
            ? computeAllETFPricesSync(history)
            : { DORI: 50, DDRI: 50, TDRI: 50, SDRI: 50, XDRI: 50 };
        }

        const rankings = allUsers.map((u) => {
          const cash = u.cashBalance ? parseFloat(u.cashBalance) : 200;
          const totalDivs = u.totalDividends ? parseFloat(u.totalDividends) : 0;
          const userHoldings = holdingsByUser.get(u.userId) ?? [];

          let holdingsValue = 0;
          let shortExposure = 0;
          for (const h of userHoldings) {
            const shares = parseFloat(h.shares);
            const shortShares = parseFloat(h.shortShares);
            const shortAvg = parseFloat(h.shortAvgPrice);
            const price = tickerPrices[h.ticker] || 0;
            holdingsValue += shares * price;
            shortExposure += shortShares * (shortAvg - price);
          }

          const totalValue = cash + holdingsValue + shortExposure;
          const pnl = totalValue - 200;
          const pnlPct = (pnl / 200) * 100;

          return {
            userId: u.userId, userName: (u.userName as string) || "Anonymous",
            cashBalance: cash, holdingsValue, shortExposure,
            totalValue, pnl, pnlPct, totalDividends: totalDivs,
          };
        });

        rankings.sort((a, b) => b.totalValue - a.totalValue);

        // Attach equipped cosmetics to each user
        try {
          const client = getRawClient();
          const equipped = await client.execute(`
            SELECT ue.userId, t.name as titleName, t.cssClass as titleCss, n.name as nameEffectName, n.cssClass as nameEffectCss
            FROM user_equipped ue
            LEFT JOIN cosmetic_items t ON ue.equippedTitle = t.id
            LEFT JOIN cosmetic_items n ON ue.equippedNameEffect = n.id
          `);
          const cosmeticMap = new Map<number, { title: any; nameEffect: any }>();
          for (const r of equipped.rows as any[]) {
            cosmeticMap.set(Number(r.userId), {
              title: r.titleName ? { name: String(r.titleName), cssClass: r.titleCss ? String(r.titleCss) : null } : null,
              nameEffect: r.nameEffectName ? { name: String(r.nameEffectName), cssClass: r.nameEffectCss ? String(r.nameEffectCss) : null } : null,
            });
          }
          return rankings.map(r => ({
            ...r,
            title: cosmeticMap.get(r.userId)?.title ?? null,
            nameEffect: cosmeticMap.get(r.userId)?.nameEffect ?? null,
          }));
        } catch {
          return rankings.map(r => ({ ...r, title: null, nameEffect: null }));
        }
      }, TEN_MIN);
    }),
    /** Leaderboard chart: portfolio value history for all users */
    chart: publicProcedure
      .input(z.object({
        since: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getLeaderboardSnapshots } = await import("./db");
        const since = input?.since ?? Date.now() - 7 * 24 * 60 * 60 * 1000; // default 7 days
        return cache.getOrSet(`leaderboard.chart.${since}`, async () => {
          const snapshots = await getLeaderboardSnapshots(since);

          // Group by userId
          const byUser = new Map<number, { totalValue: number; timestamp: number }[]>();
          for (const snap of snapshots) {
            const uid = Number(snap.userId);
            if (!byUser.has(uid)) byUser.set(uid, []);
            byUser.get(uid)!.push({
              totalValue: parseFloat(snap.totalValue),
              timestamp: Number(snap.timestamp),
            });
          }

          // Get user names
          const db = await getDb();
          const allUsers = await db.select({ id: users.id, name: users.name, displayName: users.displayName }).from(users);
          const nameMap = new Map(allUsers.map(u => [u.id, u.displayName || u.name || `User ${u.id}`]));

          // Build result: only include users with data
          const result: { userId: number; userName: string; data: { value: number; timestamp: number }[] }[] = [];
          for (const [userId, data] of Array.from(byUser.entries())) {
            result.push({
              userId,
              userName: nameMap.get(userId) ?? `User ${userId}`,
              data: data.map(d => ({ value: d.totalValue, timestamp: d.timestamp })),
            });
          }

          // Sort by latest value descending
          result.sort((a, b) => {
            const aLast = a.data[a.data.length - 1]?.value ?? 0;
            const bLast = b.data[b.data.length - 1]?.value ?? 0;
            return bLast - aLast;
          });

          return result;
        }, FIVE_MIN);
      }),
    /** Public user profile: trades + holdings for any user */
    userProfile: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        const [userRow] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
        if (!userRow) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        const portfolio = await getOrCreatePortfolio(input.userId);
        const trades = await getUserTrades(input.userId, 30);
        const holdings = await getUserHoldings(input.userId);
        const history = await getPortfolioHistory(input.userId, Date.now() - 30 * 24 * 60 * 60 * 1000);
        const userBets = await getUserBets(input.userId, 20);

        // Get current prices for holdings valuation
        const cachedPrices = cache.get<{ ticker: string; price: number }[]>("prices.etfPrices");
        const priceMap: Record<string, number> = cachedPrices
          ? Object.fromEntries(cachedPrices.map(p => [p.ticker, p.price]))
          : { DORI: 50, DDRI: 50, TDRI: 50, SDRI: 50, XDRI: 50 };

        const cash = parseFloat(portfolio.cashBalance);
        let holdingsValue = 0;
        let shortPnl = 0;
        const holdingsData = holdings.map(h => {
          const shares = parseFloat(h.shares);
          const shortShares = parseFloat(h.shortShares);
          const price = priceMap[h.ticker] || 0;
          const value = shares * price;
          const pnl = value - shares * parseFloat(h.avgCostBasis);
          const sPnl = shortShares * (parseFloat(h.shortAvgPrice) - price);
          holdingsValue += value;
          shortPnl += sPnl;
          return {
            ticker: h.ticker, shares, avgCostBasis: parseFloat(h.avgCostBasis),
            shortShares, shortAvgPrice: parseFloat(h.shortAvgPrice),
            currentPrice: price, value, pnl, shortPnl: sPnl,
          };
        }).filter(h => h.shares > 0 || h.shortShares > 0);

        const totalValue = cash + holdingsValue + shortPnl;

        return {
          userName: userRow.displayName || userRow.name || "Trader",
          joinDate: userRow.createdAt,
          totalValue,
          cashBalance: cash,
          casinoBalance: parseFloat(portfolio.casinoBalance ?? "20.00"),
          totalDividends: parseFloat(portfolio.totalDividends),
          allTimePnl: totalValue - 200,
          trades: trades.map(t => ({
            ticker: t.ticker, type: t.type,
            shares: parseFloat(t.shares), pricePerShare: parseFloat(t.pricePerShare),
            totalAmount: parseFloat(t.totalAmount),
            createdAt: t.createdAt,
          })),
          holdings: holdingsData,
          portfolioHistory: history.map(s => ({
            totalValue: parseFloat(s.totalValue),
            timestamp: Number(s.timestamp),
          })),
          bets: userBets.map(b => ({
            prediction: b.prediction, amount: parseFloat(b.amount),
            status: b.status, payout: b.payout ? parseFloat(b.payout) : null,
          })),
          betStats: {
            total: userBets.length,
            won: userBets.filter(b => b.status === "won").length,
            lost: userBets.filter(b => b.status === "lost").length,
            pending: userBets.filter(b => b.status === "pending").length,
            totalWinnings: userBets.filter(b => b.status === "won").reduce((s, b) => s + parseFloat(b.payout || "0"), 0),
            totalLost: userBets.filter(b => b.status === "lost").reduce((s, b) => s + parseFloat(b.amount), 0),
          },
        };
      }),
  }),

  // ─── Portfolio History (user-specific, no server cache) ───
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

  // ─── Notifications (user-specific, no server cache) ───
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

  // ─── Market Status — cached 10 min ───
  market: router({
    status: publicProcedure.query(async () => {
      return cache.getOrSet("market.status", async () => {
        const status = await getMarketStatus();
        return {
          isOpen: status.isOpen,
          adminHalt: status.adminHalt ?? false,
          reason: status.reason,
          lastActivity: status.lastActivity,
        };
      }, TEN_MIN);
    }),
    toggleHalt: adminProcedure
      .input(z.object({ halt: z.boolean() }))
      .mutation(async ({ input }) => {
        await toggleAdminHalt(input.halt);
        // Invalidate market status cache immediately
        cache.invalidate("market.status");
        return { adminHalt: input.halt, message: input.halt ? "Trading halted by admin" : "Trading resumed by admin" };
      }),
  }),

  // ─── Polling Control ───
  poll: router({
    status: adminProcedure.query(() => {
      return getPollStatus();
    }),
    trigger: adminProcedure.mutation(async () => {
      const result = await pollNow();
      return result;
    }),
    start: adminProcedure.mutation(() => {
      startPolling();
      return { success: true, message: "Polling started (every 2 minutes)" };
    }),
    stop: adminProcedure.mutation(() => {
      stopPolling();
      return { success: true, message: "Polling stopped" };
    }),
    /** Diagnostic: check live game status directly from Riot API (bypasses cache) */
    checkLiveGame: adminProcedure.query(async () => {
      try {
        const account = await fetchFullPlayerData("목도리 도마뱀", "dori");
        const puuid = account.account.puuid;
        const game = await getActiveGame(puuid);
        const cachedStatus = cache.get<boolean>("player.liveGame.check");
        return {
          puuid,
          apiResult: game ? { inGame: true, queueId: game.gameQueueConfigId, gameLength: game.gameLength } : { inGame: false },
          cachedConfirmed: cachedStatus ?? null,
        };
      } catch (err: any) {
        return { error: err?.message, status: err?.response?.status };
      }
    }),
    /** Test Discord bot by sending a leaderboard summary */
    testDiscord: adminProcedure.mutation(async () => {
      const { notifyDailySummary, isDiscordConfigured } = await import("./discord");
      if (!isDiscordConfigured()) return { success: false, message: "Discord not configured" };

      const { users: allUsers, holdingsByUser } = await getLeaderboard();
      const history = await getPriceHistory();
      const latestSnap = history.length > 0 ? history[history.length - 1] : null;
      const etfPrices = history.length > 0 ? computeAllETFPricesSync(history) : { DORI: 0 };

      const rankings = allUsers.map(u => {
        const cash = u.cashBalance ? parseFloat(u.cashBalance) : 200;
        const userHolds = holdingsByUser.get(u.userId) ?? [];
        let holdVal = 0, shortPnl = 0;
        for (const h of userHolds) {
          const p = (etfPrices as Record<string, number>)[h.ticker] || 0;
          holdVal += parseFloat(h.shares) * p;
          shortPnl += parseFloat(h.shortShares) * (parseFloat(h.shortAvgPrice) - p);
        }
        return { name: String(u.userName || "Unknown"), value: cash + holdVal + shortPnl };
      }).sort((a, b) => b.value - a.value);

      await notifyDailySummary(
        latestSnap?.tier ?? "?", latestSnap?.division ?? "?",
        latestSnap?.lp ?? 0, latestSnap ? parseFloat(latestSnap.price) : 0,
        latestSnap?.wins ?? 0, latestSnap?.losses ?? 0,
        rankings,
      );

      return { success: true, message: "Discord summary sent" };
    }),
  }),

  // ─── Valorant Team Balancer ───
  valorant: router({
    fetchPlayer: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(50), tag: z.string().min(1).max(10), region: z.string().default("na") }))
      .mutation(async ({ input }) => {
        const { fetchPlayerProfile } = await import("./valorant");
        return fetchPlayerProfile(input.name, input.tag, input.region);
      }),
    balanceTeams: protectedProcedure
      .input(z.object({
        players: z.array(z.object({ name: z.string(), tag: z.string(), region: z.string() })).length(10),
      }))
      .mutation(async ({ input }) => {
        const { fetchPlayerProfile, balanceTeams } = await import("./valorant");
        const profiles = [];
        for (const pl of input.players) {
          try {
            const profile = await fetchPlayerProfile(pl.name, pl.tag, pl.region);
            profiles.push(profile);
          } catch (err: any) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Failed to fetch ${pl.name}#${pl.tag}: ${err.message}` });
          }
        }
        return balanceTeams(profiles);
      }),
  }),

  // ─── Admin SQL Console (admin only) ───
  admin: router({
    sql: adminProcedure
      .input(z.object({ query: z.string().min(1).max(10000) }))
      .mutation(async ({ input }) => {
        const client = getRawClient();
        const startTime = Date.now();
        try {
          const result = await client.execute(input.query);
          const duration = Date.now() - startTime;
          return {
            success: true,
            columns: result.columns,
            rows: result.rows.map(row => {
              // Convert Row to plain object
              const obj: Record<string, unknown> = {};
              result.columns.forEach((col, i) => {
                obj[col] = row[i];
              });
              return obj;
            }),
            rowCount: result.rows.length,
            rowsAffected: result.rowsAffected,
            duration,
          };
        } catch (err: any) {
          const duration = Date.now() - startTime;
          return {
            success: false,
            error: err.message || String(err),
            columns: [],
            rows: [],
            rowCount: 0,
            rowsAffected: 0,
            duration,
          };
        }
      }),
    seedHistory: adminProcedure.mutation(async () => {
      // Generate historical price data from Sep 2025 to Mar 2026
      // based on the player's known season progression
      const { tierToPrice, tierToTotalLP } = await import("./riotApi");
      const { addPriceSnapshot, getPriceHistory } = await import("./db");

      // Check existing data to avoid duplicates
      const existing = await getPriceHistory();
      if (existing.length > 20) {
        return { success: false, message: `Already have ${existing.length} price snapshots, skipping seed.`, inserted: 0 };
      }

      // Historical LP progression (approximate, based on season history + match patterns)
      // S2025 ended Emerald 4 (9 LP), S2026 currently Emerald 2 (38 LP)
      // Generate daily snapshots showing a realistic climb
      const dataPoints: Array<{
        date: string; tier: string; division: string; lp: number;
        wins: number; losses: number;
      }> = [];

      // Sep 2025: Season start, placed around Plat 4
      const addRange = (startDate: string, endDate: string, tiers: Array<{tier: string; div: string; lpStart: number; lpEnd: number}>) => {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        const totalDays = Math.round((end - start) / (24 * 60 * 60 * 1000));
        let currentTierIdx = 0;
        for (let d = 0; d <= totalDays; d++) {
          const progress = d / totalDays;
          // Find which tier segment we're in
          const segProgress = progress * tiers.length;
          currentTierIdx = Math.min(Math.floor(segProgress), tiers.length - 1);
          const segLocal = segProgress - currentTierIdx;
          const t = tiers[currentTierIdx];
          const lp = Math.round(t.lpStart + (t.lpEnd - t.lpStart) * Math.min(segLocal * tiers.length / (tiers.length), 1));
          // Add some daily variance (-15 to +15 LP)
          const variance = Math.round(Math.sin(d * 2.7 + d * d * 0.03) * 15);
          const finalLP = Math.max(0, Math.min(99, lp + variance));
          const date = new Date(start + d * 24 * 60 * 60 * 1000);
          const wins = 50 + Math.round(progress * 65);
          const losses = 48 + Math.round(progress * 63);
          dataPoints.push({
            date: date.toISOString().split('T')[0],
            tier: t.tier, division: t.div, lp: finalLP,
            wins, losses,
          });
        }
      };

      // Sep 2025: Plat 4 → Plat 3 (placement games + early climb)
      addRange("2025-09-15", "2025-10-15", [
        { tier: "PLATINUM", div: "IV", lpStart: 0, lpEnd: 75 },
        { tier: "PLATINUM", div: "III", lpStart: 0, lpEnd: 50 },
      ]);

      // Oct-Nov 2025: Plat 3 → Plat 1 (steady climb)
      addRange("2025-10-16", "2025-11-30", [
        { tier: "PLATINUM", div: "III", lpStart: 50, lpEnd: 90 },
        { tier: "PLATINUM", div: "II", lpStart: 0, lpEnd: 80 },
        { tier: "PLATINUM", div: "I", lpStart: 0, lpEnd: 60 },
      ]);

      // Dec 2025: Plat 1 → Emerald 4 (promo + dip)
      addRange("2025-12-01", "2025-12-31", [
        { tier: "PLATINUM", div: "I", lpStart: 60, lpEnd: 99 },
        { tier: "EMERALD", div: "IV", lpStart: 0, lpEnd: 40 },
      ]);

      // Jan 2026: Emerald 4 (stuck/tilted, LP oscillation)
      addRange("2026-01-01", "2026-01-31", [
        { tier: "EMERALD", div: "IV", lpStart: 40, lpEnd: 20 },
        { tier: "EMERALD", div: "IV", lpStart: 20, lpEnd: 65 },
      ]);

      // Feb 2026: Emerald 4 → Emerald 3 (recovery)
      addRange("2026-02-01", "2026-02-28", [
        { tier: "EMERALD", div: "IV", lpStart: 65, lpEnd: 99 },
        { tier: "EMERALD", div: "III", lpStart: 0, lpEnd: 70 },
      ]);

      // Mar 2026: Emerald 3 → Emerald 2 (current)
      addRange("2026-03-01", "2026-03-24", [
        { tier: "EMERALD", div: "III", lpStart: 70, lpEnd: 99 },
        { tier: "EMERALD", div: "II", lpStart: 0, lpEnd: 38 },
      ]);

      // Deduplicate by date (keep last entry per date)
      const byDate = new Map<string, typeof dataPoints[0]>();
      for (const dp of dataPoints) {
        byDate.set(dp.date, dp);
      }
      const unique = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

      // Insert into DB
      let inserted = 0;
      for (const dp of unique) {
        const totalLP = tierToTotalLP(dp.tier, dp.division, dp.lp);
        const price = tierToPrice(dp.tier, dp.division, dp.lp);
        const timestamp = new Date(dp.date + "T12:00:00Z").getTime();
        await addPriceSnapshot({
          timestamp, tier: dp.tier, division: dp.division,
          lp: dp.lp, totalLP, price,
          wins: dp.wins, losses: dp.losses,
        });
        inserted++;
      }

      return {
        success: true,
        message: `Seeded ${inserted} historical price snapshots (Sep 2025 - Mar 2026)`,
        inserted,
      };
    }),
    dbStatus: adminProcedure.query(async () => {
      const client = getRawClient();
      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' ORDER BY name"
      );
      const stats: Array<{ table: string; count: number }> = [];
      for (const row of tables.rows) {
        const tableName = row[0] as string;
        const countResult = await client.execute(`SELECT COUNT(*) as c FROM "${tableName}"`);
        stats.push({ table: tableName, count: Number(countResult.rows[0][0]) });
      }
      return {
        tables: stats,
        dbPath: process.env.DATABASE_PATH || "./data/lol-tracker.db",
      };
    }),

    /** Toggle news generation mode: "ai" or "templates" */
    setNewsMode: adminProcedure
      .input(z.object({ mode: z.enum(["ai", "templates"]) }))
      .mutation(async ({ input }) => {
        const client = getRawClient();
        await client.execute(`CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
        await client.execute({
          sql: `INSERT INTO app_config (key, value) VALUES ('news_mode', ?) ON CONFLICT(key) DO UPDATE SET value = ?`,
          args: [input.mode, input.mode],
        });
        return { mode: input.mode };
      }),
    getNewsMode: adminProcedure.query(async () => {
      try {
        const client = getRawClient();
        const result = await client.execute(`SELECT value FROM app_config WHERE key = 'news_mode'`);
        return { mode: result.rows.length > 0 ? String(result.rows[0].value) : "ai" };
      } catch { return { mode: "ai" }; }
    }),

    /** Force-run the AI bot trader immediately (bypasses 10-min cycle) */
    runBot: adminProcedure.mutation(async () => {
      const traded = await forceRunBot();
      const botId = await getBotUserId();
      return { traded, botUserId: botId };
    }),

    /** View bot decision log */
    botLog: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
      .query(async ({ input }) => {
        try {
          const client = getRawClient();
          const result = await client.execute({
            sql: `SELECT id, action, ticker, amount, reasoning, sentiment, confidence, source, success, resultMessage, createdAt FROM bot_decision_log ORDER BY id DESC LIMIT ?`,
            args: [input?.limit ?? 20],
          });
          return (result.rows as any[]).map(row => ({
            id: Number(row.id),
            action: String(row.action),
            ticker: String(row.ticker),
            amount: Number(row.amount),
            reasoning: String(row.reasoning),
            sentiment: String(row.sentiment),
            confidence: Number(row.confidence),
            source: String(row.source),
            success: Number(row.success) === 1,
            resultMessage: row.resultMessage ? String(row.resultMessage) : null,
            createdAt: String(row.createdAt),
          }));
        } catch { return []; }
      }),

    /** Get table schema (column info) */
    tableSchema: adminProcedure
      .input(z.object({ table: z.string() }))
      .query(async ({ input }) => {
        const client = getRawClient();
        const result = await client.execute(`PRAGMA table_info("${input.table.replace(/"/g, '')}")`);  
        return result.rows.map(row => ({
          cid: Number(row[0]),
          name: String(row[1]),
          type: String(row[2]),
          notnull: Number(row[3]) === 1,
          dflt_value: row[4],
          pk: Number(row[5]) === 1,
        }));
      }),

    /** Browse table rows with pagination */
    tableRows: adminProcedure
      .input(z.object({
        table: z.string(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(200).default(50),
        orderBy: z.string().optional(),
        orderDir: z.enum(["asc", "desc"]).default("desc"),
      }))
      .query(async ({ input }) => {
        const client = getRawClient();
        const tableName = input.table.replace(/"/g, '');
        const offset = (input.page - 1) * input.pageSize;
        const orderCol = input.orderBy || 'id';
        const dir = input.orderDir.toUpperCase();
        const result = await client.execute(
          `SELECT * FROM "${tableName}" ORDER BY "${orderCol}" ${dir} LIMIT ${input.pageSize} OFFSET ${offset}`
        );
        const countResult = await client.execute(`SELECT COUNT(*) as c FROM "${tableName}"`);
        const totalRows = Number(countResult.rows[0][0]);
        return {
          columns: result.columns,
          rows: result.rows.map(row => {
            const obj: Record<string, unknown> = {};
            result.columns.forEach((col, i) => { obj[col] = row[i]; });
            return obj;
          }),
          totalRows,
          page: input.page,
          pageSize: input.pageSize,
          totalPages: Math.ceil(totalRows / input.pageSize),
        };
      }),

    /** Update a row by primary key */
    updateRow: adminProcedure
      .input(z.object({
        table: z.string(),
        id: z.union([z.number(), z.string()]),
        updates: z.record(z.string(), z.unknown()),
      }))
      .mutation(async ({ input }) => {
        const client = getRawClient();
        const tableName = input.table.replace(/"/g, '');
        const setClauses = Object.entries(input.updates)
          .map(([key, val]) => `"${key.replace(/"/g, '')}" = ${val === null ? 'NULL' : `'${String(val).replace(/'/g, "''")}'`}`)
          .join(', ');
        const result = await client.execute({
          sql: `UPDATE "${tableName}" SET ${setClauses} WHERE id = ?`,
          args: [input.id],
        });
        cache.invalidateAll();
        return { success: true, rowsAffected: result.rowsAffected };
      }),

    /** Delete a row by primary key */
    deleteRow: adminProcedure
      .input(z.object({
        table: z.string(),
        id: z.union([z.number(), z.string()]),
      }))
      .mutation(async ({ input }) => {
        const client = getRawClient();
        const tableName = input.table.replace(/"/g, '');
        const result = await client.execute({
          sql: `DELETE FROM "${tableName}" WHERE id = ?`,
          args: [input.id],
        });
        cache.invalidateAll();
        return { success: true, rowsAffected: result.rowsAffected };
      }),

    /** Insert a new row */
    insertRow: adminProcedure
      .input(z.object({
        table: z.string(),
        values: z.record(z.string(), z.unknown()),
      }))
      .mutation(async ({ input }) => {
        const client = getRawClient();
        const tableName = input.table.replace(/"/g, '');
        const cols = Object.keys(input.values).map(k => `"${k.replace(/"/g, '')}"`);
        const vals = Object.values(input.values).map(v => v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
        const result = await client.execute(
          `INSERT INTO "${tableName}" (${cols.join(', ')}) VALUES (${vals.join(', ')})`
        );
        cache.invalidateAll();
        return { success: true, rowsAffected: result.rowsAffected };
      }),

    /** Reset a user's cash balance (lookup by display name or user ID) */
    resetUserCash: adminProcedure
      .input(z.object({
        displayName: z.string().optional(),
        userId: z.number().optional(),
        cashAmount: z.number().min(0).finite().default(200),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        let userId: number | null = null;
        let userName: string | null = null;

        if (input.userId) {
          const user = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
          if (user.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: `User with ID ${input.userId} not found` });
          userId = user[0].id;
          userName = user[0].displayName || user[0].name;
        } else if (input.displayName) {
          const allUsers = await db.select().from(users);
          const match = allUsers.find(u => (u.displayName || u.name) === input.displayName);
          if (!match) throw new TRPCError({ code: "NOT_FOUND", message: `User "${input.displayName}" not found` });
          userId = match.id;
          userName = match.displayName || match.name;
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Provide either displayName or userId" });
        }

        // Update portfolio cash
        const portfolio = await getOrCreatePortfolio(userId);
        await db.update(portfolios).set({ cashBalance: input.cashAmount.toFixed(2) }).where(eq(portfolios.userId, userId));
        cache.invalidateAll();

        return {
          success: true,
          userId,
          userName,
          previousCash: portfolio.cashBalance,
          newCash: input.cashAmount.toFixed(2),
        };
      }),
    resetCasinoBalance: adminProcedure
      .input(z.object({
        displayName: z.string().optional(),
        userId: z.number().optional(),
        amount: z.number().min(0).finite().default(20),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        let userId: number | null = null;
        let userName: string | null = null;

        if (input.userId) {
          const user = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
          if (user.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: `User with ID ${input.userId} not found` });
          userId = user[0].id;
          userName = user[0].displayName || user[0].name;
        } else if (input.displayName) {
          const allUsers = await db.select().from(users);
          const match = allUsers.find(u => (u.displayName || u.name) === input.displayName);
          if (!match) throw new TRPCError({ code: "NOT_FOUND", message: `User "${input.displayName}" not found` });
          userId = match.id;
          userName = match.displayName || match.name;
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Provide either displayName or userId" });
        }

        const portfolio = await getOrCreatePortfolio(userId);
        await db.update(portfolios).set({ casinoBalance: input.amount.toFixed(2) }).where(eq(portfolios.userId, userId));
        cache.invalidateAll();

        return {
          success: true, userId, userName,
          previousBalance: portfolio.casinoBalance ?? "20.00",
          newBalance: input.amount.toFixed(2),
        };
      }),
    /** Set casino cooldown for a user (seconds between games, 0 = no cooldown) */
    setCasinoCooldown: adminProcedure
      .input(z.object({
        displayName: z.string().optional(),
        userId: z.number().optional(),
        cooldownSeconds: z.number().min(0).max(86400).int().default(0),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        let userId: number | null = null;
        let userName: string | null = null;

        if (input.userId) {
          const user = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
          if (user.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: `User with ID ${input.userId} not found` });
          userId = user[0].id;
          userName = user[0].displayName || user[0].name;
        } else if (input.displayName) {
          const allUsers = await db.select().from(users);
          const match = allUsers.find(u => (u.displayName || u.name) === input.displayName);
          if (!match) throw new TRPCError({ code: "NOT_FOUND", message: `User "${input.displayName}" not found` });
          userId = match.id;
          userName = match.displayName || match.name;
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Provide either displayName or userId" });
        }

        const client = getRawClient();
        await client.execute(`CREATE TABLE IF NOT EXISTS casino_cooldowns (userId INTEGER PRIMARY KEY, cooldownSeconds INTEGER NOT NULL DEFAULT 0)`);

        if (input.cooldownSeconds === 0) {
          await client.execute({ sql: `DELETE FROM casino_cooldowns WHERE userId = ?`, args: [userId] });
        } else {
          await client.execute({
            sql: `INSERT INTO casino_cooldowns (userId, cooldownSeconds) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET cooldownSeconds = ?`,
            args: [userId, input.cooldownSeconds, input.cooldownSeconds],
          });
        }

        return {
          success: true, userId, userName,
          cooldownSeconds: input.cooldownSeconds,
          message: input.cooldownSeconds === 0
            ? `Removed cooldown for ${userName}`
            : `Set ${input.cooldownSeconds}s cooldown for ${userName}`,
        };
      }),
    /** Grant all cosmetics to admin */
    grantAllCosmetics: adminProcedure.mutation(async ({ ctx }) => {
      const client = getRawClient();
      const items = await client.execute(`SELECT id FROM cosmetic_items`);
      let granted = 0;
      for (const row of items.rows) {
        try {
          await client.execute({ sql: `INSERT OR IGNORE INTO user_cosmetics (userId, cosmeticId) VALUES (?, ?)`, args: [ctx.user.id, Number((row as any).id)] });
          granted++;
        } catch { /* already owned */ }
      }
      cache.invalidate("casino.leaderboard");
      return { success: true, granted, total: items.rows.length };
    }),
    /** Get/Set casino deposit multiplier */
    getCasinoMultiplier: adminProcedure.query(async () => {
      const client = getRawClient();
      try {
        await client.execute(`CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
        const res = await client.execute(`SELECT value FROM app_config WHERE key = 'casino_multiplier'`);
        return { multiplier: res.rows.length > 0 ? Number(res.rows[0].value) : 10 };
      } catch { return { multiplier: 10 }; }
    }),
    setCasinoMultiplier: adminProcedure
      .input(z.object({ multiplier: z.number().min(1).max(100).finite() }))
      .mutation(async ({ input }) => {
        const client = getRawClient();
        await client.execute(`CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
        await client.execute({
          sql: `INSERT INTO app_config (key, value) VALUES ('casino_multiplier', ?) ON CONFLICT(key) DO UPDATE SET value = ?`,
          args: [String(input.multiplier), String(input.multiplier)],
        });
        return { success: true, multiplier: input.multiplier };
      }),
    /** Toggle close friend tag for a user */
    toggleCloseFriend: adminProcedure
      .input(z.object({ displayName: z.string().optional(), userId: z.number().optional() }))
      .mutation(async ({ input }) => {
        const client = getRawClient();
        await client.execute(`CREATE TABLE IF NOT EXISTS close_friends (userId INTEGER PRIMARY KEY, addedAt TEXT DEFAULT (datetime('now')))`);

        const db = await getDb();
        let userId: number | null = null;
        let userName: string | null = null;

        if (input.userId) {
          const user = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
          if (user.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: `User not found` });
          userId = user[0].id;
          userName = user[0].displayName || user[0].name;
        } else if (input.displayName) {
          const allUsers = await db.select().from(users);
          const match = allUsers.find(u => (u.displayName || u.name) === input.displayName);
          if (!match) throw new TRPCError({ code: "NOT_FOUND", message: `User "${input.displayName}" not found` });
          userId = match.id;
          userName = match.displayName || match.name;
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Provide either displayName or userId" });
        }

        const existing = await client.execute({ sql: `SELECT 1 FROM close_friends WHERE userId = ?`, args: [userId] });
        if (existing.rows.length > 0) {
          await client.execute({ sql: `DELETE FROM close_friends WHERE userId = ?`, args: [userId] });
          cache.invalidateAll();
          return { success: true, userId, userName, isCloseFriend: false, message: `Removed ${userName} from Close Friends` };
        } else {
          await client.execute({ sql: `INSERT INTO close_friends (userId) VALUES (?)`, args: [userId] });
          cache.invalidateAll();
          return { success: true, userId, userName, isCloseFriend: true, message: `Added ${userName} to Close Friends` };
        }
      }),
    /** List all close friends */
    listCloseFriends: adminProcedure.query(async () => {
      const client = getRawClient();
      try {
        await client.execute(`CREATE TABLE IF NOT EXISTS close_friends (userId INTEGER PRIMARY KEY, addedAt TEXT DEFAULT (datetime('now')))`);
        const result = await client.execute(
          `SELECT cf.userId, COALESCE(u.displayName, u.name) as userName, cf.addedAt
           FROM close_friends cf LEFT JOIN users u ON cf.userId = u.id`
        );
        return (result.rows as any[]).map(r => ({
          userId: Number(r.userId),
          userName: String(r.userName || "Unknown"),
          addedAt: String(r.addedAt),
        }));
      } catch { return []; }
    }),
    /** List all casino cooldowns */
    listCasinoCooldowns: adminProcedure.query(async () => {
      const client = getRawClient();
      try {
        const result = await client.execute(
          `SELECT c.userId, c.cooldownSeconds, COALESCE(u.displayName, u.name) as userName
           FROM casino_cooldowns c LEFT JOIN users u ON c.userId = u.id`
        );
        return (result.rows as any[]).map(r => ({
          userId: Number(r.userId),
          userName: String(r.userName || "Unknown"),
          cooldownSeconds: Number(r.cooldownSeconds),
        }));
      } catch {
        return [];
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
