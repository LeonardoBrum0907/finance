import { translateCategory } from "@finance/shared";
import { prisma } from "../../prisma.js";
import { formatCurrency, formatLocalDate, getRecentMonthKeys, monthKeysToDateRange } from "./aggregates.js";
import {
  buildSavingsPath,
  computeGoalsTotals,
  computeMonthlySurplus,
  computeProjectedCompletionMonth,
  resolveMonthlyContribution,
  serializeGoal,
  serializePlan,
} from "./projections.js";
import type { FinancialTransaction } from "./types.js";

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

export async function loadGoalsSummaryForUser(userId: string) {
  const [transactions, goalRows, planRows] = await Promise.all([
    loadRecentTransactions(userId),
    prisma.goal.findMany({
      where: { userId, status: { not: "archived" } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.plan.findMany({
      where: { userId, status: { not: "archived" } },
      include: { members: { include: { goal: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const monthlySurplus = computeMonthlySurplus(transactions);
  const goals = goalRows.map((goal) => serializeGoal(goal, monthlySurplus));
  const plans = planRows.map((plan) => serializePlan(plan));
  const { totalCurrent, totalTarget } = computeGoalsTotals(goals);
  const monthlyContribution = resolveMonthlyContribution(plans, monthlySurplus);

  return {
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
  };
}

export async function loadPendingProposalsForThread(userId: string, threadId: string) {
  return prisma.chatActionProposal.findMany({
    where: { userId, threadId, status: "pending" },
    orderBy: { createdAt: "asc" },
  });
}

export async function buildGoalsContextBlock(
  userId: string,
  threadId?: string,
): Promise<string> {
  const summary = await loadGoalsSummaryForUser(userId);
  const lines: string[] = ["## Objetivos e planos financeiros"];

  const activeGoals = summary.goals.filter((g) => g.status === "active");

  if (activeGoals.length === 0) {
    lines.push("Nenhum objetivo ativo cadastrado no momento.");
  } else {
    lines.push(
      `Poupança total: ${formatCurrency(summary.totalCurrent)} | Meta total: ${formatCurrency(summary.totalTarget)} | Sobra mensal média: ${formatCurrency(summary.monthlySurplus)} | Aporte mensal efetivo (planos): ${formatCurrency(summary.monthlyContribution)}`,
    );
    lines.push("\n### Objetivos ativos");
    for (const goal of activeGoals) {
      const deadline = goal.targetDate
        ? formatLocalDate(new Date(goal.targetDate))
        : "sem prazo";
      const track =
        goal.onTrack === true ? "no prazo" : goal.onTrack === false ? "atrasado" : "—";
      lines.push(
        `- id=${goal.id} | "${goal.name}" | ${formatCurrency(goal.currentAmount)} de ${formatCurrency(goal.targetAmount)} (${goal.progress.toFixed(0)}%) | prazo: ${deadline} | ${track}`,
      );
    }
  }

  const activePlans = summary.plans.filter((p) => p.status === "active");
  if (activePlans.length > 0) {
    lines.push("\n### Planos ativos");
    for (const plan of activePlans) {
      const allocations = plan.goals
        .map((m) => `${m.goalName}: ${formatCurrency(m.monthlyAllocation)}/mês`)
        .join("; ");
      lines.push(
        `- id=${plan.id} | "${plan.name}" | ${formatCurrency(plan.monthlyContribution)}/mês total | ${allocations}`,
      );
    }
  } else {
    lines.push("\nNenhum plano de poupança ativo.");
  }

  if (threadId) {
    const pending = await loadPendingProposalsForThread(userId, threadId);
    if (pending.length > 0) {
      lines.push("\n### Propostas aguardando confirmação do usuário (ainda NÃO estão no banco)");
      for (const proposal of pending) {
        const payload = proposal.payload as Record<string, unknown>;
        lines.push(`- tipo=${proposal.type} | payload=${JSON.stringify(payload)}`);
      }
      lines.push(
        "Objetivos em proposta pendente só existirão após o usuário clicar em Confirmar no card.",
      );
    }
  }

  return lines.join("\n");
}

export function formatGoalsForTool(
  summary: Awaited<ReturnType<typeof loadGoalsSummaryForUser>>,
) {
  return {
    totalCurrent: summary.totalCurrent,
    totalTarget: summary.totalTarget,
    monthlySurplus: summary.monthlySurplus,
    monthlyContribution: summary.monthlyContribution,
    projectedCompletionMonth: summary.projectedCompletionMonth,
    goals: summary.goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      type: goal.type,
      status: goal.status,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      progress: goal.progress,
      targetDate: goal.targetDate,
      onTrack: goal.onTrack,
      projectedCompletionDate: goal.projectedCompletionDate,
    })),
    plans: summary.plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      status: plan.status,
      monthlyContribution: plan.monthlyContribution,
      goals: plan.goals.map((member) => ({
        goalId: member.goalId,
        goalName: member.goalName,
        monthlyAllocation: member.monthlyAllocation,
      })),
    })),
  };
}
