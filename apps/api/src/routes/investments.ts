import type { FastifyInstance } from "fastify";
import {
  computeInvestmentAllocation,
  computePeriodInvestmentProfit,
  computePositionProfit,
  isActiveInvestment,
  isDisplayableInvestment,
  summarizeInvestmentPortfolio,
  translateInvestmentSubtype,
  translateInvestmentStatus,
  translateInvestmentType,
} from "@finance/shared";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";
import { monthKeysToDateRange, getRecentMonthKeys } from "../services/finance/aggregates.js";

function serializePosition(
  inv: {
    id: string;
    name: string;
    type: string | null;
    subtype: string | null;
    code: string | null;
    status: string;
    balance: number;
    amount: number | null;
    amountOriginal: number | null;
    amountProfit: number | null;
    annualRate: number | null;
    lastTwelveMonthsRate: number | null;
    dueDate: Date | null;
    purchaseDate: Date | null;
  },
  person: { id: string; name: string },
) {
  return {
    id: inv.id,
    name: inv.name,
    type: inv.type,
    subtype: inv.subtype,
    typeLabel: translateInvestmentType(inv.type),
    subtypeLabel: translateInvestmentSubtype(inv.subtype),
    code: inv.code,
    status: inv.status,
    statusLabel: translateInvestmentStatus(inv.status),
    balance: inv.balance,
    amount: inv.amount,
    amountOriginal: inv.amountOriginal,
    profit: computePositionProfit(inv),
    annualRate: inv.annualRate,
    lastTwelveMonthsRate: inv.lastTwelveMonthsRate,
    dueDate: inv.dueDate?.toISOString() ?? null,
    purchaseDate: inv.purchaseDate?.toISOString() ?? null,
    personId: person.id,
    personName: person.name,
  };
}

function txTypeLabel(type: string | null): string {
  if (type === "BUY") return "Compra";
  if (type === "SELL") return "Venda";
  if (type === "TAX") return "Imposto";
  if (type === "TRANSFER") return "Transferência";
  return type ?? "Movimentação";
}

function latestSyncAt(
  connections: { lastSyncedAt: Date | null }[],
): string | null {
  let latest: Date | null = null;
  for (const conn of connections) {
    if (conn.lastSyncedAt && (!latest || conn.lastSyncedAt > latest)) {
      latest = conn.lastSyncedAt;
    }
  }
  return latest?.toISOString() ?? null;
}

