import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";
import {
  buildInvestmentAllocation,
  buildInvestmentDashboardMetrics,
  collectInvestmentPortfolio,
} from "../services/finance/investmentPortfolio.js";

function txTypeLabel(type: string | null): string {
  if (type === "BUY") return "Compra";
  if (type === "SELL") return "Venda";
  if (type === "TAX") return "Imposto";
  if (type === "TRANSFER") return "Transferência";
  return type ?? "Movimentação";
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
            accounts: { select: { id: true } },
            investments: {
              include: { transactions: true },
            },
          },
        },
      },
    });

    const peopleForPortfolio = people.map((person) => ({
      ...person,
      connections: person.connections.map((conn) => ({
        id: conn.id,
        connectorName: conn.connectorName,
        lastSyncedAt: conn.lastSyncedAt,
        accountCount: conn.accounts.length,
        investments: conn.investments,
      })),
    }));

    const portfolio = collectInvestmentPortfolio(peopleForPortfolio);
    const positionIds = portfolio.positions.map((p) => p.id);

    const recentTransactions: {
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

    if (positionIds.length > 0) {
      const txs = await prisma.investmentTransaction.findMany({
        where: { investmentId: { in: positionIds } },
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
        recentTransactions.push({
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

    const summary = buildInvestmentDashboardMetrics(portfolio.positions, portfolio.profitTxs, 1);
    const allocation = buildInvestmentAllocation(portfolio.positions);

    return reply.send({
      summary: {
        totalBalance: summary.totalBalance,
        unrealizedProfit: summary.unrealizedProfit,
        positionCount: summary.positionCount,
        stalePositionCount: summary.stalePositionCount,
      },
      allocation,
      positions: portfolio.positions.sort((a, b) => b.balance - a.balance),
      recentTransactions: recentTransactions.map((tx) => ({
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
      lastSyncedAt: portfolio.lastSyncedAt,
      investmentSource: portfolio.investmentSource,
      perPerson: portfolio.perPerson,
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
          accounts: { select: { id: true } },
          investments: {
            include: { transactions: true },
          },
        },
      },
    },
  });

  const peopleForPortfolio = people.map((person) => ({
    ...person,
    connections: person.connections.map((conn) => ({
      id: conn.id,
      connectorName: conn.connectorName,
      lastSyncedAt: conn.lastSyncedAt,
      accountCount: conn.accounts.length,
      investments: conn.investments,
    })),
  }));

  const portfolio = collectInvestmentPortfolio(peopleForPortfolio);
  const metrics = buildInvestmentDashboardMetrics(portfolio.positions, portfolio.profitTxs, months);

  return {
    investmentBalance: portfolio.investmentBalance,
    investments: {
      ...metrics,
      lastSyncedAt: portfolio.lastSyncedAt,
      investmentSource: portfolio.investmentSource,
    },
  };
}
