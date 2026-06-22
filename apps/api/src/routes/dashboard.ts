import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/dashboard", async (request, reply) => {
    const people = await prisma.person.findMany({
      where: { userId: request.user!.sub },
      include: {
        connections: {
          include: {
            accounts: {
              include: {
                transactions: { orderBy: { date: "desc" }, take: 30 },
              },
            },
          },
        },
      },
    });

    const accounts: {
      id: string;
      name: string;
      type: string | null;
      subtype: string | null;
      number: string | null;
      balance: number;
      currencyCode: string;
      personName: string;
    }[] = [];

    const perPerson: { personId: string; personName: string; balance: number }[] = [];

    const allTransactions: {
      id: string;
      date: string;
      description: string;
      amount: number;
      currencyCode: string;
      category: string | null;
      accountId: string;
      accountName: string;
      personId: string;
      personName: string;
    }[] = [];

    let totalBalance = 0;

    for (const person of people) {
      let personBalance = 0;
      for (const connection of person.connections) {
        for (const acc of connection.accounts) {
          personBalance += acc.balance;
          accounts.push({
            id: acc.id,
            name: acc.name,
            type: acc.type,
            subtype: acc.subtype,
            number: acc.number,
            balance: acc.balance,
            currencyCode: acc.currencyCode,
            personName: person.name,
          });
          for (const tx of acc.transactions) {
            allTransactions.push({
              id: tx.id,
              date: tx.date.toISOString(),
              description: tx.description,
              amount: tx.amount,
              currencyCode: tx.currencyCode,
              category: tx.category,
              accountId: acc.id,
              accountName: acc.name,
              personId: person.id,
              personName: person.name,
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

    allTransactions.sort((a, b) => b.date.localeCompare(a.date));

    return reply.send({
      totalBalance,
      currencyCode: "BRL",
      perPerson,
      accounts,
      recentTransactions: allTransactions.slice(0, 20),
    });
  });
}
