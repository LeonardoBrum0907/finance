import type { FastifyInstance } from "fastify";
import {
  DASHBOARD_CATEGORY_GROUPS,
  translateCategory,
  updateBudgetLimitSchema,
  type BudgetCategoryItem,
  type BudgetStatus,
  type DashboardCategoryGroup,
} from "@finance/shared";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";
import type { FinancialTransaction } from "../services/finance/types.js";
import {
  getSpendingByCategory,
  monthKeysToDateRange,
  toLocalMonthKey,
} from "../services/finance/aggregates.js";

function getBudgetStatus(ratio: number): BudgetStatus {
  if (ratio > 90) return "critical";
  if (ratio > 75) return "warning";
  return "safe";
}

function computeRatio(spent: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, (spent / limit) * 100);
}

function isDashboardCategoryGroup(value: string): value is DashboardCategoryGroup {
  return (DASHBOARD_CATEGORY_GROUPS as readonly string[]).includes(value);
}

async function loadMonthTransactions(
  userId: string,
  personId?: string,
): Promise<FinancialTransaction[]> {
  const currentMonth = toLocalMonthKey(new Date());
  const range = monthKeysToDateRange([currentMonth]);
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
                where: {
                  date: { gte: dateFrom, lte: dateTo },
                },
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

function buildBudgetsSummary(
  transactions: FinancialTransaction[],
  limitsByGroup: Map<string, number>,
  hasAccounts: boolean,
): {
  month: string;
  currencyCode: string;
  totalSpent: number;
  totalLimit: number;
  overallRatio: number;
  potentialSavings: number;
  categories: BudgetCategoryItem[];
  hasAccounts: boolean;
} {
  const currentMonth = toLocalMonthKey(new Date());
  const range = monthKeysToDateRange([currentMonth]);
  const spending = getSpendingByCategory(transactions, range);
  const spentByGroup = new Map(spending.map((item) => [item.category, item.total]));

  const categories: BudgetCategoryItem[] = DASHBOARD_CATEGORY_GROUPS.map((group) => {
    const spent = spentByGroup.get(group) ?? 0;
    const limit = limitsByGroup.get(group) ?? 0;
    const ratio = computeRatio(spent, limit);
    return {
      group,
      spent,
      limit,
      ratio,
      status: getBudgetStatus(ratio),
    };
  });

  const totalSpent = categories.reduce((sum, item) => sum + item.spent, 0);
  const totalLimit = categories.reduce((sum, item) => sum + item.limit, 0);
  const overallRatio = computeRatio(totalSpent, totalLimit);
  const potentialSavings = Math.max(0, totalLimit - totalSpent);

  return {
    month: currentMonth,
    currencyCode: "BRL",
    totalSpent,
    totalLimit,
    overallRatio,
    potentialSavings,
    categories,
    hasAccounts,
  };
}

export async function budgetRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/budgets", async (request, reply) => {
    const query = request.query as { personId?: string };
    const personId = query.personId?.trim() || undefined;
    const userId = request.user!.sub;

    if (personId) {
      const person = await prisma.person.findFirst({
        where: { id: personId, userId },
      });
      if (!person) {
        return reply.code(404).send({ error: "Pessoa não encontrada" });
      }
    }

    const [transactions, storedLimits, accountCount] = await Promise.all([
      loadMonthTransactions(userId, personId),
      prisma.categoryBudget.findMany({ where: { userId } }),
      prisma.account.count({
        where: {
          connection: {
            person: {
              userId,
              ...(personId ? { id: personId } : {}),
            },
          },
        },
      }),
    ]);

    const limitsByGroup = new Map(storedLimits.map((item) => [item.group, item.limit]));
    const summary = buildBudgetsSummary(transactions, limitsByGroup, accountCount > 0);

    return reply.send(summary);
  });

  app.put("/api/budgets/:group", async (request, reply) => {
    const { group: rawGroup } = request.params as { group: string };
    const query = request.query as { personId?: string };
    const personId = query.personId?.trim() || undefined;
    const group = decodeURIComponent(rawGroup);

    if (!isDashboardCategoryGroup(group)) {
      return reply.code(400).send({ error: "Categoria de orçamento inválida" });
    }

    const parsed = updateBudgetLimitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }

    const userId = request.user!.sub;

    await prisma.categoryBudget.upsert({
      where: {
        userId_group: { userId, group },
      },
      create: {
        userId,
        group,
        limit: parsed.data.limit,
      },
      update: {
        limit: parsed.data.limit,
      },
    });

    const [transactions, storedLimits, accountCount] = await Promise.all([
      loadMonthTransactions(userId, personId),
      prisma.categoryBudget.findMany({ where: { userId } }),
      prisma.account.count({
        where: {
          connection: {
            person: {
              userId,
              ...(personId ? { id: personId } : {}),
            },
          },
        },
      }),
    ]);

    const limitsByGroup = new Map(storedLimits.map((item) => [item.group, item.limit]));
    const summary = buildBudgetsSummary(transactions, limitsByGroup, accountCount > 0);

    return reply.send(summary);
  });
}
