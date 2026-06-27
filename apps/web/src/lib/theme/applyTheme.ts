import type { AppTheme } from "@finance/shared";
import { DEFAULT_APP_THEME } from "@finance/shared";

export const THEME_STORAGE_KEY = "finance-app-theme";

export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage errors
  }
}

export function readCachedTheme(): AppTheme {
  try {
    const cached = localStorage.getItem(THEME_STORAGE_KEY);
    return cached === "comfy" ? "comfy" : DEFAULT_APP_THEME;
  } catch {
    return DEFAULT_APP_THEME;
  }
}

export function readCssColor(varName: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (!raw) return "#000000";
  const parts = raw.split(/\s+/).map(Number);
  if (parts.length >= 3) {
    return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
  }
  return raw;
}

export function readCssColors(varNames: string[]): string[] {
  return varNames.map((name) => readCssColor(name));
}
