import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock ENV before importing discord module
vi.mock("./_core/env", () => ({
  ENV: { discordBotToken: "test-token", discordChannelId: "123456" },
}));

// Mock fetch globally
const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal("fetch", fetchSpy);

import {
  notifyGameStart,
  notifyGameEnd,
  notifyNewMatch,
  notifyRankChange,
  notifyStreak,
  notifyBigPriceMove,
  notifyDailySummary,
} from "./discord";

/** Extract message content from the last fetch call */
function lastMessage(): string {
  const body = fetchSpy.mock.lastCall?.[1]?.body;
  return body ? JSON.parse(body).content : "";
}

beforeEach(() => {
  fetchSpy.mockClear();
});

// ─── notifyGameStart ───

describe("notifyGameStart", () => {
  it("sends LIVE message with halted warning", async () => {
    await notifyGameStart();
    const msg = lastMessage();
    expect(msg).toContain("LIVE");
    expect(msg).toContain("halted");
    expect(msg).not.toContain("Champion:");
    expect(msg).not.toContain("Mode:");
  });

  it("includes champion when provided", async () => {
    await notifyGameStart("Ahri");
    expect(lastMessage()).toContain("Champion: **Ahri**");
  });

  it("includes game mode when provided", async () => {
    await notifyGameStart(undefined, "Ranked Solo/Duo");
    expect(lastMessage()).toContain("Mode: **Ranked Solo/Duo**");
  });

  it("includes both champion and game mode", async () => {
    await notifyGameStart("Yone", "Ranked Solo/Duo");
    const msg = lastMessage();
    expect(msg).toContain("Champion: **Yone**");
    expect(msg).toContain("Mode: **Ranked Solo/Duo**");
  });

  it("calls fetch with correct Discord API URL", async () => {
    await notifyGameStart();
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.lastCall?.[0]).toContain("/channels/123456/messages");
  });
});

// ─── notifyGameEnd ───

describe("notifyGameEnd", () => {
  it("win with positive LP shows WIN, +LP, positive %", async () => {
    await notifyGameEnd(22, 50.0, 51.65);
    const msg = lastMessage();
    expect(msg).toContain("WIN");
    expect(msg).toContain("+22");
    expect(msg).toContain("$50.00");
    expect(msg).toContain("$51.65");
    expect(msg).toContain("+3.3%");
  });

  it("loss with negative LP shows LOSS, negative LP", async () => {
    await notifyGameEnd(-18, 55.0, 53.65);
    const msg = lastMessage();
    expect(msg).toContain("LOSS");
    expect(msg).toContain("-18");
  });

  it("explicit win=true overrides negative LP", async () => {
    await notifyGameEnd(-5, 50, 49, true);
    expect(lastMessage()).toContain("WIN");
  });

  it("explicit win=false overrides positive LP", async () => {
    await notifyGameEnd(5, 50, 51, false);
    expect(lastMessage()).toContain("LOSS");
  });

  it("win=undefined falls back to lpDelta >= 0", async () => {
    await notifyGameEnd(0, 50, 50);
    expect(lastMessage()).toContain("WIN");
  });

  it("priceBefore=0 shows 0 for percent", async () => {
    await notifyGameEnd(10, 0, 50);
    expect(lastMessage()).toContain("0%");
  });

  it("always contains 'resumed'", async () => {
    await notifyGameEnd(-20, 55, 50);
    expect(lastMessage()).toContain("resumed");
  });
});

// ─── notifyNewMatch ───

describe("notifyNewMatch", () => {
  it("win shows checkmark and Victory", async () => {
    await notifyNewMatch("Ahri", true, "10/3/8", 55.0, 1823, 210);
    const msg = lastMessage();
    expect(msg).toContain("✅");
    expect(msg).toContain("Victory");
    expect(msg).toContain("**Ahri**");
    expect(msg).toContain("10/3/8");
    expect(msg).toContain("210CS");
    expect(msg).toContain("$55.00");
  });

  it("loss shows X and Defeat", async () => {
    await notifyNewMatch("Yone", false, "4/9/1", 48.0, 2126, 180);
    const msg = lastMessage();
    expect(msg).toContain("❌");
    expect(msg).toContain("Defeat");
  });

  it("formats duration as mm:ss with padded seconds", async () => {
    await notifyNewMatch("Vex", true, "5/2/10", 50, 65, 100);
    expect(lastMessage()).toContain("1:05");
  });

  it("includes news article when provided", async () => {
    await notifyNewMatch("Swain", true, "8/3/5", 52, 1800, 200, {
      headline: "DORI CEO carries",
      body: "Stock to the moon",
    });
    const msg = lastMessage();
    expect(msg).toContain("📰");
    expect(msg).toContain("DORI CEO carries");
    expect(msg).toContain("Stock to the moon");
  });

  it("no news section when article is null", async () => {
    await notifyNewMatch("Naafiri", true, "6/4/3", 50, 1200, 150, null);
    expect(lastMessage()).not.toContain("📰");
  });

  it("no news section when article is undefined", async () => {
    await notifyNewMatch("Naafiri", true, "6/4/3", 50, 1200, 150);
    expect(lastMessage()).not.toContain("📰");
  });
});

