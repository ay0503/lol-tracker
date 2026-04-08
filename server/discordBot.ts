/**
 * Discord Gateway bot — listens for messages, parses intent via LLM,
 * returns data or executes trades with confirmation flow.
 */
import {
  Client, GatewayIntentBits, Events, EmbedBuilder, REST, Routes,
  SlashCommandBuilder, type Message, type MessageReaction, type User,
  type ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, type ButtonInteraction,
} from "discord.js";
import { ENV } from "./_core/env";
import { cache } from "./cache";
import {
  getUserByDiscordId, linkDiscordUser, unlinkDiscordUser,
  getUserByEmail, getOrCreatePortfolio, getUserHoldings,
  executeTrade, executeShort, executeCover, getUserTrades,
  getRecentMatchesFromDB, getLeaderboard, placeBet, getUserBets,
  getUserDividends, getAllTrades, getRawClient,
} from "./db";
import { computeAllETFPricesSync, TICKERS, type Ticker } from "./etfPricing";
import { getPriceHistory } from "./db";
import { parseIntent, type BotIntent } from "./discordIntent";

// ─── Pending Trade Confirmations ───

interface PendingTrade {
  userId: number;
  discordUserId: string;
  intent: BotIntent;
  ticker: string;
  shares: number;
  price: number;
  totalCost: number;
  expiresAt: number;
}

const pendingTrades = new Map<string, PendingTrade>();

// Cleanup expired trades every 30s
setInterval(() => {
  const now = Date.now();
  for (const [msgId, trade] of Array.from(pendingTrades.entries())) {
    if (trade.expiresAt < now) pendingTrades.delete(msgId);
  }
}, 30_000);

// ─── Per-user cooldown ───
const lastCommandTime = new Map<string, number>();
const COOLDOWN_MS = 2000;

// ─── Helpers ───

async function getETFPrices(): Promise<Record<string, number>> {
  const cached = cache.get<{ ticker: string; price: number }[]>("prices.etfPrices");
  if (cached) {
    const map: Record<string, number> = {};
    for (const entry of cached) map[entry.ticker] = entry.price;
    return map;
  }
  // Fallback: compute from DB
  const history = await getPriceHistory();
  if (!history || history.length === 0) return {};
  return computeAllETFPricesSync(history);
}

function formatDollars(n: number): string {
  return `$${n.toFixed(2)}`;
}

function embedColor(type: "info" | "success" | "error" | "warn"): number {
  return type === "success" ? 0x00c805 : type === "error" ? 0xff5252 : type === "warn" ? 0xffd600 : 0x5865f2;
}

// ─── Read Handlers ───

async function handlePortfolio(userId: number, userName: string): Promise<EmbedBuilder> {
  const portfolio = await getOrCreatePortfolio(userId);
  const holdingsList = await getUserHoldings(userId);
  const prices = await getETFPrices();

  const cash = parseFloat(String(portfolio.cashBalance ?? "200"));
  const casinoCash = parseFloat(String(portfolio.casinoBalance ?? "20"));
  let holdingsValue = 0;
  let shortPnl = 0;
  const lines: string[] = [];

  for (const h of holdingsList) {
    const price = prices[h.ticker] ?? 0;
    const shares = parseFloat(String(h.shares ?? "0"));
    const shortShares = parseFloat(String(h.shortShares ?? "0"));
    const avgCost = parseFloat(String(h.avgCostBasis ?? "0"));
    const shortAvg = parseFloat(String(h.shortAvgPrice ?? "0"));

    if (shares > 0) {
      const val = shares * price;
      const pnl = val - shares * avgCost;
      holdingsValue += val;
      lines.push(`$${h.ticker}  ${shares.toFixed(2)} shares  ${formatDollars(val)}  ${pnl >= 0 ? "+" : ""}${formatDollars(pnl)}`);
    }
    if (shortShares > 0) {
      const pnl = shortShares * (shortAvg - price);
      shortPnl += pnl;
      lines.push(`$${h.ticker}  ${shortShares.toFixed(2)} short  ${pnl >= 0 ? "+" : ""}${formatDollars(pnl)}`);
    }
  }

  const totalValue = cash + holdingsValue + shortPnl;
  const pnl = totalValue - 200;

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${userName}'s Portfolio`)
    .setColor(pnl >= 0 ? embedColor("success") : embedColor("error"))
    .addFields(
      { name: "Total Value", value: formatDollars(totalValue), inline: true },
      { name: "P&L", value: `${pnl >= 0 ? "+" : ""}${formatDollars(pnl)} (${pnl >= 0 ? "+" : ""}${((pnl / 200) * 100).toFixed(1)}%)`, inline: true },
      { name: "Cash", value: formatDollars(cash), inline: true },
    );

  if (lines.length > 0) {
    embed.addFields({ name: "Holdings", value: "```\n" + lines.join("\n") + "\n```" });
  }

  embed.addFields({ name: "Casino Cash", value: formatDollars(casinoCash), inline: true });
  return embed;
}

async function handlePrices(): Promise<EmbedBuilder> {
  const prices = await getETFPrices();
  const lines = TICKERS.map(ticker => {
    const price = prices[ticker] ?? 0;
    return `$${ticker}  ${formatDollars(price)}`;
  });

  return new EmbedBuilder()
    .setTitle("📈 ETF Prices")
    .setColor(embedColor("info"))
    .setDescription("```\n" + lines.join("\n") + "\n```");
}

async function handleLeaderboard(): Promise<EmbedBuilder> {
  const { users: allUsers, holdingsByUser } = await getLeaderboard();
  const prices = await getETFPrices();

  const ranked = allUsers.map(user => {
    const cash = parseFloat(String(user.cashBalance ?? "200"));
    const userHoldings = holdingsByUser.get(user.userId) ?? [];
    let holdingsVal = 0;
    let shortPnl = 0;
    for (const h of userHoldings) {
      const price = prices[h.ticker] ?? 0;
      const shares = parseFloat(String(h.shares ?? "0"));
      const shortShares = parseFloat(String(h.shortShares ?? "0"));
      const shortAvg = parseFloat(String(h.shortAvgPrice ?? "0"));
      holdingsVal += shares * price;
      if (shortShares > 0) shortPnl += shortShares * (shortAvg - price);
    }
    const total = cash + holdingsVal + shortPnl;
    return { name: String(user.userName), total, pnl: total - 200 };
  }).sort((a, b) => b.total - a.total).slice(0, 10);

  const medals = ["🥇", "🥈", "🥉"];
  const lines = ranked.map((entry, idx) => {
    const medal = medals[idx] ?? `${idx + 1}.`;
    const sign = entry.pnl >= 0 ? "+" : "";
    return `${medal} ${entry.name}  ${formatDollars(entry.total)}  (${sign}${formatDollars(entry.pnl)})`;
  });

  return new EmbedBuilder()
    .setTitle("🏆 Leaderboard")
    .setColor(embedColor("info"))
    .setDescription("```\n" + lines.join("\n") + "\n```");
}

async function handleLiveGame(): Promise<EmbedBuilder> {
  const inGame = cache.get<boolean>("player.liveGame.check");
  if (!inGame) {
    return new EmbedBuilder()
      .setTitle("🎮 Game Status")
      .setColor(embedColor("info"))
      .setDescription("Not in game. Markets are open.");
  }

  const details = cache.get<any>("player.liveGame.details") ?? {};
  const champion = details.championName ?? "Unknown";
  const gameMode = details.gameMode ?? "Ranked";
  const elapsed = details.gameLengthSeconds
    ? `${Math.floor(details.gameLengthSeconds / 60)}:${String(details.gameLengthSeconds % 60).padStart(2, "0")}`
    : "just started";

  return new EmbedBuilder()
    .setTitle("🔴 IN GAME")
    .setColor(embedColor("error"))
    .setDescription(`**${champion}** — ${gameMode}\nElapsed: ${elapsed}\n\n⚠️ Trading is halted.`);
}

async function handleMatchHistory(count: number): Promise<EmbedBuilder> {
  const matches = await getRecentMatchesFromDB(count);
  if (matches.length === 0) {
    return new EmbedBuilder().setTitle("📋 Match History").setColor(embedColor("info")).setDescription("No recent matches.");
  }

  const lines = matches.map(m => {
    const result = m.win ? "✅ W" : "❌ L";
    const kda = `${m.kills}/${m.deaths}/${m.assists}`;
    const dur = `${Math.floor(m.gameDuration / 60)}m`;
    return `${result}  ${m.champion}  ${kda}  ${dur}`;
  });

  return new EmbedBuilder()
    .setTitle(`📋 Last ${matches.length} Matches`)
    .setColor(embedColor("info"))
    .setDescription("```\n" + lines.join("\n") + "\n```");
}

async function handleCasinoBalance(userId: number, userName: string): Promise<EmbedBuilder> {
  const portfolio = await getOrCreatePortfolio(userId);
  const balance = parseFloat(String(portfolio.casinoBalance ?? "20"));
  return new EmbedBuilder()
    .setTitle(`🎰 ${userName}'s Casino Balance`)
    .setColor(embedColor("info"))
    .setDescription(`**${formatDollars(balance)}**`);
}

