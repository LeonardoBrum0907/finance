import type {
  DetectRecurringBillsResponse,
  OccurrenceStatus,
  RecurringBillDTO,
  RecurringBillForSimulation,
  RecurringBillStatus,
  RecurringBillSource,
  RecurringPatternCandidate,
  RecurringPatternTransaction,
  UpdateRecurringBillInput,
} from "@finance/shared";
import {
  amountsMatch,
  detectRecurringPatterns,
  isCreditAccount,
  isCreditCardBillPayment,
  isRecurringBillCandidateTransaction,
  isTransactionOutflow,
  normalizeBillSignature,
  shouldDeactivateStaleRecurringBill,
  shouldDismissAutoDetectedBill,
  todayDateKeyInTimeZone,
} from "@finance/shared";
import type { RecurringBill, RecurringBillOccurrence } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { effectiveTransactionCategory } from "../transactionCategory.js";
import { clampDayOfMonth, computeInstallmentDueDate } from "./commitments.js";
import { syncFromRecurringBill } from "./managedAccounts.js";

const DETECTION_LOOKBACK_MONTHS = 6;
const FUTURE_OCCURRENCES_AHEAD = 4;
const MATCH_DATE_TOLERANCE_DAYS = 5;

type BillWithRelations = RecurringBill & {
  person: { name: string } | null;
  account: { name: string } | null;
  occurrences: RecurringBillOccurrence[];
};

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthCycleKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function serializeOccurrence(occ: RecurringBillOccurrence) {
  return {
    id: occ.id,
    cycleKey: occ.cycleKey,
    dueDate: occ.dueDate.toISOString(),
    amount: occ.amount,
    status: occ.status as OccurrenceStatus,
    transactionId: occ.transactionId,
    paidAt: occ.paidAt?.toISOString() ?? null,
  };
}

function serializeBill(bill: BillWithRelations): RecurringBillDTO {
  const occurrences = [...bill.occurrences].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime(),
  );
  const today = todayDateKeyInTimeZone();
  const pending = occurrences.filter((o) => o.status === "pending");
  const paid = occurrences.filter((o) => o.status === "paid");
  const nextPending = pending.find((o) => toDateKey(o.dueDate) >= today) ?? pending[0];
  const currentCycle = occurrences.find((o) => {
    const key = o.cycleKey;
    const todayMonth = monthCycleKey(today);
    return key === todayMonth || (toDateKey(o.dueDate).slice(0, 7) === todayMonth);
  });

  return {
    id: bill.id,
    title: bill.title,
    payeeName: bill.payeeName,
    matchSignature: bill.matchSignature,
    category: bill.category,
    expectedAmount: bill.expectedAmount,
    dayOfMonth: bill.dayOfMonth,
    status: bill.status as RecurringBillStatus,
    source: bill.source as RecurringBillDTO["source"],
    personId: bill.personId,
    personName: bill.person?.name ?? null,
    accountId: bill.accountId,
    accountName: bill.account?.name ?? null,
    lastOccurrenceDate: bill.lastOccurrenceDate?.toISOString() ?? null,
    nextDueDate: nextPending ? nextPending.dueDate.toISOString() : null,
    currentCycleStatus: (currentCycle?.status as OccurrenceStatus) ?? null,
    pendingCount: pending.length,
    paidCount: paid.length,
    occurrences: occurrences.map(serializeOccurrence),
    createdAt: bill.createdAt.toISOString(),
    updatedAt: bill.updatedAt.toISOString(),
  };
}

const billInclude = {
  person: { select: { name: true } },
  account: { select: { name: true } },
  occurrences: true,
} as const;

async function loadOutflowTransactions(
  userId: string,
  personId?: string,
): Promise<RecurringPatternTransaction[]> {
  const dateFrom = new Date();
  dateFrom.setMonth(dateFrom.getMonth() - DETECTION_LOOKBACK_MONTHS);

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
              },
            },
          },
        },
      },
    },
  });

  const txs: RecurringPatternTransaction[] = [];
  for (const person of people) {
    for (const conn of person.connections) {
      for (const acc of conn.accounts) {
        for (const tx of acc.transactions) {
          if (!isTransactionOutflow(tx.amount, acc.type)) continue;
          txs.push({
            id: tx.id,
            date: tx.date.toISOString(),
            description: tx.description,
            amount: tx.amount,
            merchantName: tx.merchantName,
            category: effectiveTransactionCategory(tx),
            accountId: acc.id,
            accountType: acc.type,
            personId: person.id,
            personName: person.name,
          });
        }
      }
    }
  }
  return txs;
}

