import {
  accountNetWorthContribution,
  getPaydayCycleRange,
  getRecentPaydayCycles,
  isCreditAccount,
  paydayCyclesToDateRange,
  type BudgetStatus,
  type SimulationInput,
  type SimulationResultDTO,
  type SimulationVerdict,
  type SimulatorBaselineDTO,
  type PaydayCycleAnchor,
  type CardForCycleBills,
} from "@finance/shared";
import { prisma } from "../../prisma.js";
import { effectiveTransactionCategory } from "../transactionCategory.js";
import { resolveNextDueDate } from "./creditBill.js";
import {
  formatCurrency,
  getCycleSummary,
  getMonthlySummary,
  getRecentMonthKeys,
  getSpendingByCategory,
  monthKeysToDateRange,
  toLocalMonthKey,
} from "./aggregates.js";
import { buildDashboardCycleForecasts } from "./cycleForecasts.js";
import { loadCardsForUser } from "./creditCardBills.js";
import { loadGoalsSummaryForUser } from "./goalsContext.js";
import {
  resolveMonthlyContribution,
  resolveSurplus,
} from "./projections.js";
import type { FinancialTransaction } from "./types.js";
import { loadUserSettings, resolvePaydayCycle } from "../userSettings.js";

const PROJECTION_HORIZON = 12;
const DISCLAIMER =
  "Simulação baseada nos seus dados atuais. Não constitui assessoria financeira.";

interface SimulatorContext {
  userId: string;
  personId?: string;
  settings: Awaited<ReturnType<typeof loadUserSettings>>;
  paydayDay: number | null;
  paydayCycleAnchor: PaydayCycleAnchor;
  txs: FinancialTransaction[];
  bankBalance: number;
  creditAccounts: {
    id: string;
    name: string;
    personName: string;
    type: string | null;
    balanceCloseDate: Date | null;
    balanceDueDate: Date | null;
    nextBillAmount: number | null;
    nextBillDueDate: string | null;
  }[];
  hasAccounts: boolean;
  creditCards: CardForCycleBills[];
}

async function loadRecentTransactions(
  userId: string,
  paydayDay: number | null,
  personId?: string,
  paydayCycleAnchor?: PaydayCycleAnchor,
): Promise<FinancialTransaction[]> {
  const range =
    paydayDay !== null
      ? paydayCyclesToDateRange(
          getRecentPaydayCycles(4, paydayDay, 0, paydayCycleAnchor),
          paydayDay,
          paydayCycleAnchor,
        )
      : monthKeysToDateRange(getRecentMonthKeys(3));

  const dateFrom = range.from ? new Date(`${range.from}T00:00:00.000Z`) : new Date(0);
  const dateTo = range.to ? new Date(`${range.to}T23:59:59.999Z`) : new Date();

  const people = await prisma.person.findMany({
    where: {
      userId,
      ...(personId ? { id: personId } : {}),
    },
    include: {
      connections: {
        include: {
          accounts: {
            include: {
              transactions: {
                where: { date: { gte: dateFrom, lte: dateTo } },
                orderBy: { date: "desc" },
              },
            },
          },
        },
      },
    },
  });

  const transactions: FinancialTransaction[] = [];
  for (const person of people) {
    for (const connection of person.connections) {
      for (const acc of connection.accounts) {
        for (const tx of acc.transactions) {
          transactions.push({
            id: tx.id,
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            currencyCode: tx.currencyCode,
            category: effectiveTransactionCategory(tx),
            accountId: acc.id,
            accountName: acc.name,
            accountType: acc.type,
            personId: person.id,
            personName: person.name,
          });
        }
      }
    }
  }

  return transactions;
}

