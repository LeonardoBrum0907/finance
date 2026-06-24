import { isDisplayableInvestment } from "@finance/shared";
import { prisma } from "../../prisma.js";
import { collectInvestmentPortfolio } from "./investmentPortfolio.js";

export const AUTO_CONTRIBUTION_THRESHOLD = 1;

export interface GoalSourceInput {
  sourceType: "account" | "investment";
  accountId?: string;
  investmentId?: string;
  allocationPercent: number;
}

export interface GoalSourceBalanceContext {
  accounts: Map<
    string,
    { id: string; name: string; type: string | null; subtype: string | null; balance: number }
  >;
  investments: Map<
    string,
    { id: string; name: string; type: string | null; balance: number; isStale: boolean }
  >;
  usedPercentByAccount: Map<string, number>;
  usedPercentByInvestment: Map<string, number>;
}

type GoalWithSources = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  type: string;
  icon: string | null;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date | null;
  status: string;
  trackingMode: string;
  lastSyncedBalance: number | null;
  linkedAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
  sources: {
    id: string;
    sourceType: string;
    accountId: string | null;
    investmentId: string | null;
    allocationPercent: number;
  }[];
};

function sourceRefKey(sourceType: string, accountId: string | null, investmentId: string | null): string {
  if (sourceType === "account" && accountId) return `account:${accountId}`;
  if (sourceType === "investment" && investmentId) return `investment:${investmentId}`;
  return "";
}

