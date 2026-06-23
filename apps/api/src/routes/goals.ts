import type { FastifyInstance } from "fastify";
import {
  addContributionSchema,
  createGoalSchema,
  createPlanSchema,
  translateCategory,
  updateGoalSchema,
  updatePlanSchema,
  type GoalsSummaryDTO,
} from "@finance/shared";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";
import type { FinancialTransaction } from "../services/finance/types.js";
import { monthKeysToDateRange, getRecentMonthKeys } from "../services/finance/aggregates.js";
import {
  buildSavingsPath,
  computeGoalsTotals,
  computeMonthlySurplus,
  computeProjectedCompletionMonth,
  resolveMonthlyContribution,
  serializeGoal,
  serializePlan,
} from "../services/finance/projections.js";

async function loadRecentTransactions(userId: string): Promise<FinancialTransaction[]> {
  const monthKeys = getRecentMonthKeys(3);
  const range = monthKeysToDateRange(monthKeys);
  const dateFrom = range.from ? new Date(`${range.from}T00:00:00.000Z`) : new Date(0);
  const dateTo = range.to ? new Date(`${range.to}T23:59:59.999Z`) : new Date();

  const people = await prisma.person.findMany({
    where: { userId },
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

async function countUserAccounts(userId: string) {
  return prisma.account.count({
    where: { connection: { person: { userId } } },
  });
}

async function loadUserGoals(userId: string) {
  return prisma.goal.findMany({
    where: { userId, status: { not: "archived" } },
    orderBy: { createdAt: "desc" },
  });
}

async function loadUserPlans(userId: string) {
  return prisma.plan.findMany({
    where: { userId, status: { not: "archived" } },
    include: {
      members: {
        include: { goal: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function fetchGoalsSummary(userId: string): Promise<GoalsSummaryDTO> {
  const [transactions, goalRows, planRows, accountCount] = await Promise.all([
    loadRecentTransactions(userId),
    loadUserGoals(userId),
    loadUserPlans(userId),
    countUserAccounts(userId),
  ]);

  const monthlySurplus = computeMonthlySurplus(transactions);
  const goals = goalRows.map((goal) => serializeGoal(goal, monthlySurplus));
  const plans = planRows.map((plan) => serializePlan(plan));
  const { totalCurrent, totalTarget } = computeGoalsTotals(goals);
  const monthlyContribution = resolveMonthlyContribution(plans, monthlySurplus);

  return {
    currencyCode: "BRL",
    monthlySurplus,
    monthlyContribution,
    totalCurrent,
    totalTarget,
    projectedCompletionMonth: computeProjectedCompletionMonth(
      totalCurrent,
      totalTarget,
      monthlyContribution,
    ),
    goals,
    plans,
    savingsPath: buildSavingsPath(goals, plans, monthlySurplus),
    hasAccounts: accountCount > 0,
  };
}

function parseOptionalDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

async function verifyGoalOwnership(userId: string, goalId: string) {
  return prisma.goal.findFirst({ where: { id: goalId, userId } });
}

async function verifyPlanOwnership(userId: string, planId: string) {
  return prisma.plan.findFirst({ where: { id: planId, userId } });
}

async function verifyGoalsBelongToUser(userId: string, goalIds: string[]) {
  const count = await prisma.goal.count({
    where: { userId, id: { in: goalIds } },
  });
  return count === goalIds.length;
}

export async function goalRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/goals", async (request, reply) => {
    const userId = request.user!.sub;
    const summary = await fetchGoalsSummary(userId);
    return reply.send(summary);
  });

  app.post("/api/goals", async (request, reply) => {
    const parsed = createGoalSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }

    const userId = request.user!.sub;
    const { name, description, type, icon, targetAmount, targetDate, linkedAccountId } =
      parsed.data;

    if (linkedAccountId) {
      const account = await prisma.account.findFirst({
        where: { id: linkedAccountId, connection: { person: { userId } } },
      });
      if (!account) {
        return reply.code(400).send({ error: "Conta vinculada não encontrada" });
      }
    }

    await prisma.goal.create({
      data: {
        userId,
        name,
        description,
        type,
        icon,
        targetAmount,
        targetDate: parseOptionalDate(targetDate) ?? null,
        linkedAccountId: linkedAccountId ?? null,
      },
    });

    const summary = await fetchGoalsSummary(userId);
    return reply.code(201).send(summary);
  });

  app.put("/api/goals/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateGoalSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }

    const userId = request.user!.sub;
    const existing = await verifyGoalOwnership(userId, id);
    if (!existing) {
      return reply.code(404).send({ error: "Objetivo não encontrado" });
    }

    const { linkedAccountId, targetDate, ...rest } = parsed.data;

    if (linkedAccountId) {
      const account = await prisma.account.findFirst({
        where: { id: linkedAccountId, connection: { person: { userId } } },
      });
      if (!account) {
        return reply.code(400).send({ error: "Conta vinculada não encontrada" });
      }
    }

    await prisma.goal.update({
      where: { id },
      data: {
        ...rest,
        ...(targetDate !== undefined ? { targetDate: parseOptionalDate(targetDate) } : {}),
        ...(linkedAccountId !== undefined ? { linkedAccountId } : {}),
      },
    });

    const summary = await fetchGoalsSummary(userId);
    return reply.send(summary);
  });

  app.delete("/api/goals/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.sub;
    const existing = await verifyGoalOwnership(userId, id);
    if (!existing) {
      return reply.code(404).send({ error: "Objetivo não encontrado" });
    }

    await prisma.goal.delete({ where: { id } });
    const summary = await fetchGoalsSummary(userId);
    return reply.send(summary);
  });

  app.post("/api/goals/:id/contributions", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = addContributionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }

    const userId = request.user!.sub;
    const goal = await verifyGoalOwnership(userId, id);
    if (!goal) {
      return reply.code(404).send({ error: "Objetivo não encontrado" });
    }

    const { amount, date, note } = parsed.data;
    const contributionDate = date ? new Date(date) : new Date();

    await prisma.$transaction(async (tx) => {
      await tx.goalContribution.create({
        data: {
          goalId: id,
          amount,
          date: contributionDate,
          source: "manual",
          note: note ?? null,
        },
      });
      await tx.goal.update({
        where: { id },
        data: {
          currentAmount: { increment: amount },
          status: goal.currentAmount + amount >= goal.targetAmount ? "completed" : goal.status,
        },
      });
    });

    const summary = await fetchGoalsSummary(userId);
    return reply.code(201).send(summary);
  });

  app.post("/api/plans", async (request, reply) => {
    const parsed = createPlanSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }

    const userId = request.user!.sub;
    const { name, description, monthlyContribution, goals } = parsed.data;
    const goalIds = goals.map((g) => g.goalId);

    if (!(await verifyGoalsBelongToUser(userId, goalIds))) {
      return reply.code(400).send({ error: "Um ou mais objetivos não foram encontrados" });
    }

    await prisma.plan.create({
      data: {
        userId,
        name,
        description,
        monthlyContribution,
        members: {
          create: goals.map((member) => ({
            goalId: member.goalId,
            monthlyAllocation: member.monthlyAllocation,
          })),
        },
      },
    });

    const summary = await fetchGoalsSummary(userId);
    return reply.code(201).send(summary);
  });

  app.put("/api/plans/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updatePlanSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }

    const userId = request.user!.sub;
    const existing = await verifyPlanOwnership(userId, id);
    if (!existing) {
      return reply.code(404).send({ error: "Plano não encontrado" });
    }

    const { goals, ...rest } = parsed.data;

    if (goals) {
      const goalIds = goals.map((g) => g.goalId);
      if (!(await verifyGoalsBelongToUser(userId, goalIds))) {
        return reply.code(400).send({ error: "Um ou mais objetivos não foram encontrados" });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.plan.update({
        where: { id },
        data: rest,
      });

      if (goals) {
        await tx.planGoal.deleteMany({ where: { planId: id } });
        await tx.planGoal.createMany({
          data: goals.map((member) => ({
            planId: id,
            goalId: member.goalId,
            monthlyAllocation: member.monthlyAllocation,
          })),
        });
      }
    });

    const summary = await fetchGoalsSummary(userId);
    return reply.send(summary);
  });

  app.delete("/api/plans/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.sub;
    const existing = await verifyPlanOwnership(userId, id);
    if (!existing) {
      return reply.code(404).send({ error: "Plano não encontrado" });
    }

    await prisma.plan.delete({ where: { id } });
    const summary = await fetchGoalsSummary(userId);
    return reply.send(summary);
  });
}

export { fetchGoalsSummary };
