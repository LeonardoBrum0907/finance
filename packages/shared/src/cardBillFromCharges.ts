import {
  addDaysToDateKey,
  closeDateForDue,
  nextDayOfMonthOnOrAfter,
  type PersistedCardStatement,
} from "./creditBill.js";
import { isCreditCardBillPayment } from "./transactions.js";

/**
 * Lançamento do cartão com a fatura a que a Pluggy o ligou
 * (`creditCardMetadata.billId`). Valor positivo = compra; negativo = crédito.
 */
export interface CardChargeWithBill {
  date: string;
  amount: number;
  billId: string | null;
  category?: string | null;
  description?: string | null;
}

/** Fatura que a Pluggy já publicou em /bills (o id é o mesmo `billId` das transações). */
export interface PublishedCardBill extends PersistedCardStatement {
  id: string;
}

export interface DerivedCardBill extends PersistedCardStatement {
  billId: string;
  closingDate: string;
}

export interface CardBillSummary {
  closedBillAmount: number | null;
  closedBillDueDate: string | null;
  closedBillClosingDate: string | null;
  /** Compras feitas depois do fechamento da última fatura fechada. */
  openBillAmount: number | null;
  openBillDueDate: string | null;
}

const EMPTY_SUMMARY: CardBillSummary = {
  closedBillAmount: null,
  closedBillDueDate: null,
  closedBillClosingDate: null,
  openBillAmount: null,
  openBillDueDate: null,
};

const PAYMENT_TOLERANCE = 0.01;
const PAYMENT_DESCRIPTIONS = ["pagamento recebido", "pagamento efetuado", "pagamento de fatura"];

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Pagamento da fatura anterior que a Pluggy lança dentro da fatura seguinte.
 * Não é gasto: somado à fatura, derrubaria o total (no Itaú, 2.806,79 viraria -358,83).
 *
 * @example isCardBillPayment({ amount: -3165.62, description: "PAGAMENTO" }, [3165.62]) // true
 */
export function isCardBillPayment(
  charge: Pick<CardChargeWithBill, "amount" | "category" | "description">,
  knownBillTotals: number[],
): boolean {
  if (charge.amount >= 0) return false;
  if (isCreditCardBillPayment(charge.category, charge.description)) return true;
  const text = (charge.description ?? "").toLowerCase();
  if (PAYMENT_DESCRIPTIONS.some((marker) => text.includes(marker))) return true;
  const paid = Math.abs(charge.amount);
  return knownBillTotals.some((total) => Math.abs(total - paid) <= PAYMENT_TOLERANCE);
}

function groupChargesByBill(charges: CardChargeWithBill[]): Map<string, CardChargeWithBill[]> {
  const groups = new Map<string, CardChargeWithBill[]>();
  for (const charge of charges) {
    if (!charge.billId) continue;
    const group = groups.get(charge.billId) ?? [];
    group.push(charge);
    groups.set(charge.billId, group);
  }
  return groups;
}

function deriveOneBill(
  billId: string,
  group: CardChargeWithBill[],
  knownBillTotals: number[],
  days: { dueDay: number; closeDay: number },
): DerivedCardBill | null {
  const spending = group.filter((charge) => !isCardBillPayment(charge, knownBillTotals));
  if (spending.length === 0) return null;
  const lastChargeDate = spending.map((c) => c.date).sort().at(-1)!;
  const closingDate = nextDayOfMonthOnOrAfter(lastChargeDate, days.closeDay);
  const dueDate = nextDayOfMonthOnOrAfter(addDaysToDateKey(closingDate, 1), days.dueDay);
  const totalAmount = roundMoney(spending.reduce((sum, c) => sum + c.amount, 0));
  return { billId, closingDate, dueDate, totalAmount };
}

/**
 * Monta as faturas que já fecharam mas a Pluggy ainda não publicou em /bills,
 * somando as compras que ela marcou com o mesmo `billId`. Grupo cujo fechamento
 * ainda não chegou fica de fora: é a fatura aberta.
 *
 * @example
 * deriveUnpublishedBills(charges, published, { dueDay: 28, closeDay: 21 }, "2026-11-24")
 * // [{ billId: "5d81…", closingDate: "2026-11-21", dueDate: "2026-11-28", totalAmount: 2806.79 }]
 */
export function deriveUnpublishedBills(
  charges: CardChargeWithBill[],
  published: PublishedCardBill[],
  days: { dueDay: number; closeDay: number },
  today: string,
): DerivedCardBill[] {
  const publishedIds = new Set(published.map((bill) => bill.id));
  const knownTotals = published.map((bill) => bill.totalAmount);
  const derived: DerivedCardBill[] = [];
  for (const [billId, group] of groupChargesByBill(charges)) {
    if (publishedIds.has(billId)) continue;
    const bill = deriveOneBill(billId, group, knownTotals, days);
    if (bill && bill.closingDate <= today) derived.push(bill);
  }
  return derived;
}

function latestClosedStatement(
  statements: PersistedCardStatement[],
  closeDay: number,
  today: string,
): (PersistedCardStatement & { closingDate: string }) | null {
  const closed = statements
    .map((s) => ({ ...s, closingDate: s.closingDate ?? closeDateForDue(s.dueDate, closeDay) }))
    .filter((s) => s.closingDate <= today)
    .sort((a, b) => b.closingDate.localeCompare(a.closingDate));
  return closed[0] ?? null;
}

/**
 * Fatura fechada mais recente (publicada ou derivada) e o que já entrou depois
 * do fechamento. Nunca usa o saldo do cartão, que na Pluggy é o limite usado.
 *
 * @example summarizeCardBills(statements, charges, { dueDay: 28, closeDay: 21 }, "2026-11-24").closedBillAmount // 2806.79
 */
export function summarizeCardBills(
  statements: PersistedCardStatement[],
  charges: CardChargeWithBill[],
  days: { dueDay: number; closeDay: number },
  today: string,
): CardBillSummary {
  const closed = latestClosedStatement(statements, days.closeDay, today);
  if (!closed) return EMPTY_SUMMARY;
  const knownTotals = statements.map((s) => s.totalAmount);
  const afterClose = charges.filter(
    (c) => c.date > closed.closingDate && c.date <= today && !isCardBillPayment(c, knownTotals),
  );
  const open = roundMoney(afterClose.reduce((sum, c) => sum + c.amount, 0));
  return {
    closedBillAmount: roundMoney(closed.totalAmount),
    closedBillDueDate: closed.dueDate,
    closedBillClosingDate: closed.closingDate,
    openBillAmount: open > 0 ? open : null,
    openBillDueDate: nextDayOfMonthOnOrAfter(addDaysToDateKey(closed.dueDate, 1), days.dueDay),
  };
}