async function loadSimulatorContext(
  userId: string,
  personId?: string,
): Promise<SimulatorContext> {
  const settings = await loadUserSettings(userId);
  const { paydayDay, paydayCycleAnchor } = await resolvePaydayCycle(userId, personId);
  const txs = await loadRecentTransactions(
    userId,
    paydayDay,
    personId,
    paydayCycleAnchor,
  );

  const people = await prisma.person.findMany({
    where: {
      userId,
      ...(personId ? { id: personId } : {}),
    },
    include: {
      connections: {
        include: {
          accounts: {
            include: {
              transactions: { orderBy: { date: "desc" }, take: 500 },
            },
          },
        },
      },
    },
  });

  let bankBalance = 0;
  let hasAccounts = false;
  const creditAccounts: SimulatorContext["creditAccounts"] = [];

  for (const person of people) {
    for (const conn of person.connections) {
      for (const acc of conn.accounts) {
        hasAccounts = true;
        const contribution = accountNetWorthContribution(acc.balance, acc.type);

        if (!isCreditAccount(acc.type)) {
          if (!acc.type || acc.type !== "INVESTMENT") {
            bankBalance += contribution;
          }
        } else {
          const openBillAmount =
            Math.abs(acc.balance) > 0 ? Math.abs(acc.balance) : null;
          const openBillDueDate = resolveNextDueDate(acc.balanceDueDate);
          creditAccounts.push({
            id: acc.id,
            name: acc.name,
            personName: person.name,
            type: acc.type,
            balanceCloseDate: acc.balanceCloseDate,
            balanceDueDate: acc.balanceDueDate,
            nextBillAmount: openBillAmount,
            nextBillDueDate:
              openBillDueDate?.toISOString() ?? acc.balanceDueDate?.toISOString() ?? null,
          });
        }
      }
    }
  }

  const creditCards = await loadCardsForUser(userId, personId, txs);

  return {
    userId,
    personId,
    settings,
    paydayDay,
    paydayCycleAnchor,
    txs,
    bankBalance,
    creditAccounts,
    hasAccounts,
    creditCards,
  };
}

function computeAverageIncomeExpenses(
  txs: FinancialTransaction[],
  paydayDay: number | null,
  paydayCycleAnchor: PaydayCycleAnchor,
): { income: number; expenses: number } {
  if (paydayDay !== null) {
    const cycles = getRecentPaydayCycles(3, paydayDay, 0, paydayCycleAnchor);
    if (cycles.length === 0) return { income: 0, expenses: 0 };
    const summaries = cycles.map((start) =>
      getCycleSummary(txs, start, paydayDay, paydayCycleAnchor),
    );
    const count = summaries.length;
    return {
      income: summaries.reduce((s, x) => s + x.income, 0) / count,
      expenses: summaries.reduce((s, x) => s + x.expenses, 0) / count,
    };
  }

  const months = getRecentMonthKeys(3);
  if (months.length === 0) return { income: 0, expenses: 0 };
  const summaries = months.map((m) => getMonthlySummary(txs, m));
  const count = summaries.length;
  return {
    income: summaries.reduce((s, x) => s + x.income, 0) / count,
    expenses: summaries.reduce((s, x) => s + x.expenses, 0) / count,
  };
}

async function computeCurrentSurplus(
  ctx: SimulatorContext,
  userId: string,
): Promise<number> {
  const { settings, txs, paydayDay, paydayCycleAnchor: anchor, personId } = ctx;
  const periodMode = settings.defaultPeriodMode;

  if (periodMode === "payday" && paydayDay !== null) {
    const forecasts = await buildDashboardCycleForecasts(
      txs,
      userId,
      paydayDay,
      anchor,
      personId,
      true,
      ctx.creditCards,
    );
    return forecasts.current.closingBalance;
  }

  return getMonthlySummary(txs, toLocalMonthKey(new Date())).net;
}

function computeInstallmentSchedule(
  total: number,
  installments: number,
  interestRate?: number,
): number[] {
  if (!interestRate || interestRate <= 0) {
    const parcel = total / installments;
    return Array.from({ length: installments }, () => parcel);
  }

  const monthlyRate = interestRate / 100;
  const factor = Math.pow(1 + monthlyRate, installments);
  const payment = (total * monthlyRate * factor) / (factor - 1);
  return Array.from({ length: installments }, () => payment);
}

