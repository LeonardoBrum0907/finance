import type { FastifyInstance } from "fastify";
import { accountNetWorthContribution, getRecentPaydayCycles, getPaydayCycleRange, getPaydayCycleRangeByKey, paydayCyclesToDateRange, isInvestmentAccount, isPaydayDayConfigured } from "@finance/shared";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";
import type { FinancialTransaction } from "../services/finance/types.js";
import { effectiveTransactionCategory } from "../services/transactionCategory.js";
import { serializeAccount } from "../services/serializeAccount.js";
import { resolveNextDueDate } from "../services/finance/creditBill.js";
import { pickLatestClosedBill } from "../services/finance/creditBillSync.js";
import { getPluggyClient } from "../services/pluggy.js";
import { isPluggyConfigured } from "../env.js";
import {
  buildCurrentCycleSummary,
  buildCyclePeriodSummary,
  buildCycleSummary,
  buildRecentCycleSummaries,
  buildDashboardInsights,
  buildGrowthMetrics,
  getCategoriesWithPercent,
  getMonthlySeries,
  getPaydayCycleSeries,
  getRecentMonthKeys,
  getSpendingByCategory,
  getTopExpenses,
  monthKeysToDateRange,
  parseDashboardMonths,
  resolvePeriodRanges,
  summarizeTransactions,
} from "../services/finance/aggregates.js";
import { loadInvestmentData } from "./investments.js";
import { loadUserSettings, resolvePaydayCycle, resolvePeriodMode } from "../services/userSettings.js";
import { buildHouseholdArena } from "../services/finance/householdComparison.js";
import { sumPendingManagedEntriesInRange } from "../services/finance/managedAccounts.js";
import { buildDashboardCycleForecasts } from "../services/finance/cycleForecasts.js";
import { buildDashboardCycleSummary } from "../services/finance/householdCycleSummary.js";
import { loadCardsForUser } from "../services/finance/creditCardBills.js";

