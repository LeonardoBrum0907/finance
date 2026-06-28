import { isCreditAccount, isTransactionOutflow } from "@finance/shared";

export interface NextBillSummary {
  nextBillAmount: number | null;
  nextBillDueDate: Date | null;
}

interface TxLike {
  accountId: string;
  date: Date;
  amount: number;
}

/** Fechamento costuma ocorrer alguns dias antes do vencimento. */
const CLOSE_DAYS_BEFORE_DUE = 7;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
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

/**
 * Próxima fatura = compras no ciclo aberto (após o último fechamento).
 * Vencimento = próxima data de vencimento após hoje.
 */
export function computeNextBill(
  accountId: string,
  accountType: string | null,
  balanceCloseDate: Date | null,
  balanceDueDate: Date | null,
  transactions: TxLike[],
  referenceDate: Date = new Date(),
): NextBillSummary {
  const closeDate = resolveBillingCloseDate(balanceCloseDate, balanceDueDate, referenceDate);
  if (!closeDate) {
    return { nextBillAmount: null, nextBillDueDate: null };
  }

  const closeAt = endOfDay(closeDate);

  const refEnd = endOfDay(referenceDate);

  let amount = 0;
  for (const tx of transactions) {
    if (tx.accountId !== accountId) continue;
    if (tx.date <= closeAt || tx.date > refEnd) continue;
    if (isTransactionOutflow(tx.amount, accountType)) {
      amount += Math.abs(tx.amount);
    } else if (isCreditAccount(accountType)) {
      amount -= Math.abs(tx.amount);
    }
  }

  return {
    nextBillAmount: amount > 0 ? amount : null,
    nextBillDueDate: resolveNextDueDate(balanceDueDate, referenceDate),
  };
}
