import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "navy" | "purple" | "charcoal" | "neon";

export const THEMES: { id: Theme; label: string; labelKo: string; accent: string }[] = [
  { id: "navy", label: "Navy + Gold", labelKo: "네이비 + 골드", accent: "#d4a843" },
  { id: "purple", label: "Purple + Cyan", labelKo: "퍼플 + 시안", accent: "#22d3ee" },
  { id: "charcoal", label: "Charcoal + Emerald", labelKo: "차콜 + 에메랄드", accent: "#10b981" },
  { id: "neon", label: "Black + Neon", labelKo: "블랙 + 네온", accent: "#00ff88" },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({
  children,
  defaultTheme = "charcoal",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("app-theme");
    if (stored && THEMES.some(item => item.id === stored)) return stored as Theme;
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes, add current
    for (const item of THEMES) {
      root.classList.remove(`theme-${item.id}`);
    }
    root.classList.add(`theme-${theme}`);
    // All themes are dark
    root.classList.add("dark");
    localStorage.setItem("app-theme", theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => setThemeState(newTheme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
