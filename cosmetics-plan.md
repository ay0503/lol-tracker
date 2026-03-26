# $DORI Casino Cosmetics System — Technical Implementation Plan

## Overview
Players can purchase cosmetic items (titles, name effects, profile themes) using their casino balance. Cosmetics are displayed on the Casino Leaderboard to show off status and achievements.

---

## 1. Database Schema

### Three New Tables (Raw SQL)

Since we can't easily add Drizzle schema columns without migration issues, follow the `casino_daily_claims` pattern using raw SQL via `getRawClient()`.

#### `cosmetic_items` — Catalog of purchasable cosmetics

```sql
CREATE TABLE IF NOT EXISTS cosmetic_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,              -- 'title' | 'name_effect' | 'theme'
  name TEXT NOT NULL,               -- Display name: "High Roller", "Diamond Whale"
  tier TEXT NOT NULL,               -- 'common' | 'rare' | 'epic' | 'legendary'
  price REAL NOT NULL,              -- Cost in casino cash ($5.00, $50.00, etc.)
  cssClass TEXT,                    -- CSS class for styling (e.g., 'text-gradient-gold', 'animate-shimmer')
  description TEXT,                 -- Short flavor text
  category TEXT,                    -- 'starter', 'achievement', 'whale', 'seasonal'
  isLimited INTEGER DEFAULT 0,      -- 1 if limited-time only
  stock INTEGER DEFAULT -1,         -- -1 = unlimited, else remaining quantity
  createdAt TEXT DEFAULT (datetime('now')),
  UNIQUE(type, name)
);
```

**Example rows:**
| id | type | name | tier | price | cssClass | description | category |
|----|------|------|------|-------|----------|-------------|----------|
| 1 | title | 🎰 High Roller | rare | 25.00 | text-yellow-400 | Won big, lost bigger | achievement |
| 2 | name_effect | 💎 Diamond | legendary | 100.00 | text-gradient-diamond animate-pulse | VIP status | whale |
| 3 | title | 🔥 On Fire | epic | 50.00 | text-orange-500 font-bold | Unstoppable streak | achievement |

---

#### `user_cosmetics` — Owned items per user

```sql
CREATE TABLE IF NOT EXISTS user_cosmetics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  cosmeticId INTEGER NOT NULL,
  purchasedAt TEXT DEFAULT (datetime('now')),
  UNIQUE(userId, cosmeticId),
  FOREIGN KEY(userId) REFERENCES users(id),
  FOREIGN KEY(cosmeticId) REFERENCES cosmetic_items(id)
);
```

**Purpose:** Track what each user owns. Insert on purchase, delete if user "refunds" (optional feature).

---

#### `user_equipped` — Currently equipped cosmetics

```sql
CREATE TABLE IF NOT EXISTS user_equipped (
  userId INTEGER PRIMARY KEY,
  equippedTitle INTEGER,           -- Foreign key to cosmetic_items.id
  equippedNameEffect INTEGER,      -- Foreign key to cosmetic_items.id
  updatedAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(userId) REFERENCES users(id),
  FOREIGN KEY(equippedTitle) REFERENCES cosmetic_items(id),
  FOREIGN KEY(equippedNameEffect) REFERENCES cosmetic_items(id)
);
```

**Purpose:** One row per user. Upsert on equip action. NULL = nothing equipped in that slot.

---

## 2. Server Routes

Add new router: `casino.shop` in `/home/ayoun/lol-tracker/server/routers.ts`

### Structure

```typescript
casino: router({
  // ... existing crash, mines, roulette, blackjack ...

  shop: router({
    catalog: publicProcedure.query(async () => { /* ... */ }),
    owned: protectedProcedure.query(async ({ ctx }) => { /* ... */ }),
    purchase: protectedProcedure
      .input(z.object({ cosmeticId: z.number() }))
      .mutation(async ({ ctx, input }) => { /* ... */ }),
    equip: protectedProcedure
      .input(z.object({ type: z.enum(['title', 'name_effect']), cosmeticId: z.number().nullable() }))
      .mutation(async ({ ctx, input }) => { /* ... */ }),
    equipped: protectedProcedure.query(async ({ ctx }) => { /* ... */ }),
  }),

  // Modify existing leaderboard to include cosmetics
  leaderboard: publicProcedure.query(async () => { /* add cosmetics join */ }),
}),
```

---

### Route Details

#### `casino.shop.catalog`
**Purpose:** Return all available cosmetics (public, no auth required)

