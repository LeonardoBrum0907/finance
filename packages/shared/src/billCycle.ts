import { cardChargeDueDateKey, type CardPaymentCalendar } from "./cardPaymentDate.js";
import {
  cyclePeriodEnd,
  resolveCardBillPaid,
  resolveCyclePaid,
  type BillPaid,
  type BillPaidSource,
  type BillPaymentEvent,
} from "./billPaidDate.js";
import {
  addDaysToDateKey,
  closeDateForDue,
  dateKeyForDayInMonth,
  resolveStatementDays,
  type CardForCycleBills,
  type CheckingPaymentLike,
} from "./creditBill.js";
import { isCreditAccount, isCreditCardBillPayment } from "./transactions.js";

/**
 * Ciclo da fatura: o mês é organizado em torno da fatura do cartão. As compras do
 * período da fatura são pagas no vencimento com o saldo em conta (a sobra do ciclo
 * anterior) mais o salário que cai até o vencimento, menos o que sai da conta (Pix,
 * débito, contas) até lá. A pergunta que o ciclo responde é "quanto ainda posso
 * gastar no cartão".
 *
 * O ciclo fecha no dia em que todas as faturas do mês são pagas (antes ou depois do
 * vencimento); o seguinte começa no outro dia. Enquanto não há pagamento, o vencimento
 * é a previsão de fechamento.
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

/** Fatura marcada como paga à mão ("Marcar fatura como paga"). */
export interface ManualBillPaid {
  accountId: string;
  /** Mês da fatura (AAAA-MM). */
  billMonth: string;
  paidOn: string;
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
  /** Faturas que a pessoa marcou como pagas. */
  manualPaidBills?: ManualBillPaid[];
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
  /** Dia em que esta fatura foi paga (ou suposta paga). */
  paidOn: string | null;
  paidSource: BillPaidSource | null;
}

