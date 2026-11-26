import {
  type CompleteSimulationInput,
  type CreateSimulationScenarioInput,
  type ScenarioSimulationType,
  type SimulationPayload,
  type SimulationScenarioDTO,
  type SimulationScenarioStatus,
  type UpdateSimulationScenarioInput,
} from "@finance/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { syncFromSimulationScenario, deleteManagedAccountByLegacy } from "./managedAccounts.js";

type ScenarioRow = Prisma.SimulationScenarioGetPayload<{
  include: {
    person: { select: { name: true } };
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
    lastVerdict: row.lastVerdict,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const scenarioInclude = {
  person: { select: { name: true } },
} as const;

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

  const row = await prisma.simulationScenario.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.payload !== undefined ? { payload } : {}),
      ...(input.personId !== undefined ? { personId: input.personId } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
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