```typescript
catalog: publicProcedure.query(async () => {
  const client = getRawClient();
  const result = await client.execute(`
    SELECT id, type, name, tier, price, cssClass, description, category, isLimited, stock
    FROM cosmetic_items
    WHERE stock != 0
    ORDER BY price ASC, tier DESC
  `);
  return result.rows.map(r => ({
    id: Number(r.id),
    type: String(r.type),
    name: String(r.name),
    tier: String(r.tier),
    price: Number(r.price),
    cssClass: r.cssClass ? String(r.cssClass) : null,
    description: r.description ? String(r.description) : null,
    category: r.category ? String(r.category) : null,
    isLimited: Boolean(r.isLimited),
    stock: Number(r.stock),
  }));
}),
```

---

#### `casino.shop.owned`
**Purpose:** Get user's owned cosmetics

```typescript
owned: protectedProcedure.query(async ({ ctx }) => {
  const client = getRawClient();
  const result = await client.execute({
    sql: `
      SELECT c.id, c.type, c.name, c.tier, c.cssClass, uc.purchasedAt
      FROM user_cosmetics uc
      JOIN cosmetic_items c ON uc.cosmeticId = c.id
      WHERE uc.userId = ?
      ORDER BY uc.purchasedAt DESC
    `,
    args: [ctx.user.id],
  });
  return result.rows.map(r => ({
    id: Number(r.id),
    type: String(r.type),
    name: String(r.name),
    tier: String(r.tier),
    cssClass: r.cssClass ? String(r.cssClass) : null,
    purchasedAt: String(r.purchasedAt),
  }));
}),
```

---

#### `casino.shop.purchase`
**Purpose:** Buy a cosmetic with casino balance

```typescript
purchase: protectedProcedure
  .input(z.object({ cosmeticId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const client = getRawClient();

    // 1. Get cosmetic details
    const itemRes = await client.execute({
      sql: `SELECT price, stock, name FROM cosmetic_items WHERE id = ?`,
      args: [input.cosmeticId],
    });
    if (itemRes.rows.length === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Cosmetic not found" });
    }
    const item = itemRes.rows[0];
    const price = Number(item.price);
    const stock = Number(item.stock);
    const name = String(item.name);

    // 2. Check stock
    if (stock === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Out of stock" });
    }

    // 3. Check if already owned
    const ownedRes = await client.execute({
      sql: `SELECT 1 FROM user_cosmetics WHERE userId = ? AND cosmeticId = ?`,
      args: [ctx.user.id, input.cosmeticId],
    });
    if (ownedRes.rows.length > 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "You already own this cosmetic" });
    }

    // 4. Check balance
    const portfolio = await getOrCreatePortfolio(ctx.user.id);
    const casinoCash = parseFloat(portfolio.casinoBalance ?? "20.00");
    if (casinoCash < price) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Insufficient funds. You have $${casinoCash.toFixed(2)}, need $${price.toFixed(2)}.`,
      });
    }

    // 5. Deduct balance
    const db = await getDb();
    await db.update(portfolios).set({
      casinoBalance: (casinoCash - price).toFixed(2),
    }).where(eq(portfolios.userId, ctx.user.id));

    // 6. Grant cosmetic
    await client.execute({
      sql: `INSERT INTO user_cosmetics (userId, cosmeticId) VALUES (?, ?)`,
      args: [ctx.user.id, input.cosmeticId],
    });

    // 7. Decrement stock if limited
    if (stock > 0) {
      await client.execute({
        sql: `UPDATE cosmetic_items SET stock = stock - 1 WHERE id = ?`,
        args: [input.cosmeticId],
      });
    }

    cache.invalidate("casino.leaderboard");

    return { success: true, name, newBalance: casinoCash - price };
  }),
