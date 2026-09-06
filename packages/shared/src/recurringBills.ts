import { z } from "zod";
import type { SimulatedPurchase } from "./simulation.js";
import { todayDateKeyInTimeZone } from "./simulation.js";
import {
  groupCategoryForDashboard,
  type DashboardCategoryGroup,
} from "./categoryGroups.js";
import {
  isCreditAccount,
  isCreditCardBillPayment,
  isSamePersonTransfer,
  isTransactionOutflow,
} from "./transactions.js";

export const RECURRING_BILL_STATUSES = ["active", "inactive", "dismissed"] as const;
export type RecurringBillStatus = (typeof RECURRING_BILL_STATUSES)[number];

export const RECURRING_BILL_SOURCES = ["auto_detected", "manual"] as const;
export type RecurringBillSource = (typeof RECURRING_BILL_SOURCES)[number];

export const OCCURRENCE_STATUSES = ["pending", "paid", "skipped"] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

export interface RecurringBillOccurrenceDTO {
  id: string;
  cycleKey: string;
  dueDate: string;
  amount: number;
  status: OccurrenceStatus;
  transactionId: string | null;
  paidAt: string | null;
}

export interface RecurringBillDTO {
  id: string;
  title: string;
  payeeName: string | null;
  matchSignature: string;
  category: string | null;
  expectedAmount: number;
  dayOfMonth: number;
  status: RecurringBillStatus;
  source: RecurringBillSource;
  personId: string | null;
  personName: string | null;
  accountId: string | null;
  accountName: string | null;
  lastOccurrenceDate: string | null;
  nextDueDate: string | null;
  currentCycleStatus: OccurrenceStatus | null;
  pendingCount: number;
  paidCount: number;
  occurrences: RecurringBillOccurrenceDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface DetectRecurringBillsResponse {
  detected: number;
  matched: number;
  dismissed?: number;
  deactivated?: number;
  bills: RecurringBillDTO[];
}

/** Ciclos mensais sem cobrança antes de marcar conta fixa auto-detectada como inativa. */
export const STALE_RECURRING_BILL_MISSED_CYCLES = 2;

export const updateRecurringBillSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  payeeName: z.string().max(120).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  personId: z.string().cuid().nullable().optional(),
  status: z.enum(RECURRING_BILL_STATUSES).optional(),
  expectedAmount: z.number().positive().optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
});

export type UpdateRecurringBillInput = z.infer<typeof updateRecurringBillSchema>;

export interface RecurringPatternTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  merchantName?: string | null;
  category?: string | null;
  accountId: string;
  accountType?: string | null;
  personId?: string;
  personName?: string | null;
}

export interface RecurringPatternCandidate {
  matchSignature: string;
  title: string;
  payeeName: string | null;
  category: string | null;
  expectedAmount: number;
  dayOfMonth: number;
  accountId: string;
  personId: string;
  transactions: RecurringPatternTransaction[];
}

const DEFAULT_AMOUNT_TOLERANCE_RATIO = 0.15;
const DEFAULT_AMOUNT_TOLERANCE_MIN = 5;
const MIN_INTERVAL_DAYS = 25;
const MAX_INTERVAL_DAYS = 35;
const MIN_OCCURRENCES = 2;
const MIN_OCCURRENCES_FOR_DISCRETIONARY = 3;
const MIN_OCCURRENCES_FOR_DONATIONS = 3;
const NOISY_PAYEE_MIN_TXS = 4;
const NOISY_PAYEE_MIN_CHAIN_RATIO = 0.5;

const RECURRING_FRIENDLY_GROUPS = new Set<DashboardCategoryGroup>([
  "Assinaturas",
  "Contas fixas",
  "Serviços",
]);

const DONATION_GROUPS = new Set<DashboardCategoryGroup>(["Igreja", "Doações"]);

const DISCRETIONARY_GROUPS = new Set<DashboardCategoryGroup>([
  "Alimentação",
  "Compras",
  "Transporte",
]);

