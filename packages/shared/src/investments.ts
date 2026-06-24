export interface InvestmentPositionLike {
  status: string | null;
  balance: number;
  amountOriginal: number | null;
  amountProfit: number | null;
  type: string | null;
}

export interface InvestmentTransactionLike {
  date: Date | string;
  type: string | null;
  amount: number;
  netAmount: number | null;
}

const TYPE_LABELS: Record<string, string> = {
  FIXED_INCOME: "Renda fixa",
  MUTUAL_FUND: "Fundos",
  EQUITY: "Ações e FIIs",
  ETF: "ETF",
  SECURITY: "Previdência",
  COE: "COE",
  OTHER: "Outros",
};

const SUBTYPE_LABELS: Record<string, string> = {
  TREASURY: "Tesouro Direto",
  CDB: "CDB",
  LCI: "LCI",
  LCA: "LCA",
  CRI: "CRI",
  CRA: "CRA",
  DEBENTURES: "Debêntures",
  STOCK: "Ações",
  BDR: "BDR",
  REAL_ESTATE_FUND: "FII",
  ETF: "ETF",
  MULTIMARKET_FUND: "Fundo multimercado",
  FIXED_INCOME_FUND: "Fundo renda fixa",
  STOCK_FUND: "Fundo de ações",
  INVESTMENT_FUND: "Fundo de investimento",
  RETIREMENT: "Previdência",
  STRUCTURED_NOTE: "COE",
};

export function translateInvestmentType(type: string | null | undefined): string {
  if (!type) return "Outros";
  return TYPE_LABELS[type] ?? type;
}

export function translateInvestmentSubtype(subtype: string | null | undefined): string {
  if (!subtype) return "";
  return SUBTYPE_LABELS[subtype] ?? subtype;
}

/** Saldo abaixo disso é tratado como posição zerada (resgatada). */
export const INVESTMENT_BALANCE_EPSILON = 0.01;

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  PENDING: "Pendente",
  TOTAL_WITHDRAWAL: "Resgatada",
};

export function translateInvestmentStatus(status: string | null | undefined): string {
  if (!status) return STATUS_LABELS.ACTIVE;
  return STATUS_LABELS[status.toUpperCase()] ?? status;
}

export function isWithdrawnInvestment(status: string | null | undefined): boolean {
  return (status ?? "").toUpperCase() === "TOTAL_WITHDRAWAL";
}

export function hasMeaningfulInvestmentBalance(balance: number): boolean {
  return Math.abs(balance) > INVESTMENT_BALANCE_EPSILON;
}

export function isActiveInvestment(
  status: string | null | undefined,
  balance?: number,
): boolean {
  if (isWithdrawnInvestment(status)) return false;
  if (balance != null && !hasMeaningfulInvestmentBalance(balance)) return false;
  return (status ?? "ACTIVE").toUpperCase() === "ACTIVE";
}

/** Posições visíveis na carteira (exclui resgatadas e saldo ~zero). */
export function isDisplayableInvestment(position: InvestmentPositionLike): boolean {
  if (isWithdrawnInvestment(position.status)) return false;
  if (!hasMeaningfulInvestmentBalance(position.balance)) return false;
  const normalized = (position.status ?? "ACTIVE").toUpperCase();
  return normalized === "ACTIVE" || normalized === "PENDING";
}

export function computePositionProfit(position: InvestmentPositionLike): number {
  if (position.amountProfit != null) return position.amountProfit;
  if (position.amountOriginal != null) return position.balance - position.amountOriginal;
  return 0;
}

export function summarizeInvestmentPortfolio(positions: InvestmentPositionLike[]): {
  totalBalance: number;
  unrealizedProfit: number;
  positionCount: number;
} {
  const active = positions.filter(
    (p) => isActiveInvestment(p.status, p.balance),
  );
  let totalBalance = 0;
  let unrealizedProfit = 0;
  for (const p of active) {
    totalBalance += p.balance;
    unrealizedProfit += computePositionProfit(p);
  }
  return { totalBalance, unrealizedProfit, positionCount: active.length };
}

export function computePeriodInvestmentProfit(
  transactions: InvestmentTransactionLike[],
  range: { from?: string; to?: string },
): number | null {
  if (transactions.length === 0) return null;

  let total = 0;
  let hasData = false;

  for (const tx of transactions) {
    const key =
      typeof tx.date === "string"
        ? tx.date.slice(0, 10)
        : tx.date.toISOString().slice(0, 10);
    if (range.from && key < range.from) continue;
    if (range.to && key > range.to) continue;

    const txType = (tx.type ?? "").toUpperCase();
    if (txType === "SELL") {
      if (tx.netAmount != null) {
        total += tx.netAmount - tx.amount;
        hasData = true;
      }
    } else if (txType === "BUY") {
      hasData = true;
      total -= tx.amount;
    }
  }

  return hasData ? total : null;
}

export interface InvestmentAllocationPoint {
  type: string;
  label: string;
  total: number;
  percent: number;
}

/** Dias sem atualização da posição na instituição após a última sync. */
export const INVESTMENT_POSITION_STALE_DAYS = 30;

function toDateKey(date: Date | string): string {
  return typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
}

/** Data de referência da posição: snapshot da instituição ou última movimentação. */
export function resolveInvestmentPositionReferenceDate(
  positionDate: Date | string | null | undefined,
  lastTransactionDate: Date | string | null | undefined,
): string | null {
  const keys: string[] = [];
  if (positionDate) keys.push(toDateKey(positionDate));
  if (lastTransactionDate) keys.push(toDateKey(lastTransactionDate));
  if (keys.length === 0) return null;
  return keys.sort().at(-1) ?? null;
}

export function getInvestmentPositionStaleDays(
  referenceDate: Date | string | null | undefined,
  lastSyncedAt: Date | string | null | undefined,
): number | null {
  if (!referenceDate || !lastSyncedAt) return null;
  const ref = new Date(toDateKey(referenceDate));
  const sync = new Date(
    typeof lastSyncedAt === "string" ? lastSyncedAt : lastSyncedAt.toISOString(),
  );
  if (Number.isNaN(ref.getTime()) || Number.isNaN(sync.getTime())) return null;
  const diffDays = Math.floor((sync.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : null;
}

export function isStaleInvestmentPosition(
  positionDate: Date | string | null | undefined,
  lastSyncedAt: Date | string | null | undefined,
  lastTransactionDate?: Date | string | null | undefined,
  staleAfterDays = INVESTMENT_POSITION_STALE_DAYS,
): boolean {
  const referenceDate = resolveInvestmentPositionReferenceDate(
    positionDate,
    lastTransactionDate,
  );
  const staleDays = getInvestmentPositionStaleDays(referenceDate, lastSyncedAt);
  return staleDays != null && staleDays > staleAfterDays;
}

export function computeInvestmentAllocation(
  positions: (InvestmentPositionLike & { type: string | null })[],
): InvestmentAllocationPoint[] {
  const active = positions.filter(
    (p) => isActiveInvestment(p.status, p.balance),
  );
  const map = new Map<string, number>();

  for (const p of active) {
    const type = p.type ?? "OTHER";
    map.set(type, (map.get(type) ?? 0) + p.balance);
  }

  const total = [...map.values()].reduce((s, v) => s + v, 0);
  return [...map.entries()]
    .map(([type, balance]) => ({
      type,
      label: translateInvestmentType(type),
      total: balance,
      percent: total > 0 ? (balance / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