function computeVerdict(params: {
  scenarioSurplus: number;
  monthsDelayed: number | null;
  bankBalanceAfter: number | null;
  savingsReductionRatio: number;
  budgetExceeded: boolean;
}): SimulationVerdict {
  const { scenarioSurplus, monthsDelayed, bankBalanceAfter, savingsReductionRatio, budgetExceeded } =
    params;

  const anyNegative = scenarioSurplus < 0;
  const insufficientBalance = bankBalanceAfter !== null && bankBalanceAfter < 0;

  if (anyNegative || insufficientBalance || (monthsDelayed ?? 0) > 3) {
    return "risky";
  }

  if (
    savingsReductionRatio > 0.3 ||
    budgetExceeded ||
    ((monthsDelayed ?? 0) >= 1 && (monthsDelayed ?? 0) <= 3)
  ) {
    return "caution";
  }

  return "affordable";
}

function buildRecommendation(
  verdict: SimulationVerdict,
  type: SimulationInput["type"],
  warnings: string[],
): string {
  if (warnings.length > 0 && verdict === "risky") {
    return warnings[0]!;
  }

  switch (verdict) {
    case "affordable":
      if (type === "save_for_goal") {
        return "Com sua sobra atual, avalie se o aporte cabe no orçamento.";
      }
      if (type === "invest") {
        return "Avalie se o aporte cabe na sua margem sem comprometer despesas e metas.";
      }
      return "Este cenário parece caber no seu orçamento sem comprometer significativamente suas metas.";
    case "caution":
      return "É possível, mas reduz sua margem de poupança ou pode atrasar metas. Avalie adiar ou parcelar.";
    case "risky":
      return "Este cenário pode gerar déficit ou atrasar bastante suas metas financeiras.";
  }
}

async function loadBudgetImpact(
  userId: string,
  categoryGroup: string | undefined,
  additionalSpending: number,
  personId?: string,
): Promise<SimulationResultDTO["budgetImpact"]> {
  if (!categoryGroup) return null;

  const groups = await prisma.budgetGroup.findMany({
    where: { userId },
    include: { members: true },
  });

  const group = groups.find((g) =>
    g.members.some((m) => m.categoryGroup === categoryGroup),
  );
  if (!group) return null;

  const { paydayDay, paydayCycleAnchor } = await resolvePaydayCycle(userId, personId);
  const txs = await loadRecentTransactions(userId, paydayDay, personId, paydayCycleAnchor);

  let range: { from?: string; to?: string };
  if (paydayDay !== null) {
    const cycle = getPaydayCycleRange(paydayDay, new Date(), paydayCycleAnchor);
    range = { from: cycle.from, to: cycle.to };
  } else {
    const month = toLocalMonthKey(new Date());
    range = monthKeysToDateRange([month]);
  }

  const spending = getSpendingByCategory(txs, range);
  const spent =
    (spending.find((s) => s.category === categoryGroup)?.total ?? 0) + additionalSpending;
  const ratioAfter = group.limit > 0 ? Math.min(100, (spent / group.limit) * 100) : 0;

  let statusAfter: BudgetStatus = "safe";
  if (ratioAfter > 90) statusAfter = "critical";
  else if (ratioAfter > 75) statusAfter = "warning";

  return {
    category: categoryGroup,
    spent,
    limit: group.limit,
    ratioAfter,
    statusAfter,
  };
}

