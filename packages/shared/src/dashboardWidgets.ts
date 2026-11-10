import { z } from "zod";

export const DASHBOARD_WIDGET_IDS = [
  "net-worth",
  "still-mine",
  "cycle-savings",
  "per-person",
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
    id: "net-worth",
    title: "Patrimônio líquido",
    description: "Caixa, menos dívida de cartão, mais investimentos.",
    defaultEnabled: true,
  },
  {
    id: "still-mine",
    title: "Ainda é meu neste período",
    description: "O que sobra depois das contas e faturas do ciclo, e o alerta quando fica negativo.",
    defaultEnabled: true,
  },
  {
    id: "cycle-savings",
    title: "Guardado neste ciclo",
    description: "Quanto da renda do ciclo ficou guardado.",
    defaultEnabled: true,
  },
  {
    id: "per-person",
    title: "Resumo por pessoa",
    description: "Patrimônio, o que ainda é seu e o guardado de cada pessoa da casa.",
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

const dashboardWidgetsPatchShape = Object.fromEntries(
  DASHBOARD_WIDGET_IDS.map((id) => [id, z.boolean().optional()]),
) as Record<DashboardWidgetId, z.ZodOptional<z.ZodBoolean>>;

export const dashboardWidgetsPatchSchema = z.object(dashboardWidgetsPatchShape).strict();

export type DashboardWidgetsPatch = z.infer<typeof dashboardWidgetsPatchSchema>;

function defaultDashboardWidgets(): DashboardWidgetsState {
  return Object.fromEntries(
    DASHBOARD_WIDGETS.map((widget) => [widget.id, widget.defaultEnabled]),
  ) as DashboardWidgetsState;
}

/** Bloco único antigo; quem já o desligou continua sem ver as partes dele. */
const LEGACY_HOUSEHOLD_SUMMARY_ID = "household-summary";
const LEGACY_HOUSEHOLD_SUMMARY_PARTS: readonly DashboardWidgetId[] = [
  "net-worth",
  "still-mine",
  "cycle-savings",
  "per-person",
];

/** Extrai só pares id→boolean conhecidos; ignora ids e valores inválidos. */
export function parseStoredDashboardWidgets(stored: unknown): Partial<DashboardWidgetsState> {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  const entries = stored as Record<string, unknown>;
  const result: Partial<DashboardWidgetsState> = {};
  const legacySummary = entries[LEGACY_HOUSEHOLD_SUMMARY_ID];
  if (typeof legacySummary === "boolean") {
    for (const id of LEGACY_HOUSEHOLD_SUMMARY_PARTS) result[id] = legacySummary;
  }
  for (const [key, value] of Object.entries(entries)) {
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
