import {
  buildSimulationPaydayCycles,
  computeAggregateCycleImpact,
  computeCreditBillImpacts,
  computePaydayCycleImpacts,
  filterCashSimulatedPurchases,
  payloadToSimulationInput,
  scenariosToSimulatedPurchases,
  suggestTransactionMatches,
  toTransactionMatchCandidate,
  todayDateKeyInTimeZone,
  type AggregateSimulationImpactDTO,
  type CompleteSimulationInput,
  type ConvertScenarioToGoalInput,
  type CreateSimulationScenarioInput,
  type ScenarioSimulationType,
  type SimulationPayload,
  type SimulationScenarioDTO,
  type SimulationScenarioStatus,
  type TransactionMatchesResponse,
  type UpdateSimulationScenarioInput,
} from "@finance/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { fetchSimulatorBaseline, runSimulation } from "./purchaseSimulation.js";
import { loadActiveManagedAccountsForImpact, syncFromSimulationScenario, deleteManagedAccountByLegacy } from "./managedAccounts.js";
import { managedAccountsToSimulatedPurchases } from "@finance/shared";
import { resolvePaydayCycle } from "../userSettings.js";
import { buildCurrentCycleSummary } from "./aggregates.js";
import { effectiveTransactionCategory } from "../transactionCategory.js";
import type { FinancialTransaction } from "./types.js";

type ScenarioRow = Prisma.SimulationScenarioGetPayload<{
  include: {
    person: { select: { name: true } };
    linkedGoal: { select: { name: true } };
  };
}>;

function serializeScenario(row: ScenarioRow): SimulationScenarioDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as ScenarioSimulationType,
    status: row.status as SimulationScenarioStatus,
    payload: row.payload as SimulationPayload,
    personId: row.personId,
    personName: row.person?.name ?? null,
    priority: row.priority,
    linkedTransactionId: row.linkedTransactionId,
    linkedInvestmentTxId: row.linkedInvestmentTxId,
    linkedGoalId: row.linkedGoalId,
    linkedGoalName: row.linkedGoal?.name ?? null,
    lastVerdict: row.lastVerdict,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const scenarioInclude = {
  person: { select: { name: true } },
  linkedGoal: { select: { name: true } },
} as const;

async function loadRecentTransactionsForMatch(
  userId: string,
  personId?: string,
): Promise<
  {
    id: string;
    date: Date;
    description: string;
    amount: number;
    accountName: string;
  }[]
> {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 60);

  const people = await prisma.person.findMany({
    where: { userId, ...(personId ? { id: personId } : {}) },
    include: {
      connections: {
        include: {
          accounts: {
            include: {
              transactions: {
                where: { date: { gte: dateFrom } },
                orderBy: { date: "desc" },
                take: 200,
              },
            },
          },
        },
      },
    },
  });

  const txs: {
    id: string;
    date: Date;
    description: string;
    amount: number;
    accountName: string;
  }[] = [];

  for (const person of people) {
    for (const conn of person.connections) {
      for (const acc of conn.accounts) {
        for (const tx of acc.transactions) {
          txs.push({
            id: tx.id,
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            accountName: acc.name,
          });
        }
      }
    }
  }

  return txs.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function listScenarios(
  userId: string,
  filters?: { status?: string; personId?: string },
): Promise<SimulationScenarioDTO[]> {
  const statusFilter = filters?.status;
  let statusWhere: Prisma.SimulationScenarioWhereInput["status"];
  if (statusFilter === "completed_history") {
    statusWhere = { in: ["completed", "converted"] };
  } else if (statusFilter) {
    statusWhere = statusFilter;
  }

  const rows = await prisma.simulationScenario.findMany({
    where: {
      userId,
      ...(statusWhere ? { status: statusWhere } : {}),
      ...(filters?.personId ? { personId: filters.personId } : {}),
    },
    include: scenarioInclude,
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });

  return rows.map(serializeScenario);
}

