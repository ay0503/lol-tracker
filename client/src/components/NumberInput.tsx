import { ChevronUp, ChevronDown } from "lucide-react";

interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  prefix?: string;
  className?: string;
  disabled?: boolean;
}

export default function NumberInput({
  value, onChange, min, max, step = 1, placeholder, prefix, className = "", disabled,
}: NumberInputProps) {
  const increment = () => {
    const num = parseFloat(value) || 0;
    const next = Math.min(num + step, max ?? Infinity);
    onChange(next.toString());
  };

  const decrement = () => {
    const num = parseFloat(value) || 0;
    const next = Math.max(num - step, min ?? -Infinity);
    onChange(Math.max(0, next).toString());
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={`w-full ${prefix ? "pl-7" : "pl-3"} pr-8 py-2 rounded-xl bg-secondary border border-border text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50`}
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
        <button
          type="button"
          onClick={increment}
          disabled={disabled}
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
          tabIndex={-1}
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={decrement}
          disabled={disabled}
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
          tabIndex={-1}
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
