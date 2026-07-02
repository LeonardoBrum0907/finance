import type { FastifyInstance } from "fastify";
import {
  addContributionSchema,
  createGoalSchema,
  createPlanSchema,
  getRecentPaydayCycles,
  paydayCyclesToDateRange,
  updateGoalSchema,
  updatePlanSchema,
  updateGoalSourcesSchema,
  type GoalsSummaryDTO,
  type PaydayCycleAnchor,
} from "@finance/shared";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";
import type { FinancialTransaction } from "../services/finance/types.js";
import { effectiveTransactionCategory } from "../services/transactionCategory.js";
import {
  getRecentMonthKeys,
  monthKeysToDateRange,
} from "../services/finance/aggregates.js";
import {
  computeGoalsTotals,
  resolveMonthlyContribution,
  resolveSurplus,
  serializeGoal,
  serializePlan,
} from "../services/finance/projections.js";
import { resolvePaydayCycle } from "../services/userSettings.js";
import {
  applyGoalSources,
  buildAvailableSources,
  clearGoalSources,
  loadGoalBalanceContext,
  reconcileGoalsForUser,
  resolveGoalCurrentAmount,
  serializeGoalSources,
  type GoalSourceInput,
} from "../services/finance/goalTracking.js";

async function loadRecentTransactions(
  userId: string,
  paydayDay: number | null,
  paydayCycleAnchor: PaydayCycleAnchor,
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

async function countUserAccounts(userId: string) {
  return prisma.account.count({
    where: { connection: { person: { userId } } },
  });
}

async function loadUserGoals(userId: string) {
  return prisma.goal.findMany({
    where: { userId, status: { not: "archived" } },
    include: { sources: true },
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
  const { paydayDay, paydayCycleAnchor } = await resolvePaydayCycle(userId);
  const [transactions, goalRows, planRows, accountCount, balanceContext] = await Promise.all([
    loadRecentTransactions(userId, paydayDay, paydayCycleAnchor),
    loadUserGoals(userId),
    loadUserPlans(userId),
    countUserAccounts(userId),
    loadGoalBalanceContext(userId),
  ]);

  const { surplus: monthlySurplus, periodMode: surplusPeriodMode, label: surplusLabel } =
    resolveSurplus(transactions, paydayDay, paydayCycleAnchor);

  const goals = goalRows.map((goal) => {
    const computedAmount = resolveGoalCurrentAmount(goal, balanceContext);
    const serialized = serializeGoal({ ...goal, currentAmount: computedAmount });
    return {
      ...serialized,
      trackingMode: (goal.trackingMode === "linked" ? "linked" : "manual") as "manual" | "linked",
      computedAmount,
      currentAmount: computedAmount,
      sources: serializeGoalSources(goal.sources, balanceContext),
    };
  });

  const plans = planRows.map((plan) => {
    const enrichedMembers = plan.members.map((member) => {
      const goalRow = goalRows.find((g) => g.id === member.goalId);
      const computedAmount = goalRow
        ? resolveGoalCurrentAmount(goalRow, balanceContext)
        : member.goal.currentAmount;
      return {
        ...member,
        goal: { ...member.goal, currentAmount: computedAmount },
      };
    });
    return serializePlan({ ...plan, members: enrichedMembers });
  });

  const { totalCurrent, totalTarget } = computeGoalsTotals(goals);
  const monthlyContribution = resolveMonthlyContribution(plans, monthlySurplus);

  return {
    currencyCode: "BRL",
    monthlySurplus,
    monthlyContribution,
    totalCurrent,
    totalTarget,
    goals,
    plans,
    hasAccounts: accountCount > 0,
    surplusPeriodMode,
    surplusLabel,
    availableSources: buildAvailableSources(balanceContext),
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

    if (goal.trackingMode === "linked") {
      return reply.code(400).send({
        error: "Este objetivo usa acompanhamento automático. Edite as fontes vinculadas em vez de adicionar fundos manualmente.",
      });
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

  app.get("/api/goals/sources", async (request, reply) => {
    const userId = request.user!.sub;
    const context = await loadGoalBalanceContext(userId);
    return reply.send({ sources: buildAvailableSources(context) });
  });

  app.put("/api/goals/:id/sources", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateGoalSourcesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }

    const userId = request.user!.sub;
    const existing = await verifyGoalOwnership(userId, id);
    if (!existing) {
      return reply.code(404).send({ error: "Objetivo não encontrado" });
    }

    try {
      await applyGoalSources(userId, id, parsed.data.sources as GoalSourceInput[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível vincular as fontes";
      return reply.code(409).send({ error: message });
    }

    const summary = await fetchGoalsSummary(userId);
    return reply.send(summary);
  });

  app.delete("/api/goals/:id/sources", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.sub;
    const existing = await verifyGoalOwnership(userId, id);
    if (!existing) {
      return reply.code(404).send({ error: "Objetivo não encontrado" });
    }

    try {
      await clearGoalSources(userId, id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível remover as fontes";
      return reply.code(400).send({ error: message });
    }

    const summary = await fetchGoalsSummary(userId);
    return reply.send(summary);
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