export interface BillCycleSummary {
  /** Mês da fatura (AAAA-MM). */
  cycleKey: string;
  status: BillCycleStatus;
  /** Período de compras (do dia seguinte ao fechamento anterior até o fechamento). */
  purchaseFrom: string;
  purchaseTo: string;
  dueDate: string;
  /** Dia em que todas as faturas do mês ficaram pagas; null enquanto falta alguma. */
  paidOn: string | null;
  paidSource: BillPaidSource | null;
  /** Período do ciclo: do dia seguinte ao fechamento do anterior até o pagamento. */
  periodFrom: string;
  periodTo: string;
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
  /** Fatura das compras de hoje. */
  currentCycleKey: string;
  /** Ciclo em andamento: o primeiro com fatura ainda não paga. */
  openCycleKey: string;
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

/** Débitos de pagamento de fatura na conta corrente, com valor positivo. */
function checkingBillPayments(payments: CheckingPaymentLike[]): BillPaymentEvent[] {
  return payments
    .filter((tx) => !isCreditAccount(tx.accountType) && tx.amount < 0)
    .filter((tx) => isCreditCardBillPayment(tx.category, tx.description))
    .map((tx) => ({
      date: typeof tx.date === "string" ? tx.date.slice(0, 10) : tx.date.toISOString().slice(0, 10),
      amount: Math.abs(tx.amount),
    }));
}

function billPaidFor(
  input: BillCycleInput,
  checkingPayments: BillPaymentEvent[],
  card: CardForCycleBills,
  bill: { month: string; amount: number; closingDate: string; dueDate: string },
): BillPaid | null {
  const manual = input.manualPaidBills?.find(
    (mark) => mark.accountId === card.accountId && mark.billMonth === bill.month,
  );
  return resolveCardBillPaid({
    amount: bill.amount,
    closingDate: bill.closingDate,
    dueDate: bill.dueDate,
    cardPayments: card.payments ?? [],
    checkingPayments,
    manualPaidOn: manual?.paidOn ?? null,
    today: input.today,
  });
}

function buildBills(
  input: BillCycleInput,
  month: string,
  checkingPayments: BillPaymentEvent[],
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
    const paid = billPaidFor(input, checkingPayments, card, { month, amount, closingDate, dueDate });

    bills.push({
      accountId: card.accountId,
      accountName: card.accountName,
      dueDate,
      closingDate,
      charged: round(officialTotal ?? charged),
      expected: round(officialTotal === null ? expected : 0),
      amount,
      estimated: officialTotal === null,
      paidOn: paid?.paidOn ?? null,
      paidSource: paid?.source ?? null,
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

interface CycleMoneyState {
  running: number;
  /** Dinheiro já contado até este dia (exclusive daqui para frente). */
  boundary: string;
}

/** Conta de dinheiro de um ciclo ainda não pago, de `state.boundary` até `periodTo`. */
function cycleMoney(
  input: BillCycleInput,
  state: CycleMoneyState,
  cycle: { dueDate: string; periodTo: string; billTotal: number },
): NonNullable<BillCycleSummary["money"]> {
  const paydays = input.paydayDay ? paydaysBetween(state.boundary, cycle.periodTo, input.paydayDay) : [];
  const toCount = paydays.filter((day) => !salaryAlreadyReceived(day, input.salaryReceivedDates));
  const salary = round(toCount.length * input.expectedSalary);

  let salaryAfterDue: string | null = null;
  if (input.paydayDay && toCount.length === 0) {
    const late = paydaysBetween(cycle.dueDate, addDaysToDateKey(cycle.dueDate, SALARY_LATE_WINDOW_DAYS), input.paydayDay);
    if (late.length > 0 && !salaryAlreadyReceived(late[0]!, input.salaryReceivedDates)) {
      salaryAfterDue = late[0]!;
    }
  }

  const cashItems = input.scheduledCash
    .filter((item) => item.date > state.boundary && item.date <= cycle.periodTo)
    .sort((a, b) => a.date.localeCompare(b.date));
  const cashOutflows = round(cashItems.reduce((sum, item) => sum + item.amount, 0));
  const available = round(state.running + salary - cashOutflows);
  return {
    startingBalance: round(state.running),
    salary,
    salaryDate: toCount[0] ?? null,
    salaryAfterDue,
    cashOutflows,
    cashItems,
    available,
    leftover: round(available - cycle.billTotal),
  };
}

function cycleStatus(
  paid: BillPaid | null,
  today: string,
  window: { purchaseFrom: string; purchaseTo: string },
): BillCycleStatus {
  if (paid) return "paid";
  if (today > window.purchaseTo) return "closed";
  return today >= window.purchaseFrom ? "open" : "future";
}

interface CycleBase {
  window: NonNullable<ReturnType<typeof cycleWindow>>;
  bills: BillCycleCardBill[];
  expectedItems: BillCycleScheduledItem[];
  billTotal: number;
  dueDate: string;
  paid: BillPaid | null;
  periodTo: string;
}

/** Faturas, pagamento e último dia de um mês de fatura. */
function cycleBase(input: BillCycleInput, month: string, checking: BillPaymentEvent[]): CycleBase | null {
  const window = cycleWindow(input, month);
  if (!window) return null;
  const { bills, expectedItems } = buildBills(input, month, checking);
  const billTotal = round(bills.reduce((sum, bill) => sum + bill.amount, 0));
  const dueDate = bills.length ? bills.map((b) => b.dueDate).sort()[0]! : window.dueDate;
  const paid = resolveCyclePaid(
    bills.map((bill) => (bill.paidOn ? { paidOn: bill.paidOn, source: bill.paidSource! } : null)),
    dueDate,
    input.today,
  );
  const periodTo = cyclePeriodEnd(paid, dueDate, input.today);
  return { window, bills, expectedItems, billTotal, dueDate, paid, periodTo };
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

  const checking = checkingBillPayments(input.checkingPayments);
  const state: CycleMoneyState = { running: input.bankBalance, boundary: input.today };
  const before = cycleBase(input, shiftMonth(months[0]!, -1), checking);
  let previousEnd = before?.periodTo ?? null;
  const cycles: BillCycleSummary[] = [];

  for (const month of months) {
    const base = cycleBase(input, month, checking);
    if (!base) continue;
    const periodFrom = previousEnd ? addDaysToDateKey(previousEnd, 1) : base.window.purchaseFrom;
    // Pagamento registrado antes do fim do ciclo anterior não encolhe o período a nada.
    const periodTo = base.periodTo < periodFrom ? periodFrom : base.periodTo;
    previousEnd = periodTo;

    let money: BillCycleSummary["money"] = null;
    if (!base.paid) {
      money = cycleMoney(input, state, { dueDate: base.dueDate, periodTo, billTotal: base.billTotal });
      state.running = money.leftover;
      if (periodTo > state.boundary) state.boundary = periodTo;
    }

    cycles.push({
      cycleKey: month,
      status: cycleStatus(base.paid, input.today, base.window),
      purchaseFrom: base.window.purchaseFrom,
      purchaseTo: base.window.purchaseTo,
      dueDate: base.dueDate,
      paidOn: base.paid?.paidOn ?? null,
      paidSource: base.paid?.source ?? null,
      periodFrom,
      periodTo,
      bills: base.bills,
      billTotal: base.billTotal,
      expectedCardItems: base.expectedItems,
      money,
    });
  }

  return {
    currentCycleKey: currentMonth,
    openCycleKey: cycles.find((cycle) => !cycle.paidOn)?.cycleKey ?? currentMonth,
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
