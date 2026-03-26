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
} from "./db";
import { users, portfolios } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  fetchFullPlayerData, fetchRecentMatches, tierToPrice, tierToTotalLP,
  getActiveGame, getQueueName,
} from "./riotApi";
import { pollNow, getPollStatus, startPolling, stopPolling, type GameEndEvent } from "./pollEngine";
import { forceRunBot, getBotUserId } from "./botTrader";
import { TICKERS, type Ticker, computeAllETFPricesSync, computeETFHistoryFromSnapshots } from "./etfPricing";

/** Cache TTL constants */
const THIRTY_MIN = 30 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;

/** Casino cooldown tracking */
const casinoLastGameTime = new Map<number, number>();

// Clean up stale cooldown entries every 10 min
setInterval(() => {
  const cutoff = Date.now() - 3600_000;
  for (const [userId, time] of Array.from(casinoLastGameTime.entries())) {
    if (time < cutoff) casinoLastGameTime.delete(userId);
  }
}, 600_000);

async function checkCasinoCooldown(userId: number): Promise<void> {
  const client = getRawClient();
  try {
    const result = await client.execute({ sql: `SELECT cooldownSeconds FROM casino_cooldowns WHERE userId = ?`, args: [userId] });
    if (result.rows.length === 0) return; // No cooldown set
    const cooldownSec = Number(result.rows[0].cooldownSeconds);
    if (cooldownSec <= 0) return;

    const lastGame = casinoLastGameTime.get(userId);
    if (lastGame) {
      const elapsed = (Date.now() - lastGame) / 1000;
      if (elapsed < cooldownSec) {
        const remaining = Math.ceil(cooldownSec - elapsed);
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Casino cooldown: wait ${remaining}s before next game.` });
      }
    }
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    // Table doesn't exist yet — no cooldowns
  }
}

function recordCasinoGame(userId: number): void {
  casinoLastGameTime.set(userId, Date.now());
}


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
      // The poll engine sets "player.liveGame.check" only after two consecutive
      // polls agree, preventing false toggles and providing a ~2 min delay.
      const confirmedInGame = cache.get<boolean>("player.liveGame.check");

      // If not confirmed in-game, return early
      if (!confirmedInGame) return { inGame: false as const };

      // Confirmed in-game — fetch game details for the UI banner
      return cache.getOrSet("player.liveGame.details", async () => {
        try {
          const account = await fetchFullPlayerData("목도리 도마뱀", "dori");
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
        // Normalize 'since' to 5-min buckets so cache keys align across requests
        const sinceBucket = input.since ? Math.floor(input.since / 300) * 300 : "all";
        return cache.getOrSet(`prices.etfHistory.${input.ticker}.${sinceBucket}`, async () => {
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
        shares: z.number().positive().finite(), pricePerShare: z.number().positive().finite(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Block trading during admin halt, live games, or market closed
        const market = await getMarketStatus();
        if (market.adminHalt) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Trading halted by admin." });
        const liveGame = cache.get<boolean>("player.liveGame.check") ?? false;
        if (liveGame) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Trading halted — player is in a live game. Trades resume after the match ends." });
        if (!market.isOpen) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Market is currently closed: " + (market.reason || "") });

        // Server-side price validation: compute real ETF price and reject stale client prices
        const history = await getPriceHistory() ?? [];
        const etfPrices = history.length > 0 ? computeAllETFPricesSync(history) : null;
        const serverPrice = etfPrices ? etfPrices[input.ticker] : input.pricePerShare;
        if (etfPrices && Math.abs(input.pricePerShare - serverPrice) / serverPrice > 0.005) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Price has changed. Please refresh and try again." });
        }

        let result;
        try {
          result = await executeTrade(ctx.user.id, input.ticker, input.type, input.shares, serverPrice);
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message || "Trade failed" });
        }

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
        ticker: z.enum(TICKERS), shares: z.number().positive().finite(),
        pricePerShare: z.number().positive().finite(),
      }))
      .mutation(async ({ ctx, input }) => {

        const market = await getMarketStatus();
        if (market.adminHalt) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Trading halted by admin." });
        const liveGame = cache.get<boolean>("player.liveGame.check") ?? false;
        if (liveGame) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Trading halted — player is in a live game. Trades resume after the match ends." });
        if (!market.isOpen) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Market is currently closed" });

        // Server-side price validation
        const history = await getPriceHistory() ?? [];
        const etfPrices = history.length > 0 ? computeAllETFPricesSync(history) : null;
        const serverPrice = etfPrices ? etfPrices[input.ticker] : input.pricePerShare;
        if (etfPrices && Math.abs(input.pricePerShare - serverPrice) / serverPrice > 0.005) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Price has changed. Please refresh and try again." });
        }

        let result;
        try {
          result = await executeShort(ctx.user.id, input.ticker, input.shares, serverPrice);
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message || "Short failed" });
        }

        cache.invalidate("ledger.all");
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

        // Server-side price validation
        const history = await getPriceHistory() ?? [];
        const etfPrices = history.length > 0 ? computeAllETFPricesSync(history) : null;
        const serverPrice = etfPrices ? etfPrices[input.ticker] : input.pricePerShare;
        if (etfPrices && Math.abs(input.pricePerShare - serverPrice) / serverPrice > 0.005) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Price has changed. Please refresh and try again." });
        }

        let result;
        try {
          result = await executeCover(ctx.user.id, input.ticker, input.shares, serverPrice);
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message || "Cover failed" });
        }

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
           return raw.map((t) => ({
             id: t.id, userId: t.userId, userName: t.userName ?? "Anonymous",
             ticker: t.ticker, type: t.type,
             shares: parseFloat(t.shares), pricePerShare: parseFloat(t.pricePerShare),
             totalAmount: parseFloat(t.totalAmount),
             createdAt: typeof t.createdAt === 'string' && !t.createdAt.endsWith('Z') ? t.createdAt + 'Z' : (t.createdAt ?? null),
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
        const newsLimit = input?.limit ?? 20;
        return cache.getOrSet(`news.feed.${newsLimit}`, async () => {
          return getNews(newsLimit);
        }, THIRTY_MIN);
      }),
  }),

  // ─── Game Bets ───
  betting: router({
    place: protectedProcedure
      .input(z.object({
        prediction: z.enum(["win", "loss"]),
        amount: z.number().min(1).max(50).finite(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Block bets during live games
        const liveGame = cache.get<boolean>("player.liveGame.check") ?? false;
        if (liveGame) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Betting locked — game in progress. Place bets before the match starts." });

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
  }),

  // ─── Casino ───
  casino: router({
    crash: router({
      start: protectedProcedure
        .input(z.object({ bet: z.number().min(0.10).max(5).finite(), autoCashout: z.number().min(1.01).optional() }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
          if (input.bet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });

          const db = await getDb();
          await db.update(portfolios).set({ casinoBalance: (casinoCash - input.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));

          const { startCrashGame } = await import("./crash");
          try {
            const game = startCrashGame(ctx.user.id, input.bet, input.autoCashout);
            recordCasinoGame(ctx.user.id);

            // Instant crash — no payout
            if (game.status === "crashed") {
              cache.invalidate("casino.leaderboard");
            }
            return game;
          } catch (err: any) {
            // Refund on error
            await db.update(portfolios).set({ casinoBalance: casinoCash.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
            throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
          }
        }),
      cashout: protectedProcedure.mutation(async ({ ctx }) => {
        const { cashoutCrash } = await import("./crash");
        try {
          const game = cashoutCrash(ctx.user.id);
          if (game.status === "cashed_out" && game.payout > 0) {
            const portfolio = await getOrCreatePortfolio(ctx.user.id);
            const db = await getDb();
            const newCasino = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
            await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          }
          cache.invalidate("casino.leaderboard");
          return game;
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }),
      status: protectedProcedure.query(async ({ ctx }) => {
        const { checkCrashStatus, isPayoutCredited, markPayoutCredited } = await import("./crash");
        const game = checkCrashStatus(ctx.user.id);
        if (game && game.status === "cashed_out" && game.payout > 0 && !isPayoutCredited(ctx.user.id)) {
          // Auto-cashout resolved — credit payout once
          markPayoutCredited(ctx.user.id);
          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const db = await getDb();
          const newCasino = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
          await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          cache.invalidate("casino.leaderboard");
        }
        return game;
      }),
      active: protectedProcedure.query(async ({ ctx }) => {
        const { getActiveCrashGame } = await import("./crash");
        return getActiveCrashGame(ctx.user.id);
      }),
      history: protectedProcedure.query(async ({ ctx }) => {
        const { getCrashHistory } = await import("./crash");
        return getCrashHistory(ctx.user.id);
      }),
    }),
    mines: router({
      start: protectedProcedure
        .input(z.object({ bet: z.number().min(0.10).finite(), mineCount: z.number().int().min(1).max(24) }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
          if (input.bet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });

          const db = await getDb();
          await db.update(portfolios).set({ casinoBalance: (casinoCash - input.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));

          const { startMinesGame } = await import("./mines");
          const game = startMinesGame(ctx.user.id, input.bet, input.mineCount);
          recordCasinoGame(ctx.user.id);
          cache.invalidate("casino.leaderboard");
          return game;
        }),
      reveal: protectedProcedure
        .input(z.object({ position: z.number().int().min(0).max(24) }))
        .mutation(async ({ ctx, input }) => {
          const { revealTile } = await import("./mines");
          try {
            const game = revealTile(ctx.user.id, input.position);
            // If won (all safe tiles found), credit payout
            if (game.status === "won" && game.payout > 0) {
              const portfolio = await getOrCreatePortfolio(ctx.user.id);
              const db = await getDb();
              const newCasino = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
              await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
              cache.invalidate("casino.leaderboard");
            }
            return game;
          } catch (err: any) {
            throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
          }
        }),
      cashout: protectedProcedure.mutation(async ({ ctx }) => {
        const { cashOutMines } = await import("./mines");
        try {
          const game = cashOutMines(ctx.user.id);
          if (game.payout > 0) {
            const portfolio = await getOrCreatePortfolio(ctx.user.id);
            const db = await getDb();
            const newCasino = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
            await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          }
          cache.invalidate("casino.leaderboard");
          return game;
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }),
      active: protectedProcedure.query(async ({ ctx }) => {
        const { getActiveMinesGame } = await import("./mines");
        return getActiveMinesGame(ctx.user.id);
      }),
    }),
    poker: router({
      deal: protectedProcedure
        .input(z.object({ bet: z.number().min(0.10).max(5).finite() }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
          if (input.bet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });

          const db = await getDb();
          await db.update(portfolios).set({ casinoBalance: (casinoCash - input.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));

          const { dealPoker } = await import("./videoPoker");
          try {
            const game = dealPoker(ctx.user.id, input.bet);
            recordCasinoGame(ctx.user.id);
            return game;
          } catch (err: any) {
            await db.update(portfolios).set({ casinoBalance: casinoCash.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
            throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
          }
        }),
      draw: protectedProcedure
        .input(z.object({ held: z.array(z.boolean()).length(5) }))
        .mutation(async ({ ctx, input }) => {
          const { drawPoker } = await import("./videoPoker");
          try {
            const game = drawPoker(ctx.user.id, input.held);
            if (game.payout > 0) {
              const portfolio = await getOrCreatePortfolio(ctx.user.id);
              const db = await getDb();
              const newCasino = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
              await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
            }
            cache.invalidate("casino.leaderboard");
            return game;
          } catch (err: any) {
            throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
          }
        }),
      active: protectedProcedure.query(async ({ ctx }) => {
        const { getActivePokerGame } = await import("./videoPoker");
        return getActivePokerGame(ctx.user.id);
      }),
    }),
    roulette: router({
      spin: protectedProcedure
        .input(z.object({
          bets: z.array(z.object({
            type: z.enum(['straight', 'red', 'black', 'odd', 'even', 'high', 'low', 'dozen1', 'dozen2', 'dozen3', 'column1', 'column2', 'column3']),
            number: z.number().int().min(0).max(36).optional(),
            amount: z.number().min(0.10).finite(),
          })).min(1),
        }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);

          for (const bet of input.bets) {
            if (bet.type === 'straight' && (bet.number === undefined || bet.number < 0 || bet.number > 36)) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Straight bets require a number (0-36)." });
            }
          }

          const totalBet = input.bets.reduce((sum, b) => sum + b.amount, 0);
          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
          if (totalBet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });

          const db = await getDb();
          await db.update(portfolios).set({ casinoBalance: (casinoCash - totalBet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));

          const { spin } = await import("./roulette");
          const result = spin(input.bets);

          if (result.totalPayout > 0) {
            const freshPortfolio = await getOrCreatePortfolio(ctx.user.id);
            const newCasino = parseFloat(freshPortfolio.casinoBalance ?? "0") + result.totalPayout;
            await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          }

          recordCasinoGame(ctx.user.id);
          cache.invalidate("casino.leaderboard");
          return result;
        }),
      history: publicProcedure.query(async () => {
        const { getHistory } = await import("./roulette");
        return getHistory();
      }),
    }),
    dice: router({
      roll: protectedProcedure
        .input(z.object({ bet: z.number().min(0.10).max(5).finite(), target: z.number().min(1).max(99), direction: z.enum(["over", "under"]) }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
          if (input.bet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });
          const db = await getDb();
          await db.update(portfolios).set({ casinoBalance: (casinoCash - input.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          const { roll } = await import("./dice");
          const result = roll(input.bet, input.target, input.direction);
          if (result.payout > 0) {
            const fresh = await getOrCreatePortfolio(ctx.user.id);
            const newBal = parseFloat(fresh.casinoBalance ?? "0") + result.payout;
            await db.update(portfolios).set({ casinoBalance: newBal.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          }
          recordCasinoGame(ctx.user.id);
          cache.invalidate("casino.leaderboard");
          return result;
        }),
      history: publicProcedure.query(async () => {
        const { getHistory } = await import("./dice");
        return getHistory();
      }),
    }),
    limbo: router({
      play: protectedProcedure
        .input(z.object({ bet: z.number().min(0.10).max(5).finite(), targetMultiplier: z.number().min(1.01).max(1000) }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
          if (input.bet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });
          const db = await getDb();
          await db.update(portfolios).set({ casinoBalance: (casinoCash - input.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          const { play } = await import("./limbo");
          const result = play(input.bet, input.targetMultiplier);
          if (result.payout > 0) {
            const fresh = await getOrCreatePortfolio(ctx.user.id);
            const newBal = parseFloat(fresh.casinoBalance ?? "0") + result.payout;
            await db.update(portfolios).set({ casinoBalance: newBal.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          }
          recordCasinoGame(ctx.user.id);
          cache.invalidate("casino.leaderboard");
          return result;
        }),
      history: publicProcedure.query(async () => {
        const { getHistory } = await import("./limbo");
        return getHistory();
      }),
    }),
    hilo: router({
      start: protectedProcedure
        .input(z.object({ bet: z.number().min(0.10).max(5).finite() }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
          if (input.bet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });
          const db = await getDb();
          await db.update(portfolios).set({ casinoBalance: (casinoCash - input.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          const { startHiloGame } = await import("./hilo");
          const game = startHiloGame(ctx.user.id, input.bet);
          recordCasinoGame(ctx.user.id);
          cache.invalidate("casino.leaderboard");
          return game;
        }),
      guess: protectedProcedure
        .input(z.object({ direction: z.enum(["higher", "lower"]) }))
        .mutation(async ({ ctx, input }) => {
          const { guessHilo } = await import("./hilo");
          try {
            const game = guessHilo(ctx.user.id, input.direction);
            if (game.status === "won" && game.payout > 0) {
              const portfolio = await getOrCreatePortfolio(ctx.user.id);
              const db = await getDb();
              const newBal = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
              await db.update(portfolios).set({ casinoBalance: newBal.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
              cache.invalidate("casino.leaderboard");
            }
            return game;
          } catch (err: any) { throw new TRPCError({ code: "BAD_REQUEST", message: err.message }); }
        }),
      cashout: protectedProcedure.mutation(async ({ ctx }) => {
        const { cashOutHilo } = await import("./hilo");
        try {
          const game = cashOutHilo(ctx.user.id);
          if (game.payout > 0) {
            const portfolio = await getOrCreatePortfolio(ctx.user.id);
            const db = await getDb();
            const newBal = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
            await db.update(portfolios).set({ casinoBalance: newBal.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          }
          cache.invalidate("casino.leaderboard");
          return game;
        } catch (err: any) { throw new TRPCError({ code: "BAD_REQUEST", message: err.message }); }
      }),
      active: protectedProcedure.query(async ({ ctx }) => {
        const { getActiveHiloGame } = await import("./hilo");
        return getActiveHiloGame(ctx.user.id);
      }),
    }),
    wheel: router({
      spin: protectedProcedure
        .input(z.object({ bet: z.number().min(0.10).max(5).finite() }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
          if (input.bet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });
          const db = await getDb();
          await db.update(portfolios).set({ casinoBalance: (casinoCash - input.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          const { spin } = await import("./wheel");
          const result = spin(input.bet);
          if (result.payout > 0) {
            const fresh = await getOrCreatePortfolio(ctx.user.id);
            const newBal = parseFloat(fresh.casinoBalance ?? "0") + result.payout;
            await db.update(portfolios).set({ casinoBalance: newBal.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          }
          recordCasinoGame(ctx.user.id);
          cache.invalidate("casino.leaderboard");
          return result;
        }),
      history: publicProcedure.query(async () => {
        const { getHistory } = await import("./wheel");
        return getHistory();
      }),
    }),
    plinko: router({
      drop: protectedProcedure
        .input(z.object({ bet: z.number().min(0.10).max(5).finite(), risk: z.enum(["low", "medium", "high"]) }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
          if (input.bet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });
          const db = await getDb();
          await db.update(portfolios).set({ casinoBalance: (casinoCash - input.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          const { drop } = await import("./plinko");
          const result = drop(input.bet, input.risk);
          if (result.payout > 0) {
            const fresh = await getOrCreatePortfolio(ctx.user.id);
            const newBal = parseFloat(fresh.casinoBalance ?? "0") + result.payout;
            await db.update(portfolios).set({ casinoBalance: newBal.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          }
          recordCasinoGame(ctx.user.id);
          cache.invalidate("casino.leaderboard");
          return result;
        }),
      history: publicProcedure.query(async () => {
        const { getHistory } = await import("./plinko");
        return getHistory();
      }),
    }),
    blackjack: router({
      deal: protectedProcedure
        .input(z.object({ bet: z.number().min(0.10).max(5).finite() }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
          if (input.bet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });

          const { getDb } = await import("./db");
          const db = await getDb();
          const { portfolios } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(portfolios).set({ casinoBalance: (casinoCash - input.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));

          const { dealGame } = await import("./blackjack");
          const game = dealGame(ctx.user.id, input.bet);
          recordCasinoGame(ctx.user.id);

          if (game.status !== "playing" && game.payout > 0) {
            const freshPortfolio = await getOrCreatePortfolio(ctx.user.id);
            const newCasino = parseFloat(freshPortfolio.casinoBalance ?? "0") + game.payout;
            await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          }

          cache.invalidate("casino.leaderboard");
          return game;
        }),
      hit: protectedProcedure.mutation(async ({ ctx }) => {
        const { hitGame } = await import("./blackjack");
        try {
          const game = hitGame(ctx.user.id);
          // If busted, no payout needed (already deducted)
          return game;
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }),
      stand: protectedProcedure.mutation(async ({ ctx }) => {
        const { standGame } = await import("./blackjack");
        try {
          const game = standGame(ctx.user.id);
          if (game.payout > 0) {
            const { getDb } = await import("./db");
            const db = await getDb();
            const { portfolios } = await import("../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            const portfolio = await getOrCreatePortfolio(ctx.user.id);
            const newCasino = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
            await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          }
          cache.invalidate("casino.leaderboard");
          return game;
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }),
      double: protectedProcedure.mutation(async ({ ctx }) => {
        const { doubleDown, getActiveGame: getGame } = await import("./blackjack");
        const currentGame = getGame(ctx.user.id);
        if (!currentGame) throw new TRPCError({ code: "BAD_REQUEST", message: "No active game" });

        const portfolio = await getOrCreatePortfolio(ctx.user.id);
        const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
        const additionalBet = currentGame.bet;
        if (additionalBet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash to double down. Need $${additionalBet.toFixed(2)}.` });

        try {
          const game = doubleDown(ctx.user.id);

          const { getDb } = await import("./db");
          const db = await getDb();
          const { portfolios } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(portfolios).set({ casinoBalance: (casinoCash - additionalBet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          if (game.payout > 0) {
            const freshPortfolio = await getOrCreatePortfolio(ctx.user.id);
            const newCasino = parseFloat(freshPortfolio.casinoBalance ?? "0") + game.payout;
            await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          }
          cache.invalidate("casino.leaderboard");
          return game;
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }),
      active: protectedProcedure.query(async ({ ctx }) => {
        const { getActiveGame: getGame } = await import("./blackjack");
        return getGame(ctx.user.id);
      }),
      balance: protectedProcedure.query(async ({ ctx }) => {
        const portfolio = await getOrCreatePortfolio(ctx.user.id);
        return parseFloat(portfolio.casinoBalance ?? "20.00");
      }),
    }),
    /** Daily bonus: claim once per day, streak increases bonus */
    dailyBonus: protectedProcedure.mutation(async ({ ctx }) => {
      const client = getRawClient();
      const today = new Date().toISOString().split("T")[0];

      // Create table if not exists (idempotent)
      await client.execute(`CREATE TABLE IF NOT EXISTS casino_daily_claims (userId INTEGER PRIMARY KEY, lastClaim TEXT NOT NULL)`);

      // Check last claim from DB
      const existing = await client.execute({ sql: `SELECT lastClaim FROM casino_daily_claims WHERE userId = ?`, args: [ctx.user.id] });
      if (existing.rows.length > 0 && String(existing.rows[0].lastClaim) === today) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Already claimed today. Come back tomorrow!" });
      }

      const bonus = 1.00;
      const portfolio = await getOrCreatePortfolio(ctx.user.id);
      const newBalance = parseFloat(portfolio.casinoBalance ?? "20.00") + bonus;
      const db = await getDb();
      await db.update(portfolios).set({ casinoBalance: newBalance.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));

      // Upsert claim record
      await client.execute({ sql: `INSERT INTO casino_daily_claims (userId, lastClaim) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET lastClaim = ?`, args: [ctx.user.id, today, today] });
      cache.invalidate("casino.leaderboard");

      return { bonus, newBalance };
    }),
    dailyBonusStatus: protectedProcedure.query(async ({ ctx }) => {
      const client = getRawClient();
      const today = new Date().toISOString().split("T")[0];
      try {
        const existing = await client.execute({ sql: `SELECT lastClaim FROM casino_daily_claims WHERE userId = ?`, args: [ctx.user.id] });
        return { claimed: existing.rows.length > 0 && String(existing.rows[0].lastClaim) === today };
      } catch {
        return { claimed: false };
      }
    }),
    /** Get current deposit multiplier (public) */
    depositMultiplier: publicProcedure.query(async () => {
      try {
        const client = getRawClient();
        const res = await client.execute(`SELECT value FROM app_config WHERE key = 'casino_multiplier'`);
        return { multiplier: res.rows.length > 0 ? Number(res.rows[0].value) : 10 };
      } catch { return { multiplier: 10 }; }
    }),
    /** Transfer trading cash → casino balance (configurable multiplier) */
    deposit: protectedProcedure
      .input(z.object({ amount: z.number().min(0.50).max(200).finite() }))
      .mutation(async ({ ctx, input }) => {
        let CASINO_MULTIPLIER = 10;
        try {
          const client = getRawClient();
          const res = await client.execute(`SELECT value FROM app_config WHERE key = 'casino_multiplier'`);
          if (res.rows.length > 0) CASINO_MULTIPLIER = Number(res.rows[0].value) || 10;
        } catch { /* table might not exist, use default */ }
        const portfolio = await getOrCreatePortfolio(ctx.user.id);
        const tradingCash = parseFloat(portfolio.cashBalance);
        const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");

        if (input.amount > tradingCash) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient trading cash. You have $${tradingCash.toFixed(2)}.` });
        }

        const casinoAmount = input.amount * CASINO_MULTIPLIER;
        const db = await getDb();
        await db.update(portfolios).set({
          cashBalance: (tradingCash - input.amount).toFixed(2),
          casinoBalance: (casinoCash + casinoAmount).toFixed(2),
        }).where(eq(portfolios.userId, ctx.user.id));

        cache.invalidate("leaderboard.rankings");
        cache.invalidate("casino.leaderboard");

        return {
          deposited: input.amount,
          received: casinoAmount,
          tradingCash: tradingCash - input.amount,
          casinoCash: casinoCash + casinoAmount,
        };
      }),
    leaderboard: publicProcedure.query(async () => {
      return cache.getOrSet("casino.leaderboard", async () => {
        const client = getRawClient();
        // Try with cosmetics join, fall back to simple query if tables don't exist yet
        try {
          const result = await client.execute(
            `SELECT u.id as userId, COALESCE(u.displayName, u.name) as userName, COALESCE(p.casinoBalance, '20.00') as casinoBalance,
             t.name as titleName, t.cssClass as titleCss, t.tier as titleTier,
             n.name as nameEffectName, n.cssClass as nameEffectCss
             FROM users u LEFT JOIN portfolios p ON u.id = p.userId
             LEFT JOIN user_equipped ue ON u.id = ue.userId
             LEFT JOIN cosmetic_items t ON ue.equippedTitle = t.id
             LEFT JOIN cosmetic_items n ON ue.equippedNameEffect = n.id
             ORDER BY CAST(COALESCE(p.casinoBalance, '20.00') AS REAL) DESC`
          );
          return (result.rows as any[]).map(r => ({
            userId: Number(r.userId),
            userName: String(r.userName || "Anonymous"),
            casinoBalance: parseFloat(String(r.casinoBalance ?? "20.00")),
            profit: parseFloat(String(r.casinoBalance ?? "20.00")) - 20,
            title: r.titleName ? { name: String(r.titleName), cssClass: r.titleCss ? String(r.titleCss) : null, tier: String(r.titleTier) } : null,
            nameEffect: r.nameEffectName ? { name: String(r.nameEffectName), cssClass: r.nameEffectCss ? String(r.nameEffectCss) : null } : null,
          }));
        } catch {
          const result = await client.execute(
            `SELECT u.id as userId, COALESCE(u.displayName, u.name) as userName, COALESCE(p.casinoBalance, '20.00') as casinoBalance
             FROM users u LEFT JOIN portfolios p ON u.id = p.userId ORDER BY CAST(COALESCE(p.casinoBalance, '20.00') AS REAL) DESC`
          );
          return (result.rows as any[]).map(r => ({
            userId: Number(r.userId),
            userName: String(r.userName || "Anonymous"),
            casinoBalance: parseFloat(String(r.casinoBalance ?? "20.00")),
            profit: parseFloat(String(r.casinoBalance ?? "20.00")) - 20,
            title: null,
            nameEffect: null,
          }));
        }
      }, TEN_MIN);
    }),
    shop: router({
      allEquipped: publicProcedure.query(async () => {
        try {
          const client = getRawClient();
          // Get equipped cosmetics
          const result = await client.execute(`
            SELECT ue.userId, t.name as titleName, t.cssClass as titleCss, n.name as nameEffectName, n.cssClass as nameEffectCss
            FROM user_equipped ue
            LEFT JOIN cosmetic_items t ON ue.equippedTitle = t.id
            LEFT JOIN cosmetic_items n ON ue.equippedNameEffect = n.id
            WHERE ue.equippedTitle IS NOT NULL OR ue.equippedNameEffect IS NOT NULL
          `);
          // Get close friends
          let closeFriendIds = new Set<number>();
          try {
            const cf = await client.execute(`SELECT userId FROM close_friends`);
            closeFriendIds = new Set(cf.rows.map((r: any) => Number(r.userId)));
          } catch { /* table might not exist yet */ }

          const equipped = (result.rows as any[]).map(r => ({
            userId: Number(r.userId),
            title: r.titleName ? { name: String(r.titleName), cssClass: r.titleCss ? String(r.titleCss) : null } : null,
            nameEffect: r.nameEffectName ? { name: String(r.nameEffectName), cssClass: r.nameEffectCss ? String(r.nameEffectCss) : null } : null,
            isCloseFriend: closeFriendIds.has(Number(r.userId)),
          }));

          // Also add close friends who don't have cosmetics equipped
          for (const cfId of Array.from(closeFriendIds)) {
            if (!equipped.find(e => e.userId === cfId)) {
              equipped.push({ userId: cfId, title: null, nameEffect: null, isCloseFriend: true });
            }
          }

          return equipped;
        } catch { return []; }
      }),
      catalog: publicProcedure.query(async () => {
        const client = getRawClient();
        try {
          const result = await client.execute(`SELECT id, type, name, tier, price, cssClass, description, category, isLimited, stock FROM cosmetic_items WHERE stock != 0 ORDER BY price ASC`);
          return (result.rows as any[]).map(r => ({
            id: Number(r.id), type: String(r.type), name: String(r.name), tier: String(r.tier),
            price: Number(r.price), cssClass: r.cssClass ? String(r.cssClass) : null,
            description: r.description ? String(r.description) : null, category: r.category ? String(r.category) : null,
            isLimited: Boolean(Number(r.isLimited)), stock: Number(r.stock),
          }));
        } catch { return []; }
      }),
      owned: protectedProcedure.query(async ({ ctx }) => {
        const client = getRawClient();
        try {
          const result = await client.execute({ sql: `SELECT c.id, c.type, c.name, c.tier, c.cssClass, uc.purchasedAt FROM user_cosmetics uc JOIN cosmetic_items c ON uc.cosmeticId = c.id WHERE uc.userId = ? ORDER BY uc.purchasedAt DESC`, args: [ctx.user.id] });
          return (result.rows as any[]).map(r => ({
            id: Number(r.id), type: String(r.type), name: String(r.name), tier: String(r.tier),
            cssClass: r.cssClass ? String(r.cssClass) : null, purchasedAt: String(r.purchasedAt),
          }));
        } catch { return []; }
      }),
      purchase: protectedProcedure
        .input(z.object({ cosmeticId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const client = getRawClient();
          const itemRes = await client.execute({ sql: `SELECT price, stock, name FROM cosmetic_items WHERE id = ?`, args: [input.cosmeticId] });
          if (itemRes.rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Cosmetic not found" });
          const item = itemRes.rows[0];
          const price = Number(item.price);
          const stock = Number(item.stock);
          const name = String(item.name);

          if (stock === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Out of stock" });

          const ownedRes = await client.execute({ sql: `SELECT 1 FROM user_cosmetics WHERE userId = ? AND cosmeticId = ?`, args: [ctx.user.id, input.cosmeticId] });
          if (ownedRes.rows.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "You already own this" });

          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
          if (casinoCash < price) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient funds. You have $${casinoCash.toFixed(2)}, need $${price.toFixed(2)}.` });

          const db = await getDb();
          await db.update(portfolios).set({ casinoBalance: (casinoCash - price).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          await client.execute({ sql: `INSERT INTO user_cosmetics (userId, cosmeticId) VALUES (?, ?)`, args: [ctx.user.id, input.cosmeticId] });

          if (stock > 0) {
            await client.execute({ sql: `UPDATE cosmetic_items SET stock = stock - 1 WHERE id = ?`, args: [input.cosmeticId] });
          }

          cache.invalidate("casino.leaderboard");
          return { success: true, name, newBalance: casinoCash - price };
        }),
      equip: protectedProcedure
        .input(z.object({ type: z.enum(["title", "name_effect"]), cosmeticId: z.number().nullable() }))
        .mutation(async ({ ctx, input }) => {
          const client = getRawClient();

          if (input.cosmeticId !== null) {
            const ownedRes = await client.execute({ sql: `SELECT 1 FROM user_cosmetics WHERE userId = ? AND cosmeticId = ?`, args: [ctx.user.id, input.cosmeticId] });
            if (ownedRes.rows.length === 0) throw new TRPCError({ code: "FORBIDDEN", message: "You don't own this" });
            const typeRes = await client.execute({ sql: `SELECT type FROM cosmetic_items WHERE id = ?`, args: [input.cosmeticId] });
            if (typeRes.rows.length === 0 || String(typeRes.rows[0].type) !== input.type) throw new TRPCError({ code: "BAD_REQUEST", message: "Type mismatch" });
          }

          const column = input.type === "title" ? "equippedTitle" : "equippedNameEffect";
          await client.execute({
            sql: `INSERT INTO user_equipped (userId, ${column}, updatedAt) VALUES (?, ?, datetime('now')) ON CONFLICT(userId) DO UPDATE SET ${column} = ?, updatedAt = datetime('now')`,
            args: [ctx.user.id, input.cosmeticId, input.cosmeticId],
          });

          cache.invalidate("casino.leaderboard");
          return { success: true };
        }),
      equipped: protectedProcedure.query(async ({ ctx }) => {
        const client = getRawClient();
        try {
          const result = await client.execute({
            sql: `SELECT t.id as titleId, t.name as titleName, t.cssClass as titleCss, n.id as nameEffectId, n.name as nameEffectName, n.cssClass as nameEffectCss FROM user_equipped ue LEFT JOIN cosmetic_items t ON ue.equippedTitle = t.id LEFT JOIN cosmetic_items n ON ue.equippedNameEffect = n.id WHERE ue.userId = ?`,
            args: [ctx.user.id],
          });
          if (result.rows.length === 0) return { title: null, nameEffect: null };
          const r = result.rows[0] as any;
          return {
            title: r.titleId ? { id: Number(r.titleId), name: String(r.titleName), cssClass: r.titleCss ? String(r.titleCss) : null } : null,
            nameEffect: r.nameEffectId ? { id: Number(r.nameEffectId), name: String(r.nameEffectName), cssClass: r.nameEffectCss ? String(r.nameEffectCss) : null } : null,
          };
        } catch { return { title: null, nameEffect: null }; }
      }),
    }),
  }),

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