export async function createScenario(
  userId: string,
  input: CreateSimulationScenarioInput,
): Promise<SimulationScenarioDTO> {
  const payload: SimulationPayload = {
    ...input.payload,
    name: input.payload.name ?? input.name,
    personId: input.personId ?? input.payload.personId,
  };

  let lastVerdict: string | null = null;
  let lastImpactSnapshot: Prisma.InputJsonValue | undefined;

  if (input.status === "active") {
    const simInput = payloadToSimulationInput(payload, input.personId);
    const result = await runSimulation(userId, simInput);
    lastVerdict = result.verdict;
    lastImpactSnapshot = result as unknown as Prisma.InputJsonValue;
  }

  const row = await prisma.simulationScenario.create({
    data: {
      userId,
      personId: input.personId,
      name: input.name,
      description: input.description,
      type: input.type,
      status: input.status ?? "draft",
      payload,
      priority: input.priority ?? 0,
      lastVerdict,
      lastImpactSnapshot,
    },
    include: scenarioInclude,
  });

  await syncFromSimulationScenario(row.id);
  return serializeScenario(row);
}

export async function updateScenario(
  userId: string,
  id: string,
  input: UpdateSimulationScenarioInput,
): Promise<SimulationScenarioDTO> {
  const existing = await prisma.simulationScenario.findFirst({
    where: { id, userId },
  });
  if (!existing) throw new ScenarioNotFoundError();

  const payload = input.payload
    ? ({ ...(existing.payload as SimulationPayload), ...input.payload } as SimulationPayload)
    : (existing.payload as SimulationPayload);

  let lastVerdict = existing.lastVerdict;
  let updatedImpactSnapshot: Prisma.InputJsonValue | undefined;

  const nextStatus = input.status ?? existing.status;
  if (nextStatus === "active" && (input.payload || input.status)) {
    const simInput = payloadToSimulationInput(
      payload,
      input.personId ?? existing.personId ?? undefined,
    );
    const result = await runSimulation(userId, simInput);
    lastVerdict = result.verdict;
    updatedImpactSnapshot = result as unknown as Prisma.InputJsonValue;
  }

  const row = await prisma.simulationScenario.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.payload !== undefined ? { payload } : {}),
      ...(input.personId !== undefined ? { personId: input.personId } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      lastVerdict,
      ...(updatedImpactSnapshot !== undefined
        ? { lastImpactSnapshot: updatedImpactSnapshot }
        : {}),
    },
    include: scenarioInclude,
  });

  await syncFromSimulationScenario(row.id);
  return serializeScenario(row);
}

export async function deleteScenario(userId: string, id: string): Promise<void> {
  const existing = await prisma.simulationScenario.findFirst({ where: { id, userId } });
  if (!existing) throw new ScenarioNotFoundError();
  await prisma.simulationScenario.delete({ where: { id } });
  await deleteManagedAccountByLegacy("legacySimulationScenarioId", id);
}

export async function runScenarioSimulation(
  userId: string,
  id: string,
) {
  const existing = await prisma.simulationScenario.findFirst({ where: { id, userId } });
  if (!existing) throw new ScenarioNotFoundError();

  const payload = existing.payload as SimulationPayload;
  const simInput = payloadToSimulationInput(payload, existing.personId ?? undefined);
  const result = await runSimulation(userId, simInput);

  await prisma.simulationScenario.update({
    where: { id },
    data: {
      lastVerdict: result.verdict,
      lastImpactSnapshot: result as unknown as Prisma.InputJsonValue,
    },
  });

  await syncFromSimulationScenario(id);
  return result;
}

