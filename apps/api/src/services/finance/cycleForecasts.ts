import {
  buildCycleForecastBlock,
  buildCycleForecastPair,
  buildPendingBillPayments,
  getNextPaydayCycle,
  getPaydayCycleRangeByKey,
  managedAccountToSimulatedPurchase,
  splitPurchaseImpactsByKind,
  todayDateKeyInTimeZone,
  type CreditBillSnapshot,
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
  creditBillSnapshots: CreditBillSnapshot[] | undefined,
  cycle: { from: string; to: string },
  today: string,
  txs: FinancialTransaction[],
): CycleForecastPendingInput {
  if (!creditBillSnapshots || creditBillSnapshots.length === 0) return pending;

  const billPayments = buildPendingBillPayments(
    creditBillSnapshots,
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
    creditBills: billPayments.total,
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
  creditBillSnapshots?: CreditBillSnapshot[],
): Promise<CycleForecastPair> {
  const currentCycle = buildCurrentCycleSummary(txs, paydayDay, paydayCycleAnchor, 0);
  const today = todayDateKeyInTimeZone();
  const managedAccounts = await loadActiveManagedAccountsForImpact(userId, personId);
  const purchases = managedAccountsToPurchasesWithKind(managedAccounts);

  const currentPending = mergeCreditBillPayments(
    splitPurchaseImpactsByKind(purchases, currentCycle, today),
    creditBillSnapshots,
    currentCycle,
    today,
    txs,
  );
  const nextCycle = getNextPaydayCycle(currentCycle, paydayDay, paydayCycleAnchor);
  const nextPending = mergeCreditBillPayments(
    splitPurchaseImpactsByKind(purchases, nextCycle, today),
    creditBillSnapshots,
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
  creditBillSnapshots?: CreditBillSnapshot[],
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
    creditBillSnapshots,
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
