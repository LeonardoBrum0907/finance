import type { FastifyInstance } from "fastify";
import {
  createBudgetSchema,
  DASHBOARD_CATEGORY_GROUPS,
  translateCategory,
  updateBudgetSchema,
  type BudgetItem,
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

type BudgetGroupWithMembers = {
  id: string;
  name: string;
  limit: number;
  members: { categoryGroup: string }[];
};

function buildBudgetsSummary(
  transactions: FinancialTransaction[],
  groups: BudgetGroupWithMembers[],
  hasAccounts: boolean,
) {
  const currentMonth = toLocalMonthKey(new Date());
  const range = monthKeysToDateRange([currentMonth]);
  const spending = getSpendingByCategory(transactions, range);
  const spentByGroup = new Map(spending.map((item) => [item.category, item.total]));

  const assignedCategories = new Set<string>();
  for (const group of groups) {
    for (const member of group.members) {
      assignedCategories.add(member.categoryGroup);
    }
  }

  const budgets: BudgetItem[] = groups.map((group) => {
    const spent = group.members.reduce(
      (sum, member) => sum + (spentByGroup.get(member.categoryGroup) ?? 0),
      0,
    );
    const ratio = computeRatio(spent, group.limit);
    return {
      id: group.id,
      name: group.name,
      categories: group.members.map((m) => m.categoryGroup as DashboardCategoryGroup),
      spent,
      limit: group.limit,
      ratio,
      status: getBudgetStatus(ratio),
    };
  });

  const availableCategories = DASHBOARD_CATEGORY_GROUPS.filter(
    (cat) => !assignedCategories.has(cat),
  );

  const totalSpent = budgets.reduce((sum, item) => sum + item.spent, 0);
  const totalLimit = budgets.reduce((sum, item) => sum + item.limit, 0);
  const overallRatio = computeRatio(totalSpent, totalLimit);
  const potentialSavings = Math.max(0, totalLimit - totalSpent);

  return {
    month: currentMonth,
    currencyCode: "BRL",
    totalSpent,
    totalLimit,
    overallRatio,
    potentialSavings,
    budgets,
    availableCategories,
    hasAccounts,
  };
}

async function loadUserBudgetGroups(userId: string) {
  return prisma.budgetGroup.findMany({
    where: { userId },
    include: { members: true },
    orderBy: { name: "asc" },
  });
}

async function countUserAccounts(userId: string, personId?: string) {
  return prisma.account.count({
    where: {
      connection: {
        person: {
          userId,
          ...(personId ? { id: personId } : {}),
        },
      },
    },
  });
}

async function fetchBudgetsSummary(userId: string, personId?: string) {
  const [transactions, groups, accountCount] = await Promise.all([
    loadMonthTransactions(userId, personId),
    loadUserBudgetGroups(userId),
    countUserAccounts(userId, personId),
  ]);

  return buildBudgetsSummary(transactions, groups, accountCount > 0);
}

function validateCategories(categories: string[]): categories is DashboardCategoryGroup[] {
  return categories.length > 0 && categories.every(isDashboardCategoryGroup);
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

    const summary = await fetchBudgetsSummary(userId, personId);
    return reply.send(summary);
  });

  app.post("/api/budgets", async (request, reply) => {
    const parsed = createBudgetSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }

    const userId = request.user!.sub;
    const { name, limit, categories } = parsed.data;

    const existing = await prisma.budgetGroup.findUnique({
      where: { userId_name: { userId, name } },
    });
    if (existing) {
      return reply.code(409).send({ error: "Já existe um orçamento com este nome" });
    }

    const conflict = await prisma.budgetGroupMember.findFirst({
      where: {
        userId,
        categoryGroup: { in: categories },
      },
    });
    if (conflict) {
      return reply.code(409).send({
        error: "Uma ou mais categorias já pertencem a outro orçamento",
      });
    }

    await prisma.budgetGroup.create({
      data: {
        userId,
        name,
        limit,
        members: {
          create: categories.map((categoryGroup) => ({
            userId,
            categoryGroup,
          })),
        },
      },
    });

    const summary = await fetchBudgetsSummary(userId);
    return reply.code(201).send(summary);
  });

  app.put("/api/budgets/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { personId?: string };
    const personId = query.personId?.trim() || undefined;
    const parsed = updateBudgetSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }

    const userId = request.user!.sub;
    const existing = await prisma.budgetGroup.findFirst({
      where: { id, userId },
      include: { members: true },
    });

    if (!existing) {
      return reply.code(404).send({ error: "Orçamento não encontrado" });
    }

    const { name, limit, categories } = parsed.data;

    if (name && name !== existing.name) {
      const nameConflict = await prisma.budgetGroup.findUnique({
        where: { userId_name: { userId, name } },
      });
      if (nameConflict) {
        return reply.code(409).send({ error: "Já existe um orçamento com este nome" });
      }
    }

    if (categories) {
      if (!validateCategories(categories)) {
        return reply.code(400).send({ error: "Categoria de orçamento inválida" });
      }

      const conflict = await prisma.budgetGroupMember.findFirst({
        where: {
          userId,
          categoryGroup: { in: categories },
          budgetGroupId: { not: id },
        },
      });
      if (conflict) {
        return reply.code(409).send({
          error: "Uma ou mais categorias já pertencem a outro orçamento",
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.budgetGroup.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(limit !== undefined ? { limit } : {}),
        },
      });

      if (categories) {
        await tx.budgetGroupMember.deleteMany({ where: { budgetGroupId: id } });
        await tx.budgetGroupMember.createMany({
          data: categories.map((categoryGroup) => ({
            budgetGroupId: id,
            userId,
            categoryGroup,
          })),
        });
      }
    });

    const summary = await fetchBudgetsSummary(userId, personId);
    return reply.send(summary);
  });

  app.delete("/api/budgets/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { personId?: string };
    const personId = query.personId?.trim() || undefined;
    const userId = request.user!.sub;

    const existing = await prisma.budgetGroup.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "Orçamento não encontrado" });
    }

    await prisma.budgetGroup.delete({ where: { id } });

    const summary = await fetchBudgetsSummary(userId, personId);
    return reply.send(summary);
  });
}
