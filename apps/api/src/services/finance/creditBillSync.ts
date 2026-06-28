import { resolveNextDueDate } from "./creditBill.js";

export interface PluggyBillLike {
  dueDate: string | Date;
  totalAmount: number;
  minimumPaymentAmount?: number | null;
}

export interface CreditBillDisplay {
  /** Fatura já fechada (Bills API ou fallback). */
  closedBillAmount: number | null;
  closedBillDueDate: Date | null;
  /** Fatura em aberto — compras do ciclo atual (saldo Pluggy). */
  openBillAmount: number | null;
  openBillDueDate: Date | null;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Fatura fechada mais recente com vencimento até a data de referência. */
export function pickLatestClosedBill(
  bills: PluggyBillLike[],
  referenceDate: Date = new Date(),
): PluggyBillLike | null {
  const ref = startOfDay(referenceDate);
  let best: PluggyBillLike | null = null;
  let bestDue = -Infinity;

  for (const bill of bills) {
    const due = startOfDay(new Date(bill.dueDate));
    if (due > ref) continue;
    const ts = due.getTime();
    if (ts >= bestDue) {
      bestDue = ts;
      best = bill;
    }
  }

  return best;
}

export function resolveCreditBillDisplay(
  balance: number,
  balanceDueDate: Date | null,
  bills: PluggyBillLike[],
  referenceDate: Date = new Date(),
): CreditBillDisplay {
  const openBillAmount = Math.abs(balance) > 0 ? Math.abs(balance) : null;
  const openBillDueDate = resolveNextDueDate(balanceDueDate, referenceDate);

  const closed = pickLatestClosedBill(bills, referenceDate);
  if (!closed) {
    return {
      closedBillAmount: openBillAmount,
      closedBillDueDate: balanceDueDate,
      openBillAmount: null,
      openBillDueDate: null,
    };
  }

  return {
    closedBillAmount: closed.totalAmount,
    closedBillDueDate: new Date(closed.dueDate),
    openBillAmount,
    openBillDueDate,
  };
}
