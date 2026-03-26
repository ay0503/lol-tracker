# Server-Side Guide: $DORI LP Tracker

## 1. Router Structure

The main router is exported from `/home/ayoun/lol-tracker/server/routers.ts`:

```ts
export const appRouter = router({
  system: systemRouter,
  auth: router({ ... }),
  player: router({ ... }),
  stats: router({ ... }),
  prices: router({ ... }),
  trading: router({ ... }),
  ledger: router({ ... }),
  casino: router({ ... }),
  cosmetics: router({ ... }),
  admin: router({ ... }),
});
```

**Key Sections:**
- `auth` — login, register, logout, updateDisplayName
- `player` — Riot API data (rank, matches, live game status)
- `stats` — championPool, recentGames, aggregate stats
- `prices` — price history, latest price, ETF prices/history
- `trading` — portfolio, trade execution, orders, shorts
- `ledger` — all trades, leaderboard, dividends, bets
- `casino` — crash, roulette, mines, slots, balance, leaderboard
- `cosmetics` — shop, inventory, equip items
- `admin` — raw SQL, seed data, reset balances, halt trading

## 2. Adding a New tRPC Route

### Basic Pattern

```ts
// In routers.ts
mySection: router({
  myRoute: protectedProcedure
    .input(z.object({ param: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      const result = await db.select().from(myTable).where(eq(myTable.userId, userId));
      return result;
    }),
}),
```

### Procedure Types

```ts
publicProcedure    // No auth required
protectedProcedure // Requires authenticated user (ctx.user available)
adminProcedure     // Requires admin role (ctx.user.role === 'admin')
```

### Query vs Mutation

```ts
.query(async ({ ctx, input }) => { ... })    // GET-like, cached by tRPC
.mutation(async ({ ctx, input }) => { ... }) // POST-like, never cached
```

### Input Validation

```ts
.input(z.object({
  ticker: z.enum(["DORI", "DDRI", "TDRI"]),
  shares: z.number().positive().finite(),
  optional: z.string().optional(),
}))
```

## 3. Casino Game Pattern

Casino games follow a consistent pattern: game engine + router integration + balance flow.

### Game Engine File Structure

Each game engine is a separate file (e.g., `/home/ayoun/lol-tracker/server/roulette.ts`):

```ts
// Export types
export interface GameResult {
  totalBet: number;
  totalPayout: number;
  timestamp: number;
}

// Export game logic
export function playGame(bets: Bet[]): GameResult {
  // Pure game logic — no database access
  const winningNumber = Math.floor(Math.random() * 37);
  const totalPayout = calculatePayout(bets, winningNumber);
  return { totalBet, totalPayout, timestamp: Date.now() };
}

// Optional: in-memory state for stateful games
const activeGames = new Map<number, GameState>();

export function getActiveGame(userId: number): GameState | null {
  return activeGames.get(userId) || null;
}
```

### Router Integration

```ts
casino: router({
  roulette: router({
    spin: protectedProcedure
      .input(z.object({ bets: z.array(betSchema) }))
      .mutation(async ({ ctx, input }) => {
        // 1. Check cooldown
        await checkCasinoCooldown(ctx.user.id);

        // 2. Validate balance
        const portfolio = await getOrCreatePortfolio(ctx.user.id);
        const casinoCash = parseFloat(portfolio.casinoBalance);
        const totalBet = input.bets.reduce((sum, b) => sum + b.amount, 0);
        if (totalBet > casinoCash) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient funds" });
        }

        // 3. Deduct bet
        const db = await getDb();
        await db.update(portfolios)
          .set({ casinoBalance: (casinoCash - totalBet).toFixed(2) })
          .where(eq(portfolios.userId, ctx.user.id));

        // 4. Run game engine (dynamic import for code splitting)
        const { spin } = await import("./roulette");
        const result = spin(input.bets);

        // 5. Credit payout
        if (result.totalPayout > 0) {
          const newBalance = casinoCash - totalBet + result.totalPayout;
          await db.update(portfolios)
            .set({ casinoBalance: newBalance.toFixed(2) })
            .where(eq(portfolios.userId, ctx.user.id));
        }

        // 6. Record game for cooldown
        recordCasinoGame(ctx.user.id);

        // 7. Invalidate leaderboard cache
        cache.invalidate("casino.leaderboard");

        return result;
      }),
  }),
}),
```

### Stateful Games (Mines Pattern)

For multi-step games with active state:

