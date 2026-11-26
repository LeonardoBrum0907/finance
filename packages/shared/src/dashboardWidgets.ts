import { z } from "zod";
import type { AppModuleId, AppModulesState } from "./appModules";

export const DASHBOARD_WIDGET_IDS = [
  "net-worth",
  "per-person",
  "credit-cards",
  "investments",
  "recent-transactions",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export type DashboardWidgetsState = Record<DashboardWidgetId, boolean>;

export interface DashboardWidgetDefinition {
  id: DashboardWidgetId;
  title: string;
  description: string;
  defaultEnabled: boolean;
  /** Só aparece com este módulo ligado em Ajustes > Módulos. */
  module?: AppModuleId;
  /** Depende de `/api/dashboard`, buscado só quando algum bloco assim está ligado. */
  needsDetails?: boolean;
}

/**
 * Blocos opcionais do Início. O card do ciclo da fatura ("ainda posso gastar")
 * aparece sempre e não entra aqui.
 */
export const DASHBOARD_WIDGETS: readonly DashboardWidgetDefinition[] = [
  {
    id: "net-worth",
    title: "Patrimônio líquido",
    description: "Caixa, menos dívida de cartão, mais investimentos.",
    defaultEnabled: true,
  },
  {
    id: "per-person",
    title: "Resumo por pessoa",
    description: "Patrimônio de cada pessoa da família.",
    defaultEnabled: true,
  },
  {
    id: "credit-cards",
    title: "Cartões de crédito",
    description: "Limite usado, fatura e vencimento de cada cartão.",
    defaultEnabled: false,
  },
  {
    id: "investments",
    title: "Investimentos",
    description: "Saldo da carteira e rendimento.",
    defaultEnabled: false,
    module: "investments",
    needsDetails: true,
  },
  {
    id: "recent-transactions",
    title: "Movimentações do ciclo",
    description: "Extrato do ciclo da fatura escolhida.",
    defaultEnabled: true,
  },
] as const;

/** Blocos que o usuário pode ver agora: os de módulos desligados ficam de fora. */
export function availableDashboardWidgets(
  modules: AppModulesState,
): readonly DashboardWidgetDefinition[] {
  return DASHBOARD_WIDGETS.filter((widget) => !widget.module || modules[widget.module]);
}

/** Estado salvo, com os blocos de módulos desligados forçados para desligado. */
export function effectiveDashboardWidgets(
  state: DashboardWidgetsState,
  modules: AppModulesState,
): DashboardWidgetsState {
  const next = { ...state };
  for (const widget of DASHBOARD_WIDGETS) {
    if (widget.module && !modules[widget.module]) next[widget.id] = false;
  }
  return next;
}

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
const LEGACY_HOUSEHOLD_SUMMARY_PARTS: readonly DashboardWidgetId[] = ["net-worth", "per-person"];

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