const EXCLUDED_CATEGORY_GROUPS = new Set<DashboardCategoryGroup>([
  "Transferências",
  "Tarifas e impostos",
]);

const EXCLUDED_DESCRIPTION_MARKERS = [
  "pagamento de fatura",
  "fatura paga",
  "pagamento com saldo",
  "saque",
  "iof",
  "juros de mora",
  "juros de d",
  "mensalidade - plano do cart",
  "compra no debito",
  "compra no débito",
  "encargos refinanciamento",
  "encargos",
  "estorno",
] as const;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toDateKey(date: string | Date): string {
  if (typeof date === "string") return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86_400_000);
}

function addMonthsToDateKey(key: string, months: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1 + months, d!));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function amountTolerance(expected: number): number {
  return Math.max(DEFAULT_AMOUNT_TOLERANCE_MIN, Math.abs(expected) * DEFAULT_AMOUNT_TOLERANCE_RATIO);
}

export function amountsMatch(a: number, b: number, tolerance?: number): boolean {
  const tol = tolerance ?? amountTolerance(Math.max(Math.abs(a), Math.abs(b)));
  return Math.abs(Math.abs(a) - Math.abs(b)) <= tol;
}

/** Normaliza descrição/merchant para assinatura de matching. */
export function normalizeBillSignature(description: string, merchantName?: string | null): string {
  const raw = (merchantName?.trim() || description.trim()).toUpperCase();
  return raw
    .replace(/\|\s*[^|]+$/g, " ")
    .replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b(BA|ECPC|CPK)\d*\b/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/^(DL\*|DM\s+\*|EBN\s+\*)/g, " ")
    .replace(/SAO PAULOBRA|SAO PAULO BRA|CURITIBABRA|HORTOLANDIABRA|CAMPINASBRA|VALINHOSBRA|MONTE MORBRA|GUAYNABOBRA/gi, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DATE_LIKE_IN_TEXT = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{2}\/\d{4}\b/g;
const INSTALLMENT_PARCELA_RE = /parcela\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i;
const INSTALLMENT_SLASH_RE = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/;

function installmentPairFromMatch(match: RegExpMatchArray | null): { current: number; total: number } | null {
  if (!match) return null;
  const current = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isInteger(current) || !Number.isInteger(total)) return null;
  if (current < 1 || total < 2 || total > 48 || current > total) return null;
  return { current, total };
}

/** Detecta marcador de parcela (ex.: `2/3`, `parcela 2/12`) em descrição de fatura. */
export function parseInstallmentMarker(
  description: string,
  merchantName?: string | null,
): { current: number; total: number } | null {
  const text = `${description} ${merchantName ?? ""}`.replace(DATE_LIKE_IN_TEXT, " ");
  return (
    installmentPairFromMatch(text.match(INSTALLMENT_PARCELA_RE)) ??
    installmentPairFromMatch(text.match(INSTALLMENT_SLASH_RE))
  );
}

export function descriptionLooksLikeInstallment(
  description: string,
  merchantName?: string | null,
): boolean {
  return parseInstallmentMarker(description, merchantName) != null;
}

export function extractPayeeFromDescription(description: string): string | null {
  const upper = description.toUpperCase();
  const pixMatch = upper.match(/PIX\s+(?:ENVIADO|RECEBIDO)\s+(.+)/);
  if (pixMatch?.[1]) {
    return pixMatch[1].trim().replace(/\s*\|.*$/, "").trim() || null;
  }
  const transferMatch = upper.match(/TRANSFER[EÊ]NCIA\s+(?:ENVIADA|RECEBIDA)\s*\|?\s*(.+)/);
  if (transferMatch?.[1]) {
    return transferMatch[1].trim() || null;
  }
  return null;
}

