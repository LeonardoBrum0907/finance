import { z } from "zod";
import { countsTowardCashFlow, isTransactionOutflow } from "./transactions";

const TZ = "America/Sao_Paulo";

export const PERIOD_MODES = ["calendar", "payday"] as const;
export type PeriodMode = (typeof PERIOD_MODES)[number];

export const periodModeSchema = z.enum(PERIOD_MODES);

export const updateSettingsSchema = z.object({
  paydayDay: z.number().int().min(1).max(31).nullable().optional(),
  defaultPeriodMode: periodModeSchema.optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export interface UserSettingsDTO {
  paydayDay: number | null;
  defaultPeriodMode: PeriodMode;
  paydayConfigured: boolean;
}

export interface PaydayCycleRange {
  /** Data de fim do ciclo (dia do pagamento). */
  cycleKey: string;
  from: string;
  to: string;
  dayIndex: number;
  totalDays: number;
  daysRemaining: number;
  isComplete: boolean;
}

export interface IncomeBreakdown {
  salary: number;
  extra: number;
  total: number;
}

export interface TransactionLike {
  date: Date;
  amount: number;
  accountType: string | null;
  category: string | null;
  description?: string | null;
}

export function parsePeriodMode(value: unknown): PeriodMode {
  return value === "payday" ? "payday" : "calendar";
}

export function toLocalDateKey(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: TZ });
}

function parseDateKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
}

function formatDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Dia efetivo do payday em um mês (ex.: 31 em abril vira 30). */
export function effectivePaydayInMonth(year: number, month: number, paydayDay: number): number {
  return Math.min(paydayDay, daysInMonth(year, month));
}

function addMonths(year: number, month: number, delta: number): { y: number; m: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

function diffDays(fromKey: string, toKey: string): number {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  const fromMs = Date.UTC(from.y, from.m - 1, from.d);
  const toMs = Date.UTC(to.y, to.m - 1, to.d);
  return Math.round((toMs - fromMs) / 86_400_000);
}

function addDaysToKey(key: string, days: number): string {
  const { y, m, d } = parseDateKey(key);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return formatDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * Fim do ciclo (dia do pagamento) que contém a data de referência.
 * Ex.: payday 25 → em 24/jun o fim é 25/jun; em 26/jun o fim é 25/jul.
 */
export function getPaydayCycleEnd(paydayDay: number, referenceDate: Date = new Date()): string {
  const refKey = toLocalDateKey(referenceDate);
  const { y, m, d } = parseDateKey(refKey);
  const effective = effectivePaydayInMonth(y, m, paydayDay);

  if (d <= effective) {
    return formatDateKey(y, m, effective);
  }

  const next = addMonths(y, m, 1);
  return formatDateKey(
    next.y,
    next.m,
    effectivePaydayInMonth(next.y, next.m, paydayDay),
  );
}

/** Início do ciclo: dia seguinte ao pagamento do mês anterior. */
export function getPaydayCycleStart(cycleEndKey: string, paydayDay: number): string {
  const { y, m } = parseDateKey(cycleEndKey);
  const prev = addMonths(y, m, -1);
  const prevEnd = formatDateKey(
    prev.y,
    prev.m,
    effectivePaydayInMonth(prev.y, prev.m, paydayDay),
  );
  return addDaysToKey(prevEnd, 1);
}

export function getPaydayCycleRange(
  paydayDay: number,
  referenceDate: Date = new Date(),
): PaydayCycleRange {
  const refKey = toLocalDateKey(referenceDate);
  const to = getPaydayCycleEnd(paydayDay, referenceDate);
  const from = getPaydayCycleStart(to, paydayDay);
  const totalDays = diffDays(from, to) + 1;
  const dayIndex = Math.min(totalDays, Math.max(1, diffDays(from, refKey) + 1));
  const isComplete = refKey > to;
  const daysRemaining = isComplete ? 0 : diffDays(refKey, to);

  return {
    cycleKey: to,
    from,
    to,
    dayIndex,
    totalDays,
    daysRemaining,
    isComplete,
  };
}

/** Retrocede N ciclos a partir da data de fim do ciclo atual. */
function offsetCycleEnd(cycleEndKey: string, paydayDay: number, offset: number): string {
  let end = cycleEndKey;
  for (let i = 0; i < offset; i++) {
    const { y, m } = parseDateKey(end);
    const prev = addMonths(y, m, -1);
    end = formatDateKey(
      prev.y,
      prev.m,
      effectivePaydayInMonth(prev.y, prev.m, paydayDay),
    );
  }
  return end;
}

/**
 * Retorna chaves de fim (dia do pagamento) dos últimos `count` ciclos.
 * `endOffsetCycles`: quantos ciclos pular a partir do atual (0 = inclui o atual).
 */
export function getRecentPaydayCycles(
  count: number,
  paydayDay: number,
  endOffsetCycles = 0,
): string[] {
  const currentEnd = getPaydayCycleEnd(paydayDay);
  const anchorEnd = offsetCycleEnd(currentEnd, paydayDay, endOffsetCycles);
  const keys: string[] = [];

  for (let i = count - 1; i >= 0; i--) {
    keys.push(offsetCycleEnd(anchorEnd, paydayDay, i));
  }
  return keys;
}

export function paydayCyclesToDateRange(cycleEndKeys: string[], paydayDay: number): {
  from?: string;
  to?: string;
} {
  if (cycleEndKeys.length === 0) return {};
  const firstEnd = cycleEndKeys[0];
  const lastEnd = cycleEndKeys[cycleEndKeys.length - 1];
  return {
    from: getPaydayCycleStart(firstEnd, paydayDay),
    to: lastEnd,
  };
}

const MONTH_NAMES_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function formatPaydayCycleLabel(fromKey: string, toKey: string): string {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  return `${from.d} ${MONTH_NAMES_SHORT[from.m - 1]} – ${to.d} ${MONTH_NAMES_SHORT[to.m - 1]}`;
}

export function formatPaydayCycleShortLabel(cycleEndKey: string, paydayDay: number): string {
  const from = getPaydayCycleStart(cycleEndKey, paydayDay);
  return formatPaydayCycleLabel(from, cycleEndKey);
}

const SALARY_CATEGORY = "Salário";
const PAYDAY_TOLERANCE_DAYS = 2;

function isNearPayday(dateKey: string, paydayDay: number): boolean {
  const { y, m, d } = parseDateKey(dateKey);
  const effective = effectivePaydayInMonth(y, m, paydayDay);
  return Math.abs(d - effective) <= PAYDAY_TOLERANCE_DAYS;
}

export function classifyIncome(
  txs: TransactionLike[],
  range: { from?: string; to?: string },
  paydayDay: number,
): IncomeBreakdown {
  let salary = 0;
  let extra = 0;

  for (const tx of txs) {
    if (!countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description)) {
      continue;
    }
    if (isTransactionOutflow(tx.amount, tx.accountType)) continue;

    const dateKey = toLocalDateKey(tx.date);
    if (range.from && dateKey < range.from) continue;
    if (range.to && dateKey > range.to) continue;

    const abs = Math.abs(tx.amount);
    const isSalary =
      tx.category === SALARY_CATEGORY && isNearPayday(dateKey, paydayDay);

    if (isSalary) salary += abs;
    else extra += abs;
  }

  return { salary, extra, total: salary + extra };
}
