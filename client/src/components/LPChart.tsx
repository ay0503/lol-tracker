/*
 * LPChart: Main chart component with toggle between Area and Candlestick views.
 * Supports extended time ranges: 1W, 1M, 3M, 6M, YTD, ALL
 * Supports all ETF tickers: DORI, DDRI, TDRI, SDRI, XDRI
 * Shows price ($) on Y-axis instead of raw LP.
 * Syncs time range pills with candlestick chart zoom level.
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  getETFDataForRange,
  TICKERS,
  type TimeRange,
} from "@/lib/playerData";
import { useTranslation } from "@/contexts/LanguageContext";
import { translateTickerDescription } from "@/lib/formatters";
import { motion } from "framer-motion";
import CandlestickChart from "./CandlestickChart";
import { LineChart, CandlestickChart as CandlestickIcon } from "lucide-react";

type ChartView = "area" | "candlestick";
const TIME_RANGES: TimeRange[] = ["1W", "1M", "3M", "6M", "YTD", "ALL"];

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

export default function LPChart() {
  const { t, language } = useTranslation();
  const [chartView, setChartView] = useState<ChartView>("area");
  const [activeRange, setActiveRange] = useState<TimeRange>("1M");
  const [activeTicker, setActiveTicker] = useState("DORI");
  const [mounted, setMounted] = useState(false);

  const tickerInfo = TICKERS.find((tk) => tk.symbol === activeTicker) || TICKERS[0];
  const tickerColor = tickerInfo.color;

  const data = useMemo(() => {
    return getETFDataForRange(activeTicker, activeRange);
  }, [activeRange, activeTicker]);

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

  const minPrice = Math.min(...data.map((d) => d.price ?? 0));
  const maxPrice = Math.max(...data.map((d) => d.price ?? 0));
  const padding = Math.max(2, (maxPrice - minPrice) * 0.15);

  const chartData = useMemo(() => {
    if (data.length <= 60) return data;
    const step = Math.ceil(data.length / 60);
    const thinned = data.filter((_, i) => i % step === 0);
    if (thinned[thinned.length - 1] !== data[data.length - 1]) {
      thinned.push(data[data.length - 1]);
    }
    return thinned;
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

        <div className="flex gap-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setActiveRange(range)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 ${
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

      {/* Area Chart */}
      {chartView === "area" && (
        <div
          style={{
            width: "100%",
            height: 380,
            minWidth: 300,
            minHeight: 300,
          }}
        >
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
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
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#6b7280",
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  dy={10}
                  interval="preserveStartEnd"
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
                  content={<CustomTooltip tickerColor={tickerColor} />}
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
                  dot={false}
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
