import type {
  CommitmentStatus,
  InstallmentStatus,
  PaymentCommitmentDTO,
  PaymentInstallmentDTO,
  TransactionCommitmentSummary,
  TransactionDetailDTO,
} from "@finance/shared";
import {
  descriptionMatchesPersonName,
  isCreditAccount,
  isTransactionOutflow,
} from "@finance/shared";
import type { PaymentCommitment, PaymentInstallment, Transaction } from "@prisma/client";
import { prisma } from "../../prisma.js";

const AMOUNT_TOLERANCE = 0.01;
const DATE_TOLERANCE_DAYS = 3;

type CommitmentWithInstallments = PaymentCommitment & {
  installments: PaymentInstallment[];
};

export function clampDayOfMonth(year: number, month: number, day: number): number {
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Math.min(day, maxDay);
}

export function computeInstallmentDueDate(
  anchorDate: Date,
  sequence: number,
  dayOfMonth: number | null,
): Date {
  if (sequence <= 1) return new Date(anchorDate);

  const monthsToAdd = sequence - 1;
  const anchorDay = dayOfMonth ?? anchorDate.getUTCDate();
  const target = new Date(anchorDate);
  target.setUTCMonth(target.getUTCMonth() + monthsToAdd);
  const day = clampDayOfMonth(target.getUTCFullYear(), target.getUTCMonth(), anchorDay);
  target.setUTCDate(day);
  return target;
}

function serializeInstallment(inst: PaymentInstallment): PaymentInstallmentDTO {
  return {
    id: inst.id,
    sequence: inst.sequence,
    dueDate: inst.dueDate.toISOString(),
    amount: inst.amount,
    status: inst.status as InstallmentStatus,
    transactionId: inst.transactionId,
    paidAt: inst.paidAt?.toISOString() ?? null,
  };
}

export function serializeCommitment(commitment: CommitmentWithInstallments): PaymentCommitmentDTO {
  const installments = [...commitment.installments].sort((a, b) => a.sequence - b.sequence);
  const paidCount = installments.filter((i) => i.status === "paid").length;
  const pendingCount = installments.filter((i) => i.status === "pending").length;

  return {
    id: commitment.id,
    title: commitment.title,
    payeeName: commitment.payeeName,
    notes: commitment.notes,
    totalAmount: commitment.totalAmount,
    installmentAmount: commitment.installmentAmount,
    totalInstallments: commitment.totalInstallments,
    dayOfMonth: commitment.dayOfMonth,
    status: commitment.status as CommitmentStatus,
    anchorTransactionId: commitment.anchorTransactionId,
    paidCount,
    pendingCount,
    installments: installments.map(serializeInstallment),
    createdAt: commitment.createdAt.toISOString(),
    updatedAt: commitment.updatedAt.toISOString(),
  };
}

export function buildCommitmentSummary(
  commitment: CommitmentWithInstallments,
  transactionId: string,
): TransactionCommitmentSummary | null {
  const installment = commitment.installments.find((i) => i.transactionId === transactionId);
  if (!installment) return null;

  const paidCount = commitment.installments.filter((i) => i.status === "paid").length;
  const pendingCount = commitment.installments.filter((i) => i.status === "pending").length;

  return {
    commitmentId: commitment.id,
    title: commitment.title,
    sequence: installment.sequence,
    totalInstallments: commitment.totalInstallments,
    paidCount,
    pendingCount,
  };
}

async function refreshCommitmentStatus(commitmentId: string): Promise<void> {
  const commitment = await prisma.paymentCommitment.findUnique({
    where: { id: commitmentId },
    include: { installments: true },
  });
  if (!commitment || commitment.status === "cancelled") return;

  const allPaid = commitment.installments.every(
    (i) => i.status === "paid" || i.status === "skipped",
  );
  if (allPaid && commitment.installments.length > 0) {
    await prisma.paymentCommitment.update({
      where: { id: commitmentId },
      data: { status: "completed" },
    });
  }
}

export interface CreateCommitmentParams {
  userId: string;
  transactionId: string;
  title: string;
  payeeName?: string;
  notes?: string;
  totalAmount: number;
  installmentAmount: number;
  totalInstallments: number;
  dayOfMonth?: number;
}

