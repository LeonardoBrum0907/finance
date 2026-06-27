import { createContext, useContext } from "react";
import type { AppTheme } from "@finance/shared";

export interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => Promise<void>;
  isLoading: boolean;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
