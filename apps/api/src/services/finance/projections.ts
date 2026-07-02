import type { GoalDTO, PlanDTO, PaydayCycleAnchor } from "@finance/shared";
import { DEFAULT_PAYDAY_CYCLE_ANCHOR, getRecentPaydayCycles } from "@finance/shared";
import {
  getCycleSummary,
  getMonthlySummary,
  getRecentMonthKeys,
} from "./aggregates.js";
import type { FinancialTransaction } from "./types.js";

const SURPLUS_MONTHS = 3;

export function resolveMonthlyContribution(
  plans: PlanDTO[],
  monthlySurplus: number,
): number {
  const activePlans = plans.filter((p) => p.status === "active");
  if (activePlans.length === 0) {
    return Math.max(monthlySurplus, 0);
  }

  const fromAllocations = activePlans.reduce(
    (sum, plan) => sum + plan.goals.reduce((s, member) => s + member.monthlyAllocation, 0),
    0,
  );
  if (fromAllocations > 0) return fromAllocations;

  return activePlans.reduce((sum, plan) => sum + plan.monthlyContribution, 0);
}

export function computeGoalsTotals(goals: GoalDTO[]): {
  totalCurrent: number;
  totalTarget: number;
} {
  const activeGoals = goals.filter((g) => g.status === "active");
  return {
    totalCurrent: activeGoals.reduce((sum, goal) => sum + goal.currentAmount, 0),
    totalTarget: activeGoals.reduce((sum, goal) => sum + goal.targetAmount, 0),
  };
}

export function computeMonthlySurplus(txs: FinancialTransaction[]): number {
  const monthKeys = getRecentMonthKeys(SURPLUS_MONTHS);
  if (monthKeys.length === 0) return 0;

  const nets = monthKeys.map((month) => getMonthlySummary(txs, month).net);
  const total = nets.reduce((sum, net) => sum + net, 0);
  return total / monthKeys.length;
}

export function computeCycleSurplus(
  txs: FinancialTransaction[],
  paydayDay: number,
  paydayCycleAnchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
): number {
  const cycleStarts = getRecentPaydayCycles(SURPLUS_MONTHS, paydayDay, 1, paydayCycleAnchor);
  if (cycleStarts.length === 0) return 0;

  const nets = cycleStarts.map((start) =>
    getCycleSummary(txs, start, paydayDay, paydayCycleAnchor).net,
  );
  const total = nets.reduce((sum, net) => sum + net, 0);
  return total / cycleStarts.length;
}

export function resolveSurplus(
  txs: FinancialTransaction[],
  paydayDay: number | null,
  paydayCycleAnchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
): { surplus: number; periodMode: "calendar" | "payday"; label: string } {
  if (paydayDay !== null) {
    return {
      surplus: computeCycleSurplus(txs, paydayDay, paydayCycleAnchor),
      periodMode: "payday",
      label: "sobra média por ciclo",
    };
  }
  return {
    surplus: computeMonthlySurplus(txs),
    periodMode: "calendar",
    label: "sobra média mensal",
  };
}

export function computeGoalProgress(targetAmount: number, currentAmount: number): number {
  if (targetAmount <= 0) return 0;
  return Math.min(100, (currentAmount / targetAmount) * 100);
}

type GoalRecord = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  icon: string | null;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date | null;
  status: string;
  trackingMode?: string;
  linkedAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeGoal(goal: GoalRecord): GoalDTO {
  return {
    id: goal.id,
    name: goal.name,
    description: goal.description,
    type: goal.type as GoalDTO["type"],
    icon: goal.icon,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    computedAmount: goal.currentAmount,
    targetDate: goal.targetDate?.toISOString() ?? null,
    status: goal.status as GoalDTO["status"],
    trackingMode: goal.trackingMode === "linked" ? "linked" : "manual",
    linkedAccountId: goal.linkedAccountId,
    sources: [],
    progress: computeGoalProgress(goal.targetAmount, goal.currentAmount),
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}

type PlanRecord = {
  id: string;
  name: string;
  description: string | null;
  monthlyContribution: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  members: {
    id: string;
    goalId: string;
    monthlyAllocation: number;
    goal: {
      name: string;
      currentAmount: number;
      targetAmount: number;
    };
  }[];
};

export function serializePlan(plan: PlanRecord): PlanDTO {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    monthlyContribution: plan.monthlyContribution,
    status: plan.status as PlanDTO["status"],
    goals: plan.members.map((member) => ({
      id: member.id,
      goalId: member.goalId,
      goalName: member.goal.name,
      monthlyAllocation: member.monthlyAllocation,
      currentAmount: member.goal.currentAmount,
      targetAmount: member.goal.targetAmount,
    })),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}
