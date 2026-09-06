import { isCreditAccount, isCreditCardBillPayment } from "./transactions.js";

/** Fechamento costuma ocorrer alguns dias antes do vencimento. */
export const CLOSE_DAYS_BEFORE_DUE = 7;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Resolve a data de fechamento do ciclo aberto.
 * Usa balanceCloseDate do Pluggy quando disponível; caso contrário estima a partir do vencimento.
 */
export function resolveBillingCloseDate(
  balanceCloseDate: Date | null,
  balanceDueDate: Date | null,
  referenceDate: Date = new Date(),
): Date | null {
  if (balanceCloseDate) return balanceCloseDate;
  if (!balanceDueDate) return null;

  const ref = startOfDay(referenceDate);
  const due = startOfDay(balanceDueDate);
  let close = new Date(due);
  close.setDate(close.getDate() - CLOSE_DAYS_BEFORE_DUE);

  while (close > ref) {
    due.setMonth(due.getMonth() - 1);
    close = new Date(due);
    close.setDate(close.getDate() - CLOSE_DAYS_BEFORE_DUE);
  }

  return close;
}

/** Próximo vencimento após a data de referência, mantendo o dia do mês. */
export function resolveNextDueDate(
  balanceDueDate: Date | null,
  referenceDate: Date = new Date(),
): Date | null {
  if (!balanceDueDate) return null;

  const ref = startOfDay(referenceDate);
  const due = startOfDay(balanceDueDate);

  while (due <= ref) {
    due.setMonth(due.getMonth() + 1);
  }

  return due;
}

export type BillBucket = "open" | "closed" | "future";

export interface BillAssignment {
  bucket: BillBucket;
  /** Vencimento estimado da fatura que receberá a cobrança. */
  billDueDate: string | null;
}

/**
 * Determina em qual fatura uma cobrança simulada deve cair.
 */
export function resolveBillForChargeDate(
  balanceCloseDate: string | Date | null | undefined,
  balanceDueDate: string | Date | null | undefined,
  chargeDateKey: string,
  todayKey: string,
): BillAssignment {
  const closeDateRaw = toDate(balanceCloseDate);
  const dueDateRaw = toDate(balanceDueDate);
  const chargeDate = toDate(chargeDateKey);
  const today = toDate(todayKey);

  if (!chargeDate) {
    return { bucket: "open", billDueDate: null };
  }

  const openClose = resolveBillingCloseDate(closeDateRaw, dueDateRaw, today ?? new Date());
  if (!openClose) {
    const nextDue = resolveNextDueDate(dueDateRaw, chargeDate);
    return { bucket: "open", billDueDate: nextDue ? toDateKey(nextDue) : null };
  }

  const chargeClose = resolveBillingCloseDate(closeDateRaw, dueDateRaw, chargeDate);
  const openCloseStart = startOfDay(openClose);
  const chargeCloseStart = chargeClose ? startOfDay(chargeClose) : openCloseStart;

  const nextDueForOpen = resolveNextDueDate(dueDateRaw, today ?? new Date());
  const nextDueForCharge = resolveNextDueDate(dueDateRaw, chargeDate);

  if (chargeCloseStart.getTime() >= openCloseStart.getTime()) {
    return {
      bucket: "open",
      billDueDate: nextDueForOpen ? toDateKey(nextDueForOpen) : null,
    };
  }

  const prevDue = dueDateRaw ? startOfDay(new Date(dueDateRaw)) : null;
  if (prevDue) {
    prevDue.setMonth(prevDue.getMonth() - 1);
    const prevClose = resolveBillingCloseDate(closeDateRaw, prevDue, chargeDate);
    if (prevClose && chargeDate > startOfDay(prevClose) && chargeDate <= openCloseStart) {
      const closedDue = resolveNextDueDate(dueDateRaw, chargeDate);
      return {
        bucket: "closed",
        billDueDate: closedDue ? toDateKey(closedDue) : null,
      };
    }
  }

  return {
    bucket: "future",
    billDueDate: nextDueForCharge ? toDateKey(nextDueForCharge) : null,
  };
}

export interface CreditAccountSnapshot {
  id: string;
  name: string;
  balanceCloseDate?: string | null;
  balanceDueDate?: string | null;
  openBillAmount?: number | null;
  closedBillAmount?: number | null;
  creditLimit?: number | null;
  availableCreditLimit?: number | null;
}

export interface CreditBillSimulatedCharge {
  date: string;
  amount: number;
  label: string;
  purchaseId: string;
  bucket: BillBucket;
  billDueDate: string | null;
}