export async function loadGoalBalanceContext(userId: string): Promise<GoalSourceBalanceContext> {
  const people = await prisma.person.findMany({
    where: { userId },
    include: {
      connections: {
        include: {
          accounts: true,
          investments: { include: { transactions: true } },
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
  const portfolioInvestmentIds = new Set(portfolio.positions.map((p) => p.id));

  const accounts = new Map<
    string,
    { id: string; name: string; type: string | null; subtype: string | null; balance: number }
  >();
  for (const person of people) {
    for (const conn of person.connections) {
      for (const acc of conn.accounts) {
        accounts.set(acc.id, {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype,
          balance: acc.balance,
        });
      }
    }
  }

  const investments = new Map<
    string,
    { id: string; name: string; type: string | null; balance: number; isStale: boolean }
  >();
  for (const person of people) {
    for (const conn of person.connections) {
      for (const inv of conn.investments) {
        if (!portfolioInvestmentIds.has(inv.id)) continue;
        if (!isDisplayableInvestment(inv)) continue;
        const position = portfolio.positions.find((p) => p.id === inv.id);
        investments.set(inv.id, {
          id: inv.id,
          name: inv.name,
          type: inv.type,
          balance: inv.balance,
          isStale: position?.isStale ?? false,
        });
      }
    }
  }

  const allSources = await prisma.goalSource.findMany({
    where: { goal: { userId } },
    select: {
      accountId: true,
      investmentId: true,
      sourceType: true,
      allocationPercent: true,
    },
  });

  const usedPercentByAccount = new Map<string, number>();
  const usedPercentByInvestment = new Map<string, number>();

  for (const src of allSources) {
    if (src.sourceType === "account" && src.accountId) {
      usedPercentByAccount.set(
        src.accountId,
        (usedPercentByAccount.get(src.accountId) ?? 0) + src.allocationPercent,
      );
    }
    if (src.sourceType === "investment" && src.investmentId) {
      usedPercentByInvestment.set(
        src.investmentId,
        (usedPercentByInvestment.get(src.investmentId) ?? 0) + src.allocationPercent,
      );
    }
  }

  return {
    accounts,
    investments,
    usedPercentByAccount,
    usedPercentByInvestment,
  };
}

export function computeAllocatedBalance(
  sources: GoalWithSources["sources"],
  context: GoalSourceBalanceContext,
): number {
  let total = 0;
  for (const src of sources) {
    if (src.sourceType === "account" && src.accountId) {
      const acc = context.accounts.get(src.accountId);
      if (acc) total += acc.balance * (src.allocationPercent / 100);
    }
    if (src.sourceType === "investment" && src.investmentId) {
      const inv = context.investments.get(src.investmentId);
      if (inv) total += inv.balance * (src.allocationPercent / 100);
    }
  }
  return Math.round(total * 100) / 100;
}

export function resolveGoalCurrentAmount(
  goal: GoalWithSources,
  context: GoalSourceBalanceContext,
): number {
  if (goal.trackingMode === "linked" && goal.sources.length > 0) {
    return computeAllocatedBalance(goal.sources, context);
  }
  return goal.currentAmount;
}

export function validateSourceAllocations(
  userId: string,
  goalId: string | null,
  inputs: GoalSourceInput[],
  context: GoalSourceBalanceContext,
): { ok: true } | { ok: false; error: string } {
  if (inputs.length === 0) {
    return { ok: false, error: "Selecione ao menos uma fonte" };
  }

  const seen = new Set<string>();
  const additions = new Map<string, number>();

  for (const input of inputs) {
    if (input.allocationPercent <= 0 || input.allocationPercent > 100) {
      return { ok: false, error: "Alocação deve estar entre 0 e 100%" };
    }

    if (input.sourceType === "account") {
      if (!input.accountId) return { ok: false, error: "Conta inválida" };
      if (!context.accounts.has(input.accountId)) {
        return { ok: false, error: "Conta não encontrada" };
      }
      const key = `account:${input.accountId}`;
      if (seen.has(key)) return { ok: false, error: "Conta duplicada no mesmo objetivo" };
      seen.add(key);
      additions.set(key, (additions.get(key) ?? 0) + input.allocationPercent);
    } else if (input.sourceType === "investment") {
      if (!input.investmentId) return { ok: false, error: "Investimento inválido" };
      if (!context.investments.has(input.investmentId)) {
        return { ok: false, error: "Investimento não encontrado" };
      }
      const key = `investment:${input.investmentId}`;
      if (seen.has(key)) return { ok: false, error: "Investimento duplicado no mesmo objetivo" };
      seen.add(key);
      additions.set(key, (additions.get(key) ?? 0) + input.allocationPercent);
    } else {
      return { ok: false, error: "Tipo de fonte inválido" };
    }
  }

  return { ok: true };
}

export async function validateSourceAllocationsGlobal(
  userId: string,
  goalId: string | null,
  inputs: GoalSourceInput[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const context = await loadGoalBalanceContext(userId);
  const basic = validateSourceAllocations(userId, goalId, inputs, context);
  if (!basic.ok) return basic;

  const existingSources = await prisma.goalSource.findMany({
    where: {
      goal: { userId },
      ...(goalId ? { goalId: { not: goalId } } : {}),
    },
    select: {
      accountId: true,
      investmentId: true,
      sourceType: true,
      allocationPercent: true,
    },
  });

  const totals = new Map<string, number>();
  for (const src of existingSources) {
    const key = sourceRefKey(src.sourceType, src.accountId, src.investmentId);
    if (key) totals.set(key, (totals.get(key) ?? 0) + src.allocationPercent);
  }
  for (const input of inputs) {
    const key =
      input.sourceType === "account"
        ? `account:${input.accountId}`
        : `investment:${input.investmentId}`;
    totals.set(key, (totals.get(key) ?? 0) + input.allocationPercent);
  }

  for (const [key, total] of totals) {
    if (total > 100.001) {
      const label = key.startsWith("account:") ? "conta" : "investimento";
      return {
        ok: false,
        error: `Alocação total da ${label} excede 100% (${total.toFixed(0)}%)`,
      };
    }
  }

  return { ok: true };
}

export function serializeGoalSources(
  sources: GoalWithSources["sources"],
  context: GoalSourceBalanceContext,
  excludeGoalId?: string,
) {
  return sources.map((src) => {
    let name = "";
    let balance = 0;
    let isStale = false;
    let sourceLabel = "";

    if (src.sourceType === "account" && src.accountId) {
      const acc = context.accounts.get(src.accountId);
      name = acc?.name ?? "Conta";
      balance = acc?.balance ?? 0;
      sourceLabel = acc?.subtype ?? acc?.type ?? "Conta";
    } else if (src.sourceType === "investment" && src.investmentId) {
      const inv = context.investments.get(src.investmentId);
      name = inv?.name ?? "Investimento";
      balance = inv?.balance ?? 0;
      isStale = inv?.isStale ?? false;
      sourceLabel = inv?.type ?? "Investimento";
    }

    const allocatedAmount = balance * (src.allocationPercent / 100);

    return {
      id: src.id,
      sourceType: src.sourceType as "account" | "investment",
      accountId: src.accountId,
      investmentId: src.investmentId,
      name,
      sourceLabel,
      balance,
      allocationPercent: src.allocationPercent,
      allocatedAmount: Math.round(allocatedAmount * 100) / 100,
      isStale,
    };
  });
}

export function buildAvailableSources(
  context: GoalSourceBalanceContext,
  excludeGoalId?: string,
) {
  const accounts = [...context.accounts.values()].map((acc) => {
    const used = context.usedPercentByAccount.get(acc.id) ?? 0;
    return {
      sourceType: "account" as const,
      accountId: acc.id,
      investmentId: null,
      name: acc.name,
      sourceLabel: acc.subtype ?? acc.type ?? "Conta",
      balance: acc.balance,
      usedPercent: used,
      availablePercent: Math.max(0, 100 - used),
      isCredit: acc.type === "CREDIT",
    };
  });

  const investments = [...context.investments.values()].map((inv) => {
    const used = context.usedPercentByInvestment.get(inv.id) ?? 0;
    return {
      sourceType: "investment" as const,
      accountId: null,
      investmentId: inv.id,
      name: inv.name,
      sourceLabel: inv.type ?? "Investimento",
      balance: inv.balance,
      usedPercent: used,
      availablePercent: Math.max(0, 100 - used),
      isCredit: false,
      isStale: inv.isStale,
    };
  });

  return [...accounts, ...investments];
}

export async function reconcileGoalsForUser(userId: string): Promise<void> {
  const context = await loadGoalBalanceContext(userId);
  const goals = await prisma.goal.findMany({
    where: { userId, trackingMode: "linked", status: { not: "archived" } },
    include: { sources: true },
  });

  for (const goal of goals) {
    if (goal.sources.length === 0) continue;

    const computed = computeAllocatedBalance(goal.sources, context);
    const previous = goal.lastSyncedBalance ?? computed;
    const delta = computed - previous;

    if (delta >= AUTO_CONTRIBUTION_THRESHOLD) {
      await prisma.$transaction(async (tx) => {
        await tx.goalContribution.create({
          data: {
            goalId: goal.id,
            amount: Math.round(delta * 100) / 100,
            date: new Date(),
            source: "auto",
            note: "Detectado na sincronização",
          },
        });
        await tx.goal.update({
          where: { id: goal.id },
          data: {
            lastSyncedBalance: computed,
            status:
              computed >= goal.targetAmount && goal.status === "active"
                ? "completed"
                : goal.status,
          },
        });
      });
    } else if (delta <= -AUTO_CONTRIBUTION_THRESHOLD) {
      await prisma.goal.update({
        where: { id: goal.id },
        data: {
          lastSyncedBalance: computed,
          status:
            computed >= goal.targetAmount && goal.status === "active"
              ? "completed"
              : goal.status === "completed" && computed < goal.targetAmount
                ? "active"
                : goal.status,
        },
      });
    } else {
      await prisma.goal.update({
        where: { id: goal.id },
        data: {
          lastSyncedBalance: computed,
          status:
            computed >= goal.targetAmount && goal.status === "active"
              ? "completed"
              : goal.status,
        },
      });
    }
  }
}

export async function applyGoalSources(
  userId: string,
  goalId: string,
  inputs: GoalSourceInput[],
): Promise<void> {
  const validation = await validateSourceAllocationsGlobal(userId, goalId, inputs);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const context = await loadGoalBalanceContext(userId);
  const computed = computeAllocatedBalance(
    inputs.map((input, index) => ({
      id: `temp-${index}`,
      sourceType: input.sourceType,
      accountId: input.accountId ?? null,
      investmentId: input.investmentId ?? null,
      allocationPercent: input.allocationPercent,
    })),
    context,
  );

  await prisma.$transaction(async (tx) => {
    await tx.goalSource.deleteMany({ where: { goalId } });
    for (const input of inputs) {
      await tx.goalSource.create({
        data: {
          goalId,
          sourceType: input.sourceType,
          accountId: input.sourceType === "account" ? input.accountId : null,
          investmentId: input.sourceType === "investment" ? input.investmentId : null,
          allocationPercent: input.allocationPercent,
        },
      });
    }
    const goal = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });
    await tx.goal.update({
      where: { id: goalId },
      data: {
        trackingMode: "linked",
        lastSyncedBalance: computed,
        status:
          computed >= goal.targetAmount
            ? "completed"
            : goal.status === "completed" && computed < goal.targetAmount
              ? "active"
              : goal.status,
      },
    });
  });
}

export async function clearGoalSources(userId: string, goalId: string): Promise<void> {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!goal) throw new Error("Objetivo não encontrado");

  await prisma.$transaction(async (tx) => {
    await tx.goalSource.deleteMany({ where: { goalId } });
    await tx.goal.update({
      where: { id: goalId },
      data: {
        trackingMode: "manual",
        lastSyncedBalance: null,
      },
    });
  });
}

export type { GoalWithSources };
