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
): Promise<void> {
  const emoji = win ? "✅" : "❌";
  await sendMessage(
    `${emoji} **${champion}** ${kda} — ${win ? "Victory" : "Defeat"} | $DORI: **$${price.toFixed(2)}**`
  );
}

export { isConfigured as isDiscordConfigured };