```ts
// mines.ts
const activeGames = new Map<number, MinesGame>();

export function startMinesGame(userId: number, bet: number, mineCount: number) {
  activeGames.set(userId, { /* game state */ });
  return gameToPublic(activeGames.get(userId)!);
}

export function revealTile(userId: number, position: number) {
  const game = activeGames.get(userId);
  if (!game || game.status !== "playing") throw new Error("No active game");
  // Update game state
  return gameToPublic(game);
}

// Router
casino: router({
  mines: router({
    start: protectedProcedure.mutation(async ({ ctx, input }) => {
      // Deduct bet, start game
      const { startMinesGame } = await import("./mines");
      return startMinesGame(ctx.user.id, input.bet, input.mineCount);
    }),
    reveal: protectedProcedure.mutation(async ({ ctx, input }) => {
      const { revealTile } = await import("./mines");
      return revealTile(ctx.user.id, input.position);
    }),
    cashout: protectedProcedure.mutation(async ({ ctx }) => {
      const { cashOutMines } = await import("./mines");
      const result = cashOutMines(ctx.user.id);
      // Credit payout to balance
      return result;
    }),
  }),
}),
```

## 4. Database Patterns

### Drizzle ORM (Type-Safe, Recommended)

Use for standard CRUD operations:

```ts
import { getDb } from "./db";
import { users, portfolios, trades } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

const db = await getDb();

// SELECT
const user = await db.select().from(users).where(eq(users.id, userId));
const allTrades = await db.select().from(trades).orderBy(desc(trades.createdAt));

// INSERT
await db.insert(trades).values({
  userId, ticker, type: "buy", shares: "10.0", pricePerShare: "5.00", totalAmount: "50.00"
});

// UPDATE
await db.update(portfolios)
  .set({ cashBalance: "200.00" })
  .where(eq(portfolios.userId, userId));

// DELETE
await db.delete(orders).where(eq(orders.id, orderId));
```

### Raw SQL via getRawClient() (Power Tools)

Use for:
- Complex queries (JOINs, aggregations, window functions)
- Dynamic schema changes (admin tools)
- Performance-critical queries
- Operations Drizzle doesn't support well

```ts
import { getRawClient } from "./db";

const client = getRawClient();

// Execute with parameters
const result = await client.execute({
  sql: `SELECT * FROM users WHERE email = ?`,
  args: [email]
});

// Access results
const rows = result.rows; // Array of Row objects
const columns = result.columns; // Array of column names

// Multi-statement execution (schema changes)
await client.executeMultiple(`
  CREATE TABLE IF NOT EXISTS my_table (id INTEGER PRIMARY KEY);
  INSERT INTO my_table (id) VALUES (1);
`);

// Convert Row to plain object
const obj: Record<string, unknown> = {};
result.columns.forEach((col, i) => {
  obj[col] = result.rows[0][i];
});
```

**When to use raw SQL:**
- Casino leaderboard (aggregate with raw profit calculation)
- Trading leaderboard (complex portfolio value computation)
- Admin SQL console
- Seed data operations

### Example: Casino Leaderboard (Raw SQL)

```ts
leaderboard: publicProcedure.query(async () => {
  const client = getRawClient();
  const result = await client.execute(`
    SELECT
      u.id, u.displayName, u.name,
      p.casinoBalance,
      (CAST(p.casinoBalance AS REAL) - 20.0) as profit
    FROM portfolios p
    JOIN users u ON p.userId = u.id
    WHERE u.role != 'admin'
    ORDER BY CAST(p.casinoBalance AS REAL) DESC
    LIMIT 10
  `);

  return result.rows.map(row => ({
    userId: Number(row.id),
    displayName: row.displayName || row.name || "Anonymous",
    balance: Number(row.casinoBalance),
    profit: Number(row.profit),
  }));
});
```

## 5. Cache System

Cache is in-memory with TTL, stored in `/home/ayoun/lol-tracker/server/cache.ts`.

### Basic Usage

```ts
import { cache } from "./cache";

// Get or set with TTL
const data = await cache.getOrSet("my.cache.key", async () => {
  const result = await expensiveOperation();
  return result;
}, 30 * 60 * 1000); // 30 min TTL

// Get only (returns undefined if not cached)
const cached = cache.get<MyType>("my.cache.key");

// Invalidate (clear specific key)
cache.invalidate("my.cache.key");

// Invalidate pattern (clear all keys starting with prefix)
cache.invalidatePattern("prices.");
```

### Common TTL Constants

```ts
const THIRTY_MIN = 30 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;
```

### Cache Keys

Use dot-notation hierarchy:

```ts
"player.rank"
"player.matches.10"
"prices.history.all"
"prices.etfHistory.DORI.all"
"casino.leaderboard"
"ledger.all"
```

### Invalidation After Mutations

```ts
// After trade execution
cache.invalidate("ledger.all");
cache.invalidatePattern("leaderboard.");

// After casino game
cache.invalidate("casino.leaderboard");

// After portfolio change
cache.invalidatePattern("portfolio.");
```

## 6. Admin Routes

Admin routes use `adminProcedure` which checks `ctx.user.role === 'admin'`.

