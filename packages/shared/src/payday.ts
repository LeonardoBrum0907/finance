import { z } from "zod";

import {
  dashboardWidgetsPatchSchema,
  type DashboardWidgetsState,
} from "./dashboardWidgets";
import { countsTowardCashFlow, isTransactionOutflow } from "./transactions";



const TZ = "America/Sao_Paulo";



export const PERIOD_MODES = ["calendar", "payday"] as const;

export type PeriodMode = (typeof PERIOD_MODES)[number];



export const periodModeSchema = z.enum(PERIOD_MODES);



/** Posição do dia de pagamento no ciclo: início ou fim. */

export const PAYDAY_CYCLE_ANCHORS = ["end", "start"] as const;

export type PaydayCycleAnchor = (typeof PAYDAY_CYCLE_ANCHORS)[number];

export const DEFAULT_PAYDAY_CYCLE_ANCHOR: PaydayCycleAnchor = "end";



export const paydayCycleAnchorSchema = z.enum(PAYDAY_CYCLE_ANCHORS);

export const APP_THEMES = ["default", "comfy"] as const;
export type AppTheme = (typeof APP_THEMES)[number];
export const DEFAULT_APP_THEME: AppTheme = "default";
export const appThemeSchema = z.enum(APP_THEMES);

export function parseAppTheme(value: unknown): AppTheme {
  return value === "comfy" ? "comfy" : "default";
}

