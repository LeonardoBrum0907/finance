import {
  accountNetWorthContribution,
  getPaydayCycleRange,
  getRecentPaydayCycles,
  isCreditAccount,
  paydayCyclesToDateRange,
  translateCategory,
  type BudgetStatus,
  type SimulationInput,
  type SimulationResultDTO,
  type SimulationVerdict,
  type SimulatorBaselineDTO,
} from "@finance/shared";
import { prisma } from "../../prisma.js";
import { computeNextBill } from "./creditBill.js";
import {
  addMonthsToMonthKey,
  buildGrowthMetrics,
  formatCurrency,
  getCycleSummary,
  getMonthlySummary,
  getRecentMonthKeys,
  getSpendingByCategory,
  monthKeysToDateRange,
  resolvePeriodRanges,
  toLocalMonthKey,
} from "./aggregates.js";
import { loadGoalsSummaryForUser } from "./goalsContext.js";
import {
  resolveMonthlyContribution,
  resolveSurplus,
} from "./projections.js";
import type { FinancialTransaction } from "./types.js";
import { loadUserSettings } from "../userSettings.js";

const PROJECTION_HORIZON = 12;
const DISCLAIMER =
  "Simulação baseada nos seus dados atuais. Não constitui assessoria financeira.";

interface SimulatorContext {
  userId: string;
  personId?: string;
  settings: Awaited<ReturnType<typeof loadUserSettings>>;
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
}

async function loadRecentTransactions(
  userId: string,
  paydayDay: number | null,
  personId?: string,
): Promise<FinancialTransaction[]> {
  const range =
    paydayDay !== null
      ? paydayCyclesToDateRange(getRecentPaydayCycles(4, paydayDay, 0), paydayDay)
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
            category: translateCategory(tx.category, tx.description),
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
  const txs = await loadRecentTransactions(userId, settings.paydayDay, personId);

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
          const billTxs = acc.transactions.map((tx) => ({
            accountId: acc.id,
            date: tx.date,
            amount: tx.amount,
          }));
          const bill = computeNextBill(
            acc.id,
            acc.type,
            acc.balanceCloseDate,
            acc.balanceDueDate,
            billTxs,
          );
          creditAccounts.push({
            id: acc.id,
            name: acc.name,
            personName: person.name,
            type: acc.type,
            balanceCloseDate: acc.balanceCloseDate,
            balanceDueDate: acc.balanceDueDate,
            nextBillAmount: bill.nextBillAmount,
            nextBillDueDate:
              bill.nextBillDueDate?.toISOString() ?? acc.balanceDueDate?.toISOString() ?? null,
          });
        }
      }
    }
  }

  return {
    userId,
    personId,
    settings,
    txs,
    bankBalance,
    creditAccounts,
    hasAccounts,
  };
}

