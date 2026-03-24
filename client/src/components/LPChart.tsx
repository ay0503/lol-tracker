/*
 * LPChart: Main chart component with toggle between Area and Candlestick views.
 * Area = Robinhood-style smooth line.
 * Candlestick = TradingView-style OHLC with annotation tools.
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
import { LP_HISTORY, type LPDataPoint } from "@/lib/playerData";
import { motion } from "framer-motion";
import CandlestickChart from "./CandlestickChart";
import { LineChart, CandlestickChart as CandlestickIcon } from "lucide-react";

type ChartView = "area" | "candlestick";
const TIME_RANGES = ["1W", "2W", "Season"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

function getFilteredData(range: TimeRange): LPDataPoint[] {
  const data = [...LP_HISTORY];
  switch (range) {
    case "1W":
      return data.slice(-7);
    case "2W":
      return data;
    case "Season":
      return data;
    default:
      return data;
  }
}

function formatTierLabel(val: number): string {
  const rounded = Math.round(val);
  if (rounded >= 300) return `E1 ${rounded - 300}LP`;
  if (rounded >= 200) return `E2 ${rounded - 200}LP`;
  if (rounded >= 100) return `E3 ${rounded - 100}LP`;
  return `E4 ${rounded}LP`;
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as LPDataPoint;
    return (
      <div className="bg-[#1e2028] border border-[#2a2d38] rounded-lg px-4 py-3 shadow-xl">
        <p className="text-white font-semibold text-sm" style={{ fontFamily: "var(--font-heading)" }}>
          {data.label}
        </p>
        <p className="text-muted-foreground text-xs mt-1">{data.date}</p>
      </div>
    );
  }
  return null;
}

export default function LPChart() {
  const [chartView, setChartView] = useState<ChartView>("area");
  const [activeRange, setActiveRange] = useState<TimeRange>("2W");
  const [mounted, setMounted] = useState(false);
  const data = useMemo(() => getFilteredData(activeRange), [activeRange]);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const firstLP = data[0]?.totalLP ?? 0;
  const lastLP = data[data.length - 1]?.totalLP ?? 0;
  const lpChange = lastLP - firstLP;
  const isPositive = lpChange >= 0;
  const chartColor = isPositive ? "#00C805" : "#FF5252";

  const minLP = Math.min(...data.map((d) => d.totalLP));
  const maxLP = Math.max(...data.map((d) => d.totalLP));
  const padding = Math.max(20, (maxLP - minLP) * 0.15);

  const yTicks = useMemo(() => {
    const low = minLP - padding;
    const high = maxLP + padding;
    const ticks: number[] = [];
    for (const boundary of [0, 50, 100, 150, 200, 250, 300]) {
      if (boundary >= low && boundary <= high) {
        ticks.push(boundary);
      }
    }
    return ticks;
  }, [minLP, maxLP, padding]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Chart view toggle */}
      <div className="flex items-center justify-between mb-3">
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

        {chartView === "area" && (
          <div className="flex gap-2">
            {TIME_RANGES.map((range) => (
              <button
                key={range}
                onClick={() => setActiveRange(range)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 ${
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
        )}
      </div>

      {/* Area Chart */}
      {chartView === "area" && (
        <div style={{ width: "100%", height: 380, minWidth: 300, minHeight: 300 }}>
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
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
                />
                <YAxis
                  domain={[minLP - padding, maxLP + padding]}
                  axisLine={false}
                  tickLine={false}
                  ticks={yTicks}
                  tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                  tickFormatter={formatTierLabel}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#4b5563", strokeDasharray: "4 4" }} />
                <ReferenceLine y={firstLP} stroke="#374151" strokeDasharray="3 3" />
                <ReferenceLine y={100} stroke="#374151" strokeDasharray="2 6" strokeOpacity={0.5} />
                <ReferenceLine y={200} stroke="#374151" strokeDasharray="2 6" strokeOpacity={0.5} />
                <Area
                  type="monotone"
                  dataKey="totalLP"
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
      {chartView === "candlestick" && <CandlestickChart />}
    </motion.div>
  );
}
