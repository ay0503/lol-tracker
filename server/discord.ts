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

export async function notifyGameStart(champion?: string, gameMode?: string): Promise<void> {
  const parts = ["🎮 **$DORI LIVE** — 목도리 도마뱀 just entered a game!"];
  if (gameMode) parts.push(`Mode: **${gameMode}**`);
  if (champion) parts.push(`Champion: **${champion}**`);
  parts.push("⚠️ Trading is now **halted** until the match ends.");
  await sendMessage(parts.join("\n"));
}

export async function notifyGameEnd(
  lpDelta: number,
  priceBefore: number,
  priceAfter: number,
): Promise<void> {
  const won = lpDelta >= 0;
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
    await sendMessage(`${emoji} **${count} WIN STREAK!** 목도리 도마뱀 is on fire`);
  } else {
    const emoji = count >= 5 ? "💀💀💀" : count >= 3 ? "💀" : "😬";
    await sendMessage(`${emoji} **${count} LOSS STREAK...** 목도리 도마뱀 is tilting`);
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

export { isConfigured as isDiscordConfigured };