async function loadTransactionsForImpact(
  userId: string,
  personId?: string,
): Promise<FinancialTransaction[]> {
  const people = await prisma.person.findMany({
    where: { userId, ...(personId ? { id: personId } : {}) },
    include: {
      connections: {
        include: {
          accounts: {
            include: {
              transactions: { orderBy: { date: "desc" }, take: 800 },
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

async function loadCreditAccountsForImpact(userId: string, personId?: string) {
  const people = await prisma.person.findMany({
    where: { userId, ...(personId ? { id: personId } : {}) },
    include: {
      connections: { include: { accounts: true } },
    },
  });

  return people.flatMap((p) =>
    p.connections.flatMap((c) =>
      c.accounts
        .filter((a) => a.type === "CREDIT")
        .map((a) => ({
          id: a.id,
          name: a.name,
          personName: p.name,
          balance: a.balance,
          creditLimit: a.creditLimit,
          availableCreditLimit: a.availableCreditLimit,
          balanceCloseDate: a.balanceCloseDate?.toISOString() ?? null,
          balanceDueDate: a.balanceDueDate?.toISOString() ?? null,
        })),
    ),
  );
}

export async function fetchAggregateImpact(
  userId: string,
  personId?: string,
): Promise<AggregateSimulationImpactDTO> {
  const baseline = await fetchSimulatorBaseline(userId, personId);
  const { paydayDay, paydayCycleAnchor } = await resolvePaydayCycle(userId, personId);

  const managedAccounts = await loadActiveManagedAccountsForImpact(userId, personId);

  const scenarios = managedAccounts
    .filter((account) => account.kind === "simulation" && account.simulationPayload)
    .map((account) => ({
      id: account.id,
      name: account.title,
      type: account.simulationType!,
      payload: account.simulationPayload!,
    }));

  const extraPurchases = managedAccountsToSimulatedPurchases(
    managedAccounts.filter(
      (account) => account.kind === "fixed_recurring" || account.kind === "installment_plan",
    ),
  );

  const hasImpactItems = scenarios.length > 0 || extraPurchases.length > 0;
  const simulationOnlyPurchases = scenariosToSimulatedPurchases(
    scenarios.map((scenario) => ({ id: scenario.id, payload: scenario.payload })),
  );

  let cycleImpacts: AggregateSimulationImpactDTO["cycleImpacts"] = [];
  let simulationOnlyCycleImpacts: AggregateSimulationImpactDTO["simulationOnlyCycleImpacts"] =
    [];
  let monthlyPoints: AggregateSimulationImpactDTO["monthlyPoints"] = [];
  let alerts: string[] = [];
  let scenarioBreakdown: AggregateSimulationImpactDTO["scenarioBreakdown"] = [];
  let creditBillIncrease = 0;
  let scenarioBankBalance = baseline.bankBalance;

  if (paydayDay !== null && hasImpactItems) {
    const txs = await loadTransactionsForImpact(userId, personId);
    const currentCycle = buildCurrentCycleSummary(txs, paydayDay, paydayCycleAnchor);
    const cycles = buildSimulationPaydayCycles(
      {
        cycleKey: currentCycle.cycleKey,
        from: currentCycle.from,
        to: currentCycle.to,
      },
      paydayDay,
      paydayCycleAnchor,
      2,
    );

    const today = todayDateKeyInTimeZone();
    const aggregate = computeAggregateCycleImpact({
      scenarios,
      cycles,
      today,
      baselineSurplus: baseline.currentSurplus,
      cycleBaselines: [
        baseline.currentSurplus,
        baseline.nextCycleSurplus ?? baseline.currentSurplus,
      ],
      bankBalance: baseline.bankBalance,
      extraPurchases,
    });

    cycleImpacts = aggregate.cycleImpacts;
    simulationOnlyCycleImpacts = computePaydayCycleImpacts(simulationOnlyPurchases, cycles, today);
    const simulationCashImpacts = computePaydayCycleImpacts(
      filterCashSimulatedPurchases(simulationOnlyPurchases),
      cycles,
      today,
    );
    monthlyPoints = aggregate.monthlyPoints.map((point, idx) => ({
      ...point,
      scenarioSurplus: Math.round(
        (point.baselineSurplus - (simulationCashImpacts[idx]?.totalInPeriod ?? 0)) * 100,
      ) / 100,
    }));
    alerts = aggregate.alerts;
    scenarioBreakdown = aggregate.scenarioBreakdown;
    scenarioBankBalance = aggregate.scenarioBankBalance;

    const purchases = [
      ...scenariosToSimulatedPurchases(scenarios.map((s) => ({ id: s.id, payload: s.payload }))),
      ...extraPurchases,
    ];
    const creditAccounts = await loadCreditAccountsForImpact(userId, personId);

    if (purchases.length > 0 && creditAccounts.length > 0) {
      const billImpacts = computeCreditBillImpacts(purchases, creditAccounts, today);
      creditBillIncrease = billImpacts.reduce(
        (s, b) => s + (b.openBillAfter - b.openBillBefore),
        0,
      );
    }
  } else if (paydayDay === null && hasImpactItems) {
    const today = todayDateKeyInTimeZone();
    const cycles = [
      {
        cycleKey: baseline.periodLabel,
        from: today.slice(0, 8) + "01",
        to: today,
      },
    ];
    const aggregate = computeAggregateCycleImpact({
      scenarios,
      cycles,
      today,
      baselineSurplus: baseline.currentSurplus,
      cycleBaselines: [
        baseline.currentSurplus,
        baseline.nextCycleSurplus ?? baseline.currentSurplus,
      ],
      bankBalance: baseline.bankBalance,
      extraPurchases,
    });
    cycleImpacts = aggregate.cycleImpacts;
    simulationOnlyCycleImpacts = computePaydayCycleImpacts(simulationOnlyPurchases, cycles, today);
    const simulationCashImpacts = computePaydayCycleImpacts(
      filterCashSimulatedPurchases(simulationOnlyPurchases),
      cycles,
      today,
    );
    monthlyPoints = aggregate.monthlyPoints.map((point, idx) => ({
      ...point,
      scenarioSurplus: Math.round(
        (point.baselineSurplus - (simulationCashImpacts[idx]?.totalInPeriod ?? 0)) * 100,
      ) / 100,
    }));
    alerts = aggregate.alerts;
    scenarioBreakdown = aggregate.scenarioBreakdown;
    scenarioBankBalance = aggregate.scenarioBankBalance;
  }

  const activeRows = await prisma.simulationScenario.findMany({
    where: {
      userId,
      status: "active",
      ...(personId ? { personId } : {}),
    },
    include: scenarioInclude,
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });

  return {
    currencyCode: baseline.currencyCode,
    baselineSurplus: baseline.currentSurplus,
    bankBalance: baseline.bankBalance,
    scenarioBankBalance,
    activeCount: managedAccounts.length,
    cycleImpacts,
    simulationOnlyCycleImpacts,
    monthlyPoints,
    alerts,
    creditBillIncrease,
    scenarioBreakdown,
    scenarios: activeRows.map(serializeScenario),
  };
}

export async function findTransactionMatches(
  userId: string,
  id: string,
): Promise<TransactionMatchesResponse> {
  const existing = await prisma.simulationScenario.findFirst({ where: { id, userId } });
  if (!existing) throw new ScenarioNotFoundError();

  const payload = existing.payload as SimulationPayload;
  const txs = await loadRecentTransactionsForMatch(userId, existing.personId ?? undefined);
  const inputs = txs.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    description: t.description,
    amount: t.amount,
    accountName: t.accountName,
  }));

  const suggestions = suggestTransactionMatches(payload, inputs);
  const suggestedIds = new Set(suggestions.map((s) => s.transactionId));
  const recent = inputs
    .filter((tx) => !suggestedIds.has(tx.id))
    .map(toTransactionMatchCandidate);

  return { suggestions, recent };
}

export async function completeScenario(
  userId: string,
  id: string,
  input: CompleteSimulationInput,
): Promise<SimulationScenarioDTO> {
  const existing = await prisma.simulationScenario.findFirst({ where: { id, userId } });
  if (!existing) throw new ScenarioNotFoundError();
  if (existing.status !== "active" && existing.status !== "draft") {
    throw new ScenarioInvalidStateError("Só é possível concluir cenários ativos ou rascunhos.");
  }

  if (!input.transactionId && !input.investmentTransactionId && !input.note) {
    throw new ScenarioInvalidStateError("Informe uma transação ou uma nota de conclusão.");
  }

  if (input.transactionId) {
    const tx = await prisma.transaction.findFirst({
      where: {
        id: input.transactionId,
        account: { connection: { person: { userId } } },
      },
    });
    if (!tx) throw new ScenarioInvalidStateError("Transação não encontrada.");
  }

  if (input.investmentTransactionId) {
    const itx = await prisma.investmentTransaction.findFirst({
      where: {
        id: input.investmentTransactionId,
        investment: { connection: { person: { userId } } },
      },
    });
    if (!itx) throw new ScenarioInvalidStateError("Transação de investimento não encontrada.");
  }

  const row = await prisma.simulationScenario.update({
    where: { id },
    data: {
      status: "completed",
      linkedTransactionId: input.transactionId ?? null,
      linkedInvestmentTxId: input.investmentTransactionId ?? null,
      completedAt: new Date(),
      ...(input.note
        ? { description: [existing.description, input.note].filter(Boolean).join("\n") }
        : {}),
    },
    include: scenarioInclude,
  });

  await syncFromSimulationScenario(row.id);
  return serializeScenario(row);
}

export async function convertScenarioToGoal(
  userId: string,
  id: string,
  input: ConvertScenarioToGoalInput,
) {
  const existing = await prisma.simulationScenario.findFirst({ where: { id, userId } });
  if (!existing) throw new ScenarioNotFoundError();
  if (existing.status === "converted") {
    throw new ScenarioInvalidStateError("Este cenário já foi convertido em meta.");
  }
  if (existing.status === "completed") {
    throw new ScenarioInvalidStateError("Cenários concluídos não podem virar meta.");
  }

  const payload = existing.payload as SimulationPayload;
  const goalType =
    input.type ??
    (existing.type === "save_for_goal"
      ? "savings"
      : existing.type === "invest"
        ? "custom"
        : existing.type === "recurring_expense"
          ? "custom"
          : "purchase");

  const targetAmount = input.targetAmount ?? payload.amount;

  const result = await prisma.$transaction(async (tx) => {
    const goal = await tx.goal.create({
      data: {
        userId,
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
        type: goalType,
        targetAmount,
        targetDate: input.targetDate ? new Date(input.targetDate) : payload.targetDate ? new Date(payload.targetDate) : null,
        sourceSimulationId: id,
      },
    });

    if (input.createPlan) {
      const monthlyAllocation =
        input.monthlyAllocation ??
        (payload.type === "invest" || payload.investMode === "monthly"
          ? payload.amount
          : undefined);

      if (monthlyAllocation) {
        let plan = await tx.plan.findFirst({ where: { userId, status: "active" } });
        if (!plan) {
          plan = await tx.plan.create({
            data: {
              userId,
              name: "Plano do simulador",
              monthlyContribution: monthlyAllocation,
            },
          });
        }
        await tx.planGoal.create({
          data: {
            planId: plan.id,
            goalId: goal.id,
            monthlyAllocation,
          },
        });
      }
    }

    const scenario = await tx.simulationScenario.update({
      where: { id },
      data: {
        status: "converted",
        linkedGoalId: goal.id,
      },
      include: scenarioInclude,
    });

    return { goal, scenario };
  });

  await syncFromSimulationScenario(id);

  return {
    scenario: serializeScenario(result.scenario),
    goalId: result.goal.id,
  };
}

export class ScenarioNotFoundError extends Error {
  constructor() {
    super("Cenário não encontrado");
    this.name = "ScenarioNotFoundError";
  }
}

export class ScenarioInvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioInvalidStateError";
  }
}