export async function createCommitmentFromTransaction(
  params: CreateCommitmentParams,
): Promise<PaymentCommitmentDTO> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: params.transactionId,
      account: { connection: { person: { userId: params.userId } } },
    },
    include: {
      installmentPayment: true,
      anchorCommitment: true,
    },
  });

  if (!transaction) {
    throw new Error("Transação não encontrada");
  }
  if (transaction.installmentPayment || transaction.anchorCommitment) {
    throw new Error("Esta transação já está vinculada a um compromisso");
  }

  const anchorDate = transaction.date;
  const dayOfMonth = params.dayOfMonth ?? anchorDate.getUTCDate();

  const installmentsData = Array.from({ length: params.totalInstallments }, (_, idx) => {
    const sequence = idx + 1;
    const dueDate = computeInstallmentDueDate(anchorDate, sequence, dayOfMonth);
    const isFirst = sequence === 1;
    return {
      sequence,
      dueDate,
      amount: params.installmentAmount,
      status: isFirst ? "paid" : "pending",
      transactionId: isFirst ? transaction.id : null,
      paidAt: isFirst ? anchorDate : null,
    };
  });

  const commitment = await prisma.paymentCommitment.create({
    data: {
      userId: params.userId,
      title: params.title,
      payeeName: params.payeeName ?? null,
      notes: params.notes ?? null,
      totalAmount: params.totalAmount,
      installmentAmount: params.installmentAmount,
      totalInstallments: params.totalInstallments,
      dayOfMonth,
      anchorTransactionId: transaction.id,
      installments: { create: installmentsData },
    },
    include: { installments: true },
  });

  await refreshCommitmentStatus(commitment.id);
  const refreshed = await prisma.paymentCommitment.findUniqueOrThrow({
    where: { id: commitment.id },
    include: { installments: true },
  });

  return serializeCommitment(refreshed);
}

export async function loadCommitmentSummariesForTransactions(
  userId: string,
  transactionIds: string[],
): Promise<Map<string, TransactionCommitmentSummary>> {
  if (transactionIds.length === 0) return new Map();

  const installments = await prisma.paymentInstallment.findMany({
    where: {
      transactionId: { in: transactionIds },
      commitment: { userId },
    },
    include: {
      commitment: { include: { installments: true } },
    },
  });

  const map = new Map<string, TransactionCommitmentSummary>();
  for (const inst of installments) {
    const summary = buildCommitmentSummary(inst.commitment, inst.transactionId!);
    if (summary) map.set(inst.transactionId!, summary);
  }
  return map;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86_400_000);
}

function amountsMatch(a: number, b: number): boolean {
  return Math.abs(Math.abs(a) - Math.abs(b)) <= AMOUNT_TOLERANCE;
}

export async function matchCommitmentInstallments(userId: string): Promise<number> {
  const pendingInstallments = await prisma.paymentInstallment.findMany({
    where: {
      status: "pending",
      commitment: { userId, status: "active" },
    },
    include: { commitment: true },
    orderBy: [{ commitmentId: "asc" }, { sequence: "asc" }],
  });

  if (pendingInstallments.length === 0) return 0;

  const linkedTxIds = new Set(
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
      id: { notIn: [...linkedTxIds] },
      account: { connection: { person: { userId } } },
    },
    include: {
      account: { select: { type: true } },
    },
    orderBy: { date: "desc" },
    take: 500,
  });

  let matched = 0;

  for (const installment of pendingInstallments) {
    const { commitment } = installment;
    if (!commitment.payeeName) continue;

    const dueKey = toDateKey(installment.dueDate);
    const candidates = candidateTransactions.filter((tx) => {
      if (linkedTxIds.has(tx.id)) return false;
      if (isCreditAccount(tx.account.type)) return false;
      if (!isTransactionOutflow(tx.amount, tx.account.type)) return false;
      if (!amountsMatch(tx.amount, commitment.installmentAmount)) return false;
      if (!descriptionMatchesPersonName(tx.description, commitment.payeeName!)) return false;

      const txKey = toDateKey(tx.date);
      return Math.abs(diffDays(dueKey, txKey)) <= DATE_TOLERANCE_DAYS;
    });

    if (candidates.length !== 1) continue;

    const tx = candidates[0]!;

    await prisma.paymentInstallment.update({
      where: { id: installment.id },
      data: {
        status: "paid",
        transactionId: tx.id,
        paidAt: tx.date,
      },
    });

    linkedTxIds.add(tx.id);
    matched += 1;
    await refreshCommitmentStatus(commitment.id);
  }

  return matched;
}

