import { z } from "zod";
import { DASHBOARD_CATEGORY_GROUPS } from "./categoryGroups.js";
import type { SimulationInput } from "./index.js";
import {
  computePaydayCycleImpacts,
  createSimulatedPurchase,
  todayDateKeyInTimeZone,
  type PaydayCycleImpact,
  type PaydayCycleInput,
  type SimulatedPaymentMethod,
  type SimulatedPurchase,
  type SimulatedPurchaseInput,
} from "./simulation.js";

export const SIMULATION_SCENARIO_STATUSES = [
  "draft",
  "active",
  "completed",
  "converted",
  "archived",
] as const;

export type SimulationScenarioStatus = (typeof SIMULATION_SCENARIO_STATUSES)[number];

export const SCENARIO_SIMULATION_TYPES = [
  "single_purchase",
  "installments",
  "recurring_expense",
  "save_for_goal",
  "invest",
] as const;

export type ScenarioSimulationType = (typeof SCENARIO_SIMULATION_TYPES)[number];

export const INVEST_MODES = ["monthly", "lump_sum"] as const;
export type InvestMode = (typeof INVEST_MODES)[number];

export const DETAILED_PAYMENT_METHODS = [
  "pix",
  "debit",
  "credit_single",
  "credit_installments",
  "cash",
  "credit",
] as const;

export type DetailedPaymentMethod = (typeof DETAILED_PAYMENT_METHODS)[number];

const dashboardCategoryGroupSchema = z.enum(DASHBOARD_CATEGORY_GROUPS);

export const simulationPayloadSchema = z.object({
  type: z.enum(SCENARIO_SIMULATION_TYPES),
  name: z.string().max(80).optional(),
  amount: z.number().positive(),
  installments: z.number().int().min(2).max(48).optional(),
  interestRate: z.number().min(0).max(100).optional(),
  durationMonths: z.number().int().min(1).max(120).optional(),
  targetDate: z.string().optional(),
  paymentMethod: z.enum(["cash", "credit"]).optional(),
  paymentMethodDetail: z.enum(DETAILED_PAYMENT_METHODS).optional(),
  creditAccountId: z.string().optional(),
  categoryGroup: dashboardCategoryGroupSchema.optional(),
  category: z.string().max(80).optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  totalInstallments: z.number().int().min(1).max(48).optional(),
  investMode: z.enum(INVEST_MODES).optional(),
  investmentId: z.string().optional(),
  personId: z.string().cuid().optional(),
});

export type SimulationPayload = z.infer<typeof simulationPayloadSchema>;

export const createSimulationScenarioSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  type: z.enum(SCENARIO_SIMULATION_TYPES),
  status: z.enum(SIMULATION_SCENARIO_STATUSES).default("draft"),
  payload: simulationPayloadSchema,
  personId: z.string().cuid().optional(),
  priority: z.number().int().min(0).max(9999).optional(),
});

export type CreateSimulationScenarioInput = z.infer<typeof createSimulationScenarioSchema>;

export const updateSimulationScenarioSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(SIMULATION_SCENARIO_STATUSES).optional(),
  payload: simulationPayloadSchema.optional(),
  personId: z.string().cuid().nullable().optional(),
  priority: z.number().int().min(0).max(9999).optional(),
});

export type UpdateSimulationScenarioInput = z.infer<typeof updateSimulationScenarioSchema>;

export const completeSimulationSchema = z.object({
  transactionId: z.string().cuid().optional(),
  investmentTransactionId: z.string().cuid().optional(),
  note: z.string().max(500).optional(),
});

export type CompleteSimulationInput = z.infer<typeof completeSimulationSchema>;

export const convertScenarioToGoalSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  type: z.enum(["savings", "purchase", "debt_payoff", "emergency_fund", "custom"]).optional(),
  targetAmount: z.number().positive().optional(),
  targetDate: z.string().optional(),
  createPlan: z.boolean().optional(),
  monthlyAllocation: z.number().positive().optional(),
});

export type ConvertScenarioToGoalInput = z.infer<typeof convertScenarioToGoalSchema>;

