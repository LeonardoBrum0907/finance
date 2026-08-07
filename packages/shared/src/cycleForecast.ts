import {
  countsTowardCashFlow,
  isTransactionOutflow,
} from "./transactions.js";
import {
  buildSimulationPaydayCycles,
  type PaydayCycleInput,
  type SimulatedPurchase,
} from "./simulation.js";
import {
  classifyIncome,
  estimateSalaryForCycle,
  getPaydayCycleRange,
  type PaydayCycleAnchor,
  type TransactionLike,
  toLocalDateKey,
  DEFAULT_PAYDAY_CYCLE_ANCHOR,
} from "./payday.js";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isDateInRange(dateKey: string, from: string, to: string): boolean {
  return dateKey >= from && dateKey <= to;
}

export interface CycleForecastExpenseBreakdown {
  recurring: number;
  installments: number;
  simulations: number;
  bank: number;
  /** Pagamentos de fatura de cartão com vencimento no ciclo (caixa). */
  creditBills: number;
}

export interface CycleForecastExpenseItem {
  id: string;
  title: string;
  dueDate: string;
  amount: number;
  kind: "recurring" | "installments" | "simulations" | "bank" | "creditBills";
}

export interface CycleForecastBlock {
  cycleKey: string;
  from: string;
  to: string;
  isComplete: boolean;
  realizedIncome: number;
  realizedExpenses: number;
  realizedNet: number;
  /** Salário pendente (ciclo atual) ou esperado (próximo ciclo). */
  pendingIncome: number;
  pendingExpenses: number;
  /** realizedNet + pendingIncome - pendingExpenses (inclui creditBills). */
  closingBalance: number;
  expenseBreakdown: CycleForecastExpenseBreakdown;
  expenseItems: CycleForecastExpenseItem[];
  salaryKnown: boolean;
}

export interface CycleForecastPair {
  current: CycleForecastBlock;
  next: CycleForecastBlock;
}

export interface CycleForecastPendingInput {
  recurring?: number;
  installments?: number;
  simulations?: number;
  bank?: number;
  creditBills?: number;
  items?: CycleForecastExpenseItem[];
}

export function summarizeForecastCashFlow(
  txs: TransactionLike[],
  range: { from: string; to: string },
  asOfKey: string,
): { income: number; expenses: number; net: number; bankCommitted: number } {
  const effectiveTo = range.to < asOfKey ? range.to : asOfKey;
  const realized = summarizeForecastTransactions(txs, { from: range.from, to: effectiveTo });

  let bankCommitted = 0;
  if (asOfKey < range.to) {
    const committedFrom = addDaysToDateKey(asOfKey, 1);
    if (committedFrom <= range.to) {
      bankCommitted = summarizeForecastTransactions(txs, {
        from: committedFrom,
        to: range.to,
      }).expenses;
    }
  }

  return {
    income: realized.income,
    expenses: realized.expenses,
    net: realized.net,
    bankCommitted,
  };
}

export function summarizeForecastTransactions(
  txs: TransactionLike[],
  range: { from?: string; to?: string },
): { income: number; expenses: number; net: number } {
  let income = 0;
  let expenses = 0;

  for (const tx of txs) {
    const dateKey = toLocalDateKey(tx.date);
    if (range.from && dateKey < range.from) continue;
    if (range.to && dateKey > range.to) continue;
    if (
      !countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description, tx.personName)
    ) {
      continue;
    }
    const abs = Math.abs(tx.amount);
    if (isTransactionOutflow(tx.amount, tx.accountType)) expenses += abs;
    else income += abs;
  }

  return {
    income: roundMoney(income),
    expenses: roundMoney(expenses),
    net: roundMoney(income - expenses),
  };
}

export function getNextPaydayCycle(
  currentCycle: PaydayCycleInput,
  paydayDay: number,
  anchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
): PaydayCycleInput {
  const cycles = buildSimulationPaydayCycles(currentCycle, paydayDay, anchor, 2);
  return cycles[1]!;
}

export function buildPendingExpensesFromPurchases(
  purchases: SimulatedPurchase[],
  range: { from: string; to: string },
  today: string,
  kind: CycleForecastExpenseItem["kind"],
): { total: number; items: CycleForecastExpenseItem[] } {
  let total = 0;
  const items: CycleForecastExpenseItem[] = [];

  for (const purchase of purchases) {
    for (const inst of purchase.installments) {
      if (!isDateInRange(inst.dueDate, range.from, range.to)) continue;
      if (inst.dueDate <= today) continue;
      total = roundMoney(total + inst.amount);
      items.push({
        id: inst.id,
        title: purchase.title,
        dueDate: inst.dueDate,
        amount: inst.amount,
        kind,
      });
    }
  }

  return { total, items };
}