```

---

#### `casino.shop.equip`
**Purpose:** Equip or unequip a cosmetic (user must own it)

```typescript
equip: protectedProcedure
  .input(z.object({
    type: z.enum(['title', 'name_effect']),
    cosmeticId: z.number().nullable(), // null = unequip
  }))
  .mutation(async ({ ctx, input }) => {
    const client = getRawClient();

    // 1. If equipping (not null), verify ownership
    if (input.cosmeticId !== null) {
      const ownedRes = await client.execute({
        sql: `SELECT 1 FROM user_cosmetics WHERE userId = ? AND cosmeticId = ?`,
        args: [ctx.user.id, input.cosmeticId],
      });
      if (ownedRes.rows.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't own this cosmetic" });
      }

      // Verify type matches
      const typeRes = await client.execute({
        sql: `SELECT type FROM cosmetic_items WHERE id = ?`,
        args: [input.cosmeticId],
      });
      if (typeRes.rows.length === 0 || String(typeRes.rows[0].type) !== input.type) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Type mismatch" });
      }
    }

    // 2. Upsert equipped slot
    const column = input.type === 'title' ? 'equippedTitle' : 'equippedNameEffect';
    await client.execute({
      sql: `
        INSERT INTO user_equipped (userId, ${column}, updatedAt)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(userId) DO UPDATE SET ${column} = ?, updatedAt = datetime('now')
      `,
      args: [ctx.user.id, input.cosmeticId, input.cosmeticId],
    });

    cache.invalidate("casino.leaderboard");

    return { success: true };
  }),
