import type {
  ManagedAccountDTO,
  ManagedAccountForSimulation,
  ManagedAccountKind,
  ManagedAccountSource,
  ManagedAccountStatus,
  ManagedEntryStatus,
  ScenarioSimulationType,
  SimulationPayload,
} from "@finance/shared";
import { todayDateKeyInTimeZone } from "@finance/shared";
import type { ManagedAccount, ManagedAccountEntry, Prisma } from "@prisma/client";
import { prisma } from "../../prisma.js";

type ManagedAccountWithRelations = ManagedAccount & {
  person: { name: string } | null;
  bankAccount: { name: string } | null;
  linkedGoal: { name: string } | null;
  entries: ManagedAccountEntry[];
};

const accountInclude = {
  person: { select: { name: true } },
  bankAccount: { select: { name: true } },
  linkedGoal: { select: { name: true } },
  entries: true,
} as const;

function serializeEntry(entry: ManagedAccountEntry) {
  return {
    id: entry.id,
    sequence: entry.sequence,
    cycleKey: entry.cycleKey,
    dueDate: entry.dueDate.toISOString(),
    amount: entry.amount,
    status: entry.status as ManagedEntryStatus,
    transactionId: entry.transactionId,
    paidAt: entry.paidAt?.toISOString() ?? null,
  };
}

