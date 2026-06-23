import type { GoalDTO, PlanDTO, SavingsPathPoint } from "@finance/shared";
import {
  addMonthsToMonthKey,
  getMonthlySummary,
  getRecentMonthKeys,
  toLocalMonthKey,
} from "./aggregates.js";
import type { FinancialTransaction } from "./types.js";

const SURPLUS_MONTHS = 3;
const PATH_HORIZON_MONTHS = 12;
const MAX_PATH_MONTHS = 60;

function formatQuarterLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const quarter = Math.ceil(month / 3);
  return `T${quarter} ${year}`;
}

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

export interface GoalProjectionInput {
  targetAmount: number;
  currentAmount: number;
  targetDate: Date | null;
}

export interface GoalProjectionResult {
  projectedCompletionDate: string | null;
  onTrack: boolean | null;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function projectGoalCompletion(
  goal: GoalProjectionInput,
  monthlySurplus: number,
): GoalProjectionResult {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

  if (remaining <= 0) {
    return { projectedCompletionDate: new Date().toISOString(), onTrack: true };
  }

  if (monthlySurplus <= 0) {
    return {
      projectedCompletionDate: null,
      onTrack: goal.targetDate ? false : null,
    };
  }

  const monthsNeeded = Math.ceil(remaining / monthlySurplus);
  const projected = addDays(new Date(), monthsNeeded * 30);
  const projectedCompletionDate = projected.toISOString();

  if (!goal.targetDate) {
    return { projectedCompletionDate, onTrack: null };
  }

  return {
    projectedCompletionDate,
    onTrack: projected.getTime() <= goal.targetDate.getTime(),
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
  linkedAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeGoal(goal: GoalRecord, monthlySurplus: number): GoalDTO {
  const projection = projectGoalCompletion(goal, monthlySurplus);
  return {
    id: goal.id,
    name: goal.name,
    description: goal.description,
    type: goal.type as GoalDTO["type"],
    icon: goal.icon,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    targetDate: goal.targetDate?.toISOString() ?? null,
    status: goal.status as GoalDTO["status"],
    linkedAccountId: goal.linkedAccountId,
    progress: computeGoalProgress(goal.targetAmount, goal.currentAmount),
    projectedCompletionDate: projection.projectedCompletionDate,
    onTrack: projection.onTrack,
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

function pickMilestoneMonths(horizonMonths: number): number[] {
  const milestones = new Set<number>([0, horizonMonths]);

  if (horizonMonths >= 9) {
    const step = Math.max(3, Math.round(horizonMonths / 4));
    for (let month = step; month < horizonMonths; month += step) {
      milestones.add(month);
    }
  } else if (horizonMonths >= 4) {
    milestones.add(Math.round(horizonMonths / 2));
  } else if (horizonMonths >= 2) {
    milestones.add(1);
  }

  return [...milestones].sort((a, b) => a - b);
}

export function buildSavingsPath(
  goals: GoalDTO[],
  plans: PlanDTO[],
  monthlySurplus: number,
): SavingsPathPoint[] {
  const currentMonth = toLocalMonthKey(new Date());
  const activeGoals = goals.filter((g) => g.status === "active");
  if (activeGoals.length === 0) return [];

  const { totalCurrent, totalTarget } = computeGoalsTotals(goals);
  const monthlyContribution = resolveMonthlyContribution(plans, monthlySurplus);

  if (totalCurrent >= totalTarget) {
    return [
      {
        month: currentMonth,
        projectedAmount: totalTarget,
        cumulativeContributions: 0,
        label: "Hoje",
        targetAmount: totalTarget,
      },
      {
        month: currentMonth,
        projectedAmount: totalTarget,
        cumulativeContributions: 0,
        label: "Meta atingida",
        targetAmount: totalTarget,
      },
    ];
  }

  const remaining = totalTarget - totalCurrent;
  const monthsToComplete =
    monthlyContribution > 0 ? Math.ceil(remaining / monthlyContribution) : null;

  const horizonMonths = Math.min(
    monthsToComplete ?? PATH_HORIZON_MONTHS,
    MAX_PATH_MONTHS,
  );

  const milestoneMonths = pickMilestoneMonths(horizonMonths);

  return milestoneMonths.map((monthOffset) => {
    const month =
      monthOffset === 0 ? currentMonth : addMonthsToMonthKey(currentMonth, monthOffset);
    const projectedAmount = Math.min(
      totalCurrent + monthlyContribution * monthOffset,
      totalTarget,
    );

    let label: string | null = null;
    if (monthOffset === 0) {
      label = "Hoje";
    } else if (monthOffset === horizonMonths && monthsToComplete !== null) {
      label = "Meta atingida";
    } else if (horizonMonths >= 6) {
      label = formatQuarterLabel(month);
    }

    return {
      month,
      projectedAmount,
      cumulativeContributions: projectedAmount - totalCurrent,
      label,
      targetAmount: totalTarget,
    };
  });
}

export function computeProjectedCompletionMonth(
  totalCurrent: number,
  totalTarget: number,
  monthlyContribution: number,
): string | null {
  if (totalCurrent >= totalTarget) {
    return toLocalMonthKey(new Date());
  }
  if (monthlyContribution <= 0) return null;

  const months = Math.ceil((totalTarget - totalCurrent) / monthlyContribution);
  return addMonthsToMonthKey(toLocalMonthKey(new Date()), months);
}