```

---

#### `casino.shop.equipped`
**Purpose:** Get currently equipped cosmetics for the logged-in user

```typescript
equipped: protectedProcedure.query(async ({ ctx }) => {
  const client = getRawClient();
  const result = await client.execute({
    sql: `
      SELECT
        t.id as titleId, t.name as titleName, t.cssClass as titleCss,
        n.id as nameEffectId, n.name as nameEffectName, n.cssClass as nameEffectCss
      FROM user_equipped ue
      LEFT JOIN cosmetic_items t ON ue.equippedTitle = t.id
      LEFT JOIN cosmetic_items n ON ue.equippedNameEffect = n.id
      WHERE ue.userId = ?
    `,
    args: [ctx.user.id],
  });

  if (result.rows.length === 0) {
    return { title: null, nameEffect: null };
  }

  const row = result.rows[0];
  return {
    title: row.titleId ? {
      id: Number(row.titleId),
      name: String(row.titleName),
      cssClass: row.titleCss ? String(row.titleCss) : null,
    } : null,
    nameEffect: row.nameEffectId ? {
      id: Number(row.nameEffectId),
      name: String(row.nameEffectName),
      cssClass: row.nameEffectCss ? String(row.nameEffectCss) : null,
    } : null,
  };
}),
```

---

### Modified `casino.leaderboard`
**Purpose:** Include equipped cosmetics for display

Replace existing `casino.leaderboard` query (lines 1088-1102 in routers.ts):

```typescript
leaderboard: publicProcedure.query(async () => {
  return cache.getOrSet("casino.leaderboard", async () => {
    const client = getRawClient();
    const result = await client.execute(`
      SELECT
        u.id as userId,
        COALESCE(u.displayName, u.name) as userName,
        COALESCE(p.casinoBalance, '20.00') as casinoBalance,
        t.id as titleId, t.name as titleName, t.cssClass as titleCss,
        n.id as nameEffectId, n.name as nameEffectName, n.cssClass as nameEffectCss
      FROM users u
      LEFT JOIN portfolios p ON u.id = p.userId
      LEFT JOIN user_equipped ue ON u.id = ue.userId
      LEFT JOIN cosmetic_items t ON ue.equippedTitle = t.id
      LEFT JOIN cosmetic_items n ON ue.equippedNameEffect = n.id
      ORDER BY CAST(COALESCE(p.casinoBalance, '20.00') AS REAL) DESC
    `);

    return (result.rows as any[]).map(r => ({
      userId: Number(r.userId),
      userName: String(r.userName || "Anonymous"),
      casinoBalance: parseFloat(String(r.casinoBalance ?? "20.00")),
      profit: parseFloat(String(r.casinoBalance ?? "20.00")) - 20,
      title: r.titleId ? {
        id: Number(r.titleId),
        name: String(r.titleName),
        cssClass: r.titleCss ? String(r.titleCss) : null,
      } : null,
      nameEffect: r.nameEffectId ? {
        id: Number(r.nameEffectId),
        name: String(r.nameEffectName),
        cssClass: r.nameEffectCss ? String(r.nameEffectCss) : null,
      } : null,
    }));
  }, TEN_MIN);
}),
```

---

## 3. Frontend Pages

### New Page: `/client/src/pages/CasinoShop.tsx`

**Purpose:** Browse catalog, purchase cosmetics, manage equipped items

**Route:** Add to `client/src/App.tsx`: `<Route path="/casino/shop" component={CasinoShop} />`

**Key Sections:**
1. **Header** — Back button to Casino, balance display
2. **Equipped Preview** — Current title + name effect with live preview
3. **Tabs** — "All" | "Titles" | "Name Effects" (filter by type)
4. **Catalog Grid** — Cards showing cosmetic, price, tier badge, "Owned" or "Buy" button
5. **Owned Inventory** — Separate section showing purchased items with "Equip/Unequip" buttons

**Tech Stack:**
- React hooks: `useState` for filters/tabs
- tRPC queries: `casino.shop.catalog`, `casino.shop.owned`, `casino.shop.equipped`
- tRPC mutations: `casino.shop.purchase`, `casino.shop.equip`
- Tailwind classes from `cssClass` field for dynamic styling
- Framer Motion for card animations
- Sonner toast for purchase feedback

**Mockup Structure:**
```tsx
export default function CasinoShop() {
  const { data: catalog } = trpc.casino.shop.catalog.useQuery();
  const { data: owned } = trpc.casino.shop.owned.useQuery();
  const { data: equipped } = trpc.casino.shop.equipped.useQuery();
  const { data: balance } = trpc.casino.blackjack.balance.useQuery();
  const purchaseMutation = trpc.casino.shop.purchase.useMutation({ /* ... */ });
  const equipMutation = trpc.casino.shop.equip.useMutation({ /* ... */ });

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black">
      {/* Header with balance */}
      {/* Equipped preview */}
      {/* Tabs (All, Titles, Name Effects) */}
      {/* Catalog grid */}
      {/* Owned inventory */}
    </div>
  );
}
```

---

### Modified Page: `/client/src/pages/Leaderboard.tsx`

**Changes:**
- Casino leaderboard rows now display:
  - Title badge next to rank icon (if equipped)
  - Name with effect class (if equipped)

**Implementation:**

In the Casino tab mapping (lines 372-413), update:

```tsx
{casinoRankings.map((player, idx) => {
  const rank = idx + 1;
  const isProfit = player.profit >= 0;
  return (
    <motion.div
      key={player.userId}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className={`border rounded-xl p-4 ${getRankBg(rank)}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getRankIcon(rank)}
          <div>
            {/* Title badge */}
            {player.title && (
              <div className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded mb-1 inline-block ${player.title.cssClass || 'bg-zinc-700 text-zinc-300'}`}>
                {player.title.name}
              </div>
            )}
            {/* Name with effect */}
            <p className={`text-sm font-bold ${player.nameEffect?.cssClass || 'text-foreground'}`}>
              {player.userName}
            </p>
            <span className="text-[10px] text-muted-foreground">
              {language === "ko" ? "시작" : "Started"}: $20.00
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-foreground font-mono">${player.casinoBalance.toFixed(2)}</p>
          <div className="flex items-center gap-1 justify-end">
            {isProfit ? (
              <TrendingUp className="w-3 h-3 text-[#00C805]" />
            ) : (
              <TrendingDown className="w-3 h-3 text-[#FF5252]" />
            )}
            <span
              className="text-xs font-mono font-bold"
              style={{ color: isProfit ? "#00C805" : "#FF5252" }}
            >
              {isProfit ? "+" : ""}${player.profit.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
})}
```

---

### Modified Page: `/client/src/pages/Casino.tsx`

**Changes:**
- Add "Shop" button in hero section (next to daily bonus)
- Link to `/casino/shop`

**Implementation (lines 72-126):**

```tsx
<div className="relative px-5 sm:px-8 py-6 sm:py-8">
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
    <div>
      {/* ... existing title ... */}
      <div className="flex items-center gap-2">
        {/* Daily Bonus button */}
        {isAuthenticated && (
          <motion.button /* ... existing daily bonus ... */ />
        )}
        {/* NEW: Shop button */}
        <Link href="/casino/shop">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all"
          >
            <span>🛍️</span>
            {language === "ko" ? "상점" : "Shop"}
          </motion.button>
        </Link>
      </div>
    </div>
    {/* ... existing balance display ... */}
  </div>
</div>
```

---

## 4. Seed Data

### Initial Cosmetics Catalog

Create seed function in `/home/ayoun/lol-tracker/server/seedCosmetics.ts`:

```typescript
import { getRawClient } from "./db";

