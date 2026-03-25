import { createContext, useContext, useState, type ReactNode } from "react";

type TickerSymbol = "DORI" | "DDRI" | "TDRI" | "SDRI" | "XDRI";

interface TickerContextValue {
  activeTicker: TickerSymbol;
  setActiveTicker: (ticker: TickerSymbol) => void;
}

const TickerContext = createContext<TickerContextValue | null>(null);

export function TickerProvider({ children }: { children: ReactNode }) {
  const [activeTicker, setActiveTicker] = useState<TickerSymbol>("DORI");

  return (
    <TickerContext.Provider value={{ activeTicker, setActiveTicker }}>
      {children}
    </TickerContext.Provider>
  );
}

export function useTicker(): TickerContextValue {
  const ctx = useContext(TickerContext);
  if (!ctx) {
    throw new Error("useTicker must be used within a <TickerProvider>");
  }
  return ctx;
}
