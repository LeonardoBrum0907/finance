import type { FinancialConnection, FinancialTransaction } from "./types.js";
import {
  classifyIncome,
  formatPaydayCycleShortLabel,
  getPaydayCycleStart,
  getPaydayCycleRange,
  getRecentPaydayCycles,
  paydayCyclesToDateRange,
  type PeriodMode,
} from "@finance/shared";
import {
  countsTowardCashFlow,
  groupCategoryForDashboard,
  isTransactionOutflow,
} from "@finance/shared";

/** Datas no fuso America/Sao_Paulo para alinhar "mês atual" ao usuário brasileiro. */
const TZ = "America/Sao_Paulo";

export function formatCurrency(value: number, code = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: code }).format(value);
}

export function toLocalDateKey(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function toLocalMonthKey(date: Date): string {
  return toLocalDateKey(date).slice(0, 7);
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export interface DateRange {
  from?: string;
  to?: string;
}

function resolveDashboardCategory(
  tx: Pick<FinancialTransaction, "category" | "description">,
): string {
  return groupCategoryForDashboard(tx.category, tx.description);
}

export function filterByDateRange(
  txs: FinancialTransaction[],
  range: DateRange = {},
): FinancialTransaction[] {
  return txs.filter((tx) => {
    const key = toLocalDateKey(tx.date);
    if (range.from && key < range.from) return false;
    if (range.to && key > range.to) return false;
    return true;
  });
}

export interface MonthlySummary {
  month: string;
  income: number;
  expenses: number;
  net: number;
  label?: string;
}

export function getMonthlySummary(
  txs: FinancialTransaction[],
  month?: string,
): MonthlySummary {
  const targetMonth = month ?? toLocalMonthKey(new Date());
  const filtered = txs.filter((tx) => toLocalMonthKey(tx.date) === targetMonth);

  let income = 0;
  let expenses = 0;
  for (const tx of filtered) {
    if (!countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description)) {
      continue;
    }
    const abs = Math.abs(tx.amount);
    if (isTransactionOutflow(tx.amount, tx.accountType)) expenses += abs;
    else income += abs;
  }

  return {
    month: targetMonth,
    income,
    expenses,
    net: income - expenses,
  };
}

export interface CategorySpending {
  category: string;
  total: number;
  count: number;
}

export function getSpendingByCategory(
  txs: FinancialTransaction[],
  range: DateRange = {},
): CategorySpending[] {
  const filtered = filterByDateRange(txs, range);
  const map = new Map<string, { total: number; count: number }>();

  for (const tx of filtered) {
    if (!countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description)) {
      continue;
    }
    if (!isTransactionOutflow(tx.amount, tx.accountType)) continue;
    const category = resolveDashboardCategory(tx);
    const entry = map.get(category) ?? { total: 0, count: 0 };
    entry.total += Math.abs(tx.amount);
    entry.count += 1;
    map.set(category, entry);
  }

  return [...map.entries()]
    .map(([category, { total, count }]) => ({ category, total, count }))
    .sort((a, b) => b.total - a.total);
}

export function getTopExpenses(
  txs: FinancialTransaction[],
  range: DateRange = {},
  limit = 5,
): FinancialTransaction[] {
  return filterByDateRange(txs, range)
    .filter(
      (tx) =>
        countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description) &&
        isTransactionOutflow(tx.amount, tx.accountType),
    )
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, limit);
}

export interface SyncInfo {
  connectorName: string;
  lastSyncedAt: string | null;
}

export function getLastSyncInfo(connections: FinancialConnection[]): SyncInfo[] {
  return connections.map((conn) => ({
    connectorName: conn.connectorName ?? "Banco desconhecido",
    lastSyncedAt: conn.lastSyncedAt ? conn.lastSyncedAt.toISOString() : null,
  }));
}

