import { cardChargeDueDateKey, type CardPaymentCalendar } from "./cardPaymentDate.js";
import { toLocalDateKey } from "./payday.js";
import { isCreditAccount, isTransactionOutflow } from "./transactions.js";

/** O que a lista precisa saber do ciclo da fatura escolhido no painel. */
export interface BillCyclePeriod {
  /** Mês da fatura (AAAA-MM). */
  cycleKey: string;
  periodFrom: string;
  periodTo: string;
}

/**
 * Transações de um ciclo da fatura: compra no cartão entra se for da fatura daquele
 * mês (seja qual for a data da compra); o resto entra pela data, dentro do período
 * que vai do pagamento da fatura anterior ao pagamento desta. Devolve os objetos
 * originais com `billDueDate` nas compras do cartão.
 *
 * @example selectByBillCycle(txs, cards, { cycleKey: "2026-11", periodFrom: "2026-10-29", periodTo: "2026-11-28" })
 */
export function selectByBillCycle<
  T extends {
    date: Date;
    amount: number;
    accountId: string;
    accountType?: string | null;
    billForecastMonth?: string | null;
  },
>(
  txs: T[],
  cards: CardPaymentCalendar[],
  cycle: BillCyclePeriod,
): Array<T & { billDueDate: string | null }> {
  const byAccount = new Map(cards.map((card) => [card.accountId, card]));
  const selected: Array<T & { billDueDate: string | null }> = [];
  for (const tx of txs) {
    const date = toLocalDateKey(tx.date);
    const card = byAccount.get(tx.accountId);
    const purchase = isCreditAccount(tx.accountType) && isTransactionOutflow(tx.amount, tx.accountType);
    const dueKey = card && purchase
      ? cardChargeDueDateKey(card, { date, billMonth: tx.billForecastMonth })
      : null;
    if (dueKey) {
      if (dueKey.startsWith(cycle.cycleKey)) selected.push({ ...tx, billDueDate: dueKey });
      continue;
    }
    if (date >= cycle.periodFrom && date <= cycle.periodTo) selected.push({ ...tx, billDueDate: null });
  }
  return selected;
}
