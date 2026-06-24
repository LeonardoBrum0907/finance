/**
 * Corretoras costumam expor carteira mais completa que bancos (ex.: Itaú vs Íon).
 * Quando há corretora conectada, investimentos do banco são ignorados na agregação.
 */

const BROKER_NAME_PATTERNS = [
  /\bion\b/i,
  /\bxp\b/i,
  /\brico\b/i,
  /\bclear\b/i,
  /\bbtg\b/i,
  /\bavenue\b/i,
  /\bgenial\b/i,
  /\bmodal\b/i,
  /\btoro\b/i,
  /\bwarren\b/i,
  /\beasynvest\b/i,
  /\binter\s*invest/i,
  /\bnubank\s*invest/i,
  /\bc6\s*invest/i,
  /\borama\b/i,
  /\bitau\s*ion\b/i,
  /\bion\s*itau\b/i,
];

export function isBrokerConnector(connectorName: string | null | undefined): boolean {
  if (!connectorName?.trim()) return false;
  const normalized = connectorName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (BROKER_NAME_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  return /\bcorretora\b/.test(normalized);
}

export interface ConnectionWithInvestments {
  id: string;
  connectorName: string | null;
  /** Quantidade de contas bancárias/cartão na conexão (0 = item só de investimentos). */
  accountCount?: number;
  investments: { id: string }[];
}

export interface InvestmentLikeForDedup {
  code: string | null;
  isin?: string | null;
  name: string;
  type: string | null;
}

export function investmentDedupKey(inv: InvestmentLikeForDedup): string {
  if (inv.code?.trim()) return `code:${inv.code.trim().toUpperCase()}`;
  if (inv.isin?.trim()) return `isin:${inv.isin.trim().toUpperCase()}`;
  const name = inv.name.trim().toLowerCase();
  const type = (inv.type ?? "").toUpperCase();
  return `fallback:${name}|${type}`;
}

export interface InvestmentSourceMeta {
  connectorName: string | null;
  accountCount: number;
  lastSyncedAt?: Date | string | null;
}

/** Maior score = fonte preferida (corretora > item só investimentos > banco). */
export function scoreInvestmentSource(meta: InvestmentSourceMeta): number {
  let score = 0;
  if (isBrokerConnector(meta.connectorName)) score += 100;
  if (meta.accountCount === 0) score += 50;
  if (meta.lastSyncedAt) {
    const ts =
      typeof meta.lastSyncedAt === "string"
        ? new Date(meta.lastSyncedAt).getTime()
        : meta.lastSyncedAt.getTime();
    if (!Number.isNaN(ts)) score += ts / 1e15;
  }
  return score;
}

/** Conexões usadas para carteira, alocação e patrimônio de investimentos. */
export function selectConnectionsForInvestments<T extends ConnectionWithInvestments>(
  connections: T[],
): T[] {
  const withInvestments = connections.filter((c) => c.investments.length > 0);
  if (withInvestments.length === 0) return [];

  const brokers = withInvestments.filter((c) => isBrokerConnector(c.connectorName));
  if (brokers.length > 0) return brokers;

  const investmentOnly = withInvestments.filter((c) => (c.accountCount ?? 0) === 0);
  const bankWithInvestments = withInvestments.filter((c) => (c.accountCount ?? 0) > 0);

  if (investmentOnly.length > 0 && bankWithInvestments.length > 0) {
    return investmentOnly;
  }

  return withInvestments;
}

export function resolveInvestmentSourceLabel(
  connections: { connectorName: string | null }[],
): string | null {
  const names = [
    ...new Set(
      connections
        .map((c) => c.connectorName?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  if (names.length === 0) return null;
  return names.join(", ");
}