async function handleHoldings(userId: number, userName: string): Promise<EmbedBuilder> {
  const holdingsList = await getUserHoldings(userId);
  const prices = await getETFPrices();

  if (holdingsList.length === 0 || holdingsList.every(h => parseFloat(String(h.shares ?? "0")) === 0 && parseFloat(String(h.shortShares ?? "0")) === 0)) {
    return new EmbedBuilder().setTitle(`💼 ${userName}'s Holdings`).setColor(embedColor("info")).setDescription("No positions.");
  }

  const lines: string[] = [];
  for (const h of holdingsList) {
    const price = prices[h.ticker] ?? 0;
    const shares = parseFloat(String(h.shares ?? "0"));
    const shortShares = parseFloat(String(h.shortShares ?? "0"));
    const avgCost = parseFloat(String(h.avgCostBasis ?? "0"));
    const shortAvg = parseFloat(String(h.shortAvgPrice ?? "0"));

    if (shares > 0) {
      const val = shares * price;
      const pnl = val - shares * avgCost;
      lines.push(`$${h.ticker} LONG  ${shares.toFixed(2)} @ ${formatDollars(avgCost)} → ${formatDollars(price)}  P&L: ${pnl >= 0 ? "+" : ""}${formatDollars(pnl)}`);
    }
    if (shortShares > 0) {
      const pnl = shortShares * (shortAvg - price);
      lines.push(`$${h.ticker} SHORT  ${shortShares.toFixed(2)} @ ${formatDollars(shortAvg)} → ${formatDollars(price)}  P&L: ${pnl >= 0 ? "+" : ""}${formatDollars(pnl)}`);
    }
  }

  return new EmbedBuilder()
    .setTitle(`💼 ${userName}'s Holdings`)
    .setColor(embedColor("info"))
    .setDescription("```\n" + lines.join("\n") + "\n```");
}

async function handleCompare(userId: number, userName: string, targetName: string): Promise<EmbedBuilder> {
  // Find target user by display name
  const client = getRawClient();
  const allUsers = await client.execute(`SELECT id, COALESCE(displayName, name) as userName FROM users`);
  const targetRow = allUsers.rows.find(
    (row: any) => String(row.userName).toLowerCase() === targetName.toLowerCase()
  );

  if (!targetRow) {
    return new EmbedBuilder()
      .setColor(embedColor("error"))
      .setDescription(`❌ User "${targetName}" not found.`);
  }

  const targetId = Number(targetRow.id);
  const targetDisplayName = String(targetRow.userName);
  const prices = await getETFPrices();

  // Helper to compute total value
  async function computeValue(uid: number) {
    const portfolio = await getOrCreatePortfolio(uid);
    const holdingsList = await getUserHoldings(uid);
    const cash = parseFloat(String(portfolio.cashBalance ?? "200"));
    let holdingsVal = 0;
    let shortPnl = 0;
    for (const h of holdingsList) {
      const price = prices[h.ticker] ?? 0;
      const shares = parseFloat(String(h.shares ?? "0"));
      const shortShares = parseFloat(String(h.shortShares ?? "0"));
      const shortAvg = parseFloat(String(h.shortAvgPrice ?? "0"));
      holdingsVal += shares * price;
      if (shortShares > 0) shortPnl += shortShares * (shortAvg - price);
    }
    const total = cash + holdingsVal + shortPnl;
    return { cash, holdingsVal, shortPnl, total, pnl: total - 200 };
  }

  const me = await computeValue(userId);
  const them = await computeValue(targetId);
  const diff = me.total - them.total;
  const winning = diff > 0;

  return new EmbedBuilder()
    .setTitle(`⚔️ ${userName} vs ${targetDisplayName}`)
    .setColor(winning ? embedColor("success") : embedColor("error"))
    .addFields(
      { name: userName, value: `${formatDollars(me.total)}\nP&L: ${me.pnl >= 0 ? "+" : ""}${formatDollars(me.pnl)}`, inline: true },
      { name: "vs", value: winning ? `← +${formatDollars(Math.abs(diff))}` : `→ +${formatDollars(Math.abs(diff))}`, inline: true },
      { name: targetDisplayName, value: `${formatDollars(them.total)}\nP&L: ${them.pnl >= 0 ? "+" : ""}${formatDollars(them.pnl)}`, inline: true },
    )
    .setFooter({ text: winning ? `${userName} leads by ${formatDollars(diff)}` : `${targetDisplayName} leads by ${formatDollars(Math.abs(diff))}` });
}

async function handleRecentTrades(count: number): Promise<EmbedBuilder> {
  const recentTrades = await getAllTrades(count);
  if (recentTrades.length === 0) {
    return new EmbedBuilder().setTitle("📋 Recent Trades").setColor(embedColor("info")).setDescription("No trades yet.");
  }
  const lines = recentTrades.map(tr => {
    const type = String(tr.type).toUpperCase().padEnd(5);
    const shares = parseFloat(String(tr.shares ?? "0")).toFixed(2);
    const price = parseFloat(String(tr.pricePerShare ?? "0")).toFixed(2);
    const total = parseFloat(String(tr.totalAmount ?? "0")).toFixed(2);
    return `${type} $${tr.ticker}  ${shares} @ $${price}  $${total}  ${tr.userName}`;
  });
  return new EmbedBuilder()
    .setTitle(`📋 Last ${recentTrades.length} Trades`)
    .setColor(embedColor("info"))
    .setDescription("```\n" + lines.join("\n") + "\n```");
}

async function handleCasinoLeaderboard(): Promise<EmbedBuilder> {
  const client = getRawClient();
  const result = await client.execute(`
    SELECT u.id, COALESCE(u.displayName, u.name) as userName, p.casinoBalance
    FROM users u JOIN portfolios p ON p.userId = u.id
    WHERE CAST(p.casinoBalance AS REAL) > 0
    ORDER BY CAST(p.casinoBalance AS REAL) DESC LIMIT 10
  `);
  if (result.rows.length === 0) {
    return new EmbedBuilder().setTitle("🎰 Casino Leaderboard").setColor(embedColor("info")).setDescription("No players yet.");
  }
  const medals = ["🥇", "🥈", "🥉"];
  const lines = result.rows.map((row, idx) => {
    const medal = medals[idx] ?? `${idx + 1}.`;
    const balance = parseFloat(String(row.casinoBalance ?? "0"));
    const profit = balance - 20;
    return `${medal} ${row.userName}  ${formatDollars(balance)}  (${profit >= 0 ? "+" : ""}${formatDollars(profit)})`;
  });
  return new EmbedBuilder()
    .setTitle("🎰 Casino Leaderboard")
    .setColor(embedColor("info"))
    .setDescription("```\n" + lines.join("\n") + "\n```");
}

async function handleMyTrades(userId: number, userName: string, count: number): Promise<EmbedBuilder> {
  const myTrades = await getUserTrades(userId, count);
  if (myTrades.length === 0) {
    return new EmbedBuilder().setTitle(`📋 ${userName}'s Trades`).setColor(embedColor("info")).setDescription("No trades yet.");
  }
  const lines = myTrades.map(tr => {
    const type = String(tr.type).toUpperCase().padEnd(5);
    const shares = parseFloat(String(tr.shares ?? "0")).toFixed(2);
    const price = parseFloat(String(tr.pricePerShare ?? "0")).toFixed(2);
    const total = parseFloat(String(tr.totalAmount ?? "0")).toFixed(2);
    return `${type} $${tr.ticker}  ${shares} @ $${price}  $${total}`;
  });
  return new EmbedBuilder()
    .setTitle(`📋 ${userName}'s Last ${myTrades.length} Trades`)
    .setColor(embedColor("info"))
    .setDescription("```\n" + lines.join("\n") + "\n```");
}

async function handleCasinoDeposit(message: Message, userId: number, amount: number): Promise<void> {
  try {
    // Fetch multiplier
    let multiplier = 10;
    try {
      const client = getRawClient();
      const res = await client.execute(`SELECT value FROM app_config WHERE key = 'casino_multiplier'`);
      if (res.rows.length > 0) multiplier = Number(res.rows[0].value) || 10;
    } catch { /* use default */ }

    const portfolio = await getOrCreatePortfolio(userId);
    const tradingCash = parseFloat(String(portfolio.cashBalance ?? "200"));
    const casinoCash = parseFloat(String(portfolio.casinoBalance ?? "20"));

    if (amount > tradingCash) {
      await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`Insufficient trading cash. You have ${formatDollars(tradingCash)}.`)] });
      return;
    }

    const casinoAmount = amount * multiplier;
    const { getDb: getDatabase } = await import("./db");
    const { portfolios } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDatabase();
    await db.update(portfolios).set({
      cashBalance: (tradingCash - amount).toFixed(2),
      casinoBalance: (casinoCash + casinoAmount).toFixed(2),
    }).where(eq(portfolios.userId, userId));

    cache.invalidate("leaderboard.rankings");
    cache.invalidate("casino.leaderboard");

    await message.reply({ embeds: [new EmbedBuilder()
      .setTitle("🎰 Casino Deposit")
      .setColor(embedColor("success"))
      .setDescription(`${formatDollars(amount)} trading cash → ${formatDollars(casinoAmount)} casino cash (${multiplier}x)`)
      .addFields(
        { name: "Trading Cash", value: formatDollars(tradingCash - amount), inline: true },
        { name: "Casino Cash", value: formatDollars(casinoCash + casinoAmount), inline: true },
      )] });
  } catch (err: any) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`❌ ${err.message}`)] });
  }
}

