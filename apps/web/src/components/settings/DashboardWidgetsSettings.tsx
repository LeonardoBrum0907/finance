import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  availableDashboardWidgets,
  resolveDashboardWidgets,
  type DashboardWidgetId,
  type UpdateSettingsInput,
  type UserSettingsDTO,
} from "@finance/shared";
import { api } from "../../lib/api";
import { useAppModules } from "../../lib/modules";

export function DashboardWidgetsSettings() {
  const queryClient = useQueryClient();
  const { modules } = useAppModules();

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<UserSettingsDTO>("/api/settings"),
  });

  const save = useMutation({
    mutationFn: (body: UpdateSettingsInput) =>
      api.patch<UserSettingsDTO>("/api/settings", body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: ["settings"] });
      const previous = queryClient.getQueryData<UserSettingsDTO>(["settings"]);
      if (previous && body.dashboardWidgets) {
        queryClient.setQueryData<UserSettingsDTO>(["settings"], {
          ...previous,
          dashboardWidgets: resolveDashboardWidgets({
            ...previous.dashboardWidgets,
            ...body.dashboardWidgets,
          }),
        });
      }
      return { previous };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["settings"], ctx.previous);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
    },
  });

  const widgets = settings.data?.dashboardWidgets;
  const disabled = settings.isLoading || save.isPending;

  const handleToggle = (id: DashboardWidgetId) => {
    if (disabled || !widgets) return;
    save.mutate({ dashboardWidgets: { [id]: !widgets[id] } });
  };

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        O ciclo da fatura aparece sempre. Escolha o que mais aparece no Início.
      </p>
      <div className="space-y-3">
        {availableDashboardWidgets(modules).map((widget) => {
          const enabled = widgets?.[widget.id] ?? widget.defaultEnabled;
          return (
            <div
              key={widget.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-app-border/60 bg-app-bg/50 p-4"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{widget.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {widget.description}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                disabled={disabled || !widgets}
                onClick={() => handleToggle(widget.id)}
                className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  enabled ? "bg-brand" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-app-surface shadow-sm transition ${
                    enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
                <span className="sr-only">
                  {enabled ? `Ocultar ${widget.title}` : `Exibir ${widget.title}`}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {save.isError && (
        <p className="mt-2 text-xs text-danger">
          {(save.error as Error)?.message ?? "Não foi possível salvar o painel."}
        </p>
      )}
    </div>
  );
}
