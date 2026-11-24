import { useMemo } from "react";
import {
  formatIntervalRef,
  formatPaydayCycleLabel,
  nextIntervalKey,
  pickInterval,
  previousIntervalKey,
  resolveBillInterval,
  resolveMonthInterval,
  todayDateKeyInTimeZone,
  type BillCycleSummary,
  type IntervalKind,
  type IntervalRef,
} from "@finance/shared";
import { useInterval } from "../lib/interval";
import { billCycleLabel } from "../components/simulator/BillCycleCard";

/** Quantos meses para trás o seletor deixa voltar no modo mês. */
const MONTH_HISTORY = 12;

export interface DashboardInterval {
  /** Intervalo em uso na página; null enquanto os dados carregam. */
  current: IntervalRef | null;
  /** Valor do parâmetro `interval` da API. */
  param: string | null;
  label: string;
  rangeLabel?: string;
  billAvailable: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onKindChange: (kind: IntervalKind) => void;
  onStep: (delta: -1 | 1) => void;
  /** Escolher uma fatura (ex.: no card do ciclo) mantém o tipo e troca o mês. */
  onSelectKey: (key: string) => void;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function labelsFor(current: IntervalRef, cycles: BillCycleSummary[]): Pick<DashboardInterval, "label" | "rangeLabel"> {
  if (current.kind === "bill") {
    return { label: billCycleLabel(current.key), rangeLabel: resolveBillInterval(cycles, current.key)?.label };
  }
  const month = resolveMonthInterval(current.key);
  return { label: capitalize(month.label), rangeLabel: formatPaydayCycleLabel(month.from, month.to) };
}

function stepLimits(current: IntervalRef, cycles: BillCycleSummary[], thisMonth: string) {
  if (current.kind === "bill") {
    const index = cycles.findIndex((c) => c.cycleKey === current.key);
    return { canGoBack: index > 0, canGoForward: index >= 0 && index < cycles.length - 1 };
  }
  let oldest = thisMonth;
  for (let i = 0; i < MONTH_HISTORY; i++) oldest = previousIntervalKey(oldest);
  return { canGoBack: current.key > oldest, canGoForward: current.key < thisMonth };
}

/**
 * Liga o seletor de intervalo do painel ao estado único do app (`useInterval`).
 * Sem escolha, abre no ciclo da fatura ainda não paga; sem cartão, no mês atual.
 *
 * @example const interval = useDashboardInterval(billCycles, openBillKey);
 */
export function useDashboardInterval(cycles: BillCycleSummary[], openBillKey: string | null): DashboardInterval {
  const { interval: chosen, setInterval } = useInterval();
  const thisMonth = todayDateKeyInTimeZone().slice(0, 7);
  const billDefault = cycles.length > 0 ? (openBillKey ?? cycles[cycles.length - 1]!.cycleKey) : null;

  const current = useMemo(
    () =>
      pickInterval(chosen, { bill: billDefault, month: thisMonth }, (ref) =>
        ref.kind === "month" ? ref.key <= thisMonth : cycles.some((c) => c.cycleKey === ref.key),
      ),
    [chosen, billDefault, thisMonth, cycles],
  );

  const fallback = { label: "", canGoBack: false, canGoForward: false };
  const view = current ? { ...labelsFor(current, cycles), ...stepLimits(current, cycles, thisMonth) } : fallback;

  return {
    current,
    param: current ? formatIntervalRef(current) : null,
    ...view,
    billAvailable: billDefault !== null,
    onKindChange: (kind) => setInterval({ kind, key: kind === "bill" ? (billDefault ?? thisMonth) : thisMonth }),
    onStep: (delta) => {
      if (!current) return;
      const key = delta < 0 ? previousIntervalKey(current.key) : nextIntervalKey(current.key);
      setInterval({ kind: current.kind, key });
    },
    onSelectKey: (key) => setInterval({ kind: current?.kind ?? "bill", key }),
  };
}