export async function fetchSimulatorBaseline(
  userId: string,
  personId?: string,
): Promise<SimulatorBaselineDTO> {
  const ctx = await loadSimulatorContext(userId, personId);
  const { surplus, label: surplusLabel } = resolveSurplus(
    ctx.txs,
    ctx.paydayDay,
    ctx.paydayCycleAnchor,
  );
  const { income, expenses } = computeAverageIncomeExpenses(
    ctx.txs,
    ctx.paydayDay,
    ctx.paydayCycleAnchor,
  );
  const goalsSummary = await loadGoalsSummaryForUser(userId);
  const currentSurplus = await computeCurrentSurplus(ctx, userId);

  let projectedSalaryIncome: number | undefined;
  let includesProjectedSalary = false;
  let nextCycleSurplus: number | undefined;
  let currentCycleFrom: string | undefined;
  let currentCycleTo: string | undefined;
  let nextCycleFrom: string | undefined;
  let nextCycleTo: string | undefined;
  if (ctx.paydayDay !== null && ctx.settings.defaultPeriodMode === "payday") {
    const forecasts = await buildDashboardCycleForecasts(
      ctx.txs,
      userId,
      ctx.paydayDay,
      ctx.paydayCycleAnchor,
      personId,
      true,
      ctx.creditCards,
    );
    if (forecasts.current.pendingIncome > 0) {
      projectedSalaryIncome = forecasts.current.pendingIncome;
      includesProjectedSalary = true;
    }
    nextCycleSurplus = forecasts.next.closingBalance;
    currentCycleFrom = forecasts.current.from;
    currentCycleTo = forecasts.current.to;
    nextCycleFrom = forecasts.next.from;
    nextCycleTo = forecasts.next.to;
  }

  let periodLabel: string;
  if (ctx.paydayDay !== null) {
    const cycle = getPaydayCycleRange(ctx.paydayDay, new Date(), ctx.paydayCycleAnchor);
    periodLabel = cycle.cycleKey;
  } else {
    periodLabel = toLocalMonthKey(new Date());
  }

  return {
    currencyCode: "BRL",
    periodMode: ctx.settings.defaultPeriodMode,
    periodLabel,
    surplusLabel,
    averageSurplus: surplus,
    averageIncome: income,
    averageExpenses: expenses,
    bankBalance: ctx.bankBalance,
    monthlyContribution: goalsSummary.monthlyContribution,
    currentSurplus,
    nextCycleSurplus,
    currentCycleFrom,
    currentCycleTo,
    nextCycleFrom,
    nextCycleTo,
    projectedSalaryIncome,
    includesProjectedSalary,
    creditAccounts: ctx.creditAccounts.map((acc) => ({
      id: acc.id,
      name: acc.name,
      personName: acc.personName,
      nextBillAmount: acc.nextBillAmount,
      nextBillDueDate: acc.nextBillDueDate,
    })),
    hasAccounts: ctx.hasAccounts,
  };
}

