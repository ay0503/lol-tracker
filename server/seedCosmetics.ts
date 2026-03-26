import { getRawClient } from "./db";

export async function seedCosmeticsIfEmpty() {
  const client = getRawClient();

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

  const count = await client.execute(`SELECT COUNT(*) as cnt FROM cosmetic_items`);
  if (Number(count.rows[0].cnt) > 0) return;

  const items = [
    // ─── TITLES: Common ($5-12) ───
    { type: "title", name: "Lucky Charm", tier: "common", price: 5, css: "bg-zinc-800 text-zinc-400 border border-zinc-700", desc: "Beginner's luck" },
    { type: "title", name: "Card Counter", tier: "common", price: 8, css: "bg-zinc-800 text-zinc-400 border border-zinc-700", desc: "I definitely have a strategy" },
    { type: "title", name: "Down Bad", tier: "common", price: 10, css: "bg-zinc-800 text-zinc-400 border border-zinc-700", desc: "Self-aware degen" },
    { type: "title", name: "Copium Dealer", tier: "common", price: 12, css: "bg-zinc-800 text-zinc-400 border border-zinc-700", desc: "I'm due for a win" },
    { type: "title", name: "Paper Hands", tier: "common", price: 10, css: "bg-zinc-800 text-zinc-400 border border-zinc-700", desc: "I always cash out too early" },
    { type: "title", name: "Casual Gambler", tier: "common", price: 5, css: "bg-zinc-800 text-zinc-400 border border-zinc-700", desc: "Just vibing" },
    { type: "title", name: "Slot Enjoyer", tier: "common", price: 8, css: "bg-zinc-800 text-zinc-400 border border-zinc-700", desc: "RNG is my friend" },
    { type: "title", name: "Betting Enthusiast", tier: "common", price: 7, css: "bg-zinc-800 text-zinc-400 border border-zinc-700", desc: "I like the action" },

    // ─── TITLES: Rare ($28-50) ───
    { type: "title", name: "High Roller", tier: "rare", price: 35, css: "bg-blue-950/50 text-blue-400 border border-blue-500/30", desc: "Money to burn" },
    { type: "title", name: "Card Shark", tier: "rare", price: 40, css: "bg-blue-950/50 text-blue-400 border border-blue-500/30", desc: "I know what I'm doing" },
    { type: "title", name: "Diamond Hands", tier: "rare", price: 45, css: "bg-blue-950/50 text-blue-400 border border-blue-500/30", desc: "Never selling" },
    { type: "title", name: "Elo Gambler", tier: "rare", price: 30, css: "bg-blue-950/50 text-blue-400 border border-blue-500/30", desc: "Ranked + casino degen" },
    { type: "title", name: "Ranked Degen", tier: "rare", price: 38, css: "bg-blue-950/50 text-blue-400 border border-blue-500/30", desc: "I grind both" },
    { type: "title", name: "Risk Taker", tier: "rare", price: 32, css: "bg-blue-950/50 text-blue-400 border border-blue-500/30", desc: "High multipliers only" },
    { type: "title", name: "Profit Prophet", tier: "rare", price: 42, css: "bg-blue-950/50 text-blue-400 border border-blue-500/30", desc: "Always up (allegedly)" },
    { type: "title", name: "Crash Test Dummy", tier: "rare", price: 28, css: "bg-blue-950/50 text-blue-400 border border-blue-500/30", desc: "I always cash out too late" },

    // ─── TITLES: Epic ($85-150) ───
    { type: "title", name: "Built Different", tier: "epic", price: 100, css: "bg-gradient-to-r from-purple-900/70 to-violet-900/70 text-purple-300 border border-purple-500/40", desc: "Not like the others" },
    { type: "title", name: "Main Character", tier: "epic", price: 120, css: "bg-gradient-to-r from-purple-900/70 to-violet-900/70 text-purple-300 border border-purple-500/40", desc: "Center of attention" },
    { type: "title", name: "Casino Royale", tier: "epic", price: 90, css: "bg-gradient-to-r from-purple-900/70 to-violet-900/70 text-purple-300 border border-purple-500/40", desc: "Sophisticated degen" },
    { type: "title", name: "Money Printer", tier: "epic", price: 95, css: "bg-gradient-to-r from-purple-900/70 to-violet-900/70 text-purple-300 border border-purple-500/40", desc: "I just win" },
    { type: "title", name: "Challenger Gambler", tier: "epic", price: 130, css: "bg-gradient-to-r from-purple-900/70 to-violet-900/70 text-purple-300 border border-purple-500/40", desc: "Top 0.1% energy" },
    { type: "title", name: "All In Andy", tier: "epic", price: 105, css: "bg-gradient-to-r from-purple-900/70 to-violet-900/70 text-purple-300 border border-purple-500/40", desc: "No fear" },
    { type: "title", name: "Degen Royalty", tier: "epic", price: 140, css: "bg-gradient-to-r from-purple-900/70 to-violet-900/70 text-purple-300 border border-purple-500/40", desc: "Embracing the chaos" },

    // ─── TITLES: Legendary ($275-500) ───
    { type: "title", name: "Casino Overlord", tier: "legendary", price: 300, css: "bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-yellow-100 border border-yellow-400/60", desc: "Top of the food chain" },
    { type: "title", name: "Money Bags", tier: "legendary", price: 350, css: "bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-yellow-100 border border-yellow-400/60", desc: "Flex wealth" },
    { type: "title", name: "House Edge Survivor", tier: "legendary", price: 275, css: "bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-yellow-100 border border-yellow-400/60", desc: "Beat the odds" },

    // ─── TITLES: Legendary LIMITED ───
    { type: "title", name: "Unhinged", tier: "legendary", price: 400, css: "bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-yellow-100 border border-yellow-400/60", desc: "Too far gone", limited: true, stock: 10 },
    { type: "title", name: "Limit Does Not Exist", tier: "legendary", price: 500, css: "bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-yellow-100 border border-yellow-400/60", desc: "Sky's the limit", limited: true, stock: 5 },

    // ─── NAME EFFECTS: Common ($10-18) ───
    { type: "name_effect", name: "Cherry Red", tier: "common", price: 10, css: "text-red-500", desc: "Classic standout" },
    { type: "name_effect", name: "Sky Blue", tier: "common", price: 12, css: "text-blue-400", desc: "Calm, confident" },
    { type: "name_effect", name: "Forest Green", tier: "common", price: 12, css: "text-green-600", desc: "Money vibes" },
    { type: "name_effect", name: "Royal Purple", tier: "common", price: 15, css: "text-purple-500", desc: "Slightly rarer" },
    { type: "name_effect", name: "Amber", tier: "common", price: 18, css: "text-amber-500", desc: "Warm glow" },

    // ─── NAME EFFECTS: Rare ($35-60) ───
    { type: "name_effect", name: "Sunset", tier: "rare", price: 35, css: "inline-block bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent", desc: "Warm fade", extra: "drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]" },
    { type: "name_effect", name: "Ocean Wave", tier: "rare", price: 40, css: "inline-block bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent", desc: "Cool and fluid", extra: "drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" },
    { type: "name_effect", name: "Toxic", tier: "rare", price: 45, css: "inline-block bg-gradient-to-r from-lime-400 to-green-600 bg-clip-text text-transparent", desc: "Radioactive energy", extra: "drop-shadow-[0_0_10px_rgba(163,230,53,0.6)]" },
    { type: "name_effect", name: "Gold Rush", tier: "rare", price: 50, css: "text-yellow-500", desc: "Golden glow", extra: "drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]" },
    { type: "name_effect", name: "Neon Pink", tier: "rare", price: 55, css: "text-pink-400", desc: "Hot pink glow", extra: "drop-shadow-[0_0_10px_rgba(244,114,182,0.8)]" },
    { type: "name_effect", name: "Ice Cold", tier: "rare", price: 60, css: "text-cyan-300", desc: "Frosty aura", extra: "drop-shadow-[0_0_12px_rgba(103,232,249,0.7)]" },

    // ─── NAME EFFECTS: Epic ($120-200) ───
    { type: "name_effect", name: "Rainbow Cycle", tier: "epic", price: 120, css: "text-red-400 animate-[rainbow_3s_linear_infinite]", desc: "Full spectrum shift" },
    { type: "name_effect", name: "Shimmer", tier: "epic", price: 150, css: "inline-block bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 bg-[length:200%_100%] bg-clip-text text-transparent animate-[shimmer_2s_linear_infinite]", desc: "Metallic sheen" },
    { type: "name_effect", name: "Inferno", tier: "epic", price: 180, css: "inline-block bg-gradient-to-t from-red-600 via-orange-500 to-yellow-400 bg-clip-text text-transparent", desc: "Flames rising", extra: "drop-shadow-[0_0_15px_rgba(251,146,60,0.7)]" },
    { type: "name_effect", name: "Electric Storm", tier: "epic", price: 200, css: "text-blue-300 animate-[lightning_0.5s_ease-in-out_infinite]", desc: "Lightning strikes", extra: "drop-shadow-[0_0_25px_rgba(147,197,253,1)]" },

    // ─── NAME EFFECTS: Legendary ($350-500) ───
    { type: "name_effect", name: "Diamond Sparkle", tier: "legendary", price: 350, css: "inline-block bg-gradient-to-br from-blue-200 via-blue-100 to-blue-200 bg-clip-text text-transparent animate-[sparkle_3s_linear_infinite]", desc: "VIP sparkle", extra: "drop-shadow-[0_0_30px_rgba(255,255,255,1)]" },
    { type: "name_effect", name: "Molten Gold", tier: "legendary", price: 400, css: "inline-block bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 bg-[length:200%_100%] bg-clip-text text-transparent animate-[flow_2s_linear_infinite]", desc: "Liquid metal", extra: "drop-shadow-[0_0_35px_rgba(234,179,8,1)]" },
    { type: "name_effect", name: "Cosmic Void", tier: "legendary", price: 500, css: "inline-block bg-gradient-to-r from-purple-700 via-pink-500 to-purple-700 bg-[length:300%_100%] bg-clip-text text-transparent animate-[cosmic_4s_ease-in-out_infinite]", desc: "Nebula aura", extra: "drop-shadow-[0_0_40px_rgba(168,85,247,1)]" },
  ];

  for (const c of items) {
    const cssClass = (c as any).extra ? `${c.css} ${(c as any).extra}` : c.css;
    await client.execute({
      sql: `INSERT INTO cosmetic_items (type, name, tier, price, cssClass, description, category, isLimited, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [c.type, c.name, c.tier, c.price, cssClass, c.desc, "general", (c as any).limited ? 1 : 0, (c as any).stock ?? -1],
    });
  }

  console.log(`[Cosmetics] Seeded ${items.length} items.`);
}