export async function seedCosmeticsIfEmpty() {
  const client = getRawClient();

  // Create tables
  await client.execute(`
    CREATE TABLE IF NOT EXISTS cosmetic_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      tier TEXT NOT NULL,
      price REAL NOT NULL,
      cssClass TEXT,
      description TEXT,
      category TEXT,
      isLimited INTEGER DEFAULT 0,
      stock INTEGER DEFAULT -1,
      createdAt TEXT DEFAULT (datetime('now')),
      UNIQUE(type, name)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_cosmetics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      cosmeticId INTEGER NOT NULL,
      purchasedAt TEXT DEFAULT (datetime('now')),
      UNIQUE(userId, cosmeticId)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_equipped (
      userId INTEGER PRIMARY KEY,
      equippedTitle INTEGER,
      equippedNameEffect INTEGER,
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // Check if already seeded
  const count = await client.execute(`SELECT COUNT(*) as cnt FROM cosmetic_items`);
  if (Number(count.rows[0].cnt) > 0) {
    console.log("[Cosmetics] Already seeded, skipping.");
    return;
  }

  // Seed initial catalog
  const cosmetics = [
    // ─── Titles ───
    { type: 'title', name: '🎰 High Roller', tier: 'rare', price: 25.00, cssClass: 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black', description: 'Won big, lost bigger', category: 'achievement' },
    { type: 'title', name: '🔥 On Fire', tier: 'epic', price: 50.00, cssClass: 'bg-gradient-to-r from-orange-500 to-red-500 text-white', description: 'Unstoppable streak', category: 'achievement' },
    { type: 'title', name: '💎 Diamond Whale', tier: 'legendary', price: 150.00, cssClass: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-bold', description: 'Top 1% net worth', category: 'whale' },
    { type: 'title', name: '🍀 Lucky Charm', tier: 'common', price: 10.00, cssClass: 'bg-green-600 text-white', description: 'Beginner\'s luck', category: 'starter' },
    { type: 'title', name: '👑 Casino King', tier: 'legendary', price: 200.00, cssClass: 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-black font-black', description: 'Royalty of the casino', category: 'whale' },

    // ─── Name Effects ───
    { type: 'name_effect', name: '✨ Sparkle', tier: 'common', price: 15.00, cssClass: 'text-yellow-300 drop-shadow-lg', description: 'Subtle shimmer', category: 'starter' },
    { type: 'name_effect', name: '🌈 Rainbow', tier: 'rare', price: 40.00, cssClass: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 bg-clip-text text-transparent font-bold', description: 'All the colors', category: 'achievement' },
    { type: 'name_effect', name: '💎 Diamond', tier: 'legendary', price: 100.00, cssClass: 'bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent animate-pulse font-bold', description: 'VIP sparkle', category: 'whale' },
    { type: 'name_effect', name: '🔥 Flame', tier: 'epic', price: 60.00, cssClass: 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]', description: 'Blazing hot', category: 'achievement' },
    { type: 'name_effect', name: '⚡ Lightning', tier: 'rare', price: 35.00, cssClass: 'text-yellow-400 animate-pulse', description: 'Electric energy', category: 'achievement' },
  ];

  for (const c of cosmetics) {
    await client.execute({
      sql: `INSERT INTO cosmetic_items (type, name, tier, price, cssClass, description, category) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [c.type, c.name, c.tier, c.price, c.cssClass, c.description, c.category],
    });
  }

  console.log(`[Cosmetics] Seeded ${cosmetics.length} items.`);
}
```

**Call in server startup** — Add to `/home/ayoun/lol-tracker/server/index.ts` after DB init:

```typescript
import { seedCosmeticsIfEmpty } from "./seedCosmetics";

// ... existing code ...