export interface SimulationScenarioDTO {
  id: string;
  name: string;
  description: string | null;
  type: ScenarioSimulationType;
  status: SimulationScenarioStatus;
  payload: SimulationPayload;
  personId: string | null;
  personName: string | null;
  priority: number;
  linkedTransactionId: string | null;
  linkedInvestmentTxId: string | null;
  linkedGoalId: string | null;
  linkedGoalName: string | null;
  lastVerdict: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionMatchCandidate {
  transactionId: string;
  date: string;
  description: string;
  amount: number;
  accountName: string;
  score: number;
  reasons: string[];
}

export interface TransactionMatchesResponse {
  suggestions: TransactionMatchCandidate[];
  /** Transações recentes fora das sugestões — para seleção manual alternativa */
  recent: TransactionMatchCandidate[];
}

export interface ScenarioCycleBreakdown {
  scenarioId: string;
  scenarioName: string;
  type: ScenarioSimulationType;
  totalInPeriod: number;
  realizedExpenses: number;
  committedExpenses: number;
}

export interface AggregateSimulationImpactDTO {
  currencyCode: string;
  baselineSurplus: number;
  activeCount: number;
  cycleImpacts: PaydayCycleImpact[];
  monthlyPoints: {
    month: string;
    label?: string;
    baselineSurplus: number;
    scenarioSurplus: number;
  }[];
  alerts: string[];
  creditBillIncrease: number;
  scenarioBreakdown: ScenarioCycleBreakdown[][];
  scenarios: SimulationScenarioDTO[];
}

export interface TransactionMatchInput {
  id: string;
  date: string;
  description: string;
  amount: number;
  accountName?: string;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function addMonthsToDateKey(key: string, months: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1 + months, d!));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function resolveDetailedPaymentMethod(payload: SimulationPayload): DetailedPaymentMethod {
  if (payload.paymentMethodDetail) return payload.paymentMethodDetail;
  if (payload.type === "installments") return "credit_installments";
  if (payload.paymentMethod === "credit") return "credit_single";
  return "pix";
}

function resolveSimulatedPaymentMethod(payload: SimulationPayload): SimulatedPaymentMethod {
  const detail = resolveDetailedPaymentMethod(payload);
  if (detail === "cash" || detail === "debit" || detail === "pix") return detail === "debit" ? "debit" : "pix";
  if (detail === "credit" || detail === "credit_single") return "credit_single";
  return "credit_installments";
}

export function payloadToSimulationInput(
  payload: SimulationPayload,
  personId?: string,
): SimulationInput {
  const paymentMethod =
    payload.paymentMethod ??
    (resolveDetailedPaymentMethod(payload).startsWith("credit") ? "credit" : "cash");

  return {
    type: payload.type,
    name: payload.name,
    amount: payload.amount,
    installments: payload.installments ?? payload.totalInstallments,
    interestRate: payload.interestRate,
    durationMonths: payload.durationMonths,
    targetDate: payload.targetDate,
    paymentMethod,
    creditAccountId: payload.creditAccountId,
    categoryGroup: payload.categoryGroup,
    personId: personId ?? payload.personId,
    investMode: payload.investMode,
    investmentId: payload.investmentId,
  };
}

export function simulatedPurchaseInputToPayload(
  input: SimulatedPurchaseInput,
  personId?: string,
): SimulationPayload {
  return {
    type:
      input.paymentMethod === "credit_installments"
        ? "installments"
        : "single_purchase",
    name: input.title,
    amount: input.totalAmount,
    installments: input.totalInstallments,
    totalInstallments: input.totalInstallments,
    interestRate: input.interestRate,
    paymentMethodDetail: input.paymentMethod,
    creditAccountId: input.creditAccountId,
    category: input.category,
    purchaseDate: input.purchaseDate,
    firstDueDate: input.firstDueDate,
    personId,
  };
}

export function payloadToSimulatedPurchase(
  scenarioId: string,
  payload: SimulationPayload,
): SimulatedPurchase | null {
  const today = todayDateKeyInTimeZone();
  const purchaseDate = payload.purchaseDate ?? today;

  if (payload.type === "single_purchase" || payload.type === "installments") {
    const method = resolveSimulatedPaymentMethod(payload);
    const input: SimulatedPurchaseInput = {
      title: payload.name ?? "Simulação",
      category: payload.category,
      paymentMethod: method,
      totalAmount: payload.amount,
      purchaseDate,
      creditAccountId: payload.creditAccountId,
      totalInstallments: payload.totalInstallments ?? payload.installments,
      firstDueDate: payload.firstDueDate ?? purchaseDate,
      interestRate: payload.interestRate,
    };
    return createSimulatedPurchase(input, scenarioId);
  }

  if (payload.type === "recurring_expense") {
    const duration = payload.durationMonths ?? 12;
    const installments = Array.from({ length: duration }, (_, i) => ({
      id: `${scenarioId}-rec-${i + 1}`,
      dueDate: addMonthsToDateKey(purchaseDate, i),
      amount: payload.amount,
    }));
    return {
      id: scenarioId,
      title: payload.name ?? "Despesa recorrente",
      category: payload.category,
      paymentMethod: "pix",
      totalAmount: roundMoney(payload.amount * duration),
      purchaseDate,
      installments,
      createdAt: new Date().toISOString(),
    };
  }

  if (payload.type === "save_for_goal" || payload.type === "invest") {
    const mode = payload.investMode ?? "monthly";
    if (mode === "lump_sum") {
      return createSimulatedPurchase(
        {
          title: payload.name ?? (payload.type === "invest" ? "Investimento" : "Poupança"),
          paymentMethod: "pix",
          totalAmount: payload.amount,
          purchaseDate,
        },
        scenarioId,
      );
    }
    const duration = payload.durationMonths ?? 12;
    const monthly = payload.type === "invest" ? payload.amount : payload.amount / duration;
    const installments = Array.from({ length: duration }, (_, i) => ({
      id: `${scenarioId}-save-${i + 1}`,
      dueDate: addMonthsToDateKey(purchaseDate, i),
      amount: roundMoney(monthly),
    }));
    return {
      id: scenarioId,
      title: payload.name ?? (payload.type === "invest" ? "Aporte mensal" : "Poupança mensal"),
      category: payload.category,
      paymentMethod: "pix",
      totalAmount: roundMoney(monthly * duration),
      purchaseDate,
      installments,
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}

export function scenariosToSimulatedPurchases(
  scenarios: { id: string; payload: SimulationPayload }[],
): SimulatedPurchase[] {
  const purchases: SimulatedPurchase[] = [];
  for (const s of scenarios) {
    const purchase = payloadToSimulatedPurchase(s.id, s.payload);
    if (purchase) purchases.push(purchase);
  }
  return purchases;
}

export function computeAggregateCycleImpact(params: {
  scenarios: { id: string; name: string; type: ScenarioSimulationType; payload: SimulationPayload }[];
  cycles: PaydayCycleInput[];
  today: string;
  baselineSurplus: number;
}): {
  cycleImpacts: PaydayCycleImpact[];
  monthlyPoints: AggregateSimulationImpactDTO["monthlyPoints"];
  alerts: string[];
  scenarioBreakdown: ScenarioCycleBreakdown[][];
} {
  const { scenarios, cycles, today, baselineSurplus } = params;
  const purchases = scenariosToSimulatedPurchases(
    scenarios.map((s) => ({ id: s.id, payload: s.payload })),
  );

  const aggregateImpacts = computePaydayCycleImpacts(purchases, cycles, today);
  const scenarioBreakdown: ScenarioCycleBreakdown[][] = cycles.map(() => []);

  for (const scenario of scenarios) {
    const purchase = payloadToSimulatedPurchase(scenario.id, scenario.payload);
    if (!purchase) continue;
    const impacts = computePaydayCycleImpacts([purchase], cycles, today);
    impacts.forEach((impact, idx) => {
      scenarioBreakdown[idx]!.push({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        type: scenario.type,
        totalInPeriod: impact.totalInPeriod,
        realizedExpenses: impact.realizedExpenses,
        committedExpenses: impact.committedExpenses,
      });
    });
  }

  const alerts: string[] = [];
  const monthlyPoints = aggregateImpacts.map((impact, idx) => {
    const scenarioSurplus = roundMoney(baselineSurplus - impact.totalInPeriod);
    if (baselineSurplus >= 0 && scenarioSurplus < 0) {
      alerts.push(
        `No ciclo ${impact.cycleKey}, os cenários ativos deixariam a sobra negativa (${scenarioSurplus.toFixed(2)}).`,
      );
    }
    return {
      month: impact.cycleKey,
      label: idx === 0 ? `Atual (${impact.cycleKey})` : impact.cycleKey,
      baselineSurplus: roundMoney(baselineSurplus),
      scenarioSurplus,
    };
  });

  return { cycleImpacts: aggregateImpacts, monthlyPoints, alerts, scenarioBreakdown };
}

export function toTransactionMatchCandidate(
  tx: TransactionMatchInput,
): TransactionMatchCandidate {
  return {
    transactionId: tx.id,
    date:
      typeof tx.date === "string"
        ? tx.date.slice(0, 10)
        : new Date(tx.date).toISOString().slice(0, 10),
    description: tx.description,
    amount: tx.amount,
    accountName: tx.accountName ?? "",
    score: 0,
    reasons: [],
  };
}

export function suggestTransactionMatches(
  payload: SimulationPayload,
  transactions: TransactionMatchInput[],
  options?: { amountTolerance?: number; dateWindowDays?: number; referenceDate?: string },
): TransactionMatchCandidate[] {
  const amountTolerance = options?.amountTolerance ?? 0.05;
  const dateWindowDays = options?.dateWindowDays ?? 14;
  const referenceDate = options?.referenceDate ?? payload.purchaseDate ?? todayDateKeyInTimeZone();
  const targetAmount = Math.abs(payload.amount);
  const refTime = new Date(`${referenceDate}T12:00:00.000Z`).getTime();
  const windowMs = dateWindowDays * 24 * 60 * 60 * 1000;

  const candidates: TransactionMatchCandidate[] = [];

  for (const tx of transactions) {
    const txAmount = Math.abs(tx.amount);
    const amountDiff = Math.abs(txAmount - targetAmount);
    const amountRatio = targetAmount > 0 ? amountDiff / targetAmount : 1;
    if (amountRatio > amountTolerance && amountDiff > 1) continue;

    const txTime = new Date(tx.date).getTime();
    const dateDiff = Math.abs(txTime - refTime);
    if (dateDiff > windowMs) continue;

    const reasons: string[] = [];
    let score = 100;

    if (amountRatio <= 0.01) {
      reasons.push("Valor exato");
      score += 30;
    } else if (amountRatio <= amountTolerance) {
      reasons.push("Valor próximo");
      score += 15;
    } else {
      score -= 20;
    }

    const daysDiff = Math.round(dateDiff / (24 * 60 * 60 * 1000));
    if (daysDiff === 0) {
      reasons.push("Mesma data");
      score += 20;
    } else if (daysDiff <= 3) {
      reasons.push(`Data a ${daysDiff} dia(s)`);
      score += 10;
    } else {
      score -= daysDiff;
    }

    if (payload.name && tx.description.toLowerCase().includes(payload.name.toLowerCase().slice(0, 8))) {
      reasons.push("Descrição similar");
      score += 25;
    }

    candidates.push({
      transactionId: tx.id,
      date: typeof tx.date === "string" ? tx.date.slice(0, 10) : new Date(tx.date).toISOString().slice(0, 10),
      description: tx.description,
      amount: tx.amount,
      accountName: tx.accountName ?? "",
      score,
      reasons,
    });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 20);
}

export function scenarioTypeLabel(type: ScenarioSimulationType): string {
  switch (type) {
    case "single_purchase":
      return "Compra pontual";
    case "installments":
      return "Parcelada";
    case "recurring_expense":
      return "Despesa recorrente";
    case "save_for_goal":
      return "Poupar para objetivo";
    case "invest":
      return "Investimento";
  }
}

export function scenarioStatusLabel(status: SimulationScenarioStatus): string {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "active":
      return "Ativo";
    case "completed":
      return "Realizado";
    case "converted":
      return "Virou meta";
    case "archived":
      return "Arquivado";
  }
}
