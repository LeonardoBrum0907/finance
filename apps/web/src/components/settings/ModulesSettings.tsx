import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  APP_MODULES,
  resolveAppModules,
  type AppModuleId,
  type UpdateSettingsInput,
  type UserSettingsDTO,
} from "@finance/shared";
import { api } from "../../lib/api";
import { useAppModules } from "../../lib/modules";

/** Liga e desliga os módulos opcionais. Desligado, o módulo some do menu e das telas. */
export function ModulesSettings() {
  const queryClient = useQueryClient();
  const { modules, ready } = useAppModules();

  const save = useMutation({
    mutationFn: (body: UpdateSettingsInput) => api.patch<UserSettingsDTO>("/api/settings", body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: ["settings"] });
      const previous = queryClient.getQueryData<UserSettingsDTO>(["settings"]);
      if (previous && body.modules) {
        queryClient.setQueryData<UserSettingsDTO>(["settings"], {
          ...previous,
          modules: resolveAppModules({ ...previous.modules, ...body.modules }),
        });
      }
      return { previous };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["settings"], ctx.previous);
    },
    onSuccess: (data) => queryClient.setQueryData(["settings"], data),
  });

  const toggle = (id: AppModuleId) => {
    if (!ready || save.isPending) return;
    save.mutate({ modules: { [id]: !modules[id] } });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Início e Compromissos ficam sempre. Os módulos abaixo só aparecem quando ligados.
      </p>
      {APP_MODULES.map((module) => {
        const enabled = modules[module.id];
        return (
          <div
            key={module.id}
            className="flex items-start justify-between gap-4 rounded-xl border border-app-border bg-app-surface p-4 shadow-xs"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{module.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{module.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={module.title}
              disabled={!ready || save.isPending}
              onClick={() => toggle(module.id)}
              className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
                enabled ? "bg-brand" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-app-surface shadow-sm transition ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        );
      })}
      {save.isError && (
        <p className="text-xs text-danger">Não foi possível salvar. Tente de novo.</p>
      )}
    </div>
  );
}