function computeDueDateForMonth(dayOfMonth: number, refDate: Date): Date {
  const year = refDate.getUTCFullYear();
  const month = refDate.getUTCMonth();
  const day = clampDayOfMonth(year, month, dayOfMonth);
  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

export async function ensureFutureOccurrences(
  billId: string,
  cyclesAhead = FUTURE_OCCURRENCES_AHEAD,
): Promise<void> {
  const bill = await prisma.recurringBill.findUniqueOrThrow({
    where: { id: billId },
    include: { occurrences: true },
  });
  if (bill.status !== "active") return;

  const today = todayDateKeyInTimeZone();
  const existingKeys = new Set(bill.occurrences.map((o) => o.cycleKey));
  const anchorDate =
    bill.lastOccurrenceDate ??
    bill.occurrences
      .filter((o) => o.status === "paid")
      .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())[0]?.dueDate ??
    new Date(`${today}T12:00:00.000Z`);

  let ref = new Date(anchorDate);
  if (toDateKey(ref) < today) {
    ref = new Date(`${today}T12:00:00.000Z`);
  }

  const toCreate: {
    billId: string;
    cycleKey: string;
    dueDate: Date;
    amount: number;
    status: string;
  }[] = [];

  for (let i = 0; i < cyclesAhead; i++) {
    const dueDate =
      i === 0
        ? computeDueDateForMonth(bill.dayOfMonth, ref)
        : computeInstallmentDueDate(
            computeDueDateForMonth(bill.dayOfMonth, ref),
            i + 1,
            bill.dayOfMonth,
          );
    const cycleKey = monthCycleKey(toDateKey(dueDate));
    if (existingKeys.has(cycleKey)) continue;
    if (toDateKey(dueDate) < today && !existingKeys.has(cycleKey)) {
      // still create past-month pending if missing (for reconciliation)
    }
    toCreate.push({
      billId: bill.id,
      cycleKey,
      dueDate,
      amount: bill.expectedAmount,
      status: "pending",
    });
    existingKeys.add(cycleKey);
  }

  if (toCreate.length > 0) {
    await prisma.recurringBillOccurrence.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }
}

async function applyBillStatus(
  billId: string,
  status: "dismissed" | "inactive",
): Promise<void> {
  await prisma.recurringBill.update({
    where: { id: billId },
    data: { status },
  });
  await prisma.recurringBillOccurrence.updateMany({
    where: { billId, status: "pending" },
    data: { status: "skipped" },
  });
  await syncFromRecurringBill(billId);
}

async function dismissInvalidRecurringBills(userId: string): Promise<number> {
  const bills = await prisma.recurringBill.findMany({
    where: { userId, status: { in: ["active", "inactive"] } },
    include: {
      account: { select: { type: true } },
      occurrences: {
        where: { transactionId: { not: null } },
        include: {
          transaction: {
            select: {
              description: true,
              amount: true,
              merchantName: true,
              category: true,
              pluggyCategory: true,
              userCategory: true,
            },
          },
        },
        take: 1,
        orderBy: { dueDate: "desc" },
      },
    },
  });

  let dismissed = 0;
  for (const bill of bills) {
    const orphanOrInstallment = shouldDismissAutoDetectedBill({
      source: bill.source as RecurringBillSource,
      accountId: bill.accountId,
      title: bill.title,
      payeeName: bill.payeeName,
    });

    const anchorTx = bill.occurrences[0]?.transaction;
    const reconstructedAmount =
      anchorTx?.amount ??
      (isCreditAccount(bill.account?.type) ? bill.expectedAmount : -bill.expectedAmount);
    const candidate = {
      id: bill.id,
      date: bill.lastOccurrenceDate?.toISOString() ?? new Date().toISOString(),
      description: anchorTx?.description ?? bill.title,
      amount: reconstructedAmount,
      merchantName: anchorTx?.merchantName,
      category: anchorTx
        ? effectiveTransactionCategory(anchorTx)
        : bill.category,
      accountId: bill.accountId ?? "",
      accountType: bill.account?.type,
      personId: bill.personId ?? undefined,
    };

    const shouldDismiss =
      orphanOrInstallment ||
      isCreditCardBillPayment(candidate.category, candidate.description) ||
      !isRecurringBillCandidateTransaction(candidate);

    if (shouldDismiss) {
      await applyBillStatus(bill.id, "dismissed");
      dismissed += 1;
    }
  }

  return dismissed;
}

