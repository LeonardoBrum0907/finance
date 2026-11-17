import { cardChargeDueDateKey, type CardPaymentCalendar } from "./cardPaymentDate.js";
import {
  addDaysToDateKey,
  closeDateForDue,
  dateKeyForDayInMonth,
  isCreditBillAlreadyPaid,
  resolveStatementDays,
  type CardForCycleBills,
  type CheckingPaymentLike,
} from "./creditBill.js";

/**
 * Ciclo da fatura: o mês é organizado em torno da fatura do cartão. As compras do
 * período da fatura são pagas no vencimento com o saldo em conta (a sobra do ciclo
 * anterior) mais o salário que cai até o vencimento, menos o que sai da conta (Pix,
 * débito, contas) até lá. A pergunta que o ciclo responde é "quanto ainda posso
 * gastar no cartão".
 */

export type BillCycleStatus = "paid" | "closed" | "open" | "future";

export interface BillCycleScheduledItem {
  id: string;
  title: string;
  /** Data da saída (AAAA-MM-DD). Para cobrança no cartão, a data da cobrança. */
  date: string;
  amount: number;
}

export interface BillCycleCardItem extends BillCycleScheduledItem {
  cardAccountId: string;
  /** Mês da fatura já conhecido (ex.: parcela do cartão). Sem ele, vale a data. */
  billMonth?: string | null;
}

export interface BillCycleInput {
  today: string;
  /** Saldo hoje nas contas correntes. */
  bankBalance: number;
  paydayDay: number | null;
  /** Valor do salário esperado (o último recebido). */
  expectedSalary: number;
  /** Datas dos salários já recebidos (já estão no saldo). */
  salaryReceivedDates: string[];
  cards: CardForCycleBills[];
  /** Movimentos da conta corrente, para saber se a fatura já foi paga. */
  checkingPayments: CheckingPaymentLike[];
  /** Saídas previstas da conta corrente (contas, parcelas no Pix, agendamentos). */
  scheduledCash: BillCycleScheduledItem[];
  /** Cobranças previstas no cartão que ainda não apareceram (assinaturas, parcelas). */
  scheduledCard: BillCycleCardItem[];
  pastCycles?: number;
  futureCycles?: number;
}

export interface BillCycleCardBill {
  accountId: string;
  accountName: string;
  dueDate: string;
  closingDate: string;
  /** Compras já lançadas (ou o total da fatura fechada). */
  charged: number;
  /** Cobranças previstas que ainda vão cair nesta fatura. */
  expected: number;
  amount: number;
  /** Fatura ainda aberta ou sem total oficial da Pluggy. */
  estimated: boolean;
}

export interface BillCycleSummary {
  /** Mês da fatura (AAAA-MM). */
  cycleKey: string;
  status: BillCycleStatus;
  /** Período de compras (do dia seguinte ao fechamento anterior até o fechamento). */
  purchaseFrom: string;
  purchaseTo: string;
  dueDate: string;
  bills: BillCycleCardBill[];
  billTotal: number;
  /** Itens previstos que entram na fatura. */
  expectedCardItems: BillCycleScheduledItem[];
  /** Só para ciclos ainda não pagos. */
  money: {
    startingBalance: number;
    salary: number;
    salaryDate: string | null;
    /** Salário que cai depois do vencimento e não chega a tempo. */
    salaryAfterDue: string | null;
    cashOutflows: number;
    cashItems: BillCycleScheduledItem[];
    available: number;
    /** Ainda posso gastar no cartão (ou sobra depois de pagar, se já fechou). */
    leftover: number;
  } | null;
}

export interface BillCyclesResult {
  currentCycleKey: string;
  cycles: BillCycleSummary[];
  /** Calendário dos cartões, para saber em que fatura cai cada cobrança. */
  cards: CardPaymentCalendar[];
}

/**
 * Em que ciclo da fatura cai uma saída. No cartão, é a fatura da cobrança; na conta
 * corrente, o ciclo cujo vencimento é o primeiro na data da saída ou depois dela.
 */