async function handleRoulette(message: Message, userId: number, color: "red" | "black" | "green", amount: number): Promise<void> {
  try {
    const { checkCasinoCooldown, recordCasinoGame } = await import("./casinoUtils");
    await checkCasinoCooldown(userId);

    const portfolio = await getOrCreatePortfolio(userId);
    const casinoCash = parseFloat(String(portfolio.casinoBalance ?? "20"));
    if (amount > casinoCash) {
      await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`Insufficient casino cash. You have ${formatDollars(casinoCash)}.`)] });
      return;
    }

    // Deduct bet
    const { getDb: getDatabase } = await import("./db");
    const { portfolios } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDatabase();
    await db.update(portfolios).set({ casinoBalance: (casinoCash - amount).toFixed(2) }).where(eq(portfolios.userId, userId));

    // Spin
    const { spin } = await import("./roulette");
    const result = spin({ type: color, amount });

    // Credit winnings
    if (result.totalPayout > 0) {
      const fresh = await getOrCreatePortfolio(userId);
      const newCasino = parseFloat(String(fresh.casinoBalance ?? "0")) + result.totalPayout;
      await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, userId));
    }

    recordCasinoGame(userId);
    cache.invalidate("casino.leaderboard");

    const won = result.totalPayout > 0;
    const outcomeColor = String(result.color ?? "?");
    const embed = new EmbedBuilder()
      .setTitle(won ? "🎰 Roulette — WIN!" : "🎰 Roulette — Loss")
      .setColor(won ? embedColor("success") : embedColor("error"))
      .addFields(
        { name: "Bet", value: `${formatDollars(amount)} on **${color.toUpperCase()}**`, inline: true },
        { name: "Result", value: `**${outcomeColor.toUpperCase()}**`, inline: true },
        { name: won ? "Payout" : "Lost", value: won ? `+${formatDollars(result.totalPayout)}` : formatDollars(amount), inline: true },
      );

    await message.reply({ embeds: [embed] });

    // Big win notification
    if (won && result.totalPayout >= 10) {
      const userName = String((await getUserByDiscordId(message.author.id))?.displayName ?? "User");
      const mult = result.totalPayout / amount;
      import("./discord").then(d => d.notifyCasinoBigWin(userName, "Roulette", mult, result.totalPayout)).catch(() => {});
    }
  } catch (err: any) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`❌ ${err.message}`)] });
  }
}

// ─── New Read Handlers ───

async function handleNews(count: number): Promise<EmbedBuilder> {
  const client = getRawClient();
  const result = await client.execute({ sql: `SELECT headline, body, champion, createdAt FROM news ORDER BY createdAt DESC LIMIT ?`, args: [count] });
  if (result.rows.length === 0) return new EmbedBuilder().setTitle("📰 News").setColor(embedColor("info")).setDescription("No news yet.");
  const lines = result.rows.map(row => `**${row.headline}**\n${String(row.body).slice(0, 100)}${String(row.body).length > 100 ? "..." : ""}`);
  return new EmbedBuilder().setTitle("📰 Latest News").setColor(embedColor("info")).setDescription(lines.join("\n\n"));
}

async function handleNotifications(userId: number): Promise<EmbedBuilder> {
  const client = getRawClient();
  const result = await client.execute({ sql: `SELECT title, message, isRead, createdAt FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 10`, args: [userId] });
  if (result.rows.length === 0) return new EmbedBuilder().setTitle("🔔 Notifications").setColor(embedColor("info")).setDescription("No notifications.");
  const lines = result.rows.map(row => `${Number(row.isRead) ? "📭" : "📬"} **${row.title}** — ${String(row.message).slice(0, 80)}`);
  const unread = result.rows.filter(row => !Number(row.isRead)).length;
  return new EmbedBuilder()
    .setTitle(`🔔 Notifications${unread > 0 ? ` (${unread} unread)` : ""}`)
    .setColor(embedColor("info"))
    .setDescription(lines.join("\n"));
}

async function handleBettingStatus(): Promise<EmbedBuilder> {
  const inGame = cache.get<boolean>("player.liveGame.check") ?? false;
  const details = cache.get<any>("player.liveGame.details") ?? {};
  const gameElapsed = details?.gameStartTime
    ? Math.floor((Date.now() - details.gameStartTime) / 1000) + (details.gameLengthSeconds ?? 0)
    : 0;
  const bettingOpen = inGame && gameElapsed <= 300;
  const timeLeft = bettingOpen ? Math.max(0, 300 - gameElapsed) : 0;

  if (!inGame) {
    return new EmbedBuilder().setTitle("🎲 Betting Status").setColor(embedColor("info")).setDescription("No game in progress. Betting opens when a game starts.");
  }

  return new EmbedBuilder()
    .setTitle("🎲 Betting Status")
    .setColor(bettingOpen ? embedColor("success") : embedColor("error"))
    .setDescription(bettingOpen
      ? `**OPEN** — ${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")} remaining\nType: \`bet $10 on win\` or \`bet $5 loss\``
      : "**CLOSED** — Game has been live for more than 5 minutes.");
}

async function handleChampionPool(): Promise<EmbedBuilder> {
  const client = getRawClient();
  const result = await client.execute(`
    SELECT champion, COUNT(*) as games,
      SUM(CASE WHEN win = 1 THEN 1 ELSE 0 END) as wins,
      ROUND(AVG(kills), 1) as avgK, ROUND(AVG(deaths), 1) as avgD, ROUND(AVG(assists), 1) as avgA
    FROM matches GROUP BY champion ORDER BY games DESC LIMIT 10
  `);
  if (result.rows.length === 0) return new EmbedBuilder().setTitle("🏆 Champion Pool").setColor(embedColor("info")).setDescription("No matches yet.");
  const lines = result.rows.map(row => {
    const games = Number(row.games);
    const wr = games > 0 ? Math.round((Number(row.wins) / games) * 100) : 0;
    return `${row.champion}  ${games}G  ${wr}% WR  ${row.avgK}/${row.avgD}/${row.avgA}`;
  });
  return new EmbedBuilder().setTitle("🏆 Champion Pool").setColor(embedColor("info")).setDescription("```\n" + lines.join("\n") + "\n```");
}

async function handleStreaks(): Promise<EmbedBuilder> {
  const client = getRawClient();
  const result = await client.execute(`SELECT win FROM matches ORDER BY gameCreation DESC LIMIT 20`);
  if (result.rows.length === 0) return new EmbedBuilder().setTitle("🔥 Streaks").setColor(embedColor("info")).setDescription("No matches yet.");
  let streak = 0;
  const firstResult = Number(result.rows[0].win);
  for (const row of result.rows) {
    if (Number(row.win) === firstResult) streak++;
    else break;
  }
  const streakType = firstResult ? "WIN" : "LOSS";
  const emoji = firstResult ? (streak >= 5 ? "🔥🔥🔥" : streak >= 3 ? "🔥" : "✅") : (streak >= 5 ? "💀💀💀" : streak >= 3 ? "💀" : "❌");
  const sequence = result.rows.slice(0, 15).map(row => Number(row.win) ? "W" : "L").join(" ");
  return new EmbedBuilder()
    .setTitle(`${emoji} ${streak} ${streakType} STREAK`)
    .setColor(firstResult ? embedColor("success") : embedColor("error"))
    .setDescription(`\`${sequence}\``);
}

async function handleMyBets(userId: number, userName: string): Promise<EmbedBuilder> {
  const betsList = await getUserBets(userId);
  if (betsList.length === 0) return new EmbedBuilder().setTitle(`🎲 ${userName}'s Bets`).setColor(embedColor("info")).setDescription("No bets yet.");
  const lines = betsList.map(bet => {
    const status = String(bet.status);
    const icon = status === "won" ? "✅" : status === "lost" ? "❌" : "⏳";
    const payout = bet.payout ? ` → $${parseFloat(String(bet.payout)).toFixed(0)}` : "";
    return `${icon} ${bet.prediction.toUpperCase()} $${parseFloat(String(bet.amount)).toFixed(0)}${payout}`;
  });
  return new EmbedBuilder().setTitle(`🎲 ${userName}'s Bets`).setColor(embedColor("info")).setDescription("```\n" + lines.join("\n") + "\n```");
}

async function handleMyOrders(userId: number, userName: string): Promise<EmbedBuilder> {
  const client = getRawClient();
  const result = await client.execute({ sql: `SELECT id, ticker, orderType, shares, targetPrice, status FROM orders WHERE userId = ? ORDER BY createdAt DESC LIMIT 10`, args: [userId] });
  if (result.rows.length === 0) return new EmbedBuilder().setTitle(`📋 ${userName}'s Orders`).setColor(embedColor("info")).setDescription("No orders.");
  const lines = result.rows.map(row => {
    const status = String(row.status) === "pending" ? "⏳" : String(row.status) === "filled" ? "✅" : "❌";
    return `${status} #${row.id} ${row.orderType} $${row.ticker} ${parseFloat(String(row.shares)).toFixed(2)} @ $${parseFloat(String(row.targetPrice)).toFixed(2)}`;
  });
  return new EmbedBuilder().setTitle(`📋 ${userName}'s Orders`).setColor(embedColor("info")).setDescription("```\n" + lines.join("\n") + "\n```");
}

