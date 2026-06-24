import { z } from "zod";
import type { DashboardCategoryGroup } from "./categoryGroups";
import type { InvestmentAllocationPoint } from "./investments";
import type { PeriodMode } from "./payday";

export { translateCategory } from "./categories";
export {
  groupCategoryForDashboard,
  resolveDashboardCategoryGroup,
  DASHBOARD_CATEGORY_GROUPS,
  type DashboardCategoryGroup,
  type CategoryChartSelection,
} from "./categoryGroups";
export {
  isCreditAccount,
  isInvestmentAccount,
  isTransactionOutflow,
  toSignedDisplayAmount,
  accountNetWorthContribution,
  countsTowardCashFlow,
} from "./transactions";
export {
  PERIOD_MODES,
  periodModeSchema,
  updateSettingsSchema,
  parsePeriodMode,
  effectivePaydayInMonth,
  getPaydayCycleStart,
  getPaydayCycleEnd,
  getPaydayCycleRange,
  getRecentPaydayCycles,
  paydayCyclesToDateRange,
  formatPaydayCycleLabel,
  formatPaydayCycleShortLabel,
  classifyIncome,
  type PeriodMode,
  type UpdateSettingsInput,
  type UserSettingsDTO,
  type PaydayCycleRange,
  type IncomeBreakdown,
} from "./payday";
export {
  translateInvestmentType,
  translateInvestmentSubtype,
  translateInvestmentStatus,
  isWithdrawnInvestment,
  hasMeaningfulInvestmentBalance,
  isActiveInvestment,
  isDisplayableInvestment,
  computePositionProfit,
  summarizeInvestmentPortfolio,
  computePeriodInvestmentProfit,
  computeInvestmentAllocation,
  INVESTMENT_BALANCE_EPSILON,
  INVESTMENT_POSITION_STALE_DAYS,
  resolveInvestmentPositionReferenceDate,
  getInvestmentPositionStaleDays,
  isStaleInvestmentPosition,
  type InvestmentPositionLike,
  type InvestmentTransactionLike,
  type InvestmentAllocationPoint,
} from "./investments";
export {
  isBrokerConnector,
  selectConnectionsForInvestments,
  resolveInvestmentSourceLabel,
  investmentDedupKey,
  scoreInvestmentSource,
  type ConnectionWithInvestments,
  type InvestmentLikeForDedup,
  type InvestmentSourceMeta,
} from "./investmentSources";

