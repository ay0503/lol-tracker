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
  createSeriesMarkers,
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

interface TradeMarkerData {
  id: number;
  ticker: string;
  type: string; // buy, sell, short, cover
  shares: number;
  pricePerShare: number;
  totalAmount: number;
  createdAt: string | null;
}

interface CandlestickChartProps {
  timeRange?: TimeRange;
  onVisibleRangeChange?: (range: TimeRange | null) => void;
  ticker?: string;
  trades?: TradeMarkerData[];
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

/**
 * Metadata for each candle: original timestamp and day boundary info.
 * Used for custom tick formatting and day separator markers.
 */
interface CandleMeta {
  originalTs: number;
  isNewDay: boolean;
  dayLabel: string;
  timeGapHours: number; // hours since previous candle, 0 if first
}

// ─── Generate candle data using Unix timestamps (seconds) ───
// Groups data points into buckets based on the interval.
// For non-intraday: filters out flat/no-change candles and uses sequential
// fake timestamps (1-day apart) to compress dead time.
function generateCandleData(
  data: ETFHistoryPoint[],
  intervalMs: number,
  isIntraday: boolean
): { candles: CandlestickData<Time>[]; meta: CandleMeta[] } {
  if (data.length === 0) return { candles: [], meta: [] };

  const buckets = new Map<number, ETFHistoryPoint[]>();

  for (const point of data) {
    const bucketKey = Math.floor(point.timestamp / intervalMs) * intervalMs;
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
    buckets.get(bucketKey)!.push(point);
  }

  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

  // First pass: generate raw OHLC per bucket
  const rawBuckets: { open: number; close: number; high: number; low: number; ts: number }[] = [];
  let prevClose: number | null = null;

  for (const key of sortedKeys) {
    const points = buckets.get(key)!;
    const prices = points.map(p => p.price);

    const open = prevClose ?? prices[0];
    const close = prices[prices.length - 1];
    const high = Math.max(...prices, open, close);
    const low = Math.min(...prices, open, close);

    rawBuckets.push({ open, close, high, low, ts: key });
    prevClose = close;
  }

  // Second pass: merge consecutive flat candles (same open & close price)
  // This collapses idle periods where price doesn't change into a single candle
  const merged: typeof rawBuckets = [];
  for (const bucket of rawBuckets) {
    const prev = merged[merged.length - 1];
    const isFlat = Math.abs(bucket.close - bucket.open) < 0.005 &&
                   Math.abs(bucket.high - bucket.low) < 0.005;
    const prevIsFlat = prev &&
                       Math.abs(prev.close - prev.open) < 0.005 &&
                       Math.abs(bucket.close - prev.close) < 0.005;

    if (prev && isFlat && prevIsFlat) {
      // Extend previous candle's timestamp to latest, keep same price
      prev.ts = bucket.ts;
      prev.close = bucket.close;
    } else {
      merged.push({ ...bucket });
    }
  }

  // Third pass: build candle objects with simulated volatility only for non-flat candles
  const rawCandles: { candle: CandlestickData<Time>; originalTs: number }[] = [];
  for (const b of merged) {
    const hasMovement = Math.abs(b.close - b.open) >= 0.005 || Math.abs(b.high - b.low) >= 0.01;

    let adjustedHigh = b.high;
    let adjustedLow = b.low;

    if (hasMovement) {
      // Add small simulated volatility for visual interest on active candles
      const seed1 = Math.sin(b.ts * 0.0001 + 78.233) * 43758.5453;
      const rand1 = (seed1 - Math.floor(seed1)) * 0.3;
      const seed2 = Math.sin(b.ts * 0.0002 + 12.989) * 23421.6312;
      const rand2 = (seed2 - Math.floor(seed2)) * 0.3;
      adjustedHigh = b.high + rand1;
      adjustedLow = Math.max(b.low - rand2, 0.01);
    }

    const timeSec = Math.floor(b.ts / 1000) as unknown as Time;

    rawCandles.push({
      candle: {
        time: timeSec,
        open: Math.round(b.open * 100) / 100,
        high: Math.round(adjustedHigh * 100) / 100,
        low: Math.round(adjustedLow * 100) / 100,
        close: Math.round(b.close * 100) / 100,
      },
      originalTs: b.ts,
    });
  }

  // Filter out flat/barely-change candles for all views.
  // Use a dynamic threshold based on the overall price range.
  const allPrices = rawCandles.flatMap(rc => [rc.candle.open, rc.candle.close, rc.candle.high, rc.candle.low]);
  const priceRange = Math.max(...allPrices) - Math.min(...allPrices);
  const dynamicThreshold = Math.max(0.005, priceRange * 0.01); // 1% of total range, min $0.005

  const filtered = rawCandles.filter(rc => {
    const c = rc.candle;
    const range = c.high - c.low;
    const change = Math.abs(c.close - c.open);
    return range > dynamicThreshold || change > dynamicThreshold;
  });

  // Keep at least some candles — if filtering removed too many, use originals
  const toUse = filtered.length >= 3 ? filtered : rawCandles;

  // Helper to compute time gap in hours from previous candle
  function buildMeta(items: typeof toUse): CandleMeta[] {
    const meta: CandleMeta[] = [];
    let prevDay = "";
    for (let i = 0; i < items.length; i++) {
      const rc = items[i];
      const d = new Date(rc.originalTs);
      const day = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const gapMs = i > 0 ? rc.originalTs - items[i - 1].originalTs : 0;
      meta.push({
        originalTs: rc.originalTs,
        isNewDay: day !== prevDay,
        dayLabel: `${d.getMonth() + 1}/${d.getDate()}`,
        timeGapHours: gapMs / (1000 * 60 * 60),
      });
      prevDay = day;
    }
    return meta;
  }

  if (isIntraday) {
    return { candles: toUse.map(rc => rc.candle), meta: buildMeta(toUse) };
  }

  // Reassign sequential fake timestamps (1 day apart) to compress gaps
  const BASE_TS = new Date(2020, 0, 1).getTime() / 1000;
  const DAY_SEC = 86400;

  const result: CandlestickData<Time>[] = [];
  for (let i = 0; i < toUse.length; i++) {
    const rc = toUse[i];
    const fakeTime = (BASE_TS + i * DAY_SEC) as unknown as Time;
    result.push({ ...rc.candle, time: fakeTime });
  }

  return { candles: result, meta: buildMeta(toUse) };
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
  trades,
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
  const markersPluginRef = useRef<any>(null);
  const isSettingRangeRef = useRef(false);
  const allCandles = useRef<CandlestickData<Time>[]>([]);

  const isIntraday = INTRADAY_RANGES.has(timeRange);

  // Candle colors: green for up, red for down
  const upColor = "#00C805";
  const downColor = "#FF5252";

  // Fetch full ETF history from backend
  const { data: etfHistory, isLoading } = trpc.prices.etfHistory.useQuery(
    { ticker: ticker as any },
    { refetchInterval: 60_000, staleTime: 30_000 }
  );

  // Process data based on timeRange
  const { candles, volumes, candleMeta } = useMemo(() => {
    if (!etfHistory || etfHistory.length === 0) return { candles: [], volumes: [], candleMeta: [] };

    const cutoff = getRangeCutoffMs(timeRange);
    const filtered = etfHistory.filter(p => p.timestamp >= cutoff);

    // Use appropriate candle interval
    const intervalMs = INTRADAY_RANGES.has(timeRange)
      ? getCandleIntervalMs(timeRange)
      : 24 * 60 * 60 * 1000;

    const { candles: candleData, meta } = generateCandleData(
      filtered.length > 0 ? filtered : etfHistory,
      intervalMs,
      INTRADAY_RANGES.has(timeRange)
    );
    const volumeData = generateVolumeData(candleData);

    return { candles: candleData, volumes: volumeData, candleMeta: meta };
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
        timeVisible: isIntraday,
        secondsVisible: false,
        rightOffset: 2,
        barSpacing: isIntraday ? 12 : 10,
        minBarSpacing: isIntraday ? 6 : 5,
        // For compressed (non-intraday) charts, use custom tick formatter
        // that maps fake sequential timestamps back to real dates
        ...(isIntraday ? {} : {
          tickMarkFormatter: (time: Time) => {
            // Find the candle index from the fake timestamp
            const BASE_TS = new Date(2020, 0, 1).getTime() / 1000;
            const DAY_SEC = 86400;
            const idx = Math.round(((time as number) - BASE_TS) / DAY_SEC);
            const m = candleMeta[idx];
            if (!m) return "";
            const d = new Date(m.originalTs);
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            if (language === "ko") {
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }
            return `${months[d.getMonth()]} ${d.getDate()}`;
          },
        }),
      },
      handleScroll: { vertTouchDrag: false, mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
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

    // Add markers: zigzag for time gaps >4h, day separators for non-intraday
    {
      const markers: SeriesMarker<Time>[] = [];
      const TIME_GAP_THRESHOLD = 4; // hours

      for (let i = 0; i < candleMeta.length; i++) {
        const m = candleMeta[i];

        // Zigzag marker for time gaps >4 hours
        if (m.timeGapHours >= TIME_GAP_THRESHOLD) {
          const gapLabel = m.timeGapHours >= 24
            ? `${Math.round(m.timeGapHours / 24)}d`
            : `${Math.round(m.timeGapHours)}h`;
          markers.push({
            time: candles[i].time,
            position: "belowBar",
            color: "rgba(107, 114, 128, 0.5)",
            shape: "square",
            text: gapLabel,
          });
        }
        // Day separator for non-intraday compressed charts
        else if (!isIntraday && m.isNewDay && i > 0) {
          markers.push({
            time: candles[i].time,
            position: "belowBar",
            color: "rgba(107, 114, 128, 0.6)",
            shape: "square",
            text: "",
          });
        }
      }

      // ─── Trade markers ───
      if (trades && trades.length > 0) {
        const cutoff = getRangeCutoffMs(timeRange);
        const tickerTrades = trades.filter(tr => tr.ticker === ticker && tr.createdAt);

        for (const trade of tickerTrades) {
          const tradeTs = new Date(trade.createdAt!).getTime();
          if (tradeTs < cutoff) continue;

          // Find closest candle by timestamp
          let bestIdx = -1;
          let bestDist = Infinity;
          for (let ci = 0; ci < candleMeta.length; ci++) {
            const dist = Math.abs(candleMeta[ci].originalTs - tradeTs);
            if (dist < bestDist) {
              bestDist = dist;
              bestIdx = ci;
            }
          }
          if (bestIdx < 0 || bestIdx >= candles.length) continue;

          const isBuy = trade.type === "buy" || trade.type === "cover";
          const label = trade.type === "buy" ? "B"
            : trade.type === "sell" ? "S"
            : trade.type === "short" ? "SH"
            : "CV";

          markers.push({
            time: candles[bestIdx].time,
            position: isBuy ? "belowBar" : "aboveBar",
            color: isBuy ? "#00C805" : "#FF5252",
            shape: isBuy ? "arrowUp" : "arrowDown",
            text: `${label} ${trade.shares.toFixed(1)}`,
          });
        }
      }

      // Sort markers by time (required by lightweight-charts)
      markers.sort((a, b) => (a.time as number) - (b.time as number));

      if (markers.length > 0) {
        markersPluginRef.current = createSeriesMarkers(candlestickSeries, markers);
        markersRef.current = markers;
      }
    }

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

    // Smart zoom for intraday: scroll to the region with the most price movement
    if (isIntraday && candles.length > 5) {
      const prices = candles.map(c => c.close);
      const totalRange = Math.max(...prices) - Math.min(...prices);
      if (totalRange > 0.01) {
        const threshold = totalRange * 0.05;
        const basePrice = prices[0];
        let firstChangeIdx = 0;
        let lastChangeIdx = candles.length - 1;

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

        const activeLen = lastChangeIdx - firstChangeIdx;
        const buffer = Math.max(1, Math.floor(activeLen * 0.15));
        const startIdx = Math.max(0, firstChangeIdx - buffer);
        const endIdx = Math.min(candles.length - 1, lastChangeIdx + buffer);

        // Only zoom if we'd skip a significant flat portion (>30% of candles)
        if ((endIdx - startIdx + 1) < candles.length * 0.7) {
          chart.timeScale().setVisibleLogicalRange({
            from: startIdx,
            to: endIdx,
          });
        }
      }
    }

    // Listen for visible range changes to sync UI pills
    // Disable auto-detection briefly after chart init to prevent feedback loops
    // (fitContent triggers visibleRangeChange which could override user's selection)
    let suppressDetection = true;
    const suppressTimer = setTimeout(() => { suppressDetection = false; }, 500);
    if (onVisibleRangeChange) {
      chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
        if (suppressDetection || isSettingRangeRef.current) return;
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
      clearTimeout(suppressTimer);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [ticker, language, candles, volumes, isIntraday, candleMeta, trades]);

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
      // Use createSeriesMarkers plugin API
      if (markersPluginRef.current) {
        markersPluginRef.current.setMarkers(markersRef.current);
      } else if (candlestickSeriesRef.current) {
        markersPluginRef.current = createSeriesMarkers(candlestickSeriesRef.current, markersRef.current);
      }

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
    if (markersPluginRef.current) {
      markersPluginRef.current.setMarkers([]);
      markersRef.current = [];
    } else {
      markersRef.current = [];
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