async function handleMyDividends(userId: number, userName: string, count: number): Promise<EmbedBuilder> {
  const divs = await getUserDividends(userId, count);
  if (divs.length === 0) return new EmbedBuilder().setTitle(`💰 ${userName}'s Dividends`).setColor(embedColor("info")).setDescription("No dividends yet.");
  const total = divs.reduce((sum, d) => sum + parseFloat(String(d.totalPayout ?? "0")), 0);
  const lines = divs.slice(0, 15).map(d => {
    const payout = parseFloat(String(d.totalPayout ?? "0")).toFixed(2);
    const reason = String(d.reason ?? "").slice(0, 40);
    return `+$${payout}  ${reason}`;
  });
  return new EmbedBuilder()
    .setTitle(`💰 ${userName}'s Dividends`)
    .setColor(embedColor("success"))
    .setDescription("```\n" + lines.join("\n") + "\n```")
    .addFields({ name: "Total", value: formatDollars(total), inline: true });
}

async function handleShopCatalog(): Promise<EmbedBuilder> {
  const client = getRawClient();
  const result = await client.execute(`SELECT name, type, tier, price, description FROM cosmetic_items WHERE (stock IS NULL OR stock > 0) ORDER BY price DESC LIMIT 20`);
  if (result.rows.length === 0) return new EmbedBuilder().setTitle("🛒 Shop").setColor(embedColor("info")).setDescription("Shop is empty.");
  const lines = result.rows.map(row => {
    const tierEmoji = String(row.tier) === "legendary" ? "⭐" : String(row.tier) === "epic" ? "💎" : String(row.tier) === "rare" ? "🔵" : "⚪";
    return `${tierEmoji} ${row.name}  $${Number(row.price)}  (${row.type === "title" ? "Title" : "Effect"})`;
  });
  return new EmbedBuilder().setTitle("🛒 Cosmetics Shop").setColor(embedColor("info")).setDescription("```\n" + lines.join("\n") + "\n```").setFooter({ text: "Buy with: buy [name]" });
}

async function handleMyCosmetics(userId: number, userName: string): Promise<EmbedBuilder> {
  const client = getRawClient();
  const result = await client.execute({
    sql: `SELECT ci.name, ci.type, ci.tier FROM user_cosmetics uc JOIN cosmetic_items ci ON ci.id = uc.cosmeticId WHERE uc.userId = ?`,
    args: [userId],
  });
  if (result.rows.length === 0) return new EmbedBuilder().setTitle(`🎨 ${userName}'s Cosmetics`).setColor(embedColor("info")).setDescription("No cosmetics owned. Visit the shop!");
  const lines = result.rows.map(row => `${row.type === "title" ? "🏷️" : "✨"} ${row.name} (${row.tier})`);
  return new EmbedBuilder().setTitle(`🎨 ${userName}'s Cosmetics`).setColor(embedColor("info")).setDescription(lines.join("\n"));
}

async function handlePlayerStats(): Promise<EmbedBuilder> {
  const current = cache.get<any>("player.current");
  const client = getRawClient();
  const kdaResult = await client.execute(`SELECT ROUND(AVG(kills),1) as k, ROUND(AVG(deaths),1) as d, ROUND(AVG(assists),1) as a, COUNT(*) as games FROM matches`);
  const row = kdaResult.rows[0];
  const embed = new EmbedBuilder().setTitle("📊 Player Stats").setColor(embedColor("info"));
  if (current) {
    embed.addFields(
      { name: "Rank", value: `${current.tier ?? "?"} ${current.division ?? ""} ${current.lp ?? 0}LP`, inline: true },
      { name: "Record", value: `${current.wins ?? 0}W ${current.losses ?? 0}L`, inline: true },
    );
  }
  if (row) {
    embed.addFields(
      { name: "Avg KDA", value: `${row.k}/${row.d}/${row.a}`, inline: true },
      { name: "Total Games", value: String(row.games), inline: true },
    );
  }
  return embed;
}

// ─── New Action Handlers ───

async function handleDice(message: Message, userId: number, amount: number, target: number, direction: "over" | "under"): Promise<void> {
  try {
    const { checkCasinoCooldown, recordCasinoGame } = await import("./casinoUtils");
    await checkCasinoCooldown(userId);
    const portfolio = await getOrCreatePortfolio(userId);
    const casinoCash = parseFloat(String(portfolio.casinoBalance ?? "20"));
    if (amount > casinoCash) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`Insufficient casino cash. You have ${formatDollars(casinoCash)}.`)] }); return; }
    const { getDb: getDatabase } = await import("./db");
    const { portfolios } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDatabase();
    await db.update(portfolios).set({ casinoBalance: (casinoCash - amount).toFixed(2) }).where(eq(portfolios.userId, userId));
    const { roll } = await import("./dice");
    const result = roll(amount, target, direction);
    if (result.payout > 0) {
      const fresh = await getOrCreatePortfolio(userId);
      const newCasino = parseFloat(String(fresh.casinoBalance ?? "0")) + result.payout;
      await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, userId));
    }
    recordCasinoGame(userId);
    cache.invalidate("casino.leaderboard");
    const won = result.payout > 0;
    await message.reply({ embeds: [new EmbedBuilder()
      .setTitle(won ? "🎲 Dice — WIN!" : "🎲 Dice — Loss")
      .setColor(won ? embedColor("success") : embedColor("error"))
      .addFields(
        { name: "Roll", value: `**${result.roll.toFixed(2)}**`, inline: true },
        { name: "Target", value: `${direction} ${target}`, inline: true },
        { name: won ? "Payout" : "Lost", value: won ? `+${formatDollars(result.payout)} (${result.multiplier}x)` : formatDollars(amount), inline: true },
      )] });
  } catch (err: any) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`❌ ${err.message}`)] }); }
}

async function handleCrash(message: Message, userId: number, amount: number, autoCashout?: number): Promise<void> {
  try {
    const { checkCasinoCooldown, recordCasinoGame } = await import("./casinoUtils");
    await checkCasinoCooldown(userId);
    const portfolio = await getOrCreatePortfolio(userId);
    const casinoCash = parseFloat(String(portfolio.casinoBalance ?? "20"));
    if (amount > casinoCash) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`Insufficient casino cash. You have ${formatDollars(casinoCash)}.`)] }); return; }
    const { getDb: getDatabase } = await import("./db");
    const { portfolios } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDatabase();
    await db.update(portfolios).set({ casinoBalance: (casinoCash - amount).toFixed(2) }).where(eq(portfolios.userId, userId));
    const { startCrashGame } = await import("./crash");
    const game = startCrashGame(userId, amount, autoCashout);
    // Crash auto-resolves — wait for it
    const checkResult = async (): Promise<any> => {
      const { getActiveCrashGame } = await import("./crash");
      const g = getActiveCrashGame(userId);
      if (!g || g.status !== "flying") return g;
      await new Promise(resolve => setTimeout(resolve, 200));
      return checkResult();
    };
    const result = await Promise.race([checkResult(), new Promise(resolve => setTimeout(() => resolve(null), 15000))]) as any;
    if (!result) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("warn")).setDescription("Crash game timed out.")] }); return; }
    // Credit payout
    if (result.status === "cashed_out" && result.payout > 0) {
      const fresh = await getOrCreatePortfolio(userId);
      const newCasino = parseFloat(String(fresh.casinoBalance ?? "0")) + result.payout;
      await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, userId));
    }
    recordCasinoGame(userId);
    cache.invalidate("casino.leaderboard");
    const won = result.status === "cashed_out";
    await message.reply({ embeds: [new EmbedBuilder()
      .setTitle(won ? "🚀 Crash — Cashed Out!" : "💥 Crash — Busted!")
      .setColor(won ? embedColor("success") : embedColor("error"))
      .addFields(
        { name: "Crash Point", value: `**${(result.crashPoint ?? 1).toFixed(2)}x**`, inline: true },
        { name: won ? "Cashout" : "Bet", value: won ? `${(result.cashoutMultiplier ?? 1).toFixed(2)}x → +${formatDollars(result.payout ?? 0)}` : formatDollars(amount), inline: true },
      )] });
  } catch (err: any) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`❌ ${err.message}`)] }); }
}

async function handlePlinko(message: Message, userId: number, amount: number, risk: "low" | "medium" | "high"): Promise<void> {
  try {
    const { checkCasinoCooldown, recordCasinoGame } = await import("./casinoUtils");
    await checkCasinoCooldown(userId);
    const portfolio = await getOrCreatePortfolio(userId);
    const casinoCash = parseFloat(String(portfolio.casinoBalance ?? "20"));
    if (amount > casinoCash) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`Insufficient casino cash. You have ${formatDollars(casinoCash)}.`)] }); return; }
    const { getDb: getDatabase } = await import("./db");
    const { portfolios } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDatabase();
    await db.update(portfolios).set({ casinoBalance: (casinoCash - amount).toFixed(2) }).where(eq(portfolios.userId, userId));
    const { drop: dropBall } = await import("./plinko");
    const result = dropBall(amount, risk);
    if (result.payout > 0) {
      const fresh = await getOrCreatePortfolio(userId);
      const newCasino = parseFloat(String(fresh.casinoBalance ?? "0")) + result.payout;
      await db.update(portfolios).set({ casinoBalance: newCasino.toFixed(2) }).where(eq(portfolios.userId, userId));
    }
    recordCasinoGame(userId);
    cache.invalidate("casino.leaderboard");
    const won = result.payout > 0;
    await message.reply({ embeds: [new EmbedBuilder()
      .setTitle(won ? "📌 Plinko — WIN!" : "📌 Plinko — Loss")
      .setColor(won ? embedColor("success") : embedColor("error"))
      .addFields(
        { name: "Multiplier", value: `**${result.multiplier.toFixed(2)}x**`, inline: true },
        { name: "Risk", value: risk.toUpperCase(), inline: true },
        { name: won ? "Payout" : "Lost", value: won ? `+${formatDollars(result.payout)}` : formatDollars(amount), inline: true },
      )] });
  } catch (err: any) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`❌ ${err.message}`)] }); }
}

