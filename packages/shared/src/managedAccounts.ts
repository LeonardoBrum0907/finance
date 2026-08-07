import type { SimulatedPurchase } from "./simulation.js";
import type {
  SimulationPayload,
  ScenarioSimulationType,
  SimulationScenarioDTO,
  SimulationScenarioStatus,
} from "./simulationScenario.js";
import { payloadToSimulatedPurchase } from "./simulationScenario.js";
import type {
  RecurringBillDTO,
  RecurringBillSource,
  RecurringBillStatus,
} from "./recurringBills.js";
import type { PaymentCommitmentDTO, CommitmentStatus, InstallmentStatus } from "./commitments.js";
import { todayDateKeyInTimeZone } from "./simulation.js";

export const MANAGED_ACCOUNT_KINDS = [
  "fixed_recurring",
  "installment_plan",
  "simulation",
] as const;
export type ManagedAccountKind = (typeof MANAGED_ACCOUNT_KINDS)[number];

export const MANAGED_ACCOUNT_SOURCES = [
  "auto_detected",
  "transaction",
  "simulator",
  "manual",
] as const;
export type ManagedAccountSource = (typeof MANAGED_ACCOUNT_SOURCES)[number];

export const MANAGED_ACCOUNT_STATUSES = [
  "draft",
  "active",
  "inactive",
  "completed",
  "cancelled",
  "dismissed",
  "archived",
  "converted",
] as const;
export type ManagedAccountStatus = (typeof MANAGED_ACCOUNT_STATUSES)[number];

export const MANAGED_ENTRY_STATUSES = ["pending", "paid", "skipped"] as const;
export type ManagedEntryStatus = (typeof MANAGED_ENTRY_STATUSES)[number];

export interface ManagedAccountEntryDTO {
  id: string;
  sequence: number | null;
  cycleKey: string | null;
  dueDate: string;
  amount: number;
  status: ManagedEntryStatus;
  transactionId: string | null;
  paidAt: string | null;
}

