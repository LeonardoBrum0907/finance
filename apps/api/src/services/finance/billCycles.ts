import {
  buildBillCycles,
  countsTowardCashFlow,
  isCreditAccount,
  isInvestmentAccount,
  isTransactionOutflow,
  scheduleManagedAccountForBillCycles,
  resolveExpectedSalary,
  toLocalDateKey,
  todayDateKeyInTimeZone,
  type BillCycleCardItem,
  type BillCycleScheduledItem,
  type BillCyclesResult,
  type ManualBillPaid,
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
    .map((tx) => ({
      date: toLocalDateKey(tx.date),
      amount: Math.abs(tx.amount),
      description: tx.description,
    }));
}

/** Faturas que a pessoa marcou como pagas nos cartões do painel. */
async function loadManualPaidBills(accountIds: string[]): Promise<ManualBillPaid[]> {
  const marks = await prisma.cardBillPaidMark.findMany({ where: { accountId: { in: accountIds } } });
  return marks.map((mark) => ({
    accountId: mark.accountId,
    billMonth: mark.billMonth,
    paidOn: mark.paidOn.toISOString().slice(0, 10),
  }));
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

  // Contas fixas, parcelamentos e compras planejadas ativas.
  const managed = await loadActiveManagedAccountsForImpact(userId, personId);
  const cardAccountIds = cards.map((card) => card.accountId);
  for (const account of managed) {
    const items = scheduleManagedAccountForBillCycles(account, { today, cardAccountIds });
    scheduledCash.push(...items.cash);
    scheduledCard.push(...items.card);
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
    manualPaidBills: await loadManualPaidBills(cards.map((card) => card.accountId)),
  });
}
