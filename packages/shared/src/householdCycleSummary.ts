import type { CycleForecastBlock } from "./cycleForecast.js";
import { getNextPaydayCycle } from "./cycleForecast.js";
import {
  DEFAULT_PAYDAY_CYCLE_ANCHOR,
  formatPaydayCycleLabel,
  getPaydayCycleBounds,
  getPaydayCycleKey,
  getPaydayCycleRangeByKey,
  getRecentPaydayCycles,
  toLocalDateKey,
  type PaydayCycleAnchor,
} from "./payday.js";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface PersonCycleSummary {
  personId: string;
  personName: string;
  bankBalance: number;
  creditDebt: number;
  investmentBalance: number;
  investmentsIncluded: boolean;
  netWorth: number;
  realizedIncome: number;
  realizedExpenses: number;
  realizedNet: number;
  closingBalance: number;
  projectedSalaryIncome: number;
  pendingExpenses: number;
  /** Pagamentos de fatura de cartão projetados no ciclo. */
  pendingBillPayments: number;
}

export interface HouseholdCycleSummary {
  cycleKey: string;
  from: string;
  to: string;
  isComplete: boolean;
  isFuture: boolean;
  bankBalance: number;
  creditDebt: number;
  investmentBalance: number;
  investmentsIncluded: boolean;
  netWorth: number;
  realizedIncome: number;
  realizedExpenses: number;
  realizedNet: number;
  closingBalance: number;
  projectedSalaryIncome: number;
  pendingExpenses: number;
  pendingBillPayments: number;
  persons: PersonCycleSummary[];
}

export function computeNetWorth(input: {
  bankBalance: number;
  creditDebt: number;
  investmentBalance: number;
  investmentsIncluded: boolean;
}): number {
  const investments = input.investmentsIncluded ? input.investmentBalance : 0;
  return roundMoney(input.bankBalance - input.creditDebt + investments);
}

/** Caixa + renda prevista − contas/faturas ainda pendentes neste período. */
export function stillMineThisPeriod(input: {
  bankBalance: number;
  projectedSalaryIncome: number;
  pendingExpenses: number;
}): number {
  return roundMoney(input.bankBalance + input.projectedSalaryIncome - input.pendingExpenses);
}

export function cycleIncome(input: {
  realizedIncome: number;
  projectedSalaryIncome: number;
}): number {
  return roundMoney(input.realizedIncome + input.projectedSalaryIncome);
}

export function cycleExpenses(input: {
  realizedExpenses: number;
  pendingExpenses: number;
}): number {
  return roundMoney(input.realizedExpenses + input.pendingExpenses);
}

/** Renda do ciclo − gastos do ciclo (realizados + pendentes). Igual ao closingBalance. */
export function cycleSaved(input: {
  realizedIncome: number;
  realizedExpenses: number;
  projectedSalaryIncome: number;
  pendingExpenses: number;
}): number {
  return roundMoney(cycleIncome(input) - cycleExpenses(input));
}

/** (renda − gastos) / renda. Null quando não há renda no ciclo. */
export function savingsRate(input: {
  realizedIncome: number;
  realizedExpenses: number;
  projectedSalaryIncome: number;
  pendingExpenses: number;
}): number | null {
  const income = cycleIncome(input);
  if (income <= 0) return null;
  return cycleSaved(input) / income;
}

export interface NavigableCycle {
  cycleKey: string;
  from: string;
  to: string;
  label: string;
  isComplete: boolean;
  isFuture: boolean;
  isCurrent: boolean;
}