export async function investmentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/investments", async (request, reply) => {
    const query = request.query as { personId?: string };
    const personId = query.personId?.trim() || undefined;

    const where = {
      userId: request.user!.sub,
      ...(personId ? { id: personId } : {}),
    };

    const people = await prisma.person.findMany({
      where,
      include: {
        connections: {
          include: {
            investments: true,
          },
        },
      },
    });

    const positions: ReturnType<typeof serializePosition>[] = [];
    const allConnections: { lastSyncedAt: Date | null }[] = [];
    const allTransactions: {
      id: string;
      date: Date;
      type: string | null;
      amount: number;
      netAmount: number | null;
      quantity: number | null;
      value: number | null;
      description: string | null;
      investmentId: string;
      investmentName: string;
      personId: string;
      personName: string;
    }[] = [];

    const perPersonMap = new Map<string, { personId: string; personName: string; totalBalance: number }>();
    const allInvestmentIds: string[] = [];

    for (const person of people) {
      let personBalance = 0;
      for (const conn of person.connections) {
        allConnections.push(conn);
        for (const inv of conn.investments) {
          allInvestmentIds.push(inv.id);
          if (!isDisplayableInvestment(inv)) continue;
          positions.push(serializePosition(inv, person));
          if (isActiveInvestment(inv.status, inv.balance)) {
            personBalance += inv.balance;
          }
        }
      }
      perPersonMap.set(person.id, {
        personId: person.id,
        personName: person.name,
        totalBalance: personBalance,
      });
    }

    const investmentIds = [...new Set(allInvestmentIds)];
    if (investmentIds.length > 0) {
      const txs = await prisma.investmentTransaction.findMany({
        where: { investmentId: { in: investmentIds } },
        orderBy: { date: "desc" },
        take: 50,
        include: {
          investment: {
            include: {
              connection: { include: { person: true } },
            },
          },
        },
      });

      for (const tx of txs) {
        const person = tx.investment.connection.person;
        allTransactions.push({
          id: tx.id,
          date: tx.date,
          type: tx.type,
          amount: tx.amount,
          netAmount: tx.netAmount,
          quantity: tx.quantity,
          value: tx.value,
          description: tx.description,
          investmentId: tx.investmentId,
          investmentName: tx.investment.name,
          personId: person.id,
          personName: person.name,
        });
      }
    }

    const portfolio = summarizeInvestmentPortfolio(
      positions.map((p) => ({
        status: p.status,
        balance: p.balance,
        amountOriginal: p.amountOriginal,
        amountProfit: p.profit,
        type: p.type,
      })),
    );

    const allocation = computeInvestmentAllocation(
      positions.map((p) => ({
        status: p.status,
        balance: p.balance,
        amountOriginal: p.amountOriginal,
        amountProfit: p.profit,
        type: p.type,
      })),
    );

    return reply.send({
      summary: portfolio,
      allocation,
      positions: positions.sort((a, b) => b.balance - a.balance),
      recentTransactions: allTransactions.map((tx) => ({
        id: tx.id,
        date: tx.date.toISOString(),
        type: tx.type,
        typeLabel: txTypeLabel(tx.type),
        amount: tx.amount,
        netAmount: tx.netAmount,
        quantity: tx.quantity,
        value: tx.value,
        description: tx.description,
        investmentId: tx.investmentId,
        investmentName: tx.investmentName,
        personId: tx.personId,
        personName: tx.personName,
      })),
      currencyCode: "BRL",
      lastSyncedAt: latestSyncAt(allConnections),
      perPerson: [...perPersonMap.values()],
    });
  });
}

export async function loadInvestmentData(
  userId: string,
  personId: string | undefined,
  months: number,
) {
  const where = {
    userId,
    ...(personId ? { id: personId } : {}),
  };

  const people = await prisma.person.findMany({
    where,
    include: {
      connections: {
        include: {
          investments: {
            include: { transactions: true },
          },
        },
      },
    },
  });

  const positions: {
    status: string;
    balance: number;
    amountOriginal: number | null;
    amountProfit: number | null;
    type: string | null;
  }[] = [];

  const allConnections: { lastSyncedAt: Date | null }[] = [];
  const allTxs: { date: Date; type: string | null; amount: number; netAmount: number | null }[] = [];
  let investmentBalance = 0;

  for (const person of people) {
    for (const conn of person.connections) {
      allConnections.push(conn);
      for (const inv of conn.investments) {
        for (const tx of inv.transactions) {
          allTxs.push({
            date: tx.date,
            type: tx.type,
            amount: tx.amount,
            netAmount: tx.netAmount,
          });
        }

        if (!isDisplayableInvestment(inv)) continue;

        positions.push({
          status: inv.status,
          balance: inv.balance,
          amountOriginal: inv.amountOriginal,
          amountProfit: inv.amountProfit,
          type: inv.type,
        });
        if (isActiveInvestment(inv.status, inv.balance)) {
          investmentBalance += inv.balance;
        }
      }
    }
  }

  const portfolio = summarizeInvestmentPortfolio(positions);
  const currentMonthKeys = getRecentMonthKeys(months, 0);
  const previousMonthKeys = getRecentMonthKeys(months, months);
  const currentRange = monthKeysToDateRange(currentMonthKeys);
  const previousRange = monthKeysToDateRange(previousMonthKeys);

  const periodProfit = computePeriodInvestmentProfit(allTxs, currentRange);
  const previousPeriodProfit = computePeriodInvestmentProfit(allTxs, previousRange);

  return {
    investmentBalance,
    investments: {
      ...portfolio,
      periodProfit,
      previousPeriodProfit,
      lastSyncedAt: latestSyncAt(allConnections),
    },
  };
}
