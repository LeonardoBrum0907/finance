import { z } from "zod";

export interface SimulatedInstallment {
  id: string;
  dueDate: string;
  amount: number;
}

export interface SimulatedPurchase {
  id: string;
  title: string;
  category?: string;
  installments: SimulatedInstallment[];
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
}

export const simulatedPurchaseInputSchema = z.object({
  title: z.string().min(1, "Informe a descrição").max(120),
  category: z.string().max(80).optional(),
  totalAmount: z.number().positive("Valor total deve ser positivo"),
  totalInstallments: z.number().int().min(2, "Mínimo 2 parcelas").max(48),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
});

export type SimulatedPurchaseInput = z.infer<typeof simulatedPurchaseInputSchema>;

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

export function createSimulatedPurchase(
  input: SimulatedPurchaseInput,
  id = `sim-${Date.now()}`,
): SimulatedPurchase {
  return {
    id,
    title: input.title.trim(),
    category: input.category?.trim() || undefined,
    installments: buildInstallmentSchedule({
      totalAmount: input.totalAmount,
      totalInstallments: input.totalInstallments,
      firstDueDate: input.firstDueDate,
      idPrefix: id,
    }),
    createdAt: new Date().toISOString(),
  };
}

function isDateInRange(date: string, range: SimulationCycleRange): boolean {
  if (date < range.from) return false;
  if (date > range.to) return false;
  return true;
}

export function computeSimulationCycleImpact(
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

export function computeSimulationStatDelta(impact: SimulationCycleImpact): SimulationStatDelta {
  return {
    expenses: impact.realizedExpenses,
    net: -impact.realizedExpenses,
    committedExpenses: impact.committedExpenses,
  };
}

export function flattenSimulatedRows(purchases: SimulatedPurchase[]): FlatSimulatedRow[] {
  const rows: FlatSimulatedRow[] = [];
  for (const purchase of purchases) {
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
      });
    });
  }
  return rows.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
}

export function todayDateKeyInTimeZone(timeZone = "America/Sao_Paulo"): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone });
}