export interface ManagedAccountDTO {
  id: string;
  title: string;
  payeeName: string | null;
  category: string | null;
  notes: string | null;
  kind: ManagedAccountKind;
  simulationType: ScenarioSimulationType | null;
  source: ManagedAccountSource;
  status: ManagedAccountStatus;
  expectedAmount: number;
  totalAmount: number | null;
  totalInstallments: number | null;
  dayOfMonth: number | null;
  personId: string | null;
  personName: string | null;
  bankAccountId: string | null;
  bankAccountName: string | null;
  anchorTransactionId: string | null;
  linkedGoalId: string | null;
  linkedGoalName: string | null;
  linkedTransactionId: string | null;
  simulationPayload: SimulationPayload | null;
  lastVerdict: string | null;
  priority: number;
  description: string | null;
  lastOccurrenceDate: string | null;
  completedAt: string | null;
  paidCount: number;
  pendingCount: number;
  entries: ManagedAccountEntryDTO[];
  legacyRecurringBillId: string | null;
  legacyCommitmentId: string | null;
  legacySimulationScenarioId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedAccountForSimulation {
  id: string;
  title: string;
  kind: ManagedAccountKind;
  simulationType: ScenarioSimulationType | null;
  simulationPayload: SimulationPayload | null;
  expectedAmount: number;
  totalInstallments: number | null;
  entries: {
    id: string;
    dueDate: string;
    amount: number;
    status: ManagedEntryStatus;
  }[];
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toDateKey(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function managedAccountKindLabel(kind: ManagedAccountKind): string {
  switch (kind) {
    case "fixed_recurring":
      return "Conta fixa";
    case "installment_plan":
      return "Parcelamento manual";
    case "simulation":
      return "Simulação";
  }
}

export function managedAccountSimulationTypeLabel(
  type: ScenarioSimulationType | null,
): string | null {
  if (!type) return null;
  switch (type) {
    case "single_purchase":
      return "Compra simulada";
    case "installments":
      return "Parcelamento";
    case "recurring_expense":
      return "Conta futura";
    case "save_for_goal":
      return "Poupança";
    case "invest":
      return "Investimento";
  }
}

export function managedAccountDisplayLabel(account: ManagedAccountDTO): string {
  if (account.kind === "simulation" && account.simulationType) {
    return managedAccountSimulationTypeLabel(account.simulationType) ?? "Simulação";
  }
  return managedAccountKindLabel(account.kind);
}

export function managedAccountMonthlyContribution(account: ManagedAccountDTO): number {
  if (account.status !== "active") return 0;

  if (account.kind === "fixed_recurring") {
    return account.expectedAmount;
  }

  if (account.kind === "installment_plan") {
    if (account.pendingCount === 0) return 0;
    return account.expectedAmount;
  }

  if (account.kind === "simulation" && account.simulationPayload) {
    const payload = account.simulationPayload;
    switch (payload.type) {
      case "recurring_expense":
        return payload.amount;
      case "single_purchase":
        return payload.amount;
      case "installments": {
        const installments = payload.installments ?? payload.totalInstallments ?? 1;
        return roundMoney(payload.amount / Math.max(installments, 1));
      }
      case "invest":
        return payload.amount;
      case "save_for_goal": {
        const duration = payload.durationMonths ?? 12;
        return roundMoney(payload.amount / Math.max(duration, 1));
      }
    }
  }

  return 0;
}

export function managedAccountToSimulatedPurchase(
  account: ManagedAccountForSimulation,
): SimulatedPurchase | null {
  if (account.kind === "simulation" && account.simulationPayload) {
    return payloadToSimulatedPurchase(account.id, account.simulationPayload);
  }

  const activeEntries = account.entries.filter((entry) => entry.status === "pending");
  if (activeEntries.length === 0) return null;

  const installments = activeEntries.map((entry) => ({
    id: entry.id,
    dueDate: toDateKey(entry.dueDate),
    amount: entry.amount,
  }));

  const firstDate = installments[0]?.dueDate ?? new Date().toISOString().slice(0, 10);

  return {
    id: account.id,
    title: account.title,
    paymentMethod: "pix",
    totalAmount: roundMoney(installments.reduce((sum, inst) => sum + inst.amount, 0)),
    purchaseDate: firstDate,
    installments,
    createdAt: new Date().toISOString(),
  };
}

export function managedAccountsToSimulatedPurchases(
  accounts: ManagedAccountForSimulation[],
): SimulatedPurchase[] {
  const purchases: SimulatedPurchase[] = [];
  for (const account of accounts) {
    const purchase = managedAccountToSimulatedPurchase(account);
    if (purchase) purchases.push(purchase);
  }
  return purchases;
}

export function sumActiveManagedAccountsMonthlyTotal(
  accounts: ManagedAccountDTO[],
): number {
  return roundMoney(
    accounts
      .filter((account) => account.status === "active")
      .reduce((sum, account) => sum + managedAccountMonthlyContribution(account), 0),
  );
}

export function managedAccountLegacyId(account: ManagedAccountDTO): string {
  if (account.kind === "fixed_recurring" && account.legacyRecurringBillId) {
    return account.legacyRecurringBillId;
  }
  if (account.kind === "installment_plan" && account.legacyCommitmentId) {
    return account.legacyCommitmentId;
  }
  if (account.kind === "simulation" && account.legacySimulationScenarioId) {
    return account.legacySimulationScenarioId;
  }
  return account.id;
}

export function managedAccountToScenarioDTO(
  account: ManagedAccountDTO,
): SimulationScenarioDTO | null {
  if (account.kind !== "simulation" || !account.simulationPayload || !account.simulationType) {
    return null;
  }

  return {
    id: managedAccountLegacyId(account),
    name: account.title,
    description: account.description,
    type: account.simulationType,
    status: account.status as SimulationScenarioStatus,
    payload: account.simulationPayload,
    personId: account.personId,
    personName: account.personName,
    priority: account.priority,
    linkedTransactionId: account.linkedTransactionId,
    linkedInvestmentTxId: null,
    linkedGoalId: account.linkedGoalId,
    linkedGoalName: account.linkedGoalName,
    lastVerdict: account.lastVerdict,
    completedAt: account.completedAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export function managedAccountToRecurringBillDTO(
  account: ManagedAccountDTO,
): RecurringBillDTO | null {
  if (account.kind !== "fixed_recurring") return null;

  const monthKey = todayDateKeyInTimeZone().slice(0, 7);
  const currentOccurrence = account.entries.find(
    (entry) =>
      entry.cycleKey === monthKey || entry.dueDate.slice(0, 7) === monthKey,
  );

  return {
    id: managedAccountLegacyId(account),
    title: account.title,
    payeeName: account.payeeName,
    matchSignature: "",
    category: account.category,
    expectedAmount: account.expectedAmount,
    dayOfMonth: account.dayOfMonth ?? 1,
    status: account.status as RecurringBillStatus,
    source: account.source as RecurringBillSource,
    personId: account.personId,
    personName: account.personName,
    accountId: account.bankAccountId,
    accountName: account.bankAccountName,
    lastOccurrenceDate: account.lastOccurrenceDate,
    nextDueDate: null,
    currentCycleStatus: currentOccurrence?.status ?? null,
    pendingCount: account.pendingCount,
    paidCount: account.paidCount,
    occurrences: account.entries.map((entry) => ({
      id: entry.id,
      cycleKey: entry.cycleKey ?? entry.dueDate.slice(0, 7),
      dueDate: entry.dueDate,
      amount: entry.amount,
      status: entry.status,
      transactionId: entry.transactionId,
      paidAt: entry.paidAt,
    })),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export function managedAccountToCommitmentDTO(
  account: ManagedAccountDTO,
): PaymentCommitmentDTO | null {
  if (account.kind !== "installment_plan") return null;

  return {
    id: managedAccountLegacyId(account),
    title: account.title,
    payeeName: account.payeeName,
    notes: account.notes,
    totalAmount: account.totalAmount ?? account.expectedAmount,
    installmentAmount: account.expectedAmount,
    totalInstallments: account.totalInstallments ?? account.entries.length,
    dayOfMonth: account.dayOfMonth,
    status: account.status as CommitmentStatus,
    anchorTransactionId: account.anchorTransactionId,
    personId: account.personId,
    personName: account.personName,
    paidCount: account.paidCount,
    pendingCount: account.pendingCount,
    installments: account.entries.map((entry) => ({
      id: entry.id,
      sequence: entry.sequence ?? 0,
      dueDate: entry.dueDate,
      amount: entry.amount,
      status: entry.status as InstallmentStatus,
      transactionId: entry.transactionId,
      paidAt: entry.paidAt,
    })),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}
