import {
  dateKeyToNoonUtc,
  deriveUnpublishedBills,
  resolveStatementDays,
  summarizeCardBills,
  toLocalDateKey,
  type CardBillSummary,
  type CardChargeWithBill,
  type PublishedCardBill,
} from "@finance/shared";
import { prisma } from "../../prisma.js";

/** Janela de compras lida para montar e resumir faturas (cobre a fatura fechada e a aberta). */
const CHARGE_WINDOW_DAYS = 120;

interface CardCalendar {
  id: string;
  billDueDay: number | null;
  billCloseDay: number | null;
  balanceDueDate: Date | null;
  balanceCloseDate: Date | null;
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toPublishedBill(bill: {
  pluggyBillId: string;
  dueDate: Date;
  closingDate: Date | null;
  totalAmount: number;
}): PublishedCardBill {
  return {
    id: bill.pluggyBillId,
    dueDate: utcDateKey(bill.dueDate),
    closingDate: bill.closingDate ? utcDateKey(bill.closingDate) : null,
    totalAmount: bill.totalAmount,
  };
}

async function loadCardData(card: CardCalendar) {
  const since = new Date(Date.now() - CHARGE_WINDOW_DAYS * 86_400_000);
  const [bills, txs] = await Promise.all([
    prisma.creditCardBill.findMany({ where: { accountId: card.id } }),
    prisma.transaction.findMany({
      where: { accountId: card.id, date: { gte: since } },
      select: { date: true, amount: true, pluggyBillId: true, category: true, description: true },
    }),
  ]);
  const charges: CardChargeWithBill[] = txs.map((tx) => ({
    date: toLocalDateKey(tx.date),
    amount: tx.amount,
    billId: tx.pluggyBillId,
    category: tx.category,
    description: tx.description,
  }));
  const statements = bills.map(toPublishedBill);
  const days = resolveStatementDays({
    billDueDay: card.billDueDay,
    billCloseDay: card.billCloseDay,
    balanceDueDate: card.balanceDueDate ? utcDateKey(card.balanceDueDate) : null,
    balanceCloseDate: card.balanceCloseDate ? utcDateKey(card.balanceCloseDate) : null,
    statements,
  });
  return { bills, statements, charges, days };
}

/**
 * Grava como fatura (source "transactions") a que já fechou e a Pluggy ainda não
 * publicou em /bills, somando as compras com o mesmo billId. Quando a Pluggy
 * publicar, persistPluggyCreditCardBills sobrescreve pelo mesmo pluggyBillId.
 */
export async function persistDerivedCardBills(accountId: string): Promise<void> {
  const card = await prisma.account.findUnique({ where: { id: accountId } });
  if (!card) return;
  const { bills, charges, days } = await loadCardData(card);
  if (!days) return;
  const official = bills.filter((bill) => bill.source === "pluggy").map(toPublishedBill);
  const derived = deriveUnpublishedBills(charges, official, days, toLocalDateKey(new Date()));
  for (const bill of derived) {
    const values = {
      accountId,
      dueDate: new Date(`${bill.dueDate}T12:00:00.000Z`),
      closingDate: new Date(`${bill.closingDate}T12:00:00.000Z`),
      totalAmount: bill.totalAmount,
    };
    await prisma.creditCardBill.upsert({
      where: { pluggyBillId: bill.billId },
      create: { pluggyBillId: bill.billId, ...values, source: "transactions" },
      update: values,
    });
  }
}

/**
 * Fatura fechada e compras depois do fechamento de cada cartão, a partir das
 * faturas gravadas e do extrato. Cartão sem calendário conhecido fica de fora.
 */
export async function loadCardBillSummaries(
  cards: CardCalendar[],
): Promise<Map<string, CardBillSummary>> {
  const summaries = new Map<string, CardBillSummary>();
  const today = toLocalDateKey(new Date());
  for (const card of cards) {
    const { statements, charges, days } = await loadCardData(card);
    if (!days) continue;
    summaries.set(card.id, summarizeCardBills(statements, charges, days, today));
  }
  return summaries;
}

export interface AccountBillFields {
  closedBillAmount: number | null;
  closedBillDueDate: Date | null;
  openBillAmount: number | null;
  openBillDueDate: Date | null;
}

/** Converte o resumo para os campos de serializeAccount (datas ao meio-dia UTC). */
export function toAccountBillFields(bill: CardBillSummary | undefined): AccountBillFields {
  return {
    closedBillAmount: bill?.closedBillAmount ?? null,
    closedBillDueDate: bill?.closedBillDueDate ? dateKeyToNoonUtc(bill.closedBillDueDate) : null,
    openBillAmount: bill?.openBillAmount ?? null,
    openBillDueDate: bill?.openBillDueDate ? dateKeyToNoonUtc(bill.openBillDueDate) : null,
  };
}