function computeAverageIncomeExpenses(
  txs: FinancialTransaction[],
  paydayDay: number | null,
): { income: number; expenses: number } {
  if (paydayDay !== null) {
    const cycles = getRecentPaydayCycles(3, paydayDay, 0);
    if (cycles.length === 0) return { income: 0, expenses: 0 };
    const summaries = cycles.map((start) => getCycleSummary(txs, start, paydayDay));
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

function computeProjectedNet(
  ctx: SimulatorContext,
): number | null {
  const { settings, txs } = ctx;
  const paydayDay = settings.paydayDay;
  const periodMode = settings.defaultPeriodMode;

  const periods = resolvePeriodRanges(1, periodMode, paydayDay);
  const currentSummary =
    periodMode === "payday" && paydayDay !== null
      ? getCycleSummary(txs, getPaydayCycleRange(paydayDay).cycleKey, paydayDay)
      : getMonthlySummary(txs, toLocalMonthKey(new Date()));

  const growth = buildGrowthMetrics({
    period: currentSummary,
    previousPeriod: { income: 0, expenses: 0, net: 0 },
    currentRange: periods.currentRange,
    previousRange: periods.previousRange,
    txs,
    paydayDay,
    periodMode,
  });

  return growth.projection?.projectedNet ?? currentSummary.net;
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

function buildMonthlySeries(
  baselineSurplus: number,
  monthlyImpacts: number[],
  horizon = PROJECTION_HORIZON,
): SimulationResultDTO["projected"]["monthlySeries"] {
  const currentMonth = toLocalMonthKey(new Date());
  const series: SimulationResultDTO["projected"]["monthlySeries"] = [];

  for (let i = 0; i < horizon; i++) {
    const impact = i < monthlyImpacts.length ? monthlyImpacts[i] : 0;
    series.push({
      month: addMonthsToMonthKey(currentMonth, i),
      label: i === 0 ? "Hoje" : undefined,
      baselineSurplus,
      scenarioSurplus: baselineSurplus - impact,
    });
  }

  return series;
}

function computeVerdict(params: {
  monthlySeries: SimulationResultDTO["projected"]["monthlySeries"];
  monthsDelayed: number | null;
  bankBalanceAfter: number | null;
  savingsReductionRatio: number;
  budgetExceeded: boolean;
}): SimulationVerdict {
  const { monthlySeries, monthsDelayed, bankBalanceAfter, savingsReductionRatio, budgetExceeded } =
    params;

  const anyNegative = monthlySeries.some((p) => p.scenarioSurplus < 0);
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
        return "Com sua sobra atual, este objetivo parece alcançável dentro do prazo estimado.";
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

  const settings = await loadUserSettings(userId);
  const txs = await loadRecentTransactions(userId, settings.paydayDay, personId);

  let range: { from?: string; to?: string };
  if (settings.paydayDay !== null) {
    const cycle = getPaydayCycleRange(settings.paydayDay);
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
  const { surplus, label: surplusLabel } = resolveSurplus(ctx.txs, ctx.settings.paydayDay);
  const { income, expenses } = computeAverageIncomeExpenses(ctx.txs, ctx.settings.paydayDay);
  const goalsSummary = await loadGoalsSummaryForUser(userId);
  const projectedNet = computeProjectedNet(ctx);

  let periodLabel: string;
  if (ctx.settings.paydayDay !== null) {
    const cycle = getPaydayCycleRange(ctx.settings.paydayDay);
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
    projectedNet,
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
  const { surplus: baselineSurplus } = resolveSurplus(ctx.txs, ctx.settings.paydayDay);
  const { income, expenses } = computeAverageIncomeExpenses(ctx.txs, ctx.settings.paydayDay);
  const goalsSummary = await loadGoalsSummaryForUser(userId);
  const monthlyContribution = resolveMonthlyContribution(
    goalsSummary.plans,
    baselineSurplus,
  );
  const savingsTarget = Math.max(baselineSurplus - monthlyContribution, 0);

  const warnings: string[] = [];
  let monthlyImpacts: number[] = [];
  let surplusAfter = baselineSurplus;
  let bankBalanceAfter: number | null = null;
  let estimatedMonths: number | null = null;
  let monthlyNeeded: number | null = null;
  let installmentAmount: number | null = null;
  let creditImpact: SimulationResultDTO["creditImpact"] = null;

  switch (input.type) {
    case "single_purchase": {
      const paymentMethod = input.paymentMethod ?? "cash";
      if (paymentMethod === "cash") {
        surplusAfter = baselineSurplus - input.amount;
        bankBalanceAfter = ctx.bankBalance - input.amount;
        monthlyImpacts = [input.amount];
        if (bankBalanceAfter < 0) {
          warnings.push(
            `Saldo em conta insuficiente. Faltariam ${formatCurrency(Math.abs(bankBalanceAfter))}.`,
          );
        }
      } else {
        surplusAfter = baselineSurplus;
        monthlyImpacts = [0];
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
        warnings.push(
          `Esta compra deixaria o período com déficit de ${formatCurrency(Math.abs(surplusAfter))}.`,
        );
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
      monthlyImpacts = schedule;
      surplusAfter = baselineSurplus - installmentAmount;
      if (schedule.some((p) => baselineSurplus - p < 0)) {
        warnings.push("Algumas parcelas deixariam a sobra mensal negativa.");
      }
      break;
    }

    case "recurring_expense": {
      const duration = input.durationMonths ?? PROJECTION_HORIZON;
      monthlyImpacts = Array.from({ length: duration }, () => input.amount);
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
        estimatedMonths = monthsLeft;
        if (monthlyNeeded > availableSurplus) {
          warnings.push(
            `Seriam necessários ${formatCurrency(monthlyNeeded)}/mês, mas sua sobra disponível é ${formatCurrency(availableSurplus)}.`,
          );
        }
      } else {
        estimatedMonths =
          availableSurplus > 0 ? Math.ceil(input.amount / availableSurplus) : null;
        monthlyNeeded = availableSurplus;
        if (estimatedMonths === null) {
          warnings.push("Com a sobra atual, não há capacidade de poupança para este objetivo.");
        }
      }
      surplusAfter = availableSurplus - (monthlyNeeded ?? 0);
      monthlyImpacts = Array.from({ length: PROJECTION_HORIZON }, () => monthlyNeeded ?? 0);
      break;
    }
  }

  const monthlySeries = buildMonthlySeries(baselineSurplus, monthlyImpacts);

  let monthsDelayed: number | null = null;
  const affectedGoals: { id: string; name: string; monthsDelayed: number }[] = [];

  if (input.type !== "save_for_goal" && monthlyContribution > 0) {
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
    monthlySeries,
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
      monthlySeries,
      estimatedMonths,
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
