import type { FinancialConnection, FinancialTransaction } from "./types.js";
import {
  classifyIncome,
  DEFAULT_PAYDAY_CYCLE_ANCHOR,
  formatPaydayCycleShortLabel,
  getPaydayCycleBounds,
  getPaydayCycleRange,
  getPaydayCycleRangeByKey,
  getPaydayCycleEndOffset,
  getRecentPaydayCycles,
  paydayCyclesToDateRange,
  type PaydayCycleAnchor,
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

export function addDaysToDateKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
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
    if (!countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description, tx.personName)) {
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
    if (!countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description, tx.personName)) {
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
        countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description, tx.personName) &&
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
  committedExpenses?: number;
  availableNet?: number;
  pendingSalary?: number | null;
  salaryPending?: boolean;
  balanceWithSalary?: number;
  balanceAtPayday?: number;
}

export function summarizeTransactions(
  txs: FinancialTransaction[],
  range: DateRange,
): Omit<PeriodSummary, "months"> {
  const filtered = filterByDateRange(txs, range);
  let income = 0;
  let expenses = 0;
  for (const tx of filtered) {
    if (!countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description, tx.personName)) {
      continue;
    }
    const abs = Math.abs(tx.amount);
    if (isTransactionOutflow(tx.amount, tx.accountType)) expenses += abs;
    else income += abs;
  }
  return { income, expenses, net: income - expenses };
}

/** Separa gasto já realizado de cobranças futuras agendadas dentro do intervalo. */
export function summarizeCycleCashFlow(
  txs: FinancialTransaction[],
  range: DateRange,
  asOfKey: string,
): Omit<PeriodSummary, "months"> & { committedExpenses: number } {
  const effectiveTo = range.to && range.to < asOfKey ? range.to : asOfKey;
  const toDate = summarizeTransactions(txs, { from: range.from, to: effectiveTo });

  let committedExpenses = 0;
  if (range.to && asOfKey < range.to) {
    const committedFrom = addDaysToDateKey(asOfKey, 1);
    if (committedFrom <= range.to) {
      committedExpenses = summarizeTransactions(txs, {
        from: committedFrom,
        to: range.to,
      }).expenses;
    }
  }

  return {
    income: toDate.income,
    expenses: toDate.expenses,
    net: toDate.net,
    committedExpenses,
  };
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
    const untilNowBalance = period.balanceWithSalary ?? period.net;
    insights.push(
      untilNowBalance >= 0
        ? `Sobra de ${formatCurrency(untilNowBalance, currencyCode)} até agora neste ${periodLabel}.`
        : `Faltam ${formatCurrency(Math.abs(untilNowBalance), currencyCode)} até agora neste ${periodLabel}.`,
    );
    const committed = period.committedExpenses ?? 0;
    if (committed > 0 && period.availableNet !== undefined) {
      insights.push(
        period.availableNet >= 0
          ? `Depois dos agendamentos (${formatCurrency(committed, currencyCode)} a pagar), sobra de ${formatCurrency(period.availableNet, currencyCode)}.`
          : `Depois dos agendamentos (${formatCurrency(committed, currencyCode)} a pagar), faltam ${formatCurrency(Math.abs(period.availableNet), currencyCode)}.`,
      );
    }
    if (period.pendingSalary != null && period.pendingSalary > 0) {
      insights.push(
        `Salário previsto de ${formatCurrency(period.pendingSalary, currencyCode)} no pagamento.`,
      );
      if (period.balanceAtPayday !== undefined) {
        insights.push(
          period.balanceAtPayday >= 0
            ? `Até o pagamento, sobra de ${formatCurrency(period.balanceAtPayday, currencyCode)}.`
            : `Até o pagamento, faltam ${formatCurrency(Math.abs(period.balanceAtPayday), currencyCode)}.`,
        );
      }
    }
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
  /** Ciclos atrás do atual que termina o período (0 = ciclo atual). Só em modo payday. */
  endOffsetCycles?: number;
}

