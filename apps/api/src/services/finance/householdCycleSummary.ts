import {
  aggregateHouseholdCycleSummary,
  buildNavigableCycles,
  cycleForecastToPersonSummary,
  getRecentPaydayCycles,
  isActiveInvestment,
  isCreditAccount,
  isInvestmentAccount,
  isPaydayDayConfigured,
  parsePaydayCycleAnchor,
  paydayCyclesToDateRange,
  resolveSelectedCycleKey,
  type CardForCycleBills,
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
import { buildCycleForecastForKey } from "./cycleForecasts.js";
import { loadCardsForCycleBills } from "./creditCardBills.js";
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

function computePersonCreditDebt(
  accounts: Array<{ balance: number; type: string | null }>,
): number {
  let total = 0;
  for (const acc of accounts) {
    if (!isCreditAccount(acc.type)) continue;
    total += Math.abs(acc.balance);
  }
  return total;
}

async function loadPersonInvestmentBalances(
  userId: string,
  personId?: string,
): Promise<Map<string, number>> {
  const rows = await prisma.investment.findMany({
    where: {
      connection: {
        person: {
          userId,
          ...(personId ? { id: personId } : {}),
        },
      },
    },
    select: {
      balance: true,
      status: true,
      connection: { select: { personId: true } },
    },
  });

  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!isActiveInvestment(row.status, row.balance)) continue;
    const id = row.connection.personId;
    totals.set(id, (totals.get(id) ?? 0) + row.balance);
  }
  return totals;
}

async function loadIncludeInvestmentsInNetWorth(userId: string): Promise<boolean> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { includeInvestmentsInNetWorth: true },
  });
  return user.includeInvestmentsInNetWorth;
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
    type: string | null;
    pluggyAccountId: string;
    billDueDay: number | null;
    billCloseDay: number | null;
    balanceDueDate: Date | null;
    balanceCloseDate: Date | null;
    creditBrand: string | null;
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
            type: acc.type,
            pluggyAccountId: acc.pluggyAccountId,
            billDueDay: acc.billDueDay,
            billCloseDay: acc.billCloseDay,
            balanceDueDate: acc.balanceDueDate,
            balanceCloseDate: acc.balanceCloseDate,
            creditBrand: acc.creditBrand,
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
  creditCards: CardForCycleBills[],
  balances: {
    creditDebt: number;
    investmentBalance: number;
    includeInvestments: boolean;
  },
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
    creditCards,
  );

  return cycleForecastToPersonSummary(
    config.personId,
    config.personName,
    bankBalance,
    forecast,
    balances,
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

  const [
    { accounts, financialTransactions, personConfigs, people, creditAccountsRaw },
    includeInvestments,
    investmentBalances,
  ] = await Promise.all([
    loadFinancialData(userId, personId, paydayDay!, paydayCycleAnchor),
    loadIncludeInvestmentsInNetWorth(userId),
    loadPersonInvestmentBalances(userId, personId),
  ]);

  const allCreditCards = await loadCardsForCycleBills(
    creditAccountsRaw,
    financialTransactions,
  );

  const navigableCycles = buildNavigableCycles(paydayDay!, paydayCycleAnchor);
  const selectedCycleKey = resolveSelectedCycleKey(navigableCycles, requestedCycleKey);
  const selectedMeta = navigableCycles.find((c) => c.cycleKey === selectedCycleKey)!;
  const householdAligned = personId ? true : isHouseholdPaydayAligned(personConfigs);

  const personSummaries: PersonCycleSummary[] = [];
  for (const person of people) {
    const config = personConfigs.find((c) => c.personId === person.id)!;
    const personAccounts = person.connections.flatMap((c) => c.accounts);
    const bankBalance = computePersonBankBalance(personAccounts);
    const creditDebt = computePersonCreditDebt(personAccounts);
    const investmentBalance = investmentBalances.get(person.id) ?? 0;
    const personCreditIds = new Set(
      creditAccountsRaw.filter((a) => a.personId === person.id).map((a) => a.id),
    );
    const personCards = allCreditCards.filter((card) =>
      personCreditIds.has(card.accountId),
    );

    const summary = await buildPersonSummary(
      userId,
      config,
      selectedCycleKey,
      navigableCycles,
      financialTransactions,
      bankBalance,
      personCards,
      {
        creditDebt,
        investmentBalance,
        includeInvestments,
      },
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