export function buildCycleForecastBlock(params: {
  txs: TransactionLike[];
  cycle: PaydayCycleInput & { isComplete?: boolean };
  paydayDay: number;
  anchor?: PaydayCycleAnchor;
  today: string;
  pending?: CycleForecastPendingInput;
  includeSimulations?: boolean;
}): CycleForecastBlock {
  const {
    txs,
    cycle,
    paydayDay,
    anchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
    today,
    pending = {},
    includeSimulations = true,
  } = params;

  const isComplete = cycle.isComplete ?? today > cycle.to;
  const cashFlow = summarizeForecastCashFlow(txs, { from: cycle.from, to: cycle.to }, today);

  const incomeBreakdown = classifyIncome(
    txs,
    isComplete || today > cycle.to
      ? { from: cycle.from, to: cycle.to }
      : { from: cycle.from, to: today < cycle.from ? cycle.from : today },
    paydayDay,
  );

  const pendingIncome = estimateSalaryForCycle(txs, paydayDay, anchor, {
    cycleKey: cycle.cycleKey,
    from: cycle.from,
    to: cycle.to,
    isComplete,
  });

  const bank = pending.bank ?? cashFlow.bankCommitted;
  const recurring = pending.recurring ?? 0;
  const installments = pending.installments ?? 0;
  const simulations = includeSimulations ? (pending.simulations ?? 0) : 0;
  const creditBills = pending.creditBills ?? 0;

  const expenseBreakdown: CycleForecastExpenseBreakdown = {
    recurring: roundMoney(recurring),
    installments: roundMoney(installments),
    simulations: roundMoney(simulations),
    bank: roundMoney(bank),
    creditBills: roundMoney(creditBills),
  };

  const pendingExpenses = roundMoney(
    expenseBreakdown.recurring +
      expenseBreakdown.installments +
      expenseBreakdown.simulations +
      expenseBreakdown.bank +
      expenseBreakdown.creditBills,
  );

  const realizedIncome = roundMoney(incomeBreakdown.salary + incomeBreakdown.extra);
  const realizedExpenses = cashFlow.expenses;
  const realizedNet = roundMoney(realizedIncome - realizedExpenses);
  const closingBalance = roundMoney(realizedNet + pendingIncome - pendingExpenses);

  const expenseItems = [...(pending.items ?? [])].filter(
    (item) => includeSimulations || item.kind !== "simulations",
  );

  const salaryKnown = pendingIncome > 0 || incomeBreakdown.salary > 0;

  return {
    cycleKey: cycle.cycleKey,
    from: cycle.from,
    to: cycle.to,
    isComplete,
    realizedIncome,
    realizedExpenses,
    realizedNet,
    pendingIncome: roundMoney(pendingIncome),
    pendingExpenses,
    closingBalance,
    expenseBreakdown,
    expenseItems,
    salaryKnown,
  };
}

export function buildCycleForecastPair(params: {
  txs: TransactionLike[];
  currentCycle: PaydayCycleInput & { isComplete?: boolean };
  paydayDay: number;
  anchor?: PaydayCycleAnchor;
  today: string;
  currentPending?: CycleForecastPendingInput;
  nextPending?: CycleForecastPendingInput;
  includeSimulations?: boolean;
}): CycleForecastPair {
  const nextCycle = getNextPaydayCycle(
    params.currentCycle,
    params.paydayDay,
    params.anchor ?? DEFAULT_PAYDAY_CYCLE_ANCHOR,
  );

  return {
    current: buildCycleForecastBlock({
      txs: params.txs,
      cycle: params.currentCycle,
      paydayDay: params.paydayDay,
      anchor: params.anchor,
      today: params.today,
      pending: params.currentPending,
      includeSimulations: params.includeSimulations,
    }),
    next: buildCycleForecastBlock({
      txs: params.txs,
      cycle: { ...nextCycle, isComplete: false },
      paydayDay: params.paydayDay,
      anchor: params.anchor,
      today: params.today,
      pending: params.nextPending,
      includeSimulations: params.includeSimulations,
    }),
  };
}

/** Impacto de compras simuladas separado por tipo de conta gerenciada. */
export function splitPurchaseImpactsByKind(
  purchases: Array<SimulatedPurchase & { accountKind?: string }>,
  cycle: PaydayCycleInput,
  today: string,
): CycleForecastPendingInput {
  const recurringPurchases = purchases.filter((p) => p.accountKind === "fixed_recurring");
  const installmentPurchases = purchases.filter((p) => p.accountKind === "installment_plan");
  const simulationPurchases = purchases.filter((p) => p.accountKind === "simulation");

  const recurring = buildPendingExpensesFromPurchases(
    recurringPurchases,
    cycle,
    today,
    "recurring",
  );
  const installments = buildPendingExpensesFromPurchases(
    installmentPurchases,
    cycle,
    today,
    "installments",
  );
  const simulations = buildPendingExpensesFromPurchases(
    simulationPurchases,
    cycle,
    today,
    "simulations",
  );

  return {
    recurring: recurring.total,
    installments: installments.total,
    simulations: simulations.total,
    items: [...recurring.items, ...installments.items, ...simulations.items],
  };
}

/** Resolve o ciclo atual a partir do payday configurado. */
export function resolveCurrentPaydayCycle(
  paydayDay: number,
  anchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
  referenceDate: Date = new Date(),
): PaydayCycleInput & { isComplete: boolean } {
  const range = getPaydayCycleRange(paydayDay, referenceDate, anchor);
  return {
    cycleKey: range.cycleKey,
    from: range.from,
    to: range.to,
    isComplete: range.isComplete,
  };
}
