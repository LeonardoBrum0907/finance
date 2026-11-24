import {
  cleanMerchantTitle,
  isTransactionOutflow,
  normalizeBillSignature,
  type TransactionRecurringBillDTO,
} from "@finance/shared";
import { prisma } from "../../prisma.js";
import { effectiveTransactionCategory } from "../transactionCategory.js";
import { syncFromRecurringBill } from "./managedAccounts.js";
import { ensureFutureOccurrences } from "./recurringBills.js";

/**
 * "Tornar conta fixa" no detalhe da transação (pedido do Léo em 24/11/2026): a pessoa
 * diz que aquela cobrança se repete todo mês, sem esperar a detecção automática.
 */

export class TransactionNotFoundForBillError extends Error {
  constructor(transactionId: string) {
    super(`Transação ${transactionId} não encontrada`);
    this.name = "TransactionNotFoundForBillError";
  }
}

export class TransactionNotBillableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "TransactionNotBillableError";
  }
}

interface BillableTransaction {
  id: string;
  date: Date;
  amount: number;
  description: string;
  merchantName: string | null;
  category: string | null;
  userCategory: string | null;
  pluggyCategory: string | null;
  accountId: string;
  account: { type: string | null; connection: { personId: string } };
}

function monthRange(date: Date): { gte: Date; lt: Date } {
  const gte = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const lt = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { gte, lt };
}

async function loadBillableTransaction(userId: string, transactionId: string): Promise<BillableTransaction> {
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, account: { connection: { person: { userId } } } },
    include: { account: { select: { type: true, connection: { select: { personId: true } } } } },
  });
  if (!tx) throw new TransactionNotFoundForBillError(transactionId);
  if (!isTransactionOutflow(tx.amount, tx.account.type)) {
    throw new TransactionNotBillableError("Só um pagamento (saída de dinheiro) vira conta fixa");
  }
  return tx;
}

/** Total do mês com a mesma descrição na mesma conta: dois planos no mês contam juntos. */
async function monthTotalForSignature(tx: BillableTransaction, signature: string): Promise<number> {
  const sameMonth = await prisma.transaction.findMany({
    where: { accountId: tx.accountId, date: monthRange(tx.date) },
    include: { account: { select: { type: true } } },
  });
  const total = sameMonth
    .filter((other) => isTransactionOutflow(other.amount, other.account.type))
    .filter((other) => normalizeBillSignature(other.description, other.merchantName) === signature)
    .reduce((sum, other) => sum + Math.abs(other.amount), 0);
  return Math.round(Math.max(total, Math.abs(tx.amount)) * 100) / 100;
}

async function upsertManualBill(
  userId: string,
  tx: BillableTransaction,
  signature: string,
  expectedAmount: number,
): Promise<string> {
  const billData = {
    expectedAmount,
    dayOfMonth: tx.date.getUTCDate(),
    lastOccurrenceDate: tx.date,
    status: "active",
    source: "manual",
  };
  const existing = await prisma.recurringBill.findFirst({
    where: { userId, accountId: tx.accountId, matchSignature: signature },
  });
  if (existing) {
    await prisma.recurringBill.update({ where: { id: existing.id }, data: billData });
    return existing.id;
  }
  const created = await prisma.recurringBill.create({
    data: {
      ...billData,
      userId,
      personId: tx.account.connection.personId,
      accountId: tx.accountId,
      title: cleanMerchantTitle(tx.merchantName?.trim() || tx.description),
      matchSignature: signature,
      category: effectiveTransactionCategory(tx),
    },
  });
  return created.id;
}

async function markMonthPaid(billId: string, tx: BillableTransaction, amount: number): Promise<void> {
  const cycleKey = tx.date.toISOString().slice(0, 7);
  // A cobrança pode estar presa à ocorrência de outra conta fixa; passa para esta.
  await prisma.recurringBillOccurrence.updateMany({
    where: { transactionId: tx.id },
    data: { transactionId: null },
  });
  const paid = { status: "paid", transactionId: tx.id, paidAt: tx.date, amount };
  await prisma.recurringBillOccurrence.upsert({
    where: { billId_cycleKey: { billId, cycleKey } },
    create: { billId, cycleKey, dueDate: tx.date, ...paid },
    update: paid,
  });
}

/**
 * Cria (ou reativa) a conta fixa da transação. O valor previsto é o total do mês com a
 * mesma descrição; o dia é o da cobrança.
 *
 * @example await createRecurringBillFromTransaction(userId, "tx_anthropic_nov") // { title: "ANTHROPIC* CLAUDE SUB", expectedAmount: 630.93, ... }
 */
export async function createRecurringBillFromTransaction(
  userId: string,
  transactionId: string,
): Promise<TransactionRecurringBillDTO> {
  const tx = await loadBillableTransaction(userId, transactionId);
  const signature = normalizeBillSignature(tx.description, tx.merchantName);
  if (!signature) throw new TransactionNotBillableError(`Descrição sem nome reconhecível: "${tx.description}"`);
  const expectedAmount = await monthTotalForSignature(tx, signature);
  const billId = await upsertManualBill(userId, tx, signature, expectedAmount);
  await markMonthPaid(billId, tx, expectedAmount);
  await ensureFutureOccurrences(billId);
  await syncFromRecurringBill(billId);
  const bill = await prisma.recurringBill.findUniqueOrThrow({ where: { id: billId } });
  return { id: bill.id, title: bill.title, expectedAmount: bill.expectedAmount, dayOfMonth: bill.dayOfMonth };
}

/**
 * Conta fixa ativa a que a transação pertence (pela descrição), para o detalhe mostrar
 * "já é conta fixa" no lugar do botão.
 *
 * @example await findRecurringBillForTransaction(userId, tx) // null
 */
export async function findRecurringBillForTransaction(
  userId: string,
  tx: { accountId: string; description: string; merchantName: string | null },
): Promise<TransactionRecurringBillDTO | null> {
  const signature = normalizeBillSignature(tx.description, tx.merchantName);
  if (!signature) return null;
  const bill = await prisma.recurringBill.findFirst({
    where: { userId, accountId: tx.accountId, matchSignature: signature, status: "active" },
  });
  if (!bill) return null;
  return { id: bill.id, title: bill.title, expectedAmount: bill.expectedAmount, dayOfMonth: bill.dayOfMonth };
}