async function dismissUnconfirmedAutoBills(
  userId: string,
  personId: string | undefined,
  candidates: RecurringPatternCandidate[],
): Promise<number> {
  const confirmed = new Set(
    candidates.map((candidate) => `${candidate.matchSignature}::${candidate.accountId}`),
  );

  const bills = await prisma.recurringBill.findMany({
    where: {
      userId,
      source: "auto_detected",
      status: { in: ["active", "inactive"] },
      ...(personId ? { personId } : {}),
    },
  });

  let dismissed = 0;
  for (const bill of bills) {
    const key = `${bill.matchSignature}::${bill.accountId ?? ""}`;
    if (confirmed.has(key)) continue;
    await applyBillStatus(bill.id, "dismissed");
    dismissed += 1;
  }
  return dismissed;
}

export async function detectRecurringBills(
  userId: string,
  personId?: string,
): Promise<{ detected: number; dismissed: number }> {
  let dismissed = await dismissInvalidRecurringBills(userId);
  const txs = await loadOutflowTransactions(userId, personId);
  const candidates = detectRecurringPatterns(txs);
  let detected = 0;

  for (const candidate of candidates) {
    const existing = await prisma.recurringBill.findFirst({
      where: {
        userId,
        matchSignature: candidate.matchSignature,
        accountId: candidate.accountId,
      },
    });

    if (existing?.status === "dismissed") continue;

    const lastTx = candidate.transactions[candidate.transactions.length - 1]!;
    const lastDate = new Date(lastTx.date);

    if (existing) {
      await prisma.recurringBill.update({
        where: { id: existing.id },
        data: {
          expectedAmount: candidate.expectedAmount,
          lastOccurrenceDate: lastDate,
          category: candidate.category ?? existing.category,
          dayOfMonth: candidate.dayOfMonth,
          ...(existing.status === "inactive" ? { status: "active" } : {}),
        },
      });

      for (const tx of candidate.transactions) {
        const cycleKey = monthCycleKey(toDateKey(new Date(tx.date)));
        await prisma.recurringBillOccurrence.upsert({
          where: {
            billId_cycleKey: { billId: existing.id, cycleKey },
          },
          create: {
            billId: existing.id,
            cycleKey,
            dueDate: new Date(tx.date),
            amount: Math.abs(tx.amount),
            status: "paid",
            transactionId: tx.id,
            paidAt: new Date(tx.date),
          },
          update: {
            transactionId: tx.id,
            status: "paid",
            paidAt: new Date(tx.date),
            amount: Math.abs(tx.amount),
          },
        });
      }

      await ensureFutureOccurrences(existing.id);
      await syncFromRecurringBill(existing.id);
      continue;
    }

    const bill = await prisma.recurringBill.create({
      data: {
        userId,
        personId: candidate.personId || null,
        accountId: candidate.accountId,
        title: candidate.title,
        payeeName: candidate.payeeName,
        matchSignature: candidate.matchSignature,
        category: candidate.category,
        expectedAmount: candidate.expectedAmount,
        dayOfMonth: candidate.dayOfMonth,
        status: "active",
        source: "auto_detected",
        lastOccurrenceDate: lastDate,
        occurrences: {
          create: candidate.transactions.map((tx) => ({
            cycleKey: monthCycleKey(toDateKey(new Date(tx.date))),
            dueDate: new Date(tx.date),
            amount: Math.abs(tx.amount),
            status: "paid",
            transactionId: tx.id,
            paidAt: new Date(tx.date),
          })),
        },
      },
    });

    await ensureFutureOccurrences(bill.id);
    await syncFromRecurringBill(bill.id);
    detected += 1;
  }

  dismissed += await dismissUnconfirmedAutoBills(userId, personId, candidates);

  return { detected, dismissed };
}

