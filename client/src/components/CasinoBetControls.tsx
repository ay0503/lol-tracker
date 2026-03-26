import { motion } from "framer-motion";

export const MIN_CASINO_BET = 0.10;
export const MAX_CASINO_BET = 50;
export const QUICK_BET_AMOUNTS = [0.10, 0.25, 0.50, 1, 2, 5] as const;
export const CASINO_BET_RANGE_LABEL = "$0.10 - $50";

interface CasinoBetControlsProps {
  language: string;
  value: string;
  cash: number;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function formatShortcutAmount(amount: number): string {
  if (amount < 1) return `$${amount.toFixed(2)}`;
  return Number.isInteger(amount) ? `$${amount.toFixed(0)}` : `$${amount.toFixed(2)}`;
}

export function parseCasinoBetAmount(value: string): number {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : 0;
}

export default function CasinoBetControls({
  language,
  value,
  cash,
  disabled = false,
  onChange,
}: CasinoBetControlsProps) {
  const selectedAmount = parseCasinoBetAmount(value);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
        <span className="font-semibold text-zinc-400">
          {language === "ko" ? "베팅 금액" : "Bet Amount"}
        </span>
        <span className="font-mono text-zinc-500">
          {language === "ko" ? `베팅 금액: ${CASINO_BET_RANGE_LABEL}` : `Bet amount: ${CASINO_BET_RANGE_LABEL}`}
        </span>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
        <input
          type="number"
          inputMode="decimal"
          min={MIN_CASINO_BET}
          max={MAX_CASINO_BET}
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="w-full rounded-xl border border-zinc-700/50 bg-zinc-800/80 py-3 pl-7 pr-3 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder={language === "ko" ? "베팅 금액 입력" : "Enter bet amount"}
        />
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {QUICK_BET_AMOUNTS.map((amount) => {
          const isSelected = selectedAmount === amount;
          const isUnavailable = disabled || cash < amount;

          return (
            <motion.button
              key={amount}
              whileHover={isUnavailable ? {} : { y: -2 }}
              whileTap={isUnavailable ? {} : { scale: 0.98 }}
              onClick={() => onChange(amount.toFixed(2))}
              disabled={isUnavailable}
              className={`rounded-lg border px-2 py-2 text-xs font-mono font-bold transition-all ${
                isUnavailable
                  ? "cursor-not-allowed border-zinc-800 bg-zinc-900/70 text-zinc-600"
                  : isSelected
                    ? "border-yellow-500/50 bg-yellow-500/15 text-yellow-400 shadow-lg shadow-yellow-500/10"
                    : "border-zinc-700/50 bg-zinc-800 text-zinc-300 hover:border-zinc-500/60 hover:text-white"
              }`}
            >
              {formatShortcutAmount(amount)}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