async function handleDailyBonus(message: Message, userId: number): Promise<void> {
  try {
    const client = getRawClient();
    const today = new Date().toISOString().slice(0, 10);
    const claimed = await client.execute({ sql: `SELECT id FROM casino_daily_claims WHERE userId = ? AND date(createdAt) = ?`, args: [userId, today] });
    if (claimed.rows.length > 0) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("warn")).setDescription("Already claimed today! Come back tomorrow.")] }); return; }
    const portfolio = await getOrCreatePortfolio(userId);
    const casinoCash = parseFloat(String(portfolio.casinoBalance ?? "20"));
    const { getDb: getDatabase } = await import("./db");
    const { portfolios } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDatabase();
    await db.update(portfolios).set({ casinoBalance: (casinoCash + 1).toFixed(2) }).where(eq(portfolios.userId, userId));
    await client.execute({ sql: `INSERT INTO casino_daily_claims (userId) VALUES (?)`, args: [userId] });
    await message.reply({ embeds: [new EmbedBuilder().setTitle("🎁 Daily Bonus!").setColor(embedColor("success")).setDescription(`+$1.00 casino cash! Balance: ${formatDollars(casinoCash + 1)}`)] });
  } catch (err: any) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`❌ ${err.message}`)] }); }
}

async function handleCreateOrder(message: Message, userId: number, ticker: string, orderType: string, shares: number, targetPrice: number): Promise<void> {
  try {
    const { createOrder } = await import("./db");
    await createOrder({ userId, ticker, orderType: orderType as any, shares, targetPrice });
    const label = orderType.replace("_", " ").toUpperCase();
    await message.reply({ embeds: [new EmbedBuilder().setTitle("📋 Order Created").setColor(embedColor("success")).addFields(
      { name: "Type", value: label, inline: true },
      { name: "Ticker", value: `$${ticker}`, inline: true },
      { name: "Shares", value: shares.toFixed(2), inline: true },
      { name: "Target", value: formatDollars(targetPrice), inline: true },
    )] });
  } catch (err: any) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`❌ ${err.message}`)] }); }
}

async function handleCancelOrder(message: Message, userId: number, orderId: number): Promise<void> {
  try {
    const { cancelOrder } = await import("./db");
    await cancelOrder(orderId, userId);
    await message.reply({ embeds: [new EmbedBuilder().setTitle("❌ Order Cancelled").setColor(embedColor("info")).setDescription(`Order #${orderId} cancelled.`)] });
  } catch (err: any) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`❌ ${err.message}`)] }); }
}

async function handleBuyCosmetic(message: Message, userId: number, itemName: string): Promise<void> {
  try {
    const client = getRawClient();
    const items = await client.execute(`SELECT id, name, price, type FROM cosmetic_items WHERE (stock IS NULL OR stock > 0)`);
    const match = items.rows.find((row: any) => String(row.name).toLowerCase().includes(itemName.toLowerCase()));
    if (!match) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`Cosmetic "${itemName}" not found.`)] }); return; }
    const portfolio = await getOrCreatePortfolio(userId);
    const casinoCash = parseFloat(String(portfolio.casinoBalance ?? "20"));
    const price = Number(match.price);
    if (price > casinoCash) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`Need ${formatDollars(price)}, have ${formatDollars(casinoCash)}.`)] }); return; }
    // Check if already owned
    const owned = await client.execute({ sql: `SELECT id FROM user_cosmetics WHERE userId = ? AND cosmeticId = ?`, args: [userId, Number(match.id)] });
    if (owned.rows.length > 0) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("warn")).setDescription(`You already own "${match.name}".`)] }); return; }
    const { getDb: getDatabase } = await import("./db");
    const { portfolios } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDatabase();
    await db.update(portfolios).set({ casinoBalance: (casinoCash - price).toFixed(2) }).where(eq(portfolios.userId, userId));
    await client.execute({ sql: `INSERT INTO user_cosmetics (userId, cosmeticId) VALUES (?, ?)`, args: [userId, Number(match.id)] });
    cache.invalidate("casino.leaderboard");
    await message.reply({ embeds: [new EmbedBuilder().setTitle("🛒 Purchased!").setColor(embedColor("success")).setDescription(`**${match.name}** — ${formatDollars(price)}\nBalance: ${formatDollars(casinoCash - price)}`)] });
  } catch (err: any) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`❌ ${err.message}`)] }); }
}

async function handleEquipCosmetic(message: Message, userId: number, itemName: string, cosmeticType: "title" | "name_effect"): Promise<void> {
  try {
    const client = getRawClient();
    const owned = await client.execute({ sql: `SELECT uc.cosmeticId, ci.name, ci.type FROM user_cosmetics uc JOIN cosmetic_items ci ON ci.id = uc.cosmeticId WHERE uc.userId = ?`, args: [userId] });
    const match = owned.rows.find((row: any) => String(row.name).toLowerCase().includes(itemName.toLowerCase()) && String(row.type) === cosmeticType);
    if (!match) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`You don't own a ${cosmeticType} called "${itemName}".`)] }); return; }
    // Upsert equipped
    await client.execute({ sql: `INSERT INTO user_equipped (userId, type, cosmeticId) VALUES (?, ?, ?) ON CONFLICT(userId, type) DO UPDATE SET cosmeticId = ?`, args: [userId, cosmeticType, Number(match.cosmeticId), Number(match.cosmeticId)] });
    await message.reply({ embeds: [new EmbedBuilder().setTitle("✨ Equipped!").setColor(embedColor("success")).setDescription(`**${match.name}** is now active.`)] });
  } catch (err: any) { await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`❌ ${err.message}`)] }); }
}

