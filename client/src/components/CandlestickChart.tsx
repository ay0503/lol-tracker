/*
 * CandlestickChart: TradingView-style chart using lightweight-charts v5.
 * Converts backend ETF price history into OHLC candlestick format.
 * Supports all tickers: DORI, DDRI, TDRI, SDRI, XDRI.
 * Includes drawing/annotation tools: trend lines, horizontal lines, text markers.
 * Supports intraday (3H/6H/1D) and daily+ timeframes.
 */
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
import { trpc } from "@/lib/trpc";
import {
  Minus,
  TrendingUp,
  Type,
  Trash2,
  MousePointer,
  Pencil,
  Loader2,
} from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

type TimeRange = "3H" | "6H" | "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "ALL";

const TICKER_COLORS: Record<string, { color: string; inverse: boolean }> = {
  DORI: { color: "#00C805", inverse: false },
  DDRI: { color: "#4CAF50", inverse: false },
  TDRI: { color: "#8BC34A", inverse: false },
  SDRI: { color: "#FF5252", inverse: true },
  XDRI: { color: "#FF1744", inverse: true },
};

const INTRADAY_RANGES = new Set<TimeRange>(["3H", "6H", "1D"]);

interface CandlestickChartProps {
  timeRange?: TimeRange;
  onVisibleRangeChange?: (range: TimeRange | null) => void;
  ticker?: string;
}

interface ETFHistoryPoint {
  timestamp: number;
  price: number;
  tier: string;
  division: string;
  lp: number;
  totalLP: number;
}

// ─── Candle interval in ms for each intraday range ───
function getCandleIntervalMs(range: TimeRange): number {
  switch (range) {
    case "3H": return 10 * 60 * 1000;  // 10-minute candles
    case "6H": return 15 * 60 * 1000;  // 15-minute candles
    case "1D": return 30 * 60 * 1000;  // 30-minute candles
    default: return 24 * 60 * 60 * 1000; // daily candles
  }
}

// ─── Get the time cutoff for a range ───
function getRangeCutoffMs(range: TimeRange): number {
  const now = Date.now();
  switch (range) {
    case "3H": return now - 3 * 60 * 60 * 1000;
    case "6H": return now - 6 * 60 * 60 * 1000;
    case "1D": return now - 24 * 60 * 60 * 1000;
    case "1W": return now - 7 * 24 * 60 * 60 * 1000;
    case "1M": return now - 30 * 24 * 60 * 60 * 1000;
    case "3M": return now - 90 * 24 * 60 * 60 * 1000;
    case "6M": return now - 180 * 24 * 60 * 60 * 1000;
    case "YTD": {
      const jan1 = new Date(new Date().getFullYear(), 0, 1).getTime();
      return jan1;
    }
    case "ALL": return 0;
    default: return now - 30 * 24 * 60 * 60 * 1000;
  }
}

// ─── Generate candle data using Unix timestamps (seconds) ───
// Groups data points into buckets based on the interval
function generateCandleData(
  data: ETFHistoryPoint[],
  intervalMs: number
): CandlestickData<Time>[] {
  if (data.length === 0) return [];

  const buckets = new Map<number, ETFHistoryPoint[]>();

  for (const point of data) {
    // Floor timestamp to the interval bucket
    const bucketKey = Math.floor(point.timestamp / intervalMs) * intervalMs;
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
    buckets.get(bucketKey)!.push(point);
  }

  // Sort bucket keys chronologically
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

  const result: CandlestickData<Time>[] = [];
  let prevClose: number | null = null;

  for (const key of sortedKeys) {
    const points = buckets.get(key)!;
    const prices = points.map(p => p.price);

    const open = prevClose ?? prices[0];
    const close = prices[prices.length - 1];
    const high = Math.max(...prices, open, close);
    const low = Math.min(...prices, open, close);

    // Add small simulated volatility for visual interest
    const seed1 = Math.sin(key * 0.0001 + 78.233) * 43758.5453;
    const rand1 = (seed1 - Math.floor(seed1)) * 0.3;
    const seed2 = Math.sin(key * 0.0002 + 12.989) * 23421.6312;
    const rand2 = (seed2 - Math.floor(seed2)) * 0.3;

    const adjustedHigh = high + rand1;
    const adjustedLow = Math.max(low - rand2, 0.01);

    // lightweight-charts expects Unix timestamp in SECONDS for UTCTimestamp
    const timeSec = Math.floor(key / 1000) as unknown as Time;

    result.push({
      time: timeSec,
      open: Math.round(open * 100) / 100,
      high: Math.round(adjustedHigh * 100) / 100,
      low: Math.round(adjustedLow * 100) / 100,
      close: Math.round(close * 100) / 100,
    });

    prevClose = close;
  }

  return result;
}

// ─── Generate volume data ───
function generateVolumeData(candles: CandlestickData<Time>[]) {
  return candles.map((candle, i) => {
    const change = candle.close - candle.open;
    const seed = Math.sin(i * 7.234 + 3.456) * 12345.6789;
    const rand = seed - Math.floor(seed);

    return {
      time: candle.time,
      value: Math.abs(change) * 0.5 + rand * 5 + 2,
      color: change >= 0 ? "rgba(0, 200, 5, 0.3)" : "rgba(255, 82, 82, 0.3)",
    };
  });
}

// Determine which time range label best matches a visible range span
function detectTimeRange(visibleBars: number, isIntraday: boolean): TimeRange | null {
  if (isIntraday) return null; // Don't auto-detect for intraday
  if (visibleBars <= 9) return "1W";
  if (visibleBars <= 40) return "1M";
  if (visibleBars <= 100) return "3M";
  if (visibleBars <= 190) return "6M";
  return "ALL";
}

