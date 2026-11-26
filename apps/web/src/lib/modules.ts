import { useQuery } from "@tanstack/react-query";
import { resolveAppModules, type AppModulesState, type UserSettingsDTO } from "@finance/shared";
import { api } from "./api";

/** Módulos ligados em Ajustes. `ready` fica falso até as configurações chegarem. */
export function useAppModules(): { modules: AppModulesState; ready: boolean } {
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<UserSettingsDTO>("/api/settings"),
  });
  return {
    modules: settings.data?.modules ?? resolveAppModules(null),
    ready: settings.isSuccess || settings.isError,
  };
}
