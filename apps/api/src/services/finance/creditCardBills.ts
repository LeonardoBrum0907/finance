import {
  isCreditAccount,
  isCreditCardBillPayment,
  isTransactionOutflow,
  toLocalDateKey,
  type CardForCycleBills,
} from "@finance/shared";
import { prisma } from "../../prisma.js";
import { isPluggyConfigured } from "../../env.js";
import type { FinancialTransaction } from "./types.js";

type PluggyBill = {
  id?: string;
  dueDate?: string | Date;
  billClosingDate?: string | Date | null;
  totalAmount?: number;
  minimumPaymentAmount?: number | null;
};

export async function persistPluggyCreditCardBills(
  pluggyAccountId: string,
  accountId: string,
): Promise<void> {
  if (!isPluggyConfigured()) return;
  try {
    const { getPluggyClient } = await import("../pluggy.js");
    const pluggy = getPluggyClient();
    const response = await pluggy.fetchCreditCardBills(pluggyAccountId);
    const bills = (response.results ?? []) as PluggyBill[];
    for (const bill of bills) {
      if (!bill.id || bill.dueDate == null || bill.totalAmount == null) continue;
      const dueDate = new Date(bill.dueDate);
      if (Number.isNaN(dueDate.getTime())) continue;
      const closingDate = bill.billClosingDate ? new Date(bill.billClosingDate) : null;
      await prisma.creditCardBill.upsert({
        where: { pluggyBillId: bill.id },
        create: {
          pluggyBillId: bill.id,
          accountId,
          dueDate,
          closingDate:
            closingDate && !Number.isNaN(closingDate.getTime()) ? closingDate : null,
          totalAmount: bill.totalAmount,
          minimumPaymentAmount: bill.minimumPaymentAmount ?? null,
          source: "pluggy",
        },
        update: {
          accountId,
          dueDate,
          closingDate:
            closingDate && !Number.isNaN(closingDate.getTime()) ? closingDate : null,
          totalAmount: bill.totalAmount,
          minimumPaymentAmount: bill.minimumPaymentAmount ?? null,
        },
      });
    }
  } catch {
    /* Nem todo conector expõe /bills. */
  }
}

export async function loadCardsForUser(
  userId: string,
  personId: string | undefined,
  txs: FinancialTransaction[],
): Promise<CardForCycleBills[]> {
  const creditAccounts = await prisma.account.findMany({
    where: {
      type: { contains: "CREDIT" },
      connection: {
        person: {
          userId,
          ...(personId ? { id: personId } : {}),
        },
      },
    },
    select: {
      id: true,
      name: true,
      type: true,
      pluggyAccountId: true,
      billDueDay: true,
      billCloseDay: true,
      balanceDueDate: true,
      balanceCloseDate: true,
      creditBrand: true,
    },
  });
  return loadCardsForCycleBills(creditAccounts, txs);
}

export async function loadCardsForCycleBills(
  creditAccounts: Array<{
    id: string;
    name: string;
    type: string | null;
    pluggyAccountId: string;
    billDueDay: number | null;
    billCloseDay: number | null;
    balanceDueDate: Date | null;
    balanceCloseDate: Date | null;
    creditBrand: string | null;
  }>,
  txs: FinancialTransaction[],
): Promise<CardForCycleBills[]> {
  if (creditAccounts.length === 0) return [];

  const ids = creditAccounts.map((acc) => acc.id);
  let stored = await prisma.creditCardBill.findMany({
    where: { accountId: { in: ids } },
  });

  const haveBills = new Set(stored.map((bill) => bill.accountId));
  const missing = creditAccounts.filter((acc) => !haveBills.has(acc.id));
  if (missing.length > 0) {
    await Promise.all(
      missing.map((acc) => persistPluggyCreditCardBills(acc.pluggyAccountId, acc.id)),
    );
    stored = await prisma.creditCardBill.findMany({
      where: { accountId: { in: ids } },
    });
  }

  return creditAccounts.filter((acc) => isCreditAccount(acc.type)).map((acc) => ({
    accountId: acc.id,
    accountName: acc.name,
    billDueDay: acc.billDueDay,
    billCloseDay: acc.billCloseDay,
    balanceDueDate: acc.balanceDueDate ? toLocalDateKey(acc.balanceDueDate) : null,
    balanceCloseDate: acc.balanceCloseDate ? toLocalDateKey(acc.balanceCloseDate) : null,
    creditBrand: acc.creditBrand,
    statements: stored
      .filter((bill) => bill.accountId === acc.id)
      .map((bill) => ({
        dueDate: toLocalDateKey(bill.dueDate),
        closingDate: bill.closingDate ? toLocalDateKey(bill.closingDate) : null,
        totalAmount: bill.totalAmount,
      })),
    charges: txs
      .filter(
        (tx) =>
          tx.accountId === acc.id &&
          isCreditAccount(tx.accountType) &&
          isTransactionOutflow(tx.amount, tx.accountType) &&
          !isCreditCardBillPayment(tx.category, tx.description),
      )
      .map((tx) => ({
        date: toLocalDateKey(tx.date),
        amount: Math.abs(tx.amount),
      })),
  }));
}