export function billCycleKeyForPayment(
  result: Pick<BillCyclesResult, "cycles" | "cards">,
  payment: { date: string; cardAccountId?: string | null; billMonth?: string | null },
): string | null {
  const card = payment.cardAccountId
    ? result.cards.find((c) => c.accountId === payment.cardAccountId)
    : undefined;
  if (card) {
    if (payment.billMonth) return payment.billMonth;
    return cardChargeDueDateKey(card, { date: payment.date })?.slice(0, 7) ?? null;
  }
  const date = payment.date.slice(0, 10);
  return result.cycles.find((cycle) => cycle.dueDate >= date)?.cycleKey ?? null;
}

const SALARY_MATCH_DAYS = 4;
const SALARY_LATE_WINDOW_DAYS = 7;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y! * 12 + (m! - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T12:00:00.000Z`) - Date.parse(`${a}T12:00:00.000Z`)) / 86_400_000,
  );
}

function cardDueForMonth(card: CardForCycleBills, month: string, dueDay: number): string {
  const statement = card.statements.find((s) => s.dueDate.startsWith(month));
  if (statement) return statement.dueDate;
  const [y, m] = month.split("-").map(Number);
  return dateKeyForDayInMonth(y!, m!, dueDay);
}

function chargeMonth(card: CardForCycleBills, charge: { date: string; billMonth?: string | null }) {
  return cardChargeDueDateKey(card, charge)?.slice(0, 7) ?? null;
}

/** Paydays (dia do salário) em (after, until]. */
function paydaysBetween(after: string, until: string, paydayDay: number): string[] {
  const result: string[] = [];
  let month = after.slice(0, 7);
  for (let i = 0; i < 3; i++) {
    const [y, m] = month.split("-").map(Number);
    const key = dateKeyForDayInMonth(y!, m!, paydayDay);
    if (key > after && key <= until) result.push(key);
    month = shiftMonth(month, 1);
  }
  return result;
}

function salaryAlreadyReceived(payday: string, received: string[]): boolean {
  return received.some((date) => Math.abs(daysBetween(payday, date)) <= SALARY_MATCH_DAYS);
}

function buildBills(
  input: BillCycleInput,
  month: string,
): { bills: BillCycleCardBill[]; expectedItems: BillCycleScheduledItem[] } {
  const bills: BillCycleCardBill[] = [];
  const expectedItems: BillCycleScheduledItem[] = [];

  for (const card of input.cards) {
    const days = resolveStatementDays(card);
    if (!days) continue;
    const dueDate = cardDueForMonth(card, month, days.dueDay);
    const statement = card.statements.find((s) => s.dueDate.startsWith(month));
    const closingDate = statement?.closingDate ?? closeDateForDue(dueDate, days.closeDay);
    const closedByPluggy = !!statement && closingDate < input.today;

    let charged = 0;
    for (const charge of card.charges) {
      if (chargeMonth(card, charge) === month) charged += charge.amount;
    }

    let expected = 0;
    if (!closedByPluggy) {
      for (const item of input.scheduledCard) {
        if (item.cardAccountId !== card.accountId) continue;
        // Cobrança prevista que atrasou ainda deve cair: conta como se caísse hoje.
        const date = item.date < input.today ? input.today : item.date;
        if (chargeMonth(card, { date, billMonth: item.billMonth }) !== month) continue;
        expected += item.amount;
        expectedItems.push({ id: item.id, title: item.title, date: dueDate, amount: item.amount });
      }
    }

    const officialTotal = closedByPluggy ? statement!.totalAmount : null;
    const amount = round(officialTotal ?? charged + expected);
    if (amount <= 0 && charged <= 0) continue;

    bills.push({
      accountId: card.accountId,
      accountName: card.accountName,
      dueDate,
      closingDate,
      charged: round(officialTotal ?? charged),
      expected: round(officialTotal === null ? expected : 0),
      amount,
      estimated: officialTotal === null,
    });
  }

  return { bills, expectedItems };
}

function cycleWindow(input: BillCycleInput, month: string): {
  purchaseFrom: string;
  purchaseTo: string;
  dueDate: string;
} | null {
  const card = input.cards.find((c) => resolveStatementDays(c));
  if (!card) return null;
  const days = resolveStatementDays(card)!;
  const dueDate = cardDueForMonth(card, month, days.dueDay);
  const purchaseTo =
    card.statements.find((s) => s.dueDate === dueDate)?.closingDate ??
    closeDateForDue(dueDate, days.closeDay);
  const previousDue = cardDueForMonth(card, shiftMonth(month, -1), days.dueDay);
  const previousClose =
    card.statements.find((s) => s.dueDate === previousDue)?.closingDate ??
    closeDateForDue(previousDue, days.closeDay);
  return { purchaseFrom: addDaysToDateKey(previousClose, 1), purchaseTo, dueDate };
}

/** Monta os ciclos da fatura: alguns já pagos, o atual e os próximos, com a sobra encadeada. */
export function buildBillCycles(input: BillCycleInput): BillCyclesResult | null {
  const primary = input.cards.find((c) => resolveStatementDays(c));
  if (!primary) return null;

  const currentMonth = chargeMonth(primary, { date: input.today });
  if (!currentMonth) return null;

  const past = input.pastCycles ?? 3;
  const future = input.futureCycles ?? 2;
  const months: string[] = [];
  for (let delta = -past; delta <= future; delta++) months.push(shiftMonth(currentMonth, delta));

  let running = input.bankBalance;
  let boundary = input.today;
  const cycles: BillCycleSummary[] = [];

  for (const month of months) {
    const window = cycleWindow(input, month);
    if (!window) continue;
    const { bills, expectedItems } = buildBills(input, month);
    const billTotal = round(bills.reduce((sum, bill) => sum + bill.amount, 0));
    const dueDate = bills.length
      ? bills.map((b) => b.dueDate).sort()[0]!
      : window.dueDate;

    const paid =
      dueDate < input.today ||
      (input.today > window.purchaseTo &&
        billTotal > 0 &&
        isCreditBillAlreadyPaid(billTotal, dueDate, input.checkingPayments));

    const status: BillCycleStatus = paid
      ? "paid"
      : input.today > window.purchaseTo
        ? "closed"
        : input.today >= window.purchaseFrom
          ? "open"
          : "future";

    let money: BillCycleSummary["money"] = null;
    if (!paid) {
      const paydays = input.paydayDay ? paydaysBetween(boundary, dueDate, input.paydayDay) : [];
      const toCount = paydays.filter((day) => !salaryAlreadyReceived(day, input.salaryReceivedDates));
      const salary = round(toCount.length * input.expectedSalary);

      let salaryAfterDue: string | null = null;
      if (input.paydayDay && toCount.length === 0) {
        const late = paydaysBetween(dueDate, addDaysToDateKey(dueDate, SALARY_LATE_WINDOW_DAYS), input.paydayDay);
        if (late.length > 0 && !salaryAlreadyReceived(late[0]!, input.salaryReceivedDates)) {
          salaryAfterDue = late[0]!;
        }
      }

      const cashItems = input.scheduledCash
        .filter((item) => item.date > boundary && item.date <= dueDate)
        .sort((a, b) => a.date.localeCompare(b.date));
      const cashOutflows = round(cashItems.reduce((sum, item) => sum + item.amount, 0));
      const available = round(running + salary - cashOutflows);
      const leftover = round(available - billTotal);

      money = {
        startingBalance: round(running),
        salary,
        salaryDate: toCount[0] ?? null,
        salaryAfterDue,
        cashOutflows,
        cashItems,
        available,
        leftover,
      };
      running = leftover;
      boundary = dueDate;
    }

    cycles.push({
      cycleKey: month,
      status,
      purchaseFrom: window.purchaseFrom,
      purchaseTo: window.purchaseTo,
      dueDate,
      bills,
      billTotal,
      expectedCardItems: expectedItems,
      money,
    });
  }

  return {
    currentCycleKey: currentMonth,
    cycles,
    cards: input.cards.map((card) => ({
      accountId: card.accountId,
      billDueDay: card.billDueDay,
      billCloseDay: card.billCloseDay,
      balanceDueDate: card.balanceDueDate,
      balanceCloseDate: card.balanceCloseDate,
      statements: card.statements,
    })),
  };
}
