import {
  computeInvestmentAllocation,
  computePeriodInvestmentProfit,
  computePositionProfit,
  getInvestmentPositionStaleDays,
  investmentDedupKey,
  isActiveInvestment,
  isDisplayableInvestment,
  isStaleInvestmentPosition,
  resolveInvestmentPositionReferenceDate,
  resolveInvestmentSourceLabel,
  scoreInvestmentSource,
  selectConnectionsForInvestments,
  summarizeInvestmentPortfolio,
  translateInvestmentSubtype,
  translateInvestmentStatus,
  translateInvestmentType,
} from "@finance/shared";
import { monthKeysToDateRange, getRecentMonthKeys } from "./aggregates.js";

type InvestmentRecord = {
  id: string;
  name: string;
  type: string | null;
  subtype: string | null;
  code: string | null;
  isin: string | null;
  status: string;
  balance: number;
  amount: number | null;
  amountOriginal: number | null;
  amountProfit: number | null;
  annualRate: number | null;
  lastTwelveMonthsRate: number | null;
  dueDate: Date | null;
  purchaseDate: Date | null;
  positionDate: Date | null;
  transactions: {
    date: Date;
    type: string | null;
    amount: number;
    netAmount: number | null;
  }[];
};

type ConnectionRecord = {
  id: string;
  connectorName: string | null;
  lastSyncedAt: Date | null;
  accountCount: number;
  investments: InvestmentRecord[];
};

type PersonRecord = {
  id: string;
  name: string;
  connections: ConnectionRecord[];
};

type InvestmentCandidate = {
  inv: InvestmentRecord;
  conn: ConnectionRecord;
  person: PersonRecord;
};

export function serializeInvestmentPosition(
  inv: InvestmentRecord,
  person: { id: string; name: string },
  connectorName: string | null,
  lastSyncedAt: Date | null,
) {
  const lastTxDate =
    inv.transactions.length > 0
      ? inv.transactions.reduce(
          (latest, tx) => (tx.date > latest ? tx.date : latest),
          inv.transactions[0]!.date,
        )
      : null;
  const referenceDateKey = resolveInvestmentPositionReferenceDate(
    inv.positionDate,
    lastTxDate,
  );
  const staleDays = getInvestmentPositionStaleDays(referenceDateKey, lastSyncedAt);
  const isStale = isStaleInvestmentPosition(inv.positionDate, lastSyncedAt, lastTxDate);

  return {
    id: inv.id,
    name: inv.name,
    type: inv.type,
    subtype: inv.subtype,
    typeLabel: translateInvestmentType(inv.type),
    subtypeLabel: translateInvestmentSubtype(inv.subtype),
    code: inv.code,
    status: inv.status,
    statusLabel: translateInvestmentStatus(inv.status),
    balance: inv.balance,
    amount: inv.amount,
    amountOriginal: inv.amountOriginal,
    profit: computePositionProfit(inv),
    annualRate: inv.annualRate,
    lastTwelveMonthsRate: inv.lastTwelveMonthsRate,
    dueDate: inv.dueDate?.toISOString() ?? null,
    purchaseDate: inv.purchaseDate?.toISOString() ?? null,
    positionDate: inv.positionDate?.toISOString() ?? null,
    referenceDate: referenceDateKey,
    isStale,
    staleDays,
    personId: person.id,
    personName: person.name,
    connectorName,
  };
}

function latestSyncAt(connections: { lastSyncedAt: Date | null }[]): string | null {
  let latest: Date | null = null;
  for (const conn of connections) {
    if (conn.lastSyncedAt && (!latest || conn.lastSyncedAt > latest)) {
      latest = conn.lastSyncedAt;
    }
  }
  return latest?.toISOString() ?? null;
}

