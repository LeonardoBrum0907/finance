import type { FastifyInstance } from "fastify";
import { translateCategory, accountNetWorthContribution } from "@finance/shared";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";
import type { FinancialTransaction } from "../services/finance/types.js";
import { serializeAccount } from "../services/serializeAccount.js";
import { computeNextBill } from "../services/finance/creditBill.js";
import {
  buildDashboardInsights,
  getCategoriesWithPercent,
  getMonthlySeries,
  getRecentMonthKeys,
  getSpendingByCategory,
  getTopExpenses,
  monthKeysToDateRange,
  parseDashboardMonths,
  summarizeTransactions,
} from "../services/finance/aggregates.js";

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/dashboard", async (request, reply) => {
    const query = request.query as { months?: string; personId?: string };
    const months = parseDashboardMonths(query.months);
    const personId = query.personId?.trim() || undefined;

    const fetchMonthKeys = getRecentMonthKeys(months * 2, 0);
    const fetchRange = monthKeysToDateRange(fetchMonthKeys);
    const dateFrom = fetchRange.from
      ? new Date(`${fetchRange.from}T00:00:00.000Z`)
      : new Date(0);

    const where = {
      userId: request.user!.sub,
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

    for (const person of people) {
      let personBalance = 0;
      for (const connection of person.connections) {
        for (const acc of connection.accounts) {
          const contribution = accountNetWorthContribution(acc.balance, acc.type);
          personBalance += contribution;
          if (acc.type === "CREDIT") {
            creditDebt += Math.abs(acc.balance);
          } else {
            bankBalance += acc.balance;
          }

          const accountTxs = acc.transactions.map((tx) => ({
            accountId: acc.id,
            date: tx.date,
            amount: tx.amount,
          }));

          const nextBill =
            acc.type === "CREDIT"
              ? computeNextBill(
                  acc.id,
                  acc.type,
                  acc.balanceCloseDate,
                  acc.balanceDueDate,
                  accountTxs,
                )
              : { nextBillAmount: null, nextBillDueDate: null };

          accounts.push({
            ...serializeAccount({
              ...acc,
              nextBillAmount: nextBill.nextBillAmount,
              nextBillDueDate: nextBill.nextBillDueDate,
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
              category: translateCategory(tx.category, tx.description),
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
    const currentMonthKeys = getRecentMonthKeys(months, 0);
    const previousMonthKeys = getRecentMonthKeys(months, months);
    const currentRange = monthKeysToDateRange(currentMonthKeys);
    const previousRange = monthKeysToDateRange(previousMonthKeys);

    const currentTotals = summarizeTransactions(financialTransactions, currentRange);
    const previousTotals = summarizeTransactions(financialTransactions, previousRange);

    const period = { months, ...currentTotals };
    const previousPeriod = { months, ...previousTotals };
    const monthlySeries = getMonthlySeries(financialTransactions, currentMonthKeys);
    const categories = getCategoriesWithPercent(financialTransactions, currentRange);
    const previousCategoriesRaw = getSpendingByCategory(financialTransactions, previousRange);
    const previousCategories = previousCategoriesRaw.map((c) => ({
      ...c,
      percent: 0,
    }));
    const topExpenses = getTopExpenses(financialTransactions, currentRange, 1);

    const insights = buildDashboardInsights({
      period,
      previousPeriod,
      categories,
      previousCategories,
      topExpense: topExpenses[0],
      currencyCode,
    });

    return reply.send({
      totalBalance,
      netWorth: {
        total: totalBalance,
        bankBalance,
        creditDebt,
      },
      currencyCode,
      perPerson,
      accounts,
      period,
      previousPeriod,
      monthlySeries,
      categories,
      previousCategories,
      insights,
    });
  });
}
