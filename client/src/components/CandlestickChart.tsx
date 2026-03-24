/*
 * CandlestickChart: TradingView-style chart using lightweight-charts v5.
 * Converts LP data into OHLC candlestick format with price ($) values.
 * Includes drawing/annotation tools: trend lines, horizontal lines, text markers.
 *
 * KEY FIX: Always passes the FULL dataset to the chart and uses the time scale
 * visible range to control the initial view. This means zooming out reveals
 * more data instead of showing empty space.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  CrosshairMode,
  type CandlestickData,
  type LineData,
  type Time,
  type SeriesMarker,
} from "lightweight-charts";
import {
  FULL_LP_HISTORY,
  getDataForRange,
  totalLPToPrice,
  type TimeRange,
  type LPDataPoint,
} from "@/lib/playerData";
import {
  Minus,
  TrendingUp,
  Type,
  Trash2,
  MousePointer,
  Pencil,
} from "lucide-react";

interface CandlestickChartProps {
  timeRange?: TimeRange;
  onVisibleRangeChange?: (range: TimeRange | null) => void;
}

// Parse a date string like "Mar 23" or "Jan 1" into a YYYY-MM-DD string
// The data spans from Sep 2025 to Mar 2026
function parseLPDate(dateStr: string): string {
  const monthMap: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  const parts = dateStr.trim().split(/\s+/);
  if (parts.length < 2) return "2026-01-01";

  const monthStr = parts[0];
  const day = parseInt(parts[1], 10);
  const month = monthMap[monthStr];

  if (month === undefined || isNaN(day)) return "2026-01-01";

  // Determine year: Sep-Dec = 2025, Jan-Mar = 2026
  const year = month >= 8 ? 2025 : 2026;

  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// Convert LP data to OHLC candlestick format with price values
function generateCandlestickData(data: LPDataPoint[]): CandlestickData<Time>[] {
  const result: CandlestickData<Time>[] = [];
  const seenDates = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    const prev = i > 0 ? data[i - 1] : null;

    const closePrice = point.price ?? totalLPToPrice(point.totalLP);
    const openPrice = prev ? (prev.price ?? totalLPToPrice(prev.totalLP)) : closePrice - 0.5;

    // Simulate intraday volatility
    const volatility = Math.abs(closePrice - openPrice) * 0.3 + 0.5;
    const seed1 = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    const rand1 = seed1 - Math.floor(seed1);
    const seed2 = Math.sin(i * 43.2316 + 12.989) * 23421.6312;
    const rand2 = seed2 - Math.floor(seed2);
    const high = Math.max(openPrice, closePrice) + rand1 * volatility;
    const low = Math.min(openPrice, closePrice) - rand2 * volatility;

    let dateStr = parseLPDate(point.date);

    // Deduplicate: lightweight-charts requires strictly ascending unique times
    if (seenDates.has(dateStr)) {
      continue;
    }
    seenDates.add(dateStr);

    result.push({
      time: dateStr as Time,
      open: Math.round(openPrice * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(closePrice * 100) / 100,
    });
  }

  return result;
}

// Generate volume data
function generateVolumeData(data: LPDataPoint[]) {
  const seenDates = new Set<string>();

  return data
    .map((point, i) => {
      const prev = i > 0 ? data[i - 1] : null;
      const change = prev ? point.totalLP - prev.totalLP : 0;
      const dateStr = parseLPDate(point.date);

      if (seenDates.has(dateStr)) return null;
      seenDates.add(dateStr);

      const seed = Math.sin(i * 7.234 + 3.456) * 12345.6789;
      const rand = seed - Math.floor(seed);

      return {
        time: dateStr as Time,
        value: Math.abs(change) * 0.5 + rand * 5 + 2,
        color: change >= 0 ? "rgba(0, 200, 5, 0.3)" : "rgba(255, 82, 82, 0.3)",
      };
    })
    .filter(Boolean) as { time: Time; value: number; color: string }[];
}

// Get the date string for N days ago from the last data point
function getDateNDaysAgo(allCandles: CandlestickData<Time>[], days: number): string | null {
  if (allCandles.length === 0) return null;
  const targetIdx = Math.max(0, allCandles.length - days);
  return allCandles[targetIdx].time as string;
}

// Determine which time range label best matches a visible range span
function detectTimeRange(visibleDays: number): TimeRange | null {
  if (visibleDays <= 9) return "1W";
  if (visibleDays <= 40) return "1M";
  if (visibleDays <= 100) return "3M";
  if (visibleDays <= 190) return "6M";
  return "ALL";
}

type DrawingTool = "pointer" | "trendline" | "hline" | "text";

interface Annotation {
  id: string;
  type: "trendline" | "hline" | "text";
  data: any;
  seriesRef?: ISeriesApi<any>;
}

export default function CandlestickChart({ timeRange = "1M", onVisibleRangeChange }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const [activeTool, setActiveTool] = useState<DrawingTool>("pointer");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [hlinePrice, setHlinePrice] = useState<string>("");
  const [showHlineInput, setShowHlineInput] = useState(false);
  const [textInput, setTextInput] = useState<string>("");
  const [showTextInput, setShowTextInput] = useState(false);
  const markersRef = useRef<SeriesMarker<Time>[]>([]);
  const isSettingRangeRef = useRef(false);

  // Always use FULL dataset for the chart
  const allData = FULL_LP_HISTORY;
  const allCandles = useRef<CandlestickData<Time>[]>([]);

  // Compute how many candles to show for each time range
  const getRangeDays = useCallback((range: TimeRange): number => {
    switch (range) {
      case "1W": return 7;
      case "1M": return 30;
      case "3M": return 90;
      case "6M": return 180;
      case "YTD": return 83; // ~Jan 1 to Mar 23
      case "ALL": return 9999;
      default: return 30;
    }
  }, []);

  // Initialize chart once, then update visible range on timeRange change
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clear previous annotations state
    setAnnotations([]);
    markersRef.current = [];

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#6b7280",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(42, 45, 56, 0.5)" },
        horzLines: { color: "rgba(42, 45, 56, 0.5)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(255, 255, 255, 0.2)",
          labelBackgroundColor: "#2a2d38",
        },
        horzLine: {
          color: "rgba(255, 255, 255, 0.2)",
          labelBackgroundColor: "#2a2d38",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(42, 45, 56, 0.8)",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "rgba(42, 45, 56, 0.8)",
        timeVisible: false,
        rightOffset: 2,
        barSpacing: 8,
      },
      handleScroll: { vertTouchDrag: false },
    });

    // Candlestick series with FULL data
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00C805",
      downColor: "#FF5252",
      borderDownColor: "#FF5252",
      borderUpColor: "#00C805",
      wickDownColor: "#FF5252",
      wickUpColor: "#00C805",
    });

    const candleData = generateCandlestickData(allData);
    allCandles.current = candleData;
    candlestickSeries.setData(candleData);

    // Volume histogram with FULL data
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const volumeData = generateVolumeData(allData);
    volumeSeries.setData(volumeData);

    // Set initial visible range based on timeRange prop
    const days = getRangeDays(timeRange);
    if (timeRange === "ALL" || days >= candleData.length) {
      chart.timeScale().fitContent();
    } else {
      const fromDate = getDateNDaysAgo(candleData, days);
      const toDate = candleData[candleData.length - 1]?.time as string;
      if (fromDate && toDate) {
        chart.timeScale().setVisibleRange({
          from: fromDate as Time,
          to: toDate as Time,
        });
      }
    }

    // Listen for visible range changes to sync UI pills
    if (onVisibleRangeChange) {
      chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
        if (isSettingRangeRef.current) return;
        if (!logicalRange) return;
        const visibleBars = Math.round(logicalRange.to - logicalRange.from);
        const detected = detectTimeRange(visibleBars);
        onVisibleRangeChange(detected);
      });
    }

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []); // Only create chart once

  // Update visible range when timeRange prop changes (without recreating chart)
  useEffect(() => {
    if (!chartRef.current || allCandles.current.length === 0) return;

    isSettingRangeRef.current = true;

    const days = getRangeDays(timeRange);
    const candleData = allCandles.current;

    if (timeRange === "ALL" || days >= candleData.length) {
      chartRef.current.timeScale().fitContent();
    } else {
      const fromDate = getDateNDaysAgo(candleData, days);
      const toDate = candleData[candleData.length - 1]?.time as string;
      if (fromDate && toDate) {
        chartRef.current.timeScale().setVisibleRange({
          from: fromDate as Time,
          to: toDate as Time,
        });
      }
    }

    // Reset flag after a short delay to allow the range change to propagate
    setTimeout(() => {
      isSettingRangeRef.current = false;
    }, 100);
  }, [timeRange, getRangeDays]);

  // Add horizontal line
  const addHorizontalLine = useCallback(
    (price: number) => {
      if (!chartRef.current) return;

      const lineSeries = chartRef.current.addSeries(LineSeries, {
        color: "#FFD54F",
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: true,
        lastValueVisible: true,
        crosshairMarkerVisible: false,
      });

      const candleData = allCandles.current;
      if (candleData.length < 2) return;

      const lineData: LineData<Time>[] = [
        { time: candleData[0].time, value: price },
        { time: candleData[candleData.length - 1].time, value: price },
      ];

      lineSeries.setData(lineData);

      const id = `hline-${Date.now()}`;
      setAnnotations((prev) => [
        ...prev,
        { id, type: "hline", data: { price }, seriesRef: lineSeries },
      ]);
    },
    []
  );

  // Add trend line
  const addTrendLine = useCallback(() => {
    if (!chartRef.current) return;

    const lineSeries = chartRef.current.addSeries(LineSeries, {
      color: "#00C805",
      lineWidth: 2,
      lineStyle: 0,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    const candleData = allCandles.current;
    if (candleData.length < 2) return;

    // Use visible range for trend line endpoints
    const visibleRange = chartRef.current.timeScale().getVisibleRange();
    let startCandle = candleData[0];
    let endCandle = candleData[candleData.length - 1];

    if (visibleRange) {
      const fromStr = visibleRange.from as string;
      const toStr = visibleRange.to as string;
      const visibleStart = candleData.find(c => (c.time as string) >= fromStr);
      const visibleEnd = [...candleData].reverse().find(c => (c.time as string) <= toStr);
      if (visibleStart) startCandle = visibleStart;
      if (visibleEnd) endCandle = visibleEnd;
    }

    const lineData: LineData<Time>[] = [
      { time: startCandle.time, value: startCandle.open },
      { time: endCandle.time, value: endCandle.close },
    ];

    lineSeries.setData(lineData);

    const id = `trend-${Date.now()}`;
    setAnnotations((prev) => [
      ...prev,
      { id, type: "trendline", data: {}, seriesRef: lineSeries },
    ]);
  }, []);

  // Add text marker
  const addTextMarker = useCallback(
    (text: string) => {
      if (!candlestickSeriesRef.current) return;

      const candleData = allCandles.current;
      if (candleData.length === 0) return;

      const newMarker: SeriesMarker<Time> = {
        time: candleData[candleData.length - 1].time,
        position: "aboveBar",
        color: "#FFD54F",
        shape: "arrowDown",
        text: text,
      };

      markersRef.current = [...markersRef.current, newMarker];
      (candlestickSeriesRef.current as any).setMarkers(markersRef.current);

      const id = `text-${Date.now()}`;
      setAnnotations((prev) => [
        ...prev,
        { id, type: "text", data: { text } },
      ]);
    },
    []
  );

  // Clear all annotations
  const clearAnnotations = useCallback(() => {
    annotations.forEach((ann) => {
      if (ann.seriesRef && chartRef.current) {
        chartRef.current.removeSeries(ann.seriesRef);
      }
    });
    if (candlestickSeriesRef.current) {
      markersRef.current = [];
      (candlestickSeriesRef.current as any).setMarkers([]);
    }
    setAnnotations([]);
  }, [annotations]);

  const handleToolClick = (tool: DrawingTool) => {
    if (tool === "trendline") {
      addTrendLine();
      setActiveTool("pointer");
    } else if (tool === "hline") {
      setShowHlineInput(true);
      setActiveTool(tool);
    } else if (tool === "text") {
      setShowTextInput(true);
      setActiveTool(tool);
    } else {
      setActiveTool(tool);
    }
  };

  const tools = [
    { id: "pointer" as DrawingTool, icon: MousePointer, label: "Select" },
    { id: "trendline" as DrawingTool, icon: TrendingUp, label: "Trend Line" },
    { id: "hline" as DrawingTool, icon: Minus, label: "Horizontal Line" },
    { id: "text" as DrawingTool, icon: Type, label: "Text Label" },
  ];

  return (
    <div className="relative">
      {/* Drawing toolbar */}
      <div className="flex items-center gap-1 mb-3">
        <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-1">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool.id)}
              title={tool.label}
              className={`p-1.5 rounded-md transition-all ${
                activeTool === tool.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <tool.icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        {annotations.length > 0 && (
          <button
            onClick={clearAnnotations}
            title="Clear all annotations"
            className="p-1.5 rounded-md text-muted-foreground hover:text-[#FF5252] hover:bg-secondary transition-all ml-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {annotations.length > 0 && (
          <span className="text-[10px] text-muted-foreground ml-2 font-[var(--font-mono)]">
            {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
          </span>
        )}

        <div className="flex-1" />
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-[var(--font-mono)]">
          <Pencil className="w-3 h-3" />
          Draw on chart
        </div>
      </div>

      {/* Horizontal line input popover */}
      {showHlineInput && (
        <div className="absolute top-10 left-0 z-20 bg-card border border-border rounded-lg p-3 shadow-xl">
          <p className="text-xs text-muted-foreground mb-2">
            Enter price for horizontal line:
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              value={hlinePrice}
              onChange={(e) => setHlinePrice(e.target.value)}
              placeholder="e.g. 50.00"
              className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground font-[var(--font-mono)] w-24 focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = parseFloat(hlinePrice);
                  if (!isNaN(val)) {
                    addHorizontalLine(val);
                    setHlinePrice("");
                    setShowHlineInput(false);
                    setActiveTool("pointer");
                  }
                }
              }}
            />
            <button
              onClick={() => {
                const val = parseFloat(hlinePrice);
                if (!isNaN(val)) {
                  addHorizontalLine(val);
                  setHlinePrice("");
                  setShowHlineInput(false);
                  setActiveTool("pointer");
                }
              }}
              className="px-2 py-1 bg-primary text-primary-foreground text-xs font-bold rounded"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowHlineInput(false);
                setActiveTool("pointer");
              }}
              className="px-2 py-1 bg-secondary text-muted-foreground text-xs rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Text input popover */}
      {showTextInput && (
        <div className="absolute top-10 left-0 z-20 bg-card border border-border rounded-lg p-3 shadow-xl">
          <p className="text-xs text-muted-foreground mb-2">
            Enter text annotation:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="e.g. Support level"
              className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground font-[var(--font-mono)] w-36 focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && textInput.trim()) {
                  addTextMarker(textInput.trim());
                  setTextInput("");
                  setShowTextInput(false);
                  setActiveTool("pointer");
                }
              }}
            />
            <button
              onClick={() => {
                if (textInput.trim()) {
                  addTextMarker(textInput.trim());
                  setTextInput("");
                  setShowTextInput(false);
                  setActiveTool("pointer");
                }
              }}
              className="px-2 py-1 bg-primary text-primary-foreground text-xs font-bold rounded"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowTextInput(false);
                setActiveTool("pointer");
              }}
              className="px-2 py-1 bg-secondary text-muted-foreground text-xs rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Chart container */}
      <div
        ref={chartContainerRef}
        style={{ width: "100%", height: 400 }}
      />
    </div>
  );
}
