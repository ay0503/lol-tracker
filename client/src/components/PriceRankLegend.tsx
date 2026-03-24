/**
 * PriceRankLegend: Visual legend mapping stock price ranges to League of Legends ranks.
 * Shows a horizontal gradient bar with tier segments and a current price marker.
 *
 * Price mapping: Platinum 4 (0 LP) = $10 → Diamond 1 (100 LP) = $100
 * Each tier has 4 divisions of 100 LP each = 400 LP per tier = $30 per tier
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { totalLPToPrice, LP_HISTORY } from "@/lib/playerData";
import { Info } from "lucide-react";

// Tier definitions with price ranges and colors
function getTiers(t: any) {
  return [
    {
      name: t.legend.platinum,
      shortName: t.legend.platShort,
      divisions: ["IV", "III", "II", "I"],
      startPrice: 10,
      endPrice: 40,
      color: "#4FA68D",
      bgColor: "rgba(79, 166, 141, 0.15)",
      borderColor: "rgba(79, 166, 141, 0.4)",
    },
    {
      name: t.legend.emerald,
      shortName: t.legend.emShort,
      divisions: ["IV", "III", "II", "I"],
      startPrice: 40,
      endPrice: 70,
      color: "#00C805",
      bgColor: "rgba(0, 200, 5, 0.15)",
      borderColor: "rgba(0, 200, 5, 0.4)",
    },
    {
      name: t.legend.diamond,
      shortName: t.legend.diaShort,
      divisions: ["IV", "III", "II", "I"],
      startPrice: 70,
      endPrice: 100,
      color: "#B9F2FF",
      bgColor: "rgba(185, 242, 255, 0.15)",
      borderColor: "rgba(185, 242, 255, 0.4)",
    },
  ];
}

const MIN_PRICE = 10;
const MAX_PRICE = 100;

export default function PriceRankLegend() {
  const { t } = useTranslation();

  const TIERS = useMemo(() => getTiers(t), [t]);

  const { data: latestPrice } = trpc.prices.latest.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const currentPrice = latestPrice
    ? parseFloat(latestPrice.price)
    : totalLPToPrice(LP_HISTORY[LP_HISTORY.length - 1]?.totalLP ?? 0);

  // Calculate marker position as percentage
  const markerPct = useMemo(() => {
    const clamped = Math.max(MIN_PRICE, Math.min(currentPrice, MAX_PRICE));
    return ((clamped - MIN_PRICE) / (MAX_PRICE - MIN_PRICE)) * 100;
  }, [currentPrice]);

  // Find which tier the current price is in
  const currentTier = useMemo(() => {
    return TIERS.find(
      (tier) => currentPrice >= tier.startPrice && currentPrice < tier.endPrice
    ) || TIERS[TIERS.length - 1];
  }, [currentPrice, TIERS]);

  // Calculate which division within the tier
  const currentDivision = useMemo(() => {
    const tierRange = currentTier.endPrice - currentTier.startPrice;
    const divSize = tierRange / 4;
    const offset = currentPrice - currentTier.startPrice;
    const divIdx = Math.min(3, Math.floor(offset / divSize));
    return currentTier.divisions[divIdx];
  }, [currentPrice, currentTier]);

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-secondary">
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground font-[var(--font-heading)]">
              {t.legend.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t.legend.subtitle}
            </p>
          </div>
        </div>
        <div
          className="text-xs font-semibold font-[var(--font-mono)] px-2 py-1 rounded-md"
          style={{
            color: currentTier.color,
            backgroundColor: currentTier.bgColor,
          }}
        >
          {currentTier.name} {currentDivision}
        </div>
      </div>

      {/* Tier bar visualization */}
      <div className="relative">
        {/* Tier segments */}
        <div className="flex rounded-lg overflow-hidden h-10 border border-border">
          {TIERS.map((tier, idx) => {
            const widthPct =
              ((tier.endPrice - tier.startPrice) / (MAX_PRICE - MIN_PRICE)) *
              100;
            return (
              <div
                key={tier.name}
                className="relative flex items-center justify-center transition-all"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: tier.bgColor,
                  borderRight:
                    idx !== TIERS.length - 1
                      ? `1px solid ${tier.borderColor}`
                      : "none",
                }}
              >
                <span
                  className="text-xs font-bold font-[var(--font-heading)] hidden sm:inline"
                  style={{ color: tier.color }}
                >
                  {tier.name}
                </span>
                <span
                  className="text-xs font-bold font-[var(--font-heading)] sm:hidden"
                  style={{ color: tier.color }}
                >
                  {tier.shortName}
                </span>
              </div>
            );
          })}
        </div>

        {/* Current price marker */}
        <div
          className="absolute top-0 h-10 flex flex-col items-center pointer-events-none"
          style={{
            left: `${markerPct}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div
            className="w-0.5 h-full"
            style={{ backgroundColor: currentTier.color }}
          />
        </div>

        {/* Marker label above */}
        <div
          className="absolute -top-6 flex flex-col items-center pointer-events-none"
          style={{
            left: `${markerPct}%`,
            transform: "translateX(-50%)",
          }}
        >
          <span
            className="text-[10px] font-bold font-[var(--font-mono)] px-1.5 py-0.5 rounded"
            style={{
              color: currentTier.color,
              backgroundColor: currentTier.bgColor,
            }}
          >
            ${currentPrice.toFixed(2)}
          </span>
        </div>

        {/* Price labels below */}
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-muted-foreground font-[var(--font-mono)]">
            $10
          </span>
          <span
            className="text-[10px] font-[var(--font-mono)]"
            style={{ color: TIERS[0].color, opacity: 0.7 }}
          >
            $40
          </span>
          <span
            className="text-[10px] font-[var(--font-mono)]"
            style={{ color: TIERS[1].color, opacity: 0.7 }}
          >
            $70
          </span>
          <span className="text-[10px] text-muted-foreground font-[var(--font-mono)]">
            $100
          </span>
        </div>
      </div>

      {/* Division breakdown table */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className="rounded-lg p-2.5"
            style={{
              backgroundColor: tier.bgColor,
              border: `1px solid ${tier.borderColor}`,
            }}
          >
            <p
              className="text-[11px] font-bold font-[var(--font-heading)] mb-1.5"
              style={{ color: tier.color }}
            >
              {tier.name}
            </p>
            <div className="space-y-0.5">
              {tier.divisions.map((div, i) => {
                const divPrice =
                  tier.startPrice +
                  (i * (tier.endPrice - tier.startPrice)) / 4;
                const divEndPrice =
                  tier.startPrice +
                  ((i + 1) * (tier.endPrice - tier.startPrice)) / 4;
                const isCurrentDiv =
                  currentPrice >= divPrice && currentPrice < divEndPrice;
                return (
                  <div
                    key={div}
                    className={`flex items-center justify-between text-[10px] font-[var(--font-mono)] px-1.5 py-0.5 rounded ${
                      isCurrentDiv
                        ? "bg-background/50 font-bold"
                        : "opacity-60"
                    }`}
                  >
                    <span
                      style={{
                        color: isCurrentDiv
                          ? tier.color
                          : "var(--muted-foreground)",
                      }}
                    >
                      {div}
                    </span>
                    <span
                      style={{
                        color: isCurrentDiv
                          ? tier.color
                          : "var(--muted-foreground)",
                      }}
                    >
                      ${divPrice.toFixed(0)}–${divEndPrice.toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Formula note */}
      <p className="text-[10px] text-muted-foreground mt-3 text-center font-[var(--font-mono)]">
        {t.legend.formula}
      </p>
    </div>
  );
}