export const updateSettingsSchema = z.object({
  paydayDay: z.number().int().min(1).max(31).nullable().optional(),
  defaultPeriodMode: periodModeSchema.optional(),
  includeInvestmentsInNetWorth: z.boolean().optional(),
  theme: appThemeSchema.optional(),
  dashboardWidgets: dashboardWidgetsPatchSchema.optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export interface UserSettingsDTO {
  paydayDay: number | null;
  defaultPeriodMode: PeriodMode;
  paydayConfigured: boolean;
  includeInvestmentsInNetWorth: boolean;
  theme: AppTheme;
  dashboardWidgets: DashboardWidgetsState;
}



export interface PaydayCycleRange {

  /** Identificador do ciclo (data do pagamento no mês de referência). */

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

  personName?: string | null;

}



export function parsePeriodMode(value: unknown): PeriodMode {

  return value === "payday" ? "payday" : "calendar";

}



export function parsePaydayCycleAnchor(value: unknown): PaydayCycleAnchor {

  return value === "start" ? "start" : "end";

}



export function isPaydayDayConfigured(day: number | null | undefined): day is number {

  return day !== null && day !== undefined && day >= 1 && day <= 31;

}



export function describePaydayCycleBounds(

  paydayDay: number | string,

  anchor: PaydayCycleAnchor,

): string {

  const day = paydayDay || "X";

  if (anchor === "start") {

    return `do dia ${day} até a véspera do próximo pagamento (ex.: ${day} → dia anterior ao ${day})`;

  }

  return `do dia seguinte ao pagamento até o dia ${day} de cada mês (ex.: dia após ${day} → ${day})`;

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



function paydayDateInMonth(year: number, month: number, paydayDay: number): string {

  return formatDateKey(year, month, effectivePaydayInMonth(year, month, paydayDay));

}



/**

 * Fim do ciclo quando o pagamento é o último dia (âncora "end").

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

  return paydayDateInMonth(next.y, next.m, paydayDay);

}



/**

 * Início do ciclo quando o pagamento é o primeiro dia (âncora "start").

 * Ex.: payday 25 → em 24/jun o início é 25/mai; em 26/jun o início é 25/jun.

 */

export function getPaydayCycleStartKey(

  paydayDay: number,

  referenceDate: Date = new Date(),

): string {

  const refKey = toLocalDateKey(referenceDate);

  const { y, m, d } = parseDateKey(refKey);

  const effective = effectivePaydayInMonth(y, m, paydayDay);



  if (d >= effective) {

    return formatDateKey(y, m, effective);

  }



  const prev = addMonths(y, m, -1);

  return paydayDateInMonth(prev.y, prev.m, paydayDay);

}



/** Identificador canônico do ciclo que contém a data de referência. */

export function getPaydayCycleKey(

  paydayDay: number,

  anchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,

  referenceDate: Date = new Date(),

): string {

  return anchor === "start"

    ? getPaydayCycleStartKey(paydayDay, referenceDate)

    : getPaydayCycleEnd(paydayDay, referenceDate);

}



/** Início do ciclo quando o pagamento é o último dia (âncora "end"). */

export function getPaydayCycleStart(cycleEndKey: string, paydayDay: number): string {

  const { y, m } = parseDateKey(cycleEndKey);

  const prev = addMonths(y, m, -1);

  const prevEnd = paydayDateInMonth(prev.y, prev.m, paydayDay);

  return addDaysToKey(prevEnd, 1);

}



/** Fim do ciclo quando o pagamento é o primeiro dia (âncora "start"). */

export function getPaydayCycleEndFromStart(cycleStartKey: string, paydayDay: number): string {

  const { y, m } = parseDateKey(cycleStartKey);

  const next = addMonths(y, m, 1);

  const nextStart = paydayDateInMonth(next.y, next.m, paydayDay);

  return addDaysToKey(nextStart, -1);

}



export function getPaydayCycleBounds(

  cycleKey: string,

  paydayDay: number,

  anchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,

): { from: string; to: string } {

  if (anchor === "start") {

    return {

      from: cycleKey,

      to: getPaydayCycleEndFromStart(cycleKey, paydayDay),

    };

  }

  return {

    from: getPaydayCycleStart(cycleKey, paydayDay),

    to: cycleKey,

  };

}



export function getPaydayCycleRange(

  paydayDay: number,

  referenceDate: Date = new Date(),

  anchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,

): PaydayCycleRange {

  const cycleKey = getPaydayCycleKey(paydayDay, anchor, referenceDate);

  return getPaydayCycleRangeByKey(cycleKey, paydayDay, anchor, referenceDate);

}



/** Metadados de um ciclo específico identificado por cycleKey. */

export function getPaydayCycleRangeByKey(

  cycleKey: string,

  paydayDay: number,

  anchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,

  referenceDate: Date = new Date(),

): PaydayCycleRange {

  const refKey = toLocalDateKey(referenceDate);

  const { from, to } = getPaydayCycleBounds(cycleKey, paydayDay, anchor);

  const totalDays = diffDays(from, to) + 1;

  const isComplete = refKey > to;

  const dayIndex = isComplete

    ? totalDays

    : Math.min(totalDays, Math.max(1, diffDays(from, refKey) + 1));

  const daysRemaining = isComplete ? 0 : diffDays(refKey, to);



  return {

    cycleKey,

    from,

    to,

    dayIndex,

    totalDays,

    daysRemaining,

    isComplete,

  };

}



/** @deprecated Use getPaydayCycleRangeByKey */

export function getPaydayCycleRangeByEnd(

  cycleEndKey: string,

  paydayDay: number,

  referenceDate: Date = new Date(),

  anchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,

): PaydayCycleRange {

  return getPaydayCycleRangeByKey(cycleEndKey, paydayDay, anchor, referenceDate);

}



function offsetCycleKey(

  cycleKey: string,

  paydayDay: number,

  offset: number,

): string {

  let key = cycleKey;

  for (let i = 0; i < offset; i++) {

    const { y, m } = parseDateKey(key);

    const prev = addMonths(y, m, -1);

    key = paydayDateInMonth(prev.y, prev.m, paydayDay);

  }

  return key;

}

const MAX_CYCLE_OFFSET_LOOKUP = 120;

/**
 * Quantos ciclos `selectedCycleKey` está atrás do ciclo atual (0 = ciclo atual).
 * Retorna null se a chave não pertence a um ciclo recente válido.
 */
export function getPaydayCycleEndOffset(
  selectedCycleKey: string,
  paydayDay: number,
  anchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
): number | null {
  const currentKey = getPaydayCycleKey(paydayDay, anchor);
  if (selectedCycleKey === currentKey) return 0;

  let key = currentKey;
  for (let offset = 1; offset <= MAX_CYCLE_OFFSET_LOOKUP; offset++) {
    key = offsetCycleKey(key, paydayDay, 1);
    if (key === selectedCycleKey) return offset;
  }

  return null;
}

/**

 * Retorna chaves dos últimos `count` ciclos.

 * `endOffsetCycles`: quantos ciclos pular a partir do atual (0 = inclui o atual).

 */

export function getRecentPaydayCycles(

  count: number,

  paydayDay: number,

  endOffsetCycles = 0,

  anchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,

): string[] {

  const currentKey = getPaydayCycleKey(paydayDay, anchor);

  const anchorKey = offsetCycleKey(currentKey, paydayDay, endOffsetCycles);

  const keys: string[] = [];



  for (let i = count - 1; i >= 0; i--) {

    keys.push(offsetCycleKey(anchorKey, paydayDay, i));

  }

  return keys;

}



export function paydayCyclesToDateRange(

  cycleKeys: string[],

  paydayDay: number,

  anchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,

): {

  from?: string;

  to?: string;

} {

  if (cycleKeys.length === 0) return {};

  const firstBounds = getPaydayCycleBounds(cycleKeys[0]!, paydayDay, anchor);

  const lastBounds = getPaydayCycleBounds(cycleKeys[cycleKeys.length - 1]!, paydayDay, anchor);

  return {

    from: firstBounds.from,

    to: lastBounds.to,

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



export function formatPaydayCycleShortLabel(

  cycleKey: string,

  paydayDay: number,

  anchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,

): string {

  const { from, to } = getPaydayCycleBounds(cycleKey, paydayDay, anchor);

  return formatPaydayCycleLabel(from, to);

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

    if (!countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description, tx.personName)) {

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

const SALARY_HISTORY_CYCLES = 6;

export interface CycleSalaryProjectionMeta {
  cycleKey: string;
  from: string;
  to: string;
  isComplete: boolean;
}

export interface CycleSalaryProjection {
  projectedSalary: number;
  realizedSalary: number;
}

/**
 * Estima o salário que ainda cairá no ciclo atual quando a âncora é "end"
 * (pagamento no último dia) e o salário ainda não foi recebido.
 */
export function estimateUpcomingCycleSalary(
  txs: TransactionLike[],
  paydayDay: number,
  anchor: PaydayCycleAnchor,
  cycleMeta: CycleSalaryProjectionMeta,
  referenceDate: Date = new Date(),
): number {
  return estimateSalaryForCycle(txs, paydayDay, anchor, cycleMeta, referenceDate);
}

/**
 * Estima o salário pendente/esperado em um ciclo com base no último salário recebido.
 */
export function estimateSalaryForCycle(
  txs: TransactionLike[],
  paydayDay: number,
  anchor: PaydayCycleAnchor,
  cycleMeta: CycleSalaryProjectionMeta,
  referenceDate: Date = new Date(),
): number {
  if (cycleMeta.isComplete) return 0;

  const today = toLocalDateKey(referenceDate);
  const incomeRange =
    today > cycleMeta.to
      ? { from: cycleMeta.from, to: cycleMeta.to }
      : today < cycleMeta.from
        ? { from: cycleMeta.from, to: cycleMeta.from }
        : { from: cycleMeta.from, to: today };

  const partialBreakdown = classifyIncome(txs, incomeRange, paydayDay);
  if (partialBreakdown.salary > 0) return 0;

  for (let offset = 1; offset <= SALARY_HISTORY_CYCLES; offset++) {
    const prevKey = offsetCycleKey(cycleMeta.cycleKey, paydayDay, offset);
    const bounds = getPaydayCycleBounds(prevKey, paydayDay, anchor);
    const { salary } = classifyIncome(txs, bounds, paydayDay);
    if (salary > 0) return salary;
  }

  return 0;
}

export function resolveCycleSalaryProjection(
  txs: TransactionLike[],
  paydayDay: number,
  anchor: PaydayCycleAnchor,
  cycleMeta: CycleSalaryProjectionMeta,
  referenceDate: Date = new Date(),
): CycleSalaryProjection {
  const today = toLocalDateKey(referenceDate);
  const incomeRange =
    cycleMeta.isComplete || today > cycleMeta.to
      ? { from: cycleMeta.from, to: cycleMeta.to }
      : { from: cycleMeta.from, to: today };
  const partialBreakdown = classifyIncome(txs, incomeRange, paydayDay);
  const projectedSalary = estimateUpcomingCycleSalary(
    txs,
    paydayDay,
    anchor,
    cycleMeta,
    referenceDate,
  );

  return {
    projectedSalary,
    realizedSalary: partialBreakdown.salary,
  };
}

