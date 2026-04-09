/**
 * Lightweight Discord bot — sends channel messages via REST API.
 * No heavy dependencies; uses built-in fetch (Node 18+) or axios fallback.
 */
import { ENV } from "./_core/env";

const DISCORD_API = "https://discord.com/api/v10";

function isConfigured(): boolean {
  return !!(ENV.discordBotToken && ENV.discordChannelId);
}

async function sendMessage(content: string): Promise<boolean> {
  if (!isConfigured()) return false;

  try {
    const res = await fetch(`${DISCORD_API}/channels/${ENV.discordChannelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${ENV.discordBotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      console.warn(`[Discord] Failed to send message: ${res.status} ${res.statusText}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn("[Discord] Send error:", err?.message);
    return false;
  }
}

export async function notifyGameStart(
  champion?: string,
  gameMode?: string,
  winProb?: { weighted: number; champion: number; champGames: number; recentRecord: string } | null,
): Promise<void> {
  const parts = ["🎮 **$DORI LIVE** — 안죽기장인 just entered a game!"];
  if (gameMode) parts.push(`Mode: **${gameMode}**`);
  if (champion) parts.push(`Champion: **${champion}**`);
  if (winProb) {
    const bar = "█".repeat(Math.round(winProb.weighted / 10)) + "░".repeat(10 - Math.round(winProb.weighted / 10));
    parts.push(`\n🎯 **Win Probability: ${winProb.weighted}%** ${bar}`);
    if (winProb.champGames > 0) parts.push(`${champion}: ${winProb.champion}% WR (${winProb.champGames} games) · Recent: ${winProb.recentRecord}`);
  }
  parts.push("\n⚠️ Trading is now **halted** until the match ends.");
  await sendMessage(parts.join("\n"));
}

export async function notifyGameEnd(
  lpDelta: number,
  priceBefore: number,
  priceAfter: number,
  win?: boolean,
): Promise<void> {
  // Use authoritative match result when available, fall back to LP delta
  const won = win !== undefined ? win : lpDelta >= 0;
  const emoji = won ? "📈" : "📉";
  const sign = lpDelta >= 0 ? "+" : "";
  const priceChange = priceAfter - priceBefore;
  const pricePct = priceBefore > 0 ? ((priceChange / priceBefore) * 100).toFixed(1) : "0";
  const priceSign = priceChange >= 0 ? "+" : "";

  const msg = [
    `${emoji} **Game Over** — ${won ? "WIN" : "LOSS"}`,
    `LP: **${sign}${lpDelta}**`,
    `$DORI: $${priceBefore.toFixed(2)} → $${priceAfter.toFixed(2)} (**${priceSign}${pricePct}%**)`,
    "Trading has **resumed**.",
  ].join("\n");

  await sendMessage(msg);
}

export async function notifyNewMatch(
  champion: string,
  win: boolean,
  kda: string,
  price: number,
  gameDuration: number,
  cs: number,
  newsArticle?: { headline: string; body: string } | null,
): Promise<void> {
  const emoji = win ? "✅" : "❌";
  const minutes = Math.floor(gameDuration / 60);
  const seconds = gameDuration % 60;
  const matchLine = `${emoji} **${champion}** ${kda} | ${cs}CS | ${minutes}:${seconds.toString().padStart(2, "0")} — ${win ? "Victory" : "Defeat"} | $DORI: **$${price.toFixed(2)}**`;

  if (newsArticle) {
    await sendMessage(`${matchLine}\n\n📰 **${newsArticle.headline}**\n${newsArticle.body}`);
  } else {
    await sendMessage(matchLine);
  }
}

export async function notifyRankChange(
  tierBefore: string,
  divBefore: string,
  tierAfter: string,
  divAfter: string,
  isPromotion: boolean,
): Promise<void> {
  const emoji = isPromotion ? "⬆️" : "⬇️";
  const label = isPromotion ? "PROMOTED" : "DEMOTED";
  await sendMessage(
    `${emoji} **${label}** — ${tierBefore} ${divBefore} → **${tierAfter} ${divAfter}**`
  );
}

export async function notifyStreak(
  type: "win" | "loss",
  count: number,
): Promise<void> {
  if (type === "win") {
    const emoji = count >= 5 ? "🔥🔥🔥" : count >= 3 ? "🔥" : "✨";
    await sendMessage(`${emoji} **${count} WIN STREAK!** 안죽기장인 is on fire`);
  } else {
    const emoji = count >= 5 ? "💀💀💀" : count >= 3 ? "💀" : "😬";
    await sendMessage(`${emoji} **${count} LOSS STREAK...** 안죽기장인 is tilting`);
  }
}

export async function notifyBigPriceMove(
  ticker: string,
  priceBefore: number,
  priceAfter: number,
): Promise<void> {
  const change = priceAfter - priceBefore;
  const pct = priceBefore > 0 ? ((change / priceBefore) * 100).toFixed(1) : "0";
  const emoji = change >= 0 ? "🚀" : "💥";
  await sendMessage(
    `${emoji} **$${ticker} ${change >= 0 ? "+" : ""}${pct}%** — $${priceBefore.toFixed(2)} → $${priceAfter.toFixed(2)}`
  );
}

export async function notifyDailySummary(
  tier: string,
  division: string,
  lp: number,
  price: number,
  wins: number,
  losses: number,
  leaderboard: { name: string; value: number }[],
): Promise<void> {
  const top3 = leaderboard.slice(0, 3)
    .map((e, i) => `${["🥇", "🥈", "🥉"][i]} ${e.name}: $${e.value.toFixed(2)}`)
    .join("\n");

  const totalGames = wins + losses;
  const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(0) : "0";

  await sendMessage([
    "📊 **Daily Summary**",
    `Rank: **${tier} ${division} ${lp}LP**`,
    `$DORI: **$${price.toFixed(2)}**`,
    `Record: **${wins}W ${losses}L** (${winRate}% WR)`,
    "",
    "**Leaderboard Top 3:**",
    top3,
  ].join("\n"));
}

// ─── Passive Feed: Trade & Bet Notifications ───

export async function notifyTrade(
  userName: string,
  type: "buy" | "sell" | "short" | "cover",
  ticker: string,
  shares: number,
  price: number,
): Promise<void> {
  const total = shares * price;
  const emoji = type === "buy" ? "📈" : type === "sell" ? "📉" : type === "short" ? "🔻" : "🔺";
  const label = type.toUpperCase();
  await sendMessage(
    `${emoji} **${userName}** ${label} ${shares.toFixed(2)} $${ticker} @ $${price.toFixed(2)} ($${total.toFixed(2)})`
  );
}

export async function notifyBetPlaced(
  userName: string,
  prediction: "win" | "loss",
  amount: number,
): Promise<void> {
  const emoji = prediction === "win" ? "🟢" : "🔴";
  await sendMessage(
    `🎲 **${userName}** bet $${amount.toFixed(0)} on **${prediction.toUpperCase()}** ${emoji}`
  );
}

export async function notifyCasinoBigWin(
  userName: string,
  game: string,
  multiplier: number,
  payout: number,
): Promise<void> {
  await sendMessage(
    `🎰 **${userName}** hit **${multiplier.toFixed(2)}x** on ${game}! +$${payout.toFixed(2)} 💰`
  );
}

// ─── Betting Window (called from discordBot.ts via Gateway) ───

export async function sendBettingWindowMessage(): Promise<string | null> {
  if (!isConfigured()) return null;

  try {
    const res = await fetch(`${DISCORD_API}/channels/${ENV.discordChannelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${ENV.discordBotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: [
          "🎲 **BETTING IS OPEN!** — 안죽기장인 just started a game",
          "",
          "Place your bets in the next **5 minutes**! Type:",
          '`bet $10 on win` or `bet $5 loss`',
          "",
          "⏰ Window closes automatically.",
        ].join("\n"),
      }),
    });

    if (!res.ok) return null;
    const data = await res.json() as any;
    return data.id ?? null;
  } catch {
    return null;
  }
}

export async function editMessage(messageId: string, content: string): Promise<void> {
  if (!isConfigured()) return;
  try {
    await fetch(`${DISCORD_API}/channels/${ENV.discordChannelId}/messages/${messageId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${ENV.discordBotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });
  } catch { /* ignore */ }
}

export { isConfigured as isDiscordConfigured };
