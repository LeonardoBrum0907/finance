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

  if (
    snapshot.openBillAmount != null &&
    snapshot.openBillAmount > 0 &&
    snapshot.openBillDueDate
  ) {
    const duplicateClosed =
      snapshot.closedBillAmount != null &&
      snapshot.closedBillDueDate === snapshot.openBillDueDate &&
      Math.abs(snapshot.closedBillAmount - snapshot.openBillAmount) < 0.01;

    if (!duplicateClosed) {
      candidates.push({
        id: `${snapshot.accountId}:open`,
        title: `Fatura aberta ${snapshot.accountName}`,
        dueDate: snapshot.openBillDueDate,
        amount: snapshot.openBillAmount,
      });
    }
  }

  return candidates;
}

/**
 * Projeta saídas de caixa por pagamento de fatura com vencimento no ciclo.
 * Não duplica compras no cartão — só o pagamento agregado na corrente.
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
