/**
 * Casino router — all casino game routes.
 * Extracted from routers.ts for maintainability.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { cache } from "../cache";
import { getOrCreatePortfolio, getRawClient, getDb, withUserLock } from "../db";
import { portfolios, users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  checkCasinoCooldown, recordCasinoGame, recordCasinoGameResult,
  releaseCasinoLock, DAILY_CASINO_BONUS, TEN_MIN,
} from "../casinoUtils";

export const casinoRouter = router({
    crash: router({
      start: protectedProcedure
        .input(z.object({ bet: z.number().min(0.10).max(50).finite(), autoCashout: z.number().min(1.01).optional() }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          return withUserLock(ctx.user.id, async () => {
            const portfolio = await getOrCreatePortfolio(ctx.user.id);
            const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
            if (input.bet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });

            const db = await getDb();
            await db.update(portfolios).set({ casinoBalance: (casinoCash - input.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));

            const { startCrashGame } = await import("../crash");
            try {
              const game = startCrashGame(ctx.user.id, input.bet, input.autoCashout);
              recordCasinoGame(ctx.user.id);

              // Instant crash — no payout
              if (game.status === "crashed") {
                cache.invalidate("casino.leaderboard");
                recordCasinoGameResult(ctx.user.id, "crash", input.bet, 0, "loss", game.crashPoint);
              }
              return game;
            } catch (err: any) {
              // Refund on error
              await db.update(portfolios).set({ casinoBalance: casinoCash.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
              throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
            }
          });
        }),
      cashout: protectedProcedure.mutation(async ({ ctx }) => {
        const { cashoutCrash } = await import("../crash");
        try {
          const game = cashoutCrash(ctx.user.id);
          if (game.status === "cashed_out" && game.payout > 0) {
            const portfolio = await getOrCreatePortfolio(ctx.user.id);
            const db = await getDb();
            const newCasino = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
            await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          }
          cache.invalidate("casino.leaderboard");
          if (game.status === "cashed_out") {
            recordCasinoGameResult(ctx.user.id, "crash", game.bet, game.payout, "win", game.cashoutMultiplier);
          } else {
            recordCasinoGameResult(ctx.user.id, "crash", game.bet, 0, "loss", game.crashPoint);
          }
          return game;
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }),
      status: protectedProcedure.query(async ({ ctx }) => {
        const { checkCrashStatus, isPayoutCredited, markPayoutCredited } = await import("../crash");
        const game = checkCrashStatus(ctx.user.id);
        if (game && game.status === "cashed_out" && game.payout > 0 && !isPayoutCredited(ctx.user.id)) {
          // Auto-cashout resolved — credit payout once
          markPayoutCredited(ctx.user.id);
          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const db = await getDb();
          const newCasino = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
          await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          cache.invalidate("casino.leaderboard");
          recordCasinoGameResult(ctx.user.id, "crash", game.bet, game.payout, "win", game.cashoutMultiplier);
        }
        return game;
      }),
      active: protectedProcedure.query(async ({ ctx }) => {
        const { getActiveCrashGame } = await import("../crash");
        return getActiveCrashGame(ctx.user.id);
      }),
      history: protectedProcedure.query(async ({ ctx }) => {
        const { getCrashHistory } = await import("../crash");
        return getCrashHistory(ctx.user.id);
      }),
    }),
    mines: router({
      start: protectedProcedure
        .input(z.object({ bet: z.number().min(0.10).max(50).finite(), mineCount: z.number().int().min(1).max(24) }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          return withUserLock(ctx.user.id, async () => {
            const portfolio = await getOrCreatePortfolio(ctx.user.id);
            const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
            if (input.bet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });

            const db = await getDb();
            await db.update(portfolios).set({ casinoBalance: (casinoCash - input.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));

            const { startMinesGame } = await import("../mines");
            const game = startMinesGame(ctx.user.id, input.bet, input.mineCount);
            recordCasinoGame(ctx.user.id);
            cache.invalidate("casino.leaderboard");
            return game;
          });
        }),
      reveal: protectedProcedure
        .input(z.object({ position: z.number().int().min(0).max(24) }))
        .mutation(async ({ ctx, input }) => {
          const { revealTile } = await import("../mines");
          try {
            const game = revealTile(ctx.user.id, input.position);
            // If won (all safe tiles found), credit payout
            if (game.status === "won" && game.payout > 0) {
              const portfolio = await getOrCreatePortfolio(ctx.user.id);
              const db = await getDb();
              const newCasino = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
              await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
              cache.invalidate("casino.leaderboard");
              recordCasinoGameResult(ctx.user.id, "mines", game.bet, game.payout, "win", game.multiplier);
            } else if (game.status === "lost") {
              recordCasinoGameResult(ctx.user.id, "mines", game.bet, 0, "loss");
            }
            return game;
          } catch (err: any) {
            throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
          }
        }),
      cashout: protectedProcedure.mutation(async ({ ctx }) => {
        const { cashOutMines } = await import("../mines");
        try {
          const game = cashOutMines(ctx.user.id);
          if (game.payout > 0) {
            const portfolio = await getOrCreatePortfolio(ctx.user.id);
            const db = await getDb();
            const newCasino = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
            await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          }
          cache.invalidate("casino.leaderboard");
          recordCasinoGameResult(ctx.user.id, "mines", game.bet, game.payout, "win", game.multiplier);
          return game;
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }),
      active: protectedProcedure.query(async ({ ctx }) => {
        const { getActiveMinesGame } = await import("../mines");
        return getActiveMinesGame(ctx.user.id);
      }),
    }),
    poker: router({
      deal: protectedProcedure
        .input(z.object({ bet: z.number().min(0.10).max(50).finite() }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          return withUserLock(ctx.user.id, async () => {
            const portfolio = await getOrCreatePortfolio(ctx.user.id);
            const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
            if (input.bet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });

            const db = await getDb();
            await db.update(portfolios).set({ casinoBalance: (casinoCash - input.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));

            const { dealPoker } = await import("../videoPoker");
            try {
              const game = dealPoker(ctx.user.id, input.bet);
              recordCasinoGame(ctx.user.id);
              return game;
            } catch (err: any) {
              await db.update(portfolios).set({ casinoBalance: casinoCash.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
              throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
            }
          });
        }),
      draw: protectedProcedure
        .input(z.object({ held: z.array(z.boolean()).length(5) }))
        .mutation(async ({ ctx, input }) => {
          const { drawPoker } = await import("../videoPoker");
          try {
            const game = drawPoker(ctx.user.id, input.held);
            if (game.payout > 0) {
              const portfolio = await getOrCreatePortfolio(ctx.user.id);
              const db = await getDb();
              const newCasino = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
              await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
            }
            cache.invalidate("casino.leaderboard");
            const mult = game.payout > 0 ? game.payout / game.bet : 0;
            recordCasinoGameResult(ctx.user.id, "poker", game.bet, game.payout, game.payout > 0 ? "win" : "loss", mult);
            return game;
          } catch (err: any) {
            throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
          }
        }),
      active: protectedProcedure.query(async ({ ctx }) => {
        const { getActivePokerGame } = await import("../videoPoker");
        return getActivePokerGame(ctx.user.id);
      }),
    }),
    roulette: router({
      spin: protectedProcedure
        .input(z.object({
          type: z.enum(["red", "black", "green"]),
          amount: z.number().min(0.10).max(50).finite(),
        }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          const totalBet = input.amount;
          return withUserLock(ctx.user.id, async () => {
            const portfolio = await getOrCreatePortfolio(ctx.user.id);
            const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
            if (totalBet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });

            const db = await getDb();
            await db.update(portfolios).set({ casinoBalance: (casinoCash - totalBet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));

            const { spin } = await import("../roulette");
            const result = spin({ type: input.type, amount: input.amount });

            if (result.totalPayout > 0) {
              const freshPortfolio = await getOrCreatePortfolio(ctx.user.id);
              const newCasino = parseFloat(freshPortfolio.casinoBalance ?? "0") + result.totalPayout;
              await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
            }

            recordCasinoGame(ctx.user.id);
            cache.invalidate("casino.leaderboard");
            const mult = result.totalPayout > 0 ? result.totalPayout / totalBet : 0;
            recordCasinoGameResult(ctx.user.id, "roulette", totalBet, result.totalPayout, result.totalPayout > 0 ? "win" : "loss", mult);
            return result;
          });
        }),
      history: publicProcedure.query(async () => {
        const { getHistory } = await import("../roulette");
        return getHistory();
      }),
    }),
    dice: router({
      roll: protectedProcedure
        .input(z.object({ bet: z.number().min(0.10).max(50).finite(), target: z.number().min(1).max(99), direction: z.enum(["over", "under"]) }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
          if (input.bet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });
          const db = await getDb();
          await db.update(portfolios).set({ casinoBalance: (casinoCash - input.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          const { roll } = await import("../dice");
          const result = roll(input.bet, input.target, input.direction);
          if (result.payout > 0) {
            const fresh = await getOrCreatePortfolio(ctx.user.id);
            const newBal = parseFloat(fresh.casinoBalance ?? "0") + result.payout;
            await db.update(portfolios).set({ casinoBalance: newBal.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          }
          recordCasinoGame(ctx.user.id);
          cache.invalidate("casino.leaderboard");
          const mult = result.payout > 0 ? result.payout / input.bet : 0;
          recordCasinoGameResult(ctx.user.id, "dice", input.bet, result.payout, result.payout > 0 ? "win" : "loss", mult);
          return result;
        }),
      history: publicProcedure.query(async () => {
        const { getHistory } = await import("../dice");
        return getHistory();
      }),
    }),
    hilo: router({
      start: protectedProcedure
        .input(z.object({ bet: z.number().min(0.10).max(50).finite() }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          const portfolio = await getOrCreatePortfolio(ctx.user.id);
          const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
          if (input.bet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });
          const db = await getDb();
          await db.update(portfolios).set({ casinoBalance: (casinoCash - input.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          const { startHiloGame } = await import("../hilo");
          const game = startHiloGame(ctx.user.id, input.bet);
          recordCasinoGame(ctx.user.id);
          cache.invalidate("casino.leaderboard");
          return game;
        }),
      guess: protectedProcedure
        .input(z.object({ direction: z.enum(["higher", "lower"]) }))
        .mutation(async ({ ctx, input }) => {
          const { guessHilo } = await import("../hilo");
          try {
            const game = guessHilo(ctx.user.id, input.direction);
            if (game.status === "won" && game.payout > 0) {
              const portfolio = await getOrCreatePortfolio(ctx.user.id);
              const db = await getDb();
              const newBal = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
              await db.update(portfolios).set({ casinoBalance: newBal.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
              cache.invalidate("casino.leaderboard");
              recordCasinoGameResult(ctx.user.id, "hilo", game.bet, game.payout, "win", game.multiplier);
            } else if (game.status === "lost") {
              recordCasinoGameResult(ctx.user.id, "hilo", game.bet, 0, "loss");
            }
            return game;
          } catch (err: any) { throw new TRPCError({ code: "BAD_REQUEST", message: err.message }); }
        }),
      cashout: protectedProcedure.mutation(async ({ ctx }) => {
        const { cashOutHilo } = await import("../hilo");
        try {
          const game = cashOutHilo(ctx.user.id);
          if (game.payout > 0) {
            const portfolio = await getOrCreatePortfolio(ctx.user.id);
            const db = await getDb();
            const newBal = parseFloat(portfolio.casinoBalance ?? "0") + game.payout;
            await db.update(portfolios).set({ casinoBalance: newBal.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          }
          cache.invalidate("casino.leaderboard");
          recordCasinoGameResult(ctx.user.id, "hilo", game.bet, game.payout, "win", game.multiplier);
          return game;
        } catch (err: any) { throw new TRPCError({ code: "BAD_REQUEST", message: err.message }); }
      }),
      active: protectedProcedure.query(async ({ ctx }) => {
        const { getActiveHiloGame } = await import("../hilo");
        return getActiveHiloGame(ctx.user.id);
      }),
    }),
    plinko: router({
      drop: protectedProcedure
        .input(z.object({
          bet: z.number().min(0.10).max(50).finite(),
          risk: z.enum(["low", "medium", "high"]),
          count: z.union([z.literal(1), z.literal(3), z.literal(5)]).default(1),
        }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          try {
            const portfolio = await getOrCreatePortfolio(ctx.user.id);
            const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
            const totalBet = Math.round(input.bet * input.count * 100) / 100;
            if (totalBet > casinoCash) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });
            }

            const db = await getDb();
            await db.update(portfolios).set({ casinoBalance: (casinoCash - totalBet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));

            const { dropMany } = await import("../plinko");
            const results = dropMany(input.bet, input.risk, input.count);
            const totalPayout = Math.round(results.reduce((sum, entry) => sum + entry.payout, 0) * 100) / 100;

            if (totalPayout > 0) {
              const fresh = await getOrCreatePortfolio(ctx.user.id);
              const newBal = parseFloat(fresh.casinoBalance ?? "0") + totalPayout;
              await db.update(portfolios).set({ casinoBalance: newBal.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
            }

            recordCasinoGame(ctx.user.id);
            cache.invalidate("casino.leaderboard");
            const avgMult = totalBet > 0 ? totalPayout / totalBet : 0;
            recordCasinoGameResult(ctx.user.id, "plinko", totalBet, totalPayout, totalPayout >= totalBet ? "win" : "loss", avgMult);

            return {
              count: input.count,
              totalBet,
              totalPayout,
              results,
            };
          } finally {
            releaseCasinoLock(ctx.user.id);
          }
        }),
      history: publicProcedure.query(async () => {
        const { getHistory } = await import("../plinko");
        return getHistory();
      }),
    }),
    blackjack: router({
      deal: protectedProcedure
        .input(z.object({ bet: z.number().min(0.10).max(50).finite() }))
        .mutation(async ({ ctx, input }) => {
          await checkCasinoCooldown(ctx.user.id);
          return withUserLock(ctx.user.id, async () => {
            const portfolio = await getOrCreatePortfolio(ctx.user.id);
            const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
            if (input.bet > casinoCash) throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash. You have $${casinoCash.toFixed(2)}.` });

            const db = await getDb();
            await db.update(portfolios).set({ casinoBalance: (casinoCash - input.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));

            const { dealGame } = await import("../blackjack");
            const game = dealGame(ctx.user.id, input.bet);
            recordCasinoGame(ctx.user.id);

            if (game.status !== "playing" && game.payout > 0) {
              const freshPortfolio = await getOrCreatePortfolio(ctx.user.id);
              const newCasino = parseFloat(freshPortfolio.casinoBalance ?? "0") + game.payout;
              await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
            }

            cache.invalidate("casino.leaderboard");
            if (game.status !== "playing") {
              const mult = game.payout > 0 ? game.payout / game.bet : 0;
              recordCasinoGameResult(ctx.user.id, "blackjack", game.bet, game.payout, game.payout > 0 ? "win" : "loss", mult);
            }
            return game;
          });
        }),
      hit: protectedProcedure.mutation(async ({ ctx }) => {
        const { hitGame } = await import("../blackjack");
        try {
          const game = hitGame(ctx.user.id);
          if (game.status === "player_bust") {
            recordCasinoGameResult(ctx.user.id, "blackjack", game.bet, 0, "loss");
          }
          return game;
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }),
      stand: protectedProcedure.mutation(async ({ ctx }) => {
        const { standGame } = await import("../blackjack");
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
          const mult = game.payout > 0 ? game.payout / game.bet : 0;
          recordCasinoGameResult(ctx.user.id, "blackjack", game.bet, game.payout, game.payout > 0 ? "win" : "loss", mult);
          return game;
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }),
      double: protectedProcedure.mutation(async ({ ctx }) => {
        const { doubleDown, getActiveGame: getGame } = await import("../blackjack");
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
          if (game.status !== "playing") {
            const totalBet = game.bet; // doubled bet is already included
            const mult = game.payout > 0 ? game.payout / totalBet : 0;
            recordCasinoGameResult(ctx.user.id, "blackjack", totalBet, game.payout, game.payout > 0 ? "win" : "loss", mult);
          }
          return game;
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }),
      split: protectedProcedure.mutation(async ({ ctx }) => {
        const { splitGame, getActiveGame: getGame, canSplit: checkSplit } = await import("../blackjack");
        const currentGame = getGame(ctx.user.id);
        if (!currentGame) throw new TRPCError({ code: "BAD_REQUEST", message: "No active game" });

        // Check balance for the additional bet
        const portfolio = await getOrCreatePortfolio(ctx.user.id);
        const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
        if (currentGame.bet > casinoCash) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient casino cash to split. Need $${currentGame.bet.toFixed(2)}.` });
        }

        try {
          const game = splitGame(ctx.user.id);
          // Deduct the additional bet for the split hand
          const db = await getDb();
          await db.update(portfolios).set({ casinoBalance: (casinoCash - currentGame.bet).toFixed(2) }).where(eq(portfolios.userId, ctx.user.id));
          cache.invalidate("casino.leaderboard");

          // If split resolved immediately (split aces), record result
          if (game.status !== "playing") {
            const totalBet = game.bet + (game.splitBet ?? 0);
            const mult = game.payout > 0 ? game.payout / totalBet : 0;
            recordCasinoGameResult(ctx.user.id, "blackjack", totalBet, game.payout, game.payout > 0 ? "win" : "loss", mult);
          }
          return game;
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }),
      active: protectedProcedure.query(async ({ ctx }) => {
        const { getActiveGame: getGame } = await import("../blackjack");
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

      const bonus = DAILY_CASINO_BONUS;
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
    gameHistory: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50), gameType: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const client = getRawClient();
        try {
          const limit = input?.limit ?? 50;
          const gameType = input?.gameType;
          const sql = gameType
            ? `SELECT * FROM casino_game_history WHERE userId = ? AND gameType = ? ORDER BY createdAt DESC LIMIT ?`
            : `SELECT * FROM casino_game_history WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`;
          const args = gameType ? [ctx.user.id, gameType, limit] : [ctx.user.id, limit];
          const result = await client.execute({ sql, args });
          return (result.rows as any[]).map(r => ({
            id: Number(r.id), gameType: String(r.gameType),
            bet: parseFloat(String(r.bet)), payout: parseFloat(String(r.payout)),
            result: String(r.result), multiplier: r.multiplier ? parseFloat(String(r.multiplier)) : null,
            createdAt: String(r.createdAt),
          }));
        } catch { return []; }
      }),
    /** Public game feed — recent results across all players */
    gameFeed: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit ?? 20;
        return cache.getOrSet(`casino.gameFeed.${limit}`, async () => {
          try {
            const client = getRawClient();
            const result = await client.execute({
              sql: `SELECT h.id, h.userId, COALESCE(u.displayName, u.name) as userName,
                h.gameType, h.bet, h.payout, h.result, h.multiplier, h.createdAt,
                n.cssClass as nameEffectCss
                FROM casino_game_history h
                LEFT JOIN users u ON h.userId = u.id
                LEFT JOIN user_equipped ue ON h.userId = ue.userId
                LEFT JOIN cosmetic_items n ON ue.equippedNameEffect = n.id
                ORDER BY h.id DESC LIMIT ?`,
              args: [limit],
            });
            return (result.rows as any[]).map(row => ({
              id: Number(row.id),
              userId: Number(row.userId),
              userName: String(row.userName || "Anonymous"),
              game: String(row.gameType),
              bet: parseFloat(String(row.bet)),
              payout: parseFloat(String(row.payout)),
              result: String(row.result),
              multiplier: row.multiplier ? parseFloat(String(row.multiplier)) : null,
              createdAt: String(row.createdAt),
              nameEffectCss: row.nameEffectCss ? String(row.nameEffectCss) : null,
            }));
          } catch { return []; }
        }, 10_000); // 10s cache
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
});
