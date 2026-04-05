/**
 * StyledName — Renders a player name with equipped cosmetic effects.
 * Uses inline styles for gradients/glows/animations since dynamic Tailwind classes
 * from the DB don't get compiled by JIT.
 */
import { type CSSProperties } from "react";

// Static registry: maps cssClass patterns to inline styles for effects that
// Tailwind JIT can't generate from dynamic DB strings
const EFFECT_STYLES: Record<string, { className?: string; style?: CSSProperties }> = {
  // ─── Common: solid colors (these work as Tailwind classes) ───
  "text-red-500": { className: "text-red-500" },
  "text-blue-400": { className: "text-blue-400" },
  "text-green-600": { className: "text-green-600" },
  "text-purple-500": { className: "text-purple-500" },
  "text-amber-500": { className: "text-amber-500" },

  // ─── Rare: gradients (need inline styles) ───
  "sunset": {
    style: {
      background: "linear-gradient(to right, #f97316, #ec4899)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 8px rgba(251,146,60,0.5))",
      display: "inline-block",
    },
  },
  "ocean": {
    style: {
      background: "linear-gradient(to right, #2563eb, #22d3ee)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 8px rgba(34,211,238,0.5))",
      display: "inline-block",
    },
  },
  "toxic": {
    style: {
      background: "linear-gradient(to right, #a3e635, #16a34a)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 10px rgba(163,230,53,0.6))",
      display: "inline-block",
    },
  },
  "gold_rush": {
    className: "text-yellow-500",
    style: { filter: "drop-shadow(0 0 8px rgba(234,179,8,0.6))" },
  },
  "neon_pink": {
    className: "text-pink-400",
    style: { filter: "drop-shadow(0 0 10px rgba(244,114,182,0.8))" },
  },
  "ice_cold": {
    className: "text-cyan-300",
    style: { filter: "drop-shadow(0 0 12px rgba(103,232,249,0.7))" },
  },

  // ─── Epic: animated ───
  "rainbow": {
    className: "text-red-400",
    style: { animation: "rainbow 3s linear infinite" },
  },
  "shimmer": {
    style: {
      background: "linear-gradient(to right, #facc15, #eab308, #facc15)",
      backgroundSize: "200% 100%",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      animation: "shimmer 2s linear infinite",
      display: "inline-block",
    },
  },
  "inferno": {
    style: {
      background: "linear-gradient(to top, #dc2626, #f97316, #facc15)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 15px rgba(251,146,60,0.7))",
      display: "inline-block",
    },
  },
  "electric": {
    className: "text-blue-300",
    style: {
      filter: "drop-shadow(0 0 25px rgba(147,197,253,1))",
      animation: "lightning 0.5s ease-in-out infinite",
    },
  },

  // ─── Legendary: over-the-top ───
  "diamond": {
    style: {
      background: "linear-gradient(135deg, #bfdbfe, #dbeafe, #bfdbfe)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 30px rgba(255,255,255,1))",
      animation: "sparkle 3s linear infinite",
      display: "inline-block",
    },
  },
  "molten": {
    style: {
      background: "linear-gradient(to right, #ca8a04, #facc15, #ca8a04)",
      backgroundSize: "200% 100%",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 35px rgba(234,179,8,1))",
      animation: "flow 2s linear infinite",
      display: "inline-block",
    },
  },
  "cosmic": {
    style: {
      background: "linear-gradient(to right, #7e22ce, #ec4899, #7e22ce)",
      backgroundSize: "300% 100%",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 40px rgba(168,85,247,1))",
      animation: "cosmic 4s ease-in-out infinite",
      display: "inline-block",
    },
  },

  // ─── New Animated Effects ───
  "neon_pulse": {
    className: "text-cyan-400",
    style: { animation: "neon-pulse 1.5s ease-in-out infinite" },
  },
  "lava_flow": {
    style: {
      background: "linear-gradient(to right, #dc2626, #f97316, #dc2626)",
      backgroundSize: "200% 100%",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 25px rgba(239,68,68,0.8))",
      animation: "lava-flow 3s linear infinite",
      display: "inline-block",
    },
  },
  "glitch_matrix": {
    className: "text-green-400",
    style: {
      animation: "glitch-matrix 0.4s infinite",
      display: "inline-block",
    },
  },
  "frostbite": {
    className: "text-blue-200",
    style: { animation: "frostbite 2s ease-in-out infinite" },
  },
  "solar_flare": {
    style: {
      background: "linear-gradient(to right, #fef08a, #fef3c7, #fef08a)",
      backgroundSize: "200% 100%",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      animation: "solar-flare 2s ease-in-out infinite",
      display: "inline-block",
    },
  },
  "phantom_fade": {
    className: "text-purple-300",
    style: { animation: "phantom-fade 3s ease-in-out infinite" },
  },
  "toxic_drip": {
    style: {
      background: "linear-gradient(to bottom, #84cc16, #22c55e, #84cc16)",
      backgroundSize: "100% 200%",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 12px rgba(132,204,22,0.7))",
      animation: "toxic-drip 2.5s linear infinite",
      display: "inline-block",
    },
  },
  "arcane_runes": {
    className: "arcane-runes-effect",
  },
};