function deriveTitle(description: string, merchantName?: string | null): string {
  const payee = extractPayeeFromDescription(description);
  if (payee) return payee.slice(0, 80);
  const merchant = merchantName?.trim();
  if (merchant) return merchant.slice(0, 80);
  let title = description.trim().replace(/\|.*$/g, "").trim();
  title = title
    .replace(/SAO PAULOBRA|SAO PAULO BRA|CURITIBABRA|HORTOLANDIABRA|CAMPINASBRA|VALINHOSBRA|MONTE MORBRA|GUAYNABOBRA/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return title.slice(0, 80);
}

function resolveDashboardGroup(category: string | null | undefined): DashboardCategoryGroup | null {
  if (!category) return null;
  return groupCategoryForDashboard(category);
}

function descriptionHasExcludedMarker(description: string): boolean {
  const lower = description.toLowerCase();
  return EXCLUDED_DESCRIPTION_MARKERS.some((marker) => lower.includes(marker));
}

/** Indica se a transação pode entrar na detecção de contas fixas. */
export function isRecurringBillCandidateTransaction(tx: RecurringPatternTransaction): boolean {
  if (!isTransactionOutflow(tx.amount, tx.accountType)) return false;
  if (isCreditCardBillPayment(tx.category, tx.description)) return false;
  if (descriptionHasExcludedMarker(tx.description)) return false;
  if (descriptionLooksLikeInstallment(tx.description, tx.merchantName)) return false;
  if (isSamePersonTransfer(tx.category, tx.description, tx.personName)) return false;

  const group = resolveDashboardGroup(tx.category);
  if (group && EXCLUDED_CATEGORY_GROUPS.has(group)) return false;

  return true;
}

function chainAmountsCompatible(
  referenceAmount: number,
  nextAmount: number,
  category: string | null | undefined,
): boolean {
  const group = resolveDashboardGroup(category);
  const ratio =
    group === "Assinaturas" || group === "Contas fixas" || group === "Serviços" ? 0.25 : 0.15;
  return amountsMatch(referenceAmount, nextAmount, amountTolerance(Math.abs(referenceAmount)) * (ratio / 0.15));
}

function qualifiesAsRecurringBill(
  chain: RecurringPatternTransaction[],
): boolean {
  if (chain.length < MIN_OCCURRENCES) return false;

  const group = resolveDashboardGroup(chain[0]?.category);
  if (group && DONATION_GROUPS.has(group)) {
    return chain.length >= MIN_OCCURRENCES_FOR_DONATIONS;
  }
  if (group && RECURRING_FRIENDLY_GROUPS.has(group)) return true;
  if (group && DISCRETIONARY_GROUPS.has(group) && chain.length < MIN_OCCURRENCES_FOR_DISCRETIONARY) {
    return false;
  }
  if (isCreditAccount(chain[0]?.accountType) && chain.length >= MIN_OCCURRENCES) return true;
  return chain.length >= MIN_OCCURRENCES;
}

function isMonthlyInterval(days: number): boolean {
  return days >= MIN_INTERVAL_DAYS && days <= MAX_INTERVAL_DAYS;
}

function dominantAmount(txs: RecurringPatternTransaction[]): number {
  const counts = new Map<number, number>();
  for (const tx of txs) {
    const amount = roundMoney(Math.abs(tx.amount));
    counts.set(amount, (counts.get(amount) ?? 0) + 1);
  }
  let bestAmount = roundMoney(Math.abs(txs[txs.length - 1]!.amount));
  let bestCount = 0;
  for (const [amount, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestAmount = amount;
    }
  }
  return bestAmount;
}

function filterStableAmountCluster(
  txs: RecurringPatternTransaction[],
): RecurringPatternTransaction[] {
  if (txs.length < MIN_OCCURRENCES) return txs;
  const group = resolveDashboardGroup(txs[0]?.category);
  const flexibleGroup =
    group === "Assinaturas" || group === "Contas fixas" || group === "Serviços";
  const multiplier = flexibleGroup ? 1.5 : 1;

  const anchor = dominantAmount(txs);
  return txs.filter((tx) =>
    amountsMatch(anchor, tx.amount, amountTolerance(anchor) * multiplier),
  );
}

function isNoisyIrregularPayee(
  group: RecurringPatternTransaction[],
  chain: RecurringPatternTransaction[],
): boolean {
  if (group.length < NOISY_PAYEE_MIN_TXS) return false;
  return chain.length / group.length < NOISY_PAYEE_MIN_CHAIN_RATIO;
}

function findLongestMonthlyChain(txs: RecurringPatternTransaction[]): RecurringPatternTransaction[] {
  if (txs.length < MIN_OCCURRENCES) return [];

  const stableTxs = filterStableAmountCluster(txs);
  const sorted = [...stableTxs].sort((a, b) => toDateKey(a.date).localeCompare(toDateKey(b.date)));
  let bestChain: RecurringPatternTransaction[] = [];

  for (let start = 0; start < sorted.length; start++) {
    const chain: RecurringPatternTransaction[] = [sorted[start]!];
    let lastDate = toDateKey(sorted[start]!.date);

    for (let i = start + 1; i < sorted.length; i++) {
      const tx = sorted[i]!;
      const gap = diffDays(lastDate, toDateKey(tx.date));
      if (!isMonthlyInterval(gap)) continue;
      if (!chainAmountsCompatible(chain[0]!.amount, tx.amount, chain[0]!.category)) continue;
      chain.push(tx);
      lastDate = toDateKey(tx.date);
    }

    if (chain.length > bestChain.length) {
      bestChain = chain;
    }
  }

  if (bestChain.length < MIN_OCCURRENCES || !qualifiesAsRecurringBill(bestChain)) return [];
  if (isNoisyIrregularPayee(txs, bestChain)) return [];
  return bestChain;
}

export function detectRecurringPatterns(
  transactions: RecurringPatternTransaction[],
): RecurringPatternCandidate[] {
  const eligible = transactions.filter(isRecurringBillCandidateTransaction);
  const groups = new Map<string, RecurringPatternTransaction[]>();

  for (const tx of eligible) {
    const signature = normalizeBillSignature(tx.description, tx.merchantName);
    if (!signature) continue;
    const key = `${tx.accountId}::${signature}`;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const candidates: RecurringPatternCandidate[] = [];

  for (const [, txs] of groups) {
    const chain = findLongestMonthlyChain(txs);
    if (chain.length < MIN_OCCURRENCES) continue;

    const first = chain[0]!;
    const signature = normalizeBillSignature(first.description, first.merchantName);
    const amounts = chain.map((t) => Math.abs(t.amount));
    const expectedAmount = roundMoney(amounts.reduce((s, a) => s + a, 0) / amounts.length);
    const lastTx = chain[chain.length - 1]!;
    const dayOfMonth = new Date(`${toDateKey(lastTx.date)}T12:00:00.000Z`).getUTCDate();

    candidates.push({
      matchSignature: signature,
      title: deriveTitle(first.description, first.merchantName),
      payeeName: extractPayeeFromDescription(first.description),
      category: first.category ?? null,
      expectedAmount,
      dayOfMonth,
      accountId: first.accountId,
      personId: first.personId ?? "",
      transactions: chain,
    });
  }

  return candidates;
}

export interface RecurringBillForSimulation {
  id: string;
  title: string;
  category?: string | null;
  expectedAmount: number;
  dayOfMonth: number;
  occurrences: {
    id: string;
    dueDate: string;
    amount: number;
    status: OccurrenceStatus;
  }[];
}

/** Converte conta fixa + ocorrências em SimulatedPurchase para impacto nos ciclos. */
export function recurringBillToSimulatedPurchase(bill: RecurringBillForSimulation): SimulatedPurchase {
  const pendingOrPaid = bill.occurrences.filter((o) => o.status !== "skipped");
  const installments = pendingOrPaid.map((o) => ({
    id: o.id,
    dueDate: toDateKey(o.dueDate),
    amount: o.amount,
  }));

  const firstDate = installments[0]?.dueDate ?? new Date().toISOString().slice(0, 10);

  return {
    id: bill.id,
    title: bill.title,
    category: bill.category ?? undefined,
    paymentMethod: "pix",
    totalAmount: roundMoney(installments.reduce((s, i) => s + i.amount, 0)),
    purchaseDate: firstDate,
    installments,
    createdAt: new Date().toISOString(),
  };
}

export function recurringBillsToSimulatedPurchases(
  bills: RecurringBillForSimulation[],
): SimulatedPurchase[] {
  return bills.map(recurringBillToSimulatedPurchase);
}

function clampDayOfMonthUtc(year: number, month: number, dayOfMonth: number): number {
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Math.min(dayOfMonth, maxDay);
}

/** Conta quantos vencimentos mensais já passaram desde a última cobrança paga. */
export function countMissedRecurringBillingCycles(
  lastPaidDateKey: string,
  dayOfMonth: number,
  today: string = todayDateKeyInTimeZone(),
): number {
  const normalizedLastPaid = lastPaidDateKey.slice(0, 10);
  const normalizedToday = today.slice(0, 10);
  if (!normalizedLastPaid || dayOfMonth < 1 || dayOfMonth > 31) return 0;

  const lastPaid = new Date(`${normalizedLastPaid}T12:00:00.000Z`);
  if (Number.isNaN(lastPaid.getTime())) return 0;

  let missed = 0;
  const cursor = new Date(lastPaid);
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);

  for (let guard = 0; guard < 120; guard++) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const day = clampDayOfMonthUtc(year, month, dayOfMonth);
    const dueKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (dueKey > normalizedToday) break;
    missed += 1;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return missed;
}

/** Contas auto-detectadas sem lastro (conta Pluggy sumiu ou parcela n/m). */
export function shouldDismissAutoDetectedBill(input: {
  source: RecurringBillSource;
  accountId: string | null;
  title: string;
  payeeName?: string | null;
}): boolean {
  if (input.source !== "auto_detected") return false;
  if (!input.accountId) return true;
  return descriptionLooksLikeInstallment(input.title, input.payeeName);
}

export function shouldDeactivateStaleRecurringBill(input: {
  status: RecurringBillStatus;
  source: RecurringBillSource;
  dayOfMonth: number;
  lastPaidDateKey: string | null;
  today?: string;
  missedCyclesThreshold?: number;
}): boolean {
  if (input.status !== "active") return false;
  if (input.source === "manual") return false;
  if (!input.lastPaidDateKey) return false;

  const threshold = input.missedCyclesThreshold ?? STALE_RECURRING_BILL_MISSED_CYCLES;
  const missed = countMissedRecurringBillingCycles(
    input.lastPaidDateKey,
    input.dayOfMonth,
    input.today,
  );
  return missed >= threshold;
}

export function computeDueDateForCycle(dayOfMonth: number, cycleKey: string): string {
  const [y, m] = cycleKey.split("-").map(Number);
  const maxDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const day = Math.min(dayOfMonth, maxDay);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function buildFutureOccurrenceDates(
  dayOfMonth: number,
  fromDateKey: string,
  count: number,
): string[] {
  const dates: string[] = [];
  let ref = fromDateKey;
  for (let i = 0; i < count; i++) {
    ref = addMonthsToDateKey(ref, i === 0 ? 0 : 1);
    const [y, m] = ref.split("-").map(Number);
    const maxDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
    const day = Math.min(dayOfMonth, maxDay);
    dates.push(
      `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
    ref = dates[dates.length - 1]!;
  }
  return dates;
}

export function recurringBillStatusLabel(status: RecurringBillStatus): string {
  switch (status) {
    case "active":
      return "Ativa";
    case "inactive":
      return "Inativa";
    case "dismissed":
      return "Excluída";
  }
}

export function occurrenceStatusLabel(status: OccurrenceStatus): string {
  switch (status) {
    case "pending":
      return "Pendente";
    case "paid":
      return "Pago";
    case "skipped":
      return "Ignorado";
  }
}
