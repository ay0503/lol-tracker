/*
 * LPChart: Main chart component with toggle between Area and Candlestick views.
 * Supports extended time ranges: 1W, 1M, 3M, 6M, YTD, ALL
 * Supports all ETF tickers: DORI, DDRI, TDRI, SDRI, XDRI
 * Shows price ($) on Y-axis instead of raw LP.
 * Uses numerical timestamp X-axis for proper temporal spacing.
 * Collapses intraday snapshots to one point per day (last snapshot wins).
 */
import { useMemo, useEffect, useCallback, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { translateTickerDescription } from "@/lib/formatters";
import { motion } from "framer-motion";
import CandlestickChart from "./CandlestickChart";
import { LineChart, CandlestickChart as CandlestickIcon, Loader2 } from "lucide-react";
import { useTicker } from "@/contexts/TickerContext";

type ChartView = "area" | "candlestick";
type TimeRange = "3H" | "6H" | "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "ALL";
const TIME_RANGES: TimeRange[] = ["3H", "6H", "1D", "1W", "1M", "3M", "6M", "YTD", "ALL"];

const TICKERS = [
  { symbol: "DORI", name: "DORI", description: "1x LP Tracker", color: "#00C805" },
  { symbol: "DDRI", name: "DDRI", description: "2x Leveraged LP", color: "#4CAF50" },
  { symbol: "TDRI", name: "TDRI", description: "3x Leveraged LP", color: "#8BC34A" },
  { symbol: "SDRI", name: "SDRI", description: "2x Inverse LP", color: "#FF5252" },
  { symbol: "XDRI", name: "XDRI", description: "3x Inverse LP", color: "#FF1744" },
] as const;

interface ChartDataPoint {
  /** Timestamp used as the numerical X-axis value */
  ts: number;
  /** Formatted date label for display */
  date: string;
  price: number;
  label: string;
  isLast?: boolean;
}

function getRangeSince(range: TimeRange): number | undefined {
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  switch (range) {
    case "3H": return now - 3 * HOUR;
    case "6H": return now - 6 * HOUR;
    case "1D": return now - 1 * DAY;
    case "1W": return now - 7 * DAY;
    case "1M": return now - 30 * DAY;
    case "3M": return now - 90 * DAY;
    case "6M": return now - 180 * DAY;
    case "YTD": {
      const jan1 = new Date(new Date().getFullYear(), 0, 1).getTime();
      return jan1;
    }
    case "ALL": return undefined;
    default: return undefined;
  }
}

/** Check if a time range is intraday (should show individual snapshots, not daily) */
function isIntradayRange(range: TimeRange): boolean {
  return range === "3H" || range === "6H" || range === "1D";
}

/** Format a timestamp into a short date label (or time for intraday) */
function formatTimestamp(ts: number, language: string, intraday: boolean = false): string {
  const d = new Date(ts);
  if (intraday) {
    const hours = d.getHours();
    const mins = String(d.getMinutes()).padStart(2, "0");
    if (language === "ko") {
      return `${hours}:${mins}`;
    }
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${h12}:${mins} ${ampm}`;
  }
  if (language === "ko") {
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/** Get a date-only key (YYYY-MM-DD) from a timestamp for deduplication */
function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CustomTooltip({ active, payload, tickerColor }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-lg px-4 py-3 shadow-xl">
        <p
          className="font-semibold text-sm"
          style={{ fontFamily: "var(--font-heading)", color: tickerColor }}
        >
          ${data.price?.toFixed(2)}
        </p>
        <p className="text-muted-foreground text-xs mt-0.5">{data.label}</p>
        <p className="text-muted-foreground text-xs mt-1">{data.date}</p>
      </div>
    );
  }
  return null;
}

/**
 * Custom dot renderer: only renders a visible dot on the last data point.
 */
function EndpointDot({ cx, cy, payload, chartColor }: any) {
  if (payload?.isLast) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={8} fill={chartColor} opacity={0.2} />
        <circle cx={cx} cy={cy} r={4} fill={chartColor} stroke="var(--background)" strokeWidth={2} />
      </g>
    );
  }
  return null;
}

export default function LPChart() {
  const { t, language } = useTranslation();
  const [chartView, setChartView] = useState<ChartView>("area");
  const [activeRange, setActiveRange] = useState<TimeRange>("1M");
  const { activeTicker, setActiveTicker } = useTicker();
  const [mounted, setMounted] = useState(false);

  const tickerInfo = TICKERS.find((tk) => tk.symbol === activeTicker) || TICKERS[0];
  const tickerColor = tickerInfo.color;

  const since = useMemo(() => getRangeSince(activeRange), [activeRange]);

  // Chart data from etfHistory — same computation engine as etfPrices
  const { data: etfHistory, isLoading } = trpc.prices.etfHistory.useQuery(
    { ticker: activeTicker as any, since },
    { refetchInterval: 30_000, staleTime: 15_000 }
  );

  /**
   * Process raw ETF history into chart data:
   * 1. Filter out any future timestamps
   * 2. Collapse multiple intraday snapshots to one per day (last snapshot wins)
   * 3. Mark the last point for the endpoint dot
   */
  const intraday = isIntradayRange(activeRange);

  const data: ChartDataPoint[] = useMemo(() => {
    if (!etfHistory || etfHistory.length === 0) return [];

    const now = Date.now();
    const filtered = etfHistory.filter((p) => p.timestamp <= now);
    if (filtered.length === 0) return [];

    let points: typeof filtered;

    if (intraday) {
      // For 3H/6H/1D: show every individual snapshot (no daily collapse)
      points = [...filtered].sort((a, b) => a.timestamp - b.timestamp);

      // Smart zoom: find the region where price actually changed and focus on it
      if (points.length > 3) {
        const prices = points.map(p => p.price);
        const totalRange = Math.max(...prices) - Math.min(...prices);
        // Only smart-zoom if there's meaningful price variation
        if (totalRange > 0.01) {
          // Find first and last index where price differs from the initial flat value
          const threshold = totalRange * 0.05; // 5% of total range = "meaningful change"
          const basePrice = prices[0];
          let firstChangeIdx = 0;
          let lastChangeIdx = points.length - 1;

          for (let i = 0; i < prices.length; i++) {
            if (Math.abs(prices[i] - basePrice) > threshold) {
              firstChangeIdx = i;
              break;
            }
          }

          for (let i = prices.length - 1; i >= 0; i--) {
            if (Math.abs(prices[i] - prices[prices.length - 1]) > threshold ||
                Math.abs(prices[i] - basePrice) > threshold) {
              lastChangeIdx = i;
              break;
            }
          }

          // Add context buffer: ~15% of the active range on each side, minimum 2 points
          const activeLen = lastChangeIdx - firstChangeIdx;
          const buffer = Math.max(2, Math.floor(activeLen * 0.15));
          const startIdx = Math.max(0, firstChangeIdx - buffer);
          const endIdx = Math.min(points.length - 1, lastChangeIdx + buffer);

          // Only trim if we'd actually remove a significant flat portion (>30% of points)
          const trimmedLen = endIdx - startIdx + 1;
          if (trimmedLen < points.length * 0.7) {
            points = points.slice(startIdx, endIdx + 1);
          }
        }
      }
    } else {
      // Collapse to one point per day — keep the LAST snapshot of each day
      const dayMap = new Map<string, typeof filtered[0]>();
      for (const p of filtered) {
        const key = dateKey(p.timestamp);
        dayMap.set(key, p); // overwrites earlier snapshots, keeping the last
      }
      points = Array.from(dayMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    }

    return points.map((p, i) => ({
      ts: p.timestamp,
      date: formatTimestamp(p.timestamp, language, intraday),
      price: p.price,
      label: `$${p.price.toFixed(2)}`,
      isLast: i === points.length - 1,
    }));
  }, [etfHistory, language, intraday]);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleVisibleRangeChange = useCallback(
    (detectedRange: TimeRange | null) => {
      if (detectedRange && detectedRange !== activeRange) {
        setActiveRange(detectedRange);
      }
    },
    [activeRange]
  );

  const firstPrice = data[0]?.price ?? 0;
  const lastPrice = data[data.length - 1]?.price ?? 0;
  const priceChange = lastPrice - firstPrice;
  const isPositive = priceChange >= 0;
  const chartColor = isPositive ? tickerColor : "#FF5252";

  const minPrice = data.length > 0 ? Math.min(...data.map((d) => d.price)) : 0;
  const maxPrice = data.length > 0 ? Math.max(...data.map((d) => d.price)) : 100;
  const padding = Math.max(2, (maxPrice - minPrice) * 0.15);

  // X-axis domain: from first to last timestamp (no extension beyond data)
  const xDomain = useMemo(() => {
    if (data.length === 0) return [0, 1];
    return [data[0].ts, data[data.length - 1].ts];
  }, [data]);

  const gradientId = `lpGradient-${activeTicker}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Ticker selector */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-thin">
        {TICKERS.map((tk) => {
          const isActive = tk.symbol === activeTicker;
          return (
            <button
              key={tk.symbol}
              onClick={() => setActiveTicker(tk.symbol)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap border ${
                isActive
                  ? "border-current"
                  : "border-transparent bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              style={
                isActive
                  ? {
                      color: tk.color,
                      backgroundColor: `${tk.color}15`,
                      borderColor: `${tk.color}40`,
                    }
                  : {}
              }
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: tk.color }}
              />
              <span className="font-[var(--font-mono)]">${tk.symbol}</span>
              <span className="text-[10px] opacity-60 hidden sm:inline">
                {translateTickerDescription(tk.symbol, tk.description, language)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Chart view toggle + time ranges */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
          <button
            onClick={() => setChartView("area")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              chartView === "area"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={
              chartView === "area"
                ? { backgroundColor: tickerColor }
                : {}
            }
          >
            <LineChart className="w-3.5 h-3.5" />
            {t.chart.line}
          </button>
          <button
            onClick={() => setChartView("candlestick")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              chartView === "candlestick"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={
              chartView === "candlestick"
                ? { backgroundColor: tickerColor }
                : {}
            }
          >
            <CandlestickIcon className="w-3.5 h-3.5" />
            {t.chart.candles}
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-0.5">
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setActiveRange(range)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 whitespace-nowrap shrink-0 ${
                activeRange === range
                  ? "text-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
              style={{
                fontFamily: "var(--font-mono)",
                ...(activeRange === range
                  ? { backgroundColor: isPositive ? tickerColor : "#FF5252" }
                  : {}),
              }}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Price change summary */}
      {data.length > 0 && (
        <div className="flex items-center gap-3 mb-2">
          <span
            className="text-2xl font-bold font-[var(--font-mono)]"
            style={{ color: tickerColor }}
          >
            ${lastPrice.toFixed(2)}
          </span>
          <span
            className="text-sm font-semibold font-[var(--font-mono)]"
            style={{ color: isPositive ? tickerColor : "#FF5252" }}
          >
            {isPositive ? "+" : ""}${priceChange.toFixed(2)} (
            {firstPrice > 0
              ? ((priceChange / firstPrice) * 100).toFixed(1)
              : "0.0"}
            %)
          </span>
          <span className="text-xs text-muted-foreground">{activeRange}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center h-[380px]">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[380px] text-muted-foreground">
          <p className="text-sm">{t.common.noData || "No price data yet"}</p>
          <p className="text-xs mt-1">{t.common.waitingForData || "Waiting for polling engine to collect data..."}</p>
        </div>
      )}

      {/* Area Chart */}
      {chartView === "area" && !isLoading && data.length > 0 && (
        <div className="overflow-x-auto scrollbar-thin">
          <div
            style={{
              width: data.length > 20 && intraday ? Math.max(data.length * 40, 800) : "100%",
              height: 380,
              minWidth: 300,
              minHeight: 300,
            }}
          >
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id={gradientId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={chartColor}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor={chartColor}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={xDomain}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#6b7280",
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  dy={10}
                  tickFormatter={(ts: number) => formatTimestamp(ts, language, intraday)}
                  tickCount={7}
                />
                <YAxis
                  domain={[minPrice - padding, maxPrice + padding]}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#6b7280",
                    fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  tickFormatter={(val: number) => `$${val.toFixed(0)}`}
                  width={50}
                />
                <Tooltip
                  content={<CustomTooltip tickerColor={tickerColor} language={language} />}
                  cursor={{ stroke: "#4b5563", strokeDasharray: "4 4" }}
                />
                <ReferenceLine
                  y={firstPrice}
                  stroke="#374151"
                  strokeDasharray="3 3"
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={chartColor}
                  strokeWidth={2.5}
                  fill={`url(#${gradientId})`}
                  dot={(props: any) => <EndpointDot {...props} chartColor={chartColor} />}
                  activeDot={{
                    r: 5,
                    fill: chartColor,
                    stroke: "var(--background)",
                    strokeWidth: 2,
                  }}
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
          </div>
        </div>
      )}

      {/* Candlestick Chart */}
      {chartView === "candlestick" && (
        <CandlestickChart
          timeRange={activeRange}
          onVisibleRangeChange={handleVisibleRangeChange}
          ticker={activeTicker}
        />
      )}
    </motion.div>
  );
}

export type { TimeRange };