const MIN_PAYDAY_CYCLES_FETCH = 12;

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/dashboard/summary", async (request, reply) => {
    const query = request.query as { personId?: string; cycleKey?: string };
    const summary = await buildDashboardCycleSummary(request.user!.sub, {
      personId: query.personId?.trim() || undefined,
      cycleKey: query.cycleKey?.trim() || undefined,
    });
    return reply.send(summary);
  });

  app.get("/api/dashboard", async (request, reply) => {
    const query = request.query as {
      months?: string;
      personId?: string;
      periodMode?: string;
      cycleKey?: string;
    };
    const months = parseDashboardMonths(query.months);
    const personId = query.personId?.trim() || undefined;
    const cycleKey = query.cycleKey?.trim() || undefined;
    const userId = request.user!.sub;

    const settings = await loadUserSettings(userId);
    const { paydayDay, paydayCycleAnchor } = await resolvePaydayCycle(userId, personId);
    const periodMode = resolvePeriodMode(query.periodMode, settings, paydayDay);

    const periods = resolvePeriodRanges(
      months,
      periodMode,
      paydayDay,
      paydayCycleAnchor,
      cycleKey,
    );
    const fetchRange =
      periodMode === "payday" && paydayDay !== null
        ? paydayCyclesToDateRange(
            getRecentPaydayCycles(
              Math.max(months * 2, MIN_PAYDAY_CYCLES_FETCH),
              paydayDay,
              0,
              paydayCycleAnchor,
            ),
            paydayDay,
            paydayCycleAnchor,
          )
        : monthKeysToDateRange(getRecentMonthKeys(months * 2, 0));

    const dateFrom = fetchRange.from
      ? new Date(`${fetchRange.from}T00:00:00.000Z`)
      : new Date(0);

    const where = {
      userId,
      ...(personId ? { id: personId } : {}),
    };

    const peopleMeta = await prisma.person.findMany({
      where,
      include: {
        connections: {
          include: {
            accounts: { select: { type: true, balanceCloseDate: true } },
          },
        },
      },
    });

    let txSince = dateFrom;
    for (const person of peopleMeta) {
      for (const conn of person.connections) {
        for (const acc of conn.accounts) {
          if (
            acc.type === "CREDIT" &&
            acc.balanceCloseDate &&
            acc.balanceCloseDate < txSince
          ) {
            txSince = acc.balanceCloseDate;
          }
        }
      }
    }

    const people = await prisma.person.findMany({
      where,
      include: {
        connections: {
          include: {
            accounts: {
              include: {
                transactions: {
                  where: { date: { gte: txSince } },
                  orderBy: { date: "desc" },
                },
              },
            },
          },
        },
      },
    });

    const accounts: (ReturnType<typeof serializeAccount> & { personName: string })[] = [];
    const perPerson: { personId: string; personName: string; balance: number }[] = [];
    const financialTransactions: FinancialTransaction[] = [];

    let totalBalance = 0;
    let bankBalance = 0;
    let creditDebt = 0;

    const pluggy = isPluggyConfigured() ? getPluggyClient() : null;
    const closedBillCache = new Map<string, { amount: number; dueDate: Date } | null>();

    async function loadClosedBill(pluggyAccountId: string) {
      if (closedBillCache.has(pluggyAccountId)) {
        return closedBillCache.get(pluggyAccountId) ?? null;
      }
      if (!pluggy) {
        closedBillCache.set(pluggyAccountId, null);
        return null;
      }
      try {
        const bills = await pluggy.fetchCreditCardBills(pluggyAccountId);
        const closed = pickLatestClosedBill(bills.results ?? []);
        const value = closed
          ? { amount: closed.totalAmount, dueDate: new Date(closed.dueDate) }
          : null;
        closedBillCache.set(pluggyAccountId, value);
        return value;
      } catch {
        closedBillCache.set(pluggyAccountId, null);
        return null;
      }
    }

    for (const person of people) {
      let personBalance = 0;
      for (const connection of person.connections) {
        for (const acc of connection.accounts) {
          const contribution = accountNetWorthContribution(acc.balance, acc.type);
          personBalance += contribution;
          if (acc.type === "CREDIT") {
            creditDebt += Math.abs(acc.balance);
          } else if (!isInvestmentAccount(acc.type)) {
            bankBalance += acc.balance;
          }

          const openBillDueDate =
            acc.type === "CREDIT"
              ? resolveNextDueDate(acc.balanceDueDate)
              : null;
          const openBillAmount =
            acc.type === "CREDIT" && Math.abs(acc.balance) > 0
              ? Math.abs(acc.balance)
              : null;

          const closedBill =
            acc.type === "CREDIT" ? await loadClosedBill(acc.pluggyAccountId) : null;

          accounts.push({
            ...serializeAccount({
              ...acc,
              closedBillAmount: closedBill?.amount ?? null,
              closedBillDueDate: closedBill?.dueDate ?? null,
              openBillAmount,
              openBillDueDate,
              nextBillAmount: openBillAmount,
              nextBillDueDate: openBillDueDate,
            }),
            personName: person.name,
          });
          for (const tx of acc.transactions) {
            const dto = {
              id: tx.id,
              date: tx.date.toISOString(),
              description: tx.description,
              amount: tx.amount,
              currencyCode: tx.currencyCode,
              category: effectiveTransactionCategory(tx),
              accountId: acc.id,
              accountName: acc.name,
              accountType: acc.type,
              personId: person.id,
              personName: person.name,
            };
            financialTransactions.push({
              ...dto,
              date: tx.date,
            });
          }
        }
      }
      totalBalance += personBalance;
      perPerson.push({
        personId: person.id,
        personName: person.name,
        balance: personBalance,
      });
    }

    const currencyCode = "BRL";

    let manualCommittedForCurrent = 0;
    let manualCommittedForFocus = 0;
    const focusCycleKey =
      periodMode === "payday" && paydayDay !== null
        ? periods.currentKeys[periods.currentKeys.length - 1]
        : undefined;

    if (paydayDay !== null) {
      const currentMeta = getPaydayCycleRange(paydayDay, new Date(), paydayCycleAnchor);
      if (!currentMeta.isComplete) {
        manualCommittedForCurrent = await sumPendingManagedEntriesInRange(
          userId,
          new Date(`${currentMeta.from}T00:00:00.000Z`),
          new Date(`${currentMeta.to}T23:59:59.999Z`),
          personId,
        );
      }
      if (focusCycleKey) {
        const focusMeta = getPaydayCycleRangeByKey(
          focusCycleKey,
          paydayDay,
          paydayCycleAnchor,
        );
        if (!focusMeta.isComplete) {
          manualCommittedForFocus = await sumPendingManagedEntriesInRange(
            userId,
            new Date(`${focusMeta.from}T00:00:00.000Z`),
            new Date(`${focusMeta.to}T23:59:59.999Z`),
            personId,
          );
        }
      }
    } else if (periods.currentRange.from && periods.currentRange.to) {
      const today = new Date().toISOString().slice(0, 10);
      if (today >= periods.currentRange.from && today <= periods.currentRange.to) {
        manualCommittedForFocus = await sumPendingManagedEntriesInRange(
          userId,
          new Date(`${today}T00:00:00.000Z`),
          new Date(`${periods.currentRange.to}T23:59:59.999Z`),
          personId,
        );
      }
    }

    const currentCycle =
      paydayDay !== null
        ? buildCurrentCycleSummary(
            financialTransactions,
            paydayDay,
            paydayCycleAnchor,
            manualCommittedForCurrent,
          )
        : null;

    const manualByCycle = new Map<string, number>();
    if (paydayDay !== null && manualCommittedForCurrent > 0 && currentCycle) {
      manualByCycle.set(currentCycle.cycleKey, manualCommittedForCurrent);
    }

    const recentCycles =
      paydayDay !== null
        ? buildRecentCycleSummaries(
            financialTransactions,
            paydayDay,
            undefined,
            paydayCycleAnchor,
            manualByCycle,
          )
        : null;

    let period: {
      months: typeof months;
      income: number;
      expenses: number;
      net: number;
      committedExpenses?: number;
      availableNet?: number;
      periodMode: typeof periods.periodMode;
      from?: string;
      to?: string;
      label?: string;
    };
    let previousPeriod: {
      months: typeof months;
      income: number;
      expenses: number;
      net: number;
      committedExpenses?: number;
      availableNet?: number;
      periodMode: typeof periods.periodMode;
      from?: string;
      to?: string;
    };

    if (periodMode === "payday" && paydayDay !== null && focusCycleKey) {
      const focusCycleSummary = buildCycleSummary(
        financialTransactions,
        paydayDay,
        focusCycleKey,
        paydayCycleAnchor,
        manualCommittedForFocus,
      );
      const endOffset = periods.endOffsetCycles ?? 0;
      const previousCycleKeys = getRecentPaydayCycles(
        1,
        paydayDay,
        endOffset + 1,
        paydayCycleAnchor,
      );
      const previousCycleSummary = buildCycleSummary(
        financialTransactions,
        paydayDay,
        previousCycleKeys[0],
        paydayCycleAnchor,
        0,
      );
      period = buildCyclePeriodSummary(
        focusCycleSummary,
        months,
        paydayDay,
        paydayCycleAnchor,
        periods.periodMode,
      );
      previousPeriod = buildCyclePeriodSummary(
        previousCycleSummary,
        months,
        paydayDay,
        paydayCycleAnchor,
        periods.periodMode,
      );
    } else {
      const currentTotals = summarizeTransactions(financialTransactions, periods.currentRange);
      const previousTotals = summarizeTransactions(financialTransactions, periods.previousRange);
      period = {
        months,
        ...currentTotals,
        periodMode: periods.periodMode,
        from: periods.currentRange.from,
        to: periods.currentRange.to,
        label: periods.currentLabel,
      };
      previousPeriod = {
        months,
        ...previousTotals,
        periodMode: periods.periodMode,
        from: periods.previousRange.from,
        to: periods.previousRange.to,
      };
    }

    const monthlySeries =
      periodMode === "payday" && paydayDay !== null
        ? getPaydayCycleSeries(
            financialTransactions,
            periods.currentKeys,
            paydayDay,
            paydayCycleAnchor,
          )
        : getMonthlySeries(financialTransactions, periods.currentKeys);

    const categories = getCategoriesWithPercent(financialTransactions, periods.currentRange);
    const previousCategoriesRaw = getSpendingByCategory(
      financialTransactions,
      periods.previousRange,
    );
    const previousCategories = previousCategoriesRaw.map((c) => ({
      ...c,
      percent: 0,
    }));
    const topExpenses = getTopExpenses(financialTransactions, periods.currentRange, 1);

    const insights = buildDashboardInsights({
      period,
      previousPeriod,
      categories,
      previousCategories,
      topExpense: topExpenses[0],
      currencyCode,
      periodMode: periods.periodMode,
    });

    const growthMetrics = buildGrowthMetrics({
      period,
      previousPeriod,
      currentRange: periods.currentRange,
      previousRange: periods.previousRange,
      txs: financialTransactions,
      paydayDay,
      paydayCycleAnchor,
      periodMode: periods.periodMode,
      manualCommittedExpenses: manualCommittedForFocus,
      focusCycleKey:
        periodMode === "payday" && paydayDay !== null
          ? periods.currentKeys[periods.currentKeys.length - 1]
          : undefined,
    });

    const { investmentBalance, investments } = await loadInvestmentData(
      userId,
      personId,
      months,
    );

    const investmentsIncluded = settings.includeInvestmentsInNetWorth;
    const netWorthInvestmentContribution = investmentsIncluded ? investmentBalance : 0;

    const cycleForecasts =
      paydayDay !== null && currentCycle
        ? await buildDashboardCycleForecasts(
            financialTransactions,
            userId,
            paydayDay,
            paydayCycleAnchor,
            personId,
            true,
            await loadCardsForUser(userId, personId, financialTransactions),
          )
        : null;

    return reply.send({
      totalBalance: totalBalance + netWorthInvestmentContribution,
      netWorth: {
        total: totalBalance + netWorthInvestmentContribution,
        bankBalance,
        creditDebt,
        investmentBalance,
        investmentsIncluded,
      },
      investments,
      currencyCode,
      periodMode: periods.periodMode,
      paydayDay,
      paydayCycleAnchor,
      paydayConfigured: isPaydayDayConfigured(paydayDay),
      currentCycle,
      currentCycleForecast: cycleForecasts?.current ?? null,
      nextCycleForecast: cycleForecasts?.next ?? null,
      recentCycles,
      perPerson,
      accounts,
      period,
      previousPeriod,
      monthlySeries,
      categories,
      previousCategories,
      growthMetrics,
      insights,
    });
  });

  app.get("/api/dashboard/arena", async (request, reply) => {
    const arena = await buildHouseholdArena(request.user!.sub);
    if (!arena) {
      return reply.code(404).send({ error: "Sem dados financeiros para a arena" });
    }
    return reply.send(arena);
  });
}
