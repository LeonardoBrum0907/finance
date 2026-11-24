import { groupCategoryForDashboard, type DashboardCategoryGroup } from "./categoryGroups.js";
import type { RecurringPatternTransaction } from "./recurringBills.js";
import { isCreditAccount } from "./transactions.js";

/**
 * Assinatura de valor variável: a mesma descrição todo mês, mas o valor muda porque a
 * pessoa troca de plano (pedido do Léo em 24/11/2026: Anthropic de R$ 116 num mês e
 * R$ 514 no outro, às vezes os dois no mesmo mês). A conta fixa passa a ser o total
 * cobrado no mês, e não o valor de uma cobrança.
 */

/** Mais que isso num mês é gasto do dia a dia (mercado, posto), não assinatura. */
const MAX_CHARGES_PER_MONTH = 2;
const MIN_CONSECUTIVE_MONTHS = 2;

/** Grupos de serviço contratado, em que o valor muda por troca de plano. */
const VARIABLE_TOTAL_GROUPS = new Set<DashboardCategoryGroup>([
  "Assinaturas",
  "Contas fixas",
  "Serviços",
  "Tarifas e impostos",
]);

/**
 * No cartão a Pluggy põe assinatura estrangeira em "Transferências" ou "Outros"
 * (a Anthropic vem como "Transfers"), então esses grupos também valem lá.
 */
const VARIABLE_TOTAL_CARD_GROUPS = new Set<DashboardCategoryGroup>(["Transferências", "Outros"]);

export interface MonthlyTotalChain {
  /** Cobranças da sequência, da mais antiga para a mais recente. */
  transactions: RecurringPatternTransaction[];
  /** Total cobrado em cada mês da sequência (AAAA-MM). */
  monthTotals: Record<string, number>;
}

interface MonthBucket {
  monthKey: string;
  txs: RecurringPatternTransaction[];
}

/** A API às vezes passa Date no lugar do texto, apesar do tipo. */
function toDateText(date: string | Date): string {
  return typeof date === "string" ? date : date.toISOString();
}

function toMonthKey(date: string | Date): string {
  return toDateText(date).slice(0, 7);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function nextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(Date.UTC(year!, month!, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function bucketByMonth(txs: RecurringPatternTransaction[]): MonthBucket[] {
  const byMonth = new Map<string, RecurringPatternTransaction[]>();
  const sorted = [...txs].sort((a, b) => toDateText(a.date).localeCompare(toDateText(b.date)));
  for (const tx of sorted) {
    const key = toMonthKey(tx.date);
    byMonth.set(key, [...(byMonth.get(key) ?? []), tx]);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, monthTxs]) => ({ monthKey, txs: monthTxs }));
}

/** Meses seguidos com até duas cobranças; em empate fica a sequência mais recente. */
function longestConsecutiveRun(buckets: MonthBucket[]): MonthBucket[] {
  let best: MonthBucket[] = [];
  let current: MonthBucket[] = [];
  for (const bucket of buckets) {
    const fewCharges = bucket.txs.length <= MAX_CHARGES_PER_MONTH;
    const previous = current[current.length - 1];
    const continues = previous != null && nextMonthKey(previous.monthKey) === bucket.monthKey;
    if (!fewCharges) current = [];
    else current = continues ? [...current, bucket] : [bucket];
    if (current.length >= best.length) best = current;
  }
  return best;
}

/** Mercado, farmácia e PIX para pessoas variam por natureza: só entram com valor estável. */
function allowsVariableTotal(txs: RecurringPatternTransaction[]): boolean {
  const first = txs[0];
  if (!first) return false;
  const group = first.category ? groupCategoryForDashboard(first.category) : null;
  if (group && VARIABLE_TOTAL_GROUPS.has(group)) return true;
  if (!isCreditAccount(first.accountType)) return false;
  return group == null || VARIABLE_TOTAL_CARD_GROUPS.has(group);
}

/**
 * Sequência de meses seguidos de um mesmo serviço, somando as cobranças de cada mês.
 * Devolve null quando o grupo não serve para conta de valor variável.
 *
 * @example findMonthlyTotalChain(anthropicCharges)?.monthTotals // { "2026-10": 600.45, "2026-11": 630.93 }
 */
export function findMonthlyTotalChain(
  txs: RecurringPatternTransaction[],
): MonthlyTotalChain | null {
  if (!allowsVariableTotal(txs)) return null;
  const run = longestConsecutiveRun(bucketByMonth(txs));
  if (run.length < MIN_CONSECUTIVE_MONTHS) return null;
  const monthTotals: Record<string, number> = {};
  for (const bucket of run) {
    monthTotals[bucket.monthKey] = roundMoney(
      bucket.txs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
    );
  }
  return { transactions: run.flatMap((bucket) => bucket.txs), monthTotals };
}
