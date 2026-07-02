import { isCreditAccount, isTransactionOutflow, resolveBillingCloseDate, resolveNextDueDate } from "@finance/shared";

export { resolveBillingCloseDate, resolveNextDueDate } from "@finance/shared";

export interface NextBillSummary {
  nextBillAmount: number | null;
  nextBillDueDate: Date | null;
}

interface TxLike {
  accountId: string;
  date: Date;
  amount: number;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
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
