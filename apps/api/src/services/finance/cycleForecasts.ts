import {
  alignSalaryDatesToPayday,
  buildCycleForecastBlock,
  buildCycleForecastPair,
  buildCycleStatementPayments,
  cardChargeDueDateKey,
  getNextPaydayCycle,
  getPaydayCycleRangeByKey,
  managedAccountToSimulatedPurchase,
  splitPurchaseImpactsByKind,
  toBillPaymentDates,
  todayDateKeyInTimeZone,
  type CardForCycleBills,
  type CycleForecastBlock,
  type CycleForecastPair,
  type CycleForecastPendingInput,
  type ManagedAccountForSimulation,
  type PaydayCycleAnchor,
  type SimulatedPurchase,
  type TransactionLike,
} from "@finance/shared";
import type { FinancialTransaction } from "./types.js";
import { buildCurrentCycleSummary } from "./aggregates.js";
import { loadActiveManagedAccountsForImpact } from "./managedAccounts.js";

function toTransactionLike(txs: FinancialTransaction[]): TransactionLike[] {
  return txs.map((tx) => ({
    date: tx.date,
    amount: tx.amount,
    accountType: tx.accountType,
    category: tx.category,
    description: tx.description,
    personName: tx.personName,
  }));
}

/**
 * Conta fixa paga no cartão cai no ciclo em que vence a fatura da cobrança, igual às
 * compras do cartão. Parcelamentos do cartão já guardam o vencimento da fatura.
 */
function moveCardRecurringToBillDueDate(
  account: ManagedAccountForSimulation,
  purchase: SimulatedPurchase,
  cards: CardForCycleBills[] | undefined,
): SimulatedPurchase {
  if (account.kind !== "fixed_recurring" || !account.cardAccountId || !cards) return purchase;
  const card = cards.find((c) => c.accountId === account.cardAccountId);
  if (!card) return purchase;
  return {
    ...purchase,
    installments: purchase.installments.map((inst) => ({
      ...inst,
      dueDate: cardChargeDueDateKey(card, { date: inst.dueDate }) ?? inst.dueDate,
    })),
  };
}

function managedAccountsToPurchasesWithKind(
  accounts: ManagedAccountForSimulation[],
  cards?: CardForCycleBills[],
): Array<SimulatedPurchase & { accountKind: string; paidByCard: boolean }> {
  const purchases: Array<SimulatedPurchase & { accountKind: string; paidByCard: boolean }> = [];
  for (const account of accounts) {
    const original = managedAccountToSimulatedPurchase(account);
    if (!original) continue;
    const purchase = moveCardRecurringToBillDueDate(account, original, cards);
    purchases.push({
      ...purchase,
      accountKind: account.kind,
      paidByCard:
        account.paidByCard === true ||
        purchase.paymentMethod === "credit_single" ||
        purchase.paymentMethod === "credit_installments",
    });
  }
  return purchases;
}

function mergeCreditBillPayments(
  pending: CycleForecastPendingInput,
  cards: CardForCycleBills[] | undefined,
  cycle: { from: string; to: string },
  today: string,
  txs: FinancialTransaction[],
): CycleForecastPendingInput {
  if (!cards || cards.length === 0) return pending;

  const billPayments = buildCycleStatementPayments(
    cards,
    cycle,
    today,
    txs.map((tx) => ({
      date: tx.date,
      amount: tx.amount,
      category: tx.category,
      description: tx.description,
      accountType: tx.accountType,
    })),
  );

  return {
    ...pending,
    creditBills: Math.round(((pending.creditBills ?? 0) + billPayments.total) * 100) / 100,
    items: [
      ...(pending.items ?? []),
      ...billPayments.items.map((item) => ({
        id: item.id,
        title: item.title,
        dueDate: item.dueDate,
        amount: item.amount,
        kind: "creditBills" as const,
        estimated: item.estimated,
      })),
    ],
  };
}

export async function buildDashboardCycleForecasts(
  txs: FinancialTransaction[],
  userId: string,
  paydayDay: number,
  paydayCycleAnchor: PaydayCycleAnchor,
  personId?: string,
  includeSimulations = true,
  creditCards?: CardForCycleBills[],
): Promise<CycleForecastPair> {
  txs = alignSalaryDatesToPayday(txs, paydayDay);
  const currentCycle = buildCurrentCycleSummary(txs, paydayDay, paydayCycleAnchor, 0);
  const today = todayDateKeyInTimeZone();
  const managedAccounts = await loadActiveManagedAccountsForImpact(userId, personId);
  const purchases = managedAccountsToPurchasesWithKind(managedAccounts, creditCards);
  const cycleTxs = creditCards ? toBillPaymentDates(txs, creditCards) : txs;

  const currentPending = mergeCreditBillPayments(
    splitPurchaseImpactsByKind(purchases, currentCycle, today),
    creditCards,
    currentCycle,
    today,
    txs,
  );
  const nextCycle = getNextPaydayCycle(currentCycle, paydayDay, paydayCycleAnchor);
  const nextPending = mergeCreditBillPayments(
    splitPurchaseImpactsByKind(purchases, nextCycle, today),
    creditCards,
    nextCycle,
    today,
    txs,
  );

  return buildCycleForecastPair({
    txs: toTransactionLike(cycleTxs),
    currentCycle,
    paydayDay,
    anchor: paydayCycleAnchor,
    today,
    currentPending,
    nextPending,
    includeSimulations,
  });
}

export async function buildCycleForecastForKey(
  txs: FinancialTransaction[],
  userId: string,
  cycleKey: string,
  paydayDay: number,
  paydayCycleAnchor: PaydayCycleAnchor,
  personId?: string,
  includeSimulations = true,
  creditCards?: CardForCycleBills[],
): Promise<CycleForecastBlock> {
  txs = alignSalaryDatesToPayday(txs, paydayDay);
  const meta = getPaydayCycleRangeByKey(cycleKey, paydayDay, paydayCycleAnchor);
  const today = todayDateKeyInTimeZone();
  const managedAccounts = await loadActiveManagedAccountsForImpact(userId, personId);
  const purchases = managedAccountsToPurchasesWithKind(managedAccounts, creditCards);
  const cycleTxs = creditCards ? toBillPaymentDates(txs, creditCards) : txs;
  const pending = mergeCreditBillPayments(
    splitPurchaseImpactsByKind(
      purchases,
      { cycleKey: meta.cycleKey, from: meta.from, to: meta.to },
      today,
    ),
    creditCards,
    { from: meta.from, to: meta.to },
    today,
    txs,
  );

  return buildCycleForecastBlock({
    txs: toTransactionLike(cycleTxs),
    cycle: {
      cycleKey: meta.cycleKey,
      from: meta.from,
      to: meta.to,
      isComplete: meta.isComplete,
    },
    paydayDay,
    anchor: paydayCycleAnchor,
    today,
    pending,
    includeSimulations,
  });
}
