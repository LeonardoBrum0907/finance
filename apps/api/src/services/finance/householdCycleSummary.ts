import {
  aggregateHouseholdCycleSummary,
  buildCreditBillSnapshot,
  buildNavigableCycles,
  cycleForecastToPersonSummary,
  getRecentPaydayCycles,
  isCreditAccount,
  isInvestmentAccount,
  isPaydayDayConfigured,
  parsePaydayCycleAnchor,
  paydayCyclesToDateRange,
  resolveSelectedCycleKey,
  type CreditBillSnapshot,
  type DashboardCycleSummaryResponse,
  type HouseholdCycleSummary,
  type NavigableCycle,
  type PaydayCycleAnchor,
  type PersonCycleSummary,
} from "@finance/shared";
import { prisma } from "../../prisma.js";
import { effectiveTransactionCategory } from "../transactionCategory.js";
import { serializeAccount } from "../serializeAccount.js";
import { resolvePaydayCycle } from "../userSettings.js";
import { getPluggyClient } from "../pluggy.js";
import { isPluggyConfigured } from "../../env.js";
import { pickLatestClosedBill } from "./creditBillSync.js";
import { buildCycleForecastForKey } from "./cycleForecasts.js";
import type { FinancialTransaction } from "./types.js";

interface PersonPaydayConfig {
  personId: string;
  personName: string;
  paydayDay: number | null;
  paydayCycleAnchor: PaydayCycleAnchor;
}

function computePersonBankBalance(
  accounts: Array<{ balance: number; type: string | null }>,
): number {
  let total = 0;
  for (const acc of accounts) {
    if (isCreditAccount(acc.type) || isInvestmentAccount(acc.type)) continue;
    total += acc.balance;
  }
  return total;
}

async function loadCreditBillSnapshots(
  creditAccounts: Array<{
    id: string;
    name: string;
    balance: number;
    type: string | null;
    pluggyAccountId: string;
    balanceDueDate: Date | null;
  }>,
): Promise<CreditBillSnapshot[]> {
  if (creditAccounts.length === 0) return [];

  const pluggy = isPluggyConfigured() ? getPluggyClient() : null;
  const closedBillCache = new Map<string, { totalAmount: number; dueDate: Date } | null>();

  async function loadClosedBill(pluggyAccountId: string) {
    if (closedBillCache.has(pluggyAccountId)) {
      return closedBillCache.get(pluggyAccountId) ?? null;
    }
    if (!pluggy) {
      closedBillCache.set(pluggyAccountId, null);
      return null;
    }
    try {
      const bills = await pluggy.fetchCreditCardBills(pluggyAccountId);
      const closed = pickLatestClosedBill(bills.results ?? []);
      const value = closed
        ? { totalAmount: closed.totalAmount, dueDate: new Date(closed.dueDate) }
        : null;
      closedBillCache.set(pluggyAccountId, value);
      return value;
    } catch {
      closedBillCache.set(pluggyAccountId, null);
      return null;
    }
  }

  const snapshots: CreditBillSnapshot[] = [];
  for (const acc of creditAccounts) {
    if (!isCreditAccount(acc.type)) continue;
    const closedBill = await loadClosedBill(acc.pluggyAccountId);
    snapshots.push(
      buildCreditBillSnapshot({
        accountId: acc.id,
        accountName: acc.name,
        balance: acc.balance,
        balanceDueDate: acc.balanceDueDate,
        closedBill,
      }),
    );
  }
  return snapshots;
}