export function cycleForecastToPersonSummary(
  personId: string,
  personName: string,
  bankBalance: number,
  forecast: CycleForecastBlock,
  balances: {
    creditDebt?: number;
    investmentBalance?: number;
    includeInvestments?: boolean;
  } = {},
): PersonCycleSummary {
  const creditDebt = roundMoney(balances.creditDebt ?? 0);
  const investmentBalance = roundMoney(balances.investmentBalance ?? 0);
  const investmentsIncluded = balances.includeInvestments ?? true;
  const roundedBank = roundMoney(bankBalance);

  return {
    personId,
    personName,
    bankBalance: roundedBank,
    creditDebt,
    investmentBalance,
    investmentsIncluded,
    netWorth: computeNetWorth({
      bankBalance: roundedBank,
      creditDebt,
      investmentBalance,
      investmentsIncluded,
    }),
    realizedIncome: forecast.realizedIncome,
    realizedExpenses: forecast.realizedExpenses,
    realizedNet: forecast.realizedNet,
    closingBalance: forecast.closingBalance,
    projectedSalaryIncome: forecast.pendingIncome,
    pendingExpenses: forecast.pendingExpenses,
    pendingBillPayments: forecast.expenseBreakdown.creditBills,
  };
}

export function aggregateHouseholdCycleSummary(
  cycle: {
    cycleKey: string;
    from: string;
    to: string;
    isComplete: boolean;
    isFuture?: boolean;
  },
  persons: PersonCycleSummary[],
): HouseholdCycleSummary {
  const sum = (pick: (p: PersonCycleSummary) => number) =>
    roundMoney(persons.reduce((total, person) => total + pick(person), 0));

  return {
    cycleKey: cycle.cycleKey,
    from: cycle.from,
    to: cycle.to,
    isComplete: cycle.isComplete,
    isFuture: cycle.isFuture ?? false,
    bankBalance: sum((p) => p.bankBalance),
    creditDebt: sum((p) => p.creditDebt),
    investmentBalance: sum((p) => p.investmentBalance),
    investmentsIncluded: persons[0]?.investmentsIncluded ?? true,
    netWorth: sum((p) => p.netWorth),
    realizedIncome: sum((p) => p.realizedIncome),
    realizedExpenses: sum((p) => p.realizedExpenses),
    realizedNet: sum((p) => p.realizedNet),
    closingBalance: sum((p) => p.closingBalance),
    projectedSalaryIncome: sum((p) => p.projectedSalaryIncome),
    pendingExpenses: sum((p) => p.pendingExpenses),
    pendingBillPayments: sum((p) => p.pendingBillPayments),
    persons,
  };
}

/** Ciclos navegáveis: histórico recente + atual + próximo. */
export function buildNavigableCycles(
  paydayDay: number,
  anchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
  pastCount = 5,
): NavigableCycle[] {
  const today = toLocalDateKey(new Date());
  const currentKey = getPaydayCycleKey(paydayDay, anchor);
  const currentBounds = getPaydayCycleBounds(currentKey, paydayDay, anchor);

  const pastKeys = getRecentPaydayCycles(pastCount + 1, paydayDay, 0, anchor);
  const nextCycle = getNextPaydayCycle(
    { cycleKey: currentKey, from: currentBounds.from, to: currentBounds.to },
    paydayDay,
    anchor,
  );

  const cycles: NavigableCycle[] = pastKeys.map((key) => {
    const meta = getPaydayCycleRangeByKey(key, paydayDay, anchor);
    return {
      cycleKey: key,
      from: meta.from,
      to: meta.to,
      label: formatPaydayCycleLabel(meta.from, meta.to),
      isComplete: meta.isComplete,
      isFuture: false,
      isCurrent: key === currentKey && !meta.isComplete,
    };
  });

  const nextMeta = getPaydayCycleRangeByKey(nextCycle.cycleKey, paydayDay, anchor);
  cycles.push({
    cycleKey: nextCycle.cycleKey,
    from: nextCycle.from,
    to: nextCycle.to,
    label: formatPaydayCycleLabel(nextCycle.from, nextCycle.to),
    isComplete: nextMeta.isComplete,
    isFuture: today < nextCycle.from,
    isCurrent: false,
  });

  return cycles;
}

export function resolveSelectedCycleKey(
  navigableCycles: NavigableCycle[],
  requestedKey?: string,
): string {
  if (requestedKey && navigableCycles.some((cycle) => cycle.cycleKey === requestedKey)) {
    return requestedKey;
  }
  const current = navigableCycles.find((cycle) => cycle.isCurrent);
  if (current) return current.cycleKey;
  return navigableCycles[navigableCycles.length - 2]?.cycleKey ?? navigableCycles[0]!.cycleKey;
}