export function resolvePeriodRanges(
  months: DashboardMonths,
  periodMode: PeriodMode,
  paydayDay: number | null,
  paydayCycleAnchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
  anchorCycleKey?: string,
): PeriodRanges {
  if (periodMode === "payday" && paydayDay !== null) {
    let endOffset = 0;
    if (anchorCycleKey) {
      const computed = getPaydayCycleEndOffset(anchorCycleKey, paydayDay, paydayCycleAnchor);
      if (computed !== null) endOffset = computed;
    }

    const currentKeys = getRecentPaydayCycles(months, paydayDay, endOffset, paydayCycleAnchor);
    const previousKeys = getRecentPaydayCycles(months, paydayDay, months + endOffset, paydayCycleAnchor);
    const currentRange = paydayCyclesToDateRange(currentKeys, paydayDay, paydayCycleAnchor);
    const previousRange = paydayCyclesToDateRange(previousKeys, paydayDay, paydayCycleAnchor);
    const lastKey = currentKeys[currentKeys.length - 1];
    const currentLabel = lastKey
      ? formatPaydayCycleShortLabel(lastKey, paydayDay, paydayCycleAnchor)
      : undefined;
    return {
      currentKeys,
      previousKeys,
      currentRange,
      previousRange,
      periodMode,
      currentLabel,
      endOffsetCycles: endOffset,
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
  cycleKey: string,
  paydayDay: number,
  paydayCycleAnchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
): MonthlySummary {
  const { from, to } = getPaydayCycleBounds(cycleKey, paydayDay, paydayCycleAnchor);
  const range = { from, to };
  const totals = summarizeTransactions(txs, range);
  return {
    month: cycleKey,
    label: formatPaydayCycleShortLabel(cycleKey, paydayDay, paydayCycleAnchor),
    ...totals,
  };
}

export function getPaydayCycleSeries(
  txs: FinancialTransaction[],
  cycleKeys: string[],
  paydayDay: number,
  paydayCycleAnchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
): MonthlySummary[] {
  return cycleKeys.map((key) => getCycleSummary(txs, key, paydayDay, paydayCycleAnchor));
}

export function buildCycleSummary(
  txs: FinancialTransaction[],
  paydayDay: number,
  cycleKey?: string,
  paydayCycleAnchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
  manualCommittedExpenses = 0,
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
  committedExpenses: number;
  committedExpensesBank: number;
  committedExpensesManual: number;
  net: number;
  availableNet: number;
  pendingSalary: number | null;
  salaryPending: boolean;
  balanceWithSalary: number;
  balanceAtPayday: number;
  salaryIncome: number;
  extraIncome: number;
} {
  const meta = cycleKey
    ? getPaydayCycleRangeByKey(cycleKey, paydayDay, paydayCycleAnchor)
    : getPaydayCycleRange(paydayDay, new Date(), paydayCycleAnchor);
  const range = { from: meta.from, to: meta.to };
  const today = toLocalDateKey(new Date());

  const totals = meta.isComplete
    ? { ...summarizeTransactions(txs, range), committedExpenses: 0 }
    : summarizeCycleCashFlow(txs, range, today);

  const incomeRange =
    meta.isComplete || today > meta.to ? range : { from: meta.from, to: today };
  const incomeBreakdown = classifyIncome(txs, incomeRange, paydayDay);

  const bankCommitted = meta.isComplete ? 0 : totals.committedExpenses;
  const manualCommitted = meta.isComplete ? 0 : manualCommittedExpenses;
  const totalCommitted = bankCommitted + manualCommitted;
  const availableNet = totals.net - totalCommitted;

  let pendingSalary: number | null = null;
  let salaryPending = false;
  if (
    !meta.isComplete &&
    paydayCycleAnchor === "end" &&
    incomeBreakdown.salary === 0
  ) {
    const endOffset =
      getPaydayCycleEndOffset(meta.cycleKey, paydayDay, paydayCycleAnchor) ?? 0;
    const prevKeys = getRecentPaydayCycles(
      1,
      paydayDay,
      endOffset + 1,
      paydayCycleAnchor,
    );
    const previousRange = paydayCyclesToDateRange(prevKeys, paydayDay, paydayCycleAnchor);
    pendingSalary = estimatePendingCycleSalary(
      txs,
      previousRange,
      paydayDay,
      0,
      paydayCycleAnchor,
    );
    salaryPending = pendingSalary === null;
  }

  const pendingAmount = pendingSalary ?? 0;
  const balanceWithSalary = totals.net + pendingAmount;
  const balanceAtPayday = availableNet + pendingAmount;

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
    committedExpenses: totalCommitted,
    committedExpensesBank: bankCommitted,
    committedExpensesManual: manualCommitted,
    net: totals.net,
    availableNet,
    pendingSalary,
    salaryPending,
    balanceWithSalary,
    balanceAtPayday,
    salaryIncome: incomeBreakdown.salary,
    extraIncome: incomeBreakdown.extra,
  };
}

export type CycleSummary = ReturnType<typeof buildCycleSummary>;

export function buildCyclePeriodSummary(
  cycle: CycleSummary,
  months: DashboardMonths,
  paydayDay: number,
  paydayCycleAnchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
  periodMode: PeriodMode = "payday",
) {
  return {
    months,
    income: cycle.income,
    expenses: cycle.expenses,
    net: cycle.net,
    committedExpenses: cycle.committedExpenses,
    availableNet: cycle.availableNet,
    pendingSalary: cycle.pendingSalary,
    salaryPending: cycle.salaryPending,
    balanceWithSalary: cycle.balanceWithSalary,
    balanceAtPayday: cycle.balanceAtPayday,
    periodMode,
    from: cycle.from,
    to: cycle.to,
    label: formatPaydayCycleShortLabel(cycle.cycleKey, paydayDay, paydayCycleAnchor),
  };
}

export function buildCurrentCycleSummary(
  txs: FinancialTransaction[],
  paydayDay: number,
  paydayCycleAnchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
  manualCommittedExpenses = 0,
) {
  return buildCycleSummary(txs, paydayDay, undefined, paydayCycleAnchor, manualCommittedExpenses);
}

const RECENT_CYCLES_COUNT = 12;

export function buildRecentCycleSummaries(
  txs: FinancialTransaction[],
  paydayDay: number,
  count = RECENT_CYCLES_COUNT,
  paydayCycleAnchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
  manualCommittedByCycleKey?: Map<string, number>,
) {
  const keys = getRecentPaydayCycles(count, paydayDay, 0, paydayCycleAnchor);
  return keys.map((key) => {
    const manual = manualCommittedByCycleKey?.get(key) ?? 0;
    return buildCycleSummary(txs, paydayDay, key, paydayCycleAnchor, manual);
  });
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
    expensesToDate: number;
    committedExpenses: number;
    committedExpensesManual?: number;
    committedExpensesBank?: number;
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

const PACE_MIN_DAYS = 5;

const SALARY_CATEGORY = "Salário";

function sumCategoryInflowInRange(
  txs: FinancialTransaction[],
  range: DateRange,
  category: string,
): number {
  let total = 0;
  for (const tx of txs) {
    if (!countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description, tx.personName)) {
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
  paydayCycleAnchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
): number | null {
  if (receivedSalary > 0) return null;

  let estimate = classifyIncome(txs, previousRange, paydayDay).salary;
  if (estimate <= 0) {
    estimate = sumCategoryInflowInRange(txs, previousRange, SALARY_CATEGORY);
  }

  if (estimate <= 0) {
    for (let offset = 2; offset <= 6; offset++) {
      const keys = getRecentPaydayCycles(1, paydayDay, offset, paydayCycleAnchor);
      if (keys.length === 0) break;
      const range = paydayCyclesToDateRange(keys, paydayDay, paydayCycleAnchor);
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
  paydayCycleAnchor: PaydayCycleAnchor;
  periodMode: PeriodMode;
  manualCommittedExpenses?: number;
  /** Ciclo focado no modo payday (último de currentKeys quando months=1). */
  focusCycleKey?: string;
}): GrowthMetrics {
  const {
    period,
    previousPeriod,
    currentRange,
    previousRange,
    txs,
    paydayDay,
    paydayCycleAnchor,
    periodMode,
    manualCommittedExpenses = 0,
    focusCycleKey,
  } = params;
  const { income, expenses, net } = period;

  const savingsRate = income > 0 ? (net / income) * 100 : null;
  const expenseRatio = income > 0 ? (expenses / income) * 100 : null;

  const vsPrevious = {
    incomeChange: calcPeriodChange(income, previousPeriod.income),
    expenseChange: calcPeriodChange(expenses, previousPeriod.expenses),
    netChange: calcPeriodChange(net, previousPeriod.net),
  };

  const today = toLocalDateKey(new Date());

  const incomeBreakdown =
    paydayDay !== null
      ? (() => {
          const range =
            periodMode === "payday"
              ? (() => {
                  const meta = focusCycleKey
                    ? getPaydayCycleRangeByKey(focusCycleKey, paydayDay, paydayCycleAnchor)
                    : getPaydayCycleRange(paydayDay, new Date(), paydayCycleAnchor);
                  if (meta.isComplete || today > meta.to) {
                    return { from: meta.from, to: meta.to };
                  }
                  return { from: meta.from, to: today };
                })()
              : currentRange;
          const b = classifyIncome(txs, range, paydayDay);
          return { salary: b.salary, extra: b.extra };
        })()
      : null;

  let projection: GrowthMetrics["projection"] = null;

  const buildProjection = (
    projectionIncome: number,
    expensesToDate: number,
    committedExpensesBank: number,
    committedExpensesManual: number,
    daysElapsed: number,
    daysTotal: number,
    receivedSalary: number,
  ) => {
    if (daysElapsed <= 0 || daysElapsed >= daysTotal) return null;

    const committedExpenses = committedExpensesBank + committedExpensesManual;
    const daysRemaining = daysTotal - daysElapsed;
    const dailyAvgExpense = expensesToDate / daysElapsed;

    const previousExpenseTotal = summarizeTransactions(txs, previousRange).expenses;
    const previousDays =
      previousRange.from && previousRange.to
        ? diffDateKeys(previousRange.from, previousRange.to) + 1
        : daysTotal;
    const previousDailyAvg = previousDays > 0 ? previousExpenseTotal / previousDays : 0;

    const variableProjection =
      daysElapsed >= PACE_MIN_DAYS
        ? dailyAvgExpense * daysRemaining
        : previousDailyAvg * daysRemaining;

    const projectedExpense = expensesToDate + committedExpenses + variableProjection;

    let pendingSalary: number | null = null;
    if (periodMode === "payday" && paydayDay !== null) {
      pendingSalary = estimatePendingCycleSalary(
        txs,
        previousRange,
        paydayDay,
        receivedSalary,
        paydayCycleAnchor,
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
      expensesToDate,
      committedExpenses,
      committedExpensesBank,
      committedExpensesManual,
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
    const meta = focusCycleKey
      ? getPaydayCycleRangeByKey(focusCycleKey, paydayDay, paydayCycleAnchor)
      : getPaydayCycleRange(paydayDay, new Date(), paydayCycleAnchor);
    if (!meta.isComplete && today >= meta.from && today <= meta.to) {
      const cycleCash = summarizeCycleCashFlow(
        txs,
        { from: meta.from, to: meta.to },
        today,
      );
      const incomeRange = { from: meta.from, to: today };
      const salaryReceived = classifyIncome(txs, incomeRange, paydayDay).salary;
      projection = buildProjection(
        cycleCash.income,
        cycleCash.expenses,
        cycleCash.committedExpenses,
        manualCommittedExpenses,
        meta.dayIndex,
        meta.totalDays,
        salaryReceived,
      );
    }
  } else {
    const { from, to } = currentRange;
    if (from && to && today >= from && today <= to) {
      const daysTotal = diffDateKeys(from, to) + 1;
      const daysElapsed = diffDateKeys(from, today) + 1;
      const toDateTotals = summarizeTransactions(txs, { from, to: today });
      const committedFrom = addDaysToDateKey(today, 1);
      let bankCommitted = 0;
      if (committedFrom <= to) {
        bankCommitted = summarizeTransactions(txs, { from: committedFrom, to }).expenses;
      }
      projection = buildProjection(
        toDateTotals.income,
        toDateTotals.expenses,
        bankCommitted,
        manualCommittedExpenses,
        daysElapsed,
        daysTotal,
        0,
      );
    }
  }

  return { savingsRate, expenseRatio, vsPrevious, incomeBreakdown, projection };
}

