import {
  addDaysToDateKey,
  dateKeyForDayInMonth,
  nextDayOfMonthOnOrAfter,
  resolveStatementDays,
  type CardForCycleBills,
} from "./creditBill.js";
import { toLocalDateKey } from "./payday.js";
import { isCreditAccount, isTransactionOutflow } from "./transactions.js";

/** O que é preciso saber do cartão para achar o vencimento da fatura de uma compra. */
export type CardPaymentCalendar = Pick<
  CardForCycleBills,
  "accountId" | "billDueDay" | "billCloseDay" | "balanceDueDate" | "balanceCloseDate" | "statements"
>;

const BILL_MONTH = /^\d{4}-\d{2}$/;

/**
 * Vencimento (AAAA-MM-DD) da fatura em que uma compra do cartão é paga.
 *
 * Usa o mês da fatura que a Pluggy informa; sem ele, deduz pelo dia de fechamento
 * (compra depois do fechamento vai para a fatura seguinte). O dia vem do vencimento
 * real da fatura, quando a Pluggy já a trouxe, ou do dia de vencimento do cartão.
 */
export function cardChargeDueDateKey(
  card: CardPaymentCalendar,
  charge: { date: string; billMonth?: string | null },
): string | null {
  const days = resolveStatementDays(card);
  if (!days) return null;

  let month = charge.billMonth && BILL_MONTH.test(charge.billMonth) ? charge.billMonth : null;
  if (!month) {
    const closeKey = nextDayOfMonthOnOrAfter(charge.date.slice(0, 10), days.closeDay);
    month = nextDayOfMonthOnOrAfter(addDaysToDateKey(closeKey, 1), days.dueDay).slice(0, 7);
  }

  const statement = card.statements.find((s) => s.dueDate.startsWith(month));
  if (statement) return statement.dueDate;
  const [year, monthNumber] = month.split("-").map(Number);
  return dateKeyForDayInMonth(year!, monthNumber!, days.dueDay);
}

/** Data ao meio-dia UTC, que cai no mesmo dia no Brasil. */
export function dateKeyToNoonUtc(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

/**
 * Regra do ciclo: a compra no cartão pertence ao ciclo em que a fatura dela vence.
 * Devolve as transações com as compras do cartão datadas no vencimento da fatura;
 * as demais (conta corrente, Pix, estornos do cartão) ficam como estão.
 */
export function toBillPaymentDates<
  T extends {
    date: Date;
    amount: number;
    accountId: string;
    accountType?: string | null;
    billForecastMonth?: string | null;
  },
>(txs: T[], cards: CardPaymentCalendar[]): T[] {
  if (cards.length === 0) return txs;
  const byAccount = new Map(cards.map((card) => [card.accountId, card]));
  return txs.map((tx) => {
    if (!isCreditAccount(tx.accountType)) return tx;
    if (!isTransactionOutflow(tx.amount, tx.accountType)) return tx;
    const card = byAccount.get(tx.accountId);
    if (!card) return tx;
    const dueKey = cardChargeDueDateKey(card, {
      date: toLocalDateKey(tx.date),
      billMonth: tx.billForecastMonth,
    });
    return dueKey ? { ...tx, date: dateKeyToNoonUtc(dueKey) } : tx;
  });
}
