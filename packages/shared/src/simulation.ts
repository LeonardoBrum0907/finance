import { z } from "zod";
import {
  getPaydayCycleRange,
  type PaydayCycleAnchor,
  DEFAULT_PAYDAY_CYCLE_ANCHOR,
} from "./payday.js";
import { computeCreditBillImpacts, type CreditAccountSnapshot, type CreditBillImpact } from "./creditBill.js";

export const SIMULATED_PAYMENT_METHODS = [
  "pix",
  "debit",
  "credit_single",
  "credit_installments",
] as const;

export type SimulatedPaymentMethod = (typeof SIMULATED_PAYMENT_METHODS)[number];

export interface SimulatedInstallment {
  id: string;
  dueDate: string;
  amount: number;
}

export interface SimulatedPurchase {
  id: string;
  title: string;
  category?: string;
  paymentMethod: SimulatedPaymentMethod;
  totalAmount: number;
  purchaseDate: string;
  creditAccountId?: string;
  installments: SimulatedInstallment[];
  interestRate?: number;
  createdAt: string;
}

export interface SimulationCycleRange {
  from: string;
  to: string;
}

export interface SimulationCycleImpact {
  realizedExpenses: number;
  committedExpenses: number;
  totalInPeriod: number;
}

export interface PaydayCycleImpact extends SimulationCycleImpact {
  cycleKey: string;
  from: string;
  to: string;
}

export interface SimulationStatDelta {
  /** Despesas realizadas adicionadas pela simulação. */
  expenses: number;
  /** Impacto no saldo realizado (−realizedExpenses). */
  net: number;
  /** Compromissos futuros adicionados pela simulação. */
  committedExpenses: number;
}

export interface FlatSimulatedRow {
  id: string;
  purchaseId: string;
  title: string;
  category?: string;
  dueDate: string;
  amount: number;
  sequence: number;
  totalInstallments: number;
  paymentMethod: SimulatedPaymentMethod;
}

export const simulatedPurchaseInputSchema = z
  .object({
    title: z.string().min(1, "Informe a descrição").max(120),
    category: z.string().max(80).optional(),
    paymentMethod: z.enum(SIMULATED_PAYMENT_METHODS),
    totalAmount: z.number().positive("Valor total deve ser positivo"),
    purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    creditAccountId: z.string().optional(),
    totalInstallments: z.number().int().min(1).max(48).optional(),
    firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional(),
    interestRate: z.number().min(0).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    const isCredit =
      data.paymentMethod === "credit_single" || data.paymentMethod === "credit_installments";
    if (isCredit && !data.creditAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione um cartão de crédito",
        path: ["creditAccountId"],
      });
    }
    if (data.paymentMethod === "credit_installments") {
      if (!data.totalInstallments || data.totalInstallments < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Mínimo 2 parcelas",
          path: ["totalInstallments"],
        });
      }
      if (!data.firstDueDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe a data da 1ª parcela",
          path: ["firstDueDate"],
        });
      }
    }
  });

export type SimulatedPurchaseInput = z.infer<typeof simulatedPurchaseInputSchema>;

/** @deprecated Use SimulatedPurchaseInput com paymentMethod. */
export interface LegacySimulatedPurchaseInput {
  title: string;
  category?: string;
  totalAmount: number;
  totalInstallments: number;
  firstDueDate: string;
}

function parseDateKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

