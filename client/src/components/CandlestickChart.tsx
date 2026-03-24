/*
 * CandlestickChart: TradingView-style chart using lightweight-charts v5.
 * Converts LP data into OHLC candlestick format with price ($) values.
 * Includes drawing/annotation tools: trend lines, horizontal lines, text markers.
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
import { getDataForRange, totalLPToPrice, type TimeRange, type LPDataPoint } from "@/lib/playerData";
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
}

// Convert LP data to OHLC candlestick format with price values
function generateCandlestickData(data: LPDataPoint[]): CandlestickData<Time>[] {
  const result: CandlestickData<Time>[] = [];
  const startDate = new Date(2025, 8, 23); // Sep 23, 2025

  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    const prev = i > 0 ? data[i - 1] : null;

    const closePrice = point.price ?? totalLPToPrice(point.totalLP);
    const openPrice = prev ? (prev.price ?? totalLPToPrice(prev.totalLP)) : closePrice - 0.5;

    // Simulate intraday volatility
    const volatility = Math.abs(closePrice - openPrice) * 0.3 + 0.5;
    const high = Math.max(openPrice, closePrice) + Math.random() * volatility;
    const low = Math.min(openPrice, closePrice) - Math.random() * volatility;

    // Generate a proper date string
    const dayDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = dayDate.toISOString().split("T")[0];

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
  const startDate = new Date(2025, 8, 23);
  return data.map((point, i) => {
    const prev = i > 0 ? data[i - 1] : null;
    const change = prev ? point.totalLP - prev.totalLP : 0;
    const dayDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = dayDate.toISOString().split("T")[0];

    return {
      time: dateStr as Time,
      value: Math.abs(change) * 0.5 + Math.random() * 5 + 2,
      color: change >= 0 ? "rgba(0, 200, 5, 0.3)" : "rgba(255, 82, 82, 0.3)",
    };
  });
}

type DrawingTool = "pointer" | "trendline" | "hline" | "text";

interface Annotation {
  id: string;
  type: "trendline" | "hline" | "text";
  data: any;
  seriesRef?: ISeriesApi<any>;
}

export default function CandlestickChart({ timeRange = "1M" }: CandlestickChartProps) {
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

  const rawData = getDataForRange(timeRange);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

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
      },
      handleScroll: { vertTouchDrag: false },
    });

    // Candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00C805",
      downColor: "#FF5252",
      borderDownColor: "#FF5252",
      borderUpColor: "#00C805",
      wickDownColor: "#FF5252",
      wickUpColor: "#00C805",
    });

    const candleData = generateCandlestickData(rawData);
    candlestickSeries.setData(candleData);

    // Volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const volumeData = generateVolumeData(rawData);
    volumeSeries.setData(volumeData);

    chart.timeScale().fitContent();

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
  }, [timeRange]);

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

      const candleData = generateCandlestickData(rawData);
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
    [rawData]
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

    const candleData = generateCandlestickData(rawData);
    if (candleData.length < 2) return;

    const lineData: LineData<Time>[] = [
      { time: candleData[0].time, value: candleData[0].open },
      { time: candleData[candleData.length - 1].time, value: candleData[candleData.length - 1].close },
    ];

    lineSeries.setData(lineData);

    const id = `trend-${Date.now()}`;
    setAnnotations((prev) => [
      ...prev,
      { id, type: "trendline", data: {}, seriesRef: lineSeries },
    ]);
  }, [rawData]);

  // Add text marker
  const addTextMarker = useCallback(
    (text: string) => {
      if (!candlestickSeriesRef.current) return;

      const candleData = generateCandlestickData(rawData);
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
    [rawData]
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
                  ? "bg-primary text-black"
                  : "text-muted-foreground hover:text-white hover:bg-secondary"
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
              className="bg-secondary border border-border rounded px-2 py-1 text-xs text-white font-[var(--font-mono)] w-24 focus:outline-none focus:ring-1 focus:ring-primary"
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
              className="px-2 py-1 bg-primary text-black text-xs font-bold rounded"
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
              className="bg-secondary border border-border rounded px-2 py-1 text-xs text-white font-[var(--font-mono)] w-36 focus:outline-none focus:ring-1 focus:ring-primary"
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
              className="px-2 py-1 bg-primary text-black text-xs font-bold rounded"
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