async function handleAudit(targetName: string): Promise<EmbedBuilder[]> {
  // Find target user
  const client = getRawClient();
  const allUsers = await client.execute(`SELECT id, COALESCE(displayName, name) as userName FROM users`);
  const targetRow = allUsers.rows.find(
    (row: any) => String(row.userName).toLowerCase() === targetName.toLowerCase()
  );

  if (!targetRow) {
    return [new EmbedBuilder().setColor(embedColor("error")).setDescription(`❌ User "${targetName}" not found.`)];
  }

  const targetId = Number(targetRow.id);
  const name = String(targetRow.userName);
  const prices = await getETFPrices();

  // Fetch all data
  const [portfolio, holdingsList, tradesList, betsList, dividendsList] = await Promise.all([
    getOrCreatePortfolio(targetId),
    getUserHoldings(targetId),
    getUserTrades(targetId, 100),
    getUserBets(targetId),
    getUserDividends(targetId, 100),
  ]);

  const cash = parseFloat(String(portfolio.cashBalance ?? "200"));
  const casinoCash = parseFloat(String(portfolio.casinoBalance ?? "20"));

  // Calculate portfolio value
  let holdingsVal = 0;
  let shortPnl = 0;
  for (const h of holdingsList) {
    const price = prices[h.ticker] ?? 0;
    const shares = parseFloat(String(h.shares ?? "0"));
    const shortShares = parseFloat(String(h.shortShares ?? "0"));
    const shortAvg = parseFloat(String(h.shortAvgPrice ?? "0"));
    holdingsVal += shares * price;
    if (shortShares > 0) shortPnl += shortShares * (shortAvg - price);
  }
  const totalValue = cash + holdingsVal + shortPnl;
  const pnl = totalValue - 200;

  // Trade stats
  const buys = tradesList.filter(tr => tr.type === "buy");
  const sells = tradesList.filter(tr => tr.type === "sell");
  const shorts = tradesList.filter(tr => tr.type === "short");
  const covers = tradesList.filter(tr => tr.type === "cover");
  const totalTradeVolume = tradesList.reduce((sum, tr) => sum + parseFloat(String(tr.totalAmount ?? "0")), 0);

  // Bet stats
  const wonBets = betsList.filter(b => b.status === "won");
  const lostBets = betsList.filter(b => b.status === "lost");
  const pendingBets = betsList.filter(b => b.status === "pending");
  const betProfit = wonBets.reduce((sum, b) => sum + parseFloat(String(b.payout ?? "0")), 0)
    - betsList.filter(b => b.status !== "pending").reduce((sum, b) => sum + parseFloat(String(b.amount ?? "0")), 0);

  // Dividend stats
  const totalDividends = dividendsList.reduce((sum, d) => sum + parseFloat(String(d.totalPayout ?? "0")), 0);

  // Build embeds
  const embeds: EmbedBuilder[] = [];

  // Embed 1: Overview
  const overview = new EmbedBuilder()
    .setTitle(`🔍 Audit: ${name}`)
    .setColor(pnl >= 0 ? embedColor("success") : embedColor("error"))
    .addFields(
      { name: "Total Value", value: formatDollars(totalValue), inline: true },
      { name: "P&L", value: `${pnl >= 0 ? "+" : ""}${formatDollars(pnl)} (${((pnl / 200) * 100).toFixed(1)}%)`, inline: true },
      { name: "Cash", value: formatDollars(cash), inline: true },
      { name: "Casino Cash", value: formatDollars(casinoCash), inline: true },
      { name: "Total Dividends", value: formatDollars(totalDividends), inline: true },
      { name: "Trade Volume", value: formatDollars(totalTradeVolume), inline: true },
    );

  // Holdings breakdown
  const holdingLines: string[] = [];
  for (const h of holdingsList) {
    const price = prices[h.ticker] ?? 0;
    const shares = parseFloat(String(h.shares ?? "0"));
    const shortShares = parseFloat(String(h.shortShares ?? "0"));
    const avgCost = parseFloat(String(h.avgCostBasis ?? "0"));
    const shortAvg = parseFloat(String(h.shortAvgPrice ?? "0"));
    if (shares > 0) {
      const val = shares * price;
      const hpnl = val - shares * avgCost;
      holdingLines.push(`$${h.ticker}  ${shares.toFixed(2)} @ ${formatDollars(avgCost)}  ${hpnl >= 0 ? "+" : ""}${formatDollars(hpnl)}`);
    }
    if (shortShares > 0) {
      const hpnl = shortShares * (shortAvg - price);
      holdingLines.push(`$${h.ticker}  ${shortShares.toFixed(2)} SHORT @ ${formatDollars(shortAvg)}  ${hpnl >= 0 ? "+" : ""}${formatDollars(hpnl)}`);
    }
  }
  if (holdingLines.length > 0) {
    overview.addFields({ name: "Current Holdings", value: "```\n" + holdingLines.join("\n") + "\n```" });
  } else {
    overview.addFields({ name: "Current Holdings", value: "No positions" });
  }
  embeds.push(overview);

  // Embed 2: Activity breakdown
  const activity = new EmbedBuilder()
    .setTitle(`📊 ${name} — Activity`)
    .setColor(embedColor("info"))
    .addFields(
      { name: "Trades", value: `${tradesList.length} total\n${buys.length} buys · ${sells.length} sells\n${shorts.length} shorts · ${covers.length} covers`, inline: true },
      { name: "Bets", value: `${betsList.length} total\n${wonBets.length}W ${lostBets.length}L ${pendingBets.length} pending\nNet: ${betProfit >= 0 ? "+" : ""}${formatDollars(betProfit)}`, inline: true },
      { name: "Dividends", value: `${dividendsList.length} received\nTotal: ${formatDollars(totalDividends)}`, inline: true },
    );

  // Recent trades (last 10)
  const recentTrades = tradesList.slice(0, 10);
  if (recentTrades.length > 0) {
    const tradeLines = recentTrades.map(tr => {
      const shares = parseFloat(String(tr.shares ?? "0")).toFixed(2);
      const price = parseFloat(String(tr.pricePerShare ?? "0")).toFixed(2);
      return `${tr.type.toUpperCase().padEnd(5)} $${tr.ticker}  ${shares} @ $${price}`;
    });
    activity.addFields({ name: "Last 10 Trades", value: "```\n" + tradeLines.join("\n") + "\n```" });
  }

  embeds.push(activity);

  return embeds;
}

function handleHelp(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🤖 $DORI Bot Commands")
    .setColor(embedColor("info"))
    .setDescription("Just type naturally! Examples:")
    .addFields(
      { name: "📊 Info", value: "`portfolio` · `prices` · `leaderboard` · `holdings`\n`is dori in game?` · `last 5 matches` · `recent trades`\n`my trades` · `my bets` · `my dividends` · `my orders`\n`streaks` · `champion pool` · `player stats`\n`news` · `notifications` · `top casino`" },
      { name: "💰 Trading", value: "`buy $20 DORI` · `sell 5 shares TDRI` · `sell all DORI`\n`short $10 SDRI` · `cover all XDRI` · `all in on DORI`\n`limit buy 5 DORI at $10` · `stop loss 3 DORI at $8`\n`cancel order #42`" },
      { name: "⚔️ Social", value: "`compare me to Kyle` · `audit Andrew`" },
      { name: "🎲 Betting & Casino", value: "`bet $10 on win` · `is betting open?`\n`deposit $5 to casino` · `daily bonus`\n`$10 on red` · `roll dice $5 over 50` · `crash $5`\n`plinko $2 high risk`" },
      { name: "🛒 Cosmetics", value: "`show shop` · `my cosmetics`\n`buy Rainbow` · `equip High Roller`" },
      { name: "🔗 Account", value: "`/link your@email.com` — link Discord to your account\n`/whoami` — check your linked account" },
    );
}

// ─── Trade Preview & Confirmation ───

async function handleTradeIntent(
  message: Message,
  userId: number,
  userName: string,
  intent: BotIntent,
): Promise<void> {
  if (intent.type !== "buy" && intent.type !== "sell" && intent.type !== "short" && intent.type !== "cover"
    && intent.type !== "sell_all" && intent.type !== "cover_all") return;

  // Check market status
  const liveGame = cache.get<boolean>("player.liveGame.check") ?? false;
  if (liveGame && intent.type !== "cover" && intent.type !== "cover_all") {
    await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription("⚠️ Trading halted — game in progress.")] });
    return;
  }

  const prices = await getETFPrices();
  const ticker = (intent as any).ticker as string;
  const price = prices[ticker];
  if (!price) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`Unknown ticker: $${ticker}`)] });
    return;
  }

  // Calculate shares
  let shares: number;
  const portfolio = await getOrCreatePortfolio(userId);
  const holdingsList = await getUserHoldings(userId);
  const holding = holdingsList.find(h => h.ticker === ticker);

  if (intent.type === "sell_all") {
    shares = parseFloat(String(holding?.shares ?? "0"));
    if (shares <= 0) {
      await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`No $${ticker} shares to sell.`)] });
      return;
    }
  } else if (intent.type === "cover_all") {
    shares = parseFloat(String(holding?.shortShares ?? "0"));
    if (shares <= 0) {
      await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`No $${ticker} short position to cover.`)] });
      return;
    }
  } else if ((intent as any).unit === "dollars") {
    shares = (intent as any).amount / price;
  } else {
    shares = (intent as any).amount;
  }

  shares = Math.round(shares * 10000) / 10000;
  const totalCost = shares * price;
  const cash = parseFloat(String(portfolio.cashBalance ?? "200"));

  // Validate
  const actionType = intent.type === "sell_all" ? "sell" : intent.type === "cover_all" ? "cover" : intent.type;
  if ((actionType === "buy") && totalCost > cash) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`Insufficient cash. Need ${formatDollars(totalCost)}, have ${formatDollars(cash)}.`)] });
    return;
  }

  // Build confirmation embed
  const actionLabel = actionType.toUpperCase();
  const embed = new EmbedBuilder()
    .setTitle(`⚠️ Confirm ${actionLabel}`)
    .setColor(embedColor("warn"))
    .addFields(
      { name: "Action", value: `${actionLabel} $${ticker}`, inline: true },
      { name: "Shares", value: shares.toFixed(4), inline: true },
      { name: "Price", value: formatDollars(price), inline: true },
      { name: "Total", value: formatDollars(totalCost), inline: true },
      { name: "Cash After", value: actionType === "buy" ? formatDollars(cash - totalCost) : actionType === "sell" ? formatDollars(cash + totalCost) : "—", inline: true },
    )
    .setFooter({ text: "Click ✅ to confirm or ❌ to cancel. Expires in 60s." });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("trade_confirm").setLabel("Confirm").setStyle(ButtonStyle.Success).setEmoji("✅"),
    new ButtonBuilder().setCustomId("trade_cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger).setEmoji("❌"),
  );

  const reply = await message.reply({ embeds: [embed], components: [row] });

  pendingTrades.set(reply.id, {
    userId,
    discordUserId: message.author.id,
    intent,
    ticker,
    shares,
    price,
    totalCost,
    expiresAt: Date.now() + 60_000,
  });
}