type DrawingTool = "pointer" | "trendline" | "hline" | "text";

interface Annotation {
  id: string;
  type: "trendline" | "hline" | "text";
  data: any;
  seriesRef?: ISeriesApi<any>;
}

export default function CandlestickChart({
  timeRange = "1M",
  onVisibleRangeChange,
  ticker = "DORI",
}: CandlestickChartProps) {
  const { t, language } = useTranslation();
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
  const allCandles = useRef<CandlestickData<Time>[]>([]);

  const isIntraday = INTRADAY_RANGES.has(timeRange);

  // Candle colors: green for up, red for down
  const upColor = "#00C805";
  const downColor = "#FF5252";

  // Fetch full ETF history from backend
  const { data: etfHistory, isLoading } = trpc.prices.etfHistory.useQuery(
    { ticker: ticker as any },
    { refetchInterval: 30_000, staleTime: 15_000 }
  );

  // Process data based on timeRange
  const { candles, volumes } = useMemo(() => {
    if (!etfHistory || etfHistory.length === 0) return { candles: [], volumes: [] };

    const cutoff = getRangeCutoffMs(timeRange);
    const filtered = etfHistory.filter(p => p.timestamp >= cutoff);

    // Use appropriate candle interval
    const intervalMs = INTRADAY_RANGES.has(timeRange)
      ? getCandleIntervalMs(timeRange)
      : 24 * 60 * 60 * 1000;

    const candleData = generateCandleData(
      filtered.length > 0 ? filtered : etfHistory,
      intervalMs
    );
    const volumeData = generateVolumeData(candleData);

    return { candles: candleData, volumes: volumeData };
  }, [etfHistory, timeRange]);

  // Initialize chart — recreate when ticker, language, timeRange, or data changes
  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

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
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
        barSpacing: isIntraday ? 12 : 8,
        minBarSpacing: isIntraday ? 6 : 4,
      },
      handleScroll: { vertTouchDrag: false },
    });

    // Candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderDownColor: downColor,
      borderUpColor: upColor,
      wickDownColor: downColor,
      wickUpColor: upColor,
    });

    allCandles.current = candles;
    candlestickSeries.setData(candles);

    // Volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    volumeSeries.setData(volumes);

    // Fit content to show all candles
    chart.timeScale().fitContent();

    // Listen for visible range changes to sync UI pills
    if (onVisibleRangeChange) {
      chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
        if (isSettingRangeRef.current) return;
        if (!logicalRange) return;
        const visibleBars = Math.round(logicalRange.to - logicalRange.from);
        const detected = detectTimeRange(visibleBars, isIntraday);
        if (detected) onVisibleRangeChange(detected);
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
  }, [ticker, language, candles, volumes, isIntraday]);

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
      color: upColor,
      lineWidth: 2,
      lineStyle: 0,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    const candleData = allCandles.current;
    if (candleData.length < 2) return;

    const startCandle = candleData[0];
    const endCandle = candleData[candleData.length - 1];

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
  }, [upColor]);

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
    { id: "pointer" as DrawingTool, icon: MousePointer, label: t.chart.toolSelect },
    { id: "trendline" as DrawingTool, icon: TrendingUp, label: t.chart.toolTrendLine },
    { id: "hline" as DrawingTool, icon: Minus, label: t.chart.toolHorizontalLine },
    { id: "text" as DrawingTool, icon: Type, label: t.chart.toolTextLabel },
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  // Empty state
  if (!etfHistory || etfHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
        <p className="text-sm">{t.common.noData}</p>
        <p className="text-xs mt-1">{t.common.waitingForData}</p>
      </div>
    );
  }

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
            title={t.chart.clearAnnotations}
            className="p-1.5 rounded-md text-muted-foreground hover:text-[#FF5252] hover:bg-secondary transition-all ml-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {annotations.length > 0 && (
          <span className="text-[10px] text-muted-foreground ml-2 font-[var(--font-mono)]">
            {annotations.length} {t.chart.annotationCount}
          </span>
        )}

        <div className="flex-1" />
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-[var(--font-mono)]">
          <Pencil className="w-3 h-3" />
          {t.chart.drawOnChart}
        </div>
      </div>

      {/* Horizontal line input popover */}
      {showHlineInput && (
        <div className="absolute top-10 left-0 z-20 bg-card border border-border rounded-lg p-3 shadow-xl">
          <p className="text-xs text-muted-foreground mb-2">
            {t.chart.enterPriceForHLine}
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              value={hlinePrice}
              onChange={(e) => setHlinePrice(e.target.value)}
              placeholder={t.chart.pricePlaceholder}
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
              {t.chart.add}
            </button>
            <button
              onClick={() => {
                setShowHlineInput(false);
                setActiveTool("pointer");
              }}
              className="px-2 py-1 bg-secondary text-muted-foreground text-xs rounded"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Text input popover */}
      {showTextInput && (
        <div className="absolute top-10 left-0 z-20 bg-card border border-border rounded-lg p-3 shadow-xl">
          <p className="text-xs text-muted-foreground mb-2">
            {t.chart.enterTextAnnotation}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={t.chart.textPlaceholder}
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
              {t.chart.add}
            </button>
            <button
              onClick={() => {
                setShowTextInput(false);
                setActiveTool("pointer");
              }}
              className="px-2 py-1 bg-secondary text-muted-foreground text-xs rounded"
            >
              {t.common.cancel}
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