function serializeManagedAccount(row: ManagedAccountWithRelations): ManagedAccountDTO {
  const entries = [...row.entries].sort((a, b) => {
    if (a.sequence != null && b.sequence != null) return a.sequence - b.sequence;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });
  const paidCount = entries.filter((entry) => entry.status === "paid").length;
  const pendingCount = entries.filter((entry) => entry.status === "pending").length;

  return {
    id: row.id,
    title: row.title,
    payeeName: row.payeeName,
    category: row.category,
    notes: row.notes,
    kind: row.kind as ManagedAccountKind,
    simulationType: (row.simulationType as ScenarioSimulationType | null) ?? null,
    source: row.source as ManagedAccountSource,
    status: row.status as ManagedAccountStatus,
    expectedAmount: row.expectedAmount,
    totalAmount: row.totalAmount,
    totalInstallments: row.totalInstallments,
    dayOfMonth: row.dayOfMonth,
    personId: row.personId,
    personName: row.person?.name ?? null,
    bankAccountId: row.bankAccountId,
    bankAccountName: row.bankAccount?.name ?? null,
    anchorTransactionId: row.anchorTransactionId,
    linkedGoalId: row.linkedGoalId,
    linkedGoalName: row.linkedGoal?.name ?? null,
    linkedTransactionId: row.linkedTransactionId,
    simulationPayload: (row.simulationPayload as SimulationPayload | null) ?? null,
    lastVerdict: row.lastVerdict,
    priority: row.priority,
    description: row.description,
    lastOccurrenceDate: row.lastOccurrenceDate?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    paidCount,
    pendingCount,
    entries: entries.map(serializeEntry),
    legacyRecurringBillId: row.legacyRecurringBillId,
    legacyCommitmentId: row.legacyCommitmentId,
    legacySimulationScenarioId: row.legacySimulationScenarioId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapCommitmentStatus(status: string): ManagedAccountStatus {
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  return "active";
}

function mapRecurringBillStatus(status: string): ManagedAccountStatus {
  if (status === "dismissed") return "dismissed";
  if (status === "inactive") return "inactive";
  return "active";
}

function mapScenarioStatus(status: string): ManagedAccountStatus {
  return status as ManagedAccountStatus;
}

type ManagedAccountEntryInput = {
  sequence?: number | null;
  cycleKey?: string | null;
  dueDate: Date;
  amount: number;
  status: string;
  transactionId?: string | null;
  paidAt?: Date | null;
};

function normalizeEntryTransactionIds(entries: ManagedAccountEntryInput[]): ManagedAccountEntryInput[] {
  const seenTxIds = new Set<string>();
  return entries.map((entry) => {
    if (!entry.transactionId) return entry;
    if (seenTxIds.has(entry.transactionId)) {
      return { ...entry, transactionId: null };
    }
    seenTxIds.add(entry.transactionId);
    return entry;
  });
}

async function replaceEntries(
  managedAccountId: string,
  entries: ManagedAccountEntryInput[],
): Promise<void> {
  const normalized = normalizeEntryTransactionIds(entries);
  const txIds = [
    ...new Set(
      normalized
        .map((entry) => entry.transactionId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  await prisma.$transaction(async (tx) => {
    await tx.managedAccountEntry.deleteMany({ where: { managedAccountId } });

    if (txIds.length > 0) {
      await tx.managedAccountEntry.updateMany({
        where: {
          transactionId: { in: txIds },
          managedAccountId: { not: managedAccountId },
        },
        data: { transactionId: null },
      });
    }

    if (normalized.length === 0) return;

    await tx.managedAccountEntry.createMany({
      data: normalized.map((entry) => ({ ...entry, managedAccountId })),
    });
  });
}

export async function syncFromCommitment(commitmentId: string): Promise<void> {
  const commitment = await prisma.paymentCommitment.findUnique({
    where: { id: commitmentId },
    include: {
      installments: true,
      anchorTx: {
        include: {
          account: { include: { connection: { select: { personId: true } } } },
        },
      },
    },
  });
  if (!commitment) return;

  const personId = commitment.anchorTx?.account.connection.personId ?? null;
  const bankAccountId = commitment.anchorTx?.accountId ?? null;
  const accountData = {
    userId: commitment.userId,
    personId,
    title: commitment.title,
    payeeName: commitment.payeeName,
    notes: commitment.notes,
    kind: "installment_plan",
    simulationType: null,
    source: "transaction",
    status: mapCommitmentStatus(commitment.status),
    expectedAmount: commitment.installmentAmount,
    totalAmount: commitment.totalAmount,
    totalInstallments: commitment.totalInstallments,
    dayOfMonth: commitment.dayOfMonth,
    anchorTransactionId: commitment.anchorTransactionId,
    bankAccountId,
    legacyCommitmentId: commitment.id,
  };

  const existing = await prisma.managedAccount.findUnique({
    where: { legacyCommitmentId: commitment.id },
  });

  const managedAccount = existing
    ? await prisma.managedAccount.update({
        where: { id: existing.id },
        data: accountData,
      })
    : await prisma.managedAccount.create({ data: accountData });

  const entries = [...commitment.installments]
    .sort((a, b) => a.sequence - b.sequence)
    .map((installment) => ({
      sequence: installment.sequence,
      cycleKey: null,
      dueDate: installment.dueDate,
      amount: installment.amount,
      status: installment.status,
      transactionId: installment.transactionId,
      paidAt: installment.paidAt,
    }));

  await replaceEntries(managedAccount.id, entries);
}

export async function syncFromRecurringBill(billId: string): Promise<void> {
  const bill = await prisma.recurringBill.findUnique({
    where: { id: billId },
    include: { occurrences: true },
  });
  if (!bill) return;

  const accountData = {
    userId: bill.userId,
    personId: bill.personId,
    title: bill.title,
    payeeName: bill.payeeName,
    category: bill.category,
    kind: "fixed_recurring",
    simulationType: null,
    source: bill.source as ManagedAccountSource,
    status: mapRecurringBillStatus(bill.status),
    expectedAmount: bill.expectedAmount,
    totalAmount: null,
    totalInstallments: null,
    dayOfMonth: bill.dayOfMonth,
    matchSignature: bill.matchSignature,
    bankAccountId: bill.accountId,
    lastOccurrenceDate: bill.lastOccurrenceDate,
    legacyRecurringBillId: bill.id,
  };

  const existing = await prisma.managedAccount.findUnique({
    where: { legacyRecurringBillId: bill.id },
  });

  const managedAccount = existing
    ? await prisma.managedAccount.update({
        where: { id: existing.id },
        data: accountData,
      })
    : await prisma.managedAccount.create({ data: accountData });

  const entries = [...bill.occurrences]
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .map((occurrence) => ({
      sequence: null,
      cycleKey: occurrence.cycleKey,
      dueDate: occurrence.dueDate,
      amount: occurrence.amount,
      status: occurrence.status,
      transactionId: occurrence.transactionId,
      paidAt: occurrence.paidAt,
    }));

  await replaceEntries(managedAccount.id, entries);
}

export async function syncFromSimulationScenario(scenarioId: string): Promise<void> {
  const scenario = await prisma.simulationScenario.findUnique({
    where: { id: scenarioId },
  });
  if (!scenario) return;

  const payload = scenario.payload as SimulationPayload;
  const accountData = {
    userId: scenario.userId,
    personId: scenario.personId,
    title: scenario.name,
    category: payload.category ?? null,
    description: scenario.description,
    kind: "simulation",
    simulationType: scenario.type,
    source: "simulator",
    status: mapScenarioStatus(scenario.status),
    expectedAmount: payload.amount,
    totalAmount: payload.type === "installments" ? payload.amount : null,
    totalInstallments: payload.installments ?? payload.totalInstallments ?? null,
    dayOfMonth: null,
    linkedGoalId: scenario.linkedGoalId,
    linkedTransactionId: scenario.linkedTransactionId,
    simulationPayload: payload as Prisma.InputJsonValue,
    lastVerdict: scenario.lastVerdict,
    lastImpactSnapshot: scenario.lastImpactSnapshot ?? undefined,
    priority: scenario.priority,
    completedAt: scenario.completedAt,
    legacySimulationScenarioId: scenario.id,
  };

  const existing = await prisma.managedAccount.findUnique({
    where: { legacySimulationScenarioId: scenario.id },
  });

  if (existing) {
    await prisma.managedAccount.update({
      where: { id: existing.id },
      data: accountData,
    });
    return;
  }

  await prisma.managedAccount.create({ data: accountData });
}

const backfillLocks = new Map<string, Promise<{ bills: number; commitments: number; scenarios: number }>>();

async function findLegacyRecordsMissingManagedAccount(userId: string) {
  const [existing, bills, commitments, scenarios] = await Promise.all([
    prisma.managedAccount.findMany({
      where: { userId },
      select: {
        legacyRecurringBillId: true,
        legacyCommitmentId: true,
        legacySimulationScenarioId: true,
      },
    }),
    prisma.recurringBill.findMany({ where: { userId }, select: { id: true } }),
    prisma.paymentCommitment.findMany({ where: { userId }, select: { id: true } }),
    prisma.simulationScenario.findMany({ where: { userId }, select: { id: true } }),
  ]);

  const billIds = new Set(
    existing.map((row) => row.legacyRecurringBillId).filter((id): id is string => !!id),
  );
  const commitmentIds = new Set(
    existing.map((row) => row.legacyCommitmentId).filter((id): id is string => !!id),
  );
  const scenarioIds = new Set(
    existing.map((row) => row.legacySimulationScenarioId).filter((id): id is string => !!id),
  );

  return {
    bills: bills.filter((bill) => !billIds.has(bill.id)),
    commitments: commitments.filter((commitment) => !commitmentIds.has(commitment.id)),
    scenarios: scenarios.filter((scenario) => !scenarioIds.has(scenario.id)),
  };
}

async function runBackfillManagedAccounts(userId: string): Promise<{
  bills: number;
  commitments: number;
  scenarios: number;
}> {
  const missing = await findLegacyRecordsMissingManagedAccount(userId);

  for (const bill of missing.bills) {
    await syncFromRecurringBill(bill.id);
  }
  for (const commitment of missing.commitments) {
    await syncFromCommitment(commitment.id);
  }
  for (const scenario of missing.scenarios) {
    await syncFromSimulationScenario(scenario.id);
  }

  return {
    bills: missing.bills.length,
    commitments: missing.commitments.length,
    scenarios: missing.scenarios.length,
  };
}

export async function backfillManagedAccounts(userId: string): Promise<{
  bills: number;
  commitments: number;
  scenarios: number;
}> {
  const inFlight = backfillLocks.get(userId);
  if (inFlight) return inFlight;

  const promise = runBackfillManagedAccounts(userId).finally(() => {
    backfillLocks.delete(userId);
  });
  backfillLocks.set(userId, promise);
  return promise;
}

export interface ListManagedAccountsFilters {
  personId?: string;
  status?: string;
  kind?: string;
}

function parseStatusFilter(status?: string): string[] | undefined {
  if (!status) return undefined;
  if (status === "active,inactive") return ["active", "inactive"];
  if (status === "inactive,cancelled") return ["inactive", "cancelled"];
  if (status === "completed_history") return ["completed", "archived", "converted"];
  if (status.includes(",")) return status.split(",").map((value) => value.trim());
  return [status];
}

export async function listManagedAccounts(
  userId: string,
  filters?: ListManagedAccountsFilters,
): Promise<ManagedAccountDTO[]> {
  await backfillManagedAccounts(userId);

  const statuses = parseStatusFilter(filters?.status);
  const rows = await prisma.managedAccount.findMany({
    where: {
      userId,
      ...(filters?.personId ? { personId: filters.personId } : {}),
      ...(filters?.kind ? { kind: filters.kind } : {}),
      ...(statuses ? { status: { in: statuses } } : {}),
    },
    include: accountInclude,
    orderBy: [{ status: "asc" }, { expectedAmount: "desc" }, { title: "asc" }],
  });

  return rows.map(serializeManagedAccount);
}

export async function loadActiveManagedAccountsForImpact(
  userId: string,
  personId?: string,
): Promise<ManagedAccountForSimulation[]> {
  await backfillManagedAccounts(userId);

  const today = todayDateKeyInTimeZone();
  const horizon = new Date(`${today}T12:00:00.000Z`);
  horizon.setUTCMonth(horizon.getUTCMonth() + 5);

  const rows = await prisma.managedAccount.findMany({
    where: {
      userId,
      status: "active",
      ...(personId ? { personId } : {}),
    },
    include: { entries: true },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind as ManagedAccountKind,
    simulationType: (row.simulationType as ScenarioSimulationType | null) ?? null,
    simulationPayload: (row.simulationPayload as SimulationPayload | null) ?? null,
    expectedAmount: row.expectedAmount,
    totalInstallments: row.totalInstallments,
    entries: row.entries
      .filter((entry) => entry.dueDate <= horizon)
      .map((entry) => ({
        id: entry.id,
        dueDate: entry.dueDate.toISOString(),
        amount: entry.amount,
        status: entry.status as ManagedEntryStatus,
      })),
  }));
}

export async function sumPendingManagedEntriesInRange(
  userId: string,
  from: Date,
  to: Date,
  personId?: string,
): Promise<number> {
  await backfillManagedAccounts(userId);

  const entries = await prisma.managedAccountEntry.findMany({
    where: {
      status: "pending",
      dueDate: { gte: from, lte: to },
      managedAccount: {
        userId,
        ...(personId ? { personId } : {}),
        status: "active",
        kind: { in: ["installment_plan", "fixed_recurring"] },
      },
    },
    select: { amount: true },
  });

  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

export async function getManagedAccountById(
  userId: string,
  id: string,
): Promise<ManagedAccountDTO | null> {
  const row = await prisma.managedAccount.findFirst({
    where: { id, userId },
    include: accountInclude,
  });
  return row ? serializeManagedAccount(row) : null;
}

function legacyWhere(
  legacyField: "legacyRecurringBillId" | "legacyCommitmentId" | "legacySimulationScenarioId",
  legacyId: string,
) {
  switch (legacyField) {
    case "legacyRecurringBillId":
      return { legacyRecurringBillId: legacyId };
    case "legacyCommitmentId":
      return { legacyCommitmentId: legacyId };
    case "legacySimulationScenarioId":
      return { legacySimulationScenarioId: legacyId };
  }
}

export async function deleteManagedAccountByLegacy(
  legacyField: "legacyRecurringBillId" | "legacyCommitmentId" | "legacySimulationScenarioId",
  legacyId: string,
): Promise<void> {
  const account = await prisma.managedAccount.findUnique({
    where: legacyWhere(legacyField, legacyId),
  });
  if (!account) return;
  await prisma.managedAccount.delete({ where: { id: account.id } });
}

export async function updateManagedAccountStatusByLegacy(
  legacyField: "legacyRecurringBillId" | "legacyCommitmentId" | "legacySimulationScenarioId",
  legacyId: string,
  status: ManagedAccountStatus,
): Promise<void> {
  const account = await prisma.managedAccount.findUnique({
    where: legacyWhere(legacyField, legacyId),
  });
  if (!account) return;
  await prisma.managedAccount.update({
    where: { id: account.id },
    data: { status },
  });
}