async function handleTradeConfirm(interaction: ButtonInteraction, confirmed: boolean): Promise<void> {
  const trade = pendingTrades.get(interaction.message.id);
  if (!trade) {
    await interaction.reply({ content: "This trade has expired.", ephemeral: true });
    return;
  }

  if (interaction.user.id !== trade.discordUserId) {
    await interaction.reply({ content: "This isn't your trade.", ephemeral: true });
    return;
  }

  pendingTrades.delete(interaction.message.id);

  if (!confirmed) {
    const cancelEmbed = new EmbedBuilder()
      .setTitle("❌ Trade Cancelled")
      .setColor(embedColor("error"))
      .setDescription(`${trade.intent.type === "sell_all" ? "sell" : trade.intent.type === "cover_all" ? "cover" : trade.intent.type} $${trade.ticker} — cancelled.`);
    await interaction.update({ embeds: [cancelEmbed], components: [] });
    return;
  }

  try {
    // Support compound trades via _steps
    const steps = (trade as any)._steps as { action: string; ticker: string; shares: number; price: number; total: number }[] | undefined;
    const tradeSteps = steps ?? [{ action: trade.intent.type === "sell_all" ? "sell" : trade.intent.type === "cover_all" ? "cover" : trade.intent.type, ticker: trade.ticker, shares: trade.shares, price: trade.price, total: trade.totalCost }];

    let result: any;
    const executed: string[] = [];

    for (const step of tradeSteps) {
      if (step.action === "buy" || step.action === "sell") {
        result = await executeTrade(trade.userId, step.ticker as Ticker, step.action, step.shares, step.price);
      } else if (step.action === "short") {
        result = await executeShort(trade.userId, step.ticker as Ticker, step.shares, step.price);
      } else if (step.action === "cover") {
        result = await executeCover(trade.userId, step.ticker as Ticker, step.shares, step.price);
      }
      executed.push(`${step.action.toUpperCase()} ${step.shares.toFixed(2)} $${step.ticker} @ ${formatDollars(step.price)}`);

      // Fire passive notification for each trade
      const userName = String((await getUserByDiscordId(trade.discordUserId))?.displayName ?? "User");
      import("./discord").then(d => d.notifyTrade(userName, step.action as any, step.ticker, step.shares, step.price)).catch(() => {});
    }

    cache.invalidate("leaderboard.rankings");
    cache.invalidatePrefix("ledger.");

    const newCash = parseFloat(String(result?.portfolio?.cashBalance ?? "0"));
    const successEmbed = new EmbedBuilder()
      .setTitle(`✅ ${tradeSteps.length > 1 ? `${tradeSteps.length} Trades` : tradeSteps[0].action.toUpperCase()} Executed`)
      .setColor(embedColor("success"))
      .setDescription(executed.map((line, idx) => `${idx + 1}. ${line}`).join("\n"))
      .addFields(
        { name: "New Balance", value: formatDollars(newCash), inline: true },
      );

    await interaction.update({ embeds: [successEmbed], components: [] });
  } catch (err: any) {
    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Trade Failed")
      .setColor(embedColor("error"))
      .setDescription(err.message || "Unknown error");
    await interaction.update({ embeds: [errorEmbed], components: [] });
  }
}

// ─── Bet Handler ───

async function handleBet(message: Message, userId: number, prediction: "win" | "loss", amount: number): Promise<void> {
  try {
    await placeBet(userId, prediction, amount);
    const embed = new EmbedBuilder()
      .setTitle("🎲 Bet Placed!")
      .setColor(embedColor("success"))
      .addFields(
        { name: "Prediction", value: prediction.toUpperCase(), inline: true },
        { name: "Amount", value: formatDollars(amount), inline: true },
      )
      .setDescription("2x payout if correct! Resolves when the next game ends.");
    await message.reply({ embeds: [embed] });
  } catch (err: any) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`❌ ${err.message}`)] });
  }
}

// ─── Slash Commands ───

async function registerSlashCommands(client: Client) {
  if (!client.user) return;

  const commands = [
    new SlashCommandBuilder()
      .setName("link")
      .setDescription("Link your Discord account to your $DORI account")
      .addStringOption(opt => opt.setName("email").setDescription("Your account email").setRequired(true)),
    new SlashCommandBuilder()
      .setName("unlink")
      .setDescription("Unlink your Discord account"),
    new SlashCommandBuilder()
      .setName("whoami")
      .setDescription("Check your linked $DORI account"),
  ];

  const rest = new REST({ version: "10" }).setToken(ENV.discordBotToken);
  const commandData = commands.map(cmd => cmd.toJSON());

  try {
    // Register per-guild for instant availability
    const guilds = Array.from(client.guilds.cache.values());
    for (const guild of guilds) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        { body: commandData },
      );
      console.log(`[discordBot] Slash commands registered for guild: ${guild.name}`);
    }
    // Clear global commands to avoid duplicates
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: [] },
    );
  } catch (err: any) {
    console.error("[discordBot] Failed to register commands:", err.message);
  }
}

async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
  if (interaction.commandName === "link") {
    const email = interaction.options.getString("email", true);
    const user = await getUserByEmail(email);
    if (!user) {
      await interaction.reply({ content: `❌ No account found for \`${email}\`. Sign up on the website first.`, ephemeral: true });
      return;
    }
    await linkDiscordUser(user.id, interaction.user.id);
    const name = user.displayName || user.name || email;
    await interaction.reply({ content: `✅ Linked to **${name}**! You can now use the bot.`, ephemeral: true });
    return;
  }

  if (interaction.commandName === "unlink") {
    await unlinkDiscordUser(interaction.user.id);
    await interaction.reply({ content: "✅ Discord account unlinked.", ephemeral: true });
    return;
  }

  if (interaction.commandName === "whoami") {
    const user = await getUserByDiscordId(interaction.user.id);
    if (!user) {
      await interaction.reply({ content: "❌ Not linked. Use `/link your@email.com` first.", ephemeral: true });
      return;
    }
    const name = String(user.displayName || user.name || "Unknown");
    const portfolio = await getOrCreatePortfolio(Number(user.id));
    const cash = parseFloat(String(portfolio.cashBalance ?? "200"));
    const casinoCash = parseFloat(String(portfolio.casinoBalance ?? "20"));
    await interaction.reply({
      content: `👤 **${name}**\n💰 Cash: ${formatDollars(cash)}\n🎰 Casino: ${formatDollars(casinoCash)}`,
      ephemeral: true,
    });
  }
  } catch (err: any) {
    console.error("[discordBot] Slash command error:", err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `❌ Error: ${err.message}`, ephemeral: true }).catch(() => {});
    }
  }
}

// ─── Main Message Handler ───

