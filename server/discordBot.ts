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
  getRawClient,
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

function handleHelp(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🤖 $DORI Bot Commands")
    .setColor(embedColor("info"))
    .setDescription("Just type naturally! Examples:")
    .addFields(
      { name: "📊 Info", value: "`what's my portfolio?`\n`show prices`\n`leaderboard`\n`is dori in game?`\n`last 5 matches`\n`my casino balance`\n`my holdings`" },
      { name: "💰 Trading", value: "`buy $20 of DORI`\n`sell 5 shares of TDRI`\n`sell all DORI`\n`short $10 SDRI`\n`cover all XDRI`" },
      { name: "⚔️ Compare", value: "`compare me to Kyle`\n`how am I doing vs Sarah`" },
      { name: "🎲 Betting", value: "`bet $10 on win`\n`bet $5 loss`" },
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
    if (["portfolio", "prices", "price", "leaderboard", "live_game", "casino_balance", "match_history", "holdings", "help", "compare"].includes(intent.type)) {
      readIntents.push(intent);
    } else if (intent.type === "bet") {
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
      }
    }
    if (readEmbeds.length > 0) {
      await message.reply({ embeds: readEmbeds.slice(0, 10) }); // Discord max 10 embeds
    }

    // Execute bets directly
    for (const intent of betIntents) {
      if (intent.type === "bet") await handleBet(message, userId, intent.prediction, intent.amount);
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