// ─── notifyRankChange ───

describe("notifyRankChange", () => {
  it("promotion shows upward emoji and PROMOTED", async () => {
    await notifyRankChange("GOLD", "I", "PLATINUM", "IV", true);
    const msg = lastMessage();
    expect(msg).toContain("⬆️");
    expect(msg).toContain("PROMOTED");
    expect(msg).toContain("GOLD I");
    expect(msg).toContain("PLATINUM IV");
  });

  it("demotion shows downward emoji and DEMOTED", async () => {
    await notifyRankChange("PLATINUM", "IV", "GOLD", "I", false);
    const msg = lastMessage();
    expect(msg).toContain("⬇️");
    expect(msg).toContain("DEMOTED");
  });

  it("same-tier division change", async () => {
    await notifyRankChange("EMERALD", "III", "EMERALD", "II", true);
    const msg = lastMessage();
    expect(msg).toContain("EMERALD III");
    expect(msg).toContain("EMERALD II");
  });

  it("arrow between old and new rank", async () => {
    await notifyRankChange("DIAMOND", "IV", "DIAMOND", "III", true);
    expect(lastMessage()).toContain("→");
  });
});

// ─── notifyStreak ───

describe("notifyStreak", () => {
  it("win streak count=3: single fire emoji", async () => {
    await notifyStreak("win", 3);
    const msg = lastMessage();
    expect(msg).toContain("🔥");
    expect(msg).not.toContain("🔥🔥🔥");
    expect(msg).toContain("3 WIN STREAK");
  });

  it("win streak count=5: triple fire emoji", async () => {
    await notifyStreak("win", 5);
    expect(lastMessage()).toContain("🔥🔥🔥");
  });

  it("win streak count=2: sparkle emoji", async () => {
    await notifyStreak("win", 2);
    expect(lastMessage()).toContain("✨");
  });

  it("loss streak count=3: single skull emoji", async () => {
    await notifyStreak("loss", 3);
    const msg = lastMessage();
    expect(msg).toContain("💀");
    expect(msg).not.toContain("💀💀💀");
    expect(msg).toContain("3 LOSS STREAK");
    expect(msg).toContain("tilting");
  });

  it("loss streak count=5: triple skull emoji", async () => {
    await notifyStreak("loss", 5);
    expect(lastMessage()).toContain("💀💀💀");
  });

  it("loss streak count=2: grimace emoji", async () => {
    await notifyStreak("loss", 2);
    expect(lastMessage()).toContain("😬");
  });
});

// ─── notifyBigPriceMove ───

describe("notifyBigPriceMove", () => {
  it("price increase: rocket emoji with positive %", async () => {
    await notifyBigPriceMove("DORI", 50.0, 55.0);
    const msg = lastMessage();
    expect(msg).toContain("🚀");
    expect(msg).toContain("+10.0%");
    expect(msg).toContain("$50.00");
    expect(msg).toContain("$55.00");
  });

  it("price decrease: crash emoji with negative %", async () => {
    await notifyBigPriceMove("DORI", 60.0, 54.0);
    const msg = lastMessage();
    expect(msg).toContain("💥");
    expect(msg).toContain("-10.0%");
  });

  it("priceBefore=0 shows 0 percent", async () => {
    await notifyBigPriceMove("DORI", 0, 50);
    expect(lastMessage()).toContain("0%");
  });
});

// ─── notifyDailySummary ───

describe("notifyDailySummary", () => {
  it("full summary with top 3 leaderboard", async () => {
    await notifyDailySummary("EMERALD", "III", 50, 55.0, 10, 8, [
      { name: "Andrew", value: 300 },
      { name: "Joan", value: 250 },
      { name: "Shawn", value: 220 },
    ]);
    const msg = lastMessage();
    expect(msg).toContain("Daily Summary");
    expect(msg).toContain("EMERALD III 50LP");
    expect(msg).toContain("$55.00");
    expect(msg).toContain("10W 8L");
    expect(msg).toContain("56% WR");
    expect(msg).toContain("🥇 Andrew: $300.00");
    expect(msg).toContain("🥈 Joan: $250.00");
    expect(msg).toContain("🥉 Shawn: $220.00");
  });

  it("zero games shows 0% WR", async () => {
    await notifyDailySummary("PLATINUM", "IV", 0, 10, 0, 0, []);
    expect(lastMessage()).toContain("0% WR");
  });

  it("fewer than 3 leaderboard entries: no crash", async () => {
    await notifyDailySummary("DIAMOND", "I", 100, 100, 50, 20, [
      { name: "Solo", value: 500 },
    ]);
    const msg = lastMessage();
    expect(msg).toContain("🥇 Solo");
    expect(msg).not.toContain("🥈");
  });
});
