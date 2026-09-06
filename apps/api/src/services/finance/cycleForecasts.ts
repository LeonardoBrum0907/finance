import {
  buildCycleForecastBlock,
  buildCycleForecastPair,
  buildCycleStatementPayments,
  getNextPaydayCycle,
  getPaydayCycleRangeByKey,
  managedAccountToSimulatedPurchase,
  splitPurchaseImpactsByKind,
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

function managedAccountsToPurchasesWithKind(
  accounts: ManagedAccountForSimulation[],
): Array<SimulatedPurchase & { accountKind: string }> {
  const purchases: Array<SimulatedPurchase & { accountKind: string }> = [];
  for (const account of accounts) {
    const purchase = managedAccountToSimulatedPurchase(account);
    if (!purchase) continue;
    purchases.push({ ...purchase, accountKind: account.kind });
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
  const currentCycle = buildCurrentCycleSummary(txs, paydayDay, paydayCycleAnchor, 0);
  const today = todayDateKeyInTimeZone();
  const managedAccounts = await loadActiveManagedAccountsForImpact(userId, personId);
  const purchases = managedAccountsToPurchasesWithKind(managedAccounts);

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
    txs: toTransactionLike(txs),
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
  const meta = getPaydayCycleRangeByKey(cycleKey, paydayDay, paydayCycleAnchor);
  const today = todayDateKeyInTimeZone();
  const managedAccounts = await loadActiveManagedAccountsForImpact(userId, personId);
  const purchases = managedAccountsToPurchasesWithKind(managedAccounts);
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
    txs: toTransactionLike(txs),
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
