import type { FinancialConnection, FinancialTransaction } from "./types.js";
import { isTransactionOutflow } from "@finance/shared";

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
    if (!isTransactionOutflow(tx.amount, tx.accountType)) continue;
    const category = tx.category ?? "Sem categoria";
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
    .filter((tx) => isTransactionOutflow(tx.amount, tx.accountType))
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
}): string[] {
  const insights: string[] = [];
  const { period, previousPeriod, categories, previousCategories, topExpense, currencyCode } =
    params;

  if (previousPeriod.expenses > 0) {
    const change =
      ((period.expenses - previousPeriod.expenses) / previousPeriod.expenses) * 100;
    const abs = Math.abs(change).toFixed(0);
    if (Math.abs(change) >= 1) {
      insights.push(
        change > 0
          ? `Você gastou ${abs}% a mais que no período anterior.`
          : `Você gastou ${abs}% a menos que no período anterior.`,
      );
    }
  } else if (period.expenses > 0 && previousPeriod.expenses === 0) {
    insights.push("Este é o primeiro período com despesas registradas para comparação.");
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
      `${maxGrowth.category} cresceu ${maxGrowth.growth.toFixed(0)}% em relação ao período anterior.`,
    );
  }

  if (period.income > 0 || period.expenses > 0) {
    insights.push(
      period.net >= 0
        ? `Resultado positivo de ${formatCurrency(period.net, currencyCode)} no período.`
        : `Déficit de ${formatCurrency(Math.abs(period.net), currencyCode)} no período.`,
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
