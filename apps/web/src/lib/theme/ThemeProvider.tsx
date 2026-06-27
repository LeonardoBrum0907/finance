import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppTheme, UserSettingsDTO } from "@finance/shared";
import { DEFAULT_APP_THEME } from "@finance/shared";
import { api } from "../api";
import { useAuth } from "../auth";
import { applyTheme, readCachedTheme } from "./applyTheme";
import { ThemeContext } from "./useTheme";

interface Props {
  children: ReactNode;
}

export function ThemeProvider({ children }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [theme, setThemeState] = useState<AppTheme>(() => readCachedTheme());

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<UserSettingsDTO>("/api/settings"),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (settings.data?.theme) {
      setThemeState(settings.data.theme);
      applyTheme(settings.data.theme);
    }
  }, [settings.data?.theme]);

  useEffect(() => {
    if (!user) {
      setThemeState(DEFAULT_APP_THEME);
      applyTheme(DEFAULT_APP_THEME);
    }
  }, [user]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback(
    async (next: AppTheme) => {
      const previous = theme;
      setThemeState(next);
      applyTheme(next);

      if (!user) return;

      queryClient.setQueryData<UserSettingsDTO | undefined>(["settings"], (current) =>
        current ? { ...current, theme: next } : current,
      );

      try {
        const updated = await api.patch<UserSettingsDTO>("/api/settings", { theme: next });
        queryClient.setQueryData(["settings"], updated);
        setThemeState(updated.theme);
        applyTheme(updated.theme);
      } catch {
        setThemeState(previous);
        applyTheme(previous);
        queryClient.invalidateQueries({ queryKey: ["settings"] });
        throw new Error("Não foi possível salvar o tema.");
      }
    },
    [queryClient, theme, user],
  );

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      isLoading: Boolean(user) && settings.isLoading,
    }),
    [theme, setTheme, user, settings.isLoading],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