export async function runSimulation(
  userId: string,
  input: SimulationInput,
): Promise<SimulationResultDTO> {
  const ctx = await loadSimulatorContext(userId, input.personId);
  const { surplus: averageSurplus } = resolveSurplus(
    ctx.txs,
    ctx.paydayDay,
    ctx.paydayCycleAnchor,
  );
  /** Sobra do ciclo/mês atual — alinhada ao painel e ao card "Sobra atual". */
  const baselineSurplus = await computeCurrentSurplus(ctx, userId);
  const { income, expenses } = computeAverageIncomeExpenses(
    ctx.txs,
    ctx.paydayDay,
    ctx.paydayCycleAnchor,
  );
  const goalsSummary = await loadGoalsSummaryForUser(userId);
  const monthlyContribution = resolveMonthlyContribution(
    goalsSummary.plans,
    averageSurplus,
  );
  const savingsTarget = Math.max(baselineSurplus - monthlyContribution, 0);

  const warnings: string[] = [];
  let surplusAfter = baselineSurplus;
  let bankBalanceAfter: number | null = null;
  let monthlyNeeded: number | null = null;
  let installmentAmount: number | null = null;
  let creditImpact: SimulationResultDTO["creditImpact"] = null;

  switch (input.type) {
    case "single_purchase": {
      const paymentMethod = input.paymentMethod ?? "cash";
      if (paymentMethod === "cash") {
        surplusAfter = baselineSurplus - input.amount;
        bankBalanceAfter = ctx.bankBalance - input.amount;
        if (bankBalanceAfter < 0) {
          warnings.push(
            `Saldo em conta insuficiente. Faltariam ${formatCurrency(Math.abs(bankBalanceAfter))}.`,
          );
        }
      } else {
        surplusAfter = baselineSurplus;
        const creditAcc =
          ctx.creditAccounts.find((a) => a.id === input.creditAccountId) ??
          ctx.creditAccounts[0];
        if (creditAcc) {
          const before = creditAcc.nextBillAmount ?? 0;
          const after = before + input.amount;
          creditImpact = {
            accountId: creditAcc.id,
            accountName: creditAcc.name,
            nextBillBefore: before,
            nextBillAfter: after,
            billIncrease: input.amount,
          };
          if (after > baselineSurplus + expenses * 0.5) {
            warnings.push(
              `A fatura estimada (${formatCurrency(after)}) pode comprometer o fluxo do próximo ciclo.`,
            );
          }
        }
      }
      if (surplusAfter < 0) {
        if (baselineSurplus < 0) {
          warnings.push(
            `Você já está ${formatCurrency(Math.abs(baselineSurplus))} no vermelho neste período. Com esta compra de ${formatCurrency(input.amount)}, o déficit total seria ${formatCurrency(Math.abs(surplusAfter))}.`,
          );
        } else {
          warnings.push(
            `Esta compra deixaria o período com déficit de ${formatCurrency(Math.abs(surplusAfter))}.`,
          );
        }
      } else if (surplusAfter < savingsTarget * 0.5 && savingsTarget > 0) {
        warnings.push(
          `A compra reduziria sua capacidade de poupar de ${formatCurrency(savingsTarget)} para ${formatCurrency(Math.max(0, surplusAfter - monthlyContribution))}.`,
        );
      }
      break;
    }

    case "installments": {
      const n = input.installments ?? 12;
      const schedule = computeInstallmentSchedule(input.amount, n, input.interestRate);
      installmentAmount = schedule[0] ?? input.amount / n;
      surplusAfter = baselineSurplus - installmentAmount;
      if (schedule.some((p) => baselineSurplus - p < 0)) {
        warnings.push("Algumas parcelas deixariam a sobra mensal negativa.");
      }
      break;
    }

    case "recurring_expense": {
      const duration = input.durationMonths ?? PROJECTION_HORIZON;
      surplusAfter = baselineSurplus - input.amount;
      const totalImpact = input.amount * Math.min(duration, PROJECTION_HORIZON);
      warnings.push(
        `Impacto acumulado em ${Math.min(duration, PROJECTION_HORIZON)} meses: ${formatCurrency(totalImpact)}.`,
      );
      break;
    }

    case "save_for_goal": {
      const availableSurplus = Math.max(0, baselineSurplus - monthlyContribution);
      if (input.targetDate) {
        const target = new Date(input.targetDate);
        const now = new Date();
        const monthsLeft = Math.max(
          1,
          Math.ceil((target.getTime() - now.getTime()) / (30 * 24 * 60 * 60 * 1000)),
        );
        monthlyNeeded = input.amount / monthsLeft;
        if (monthlyNeeded > availableSurplus) {
          warnings.push(
            `Seriam necessários ${formatCurrency(monthlyNeeded)}/mês, mas sua sobra disponível é ${formatCurrency(availableSurplus)}.`,
          );
        }
      } else {
        monthlyNeeded = availableSurplus;
        if (availableSurplus <= 0) {
          warnings.push("Com a sobra atual, não há capacidade de poupança para este objetivo.");
        }
      }
      surplusAfter = availableSurplus - (monthlyNeeded ?? 0);
      break;
    }

    case "invest": {
      const investMode = input.investMode ?? "monthly";
      const availableSurplus = Math.max(0, baselineSurplus - monthlyContribution);
      if (investMode === "lump_sum") {
        surplusAfter = baselineSurplus - input.amount;
        bankBalanceAfter = ctx.bankBalance - input.amount;
        if (bankBalanceAfter < 0) {
          warnings.push(
            `Saldo em conta insuficiente para o aporte. Faltariam ${formatCurrency(Math.abs(bankBalanceAfter))}.`,
          );
        }
      } else {
        monthlyNeeded = input.amount;
        surplusAfter = availableSurplus - input.amount;
        if (input.amount > availableSurplus) {
          warnings.push(
            `Aporte mensal de ${formatCurrency(input.amount)} excede sobra disponível (${formatCurrency(availableSurplus)}).`,
          );
        }
      }
      break;
    }
  }

  let monthsDelayed: number | null = null;
  const affectedGoals: { id: string; name: string; monthsDelayed: number }[] = [];

  if (input.type !== "save_for_goal" && input.type !== "invest" && monthlyContribution > 0) {
    const totalImpact =
      input.type === "single_purchase"
        ? input.amount
        : input.type === "installments"
          ? input.amount
          : input.type === "recurring_expense"
            ? input.amount * (input.durationMonths ?? PROJECTION_HORIZON)
            : 0;

    if (totalImpact > surplusAfter) {
      monthsDelayed = Math.ceil(totalImpact / monthlyContribution);
    }

    const activeGoals = goalsSummary.goals.filter((g) => g.status === "active");
    for (const goal of activeGoals) {
      const goalMonthly = monthlyContribution / Math.max(1, activeGoals.length);
      const delay = Math.ceil(totalImpact / Math.max(goalMonthly, 1));
      if (delay > 0) {
        affectedGoals.push({ id: goal.id, name: goal.name, monthsDelayed: delay });
      }
    }
  }

  const budgetImpact = await loadBudgetImpact(
    userId,
    input.categoryGroup,
    input.type === "single_purchase" ? input.amount : 0,
    input.personId,
  );

  const savingsReductionRatio =
    baselineSurplus > 0 ? Math.max(0, (baselineSurplus - surplusAfter) / baselineSurplus) : 0;

  const verdict = computeVerdict({
    scenarioSurplus: surplusAfter,
    monthsDelayed,
    bankBalanceAfter,
    savingsReductionRatio,
    budgetExceeded: budgetImpact?.statusAfter === "critical",
  });

  const goalImpact = { monthsDelayed, affectedGoals };

  return {
    type: input.type,
    name: input.name,
    verdict,
    recommendation: buildRecommendation(verdict, input.type, warnings),
    disclaimer: DISCLAIMER,
    baseline: {
      surplus: baselineSurplus,
      income,
      expenses,
      bankBalance: ctx.bankBalance,
    },
    projected: {
      surplusAfter,
      surplusDelta: surplusAfter - baselineSurplus,
      bankBalanceAfter,
      monthlyNeeded,
      installmentAmount,
    },
    goalImpact,
    budgetImpact,
    creditImpact,
    warnings,
  };
}

