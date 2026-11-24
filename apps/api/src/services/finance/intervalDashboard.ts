import {
  intervalProgress,
  selectIntervalTransactions,
  summarizeIntervalFlow,
  todayDateKeyInTimeZone,
  type DashboardGrowthMetrics,
  type DashboardPeriodSummary,
  type IntervalFlow,
  type ResolvedInterval,
} from "@finance/shared";
import {
  buildDashboardInsights,
  getCategoriesWithPercent,
  getSpendingByCategory,
  getTopExpenses,
  type CategorySpending,
  type CategoryWithPercent,
} from "./aggregates.js";
import type { IntervalContext } from "./interval.js";
import type { FinancialTransaction } from "./types.js";

/**
 * Partes do painel que dependem do intervalo (24/11/2026). Antes o Painel do Período
 * seguia o ciclo de salário em que a fatura vence: a fatura de novembro (vence 30/11)
 * caía no ciclo 26/11–25/12, que nem tinha começado, e mostrava receitas e renda extra
 * zeradas, o salário de dezembro como previsão e -100% contra o anterior.
 */
export interface IntervalDashboard {
  period: DashboardPeriodSummary;
  previousPeriod: DashboardPeriodSummary;
  monthlySeries: { month: string; label: string; income: number; expenses: number; net: number }[];
  categories: CategoryWithPercent[];
  previousCategories: (CategorySpending & { percent: number })[];
  growthMetrics: DashboardGrowthMetrics;
  insights: string[];
}

type IntervalTxs = (FinancialTransaction & { billDueDate: string | null })[];

const EMPTY_FLOW: IntervalFlow = { income: 0, expenses: 0, net: 0, salary: 0, extra: 0 };

function toPeriod(interval: ResolvedInterval, flow: IntervalFlow, projectedSalary: number): DashboardPeriodSummary {
  return {
    months: 1,
    income: flow.income,
    expenses: flow.expenses,
    net: flow.net,
    availableNet: projectedSalary > 0 ? flow.net + projectedSalary : undefined,
    projectedSalaryIncome: projectedSalary,
    periodMode: "payday",
    from: interval.from,
    to: interval.to,
    label: interval.label,
  };
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function growthMetrics(
  interval: ResolvedInterval,
  flow: IntervalFlow,
  previous: IntervalFlow | null,
  projectedSalary: number,
): DashboardGrowthMetrics {
  const { income, expenses, net } = flow;
  return {
    savingsRate: income > 0 ? (net / income) * 100 : null,
    expenseRatio: income > 0 ? (expenses / income) * 100 : null,
    vsPrevious: {
      incomeChange: previous ? percentChange(income, previous.income) : null,
      expenseChange: previous ? percentChange(expenses, previous.expenses) : null,
      netChange: previous ? percentChange(net, previous.net) : null,
    },
    incomeBreakdown: { salary: flow.salary + projectedSalary, extra: flow.extra },
    cycleProgress: intervalProgress(interval, todayDateKeyInTimeZone()),
  };
}

function categoryBlocks(
  currentTxs: IntervalTxs,
  previousTxs: IntervalTxs,
  periods: { period: DashboardPeriodSummary; previousPeriod: DashboardPeriodSummary },
  currencyCode: string,
): Pick<IntervalDashboard, "categories" | "previousCategories" | "insights"> {
  const categories = getCategoriesWithPercent(currentTxs, {});
  const previousCategories = getSpendingByCategory(previousTxs, {}).map((c) => ({ ...c, percent: 0 }));
  const insights = buildDashboardInsights({
    ...periods,
    categories,
    previousCategories,
    topExpense: getTopExpenses(currentTxs, {}, 1)[0],
    currencyCode,
    periodMode: "payday",
  });
  return { categories, previousCategories, insights };
}

/**
 * Monta o painel do intervalo com as mesmas transações da lista
 * (`selectIntervalTransactions`) e a mesma soma (`summarizeIntervalFlow`).
 *
 * @example buildIntervalDashboard(txs, await resolveIntervalForUser(userId, undefined, ref), "BRL")
 */
export function buildIntervalDashboard(
  txs: FinancialTransaction[],
  context: IntervalContext,
  currencyCode: string,
): IntervalDashboard {
  const { current, previous, cards } = context;
  const currentTxs = selectIntervalTransactions(txs, cards, current);
  const previousTxs = previous ? selectIntervalTransactions(txs, cards, previous) : [];
  const flow = summarizeIntervalFlow(currentTxs);
  // O ciclo da fatura prevê o salário que ainda não está no saldo da conta; o Itaú
  // lança o salário com data futura, e aí ele já está nas transações do intervalo.
  const projectedSalary = flow.salary > 0 ? 0 : context.projectedSalary;
  const previousFlow = previous ? summarizeIntervalFlow(previousTxs) : null;
  const period = toPeriod(current, flow, projectedSalary);
  const previousPeriod = previous ? toPeriod(previous, previousFlow!, 0) : { ...EMPTY_FLOW, months: 1 };
  return {
    period,
    previousPeriod,
    monthlySeries: [{ month: current.key, label: current.label, income: flow.income, expenses: flow.expenses, net: flow.net }],
    ...categoryBlocks(currentTxs, previousTxs, { period, previousPeriod }, currencyCode),
    growthMetrics: growthMetrics(current, flow, previousFlow, projectedSalary),
  };
}