async function loadFinancialData(
  userId: string,
  personId: string | undefined,
  paydayDay: number,
  paydayCycleAnchor: PaydayCycleAnchor,
) {
  const fetchRange = paydayCyclesToDateRange(
    getRecentPaydayCycles(8, paydayDay, 0, paydayCycleAnchor),
    paydayDay,
    paydayCycleAnchor,
  );
  const dateFrom = fetchRange.from
    ? new Date(`${fetchRange.from}T00:00:00.000Z`)
    : new Date(0);

  const people = await prisma.person.findMany({
    where: {
      userId,
      ...(personId ? { id: personId } : {}),
    },
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

  const accounts: DashboardCycleSummaryResponse["accounts"] = [];
  const financialTransactions: FinancialTransaction[] = [];
  const personConfigs: PersonPaydayConfig[] = [];
  const creditAccountsRaw: Array<{
    id: string;
    name: string;
    balance: number;
    type: string | null;
    pluggyAccountId: string;
    balanceDueDate: Date | null;
    personId: string;
  }> = [];

  for (const person of people) {
    const personPayday = isPaydayDayConfigured(person.paydayDay)
      ? person.paydayDay
      : null;
    personConfigs.push({
      personId: person.id,
      personName: person.name,
      paydayDay: personPayday,
      paydayCycleAnchor: parsePaydayCycleAnchor(person.paydayCycleAnchor),
    });

    for (const connection of person.connections) {
      for (const acc of connection.accounts) {
        accounts.push({
          ...serializeAccount(acc),
          personName: person.name,
        });
        if (isCreditAccount(acc.type)) {
          creditAccountsRaw.push({
            id: acc.id,
            name: acc.name,
            balance: acc.balance,
            type: acc.type,
            pluggyAccountId: acc.pluggyAccountId,
            balanceDueDate: acc.balanceDueDate,
            personId: person.id,
          });
        }
        for (const tx of acc.transactions) {
          financialTransactions.push({
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
          });
        }
      }
    }
  }

  return {
    accounts,
    financialTransactions,
    personConfigs,
    people,
    creditAccountsRaw,
  };
}

function isHouseholdPaydayAligned(configs: PersonPaydayConfig[]): boolean {
  const configured = configs.filter((c) => isPaydayDayConfigured(c.paydayDay));
  if (configured.length === 0) return false;
  const uniqueDays = new Set(configured.map((c) => c.paydayDay));
  const uniqueAnchors = new Set(configured.map((c) => c.paydayCycleAnchor));
  return uniqueDays.size === 1 && uniqueAnchors.size === 1;
}

async function buildPersonSummary(
  userId: string,
  config: PersonPaydayConfig,
  cycleKey: string,
  navigableCycles: NavigableCycle[],
  allTxs: FinancialTransaction[],
  bankBalance: number,
  creditBillSnapshots: CreditBillSnapshot[],
): Promise<PersonCycleSummary | null> {
  const paydayDay = config.paydayDay;
  if (!isPaydayDayConfigured(paydayDay)) return null;

  const personTxs = allTxs.filter((tx) => tx.personId === config.personId);
  const selectedMeta = navigableCycles.find((c) => c.cycleKey === cycleKey);
  const effectiveKey = selectedMeta?.cycleKey ?? cycleKey;

  const forecast = await buildCycleForecastForKey(
    personTxs,
    userId,
    effectiveKey,
    paydayDay!,
    config.paydayCycleAnchor,
    config.personId,
    true,
    creditBillSnapshots,
  );

  return cycleForecastToPersonSummary(
    config.personId,
    config.personName,
    bankBalance,
    forecast,
  );
}

export async function buildDashboardCycleSummary(
  userId: string,
  options: { personId?: string; cycleKey?: string } = {},
): Promise<DashboardCycleSummaryResponse> {
  const { personId, cycleKey: requestedCycleKey } = options;
  const { paydayDay, paydayCycleAnchor } = await resolvePaydayCycle(userId, personId);

  if (!isPaydayDayConfigured(paydayDay)) {
    const people = await prisma.person.findMany({
      where: { userId, ...(personId ? { id: personId } : {}) },
      select: { id: true, name: true },
    });
    return {
      currencyCode: "BRL",
      paydayDay: null,
      paydayCycleAnchor,
      paydayConfigured: false,
      householdPaydayAligned: false,
      selectedCycleKey: "",
      navigableCycles: [],
      household: null,
      accounts: people.length
        ? (
            await loadFinancialData(userId, personId, 1, paydayCycleAnchor)
          ).accounts
        : [],
    };
  }

  const { accounts, financialTransactions, personConfigs, people, creditAccountsRaw } =
    await loadFinancialData(userId, personId, paydayDay!, paydayCycleAnchor);

  const allCreditBillSnapshots = await loadCreditBillSnapshots(creditAccountsRaw);

  const navigableCycles = buildNavigableCycles(paydayDay!, paydayCycleAnchor);
  const selectedCycleKey = resolveSelectedCycleKey(navigableCycles, requestedCycleKey);
  const selectedMeta = navigableCycles.find((c) => c.cycleKey === selectedCycleKey)!;
  const householdAligned = personId ? true : isHouseholdPaydayAligned(personConfigs);

  const personSummaries: PersonCycleSummary[] = [];
  for (const person of people) {
    const config = personConfigs.find((c) => c.personId === person.id)!;
    const personAccounts = person.connections.flatMap((c) => c.accounts);
    const bankBalance = computePersonBankBalance(personAccounts);
    const personCreditIds = new Set(
      creditAccountsRaw.filter((a) => a.personId === person.id).map((a) => a.id),
    );
    const personBillSnapshots = allCreditBillSnapshots.filter((s) =>
      personCreditIds.has(s.accountId),
    );

    const summary = await buildPersonSummary(
      userId,
      config,
      selectedCycleKey,
      navigableCycles,
      financialTransactions,
      bankBalance,
      personBillSnapshots,
    );
    if (summary) personSummaries.push(summary);
  }

  let household: HouseholdCycleSummary | null = null;
  if (householdAligned && personSummaries.length > 0) {
    household = aggregateHouseholdCycleSummary(
      {
        cycleKey: selectedMeta.cycleKey,
        from: selectedMeta.from,
        to: selectedMeta.to,
        isComplete: selectedMeta.isComplete,
        isFuture: selectedMeta.isFuture,
      },
      personSummaries,
    );
  } else if (personSummaries.length === 1) {
    household = aggregateHouseholdCycleSummary(
      {
        cycleKey: selectedMeta.cycleKey,
        from: selectedMeta.from,
        to: selectedMeta.to,
        isComplete: selectedMeta.isComplete,
        isFuture: selectedMeta.isFuture,
      },
      personSummaries,
    );
  } else if (personSummaries.length > 1) {
    household = {
      ...aggregateHouseholdCycleSummary(
        {
          cycleKey: selectedMeta.cycleKey,
          from: selectedMeta.from,
          to: selectedMeta.to,
          isComplete: selectedMeta.isComplete,
          isFuture: selectedMeta.isFuture,
        },
        personSummaries,
      ),
    };
  }

  return {
    currencyCode: "BRL",
    paydayDay,
    paydayCycleAnchor,
    paydayConfigured: true,
    householdPaydayAligned: householdAligned,
    selectedCycleKey,
    navigableCycles,
    household,
    accounts,
  };
}