function addMonthsToDateKey(key: string, months: number): string {
  const { y, m, d } = parseDateKey(key);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildInstallmentSchedule(params: {
  totalAmount: number;
  totalInstallments: number;
  firstDueDate: string;
  idPrefix?: string;
}): SimulatedInstallment[] {
  const { totalAmount, totalInstallments, firstDueDate, idPrefix = "sim" } = params;
  const base = roundMoney(totalAmount / totalInstallments);
  const installments: SimulatedInstallment[] = [];

  let allocated = 0;
  for (let i = 0; i < totalInstallments; i++) {
    const isLast = i === totalInstallments - 1;
    const amount = isLast ? roundMoney(totalAmount - allocated) : base;
    allocated = roundMoney(allocated + amount);
    installments.push({
      id: `${idPrefix}-inst-${i + 1}`,
      dueDate: addMonthsToDateKey(firstDueDate, i),
      amount,
    });
  }

  return installments;
}

function buildInstallmentsForInput(
  input: SimulatedPurchaseInput,
  idPrefix: string,
): SimulatedInstallment[] {
  if (input.paymentMethod === "pix" || input.paymentMethod === "debit") {
    return [
      {
        id: `${idPrefix}-inst-1`,
        dueDate: input.purchaseDate,
        amount: input.totalAmount,
      },
    ];
  }

  if (input.paymentMethod === "credit_single") {
    return [
      {
        id: `${idPrefix}-inst-1`,
        dueDate: input.purchaseDate,
        amount: input.totalAmount,
      },
    ];
  }

  return buildInstallmentSchedule({
    totalAmount: input.totalAmount,
    totalInstallments: input.totalInstallments!,
    firstDueDate: input.firstDueDate!,
    idPrefix,
  });
}

export function createSimulatedPurchase(
  input: SimulatedPurchaseInput,
  id = `sim-${Date.now()}`,
): SimulatedPurchase {
  return {
    id,
    title: input.title.trim(),
    category: input.category?.trim() || undefined,
    paymentMethod: input.paymentMethod,
    totalAmount: input.totalAmount,
    purchaseDate: input.purchaseDate,
    creditAccountId: input.creditAccountId,
    installments: buildInstallmentsForInput(input, id),
    interestRate: input.interestRate,
    createdAt: new Date().toISOString(),
  };
}

/** Normaliza compras legadas (sem paymentMethod) para o modelo v2. */
export function normalizeSimulatedPurchase(purchase: SimulatedPurchase | LegacySimulatedPurchase): SimulatedPurchase {
  if ("paymentMethod" in purchase && purchase.paymentMethod) {
    return purchase as SimulatedPurchase;
  }

  const legacy = purchase as LegacySimulatedPurchase;
  return {
    id: legacy.id,
    title: legacy.title,
    category: legacy.category,
    paymentMethod: "credit_installments",
    totalAmount: legacy.installments.reduce((s, i) => s + i.amount, 0),
    purchaseDate: legacy.installments[0]?.dueDate ?? todayDateKeyInTimeZone(),
    installments: legacy.installments,
    createdAt: legacy.createdAt,
  };
}

interface LegacySimulatedPurchase {
  id: string;
  title: string;
  category?: string;
  installments: SimulatedInstallment[];
  createdAt: string;
}

function isDateInRange(date: string, range: SimulationCycleRange): boolean {
  if (date < range.from) return false;
  if (date > range.to) return false;
  return true;
}

function computeCycleImpactForPurchases(
  purchases: SimulatedPurchase[],
  cycleRange: SimulationCycleRange,
  today: string,
): SimulationCycleImpact {
  let realizedExpenses = 0;
  let committedExpenses = 0;

  for (const purchase of purchases) {
    for (const inst of purchase.installments) {
      if (!isDateInRange(inst.dueDate, cycleRange)) continue;
      if (inst.dueDate <= today) {
        realizedExpenses = roundMoney(realizedExpenses + inst.amount);
      } else {
        committedExpenses = roundMoney(committedExpenses + inst.amount);
      }
    }
  }

  const totalInPeriod = roundMoney(realizedExpenses + committedExpenses);
  return { realizedExpenses, committedExpenses, totalInPeriod };
}

export function computeSimulationCycleImpact(
  purchases: SimulatedPurchase[],
  cycleRange: SimulationCycleRange,
  today: string,
): SimulationCycleImpact {
  const normalized = purchases.map(normalizeSimulatedPurchase);
  return computeCycleImpactForPurchases(normalized, cycleRange, today);
}

export interface PaydayCycleInput {
  cycleKey: string;
  from: string;
  to: string;
}

export function computePaydayCycleImpacts(
  purchases: SimulatedPurchase[],
  cycles: PaydayCycleInput[],
  today: string,
): PaydayCycleImpact[] {
  const normalized = purchases.map(normalizeSimulatedPurchase);
  return cycles.map((cycle) => ({
    cycleKey: cycle.cycleKey,
    from: cycle.from,
    to: cycle.to,
    ...computeCycleImpactForPurchases(normalized, { from: cycle.from, to: cycle.to }, today),
  }));
}

/** Ciclo atual + N−1 ciclos futuros para projeção de simulação (ex.: 2 = atual + próximo). */
export function buildSimulationPaydayCycles(
  currentCycle: PaydayCycleInput,
  paydayDay: number,
  anchor: PaydayCycleAnchor = DEFAULT_PAYDAY_CYCLE_ANCHOR,
  futureCount = 2,
): PaydayCycleInput[] {
  const cycles: PaydayCycleInput[] = [currentCycle];
  let ref = new Date(`${currentCycle.to}T12:00:00.000Z`);
  ref.setUTCDate(ref.getUTCDate() + 1);

  for (let i = 1; i < futureCount; i++) {
    const range = getPaydayCycleRange(paydayDay, ref, anchor);
    cycles.push({ cycleKey: range.cycleKey, from: range.from, to: range.to });
    ref = new Date(`${range.to}T12:00:00.000Z`);
    ref.setUTCDate(ref.getUTCDate() + 1);
  }

  return cycles;
}

export { computeCreditBillImpacts, type CreditAccountSnapshot, type CreditBillImpact };

export function computeSimulationStatDelta(impact: SimulationCycleImpact): SimulationStatDelta {
  return {
    expenses: impact.realizedExpenses,
    net: -impact.realizedExpenses,
    committedExpenses: impact.committedExpenses,
  };
}

export function flattenSimulatedRows(purchases: SimulatedPurchase[]): FlatSimulatedRow[] {
  const rows: FlatSimulatedRow[] = [];
  for (const purchase of purchases.map(normalizeSimulatedPurchase)) {
    const total = purchase.installments.length;
    purchase.installments.forEach((inst, index) => {
      rows.push({
        id: inst.id,
        purchaseId: purchase.id,
        title: purchase.title,
        category: purchase.category,
        dueDate: inst.dueDate,
        amount: inst.amount,
        sequence: index + 1,
        totalInstallments: total,
        paymentMethod: purchase.paymentMethod,
      });
    });
  }
  return rows.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
}

/** PIX e débito saem do fluxo à vista; crédito entra na fatura. */
export function isCashLikeSimulatedPayment(method: SimulatedPaymentMethod): boolean {
  return method === "pix" || method === "debit";
}

export function filterCashSimulatedPurchases(purchases: SimulatedPurchase[]): SimulatedPurchase[] {
  return purchases.filter((p) => isCashLikeSimulatedPayment(p.paymentMethod));
}

export function paymentMethodLabel(method: SimulatedPaymentMethod): string {
  switch (method) {
    case "pix":
      return "PIX";
    case "debit":
      return "Débito";
    case "credit_single":
      return "Crédito 1x";
    case "credit_installments":
      return "Crédito parcelado";
  }
}

export function todayDateKeyInTimeZone(timeZone = "America/Sao_Paulo"): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone });
}
