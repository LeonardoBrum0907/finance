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