// Map DB cssClass strings to registry keys
function getEffectKey(cssClass: string): string | null {
  if (!cssClass) return null;
  // Simple color classes — pass through
  if (/^text-(red|blue|green|purple|amber)-\d+$/.test(cssClass.trim())) return cssClass.trim();
  // Match by keywords in cssClass
  const lower = cssClass.toLowerCase();
  if (lower.includes("from-orange") && lower.includes("to-pink")) return "sunset";
  if (lower.includes("from-blue") && lower.includes("to-cyan")) return "ocean";
  if (lower.includes("from-lime") && lower.includes("to-green")) return "toxic";
  if (lower.includes("text-yellow-500")) return "gold_rush";
  if (lower.includes("text-pink-400")) return "neon_pink";
  if (lower.includes("text-cyan-300")) return "ice_cold";
  if (lower.includes("rainbow")) return "rainbow";
  if (lower.includes("shimmer")) return "shimmer";
  if (lower.includes("from-red") && lower.includes("to-yellow")) return "inferno";
  if (lower.includes("lightning")) return "electric";
  if (lower.includes("sparkle") && !lower.includes("solar")) return "diamond";
  if (lower.includes("flow") && !lower.includes("lava")) return "molten";
  if (lower.includes("cosmic")) return "cosmic";
  if (lower.includes("neon") && lower.includes("pulse")) return "neon_pulse";
  if (lower.includes("lava")) return "lava_flow";
  if (lower.includes("glitch") || lower.includes("matrix")) return "glitch_matrix";
  if (lower.includes("frost")) return "frostbite";
  if (lower.includes("solar") || lower.includes("flare")) return "solar_flare";
  if (lower.includes("phantom")) return "phantom_fade";
  if (lower.includes("toxic") && lower.includes("drip")) return "toxic_drip";
  if (lower.includes("arcane") || lower.includes("runes")) return "arcane_runes";
  return null;
}

interface StyledNameProps {
  name: string;
  nameEffectCss?: string | null;
  titleName?: string | null;
  titleCss?: string | null;
  isCloseFriend?: boolean;
  className?: string;
  showTitle?: boolean;
}

export default function StyledName({
  name, nameEffectCss, titleName, titleCss, isCloseFriend, className = "", showTitle = true,
}: StyledNameProps) {
  const effectKey = nameEffectCss ? getEffectKey(nameEffectCss) : null;
  const effect = effectKey ? EFFECT_STYLES[effectKey] : null;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {isCloseFriend && (
        <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center" title="Close Friend">
          <span className="text-[11px] text-green-400">★</span>
        </span>
      )}
      <span
        className={`font-bold ${effect?.className || "text-current"}`}
        style={effect?.style}
      >
        {name}
      </span>
      {showTitle && titleName && (
        <TitleBadge name={titleName} cssClass={titleCss} />
      )}
    </span>
  );
}

export function TitleBadge({ name, cssClass }: { name: string; cssClass?: string | null }) {
  // Title badges use simple bg/text classes that Tailwind JIT handles fine
  // since they're common patterns (bg-zinc-800, bg-blue-950, bg-gradient-to-r, etc.)
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold leading-none whitespace-nowrap ${cssClass || "bg-zinc-800 text-zinc-400 border border-zinc-700"}`}>
      {name}
    </span>
  );
}

// For shop preview — renders effect at large size
export function EffectPreview({ name, cssClass }: { name: string; cssClass?: string | null }) {
  const effectKey = cssClass ? getEffectKey(cssClass) : null;
  const effect = effectKey ? EFFECT_STYLES[effectKey] : null;

  return (
    <span
      className={`text-lg sm:text-xl font-bold ${effect?.className || "text-zinc-300"}`}
      style={effect?.style}
    >
      {name}
    </span>
  );
}