/** Compatibilidade com a ferramenta do assistente de chat. */
export async function runSinglePurchaseSimulation(
  userId: string,
  params: {
    purchaseAmount: number;
    monthlyIncome?: number;
    monthlyExpenses?: number;
    monthlySavingsGoal?: number;
    personId?: string;
  },
) {
  const result = await runSimulation(userId, {
    type: "single_purchase",
    amount: params.purchaseAmount,
    paymentMethod: "cash",
    personId: params.personId,
  });

  const income = params.monthlyIncome ?? result.baseline.income;
  const expenses = params.monthlyExpenses ?? result.baseline.expenses;
  const currentSurplus = income - expenses;
  const savingsTarget =
    params.monthlySavingsGoal ?? Math.max(currentSurplus * 0.5, 0);
  const projectedSurplus = currentSurplus - params.purchaseAmount;

  return {
    purchaseAmount: params.purchaseAmount,
    formattedPurchaseAmount: formatCurrency(params.purchaseAmount),
    monthlyIncome: income,
    monthlyExpenses: expenses,
    currentSurplus,
    formattedCurrentSurplus: formatCurrency(currentSurplus),
    projectedMonthlySurplus: projectedSurplus,
    formattedProjectedSurplus: formatCurrency(projectedSurplus),
    canAfford: result.verdict === "affordable",
    warning: result.warnings[0],
    monthsToGoalDelay: result.goalImpact.monthsDelayed,
    disclaimer: result.disclaimer,
  };
}