function pickWinningCandidates(candidates: InvestmentCandidate[]): InvestmentCandidate[] {
  const winners = new Map<string, InvestmentCandidate>();

  for (const candidate of candidates) {
    if (!isDisplayableInvestment(candidate.inv)) continue;

    const key = investmentDedupKey(candidate.inv);
    const existing = winners.get(key);
    if (!existing) {
      winners.set(key, candidate);
      continue;
    }

    const newScore = scoreInvestmentSource({
      connectorName: candidate.conn.connectorName,
      accountCount: candidate.conn.accountCount,
      lastSyncedAt: candidate.conn.lastSyncedAt,
    });
    const oldScore = scoreInvestmentSource({
      connectorName: existing.conn.connectorName,
      accountCount: existing.conn.accountCount,
      lastSyncedAt: existing.conn.lastSyncedAt,
    });

    if (newScore > oldScore) {
      winners.set(key, candidate);
    }
  }

  return [...winners.values()];
}

export function collectInvestmentPortfolio(people: PersonRecord[]) {
  const positions: ReturnType<typeof serializeInvestmentPosition>[] = [];
  const sourceConnections = new Map<string, ConnectionRecord>();
  const perPersonMap = new Map<
    string,
    { personId: string; personName: string; totalBalance: number }
  >();
  const profitTxs: { date: Date; type: string | null; amount: number; netAmount: number | null }[] =
    [];
  let investmentBalance = 0;

  for (const person of people) {
    const eligibleConnections = selectConnectionsForInvestments(
      person.connections.map((conn) => ({
        ...conn,
        accountCount: conn.accountCount,
      })),
    );
    const eligibleIds = new Set(eligibleConnections.map((conn) => conn.id));

    const candidates: InvestmentCandidate[] = [];
    for (const conn of person.connections) {
      if (!eligibleIds.has(conn.id)) continue;
      for (const inv of conn.investments) {
        candidates.push({ inv, conn, person });
      }
    }

    const winners = pickWinningCandidates(candidates);
    let personBalance = 0;

    for (const { inv, conn, person: p } of winners) {
      sourceConnections.set(conn.id, conn);

      for (const tx of inv.transactions) {
        profitTxs.push({
          date: tx.date,
          type: tx.type,
          amount: tx.amount,
          netAmount: tx.netAmount,
        });
      }

      positions.push(serializeInvestmentPosition(inv, p, conn.connectorName, conn.lastSyncedAt));
      if (isActiveInvestment(inv.status, inv.balance)) {
        personBalance += inv.balance;
        investmentBalance += inv.balance;
      }
    }

    perPersonMap.set(person.id, {
      personId: person.id,
      personName: person.name,
      totalBalance: personBalance,
    });
  }

  const connections = [...sourceConnections.values()];

  return {
    positions,
    sourceConnections: connections,
    investmentBalance,
    profitTxs,
    perPerson: [...perPersonMap.values()],
    investmentSource: resolveInvestmentSourceLabel(connections),
    lastSyncedAt: latestSyncAt(connections),
  };
}

export function buildInvestmentDashboardMetrics(
  positions: ReturnType<typeof serializeInvestmentPosition>[],
  profitTxs: { date: Date; type: string | null; amount: number; netAmount: number | null }[],
  months: number,
) {
  const portfolio = summarizeInvestmentPortfolio(
    positions.map((p) => ({
      status: p.status,
      balance: p.balance,
      amountOriginal: p.amountOriginal,
      amountProfit: p.profit,
      type: p.type,
    })),
  );
  const stalePositionCount = positions.filter((p) => p.isStale).length;

  const currentMonthKeys = getRecentMonthKeys(months, 0);
  const previousMonthKeys = getRecentMonthKeys(months, months);
  const currentRange = monthKeysToDateRange(currentMonthKeys);
  const previousRange = monthKeysToDateRange(previousMonthKeys);

  return {
    ...portfolio,
    stalePositionCount,
    periodProfit: computePeriodInvestmentProfit(profitTxs, currentRange),
    previousPeriodProfit: computePeriodInvestmentProfit(profitTxs, previousRange),
  };
}

export function buildInvestmentAllocation(
  positions: ReturnType<typeof serializeInvestmentPosition>[],
) {
  return computeInvestmentAllocation(
    positions.map((p) => ({
      status: p.status,
      balance: p.balance,
      amountOriginal: p.amountOriginal,
      amountProfit: p.profit,
      type: p.type,
    })),
  );
}
