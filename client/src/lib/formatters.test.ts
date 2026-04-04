import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  translateRank,
  formatDuration,
  formatTimeAgo,
  formatMatchResult,
  formatChartDate,
  formatNumber,
  translateTickerDescription,
} from "./formatters";

// ─── translateRank ───

describe("translateRank", () => {
  it("English passthrough", () => {
    expect(translateRank("Emerald II", "en")).toBe("Emerald II");
  });

  it("Korean translation", () => {
    expect(translateRank("EMERALD II", "ko")).toBe("에메랄드 II");
  });

  it("case insensitive", () => {
    expect(translateRank("emerald II", "ko")).toBe("에메랄드 II");
    expect(translateRank("Platinum IV", "ko")).toBe("플래티넘 IV");
  });

  it("compound string with LP", () => {
    const result = translateRank("Platinum 4 (59 LP)", "ko");
    expect(result).toContain("플래티넘");
    expect(result).toContain("59 LP");
  });

  it("all rank names translate", () => {
    expect(translateRank("Iron", "ko")).toContain("아이언");
    expect(translateRank("Bronze", "ko")).toContain("브론즈");
    expect(translateRank("Silver", "ko")).toContain("실버");
    expect(translateRank("Gold", "ko")).toContain("골드");
    expect(translateRank("Diamond", "ko")).toContain("다이아몬드");
    expect(translateRank("Master", "ko")).toContain("마스터");
    expect(translateRank("Challenger", "ko")).toContain("챌린저");
  });
});

// ─── formatDuration ───

describe("formatDuration", () => {
  it("English with seconds", () => {
    expect(formatDuration(1536, "en")).toBe("25m 36s");
  });

  it("Korean with seconds", () => {
    expect(formatDuration(1536, "ko")).toBe("25분 36초");
  });

  it("exact minutes (no seconds)", () => {
    expect(formatDuration(300, "en")).toBe("5m");
    expect(formatDuration(300, "ko")).toBe("5분");
  });

  it("zero seconds", () => {
    expect(formatDuration(0, "en")).toBe("0m");
  });
});

// ─── formatTimeAgo ───

describe("formatTimeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("less than 1 minute: just now / 방금", () => {
    const now = Date.now();
    expect(formatTimeAgo(now - 30_000, "en")).toBe("just now");
    expect(formatTimeAgo(now - 30_000, "ko")).toBe("방금");
  });

  it("5 minutes ago", () => {
    const fiveMinAgo = Date.now() - 5 * 60_000;
    expect(formatTimeAgo(fiveMinAgo, "en")).toBe("5m ago");
    expect(formatTimeAgo(fiveMinAgo, "ko")).toBe("5분 전");
  });

  it("3 hours ago", () => {
    const threeHrsAgo = Date.now() - 3 * 60 * 60_000;
    expect(formatTimeAgo(threeHrsAgo, "en")).toBe("3h ago");
    expect(formatTimeAgo(threeHrsAgo, "ko")).toBe("3시간 전");
  });

  it("2 days ago", () => {
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60_000;
    expect(formatTimeAgo(twoDaysAgo, "en")).toBe("2d ago");
    expect(formatTimeAgo(twoDaysAgo, "ko")).toBe("2일 전");
  });

  it("8 days ago falls back to formatted date", () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60_000;
    const result = formatTimeAgo(eightDaysAgo, "en");
    // Should be a date string, not "8d ago"
    expect(result).not.toContain("d ago");
  });

  it("accepts Date object", () => {
    const date = new Date(Date.now() - 10 * 60_000);
    expect(formatTimeAgo(date, "en")).toBe("10m ago");
  });
});

// ─── formatMatchResult ───

describe("formatMatchResult", () => {
  it("Victory in English", () => {
    expect(formatMatchResult("Victory", "en")).toEqual({ full: "Victory", short: "WIN" });
  });

  it("Victory in Korean", () => {
    expect(formatMatchResult("Victory", "ko")).toEqual({ full: "승리", short: "승" });
  });

  it("Defeat in both languages", () => {
    expect(formatMatchResult("Defeat", "en")).toEqual({ full: "Defeat", short: "LOSS" });
    expect(formatMatchResult("Defeat", "ko")).toEqual({ full: "패배", short: "패" });
  });

  it("Remake in both languages", () => {
    expect(formatMatchResult("Remake", "en")).toEqual({ full: "Remake", short: "RMK" });
    expect(formatMatchResult("Remake", "ko")).toEqual({ full: "다시하기", short: "다시" });
  });

  it("unknown result passes through", () => {
    expect(formatMatchResult("Unknown", "en")).toEqual({ full: "Unknown", short: "Unknown" });
    expect(formatMatchResult("Unknown", "ko")).toEqual({ full: "Unknown", short: "Unknown" });
  });
});

// ─── formatChartDate ───

describe("formatChartDate", () => {
  it("English passthrough", () => {
    expect(formatChartDate("Mar 6", "en")).toBe("Mar 6");
  });

  it("Korean translation", () => {
    expect(formatChartDate("Mar 6", "ko")).toBe("3월 6일");
  });

  it("all months translate correctly", () => {
    expect(formatChartDate("Jan 1", "ko")).toBe("1월 1일");
    expect(formatChartDate("Jun 15", "ko")).toBe("6월 15일");
    expect(formatChartDate("Dec 31", "ko")).toBe("12월 31일");
  });

  it("non-matching format returns unchanged", () => {
    expect(formatChartDate("2026-03-06", "ko")).toBe("2026-03-06");
  });
});

// ─── formatNumber ───

describe("formatNumber", () => {
  it("formats thousands in English", () => {
    const result = formatNumber(12345, "en");
    expect(result).toContain("12");
    expect(result).toContain("345");
  });

  it("formats thousands in Korean", () => {
    const result = formatNumber(12345, "ko");
    expect(result).toContain("12");
    expect(result).toContain("345");
  });
});

// ─── translateTickerDescription ───

describe("translateTickerDescription", () => {
  it("English passthrough", () => {
    expect(translateTickerDescription("DORI", "1x LP Tracker", "en")).toBe("1x LP Tracker");
  });

  it("Korean translation for known tickers", () => {
    expect(translateTickerDescription("DORI", "1x LP Tracker", "ko")).toBe("1배 LP 추적");
    expect(translateTickerDescription("XDRI", "3x Inverse LP", "ko")).toBe("3배 인버스 LP");
  });

  it("unknown ticker falls back to description", () => {
    expect(translateTickerDescription("ZZRI", "Unknown", "ko")).toBe("Unknown");
  });
});
