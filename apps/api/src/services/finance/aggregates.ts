import type { FinancialConnection, FinancialTransaction } from "./types.js";

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
    if (tx.amount > 0) income += tx.amount;
    else expenses += Math.abs(tx.amount);
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
    if (tx.amount >= 0) continue;
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
    .filter((tx) => tx.amount < 0)
    .sort((a, b) => a.amount - b.amount)
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
