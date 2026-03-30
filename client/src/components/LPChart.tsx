/*
 * LPChart: Main chart component with toggle between Area and Candlestick views.
 * Supports extended time ranges: 1W, 1M, 3M, 6M, YTD, ALL
 * Supports all ETF tickers: DORI, DDRI, TDRI, SDRI, XDRI
 * Shows price ($) on Y-axis instead of raw LP.
 * Uses numerical timestamp X-axis for proper temporal spacing.
 * Collapses intraday snapshots to one point per day (last snapshot wins).
 */
import { useMemo, useEffect, useCallback, useState, useRef } from "react";
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
import { useAuth } from "@/_core/hooks/useAuth";
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
  /** Index-based X value for compressed timeline (non-intraday) or timestamp (intraday) */
  ts: number;
  /** Original timestamp for tooltip display and label formatting */
  originalTs: number;
  /** Formatted date label for display */
  date: string;
  price: number;
  label: string;
  isLast?: boolean;
  /** Whether this point is the first of a new day (for day separators) */
  isNewDay?: boolean;
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

/**
 * Format a tick label for the compressed (index-based) or intraday (timestamp-based) x-axis.
 * For compressed mode, we look up the original timestamp from the data array.
 */
function formatCompressedTickLabel(
  value: number,
  language: string,
  range: TimeRange,
  data: ChartDataPoint[]
): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (isIntradayRange(range)) {
    // value is a real timestamp
    const d = new Date(value);
    const hours = d.getHours();
    if (language === "ko") {
      return `${hours}시`;
    }
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${h12} ${ampm}`;
  }

  // value is an index — look up the original timestamp
  const idx = Math.round(value);
  const pt = data[idx];
  if (!pt) return "";
  const d = new Date(pt.originalTs);

  if (language === "ko") {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Generate smart tick positions for the x-axis.
 * For intraday: uses real timestamps, picks hour boundaries.
 * For compressed (non-intraday): uses index values, picks ~5-7 evenly spaced
 * positions that align with day boundaries where possible.
 */
function generateSmartTicks(data: ChartDataPoint[], range: TimeRange): number[] {
  if (data.length < 2) return data.map(d => d.ts);

  if (isIntradayRange(range)) {
    // Intraday: pick ticks at each distinct hour boundary (real timestamps)
    const seen = new Set<number>();
    const ticks: number[] = [];
    for (const pt of data) {
      const d = new Date(pt.ts);
      const hourKey = d.getFullYear() * 1000000 + (d.getMonth() + 1) * 10000 + d.getDate() * 100 + d.getHours();
      if (!seen.has(hourKey)) {
        seen.add(hourKey);
        ticks.push(pt.ts);
      }
    }
    if (ticks.length > 8) {
      const step = Math.ceil(ticks.length / 7);
      return ticks.filter((_, i) => i % step === 0);
    }
    return ticks;
  }

  // Compressed mode: pick indices where day changes, then thin to ~5-8 ticks
  const dayBoundaryIndices: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i].isNewDay) {
      dayBoundaryIndices.push(i);
    }
  }

  // If few enough day boundaries, use them all
  if (dayBoundaryIndices.length <= 8 && dayBoundaryIndices.length >= 2) {
    return dayBoundaryIndices;
  }

  // Too many day boundaries — thin to ~6 evenly spaced
  if (dayBoundaryIndices.length > 8) {
    const TARGET = 6;
    const step = Math.ceil(dayBoundaryIndices.length / TARGET);
    const thinned = dayBoundaryIndices.filter((_, i) => i % step === 0);
    return thinned;
  }

  // Very few day boundaries (< 2) — fall back to evenly spaced indices
  const TARGET = Math.min(6, data.length);
  const step = Math.max(1, Math.floor(data.length / TARGET));
  const ticks: number[] = [];
  for (let i = 0; i < data.length; i += step) {
    ticks.push(i);
  }
  if (ticks[ticks.length - 1] !== data.length - 1) {
    ticks.push(data.length - 1);
  }
  return ticks;
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
  const lineChartRef = useRef<HTMLDivElement>(null);
  // Zoom state: [startIndex, endIndex] as fraction of data length (0-1)
  const [zoomRange, setZoomRange] = useState<[number, number]>([0, 1]);

  const tickerInfo = TICKERS.find((tk) => tk.symbol === activeTicker) || TICKERS[0];
  const tickerColor = tickerInfo.color;

  const since = useMemo(() => getRangeSince(activeRange), [activeRange]);

  // Chart data from etfHistory
  const { data: etfHistory, isLoading } = trpc.prices.etfHistory.useQuery(
    { ticker: activeTicker as any, since },
    { refetchInterval: 60_000, staleTime: 30_000 }
  );

  // Current price from etfPrices — single source of truth shared with TradingPanel
  const { data: etfPrices } = trpc.prices.etfPrices.useQuery(undefined, {
    refetchInterval: 60_000, staleTime: 30_000,
  });

  // Fetch user's trades for chart markers (only in candlestick view)
  const { isAuthenticated } = useAuth();
  const { data: myTrades } = trpc.trading.history.useQuery(
    { limit: 200 },
    { enabled: isAuthenticated && chartView === "candlestick", staleTime: 60_000 }
  );

  /**
   * Process raw ETF history into chart data:
   * 1. Filter out any future timestamps
   * 2. Collapse multiple intraday snapshots to one per day (last snapshot wins)
   * 3. Mark the last point for the endpoint dot
   */
  const intraday = isIntradayRange(activeRange);

  const currentPrice = etfPrices?.find((ep: any) => ep.ticker === activeTicker)?.price;

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

    // For non-intraday: use index-based X to compress dead time between sessions
    // For intraday: keep real timestamps
    let prevDay = "";
    const result = points.map((p, i) => {
      const day = dateKey(p.timestamp);
      const isNewDay = day !== prevDay;
      prevDay = day;
      return {
        ts: intraday ? p.timestamp : i,
        originalTs: p.timestamp,
        date: formatTimestamp(p.timestamp, language, intraday),
        price: p.price,
        label: `$${p.price.toFixed(2)}`,
        isLast: i === points.length - 1,
        isNewDay,
      };
    });

    // Sync chart endpoint with current live price to prevent mismatch
    if (currentPrice !== undefined && result.length > 0) {
      const lastPoint = result[result.length - 1];
      if (Math.abs(lastPoint.price - currentPrice) > 0.005) {
        result.push({
          ts: intraday ? Date.now() : result.length,
          originalTs: Date.now(),
          date: formatTimestamp(Date.now(), language, intraday),
          price: currentPrice,
          label: `$${currentPrice.toFixed(2)}`,
          isLast: true,
          isNewDay: false,
        });
        lastPoint.isLast = false;
      }
    }

    return result;
  }, [etfHistory, language, intraday, currentPrice]);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Reset zoom when range or ticker changes
  useEffect(() => { setZoomRange([0, 1]); }, [activeRange, activeTicker]);

  // Wheel zoom handler for line chart
  useEffect(() => {
    const el = lineChartRef.current;
    if (!el || chartView !== "area") return;

    const handleWheel = (e: WheelEvent) => {
      // Only zoom on pinch (ctrlKey) or trackpad pinch gesture
      if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (!e.ctrlKey) return;
      e.preventDefault();

      setZoomRange(([start, end]) => {
        const range = end - start;
        const zoomFactor = e.deltaY > 0 ? 0.1 : -0.1; // zoom out : zoom in
        const mouseXFrac = e.offsetX / el.clientWidth;
        const center = start + range * mouseXFrac;

        const newRange = Math.max(0.05, Math.min(1, range + range * zoomFactor));
        let newStart = center - newRange * mouseXFrac;
        let newEnd = center + newRange * (1 - mouseXFrac);

        // Clamp to [0, 1]
        if (newStart < 0) { newEnd -= newStart; newStart = 0; }
        if (newEnd > 1) { newStart -= (newEnd - 1); newEnd = 1; }
        newStart = Math.max(0, newStart);
        newEnd = Math.min(1, newEnd);

        return [newStart, newEnd];
      });
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [chartView]);

  const handleVisibleRangeChange = useCallback(
    (detectedRange: TimeRange | null) => {
      if (detectedRange && detectedRange !== activeRange) {
        setActiveRange(detectedRange);
      }
    },
    [activeRange]
  );

  // Apply zoom to data
  const zoomedData = useMemo(() => {
    if (data.length === 0 || (zoomRange[0] === 0 && zoomRange[1] === 1)) return data;
    const startIdx = Math.floor(zoomRange[0] * data.length);
    const endIdx = Math.ceil(zoomRange[1] * data.length);
    return data.slice(startIdx, endIdx);
  }, [data, zoomRange]);

  // P&L reflects what's visible on chart
  const firstPrice = zoomedData[0]?.price ?? 0;
  const livePrice = etfPrices?.find((p: any) => p.ticker === activeTicker)?.price;
  const lastPrice = livePrice ?? zoomedData[zoomedData.length - 1]?.price ?? 0;
  const priceChange = lastPrice - firstPrice;
  const isPositive = priceChange >= 0;
  const chartColor = isPositive ? tickerColor : "#FF5252";

  const minPrice = zoomedData.length > 0 ? Math.min(...zoomedData.map((d) => d.price)) : 0;
  const maxPrice = zoomedData.length > 0 ? Math.max(...zoomedData.map((d) => d.price)) : 100;
  const padding = Math.max(2, (maxPrice - minPrice) * 0.15);

  // X-axis domain: for intraday use timestamp range, for compressed use index range
  const xDomain = useMemo(() => {
    if (zoomedData.length === 0) return [0, 1];
    return [zoomedData[0].ts, zoomedData[zoomedData.length - 1].ts];
  }, [zoomedData]);

  // Smart ticks: only show labels at meaningful change points
  const smartTicks = useMemo(() => generateSmartTicks(zoomedData, activeRange), [zoomedData, activeRange]);

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
        <div className="overflow-x-auto scrollbar-thin" ref={lineChartRef}>
          <div
            style={{
              width: zoomedData.length > 20 && intraday ? Math.max(zoomedData.length * 40, 800) : "100%",
              height: 380,
              minWidth: 300,
              minHeight: 300,
            }}
          >
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={zoomedData}
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
                  scale={intraday ? "time" : "linear"}
                  domain={xDomain}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#6b7280",
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  dy={10}
                  ticks={smartTicks}
                  tickFormatter={(val: number) => formatCompressedTickLabel(val, language, activeRange, data)}
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
          trades={myTrades}
        />
      )}
    </motion.div>
  );
}

export type { TimeRange };
