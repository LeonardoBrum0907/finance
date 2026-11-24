import type { TransactionLike } from "./payday.js";
import { countsTowardCashFlow, isTransactionOutflow } from "./transactions.js";

const SALARY_CATEGORY = "Salário";

/** Entradas e saídas de um intervalo, com o salário separado da renda extra. */
export interface IntervalFlow {
  income: number;
  expenses: number;
  net: number;
  salary: number;
  extra: number;
}

export interface IntervalProgress {
  daysElapsed: number;
  daysTotal: number;
  daysRemaining: number;
  isPartialPeriod: true;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T12:00:00.000Z`) - Date.parse(`${a}T12:00:00.000Z`)) / 86_400_000,
  );
}

type FlowTransaction = Pick<TransactionLike, "amount" | "accountType" | "category" | "description" | "personName">;

/**
 * Soma as transações já escolhidas para um intervalo (`selectIntervalTransactions`).
 * É a única conta de receitas e despesas: o painel, a lista e a comparação usam esta
 * função, para os números nunca divergirem quando a regra do intervalo mudar.
 * Salário é a entrada com categoria Salário, a mesma regra do ciclo da fatura
 * (`billCycles.ts`); qualquer outra entrada é renda extra. Pagamento de fatura e
 * transferência entre contas próprias ficam de fora (`countsTowardCashFlow`).
 *
 * @example summarizeIntervalFlow(selectIntervalTransactions(txs, cards, intervalo))
 */
export function summarizeIntervalFlow(txs: FlowTransaction[]): IntervalFlow {
  const flow = { income: 0, expenses: 0, salary: 0, extra: 0 };
  for (const tx of txs) {
    if (!countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description, tx.personName)) {
      continue;
    }
    const abs = Math.abs(tx.amount);
    if (isTransactionOutflow(tx.amount, tx.accountType)) {
      flow.expenses += abs;
      continue;
    }
    flow.income += abs;
    if (tx.category === SALARY_CATEGORY) flow.salary += abs;
    else flow.extra += abs;
  }
  const income = round(flow.income);
  const expenses = round(flow.expenses);
  return { income, expenses, net: round(income - expenses), salary: round(flow.salary), extra: round(flow.extra) };
}

/**
 * Dia do intervalo em que estamos; null quando hoje está fora dele.
 *
 * @example intervalProgress({ from: "2026-10-29", to: "2026-11-30" }, "2026-11-24")
 */
export function intervalProgress(
  interval: { from: string; to: string },
  today: string,
): IntervalProgress | null {
  if (today < interval.from || today > interval.to) return null;
  const daysTotal = daysBetween(interval.from, interval.to) + 1;
  const daysElapsed = daysBetween(interval.from, today) + 1;
  return { daysElapsed, daysTotal, daysRemaining: daysTotal - daysElapsed, isPartialPeriod: true };
}