export async function matchRecurringBillOccurrences(userId: string): Promise<number> {
  const pendingOccurrences = await prisma.recurringBillOccurrence.findMany({
    where: {
      status: "pending",
      bill: { userId, status: "active" },
    },
    include: { bill: true },
    orderBy: [{ dueDate: "asc" }],
  });

  if (pendingOccurrences.length === 0) return 0;

  const linkedTxIds = new Set(
    (
      await prisma.recurringBillOccurrence.findMany({
        where: { transactionId: { not: null }, bill: { userId } },
        select: { transactionId: true },
      })
    )
      .map((o) => o.transactionId)
      .filter((id): id is string => id !== null),
  );

  const installmentLinked = new Set(
    (
      await prisma.paymentInstallment.findMany({
        where: { transactionId: { not: null }, commitment: { userId } },
        select: { transactionId: true },
      })
    )
      .map((i) => i.transactionId)
      .filter((id): id is string => id !== null),
  );

  const candidateTransactions = await prisma.transaction.findMany({
    where: {
      id: { notIn: [...linkedTxIds, ...installmentLinked] },
      account: { connection: { person: { userId } } },
    },
    include: { account: { select: { type: true, id: true } } },
    orderBy: { date: "desc" },
    take: 500,
  });

  let matched = 0;

  for (const occurrence of pendingOccurrences) {
    const { bill } = occurrence;
    const dueKey = toDateKey(occurrence.dueDate);

    const candidates = candidateTransactions.filter((tx) => {
      if (linkedTxIds.has(tx.id)) return false;
      if (bill.accountId && tx.accountId !== bill.accountId) return false;
      if (isCreditAccount(tx.account.type)) return false;
      if (!isTransactionOutflow(tx.amount, tx.account.type)) return false;
      if (!amountsMatch(tx.amount, bill.expectedAmount, bill.expectedAmount * 0.2)) return false;

      const txSig = normalizeBillSignature(tx.description, tx.merchantName);
      if (txSig !== bill.matchSignature && !txSig.includes(bill.matchSignature.slice(0, 8))) {
        return false;
      }

      const txKey = toDateKey(tx.date);
      const daysDiff = Math.abs(
        Math.round(
          (new Date(txKey).getTime() - new Date(dueKey).getTime()) / 86_400_000,
        ),
      );
      return daysDiff <= MATCH_DATE_TOLERANCE_DAYS;
    });

    if (candidates.length !== 1) continue;

    const tx = candidates[0]!;

    await prisma.recurringBillOccurrence.update({
      where: { id: occurrence.id },
      data: {
        status: "paid",
        transactionId: tx.id,
        paidAt: tx.date,
        amount: Math.abs(tx.amount),
      },
    });

    await prisma.recurringBill.update({
      where: { id: bill.id },
      data: {
        lastOccurrenceDate: tx.date,
        expectedAmount: Math.abs(tx.amount),
      },
    });

    linkedTxIds.add(tx.id);
    matched += 1;
    await syncFromRecurringBill(bill.id);
  }

  return matched;
}

export async function deactivateStaleRecurringBills(
  userId: string,
  personId?: string,
): Promise<number> {
  const bills = await prisma.recurringBill.findMany({
    where: {
      userId,
      status: "active",
      ...(personId ? { personId } : {}),
    },
    include: {
      occurrences: {
        where: { status: "paid", transactionId: { not: null } },
        orderBy: { dueDate: "desc" },
        take: 1,
      },
    },
  });

  const today = todayDateKeyInTimeZone();
  let deactivated = 0;

  for (const bill of bills) {
    const lastPaidKey =
      bill.occurrences[0]?.paidAt != null
        ? toDateKey(bill.occurrences[0].paidAt)
        : bill.lastOccurrenceDate != null
          ? toDateKey(bill.lastOccurrenceDate)
          : null;

    if (
      !shouldDeactivateStaleRecurringBill({
        status: bill.status as RecurringBillStatus,
        source: bill.source as RecurringBillSource,
        dayOfMonth: bill.dayOfMonth,
        lastPaidDateKey: lastPaidKey,
        today,
      })
    ) {
      continue;
    }

    await applyBillStatus(bill.id, "inactive");
    deactivated += 1;
  }

  return deactivated;
}