export function formatLocalDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { timeZone: TZ });
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${month}/${year}`;
}

export function addMonthsToMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Retorna chaves YYYY-MM dos últimos `count` meses, terminando `endOffsetMonths` antes do mês atual. */
export function getRecentMonthKeys(count: number, endOffsetMonths = 0): string[] {
  const currentMonth = toLocalMonthKey(new Date());
  const endMonth = addMonthsToMonthKey(currentMonth, -endOffsetMonths);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(addMonthsToMonthKey(endMonth, -i));
  }
  return keys;
}

export function monthKeysToDateRange(monthKeys: string[]): DateRange {
  if (monthKeys.length === 0) return {};
  const from = `${monthKeys[0]}-01`;
  const lastKey = monthKeys[monthKeys.length - 1];
  const [y, m] = lastKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${lastKey}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export interface PeriodSummary {
  months: number;
  income: number;
  expenses: number;
  net: number;
}

export function summarizeTransactions(
  txs: FinancialTransaction[],
  range: DateRange,
): Omit<PeriodSummary, "months"> {
  const filtered = filterByDateRange(txs, range);
  let income = 0;
  let expenses = 0;
  for (const tx of filtered) {
    if (!countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description)) {
      continue;
    }
    const abs = Math.abs(tx.amount);
    if (isTransactionOutflow(tx.amount, tx.accountType)) expenses += abs;
    else income += abs;
  }
  return { income, expenses, net: income - expenses };
}

export function getMonthlySeries(
  txs: FinancialTransaction[],
  monthKeys: string[],
): MonthlySummary[] {
  return monthKeys.map((month) => getMonthlySummary(txs, month));
}

export interface CategoryWithPercent extends CategorySpending {
  percent: number;
}

export function getCategoriesWithPercent(
  txs: FinancialTransaction[],
  range: DateRange,
): CategoryWithPercent[] {
  const categories = getSpendingByCategory(txs, range);
  const total = categories.reduce((sum, c) => sum + c.total, 0);
  return categories.map((c) => ({
    ...c,
    percent: total > 0 ? (c.total / total) * 100 : 0,
  }));
}

export function buildDashboardInsights(params: {
  period: PeriodSummary;
  previousPeriod: PeriodSummary;
  categories: CategoryWithPercent[];
  previousCategories: CategorySpending[];
  topExpense?: FinancialTransaction;
  currencyCode: string;
  periodMode?: PeriodMode;
}): string[] {
  const insights: string[] = [];
  const {
    period,
    previousPeriod,
    categories,
    previousCategories,
    topExpense,
    currencyCode,
    periodMode = "calendar",
  } = params;

  const periodLabel = periodMode === "payday" ? "ciclo" : "período";
  const previousLabel = periodMode === "payday" ? "ciclo anterior" : "período anterior";

  if (previousPeriod.expenses > 0) {
    const change =
      ((period.expenses - previousPeriod.expenses) / previousPeriod.expenses) * 100;
    const abs = Math.abs(change).toFixed(0);
    if (Math.abs(change) >= 1) {
      insights.push(
        change > 0
          ? `Você gastou ${abs}% a mais que no ${previousLabel}.`
          : `Você gastou ${abs}% a menos que no ${previousLabel}.`,
      );
    }
  } else if (period.expenses > 0 && previousPeriod.expenses === 0) {
    insights.push(`Este é o primeiro ${periodLabel} com despesas registradas para comparação.`);
  }

  if (topExpense) {
    insights.push(
      `Sua maior despesa foi "${topExpense.description}" (${formatCurrency(Math.abs(topExpense.amount), currencyCode)}).`,
    );
  }

  if (categories.length > 0) {
    const top = categories[0];
    insights.push(
      `${top.category} foi sua maior categoria (${top.percent.toFixed(0)}% dos gastos).`,
    );
  }

  const prevMap = new Map(previousCategories.map((c) => [c.category, c.total]));
  let maxGrowth = { category: "", growth: 0 };
  for (const cat of categories) {
    const prev = prevMap.get(cat.category) ?? 0;
    if (prev > 0) {
      const growth = ((cat.total - prev) / prev) * 100;
      if (growth > maxGrowth.growth) maxGrowth = { category: cat.category, growth };
    }
  }
  if (maxGrowth.growth >= 10) {
    insights.push(
      `${maxGrowth.category} cresceu ${maxGrowth.growth.toFixed(0)}% em relação ao ${previousLabel}.`,
    );
  }

  if (period.income > 0 || period.expenses > 0) {
    insights.push(
      period.net >= 0
        ? `Resultado positivo de ${formatCurrency(period.net, currencyCode)} no ${periodLabel}.`
        : `Déficit de ${formatCurrency(Math.abs(period.net), currencyCode)} no ${periodLabel}.`,
    );
  }

  return insights.slice(0, 5);
}

export const DASHBOARD_MONTH_OPTIONS = [1, 3, 6, 12] as const;
export type DashboardMonths = (typeof DASHBOARD_MONTH_OPTIONS)[number];

export function parseDashboardMonths(value: unknown): DashboardMonths {
  const n = Number(value);
  return (DASHBOARD_MONTH_OPTIONS as readonly number[]).includes(n)
    ? (n as DashboardMonths)
    : 1;
}

export interface PeriodRanges {
  currentKeys: string[];
  previousKeys: string[];
  currentRange: DateRange;
  previousRange: DateRange;
  periodMode: PeriodMode;
  currentLabel?: string;
}

export function resolvePeriodRanges(
  months: DashboardMonths,
  periodMode: PeriodMode,
  paydayDay: number | null,
): PeriodRanges {
  if (periodMode === "payday" && paydayDay !== null) {
    const currentKeys = getRecentPaydayCycles(months, paydayDay, 0);
    const previousKeys = getRecentPaydayCycles(months, paydayDay, months);
    const currentRange = paydayCyclesToDateRange(currentKeys, paydayDay);
    const previousRange = paydayCyclesToDateRange(previousKeys, paydayDay);
    const lastKey = currentKeys[currentKeys.length - 1];
    const currentLabel = lastKey
      ? formatPaydayCycleShortLabel(lastKey, paydayDay)
      : undefined;
    return {
      currentKeys,
      previousKeys,
      currentRange,
      previousRange,
      periodMode,
      currentLabel,
    };
  }

  const currentKeys = getRecentMonthKeys(months, 0);
  const previousKeys = getRecentMonthKeys(months, months);
  return {
    currentKeys,
    previousKeys,
    currentRange: monthKeysToDateRange(currentKeys),
    previousRange: monthKeysToDateRange(previousKeys),
    periodMode: "calendar",
  };
}

export function getCycleSummary(
  txs: FinancialTransaction[],
  cycleEndKey: string,
  paydayDay: number,
): MonthlySummary {
  const from = getPaydayCycleStart(cycleEndKey, paydayDay);
  const range = { from, to: cycleEndKey };
  const totals = summarizeTransactions(txs, range);
  return {
    month: cycleEndKey,
    label: formatPaydayCycleShortLabel(cycleEndKey, paydayDay),
    ...totals,
  };
}

export function getPaydayCycleSeries(
  txs: FinancialTransaction[],
  cycleEndKeys: string[],
  paydayDay: number,
): MonthlySummary[] {
  return cycleEndKeys.map((end) => getCycleSummary(txs, end, paydayDay));
}

export function buildCurrentCycleSummary(
  txs: FinancialTransaction[],
  paydayDay: number,
): {
  cycleKey: string;
  from: string;
  to: string;
  dayIndex: number;
  totalDays: number;
  daysRemaining: number;
  isComplete: boolean;
  income: number;
  expenses: number;
  net: number;
  salaryIncome: number;
  extraIncome: number;
} {
  const meta = getPaydayCycleRange(paydayDay);
  const range = { from: meta.from, to: meta.to };
  const totals = summarizeTransactions(txs, range);
  const incomeBreakdown = classifyIncome(txs, range, paydayDay);

  return {
    cycleKey: meta.cycleKey,
    from: meta.from,
    to: meta.to,
    dayIndex: meta.dayIndex,
    totalDays: meta.totalDays,
    daysRemaining: meta.daysRemaining,
    isComplete: meta.isComplete,
    income: totals.income,
    expenses: totals.expenses,
    net: totals.net,
    salaryIncome: incomeBreakdown.salary,
    extraIncome: incomeBreakdown.extra,
  };
}

function calcPeriodChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function diffDateKeys(from: string, to: string): number {
  const a = parseDateKey(from).getTime();
  const b = parseDateKey(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

export interface GrowthMetrics {
  savingsRate: number | null;
  expenseRatio: number | null;
  vsPrevious: {
    incomeChange: number | null;
    expenseChange: number | null;
    netChange: number | null;
  };
  incomeBreakdown: { salary: number; extra: number } | null;
  projection: {
    dailyAvgExpense: number;
    projectedExpense: number;
    projectedIncome: number;
    projectedNet: number;
    pendingSalary: number | null;
    salaryPending: boolean;
    daysElapsed: number;
    daysTotal: number;
    daysRemaining: number;
    isPartialPeriod: boolean;
  } | null;
}

const SALARY_CATEGORY = "Salário";

function sumCategoryInflowInRange(
  txs: FinancialTransaction[],
  range: DateRange,
  category: string,
): number {
  let total = 0;
  for (const tx of txs) {
    if (!countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description)) {
      continue;
    }
    if (isTransactionOutflow(tx.amount, tx.accountType)) continue;
    if (tx.category !== category) continue;

    const dateKey = toLocalDateKey(tx.date);
    if (range.from && dateKey < range.from) continue;
    if (range.to && dateKey > range.to) continue;
    total += Math.abs(tx.amount);
  }
  return total;
}

function estimatePendingCycleSalary(
  txs: FinancialTransaction[],
  previousRange: DateRange,
  paydayDay: number,
  receivedSalary: number,
): number | null {
  if (receivedSalary > 0) return null;

  let estimate = classifyIncome(txs, previousRange, paydayDay).salary;
  if (estimate <= 0) {
    estimate = sumCategoryInflowInRange(txs, previousRange, SALARY_CATEGORY);
  }

  if (estimate <= 0) {
    for (let offset = 2; offset <= 6; offset++) {
      const keys = getRecentPaydayCycles(1, paydayDay, offset);
      if (keys.length === 0) break;
      const range = paydayCyclesToDateRange(keys, paydayDay);
      estimate = classifyIncome(txs, range, paydayDay).salary;
      if (estimate <= 0) {
        estimate = sumCategoryInflowInRange(txs, range, SALARY_CATEGORY);
      }
      if (estimate > 0) break;
    }
  }

  return estimate > 0 ? estimate : null;
}

export function buildGrowthMetrics(params: {
  period: { income: number; expenses: number; net: number };
  previousPeriod: { income: number; expenses: number; net: number };
  currentRange: DateRange;
  previousRange: DateRange;
  txs: FinancialTransaction[];
  paydayDay: number | null;
  periodMode: PeriodMode;
}): GrowthMetrics {
  const { period, previousPeriod, currentRange, previousRange, txs, paydayDay, periodMode } = params;
  const { income, expenses, net } = period;

  const savingsRate = income > 0 ? (net / income) * 100 : null;
  const expenseRatio = income > 0 ? (expenses / income) * 100 : null;

  const vsPrevious = {
    incomeChange: calcPeriodChange(income, previousPeriod.income),
    expenseChange: calcPeriodChange(expenses, previousPeriod.expenses),
    netChange: calcPeriodChange(net, previousPeriod.net),
  };

  const incomeBreakdown =
    paydayDay !== null
      ? (() => {
          const range =
            periodMode === "payday"
              ? (() => {
                  const meta = getPaydayCycleRange(paydayDay);
                  return { from: meta.from, to: meta.to };
                })()
              : currentRange;
          const b = classifyIncome(txs, range, paydayDay);
          return { salary: b.salary, extra: b.extra };
        })()
      : null;

  let projection: GrowthMetrics["projection"] = null;
  const today = toLocalDateKey(new Date());

  const buildProjection = (
    projectionIncome: number,
    projectionExpenses: number,
    daysElapsed: number,
    daysTotal: number,
    receivedSalary: number,
  ) => {
    if (daysElapsed <= 0 || daysElapsed >= daysTotal) return null;

    const daysRemaining = daysTotal - daysElapsed;
    const dailyAvgExpense = projectionExpenses / daysElapsed;
    const projectedExpense = projectionExpenses + dailyAvgExpense * daysRemaining;

    let pendingSalary: number | null = null;
    if (periodMode === "payday" && paydayDay !== null) {
      pendingSalary = estimatePendingCycleSalary(
        txs,
        previousRange,
        paydayDay,
        receivedSalary,
      );
    }

    const projectedIncome = projectionIncome + (pendingSalary ?? 0);
    const salaryPending =
      periodMode === "payday" &&
      paydayDay !== null &&
      receivedSalary === 0 &&
      pendingSalary === null;

    return {
      dailyAvgExpense,
      projectedExpense,
      projectedIncome,
      projectedNet: projectedIncome - projectedExpense,
      pendingSalary,
      salaryPending,
      daysElapsed,
      daysTotal,
      daysRemaining,
      isPartialPeriod: true,
    };
  };

  if (periodMode === "payday" && paydayDay !== null) {
    const meta = getPaydayCycleRange(paydayDay);
    if (today >= meta.from && today <= meta.to) {
      const cycleTotals = summarizeTransactions(txs, { from: meta.from, to: meta.to });
      projection = buildProjection(
        cycleTotals.income,
        cycleTotals.expenses,
        meta.dayIndex,
        meta.totalDays,
        incomeBreakdown?.salary ?? 0,
      );
    }
  } else {
    const { from, to } = currentRange;
    if (from && to && today >= from && today <= to) {
      const daysTotal = diffDateKeys(from, to) + 1;
      const daysElapsed = diffDateKeys(from, today) + 1;
      projection = buildProjection(income, expenses, daysElapsed, daysTotal, 0);
    }
  }

  return { savingsRate, expenseRatio, vsPrevious, incomeBreakdown, projection };
}

