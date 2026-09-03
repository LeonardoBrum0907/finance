import { z } from "zod";

export const DASHBOARD_WIDGET_IDS = [
  "household-summary",
  "recent-transactions",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export type DashboardWidgetsState = Record<DashboardWidgetId, boolean>;

export interface DashboardWidgetDefinition {
  id: DashboardWidgetId;
  title: string;
  description: string;
  defaultEnabled: boolean;
}

export const DASHBOARD_WIDGETS: readonly DashboardWidgetDefinition[] = [
  {
    id: "household-summary",
    title: "Resumo do ciclo",
    description: "Saldo, fechamento do ciclo e fluxo de caixa da pessoa ou do conjunto.",
    defaultEnabled: true,
  },
  {
    id: "recent-transactions",
    title: "Movimentações recentes",
    description: "Extrato do ciclo atual, categorias e simulação de compras.",
    defaultEnabled: true,
  },
] as const;

export const DASHBOARD_WIDGET_ID_SET = new Set<string>(DASHBOARD_WIDGET_IDS);

export function isDashboardWidgetId(value: string): value is DashboardWidgetId {
  return DASHBOARD_WIDGET_ID_SET.has(value);
}

export const dashboardWidgetsPatchSchema = z
  .object({
    "household-summary": z.boolean().optional(),
    "recent-transactions": z.boolean().optional(),
  })
  .strict();

export type DashboardWidgetsPatch = z.infer<typeof dashboardWidgetsPatchSchema>;

function defaultDashboardWidgets(): DashboardWidgetsState {
  return Object.fromEntries(
    DASHBOARD_WIDGETS.map((widget) => [widget.id, widget.defaultEnabled]),
  ) as DashboardWidgetsState;
}

/** Extrai só pares id→boolean conhecidos; ignora ids e valores inválidos. */
export function parseStoredDashboardWidgets(stored: unknown): Partial<DashboardWidgetsState> {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  const result: Partial<DashboardWidgetsState> = {};
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    if (isDashboardWidgetId(key) && typeof value === "boolean") {
      result[key] = value;
    }
  }
  return result;
}

/** Une o JSON persistido com o registro. Ids novos usam defaultEnabled. */
export function resolveDashboardWidgets(stored: unknown): DashboardWidgetsState {
  return {
    ...defaultDashboardWidgets(),
    ...parseStoredDashboardWidgets(stored),
  };
}

export function mergeDashboardWidgetPatch(
  stored: unknown,
  patch: DashboardWidgetsPatch,
): Partial<DashboardWidgetsState> {
  const next: Partial<DashboardWidgetsState> = { ...parseStoredDashboardWidgets(stored) };
  for (const [key, value] of Object.entries(patch)) {
    if (isDashboardWidgetId(key) && typeof value === "boolean") {
      next[key] = value;
    }
  }
  return next;
}

export function hasAnyEnabledDashboardWidget(state: DashboardWidgetsState): boolean {
  return DASHBOARD_WIDGETS.some((widget) => state[widget.id]);
}