export async function listRecurringBills(
  userId: string,
  filters?: { personId?: string; status?: string },
): Promise<RecurringBillDTO[]> {
  await deactivateStaleRecurringBills(userId, filters?.personId);

  const statusFilter = filters?.status ?? "active,inactive";
  const statuses = statusFilter.split(",").map((s) => s.trim());

  const rows = await prisma.recurringBill.findMany({
    where: {
      userId,
      status: { in: statuses },
      ...(filters?.personId ? { personId: filters.personId } : {}),
    },
    include: billInclude,
    orderBy: [{ status: "asc" }, { expectedAmount: "desc" }, { title: "asc" }],
  });

  return rows.map(serializeBill);
}

export async function updateRecurringBill(
  userId: string,
  id: string,
  data: UpdateRecurringBillInput,
): Promise<RecurringBillDTO> {
  const existing = await prisma.recurringBill.findFirst({ where: { id, userId } });
  if (!existing) throw new RecurringBillNotFoundError();

  const updated = await prisma.recurringBill.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.payeeName !== undefined ? { payeeName: data.payeeName } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.personId !== undefined ? { personId: data.personId } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.expectedAmount !== undefined ? { expectedAmount: data.expectedAmount } : {}),
      ...(data.dayOfMonth !== undefined ? { dayOfMonth: data.dayOfMonth } : {}),
    },
    include: billInclude,
  });

  if (updated.status === "active") {
    await ensureFutureOccurrences(updated.id);
  }

  await syncFromRecurringBill(updated.id);
  return serializeBill(updated);
}

export async function dismissRecurringBill(userId: string, id: string): Promise<void> {
  const existing = await prisma.recurringBill.findFirst({ where: { id, userId } });
  if (!existing) throw new RecurringBillNotFoundError();

  await applyBillStatus(id, "dismissed");
}

export async function runRecurringBillPipeline(
  userId: string,
  personId?: string,
): Promise<DetectRecurringBillsResponse> {
  const { detected, dismissed } = await detectRecurringBills(userId, personId);
  const matched = await matchRecurringBillOccurrences(userId);
  const deactivated = await deactivateStaleRecurringBills(userId, personId);

  const activeBills = await prisma.recurringBill.findMany({
    where: { userId, status: "active", ...(personId ? { personId } : {}) },
    select: { id: true },
  });
  for (const bill of activeBills) {
    await ensureFutureOccurrences(bill.id);
  }

  const bills = await listRecurringBills(userId, {
    personId,
    status: "active,inactive",
  });

  return { detected, matched, dismissed, deactivated, bills };
}

export async function loadActiveBillsForImpact(
  userId: string,
  personId?: string,
): Promise<RecurringBillForSimulation[]> {
  const rows = await prisma.recurringBill.findMany({
    where: {
      userId,
      status: "active",
      ...(personId ? { personId } : {}),
    },
    include: { occurrences: true },
  });

  const today = todayDateKeyInTimeZone();
  const horizon = new Date(`${today}T12:00:00.000Z`);
  horizon.setUTCMonth(horizon.getUTCMonth() + FUTURE_OCCURRENCES_AHEAD + 1);

  return rows.map((bill) => ({
    id: bill.id,
    title: bill.title,
    category: bill.category,
    expectedAmount: bill.expectedAmount,
    dayOfMonth: bill.dayOfMonth,
    occurrences: bill.occurrences
      .filter((o) => o.dueDate <= horizon)
      .map((o) => ({
        id: o.id,
        dueDate: o.dueDate.toISOString(),
        amount: o.amount,
        status: o.status as OccurrenceStatus,
      })),
  }));
}

export class RecurringBillNotFoundError extends Error {
  constructor() {
    super("Conta fixa não encontrada");
    this.name = "RecurringBillNotFoundError";
  }
}
