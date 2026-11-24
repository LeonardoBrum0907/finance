import type { BillCycleSummary } from "./billCycle.js";
import { selectByBillCycle } from "./billCycleTransactions.js";
import type { CardPaymentCalendar } from "./cardPaymentDate.js";
import { formatPaydayCycleLabel, toLocalDateKey } from "./payday.js";

/**
 * Fonte única do intervalo do app (24/11/2026). Cada tela calculava o seu (ciclo de
 * salário no painel, ciclo da fatura na lista), e toda mudança de regra deixava um
 * componente para trás. Agora o intervalo é escolhido uma vez (`bill:AAAA-MM` ou
 * `month:AAAA-MM`), resolvido aqui e as transações dele saem de uma função só.
 */
export type IntervalKind = "bill" | "month";

export interface IntervalRef {
  kind: IntervalKind;
  /** Mês (AAAA-MM): o mês do calendário ou o mês da fatura. */
  key: string;
}

export interface ResolvedInterval extends IntervalRef {
  /** Primeiro e último dia (AAAA-MM-DD), inclusive. */
  from: string;
  to: string;
  label: string;
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * Lê o intervalo do parâmetro `interval` da API; null quando o texto não tem o
 * formato `bill:AAAA-MM` ou `month:AAAA-MM`.
 *
 * @example parseIntervalRef("bill:2026-11") // { kind: "bill", key: "2026-11" }
 */
export function parseIntervalRef(value: unknown): IntervalRef | null {
  if (typeof value !== "string") return null;
  const [kind, key] = value.trim().split(":");
  if (kind !== "bill" && kind !== "month") return null;
  if (!key || !MONTH_KEY.test(key)) return null;
  return { kind, key };
}

/** @example formatIntervalRef({ kind: "month", key: "2026-11" }) // "month:2026-11" */
export function formatIntervalRef(ref: IntervalRef): string {
  return `${ref.kind}:${ref.key}`;
}

function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const index = y! * 12 + (m! - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Mês anterior ao da chave. @example previousIntervalKey("2026-01") // "2025-12" */
export function previousIntervalKey(key: string): string {
  return shiftMonthKey(key, -1);
}

/** Mês seguinte ao da chave. @example nextIntervalKey("2026-12") // "2027-01" */
export function nextIntervalKey(key: string): string {
  return shiftMonthKey(key, 1);
}

/** Mês do calendário inteiro. @example resolveMonthInterval("2026-02").to // "2026-02-28" */
export function resolveMonthInterval(key: string): ResolvedInterval {
  const [y, m] = key.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return {
    kind: "month",
    key,
    from: `${key}-01`,
    to: `${key}-${String(lastDay).padStart(2, "0")}`,
    label: `${MONTH_NAMES[m! - 1]} de ${y}`,
  };
}

/**
 * Ciclo da fatura do mês `key`: do dia seguinte ao pagamento da fatura anterior ao
 * pagamento desta (`buildBillCycles`). null quando o mês não está entre os ciclos.
 */
export function resolveBillInterval(
  cycles: Pick<BillCycleSummary, "cycleKey" | "periodFrom" | "periodTo">[],
  key: string,
): ResolvedInterval | null {
  const cycle = cycles.find((c) => c.cycleKey === key);
  if (!cycle) return null;
  return {
    kind: "bill",
    key,
    from: cycle.periodFrom,
    to: cycle.periodTo,
    label: formatPaydayCycleLabel(cycle.periodFrom, cycle.periodTo),
  };
}

/**
 * Transações que pertencem ao intervalo. No ciclo da fatura, compra no cartão entra
 * pela fatura em que cai (seja qual for a data da compra); no mês, tudo entra pela
 * data, inclusive a compra no cartão ("quanto gastei em novembro").
 *
 * @example selectIntervalTransactions(txs, cards, resolveMonthInterval("2026-11"))
 */
export function selectIntervalTransactions<
  T extends {
    date: Date;
    amount: number;
    accountId: string;
    accountType?: string | null;
    billForecastMonth?: string | null;
  },
>(txs: T[], cards: CardPaymentCalendar[], interval: ResolvedInterval): Array<T & { billDueDate: string | null }> {
  if (interval.kind === "bill") {
    return selectByBillCycle(txs, cards, { cycleKey: interval.key, periodFrom: interval.from, periodTo: interval.to });
  }
  return txs
    .filter((tx) => {
      const date = toLocalDateKey(tx.date);
      return date >= interval.from && date <= interval.to;
    })
    .map((tx) => ({ ...tx, billDueDate: null }));
}

/**
 * Intervalo que a tela usa: a escolha da pessoa quando ela vale aqui, senão o padrão
 * do tipo escolhido (ou do mês, quando não há ciclo da fatura). `defaults` traz a
 * chave padrão de cada tipo; null quando o tipo não existe (sem cartão, sem fatura).
 *
 * @example pickInterval(null, { bill: "2026-11", month: "2026-11" }, () => true) // { kind: "bill", key: "2026-11" }
 */
export function pickInterval(
  chosen: { kind: IntervalKind; key: string } | null,
  defaults: Record<IntervalKind, string | null>,
  isValid: (ref: IntervalRef) => boolean,
): IntervalRef | null {
  if (chosen?.key && defaults[chosen.kind] && isValid(chosen)) return { kind: chosen.kind, key: chosen.key };
  const kind: IntervalKind = defaults[chosen?.kind ?? "bill"] ? (chosen?.kind ?? "bill") : "month";
  const key = defaults[kind];
  return key ? { kind, key } : null;
}
