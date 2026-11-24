import { addDaysToDateKey } from "./creditBill.js";

/**
 * O ciclo da fatura fecha no dia em que as faturas do mês são pagas, não numa data
 * fixa (pedido do Léo em 24/11/2026: "fechar quando eu pagar a fatura, antes ou
 * depois do vencimento"). Este módulo descobre esse dia.
 */

/** Pagamento de fatura visto no extrato (valor positivo). */
export interface BillPaymentEvent {
  date: string;
  amount: number;
}

/**
 * De onde veio a data de pagamento: crédito "pagamento" lançado no cartão, débito
 * na conta corrente, marcação manual ou suposição (venceu há tempo e nada apareceu).
 */
export type BillPaidSource = "card" | "checking" | "manual" | "assumed";

export interface BillPaid {
  paidOn: string;
  source: BillPaidSource;
}

/** Pagamentos que somam 95% da fatura contam como pagamento (arredondamento, estorno). */
const COVERED_SHARE = 0.95;
/** Só conta pagamento até o fechamento seguinte, para não pegar o da próxima fatura. */
const PAYMENT_WINDOW_DAYS = 30;
/** Sem pagamento visível dez dias depois do vencimento, supõe paga no vencimento. */
const ASSUME_PAID_AFTER_DAYS = 10;

/**
 * Dia em que os pagamentos feitos depois do fechamento passaram a cobrir a fatura.
 * Soma pagamentos parciais na ordem das datas.
 *
 * @example dateBillGotCovered(1000, "2026-11-21", [{ date: "2026-11-26", amount: 1000 }]) // "2026-11-26"
 */
export function dateBillGotCovered(
  amount: number,
  closingDate: string,
  payments: BillPaymentEvent[],
): string | null {
  const until = addDaysToDateKey(closingDate, PAYMENT_WINDOW_DAYS);
  const inWindow = payments
    .filter((p) => p.date > closingDate && p.date <= until)
    .sort((a, b) => a.date.localeCompare(b.date));
  let paid = 0;
  for (const payment of inWindow) {
    paid += payment.amount;
    if (paid >= amount * COVERED_SHARE) return payment.date;
  }
  return null;
}

export interface CardBillPaymentInput {
  amount: number;
  closingDate: string;
  dueDate: string;
  /** Créditos de pagamento lançados no próprio cartão. */
  cardPayments: BillPaymentEvent[];
  /** Débitos de pagamento de fatura na conta corrente. */
  checkingPayments: BillPaymentEvent[];
  /** Dia marcado à mão pela pessoa ("Marcar fatura como paga"). */
  manualPaidOn: string | null;
  today: string;
}

/**
 * Quando uma fatura de um cartão foi paga. A marcação manual vale mais que o extrato;
 * o crédito no cartão vale mais que o débito na conta, que pode ser de outro cartão.
 *
 * @example resolveCardBillPaid({ amount: 2806.79, closingDate: "2026-11-21", dueDate: "2026-11-28", cardPayments: [], checkingPayments: [], manualPaidOn: null, today: "2026-11-24" }) // null
 */
export function resolveCardBillPaid(input: CardBillPaymentInput): BillPaid | null {
  if (input.manualPaidOn) return { paidOn: input.manualPaidOn, source: "manual" };
  const byCard = dateBillGotCovered(input.amount, input.closingDate, input.cardPayments);
  if (byCard) return { paidOn: byCard, source: "card" };
  const byChecking = dateBillGotCovered(input.amount, input.closingDate, input.checkingPayments);
  if (byChecking) return { paidOn: byChecking, source: "checking" };
  if (addDaysToDateKey(input.dueDate, ASSUME_PAID_AFTER_DAYS) < input.today) {
    return { paidOn: input.dueDate, source: "assumed" };
  }
  return null;
}

/**
 * O ciclo só fecha quando todas as faturas do mês estão pagas, no dia da última.
 * Mês sem fatura fecha no vencimento.
 *
 * @example resolveCyclePaid([{ paidOn: "2026-11-26", source: "card" }, null], "2026-11-28", "2026-11-27") // null
 */
export function resolveCyclePaid(
  bills: Array<BillPaid | null>,
  dueDate: string,
  today: string,
): BillPaid | null {
  if (bills.length === 0) return dueDate <= today ? { paidOn: dueDate, source: "assumed" } : null;
  if (bills.some((bill) => bill === null)) return null;
  const paid = bills as BillPaid[];
  const last = paid.reduce((latest, bill) => (bill.paidOn > latest.paidOn ? bill : latest));
  const manual = paid.some((bill) => bill.source === "manual");
  return { paidOn: last.paidOn, source: manual ? "manual" : last.source };
}

/**
 * Último dia do ciclo: o dia do pagamento; sem pagamento, o vencimento previsto ou,
 * se ele já passou, hoje (o ciclo continua aberto até a fatura ser paga).
 *
 * @example cyclePeriodEnd(null, "2026-11-28", "2026-11-30") // "2026-11-30"
 */
export function cyclePeriodEnd(paid: BillPaid | null, dueDate: string, today: string): string {
  if (paid) return paid.paidOn;
  return dueDate >= today ? dueDate : today;
}
