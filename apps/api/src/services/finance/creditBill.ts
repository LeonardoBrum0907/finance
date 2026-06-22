import { isTransactionOutflow } from "@finance/shared";

export interface NextBillSummary {
  nextBillAmount: number | null;
  nextBillDueDate: Date | null;
}

interface TxLike {
  accountId: string;
  date: Date;
  amount: number;
}

/**
 * Próxima fatura = compras no ciclo aberto (após a data de fechamento da fatura atual).
 * Vencimento estimado = vencimento atual + 1 mês.
 */
export function computeNextBill(
  accountId: string,
  accountType: string | null,
  balanceCloseDate: Date | null,
  balanceDueDate: Date | null,
  transactions: TxLike[],
): NextBillSummary {
  if (!balanceCloseDate) {
    return { nextBillAmount: null, nextBillDueDate: null };
  }

  const closeAt = new Date(balanceCloseDate);
  closeAt.setHours(23, 59, 59, 999);

  let amount = 0;
  for (const tx of transactions) {
    if (tx.accountId !== accountId) continue;
    if (tx.date <= closeAt) continue;
    if (!isTransactionOutflow(tx.amount, accountType)) continue;
    amount += Math.abs(tx.amount);
  }

  let nextBillDueDate: Date | null = null;
  if (balanceDueDate) {
    nextBillDueDate = new Date(balanceDueDate);
    nextBillDueDate.setMonth(nextBillDueDate.getMonth() + 1);
  }

  return {
    nextBillAmount: amount,
    nextBillDueDate,
  };
}
