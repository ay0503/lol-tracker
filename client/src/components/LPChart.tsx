/*
 * LPChart: Main chart component with toggle between Area and Candlestick views.
 * Now supports extended time ranges: 1W, 1M, 3M, 6M, YTD, ALL
 * Shows price ($) on Y-axis instead of raw LP.
 */
import { useState, useMemo, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { getDataForRange, type LPDataPoint, type TimeRange, totalLPToPrice } from "@/lib/playerData";
import { motion } from "framer-motion";
import CandlestickChart from "./CandlestickChart";
import { LineChart, CandlestickChart as CandlestickIcon } from "lucide-react";

type ChartView = "area" | "candlestick";
const TIME_RANGES: TimeRange[] = ["1W", "1M", "3M", "6M", "YTD", "ALL"];

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as LPDataPoint;
    const price = data.price ?? totalLPToPrice(data.totalLP);
    return (
      <div className="bg-[#1e2028] border border-[#2a2d38] rounded-lg px-4 py-3 shadow-xl">
        <p className="text-white font-semibold text-sm" style={{ fontFamily: "var(--font-heading)" }}>
          ${price.toFixed(2)}
        </p>
        <p className="text-muted-foreground text-xs mt-0.5">{data.label}</p>
        <p className="text-muted-foreground text-xs mt-1">{data.date}</p>
      </div>
    );
  }
  return null;
}

export default function LPChart() {
  const [chartView, setChartView] = useState<ChartView>("area");
  const [activeRange, setActiveRange] = useState<TimeRange>("1M");
  const [mounted, setMounted] = useState(false);

  const data = useMemo(() => {
    const raw = getDataForRange(activeRange);
    return raw.map(d => ({
      ...d,
      price: d.price ?? totalLPToPrice(d.totalLP),
    }));
  }, [activeRange]);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const firstPrice = data[0]?.price ?? 0;
  const lastPrice = data[data.length - 1]?.price ?? 0;
  const priceChange = lastPrice - firstPrice;
  const isPositive = priceChange >= 0;
  const chartColor = isPositive ? "#00C805" : "#FF5252";

  const minPrice = Math.min(...data.map((d) => d.price ?? 0));
  const maxPrice = Math.max(...data.map((d) => d.price ?? 0));
  const padding = Math.max(2, (maxPrice - minPrice) * 0.15);

  // Thin out data for long ranges to keep chart performant
  const chartData = useMemo(() => {
    if (data.length <= 60) return data;
    const step = Math.ceil(data.length / 60);
    const thinned = data.filter((_, i) => i % step === 0);
    // Always include last point
    if (thinned[thinned.length - 1] !== data[data.length - 1]) {
      thinned.push(data[data.length - 1]);
    }
    return thinned;
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Chart view toggle + time ranges */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
          <button
            onClick={() => setChartView("area")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              chartView === "area"
                ? "bg-primary text-black"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            Line
          </button>
          <button
            onClick={() => setChartView("candlestick")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              chartView === "candlestick"
                ? "bg-primary text-black"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            <CandlestickIcon className="w-3.5 h-3.5" />
            Candles
          </button>
        </div>

        <div className="flex gap-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setActiveRange(range)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 ${
                activeRange === range
                  ? "text-white"
                  : "bg-transparent text-muted-foreground hover:text-white"
              }`}
              style={{
                fontFamily: "var(--font-mono)",
                ...(activeRange === range
                  ? { backgroundColor: isPositive ? "#00C805" : "#FF5252" }
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
        <span className="text-2xl font-bold text-white font-[var(--font-mono)]">
          ${lastPrice.toFixed(2)}
        </span>
        <span
          className="text-sm font-semibold font-[var(--font-mono)]"
          style={{ color: isPositive ? "#00C805" : "#FF5252" }}
        >
          {isPositive ? "+" : ""}${priceChange.toFixed(2)} ({firstPrice > 0 ? ((priceChange / firstPrice) * 100).toFixed(1) : "0.0"}%)
        </span>
        <span className="text-xs text-muted-foreground">{activeRange}</span>
      </div>

      {/* Area Chart */}
      {chartView === "area" && (
        <div style={{ width: "100%", height: 380, minWidth: 300, minHeight: 300 }}>
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="lpGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6b7280", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
                  dy={10}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[minPrice - padding, maxPrice + padding]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                  tickFormatter={(val: number) => `$${val.toFixed(0)}`}
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#4b5563", strokeDasharray: "4 4" }} />
                <ReferenceLine y={firstPrice} stroke="#374151" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={chartColor}
                  strokeWidth={2.5}
                  fill="url(#lpGradient)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: chartColor,
                    stroke: "#1B1B1B",
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
      {chartView === "candlestick" && <CandlestickChart timeRange={activeRange} />}
    </motion.div>
  );
}