async function handleMessage(message: Message): Promise<void> {
  // Ignore bots, DMs, and slash command attempts
  if (message.author.bot || !message.guild) return;
  if (message.content.startsWith("/")) return;

  // Only respond when @mentioned — don't spam the channel
  if (!message.mentions.has(message.client.user!)) return;

  // Cooldown
  const now = Date.now();
  const lastTime = lastCommandTime.get(message.author.id) ?? 0;
  if (now - lastTime < COOLDOWN_MS) return;
  lastCommandTime.set(message.author.id, now);

  // Look up linked user
  const discordUser = await getUserByDiscordId(message.author.id);
  if (!discordUser) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("warn")).setDescription("🔗 Link your account first: `/link your@email.com`")] });
    return;
  }

  const userId = Number(discordUser.id);
  const userName = String(discordUser.displayName || discordUser.name || "User");

  // Show typing indicator while LLM processes
  if ("sendTyping" in message.channel) await message.channel.sendTyping();

  // Strip @mention from message before parsing
  const cleanContent = message.content.replace(/<@!?\d+>/g, "").trim();
  if (!cleanContent) {
    await message.reply({ embeds: [handleHelp()] });
    return;
  }

  // Parse intents (can be multiple for compound instructions)
  const intents = await parseIntent(cleanContent);

  // Separate into reads, trades, and bets
  const readIntents: BotIntent[] = [];
  const tradeIntents: BotIntent[] = [];
  const betIntents: BotIntent[] = [];
  const unknownIntents: BotIntent[] = [];

  for (const intent of intents) {
    const READ_TYPES = [
      "portfolio", "prices", "price", "leaderboard", "live_game", "casino_balance",
      "match_history", "holdings", "help", "compare", "audit", "recent_trades",
      "casino_leaderboard", "my_trades", "news", "notifications", "betting_status",
      "champion_pool", "streaks", "my_bets", "my_orders", "my_dividends",
      "shop_catalog", "my_cosmetics", "player_stats",
    ];
    if (READ_TYPES.includes(intent.type)) {
      readIntents.push(intent);
    } else if (["bet", "casino_deposit", "roulette", "dice", "crash", "plinko", "daily_bonus", "create_order", "cancel_order", "buy_cosmetic", "equip_cosmetic"].includes(intent.type)) {
      betIntents.push(intent);
    } else if (intent.type === "unknown") {
      unknownIntents.push(intent);
    } else {
      tradeIntents.push(intent);
    }
  }

  try {
    // Execute reads immediately, collect embeds
    const readEmbeds: EmbedBuilder[] = [];
    for (const intent of readIntents) {
      switch (intent.type) {
        case "portfolio": readEmbeds.push(await handlePortfolio(userId, userName)); break;
        case "prices": readEmbeds.push(await handlePrices()); break;
        case "price": {
          const prices = await getETFPrices();
          const price = prices[(intent as any).ticker];
          if (price) readEmbeds.push(new EmbedBuilder().setTitle(`$${(intent as any).ticker}`).setColor(embedColor("info")).setDescription(`**${formatDollars(price)}**`));
          break;
        }
        case "leaderboard": readEmbeds.push(await handleLeaderboard()); break;
        case "live_game": readEmbeds.push(await handleLiveGame()); break;
        case "match_history": readEmbeds.push(await handleMatchHistory((intent as any).count)); break;
        case "casino_balance": readEmbeds.push(await handleCasinoBalance(userId, userName)); break;
        case "holdings": readEmbeds.push(await handleHoldings(userId, userName)); break;
        case "help": readEmbeds.push(handleHelp()); break;
        case "compare": readEmbeds.push(await handleCompare(userId, userName, (intent as any).targetName)); break;
        case "audit": readEmbeds.push(...await handleAudit((intent as any).targetName)); break;
        case "recent_trades": readEmbeds.push(await handleRecentTrades((intent as any).count)); break;
        case "casino_leaderboard": readEmbeds.push(await handleCasinoLeaderboard()); break;
        case "my_trades": readEmbeds.push(await handleMyTrades(userId, userName, (intent as any).count)); break;
        case "news": readEmbeds.push(await handleNews((intent as any).count)); break;
        case "notifications": readEmbeds.push(await handleNotifications(userId)); break;
        case "betting_status": readEmbeds.push(await handleBettingStatus()); break;
        case "champion_pool": readEmbeds.push(await handleChampionPool()); break;
        case "streaks": readEmbeds.push(await handleStreaks()); break;
        case "my_bets": readEmbeds.push(await handleMyBets(userId, userName)); break;
        case "my_orders": readEmbeds.push(await handleMyOrders(userId, userName)); break;
        case "my_dividends": readEmbeds.push(await handleMyDividends(userId, userName, (intent as any).count)); break;
        case "shop_catalog": readEmbeds.push(await handleShopCatalog()); break;
        case "my_cosmetics": readEmbeds.push(await handleMyCosmetics(userId, userName)); break;
        case "player_stats": readEmbeds.push(await handlePlayerStats()); break;
      }
    }
    if (readEmbeds.length > 0) {
      await message.reply({ embeds: readEmbeds.slice(0, 10) }); // Discord max 10 embeds
    }

    // Execute instant actions directly
    for (const intent of betIntents) {
      if (intent.type === "bet") await handleBet(message, userId, intent.prediction, intent.amount);
      if (intent.type === "casino_deposit") await handleCasinoDeposit(message, userId, intent.amount);
      if (intent.type === "roulette") await handleRoulette(message, userId, intent.color, intent.amount);
      if (intent.type === "dice") await handleDice(message, userId, intent.amount, intent.target, intent.direction);
      if (intent.type === "crash") await handleCrash(message, userId, intent.amount, intent.autoCashout);
      if (intent.type === "plinko") await handlePlinko(message, userId, intent.amount, intent.risk);
      if (intent.type === "daily_bonus") await handleDailyBonus(message, userId);
      if (intent.type === "create_order") await handleCreateOrder(message, userId, intent.ticker, intent.orderType, intent.shares, intent.targetPrice);
      if (intent.type === "cancel_order") await handleCancelOrder(message, userId, intent.orderId);
      if (intent.type === "buy_cosmetic") await handleBuyCosmetic(message, userId, intent.itemName);
      if (intent.type === "equip_cosmetic") await handleEquipCosmetic(message, userId, intent.itemName, intent.cosmeticType);
    }

    // Handle trades — if compound, batch into one confirmation
    if (tradeIntents.length > 0) {
      await handleCompoundTrade(message, userId, userName, tradeIntents);
    }

    // Show unknowns
    if (unknownIntents.length > 0 && readEmbeds.length === 0 && tradeIntents.length === 0 && betIntents.length === 0) {
      const msg = (unknownIntents[0] as any).message || "I didn't understand that";
      await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("warn")).setDescription(`🤔 ${msg}\n\nType **help** for examples.`)] });
    }
  } catch (err: any) {
    console.error("[discordBot] Handler error:", err);
    await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription(`❌ Something went wrong: ${err.message}`)] }).catch(() => {});
  }
}

// ─── Compound Trade Handler ───

async function handleCompoundTrade(message: Message, userId: number, userName: string, intents: BotIntent[]): Promise<void> {
  const prices = await getETFPrices();
  const portfolio = await getOrCreatePortfolio(userId);
  const holdingsList = await getUserHoldings(userId);
  const cash = parseFloat(String(portfolio.cashBalance ?? "200"));

  // Check market
  const liveGame = cache.get<boolean>("player.liveGame.check") ?? false;

  // Resolve each intent into concrete trade steps
  const steps: { action: string; ticker: string; shares: number; price: number; total: number }[] = [];
  let projectedCash = cash;

  for (const intent of intents) {
    if (liveGame && intent.type !== "cover" && intent.type !== "cover_all") {
      await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("error")).setDescription("⚠️ Trading halted — game in progress.")] });
      return;
    }

    if (intent.type === "sell_all_holdings") {
      // Sell all shares across all tickers
      for (const h of holdingsList) {
        const shares = parseFloat(String(h.shares ?? "0"));
        const price = prices[h.ticker] ?? 0;
        if (shares > 0 && price > 0) {
          steps.push({ action: "sell", ticker: h.ticker, shares, price, total: shares * price });
          projectedCash += shares * price;
        }
      }
    } else if (intent.type === "buy_max") {
      const ticker = (intent as any).ticker as string;
      const price = prices[ticker];
      if (!price) continue;
      const shares = Math.floor((projectedCash / price) * 10000) / 10000;
      if (shares > 0) {
        steps.push({ action: "buy", ticker, shares, price, total: shares * price });
        projectedCash -= shares * price;
      }
    } else if (intent.type === "sell_all") {
      const ticker = (intent as any).ticker as string;
      const holding = holdingsList.find(h => h.ticker === ticker);
      const shares = parseFloat(String(holding?.shares ?? "0"));
      const price = prices[ticker] ?? 0;
      if (shares > 0 && price > 0) {
        steps.push({ action: "sell", ticker, shares, price, total: shares * price });
        projectedCash += shares * price;
      }
    } else if (intent.type === "cover_all") {
      const ticker = (intent as any).ticker as string;
      const holding = holdingsList.find(h => h.ticker === ticker);
      const shares = parseFloat(String(holding?.shortShares ?? "0"));
      const price = prices[ticker] ?? 0;
      if (shares > 0 && price > 0) {
        steps.push({ action: "cover", ticker, shares, price, total: shares * price });
      }
    } else if (["buy", "sell", "short", "cover"].includes(intent.type)) {
      const ticker = (intent as any).ticker as string;
      const price = prices[ticker] ?? 0;
      if (!price) continue;
      let shares: number;
      if ((intent as any).unit === "dollars") {
        shares = (intent as any).amount / price;
      } else {
        shares = (intent as any).amount;
      }
      shares = Math.round(shares * 10000) / 10000;
      const total = shares * price;

      if (intent.type === "buy") projectedCash -= total;
      if (intent.type === "sell") projectedCash += total;

      steps.push({ action: intent.type, ticker, shares, price, total });
    }
  }

  if (steps.length === 0) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(embedColor("warn")).setDescription("Nothing to trade.")] });
    return;
  }

  // Build preview
  const stepLines = steps.map((step, idx) =>
    `${idx + 1}. **${step.action.toUpperCase()}** ${step.shares.toFixed(2)} $${step.ticker} @ ${formatDollars(step.price)} = ${formatDollars(step.total)}`
  );

  const embed = new EmbedBuilder()
    .setTitle(`⚠️ Confirm ${steps.length} Trade${steps.length > 1 ? "s" : ""}`)
    .setColor(embedColor("warn"))
    .setDescription(stepLines.join("\n"))
    .addFields(
      { name: "Cash Before", value: formatDollars(cash), inline: true },
      { name: "Cash After (est.)", value: formatDollars(Math.max(0, projectedCash)), inline: true },
    )
    .setFooter({ text: "Click ✅ to confirm all or ❌ to cancel. Expires in 60s." });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("trade_confirm").setLabel("Confirm All").setStyle(ButtonStyle.Success).setEmoji("✅"),
    new ButtonBuilder().setCustomId("trade_cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger).setEmoji("❌"),
  );

  const reply = await message.reply({ embeds: [embed], components: [row] });

  // Store all steps as a compound pending trade
  pendingTrades.set(reply.id, {
    userId,
    discordUserId: message.author.id,
    intent: intents[0], // primary intent for logging
    ticker: steps[0].ticker,
    shares: steps[0].shares,
    price: steps[0].price,
    totalCost: steps.reduce((sum, step) => sum + step.total, 0),
    expiresAt: Date.now() + 60_000,
    // Store full steps for execution
    _steps: steps,
  } as any);
}

// ─── Bot Startup ───

let _client: Client | null = null;

export async function startDiscordBot(): Promise<void> {
  if (!ENV.discordBotToken || !ENV.discordChannelId) {
    console.log("[discordBot] Not configured (missing DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID), skipping.");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`[discordBot] Gateway connected as ${readyClient.user.tag}`);
    await registerSlashCommands(readyClient);
  });

  client.on(Events.MessageCreate, handleMessage);

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    }
    if (interaction.isButton()) {
      if (interaction.customId === "trade_confirm") {
        await handleTradeConfirm(interaction, true);
      } else if (interaction.customId === "trade_cancel") {
        await handleTradeConfirm(interaction, false);
      }
    }
  });

  try {
    await client.login(ENV.discordBotToken);
    _client = client;
  } catch (err: any) {
    console.error("[discordBot] Failed to connect:", err.message);
  }
}

export function getDiscordClient(): Client | null {
  return _client;
}