(async () => {
  await seedCosmeticsIfEmpty(); // Add this line
  // ... rest of startup ...
})();
```

---

## 5. Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `/home/ayoun/lol-tracker/server/seedCosmetics.ts` | Seed function for cosmetics catalog |
| `/home/ayoun/lol-tracker/client/src/pages/CasinoShop.tsx` | Shop page UI |

---

### Modified Files

| File | Lines | Changes |
|------|-------|---------|
| `/home/ayoun/lol-tracker/server/routers.ts` | ~1088-1102 | Replace `casino.leaderboard` query to include cosmetics join |
| | After line 1087 | Add `casino.shop` router with 5 endpoints (catalog, owned, purchase, equip, equipped) |
| `/home/ayoun/lol-tracker/server/index.ts` | After DB init | Import and call `seedCosmeticsIfEmpty()` |
| `/home/ayoun/lol-tracker/client/src/pages/Leaderboard.tsx` | Lines 372-413 | Update casino leaderboard row rendering to show title badge and name effect styling |
| `/home/ayoun/lol-tracker/client/src/pages/Casino.tsx` | Lines 88-105 | Add Shop button next to Daily Bonus |
| `/home/ayoun/lol-tracker/client/src/App.tsx` | Routes section | Add `<Route path="/casino/shop" component={CasinoShop} />` |

---

## 6. CSS Classes for Cosmetics

Add to `/home/ayoun/lol-tracker/client/src/index.css` (or inline in components):

```css
/* Gradient text utilities */
.text-gradient-gold {
  background: linear-gradient(to right, #fbbf24, #f59e0b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: bold;
}

.text-gradient-diamond {
  background: linear-gradient(to right, #67e8f9, #60a5fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: bold;
}

/* Shimmer animation */
@keyframes shimmer {
  0% { opacity: 0.8; }
  50% { opacity: 1; }
  100% { opacity: 0.8; }
}

.animate-shimmer {
  animation: shimmer 2s ease-in-out infinite;
}
```

---

## 7. Type Definitions

Add to `/home/ayoun/lol-tracker/shared/types.ts` (if using shared types):

```typescript
export type CosmeticType = 'title' | 'name_effect' | 'theme';
export type CosmeticTier = 'common' | 'rare' | 'epic' | 'legendary';
export type CosmeticCategory = 'starter' | 'achievement' | 'whale' | 'seasonal';

export interface CosmeticItem {
  id: number;
  type: CosmeticType;
  name: string;
  tier: CosmeticTier;
  price: number;
  cssClass: string | null;
  description: string | null;
  category: CosmeticCategory | null;
  isLimited: boolean;
  stock: number;
}

export interface OwnedCosmetic {
  id: number;
  type: CosmeticType;
  name: string;
  tier: CosmeticTier;
  cssClass: string | null;
  purchasedAt: string;
}

export interface EquippedCosmetics {
  title: { id: number; name: string; cssClass: string | null } | null;
  nameEffect: { id: number; name: string; cssClass: string | null } | null;
}
```

---

## 8. Testing Checklist

- [ ] Tables created on first run (no errors)
- [ ] Seed data populates catalog
- [ ] Catalog query returns all items
- [ ] Purchase deducts balance correctly
- [ ] Purchase fails if already owned
- [ ] Purchase fails if insufficient funds
- [ ] Stock decrements for limited items
- [ ] Equip endpoint validates ownership
- [ ] Equip endpoint validates type match
- [ ] Unequip (null) works correctly
- [ ] Leaderboard displays titles and name effects
- [ ] Cache invalidation works (leaderboard updates after purchase/equip)
- [ ] Shop UI shows owned items
- [ ] Shop UI disables "Buy" for owned items
- [ ] Equipped preview updates in real-time

---

## 9. Future Enhancements

- **Profile Themes:** Full background cosmetics (type = 'theme')
- **Limited-Time Sales:** Seasonal cosmetics with stock countdown
- **Gifting:** Send cosmetics to other users
- **Achievements:** Auto-grant cosmetics for milestones (e.g., "Win 100 blackjack hands")
- **Bundles:** Multi-item packs at discount
- **Rarity Indicators:** Animate legendary items with glow effects
- **Equipped Preview:** Live preview before equipping

---

## 10. Merge Conflict Mitigation

**Strategy:**
1. **Add, don't modify** — New router (`casino.shop`) goes after existing routes
2. **Single leaderboard change** — Only modify one query (lines 1088-1102)
3. **Isolated UI changes** — Casino and Leaderboard pages have clear sections to edit
4. **Seed runs idempotently** — Won't conflict with existing DB operations

**Review before merge:**
- Check that `casino.leaderboard` hasn't been modified elsewhere
- Verify no other cosmetics implementation exists
- Test that cache invalidation keys don't clash

---

## Summary

This implementation follows the established patterns in the codebase:
- Raw SQL via `getRawClient()` for new tables (like `casino_daily_claims`)
- tRPC router nesting (like `casino.crash`, `casino.mines`)
- Cached queries with `TEN_MIN` TTL
- Balance validation and deduction flow (like casino games)
- Framer Motion animations and Tailwind styling
- Toast notifications for user feedback

**Total new code:**
- 1 seed file (~120 lines)
- 1 shop page (~300 lines)
- ~200 lines added to routers.ts
- ~30 lines modified in existing pages

**No breaking changes.** All additions are backwards-compatible.
