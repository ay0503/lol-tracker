import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
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
  getRawClient, getDb,
} from "./db";
import { users, portfolios } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  fetchFullPlayerData, fetchRecentMatches, tierToPrice, tierToTotalLP,
  getActiveGame, getQueueName,
} from "./riotApi";
import { pollNow, getPollStatus, startPolling, stopPolling } from "./pollEngine";
import { forceRunBot, getBotUserId } from "./botTrader";
import { TICKERS, type Ticker, computeAllETFPricesSync, computeETFHistoryFromSnapshots } from "./etfPricing";

/** Cache TTL constants */
const THIRTY_MIN = 30 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
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
        const existing = await getUserByEmail(input.email);
        if (existing && existing.passwordHash) {
          throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
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
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true };
      }),
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
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
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
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
      // The poll engine sets "player.liveGame.check" only after two consecutive
      // polls agree, preventing false toggles and providing a ~2 min delay.
      const confirmedInGame = cache.get<boolean>("player.liveGame.check");

      // If not confirmed in-game, return early
      if (!confirmedInGame) return { inGame: false as const };

      // Confirmed in-game — fetch game details for the UI banner
      return cache.getOrSet("player.liveGame.details", async () => {
        try {
          const account = await fetchFullPlayerData("목도리 도마뱰", "dori");
          const game = await getActiveGame(account.account.puuid);
          if (!game) return { inGame: true as const }; // confirmed but details unavailable

          const playerParticipant = game.participants.find(p => p.puuid === account.account.puuid);
          const gameStartTime = game.gameStartTime;
          const gameLengthSeconds = game.gameLength;
          const queueName = getQueueName(game.gameQueueConfigId);
          const isRanked = game.gameQueueConfigId === 420 || game.gameQueueConfigId === 440;

          return {
            inGame: true as const,
            gameMode: queueName,
            gameStartTime,
            gameLengthSeconds,
            championId: playerParticipant?.championId ?? 0,
            teamId: playerParticipant?.teamId ?? 0,
            isRanked,
            queueId: game.gameQueueConfigId,
          };
        } catch (err: any) {
          console.warn("[LiveGame] Details fetch failed:", err?.message);
          return { inGame: true as const }; // confirmed but details unavailable
        }
      }, 60_000);
    }),
  }),

  // ─── Live Stats (computed from stored matches) — cached 30 min ───
  stats: router({
    championPool: publicProcedure.query(async () => {
      return cache.getOrSet("stats.championPool", async () => {
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
          const allMatches = await getAllMatchesFromDB();
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
        }, THIRTY_MIN);
      }),
    latest: publicProcedure.query(async () => {
      return cache.getOrSet("prices.latest", async () => {
        return getLatestPrice();
      }, THIRTY_MIN);
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
      }, THIRTY_MIN);
    }),
    etfHistory: publicProcedure
      .input(z.object({
        ticker: z.enum(TICKERS),
        since: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return cache.getOrSet(`prices.etfHistory.${input.ticker}.${input.since ?? "all"}`, async () => {
          const history = await getPriceHistory(input.since);
          return computeETFHistoryFromSnapshots(input.ticker, history);
        }, THIRTY_MIN);
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
        shares: z.number().positive(), pricePerShare: z.number().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Block trading during live games
        const liveGame = await cache.getOrSet("player.liveGame.check", async () => {
          try {
            const account = await fetchFullPlayerData("목도리 도마뱀", "dori");
            const game = await getActiveGame(account.account.puuid);
            return !!game;
          } catch { return false; }
        }, 30_000);
        if (liveGame) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Trading halted — player is in a live game. Trades resume after the match ends." });
        const market = await getMarketStatus();
        if (!market.isOpen) throw new Error("Market is currently closed: " + (market.reason || ""));
        const result = await executeTrade(ctx.user.id, input.ticker, input.type, input.shares, input.pricePerShare);
        // Invalidate ledger and leaderboard caches after trade
        cache.invalidate("ledger.all");
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
         return raw.map((t) => ({
           id: t.id, ticker: t.ticker, type: t.type,
           shares: parseFloat(t.shares), pricePerShare: parseFloat(t.pricePerShare),
           totalAmount: parseFloat(t.totalAmount),
           createdAt: typeof t.createdAt === 'string' && !t.createdAt.endsWith('Z') ? t.createdAt + 'Z' : (t.createdAt ?? null),
         }));
      }),

    short: protectedProcedure
      .input(z.object({
        ticker: z.enum(TICKERS), shares: z.number().positive(),
        pricePerShare: z.number().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const liveGame = await cache.getOrSet("player.liveGame.check", async () => {
          try {
            const account = await fetchFullPlayerData("목도리 도마뱀", "dori");
            const game = await getActiveGame(account.account.puuid);
            return !!game;
          } catch { return false; }
        }, 30_000);
        if (liveGame) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Trading halted — player is in a live game. Trades resume after the match ends." });
        const market = await getMarketStatus();
        if (!market.isOpen) throw new Error("Market is currently closed");
        const result = await executeShort(ctx.user.id, input.ticker, input.shares, input.pricePerShare);
        cache.invalidate("ledger.all");
        cache.invalidate("leaderboard.rankings");
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
        const liveGame = await cache.getOrSet("player.liveGame.check", async () => {
          try {
            const account = await fetchFullPlayerData("목도리 도마뱀", "dori");
            const game = await getActiveGame(account.account.puuid);
            return !!game;
          } catch { return false; }
        }, 30_000);
        if (liveGame) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Trading halted — player is in a live game. Trades resume after the match ends." });
        const market = await getMarketStatus();
        if (!market.isOpen) throw new Error("Market is currently closed");
        const result = await executeCover(ctx.user.id, input.ticker, input.shares, input.pricePerShare);
        cache.invalidate("ledger.all");
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
        shares: z.number().positive(),
        targetPrice: z.number().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const liveGame = await cache.getOrSet("player.liveGame.check", async () => {
          try {
            const account = await fetchFullPlayerData("목도리 도마뱀", "dori");
            const game = await getActiveGame(account.account.puuid);
            return !!game;
          } catch { return false; }
        }, 30_000);
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
        return cache.getOrSet(`ledger.all`, async () => {
          const raw = await getAllTrades(limit);
           return raw.map((t) => ({
             id: t.id, userName: t.userName ?? "Anonymous",
             ticker: t.ticker, type: t.type,
             shares: parseFloat(t.shares), pricePerShare: parseFloat(t.pricePerShare),
             totalAmount: parseFloat(t.totalAmount),
             createdAt: typeof t.createdAt === 'string' && !t.createdAt.endsWith('Z') ? t.createdAt + 'Z' : (t.createdAt ?? null),
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
        return cache.getOrSet(`comments.list`, async () => {
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
        ticker: z.string().nullable().default(null),
        sentiment: z.enum(["bullish", "bearish", "neutral"]).default("neutral"),
      }))
      .mutation(async ({ ctx, input }) => {
        await postComment(ctx.user.id, input.content, input.ticker, input.sentiment);
        cache.invalidate("comments.list");
        return { success: true };
      }),
  }),

  // ─── News Feed — cached 30 min ───
  news: router({
    feed: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        return cache.getOrSet("news.feed", async () => {
          return getNews(input?.limit ?? 20);
        }, THIRTY_MIN);
      }),
  }),

  // ─── Leaderboard — cached 10 min ───
  leaderboard: router({
    rankings: publicProcedure.query(async () => {
      return cache.getOrSet("leaderboard.rankings", async () => {
        const { users: allUsers, holdings: allHoldings } = await getLeaderboard();
        const history = await getPriceHistory();
        const tickerPrices: Record<string, number> = history.length > 0
          ? computeAllETFPricesSync(history)
          : { DORI: 50, DDRI: 50, TDRI: 50, SDRI: 50, XDRI: 50 };

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
        return rankings;
      }, TEN_MIN);
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
          reason: status.reason,
          lastActivity: status.lastActivity,
        };
      }, TEN_MIN);
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
      return { success: true, message: "Polling started (every 2 minutes)" };
    }),
    stop: publicProcedure.mutation(() => {
      stopPolling();
      return { success: true, message: "Polling stopped" };
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

    /** Force-run the AI bot trader immediately (bypasses 10-min cycle) */
    runBot: adminProcedure.mutation(async () => {
      const traded = await forceRunBot();
      const botId = await getBotUserId();
      return { traded, botUserId: botId };
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
        const result = await client.execute(
          `UPDATE "${tableName}" SET ${setClauses} WHERE id = ${typeof input.id === 'string' ? `'${input.id}'` : input.id}`
        );
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
        const result = await client.execute(
          `DELETE FROM "${tableName}" WHERE id = ${typeof input.id === 'string' ? `'${input.id}'` : input.id}`
        );
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
        return { success: true, rowsAffected: result.rowsAffected };
      }),

    /** Reset a user's cash balance (lookup by display name or user ID) */
    resetUserCash: adminProcedure
      .input(z.object({
        displayName: z.string().optional(),
        userId: z.number().optional(),
        cashAmount: z.number().min(0).default(200),
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

        return {
          success: true,
          userId,
          userName,
          previousCash: portfolio.cashBalance,
          newCash: input.cashAmount.toFixed(2),
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