export interface CreditBillImpact {
  accountId: string;
  accountName: string;
  openBillBefore: number;
  openBillAfter: number;
  closedBillBefore: number;
  closedBillAfter: number;
  futureBillTotal: number;
  simulatedCharges: CreditBillSimulatedCharge[];
  limitUsedPercentAfter: number | null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isCreditPaymentMethod(method: string): boolean {
  return method === "credit_single" || method === "credit_installments";
}

/** Compras simuladas mínimas para cálculo de fatura. */
export interface CreditBillPurchaseLike {
  id: string;
  title: string;
  paymentMethod: string;
  creditAccountId?: string;
  installments: { dueDate: string; amount: number }[];
}

/** Snapshot de fatura para projeção de pagamento no ciclo (caixa no vencimento). */
export interface CreditBillSnapshot {
  accountId: string;
  accountName: string;
  closedBillAmount: number | null;
  closedBillDueDate: string | null;
  openBillAmount: number | null;
  openBillDueDate: string | null;
}

export interface CreditBillPaymentItem {
  id: string;
  title: string;
  dueDate: string;
  amount: number;
  kind: "creditBills";
}

export interface PendingBillPaymentsResult {
  total: number;
  items: CreditBillPaymentItem[];
}

interface BillPaymentCandidate {
  id: string;
  title: string;
  dueDate: string;
  amount: number;
}

export interface CheckingPaymentLike {
  date: Date | string;
  amount: number;
  category?: string | null;
  description?: string | null;
  accountType?: string | null;
}

function isDateInCycle(dateKey: string, from: string, to: string): boolean {
  return dateKey >= from && dateKey <= to;
}

function normalizeDueDateKey(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return toDateKey(value);
}

/** Pagamento de fatura já detectado na conta corrente. */
export function isCreditBillAlreadyPaid(
  billAmount: number,
  dueDateKey: string,
  checkingPayments: CheckingPaymentLike[],
): boolean {
  if (billAmount <= 0) return true;

  for (const tx of checkingPayments) {
    if (isCreditAccount(tx.accountType)) continue;
    if (!isCreditCardBillPayment(tx.category, tx.description)) continue;

    const dateKey =
      typeof tx.date === "string" ? tx.date.slice(0, 10) : toDateKey(tx.date);
    // Pagamento costuma cair no dia do vencimento ou poucos dias antes/depois.
    const dueMs = new Date(`${dueDateKey}T12:00:00.000Z`).getTime();
    const txMs = new Date(`${dateKey}T12:00:00.000Z`).getTime();
    const daysDiff = Math.abs(txMs - dueMs) / 86_400_000;
    if (daysDiff > 14) continue;

    const paid = Math.abs(tx.amount);
    if (paid >= billAmount * 0.85) return true;
  }

  return false;
}

function collectBillCandidates(snapshot: CreditBillSnapshot): BillPaymentCandidate[] {
  const candidates: BillPaymentCandidate[] = [];

  if (
    snapshot.closedBillAmount != null &&
    snapshot.closedBillAmount > 0 &&
    snapshot.closedBillDueDate
  ) {
    candidates.push({
      id: `${snapshot.accountId}:closed`,
      title: `Fatura ${snapshot.accountName}`,
      dueDate: snapshot.closedBillDueDate,
      amount: snapshot.closedBillAmount,
    });
  }

  return candidates;
}

/**
 * Projeta saídas de caixa por pagamento de fatura com vencimento no ciclo.
 * Usa só fatura fechada do snapshot — o saldo aberto (limite usado) não é caixa deste ciclo.
 * Prefira `buildCycleStatementPayments` quando houver calendário e faturas persistidas.
 */
export function buildPendingBillPayments(
  snapshots: CreditBillSnapshot[],
  cycle: { from: string; to: string },
  _today: string,
  checkingPayments: CheckingPaymentLike[],
): PendingBillPaymentsResult {
  const items: CreditBillPaymentItem[] = [];

  for (const snapshot of snapshots) {
    for (const candidate of collectBillCandidates(snapshot)) {
      if (!isDateInCycle(candidate.dueDate, cycle.from, cycle.to)) continue;
      if (isCreditBillAlreadyPaid(candidate.amount, candidate.dueDate, checkingPayments)) {
        continue;
      }
      items.push({
        id: candidate.id,
        title: candidate.title,
        dueDate: candidate.dueDate,
        amount: roundMoney(candidate.amount),
        kind: "creditBills",
      });
    }
  }

  const total = roundMoney(items.reduce((sum, item) => sum + item.amount, 0));
  return { total, items };
}

export interface CardStatementCharge {
  date: string;
  amount: number;
}

export interface PersistedCardStatement {
  dueDate: string;
  closingDate: string | null;
  totalAmount: number;
}

export interface CardForCycleBills {
  accountId: string;
  accountName: string;
  billDueDay: number | null;
  billCloseDay: number | null;
  balanceDueDate: string | null;
  balanceCloseDate: string | null;
  creditBrand: string | null;
  statements: PersistedCardStatement[];
  charges: CardStatementCharge[];
}

export interface CycleStatementPaymentItem extends CreditBillPaymentItem {
  estimated: boolean;
  closingDate: string | null;
}

export interface CycleStatementPaymentsResult {
  total: number;
  items: CycleStatementPaymentItem[];
}

const STATEMENT_CLOSE_GAP_DAYS = 7;

function parseDateKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

function formatDateKey(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function dateKeyForDayInMonth(year: number, month: number, day: number): string {
  const dim = daysInMonth(year, month);
  return formatDateKey(year, month, Math.min(Math.max(1, day), dim));
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const { y, m, d } = parseDateKey(dateKey);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function dayOfMonthFromDateKey(dateKey: string): number {
  return parseDateKey(dateKey).d;
}

/** Próxima ocorrência do dia do mês em fromKey ou depois. */
export function nextDayOfMonthOnOrAfter(fromKey: string, day: number): string {
  const { y, m } = parseDateKey(fromKey);
  const thisMonth = dateKeyForDayInMonth(y, m, day);
  if (thisMonth >= fromKey) return thisMonth;
  if (m === 12) return dateKeyForDayInMonth(y + 1, 1, day);
  return dateKeyForDayInMonth(y, m + 1, day);
}

export function previousDayOfMonthBefore(fromKey: string, day: number): string {
  const { y, m } = parseDateKey(fromKey);
  const thisMonth = dateKeyForDayInMonth(y, m, day);
  if (thisMonth < fromKey) return thisMonth;
  if (m === 1) return dateKeyForDayInMonth(y - 1, 12, day);
  return dateKeyForDayInMonth(y, m - 1, day);
}

/** Fecha no closeDay do mesmo mês do vencimento, ou no mês anterior se o dia for depois. */
export function closeDateForDue(dueKey: string, closeDay: number): string {
  const { y, m } = parseDateKey(dueKey);
  const sameMonth = dateKeyForDayInMonth(y, m, closeDay);
  if (sameMonth < dueKey) return sameMonth;
  if (m === 1) return dateKeyForDayInMonth(y - 1, 12, closeDay);
  return dateKeyForDayInMonth(y, m - 1, closeDay);
}

/** Nubank e o padrão BR: fechamento = vencimento − 7 dias. */
export function inferCloseDay(dueDay: number): number {
  const sampleDue = dateKeyForDayInMonth(2026, 6, dueDay);
  return dayOfMonthFromDateKey(addDaysToDateKey(sampleDue, -STATEMENT_CLOSE_GAP_DAYS));
}

export function resolveStatementDays(
  card: Pick<
    CardForCycleBills,
    | "billDueDay"
    | "billCloseDay"
    | "balanceDueDate"
    | "balanceCloseDate"
    | "statements"
  >,
): { dueDay: number; closeDay: number } | null {
  const latest = [...card.statements].sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
  const dueDay =
    card.billDueDay ??
    (latest ? dayOfMonthFromDateKey(latest.dueDate) : null) ??
    (card.balanceDueDate ? dayOfMonthFromDateKey(card.balanceDueDate) : null);
  if (!dueDay) return null;

  const closeDay =
    card.billCloseDay ??
    (latest?.closingDate ? dayOfMonthFromDateKey(latest.closingDate) : null) ??
    (card.balanceCloseDate ? dayOfMonthFromDateKey(card.balanceCloseDate) : null) ??
    inferCloseDay(dueDay);

  return { dueDay, closeDay };
}

/** Faturas são mensais; um vencimento a menos de 20 dias da última fechada é o calendário antigo. */
const MIN_STATEMENT_GAP_DAYS = 20;

export function daysBetweenDateKeys(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T12:00:00.000Z`);
  const to = Date.parse(`${toKey}T12:00:00.000Z`);
  return Math.round((to - from) / 86_400_000);
}

/** Próximo vencimento do dia informado, pulando o ciclo curto após uma mudança de data. */
export function nextStatementDueAfter(
  fromKey: string,
  dueDay: number,
  lastDueKey: string | null = null,
): string {
  let due = nextDayOfMonthOnOrAfter(fromKey, dueDay);
  if (lastDueKey && due <= lastDueKey) {
    due = nextDayOfMonthOnOrAfter(addDaysToDateKey(lastDueKey, 1), dueDay);
  }
  if (lastDueKey && daysBetweenDateKeys(lastDueKey, due) < MIN_STATEMENT_GAP_DAYS) {
    due = nextDayOfMonthOnOrAfter(addDaysToDateKey(due, 1), dueDay);
  }
  return due;
}

export function statementDueInCycle(
  cycle: { from: string; to: string },
  dueDay: number,
  lastDueKey: string | null = null,
): string | null {
  const due = nextStatementDueAfter(cycle.from, dueDay, lastDueKey);
  return due <= cycle.to ? due : null;
}

function matchStatementForDue(
  statements: PersistedCardStatement[],
  dueKey: string,
): PersistedCardStatement | null {
  const exact = statements.find((s) => s.dueDate === dueKey);
  if (exact) return exact;
  const dueDay = dayOfMonthFromDateKey(dueKey);
  const yearMonth = dueKey.slice(0, 7);
  const closeDays = statements.filter((s) => {
    if (!s.dueDate.startsWith(yearMonth)) return false;
    return Math.abs(dayOfMonthFromDateKey(s.dueDate) - dueDay) <= 2;
  });
  closeDays.sort(
    (a, b) =>
      Math.abs(dayOfMonthFromDateKey(a.dueDate) - dueDay) -
      Math.abs(dayOfMonthFromDateKey(b.dueDate) - dueDay),
  );
  return closeDays[0] ?? null;
}

function latestDueBefore(card: CardForCycleBills, dueKey: string): string | null {
  const fromStatements = [...card.statements]
    .map((s) => s.dueDate)
    .filter((date) => date < dueKey)
    .sort((a, b) => b.localeCompare(a))[0];
  if (fromStatements) return fromStatements;
  if (card.balanceDueDate && card.balanceDueDate < dueKey) return card.balanceDueDate;
  return null;
}

function estimateStatementAmount(
  card: CardForCycleBills,
  dueKey: string,
  closeDay: number,
): { amount: number; closingDate: string } {
  const closingDate = closeDateForDue(dueKey, closeDay);
  const previousClosed = [...card.statements]
    .filter((s) => s.dueDate < dueKey)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];

  const windowStart = previousClosed
    ? addDaysToDateKey(
        previousClosed.closingDate ?? closeDateForDue(previousClosed.dueDate, closeDay),
        1,
      )
    : addDaysToDateKey(closingDate, -31);

  let amount = 0;
  for (const charge of card.charges) {
    if (charge.date >= windowStart && charge.date <= closingDate) {
      amount += charge.amount;
    }
  }
  return { amount: roundMoney(amount), closingDate };
}

/**
 * Caixa a sair neste ciclo de salário por fatura de cartão.
 * Usa fatura fechada persistida; se ainda não veio da Pluggy, estima pelas compras do corte.
 * Nunca usa o saldo/limite usado do cartão.
 */
export function buildCycleStatementPayments(
  cards: CardForCycleBills[],
  cycle: { from: string; to: string },
  _today: string,
  checkingPayments: CheckingPaymentLike[],
): CycleStatementPaymentsResult {
  const items: CycleStatementPaymentItem[] = [];

  for (const card of cards) {
    const days = resolveStatementDays(card);
    if (!days) continue;

    const candidate = nextDayOfMonthOnOrAfter(cycle.from, days.dueDay);
    const dueKey = statementDueInCycle(
      cycle,
      days.dueDay,
      latestDueBefore(card, candidate),
    );
    if (!dueKey) continue;

    const persisted = matchStatementForDue(card.statements, dueKey);
    const estimated = persisted
      ? {
          amount: roundMoney(persisted.totalAmount),
          closingDate: persisted.closingDate ?? closeDateForDue(dueKey, days.closeDay),
        }
      : estimateStatementAmount(card, dueKey, days.closeDay);

    if (estimated.amount <= 0) continue;
    if (isCreditBillAlreadyPaid(estimated.amount, dueKey, checkingPayments)) continue;

    const isEstimate = !persisted;
    items.push({
      id: `${card.accountId}:${dueKey}`,
      title: isEstimate
        ? `Fatura estimada ${card.accountName}`
        : `Fatura ${card.accountName}`,
      dueDate: dueKey,
      amount: estimated.amount,
      kind: "creditBills",
      estimated: isEstimate,
      closingDate: estimated.closingDate,
    });
  }

  const total = roundMoney(items.reduce((sum, item) => sum + item.amount, 0));
  return { total, items };
}

/** Monta snapshot a partir de saldo Pluggy e fatura fechada (Bills API ou fallback). */
export function buildCreditBillSnapshot(params: {
  accountId: string;
  accountName: string;
  balance: number;
  balanceDueDate: Date | string | null;
  closedBill?: { totalAmount: number; dueDate: Date | string } | null;
}): CreditBillSnapshot {
  const openBillAmount =
    Math.abs(params.balance) > 0 ? roundMoney(Math.abs(params.balance)) : null;
  const openBillDueDate = params.balanceDueDate
    ? normalizeDueDateKey(resolveNextDueDate(toDate(params.balanceDueDate), new Date()))
    : null;

  if (!params.closedBill) {
    return {
      accountId: params.accountId,
      accountName: params.accountName,
      closedBillAmount: openBillAmount,
      closedBillDueDate: params.balanceDueDate
        ? normalizeDueDateKey(params.balanceDueDate)
        : null,
      openBillAmount: null,
      openBillDueDate: null,
    };
  }

  const closedDue = normalizeDueDateKey(params.closedBill.dueDate);
  const openDueKey = openBillDueDate;

  const sameBill =
    openBillAmount != null &&
    closedDue != null &&
    openDueKey != null &&
    closedDue === openDueKey &&
    Math.abs(openBillAmount - params.closedBill.totalAmount) < 0.01;

  return {
    accountId: params.accountId,
    accountName: params.accountName,
    closedBillAmount: roundMoney(params.closedBill.totalAmount),
    closedBillDueDate: closedDue,
    openBillAmount: sameBill ? null : openBillAmount,
    openBillDueDate: sameBill ? null : openDueKey,
  };
}

export function computeCreditBillImpacts(
  purchases: CreditBillPurchaseLike[],
  creditAccounts: CreditAccountSnapshot[],
  today: string,
): CreditBillImpact[] {
  const creditPurchases = purchases.filter((p) => isCreditPaymentMethod(p.paymentMethod));
  if (creditPurchases.length === 0 || creditAccounts.length === 0) return [];

  const impacts: CreditBillImpact[] = [];

  for (const account of creditAccounts) {
    const accountPurchases = creditPurchases.filter(
      (p) => p.creditAccountId === account.id || (!p.creditAccountId && creditAccounts.length === 1),
    );
    if (accountPurchases.length === 0) continue;

    const openBillBefore = account.openBillAmount ?? 0;
    const closedBillBefore = account.closedBillAmount ?? 0;
    let openDelta = 0;
    let closedDelta = 0;
    let futureTotal = 0;
    const simulatedCharges: CreditBillSimulatedCharge[] = [];

    for (const purchase of accountPurchases) {
      for (const inst of purchase.installments) {
        const assignment = resolveBillForChargeDate(
          account.balanceCloseDate,
          account.balanceDueDate,
          inst.dueDate,
          today,
        );

        simulatedCharges.push({
          date: inst.dueDate,
          amount: inst.amount,
          label: purchase.title,
          purchaseId: purchase.id,
          bucket: assignment.bucket,
          billDueDate: assignment.billDueDate,
        });

        if (assignment.bucket === "open") {
          openDelta = roundMoney(openDelta + inst.amount);
        } else if (assignment.bucket === "closed") {
          closedDelta = roundMoney(closedDelta + inst.amount);
        } else {
          futureTotal = roundMoney(futureTotal + inst.amount);
        }
      }
    }

    const openBillAfter = roundMoney(openBillBefore + openDelta);
    const closedBillAfter = roundMoney(closedBillBefore + closedDelta);

    let limitUsedPercentAfter: number | null = null;
    if (account.creditLimit != null && account.creditLimit > 0 && account.availableCreditLimit != null) {
      const usedBefore = account.creditLimit - account.availableCreditLimit;
      const usedAfter = usedBefore + openDelta + closedDelta + futureTotal;
      limitUsedPercentAfter = Math.min(100, Math.max(0, (usedAfter / account.creditLimit) * 100));
    }

    impacts.push({
      accountId: account.id,
      accountName: account.name,
      openBillBefore,
      openBillAfter,
      closedBillBefore,
      closedBillAfter,
      futureBillTotal: futureTotal,
      simulatedCharges,
      limitUsedPercentAfter,
    });
  }

  return impacts;
}
