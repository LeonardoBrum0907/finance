import { z } from "zod";

export const DASHBOARD_WIDGET_IDS = [
  "net-worth",
  "still-mine",
  "cycle-savings",
  "per-person",
  "simulation-impact",
  "cycle-progress",
  "period-comparison",
  "investments",
  "spending-evolution",
  "insights",
  "credit-cards",
  "recent-transactions",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export type DashboardWidgetsState = Record<DashboardWidgetId, boolean>;

export type DashboardWidgetGroup = "main" | "extras";

export const DASHBOARD_WIDGET_GROUPS: readonly {
  id: DashboardWidgetGroup;
  title: string;
}[] = [
  { id: "main", title: "Visão principal" },
  { id: "extras", title: "Mais informações" },
];

export interface DashboardWidgetDefinition {
  id: DashboardWidgetId;
  title: string;
  description: string;
  defaultEnabled: boolean;
  group: DashboardWidgetGroup;
  /** Depende de `/api/dashboard`, buscado só quando algum bloco assim está ligado. */
  needsDetails?: boolean;
}

export const DASHBOARD_WIDGETS: readonly DashboardWidgetDefinition[] = [
  {
    id: "net-worth",
    title: "Patrimônio líquido",
    description: "Caixa, menos dívida de cartão, mais investimentos.",
    defaultEnabled: true,
    group: "main",
  },
  {
    id: "still-mine",
    title: "Ainda é meu neste período",
    description: "O que sobra depois das contas e faturas do ciclo, e o alerta quando fica negativo.",
    defaultEnabled: true,
    group: "main",
  },
  {
    id: "cycle-savings",
    title: "Guardado neste ciclo",
    description: "Quanto da renda do ciclo ficou guardado.",
    defaultEnabled: true,
    group: "main",
  },
  {
    id: "per-person",
    title: "Resumo por pessoa",
    description: "Patrimônio, o que ainda é seu e o guardado de cada pessoa da casa.",
    defaultEnabled: true,
    group: "main",
  },
  {
    id: "simulation-impact",
    title: "Impacto das simulações",
    description: "Compras simuladas ativas e quanto pesam nos próximos ciclos.",
    defaultEnabled: false,
    group: "extras",
  },
  {
    id: "cycle-progress",
    title: "Progresso do ciclo",
    description: "Dias passados, o que já entrou e saiu, e a previsão de fechamento.",
    defaultEnabled: false,
    group: "extras",
    needsDetails: true,
  },
  {
    id: "period-comparison",
    title: "Comparativo do período",
    description: "Renda, gastos e saldo comparados ao período anterior.",
    defaultEnabled: false,
    group: "extras",
    needsDetails: true,
  },
  {
    id: "investments",
    title: "Investimentos",
    description: "Saldo da carteira e rendimento.",
    defaultEnabled: false,
    group: "extras",
    needsDetails: true,
  },
  {
    id: "spending-evolution",
    title: "Evolução e categorias",
    description: "Gráfico de renda e gastos e o total por categoria.",
    defaultEnabled: false,
    group: "extras",
    needsDetails: true,
  },
  {
    id: "insights",
    title: "Insights",
    description: "Observações automáticas sobre o período.",
    defaultEnabled: false,
    group: "extras",
    needsDetails: true,
  },
  {
    id: "credit-cards",
    title: "Cartões de crédito",
    description: "Limite usado, fatura e vencimento de cada cartão.",
    defaultEnabled: false,
    group: "extras",
  },
  {
    id: "recent-transactions",
    title: "Movimentações recentes",
    description: "Extrato do ciclo atual, categorias e simulação de compras.",
    defaultEnabled: true,
    group: "main",
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

export function needsDashboardDetails(state: DashboardWidgetsState): boolean {
  return DASHBOARD_WIDGETS.some((widget) => widget.needsDetails && state[widget.id]);
}

export function hasAnyEnabledDashboardWidget(state: DashboardWidgetsState): boolean {
  return DASHBOARD_WIDGETS.some((widget) => state[widget.id]);
}
