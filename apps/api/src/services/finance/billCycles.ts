import {
  buildBillCycles,
  countsTowardCashFlow,
  isCreditAccount,
  isInvestmentAccount,
  isTransactionOutflow,
  managedAccountToSimulatedPurchase,
  resolveExpectedSalary,
  toLocalDateKey,
  todayDateKeyInTimeZone,
  type BillCycleCardItem,
  type BillCycleScheduledItem,
  type BillCyclesResult,
  type SalaryEntry,
} from "@finance/shared";
import { prisma } from "../../prisma.js";
import { resolvePaydayCycle } from "../userSettings.js";
import { effectiveTransactionCategory } from "../transactionCategory.js";
import { loadCardsForCycleBills } from "./creditCardBills.js";
import { loadActiveManagedAccountsForImpact } from "./managedAccounts.js";
import type { FinancialTransaction } from "./types.js";

const HISTORY_MONTHS = 6;
const SALARY_CATEGORY = "Salário";

/** Entradas na conta com categoria Salário (inclusive as já lançadas com data futura). */
function salaryEntries(txs: FinancialTransaction[]): SalaryEntry[] {
  return txs
    .filter(
      (tx) =>
        !isCreditAccount(tx.accountType) &&
        !isTransactionOutflow(tx.amount, tx.accountType) &&
        tx.category === SALARY_CATEGORY,
    )
    .map((tx) => ({ date: toLocalDateKey(tx.date), amount: Math.abs(tx.amount) }));
}

export async function buildBillCyclesForUser(
  userId: string,
  personId?: string,
): Promise<BillCyclesResult | null> {
  const { paydayDay } = await resolvePaydayCycle(userId, personId);
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - HISTORY_MONTHS);

  const people = await prisma.person.findMany({
    where: { userId, ...(personId ? { id: personId } : {}) },
    include: {
      connections: {
        include: {
          accounts: { include: { transactions: { where: { date: { gte: since } } } } },
        },
      },
    },
  });

  const txs: FinancialTransaction[] = [];
  const creditAccounts: Parameters<typeof loadCardsForCycleBills>[0] = [];
  let bankBalance = 0;
  for (const person of people) {
    for (const connection of person.connections) {
      for (const acc of connection.accounts) {
        if (isCreditAccount(acc.type)) {
          creditAccounts.push({
            id: acc.id,
            name: acc.name,
            type: acc.type,
            pluggyAccountId: acc.pluggyAccountId,
            billDueDay: acc.billDueDay,
            billCloseDay: acc.billCloseDay,
            balanceDueDate: acc.balanceDueDate,
            balanceCloseDate: acc.balanceCloseDate,
            creditBrand: acc.creditBrand,
          });
        } else if (!isInvestmentAccount(acc.type)) {
          bankBalance += acc.balance;
        }
        for (const tx of acc.transactions) {
          txs.push({
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
            billForecastMonth: tx.billForecastMonth,
          });
        }
      }
    }
  }

  const cards = await loadCardsForCycleBills(creditAccounts, txs);
  if (cards.length === 0) return null;
  const today = todayDateKeyInTimeZone();

  const scheduledCash: BillCycleScheduledItem[] = [];
  const scheduledCard: BillCycleCardItem[] = [];

  // Saídas já agendadas na conta corrente (data futura).
  for (const tx of txs) {
    if (isCreditAccount(tx.accountType)) continue;
    if (!isTransactionOutflow(tx.amount, tx.accountType)) continue;
    if (!countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description, tx.personName)) {
      continue;
    }
    const date = toLocalDateKey(tx.date);
    if (date <= today) continue;
    scheduledCash.push({ id: tx.id, title: tx.description, date, amount: Math.abs(tx.amount) });
  }

  // Contas fixas, parcelamentos e simulações ativas.
  const managed = await loadActiveManagedAccountsForImpact(userId, personId);
  for (const account of managed) {
    const purchase = managedAccountToSimulatedPurchase(account);
    if (!purchase) continue;
    const cardAccountId = account.paidByCard
      ? (account.cardAccountId ?? cards[0]!.accountId)
      : null;
    for (const inst of purchase.installments) {
      const date = inst.dueDate.slice(0, 10);
      if (cardAccountId) {
        scheduledCard.push({
          id: inst.id,
          title: purchase.title,
          date,
          amount: inst.amount,
          cardAccountId,
          // Parcelas do cartão já guardam o vencimento da fatura.
          billMonth: account.kind === "installment_plan" ? date.slice(0, 7) : null,
        });
      } else if (date > today) {
        scheduledCash.push({ id: inst.id, title: purchase.title, date, amount: inst.amount });
      }
    }
  }

  const salary = resolveExpectedSalary(salaryEntries(txs), today);

  return buildBillCycles({
    today,
    bankBalance: Math.round(bankBalance * 100) / 100,
    paydayDay,
    expectedSalary: salary.amount,
    salaryReceivedDates: salary.receivedDates,
    cards,
    checkingPayments: txs
      .filter((tx) => !isCreditAccount(tx.accountType))
      .map((tx) => ({
        date: tx.date,
        amount: tx.amount,
        category: tx.category,
        description: tx.description,
        accountType: tx.accountType,
      })),
    scheduledCash,
    scheduledCard,
  });
}