export const registerSchema = z.object({
  name: z.string().min(2, "Informe seu nome"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const personSchema = z.object({
  name: z.string().min(1, "Informe o nome"),
  relationship: z.string().optional(),
});
export type PersonInput = z.infer<typeof personSchema>;

export const createConnectionSchema = z.object({
  personId: z.string().min(1),
  itemId: z.string().min(1),
});
export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;

export const chatMessageSchema = z.object({
  message: z.string().min(1, "Digite uma mensagem"),
  threadId: z.string().min(1, "Informe a conversa"),
  personId: z.string().cuid().optional(),
});
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

export const createChatThreadSchema = z.object({
  title: z.string().min(1).max(80).optional(),
});
export type CreateChatThreadInput = z.infer<typeof createChatThreadSchema>;

export const updateChatThreadSchema = z.object({
  title: z.string().min(1, "Informe o título").max(80, "Título muito longo"),
});
export type UpdateChatThreadInput = z.infer<typeof updateChatThreadSchema>;

export const regenerateChatSchema = z.object({
  threadId: z.string().min(1, "Informe a conversa"),
  personId: z.string().cuid().optional(),
});
export type RegenerateChatInput = z.infer<typeof regenerateChatSchema>;

export const updateBudgetLimitSchema = z.object({
  limit: z.number().positive("Informe um limite maior que zero"),
});
export type UpdateBudgetLimitInput = z.infer<typeof updateBudgetLimitSchema>;

const dashboardCategoryGroupSchema = z.enum([
  "Alimentação",
  "Transporte",
  "Compras",
  "Assinaturas",
  "Doações",
  "Igreja",
  "Saúde e bem-estar",
  "Contas fixas",
  "Serviços",
  "Transferências",
  "Tarifas e impostos",
  "Outros",
]);

export const createBudgetSchema = z.object({
  name: z.string().min(1, "Informe o nome do orçamento").max(80, "Nome muito longo"),
  limit: z.number().positive("Informe um limite maior que zero"),
  categories: z
    .array(dashboardCategoryGroupSchema)
    .min(1, "Selecione ao menos uma categoria"),
});
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

export const updateBudgetSchema = z.object({
  name: z.string().min(1, "Informe o nome do orçamento").max(80, "Nome muito longo").optional(),
  limit: z.number().positive("Informe um limite maior que zero").optional(),
  categories: z
    .array(dashboardCategoryGroupSchema)
    .min(1, "Selecione ao menos uma categoria")
    .optional(),
});
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

export type GoalType =
  | "savings"
  | "purchase"
  | "debt_payoff"
  | "emergency_fund"
  | "custom";

export type GoalStatus = "active" | "completed" | "paused" | "archived";

export type GoalContributionSource = "manual" | "ai" | "auto";

export type GoalTrackingMode = "manual" | "linked";

export type PlanStatus = "active" | "paused" | "completed" | "archived";

export type ChatActionProposalType =
  | "create_goal"
  | "update_goal"
  | "create_plan"
  | "add_contribution";

export type ChatActionProposalStatus = "pending" | "confirmed" | "discarded";

const goalTypeSchema = z.enum([
  "savings",
  "purchase",
  "debt_payoff",
  "emergency_fund",
  "custom",
]);

const goalStatusSchema = z.enum(["active", "completed", "paused", "archived"]);

const planStatusSchema = z.enum(["active", "paused", "completed", "archived"]);

export const createGoalSchema = z.object({
  name: z.string().min(1, "Informe o nome do objetivo").max(80, "Nome muito longo"),
  description: z.string().max(500, "Descrição muito longa").optional(),
  type: goalTypeSchema,
  icon: z.string().max(40).optional(),
  targetAmount: z.number().positive("Informe um valor alvo maior que zero"),
  targetDate: z.string().optional(),
  linkedAccountId: z.string().optional(),
});
export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const updateGoalSchema = z.object({
  name: z.string().min(1, "Informe o nome do objetivo").max(80, "Nome muito longo").optional(),
  description: z.string().max(500, "Descrição muito longa").optional().nullable(),
  type: goalTypeSchema.optional(),
  icon: z.string().max(40).optional().nullable(),
  targetAmount: z.number().positive("Informe um valor alvo maior que zero").optional(),
  targetDate: z.string().optional().nullable(),
  status: goalStatusSchema.optional(),
  linkedAccountId: z.string().optional().nullable(),
});
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

export const addContributionSchema = z.object({
  amount: z.number().positive("Informe um valor maior que zero"),
  date: z.string().optional(),
  note: z.string().max(200, "Nota muito longa").optional(),
});
export type AddContributionInput = z.infer<typeof addContributionSchema>;

export const goalSourceInputSchema = z.object({
  sourceType: z.enum(["account", "investment"]),
  accountId: z.string().optional(),
  investmentId: z.string().optional(),
  allocationPercent: z.number().min(0.01, "Informe uma alocação maior que zero").max(100, "Alocação máxima é 100%"),
});

export const updateGoalSourcesSchema = z.object({
  sources: z.array(goalSourceInputSchema).min(1, "Selecione ao menos uma fonte"),
});
export type UpdateGoalSourcesInput = z.infer<typeof updateGoalSourcesSchema>;

const planGoalMemberSchema = z.object({
  goalId: z.string().min(1, "Informe o objetivo"),
  monthlyAllocation: z.number().min(0, "Alocação não pode ser negativa"),
});

export const createPlanSchema = z.object({
  name: z.string().min(1, "Informe o nome do plano").max(80, "Nome muito longo"),
  description: z.string().max(500, "Descrição muito longa").optional(),
  monthlyContribution: z.number().min(0, "Aporte mensal não pode ser negativo"),
  goals: z.array(planGoalMemberSchema).min(1, "Selecione ao menos um objetivo"),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = z.object({
  name: z.string().min(1, "Informe o nome do plano").max(80, "Nome muito longo").optional(),
  description: z.string().max(500, "Descrição muito longa").optional().nullable(),
  monthlyContribution: z.number().min(0, "Aporte mensal não pode ser negativo").optional(),
  status: planStatusSchema.optional(),
  goals: z.array(planGoalMemberSchema).min(1, "Selecione ao menos um objetivo").optional(),
});
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface PersonDTO {
  id: string;
  name: string;
  relationship: string | null;
  createdAt: string;
  connections: BankConnectionDTO[];
}

export interface BankConnectionDTO {
  id: string;
  pluggyItemId: string;
  connectorName: string | null;
  connectorImageUrl: string | null;
  status: string;
  lastSyncedAt: string | null;
  accounts: AccountDTO[];
}

export interface AccountDTO {
  id: string;
  name: string;
  type: string | null;
  subtype: string | null;
  number: string | null;
  balance: number;
  currencyCode: string;
  creditBrand?: string | null;
  creditLevel?: string | null;
  creditLimit?: number | null;
  availableCreditLimit?: number | null;
  minimumPayment?: number | null;
  balanceCloseDate?: string | null;
  balanceDueDate?: string | null;
  nextBillAmount?: number | null;
  nextBillDueDate?: string | null;
}

export interface TransactionDTO {
  id: string;
  date: string;
  description: string;
  amount: number;
  currencyCode: string;
  category: string | null;
  accountId: string;
  accountName: string;
  accountType: string | null;
  personId: string;
  personName: string;
}

export interface DashboardPeriodSummary {
  months: number;
  income: number;
  expenses: number;
  net: number;
  periodMode?: PeriodMode;
  from?: string;
  to?: string;
  label?: string;
}

export type DashboardMonths = 1 | 3 | 6 | 12;

export interface DashboardMonthlyPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
  label?: string;
}

export interface DashboardCurrentCycle {
  cycleKey: string;
  from: string;
  to: string;
  dayIndex: number;
  totalDays: number;
  daysRemaining: number;
  isComplete: boolean;
  income: number;
  expenses: number;
  net: number;
  salaryIncome: number;
  extraIncome: number;
}

export interface DashboardCategoryPoint {
  category: string;
  total: number;
  count: number;
  percent?: number;
}

export interface DashboardNetWorth {
  total: number;
  bankBalance: number;
  creditDebt: number;
  investmentBalance: number;
}

export interface DashboardInvestmentsSummary {
  totalBalance: number;
  unrealizedProfit: number;
  periodProfit: number | null;
  previousPeriodProfit: number | null;
  positionCount: number;
  stalePositionCount: number;
  lastSyncedAt: string | null;
  investmentSource: string | null;
}

export interface DashboardSummary {
  totalBalance: number;
  netWorth: DashboardNetWorth;
  investments: DashboardInvestmentsSummary;
  currencyCode: string;
  periodMode: PeriodMode;
  paydayDay: number | null;
  currentCycle: DashboardCurrentCycle | null;
  perPerson: {
    personId: string;
    personName: string;
    balance: number;
  }[];
  accounts: (AccountDTO & { personName: string })[];
  period: DashboardPeriodSummary;
  previousPeriod: DashboardPeriodSummary;
  monthlySeries: DashboardMonthlyPoint[];
  categories: DashboardCategoryPoint[];
  previousCategories: DashboardCategoryPoint[];
  insights: string[];
}

export type TransactionTypeFilter = "all" | "inflow" | "outflow";

export interface TransactionsListResponse {
  items: TransactionDTO[];
  total: number;
  page: number;
  pageSize: number;
  period: { months: DashboardMonths; from: string; to: string };
  summary: { income: number; expenses: number; net: number };
  categories: string[];
}

export interface ChatThreadDTO {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoalContributionDTO {
  id: string;
  goalId: string;
  amount: number;
  date: string;
  source: GoalContributionSource;
  note: string | null;
  createdAt: string;
}

export interface GoalSourceDTO {
  id: string;
  sourceType: "account" | "investment";
  accountId: string | null;
  investmentId: string | null;
  name: string;
  sourceLabel: string;
  balance: number;
  allocationPercent: number;
  allocatedAmount: number;
  isStale: boolean;
}

export interface AvailableGoalSourceDTO {
  sourceType: "account" | "investment";
  accountId: string | null;
  investmentId: string | null;
  name: string;
  sourceLabel: string;
  balance: number;
  usedPercent: number;
  availablePercent: number;
  isCredit: boolean;
  isStale?: boolean;
}

export interface GoalDTO {
  id: string;
  name: string;
  description: string | null;
  type: GoalType;
  icon: string | null;
  targetAmount: number;
  currentAmount: number;
  computedAmount: number;
  targetDate: string | null;
  status: GoalStatus;
  trackingMode: GoalTrackingMode;
  linkedAccountId: string | null;
  sources: GoalSourceDTO[];
  progress: number;
  projectedCompletionDate: string | null;
  onTrack: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanGoalDTO {
  id: string;
  goalId: string;
  goalName: string;
  monthlyAllocation: number;
  currentAmount: number;
  targetAmount: number;
}

export interface PlanDTO {
  id: string;
  name: string;
  description: string | null;
  monthlyContribution: number;
  status: PlanStatus;
  goals: PlanGoalDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface SavingsPathPoint {
  month: string;
  projectedAmount: number;
  cumulativeContributions: number;
  /** Rótulo curto no eixo X (ex.: "Hoje", "T2 2026", "Meta atingida") */
  label?: string | null;
  targetAmount?: number;
}

export interface GoalsSummaryDTO {
  currencyCode: string;
  monthlySurplus: number;
  /** Aporte mensal efetivo usado na projeção (plano ou sobra) */
  monthlyContribution: number;
  totalCurrent: number;
  totalTarget: number;
  projectedCompletionMonth: string | null;
  goals: GoalDTO[];
  plans: PlanDTO[];
  savingsPath: SavingsPathPoint[];
  hasAccounts: boolean;
  surplusPeriodMode: PeriodMode;
  surplusLabel: string;
  availableSources?: AvailableGoalSourceDTO[];
}

export interface ChatActionProposalDTO {
  id: string;
  type: ChatActionProposalType;
  payload: Record<string, unknown>;
  status: ChatActionProposalStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ChatMessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  proposal?: ChatActionProposalDTO;
}

export type BudgetStatus = "safe" | "warning" | "critical";

export interface BudgetItem {
  id: string;
  name: string;
  categories: DashboardCategoryGroup[];
  spent: number;
  limit: number;
  ratio: number;
  status: BudgetStatus;
}

/** @deprecated Use BudgetItem */
export type BudgetCategoryItem = BudgetItem & { group?: DashboardCategoryGroup };

export interface InvestmentPositionDTO {
  id: string;
  name: string;
  type: string | null;
  subtype: string | null;
  typeLabel: string;
  subtypeLabel: string;
  code: string | null;
  status: string;
  statusLabel: string;
  balance: number;
  amount: number | null;
  amountOriginal: number | null;
  profit: number;
  annualRate: number | null;
  lastTwelveMonthsRate: number | null;
  dueDate: string | null;
  purchaseDate: string | null;
  positionDate: string | null;
  referenceDate: string | null;
  isStale: boolean;
  staleDays: number | null;
  personId: string;
  personName: string;
  connectorName: string | null;
}

export interface InvestmentTransactionDTO {
  id: string;
  date: string;
  type: string | null;
  typeLabel: string;
  amount: number;
  netAmount: number | null;
  quantity: number | null;
  value: number | null;
  description: string | null;
  investmentId: string;
  investmentName: string;
  personId: string;
  personName: string;
}

export interface InvestmentsSummaryDTO {
  summary: {
    totalBalance: number;
    unrealizedProfit: number;
    positionCount: number;
    stalePositionCount: number;
  };
  allocation: InvestmentAllocationPoint[];
  positions: InvestmentPositionDTO[];
  recentTransactions: InvestmentTransactionDTO[];
  currencyCode: string;
  lastSyncedAt: string | null;
  investmentSource: string | null;
  perPerson?: { personId: string; personName: string; totalBalance: number }[];
}

export interface BudgetsSummary {
  month: string;
  currencyCode: string;
  totalSpent: number;
  totalLimit: number;
  overallRatio: number;
  potentialSavings: number;
  budgets: BudgetItem[];
  availableCategories: DashboardCategoryGroup[];
  hasAccounts: boolean;
  periodMode: PeriodMode;
  periodFrom: string;
  periodTo: string;
  periodLabel: string;
  cycleDayIndex: number | null;
  cycleTotalDays: number | null;
}
