import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getOrCreatePortfolio, executeTrade, getUserTrades } from "./db";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  trading: router({
    // Get user's portfolio (cash balance + shares)
    portfolio: protectedProcedure.query(async ({ ctx }) => {
      const portfolio = await getOrCreatePortfolio(ctx.user.id);
      return {
        cashBalance: parseFloat(portfolio.cashBalance),
        sharesOwned: parseFloat(portfolio.sharesOwned),
      };
    }),

    // Execute a trade (buy or sell)
    trade: protectedProcedure
      .input(
        z.object({
          type: z.enum(["buy", "sell"]),
          shares: z.number().positive(),
          pricePerShare: z.number().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const updated = await executeTrade(
          ctx.user.id,
          input.type,
          input.shares,
          input.pricePerShare
        );
        return {
          cashBalance: parseFloat(updated.cashBalance),
          sharesOwned: parseFloat(updated.sharesOwned),
        };
      }),

    // Get trade history
    history: protectedProcedure.query(async ({ ctx }) => {
      const tradeList = await getUserTrades(ctx.user.id);
      return tradeList.map((t) => ({
        id: t.id,
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
