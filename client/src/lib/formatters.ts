/**
 * Locale-aware formatters for dates, times, durations, and rank names.
 * Uses the current language from the i18n context.
 */

// ─── Rank Name Translation ───
const RANK_NAMES_KO: Record<string, string> = {
  iron: "아이언",
  bronze: "브론즈",
  silver: "실버",
  gold: "골드",
  platinum: "플래티넘",
  emerald: "에메랄드",
  diamond: "다이아몬드",
  master: "마스터",
  grandmaster: "그랜드마스터",
  challenger: "챌린저",
};

export function translateRank(rank: string, lang: string): string {
  if (lang !== "ko") return rank;

  // Handle formats like "EMERALD II", "Emerald 2", "Platinum 4 (59 LP)", etc.
  let result = rank;
  for (const [en, ko] of Object.entries(RANK_NAMES_KO)) {
    const regex = new RegExp(en, "gi");
    result = result.replace(regex, ko);
  }
  return result;
}

// ─── Date Formatting ───
export function formatDate(date: Date | string | number, lang: string): string {
  const d = new Date(date);
  const locale = lang === "ko" ? "ko-KR" : "en-US";
  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string | number, lang: string): string {
  const d = new Date(date);
  const locale = lang === "ko" ? "ko-KR" : "en-US";
  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Duration Formatting ───
// Converts seconds to a locale-aware duration string
// e.g., 1536 -> "25m 36s" (en) or "25분 36초" (ko)
export function formatDuration(seconds: number, lang: string): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (lang === "ko") {
    return s > 0 ? `${m}분 ${s}초` : `${m}분`;
  }
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ─── Time Ago Formatting ───
// Converts a timestamp to a locale-aware "time ago" string
export function formatTimeAgo(timestamp: number | Date, lang: string): string {
  const now = Date.now();
  const ts = typeof timestamp === "number" ? timestamp : timestamp.getTime();
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (lang === "ko") {
    if (mins < 1) return "방금";
    if (mins < 60) return `${mins}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return formatDate(ts, lang);
  }

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(ts, lang);
}

// ─── Match Result Translation ───
export function formatMatchResult(result: string, lang: string): { full: string; short: string } {
  if (lang === "ko") {
    switch (result) {
      case "Victory":
        return { full: "승리", short: "승" };
      case "Defeat":
        return { full: "패배", short: "패" };
      case "Remake":
        return { full: "다시하기", short: "다시" };
      default:
        return { full: result, short: result };
    }
  }
  switch (result) {
    case "Victory":
      return { full: "Victory", short: "WIN" };
    case "Defeat":
      return { full: "Defeat", short: "LOSS" };
    case "Remake":
      return { full: "Remake", short: "RMK" };
    default:
      return { full: result, short: result };
  }
}

// ─── Time Ago from Date (for Ledger/NewsFeed/Sentiment) ───
export function formatTimeAgoFromDate(date: Date | string, lang: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (lang === "ko") {
    if (diffMin < 1) return "방금";
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffHr < 24) return `${diffHr}시간 전`;
    if (diffDay < 7) return `${diffDay}일 전`;
    return formatDate(d, lang);
  }

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(d, lang);
}

// ─── Number Formatting ───
export function formatNumber(num: number, lang: string): string {
  const locale = lang === "ko" ? "ko-KR" : "en-US";
  return num.toLocaleString(locale);
}

// ─── Ticker Description Translation ───
const TICKER_DESC_KO: Record<string, string> = {
  DORI: "1배 LP 추적",
  DDRI: "2배 레버리지 LP",
  TDRI: "3배 레버리지 LP",
  SDRI: "2배 인버스 LP",
  XDRI: "3배 인버스 LP",
};

export function translateTickerDescription(symbol: string, description: string, lang: string): string {
  if (lang !== "ko") return description;
  return TICKER_DESC_KO[symbol] || description;
}