export async function sumPendingInstallmentsInRange(
  userId: string,
  from: string,
  to: string,
): Promise<number> {
  const installments = await prisma.paymentInstallment.findMany({
    where: {
      status: "pending",
      dueDate: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T23:59:59.999Z`),
      },
      commitment: { userId, status: "active" },
    },
    select: { amount: true },
  });

  return installments.reduce((sum, i) => sum + i.amount, 0);
}

export async function loadCommitmentForTransaction(
  userId: string,
  transactionId: string,
): Promise<CommitmentWithInstallments | null> {
  const byAnchor = await prisma.paymentCommitment.findFirst({
    where: { userId, anchorTransactionId: transactionId },
    include: { installments: true },
  });
  if (byAnchor) return byAnchor;

  const installment = await prisma.paymentInstallment.findFirst({
    where: { transactionId, commitment: { userId } },
    include: { commitment: { include: { installments: true } } },
  });
  return installment?.commitment ?? null;
}

export async function updateCommitment(
  userId: string,
  commitmentId: string,
  data: { title?: string; payeeName?: string | null; notes?: string | null; status?: string },
): Promise<PaymentCommitmentDTO> {
  const existing = await prisma.paymentCommitment.findFirst({
    where: { id: commitmentId, userId },
  });
  if (!existing) throw new Error("Compromisso não encontrado");

  const updated = await prisma.paymentCommitment.update({
    where: { id: commitmentId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.payeeName !== undefined ? { payeeName: data.payeeName } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
    include: { installments: true },
  });

  return serializeCommitment(updated);
}

export async function listActiveCommitments(userId: string): Promise<PaymentCommitmentDTO[]> {
  const commitments = await prisma.paymentCommitment.findMany({
    where: { userId, status: { in: ["active", "completed"] } },
    include: { installments: true },
    orderBy: { updatedAt: "desc" },
  });
  return commitments.map(serializeCommitment);
}

export function extractPayeeFromDescription(description: string): string | null {
  const upper = description.toUpperCase();
  const pixMatch = upper.match(/PIX\s+(?:ENVIADO|RECEBIDO)\s+(.+)/);
  if (pixMatch?.[1]) {
    return pixMatch[1].trim().replace(/\s*\|.*$/, "").trim() || null;
  }
  const transferMatch = upper.match(/TRANSFER[EÊ]NCIA\s+(?:ENVIADA|RECEBIDA)\s*\|?\s*(.+)/);
  if (transferMatch?.[1]) {
    return transferMatch[1].trim() || null;
  }
  return null;
}

export type TransactionWithAccount = Transaction & {
  account: {
    id: string;
    name: string;
    type: string | null;
    connection: { person: { id: string; name: string } };
  };
};

export function toTransactionDetailFields(
  tx: TransactionWithAccount,
  category: string | null,
  commitment: CommitmentWithInstallments | null,
): TransactionDetailDTO {
  const commitmentDto = commitment ? serializeCommitment(commitment) : null;
  const commitmentSummary =
    commitment && tx.id ? buildCommitmentSummary(commitment, tx.id) : null;

  return {
    id: tx.id,
    date: tx.date.toISOString(),
    description: tx.description,
    amount: tx.amount,
    currencyCode: tx.currencyCode,
    category,
    userCategory: tx.userCategory,
    categorySource: tx.categorySource,
    merchantName: tx.merchantName,
    accountId: tx.account.id,
    accountName: tx.account.name,
    accountType: tx.account.type,
    personId: tx.account.connection.person.id,
    personName: tx.account.connection.person.name,
    commitment: commitmentDto,
    commitmentSummary,
  };
}