### Raw SQL Console

```ts
admin: router({
  sql: adminProcedure
    .input(z.object({ query: z.string().min(1).max(10000) }))
    .mutation(async ({ input }) => {
      const client = getRawClient();
      const result = await client.execute(input.query);

      return {
        success: true,
        columns: result.columns,
        rows: result.rows.map(row => {
          const obj: Record<string, unknown> = {};
          result.columns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj;
        }),
        rowCount: result.rows.length,
        rowsAffected: result.rowsAffected,
      };
    }),
}),
```

### Admin Actions Pattern

```ts
resetCasinoBalance: adminProcedure
  .input(z.object({ userId: z.number() }))
  .mutation(async ({ input }) => {
    const db = await getDb();
    await db.update(portfolios)
      .set({ casinoBalance: "20.00" })
      .where(eq(portfolios.userId, input.userId));
    return { success: true };
  }),
```

## 7. Common Mistakes

### 1. .returning() Not Supported

SQLite via libsql doesn't support `.returning()`:

```ts
// DON'T
const [inserted] = await db.insert(users).values({ ... }).returning();

// DO
await db.insert(users).values({ ... });
const inserted = await db.select().from(users).where(eq(users.id, userId));
```

### 2. Set Iteration Needs Array.from()

When iterating over Map or Set entries:

```ts
// DON'T
for (const [userId, game] of activeGames.entries()) { }

// DO
for (const [userId, game] of Array.from(activeGames.entries())) { }
```

### 3. Dynamic Imports for Game Engines

Game engines are dynamically imported to reduce bundle size:

```ts
// DON'T import at top
import { spin } from "./roulette";

// DO import dynamically inside mutation
const { spin } = await import("./roulette");
const result = spin(bets);
```

### 4. Balance Updates Must Use Strings

All monetary values in SQLite are stored as TEXT:

```ts
// DON'T
await db.update(portfolios).set({ casinoBalance: 20.00 });

// DO
await db.update(portfolios).set({ casinoBalance: "20.00" });
```

### 5. Raw Client Returns Typed Rows

When using raw SQL, rows are typed as `Row` objects (not plain objects):

```ts
const result = await client.execute("SELECT * FROM users");

// DON'T access directly
const name = result.rows[0].name; // Type error

// DO convert or access by index
const name = result.rows[0][result.columns.indexOf("name")];

// OR convert to plain object
const obj: Record<string, unknown> = {};
result.columns.forEach((col, i) => {
  obj[col] = result.rows[0][i];
});
```

### 6. Cache Invalidation After Writes

Always invalidate relevant caches after mutations:

```ts
// After inserting trade
cache.invalidate("ledger.all");
cache.invalidatePattern("leaderboard.");

// After updating portfolio
cache.invalidatePattern("portfolio.");

// After casino game
cache.invalidate("casino.leaderboard");
```

### 7. Seed Data Pattern

See `/home/ayoun/lol-tracker/server/seedCosmetics.ts`:

```ts
export async function seedCosmeticsIfEmpty() {
  const client = getRawClient();

  // Create tables if needed
  await client.execute(`
    CREATE TABLE IF NOT EXISTS cosmetic_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      ...
    )
  `);

  // Check if already seeded
  const count = await client.execute(`SELECT COUNT(*) as cnt FROM cosmetic_items`);
  if (Number(count.rows[0].cnt) > 0) return;

  // Insert seed data
  const items = [
    { type: "title", name: "Lucky Charm", tier: "common", price: 5 },
    // ...
  ];

  for (const item of items) {
    await client.execute({
      sql: `INSERT INTO cosmetic_items (type, name, tier, price) VALUES (?, ?, ?, ?)`,
      args: [item.type, item.name, item.tier, item.price],
    });
  }
}
```

Call from server startup in `/home/ayoun/lol-tracker/server/_core/index.ts`:

```ts
server.listen(port, async () => {
  try {
    const { seedCosmeticsIfEmpty } = await import("../seedCosmetics");
    await seedCosmeticsIfEmpty();
  } catch (err) {
    console.error("[Server] Failed to seed cosmetics:", err);
  }
});
```

## Quick Reference

### File Structure
- `/server/routers.ts` — Main tRPC router
- `/server/_core/trpc.ts` — Procedure definitions
- `/server/db.ts` — Database utilities
- `/server/cache.ts` — In-memory cache
- `/server/roulette.ts`, `mines.ts`, etc. — Game engines
- `/drizzle/schema.ts` — Database schema

### Common Imports
```ts
import { router, publicProcedure, protectedProcedure, adminProcedure } from "./_core/trpc";
import { getDb, getRawClient, getOrCreatePortfolio } from "./db";
import { cache } from "./cache";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and } from "drizzle-orm";
import { users, portfolios, trades } from "../drizzle/schema";
```
