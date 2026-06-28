import { z } from "zod";
import type { TransactionCommitmentSummary } from "./commitments";
import type { DashboardCategoryGroup } from "./categoryGroups";
import type { InvestmentAllocationPoint } from "./investments";
import type { PeriodMode, PaydayCycleAnchor } from "./payday";
import { paydayCycleAnchorSchema } from "./payday";

export { translateCategory } from "./categories";
export {
  FINE_GRAINED_CATEGORIES,
  needsAiCategorization,
  hasHighCategoryConfidence,
  resolveTransactionCategory,
  normalizeCategoryPattern,
  sanitizeFineGrainedCategory,
  classifyWithRules,
  type CategorySource,
} from "./categories";
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
  isSamePersonTransfer,
  descriptionMatchesPersonName,
} from "./transactions";
export {
  COMMITMENT_STATUSES,
  INSTALLMENT_STATUSES,
  createCommitmentSchema,
  updateCommitmentSchema,
  type CommitmentStatus,
  type InstallmentStatus,
  type TransactionCommitmentSummary,
  type PaymentInstallmentDTO,
  type PaymentCommitmentDTO,
  type TransactionDetailDTO,
  type CreateCommitmentInput,
  type UpdateCommitmentInput,
} from "./commitments";
export {
  simulatedPurchaseInputSchema,
  buildInstallmentSchedule,
  createSimulatedPurchase,
  computeSimulationCycleImpact,
  computeSimulationStatDelta,
  flattenSimulatedRows,
  todayDateKeyInTimeZone,
  type SimulatedInstallment,
  type SimulatedPurchase,
  type SimulatedPurchaseInput,
  type SimulationCycleRange,
  type SimulationCycleImpact,
  type SimulationStatDelta,
  type FlatSimulatedRow,
} from "./simulation";
export {
  PERIOD_MODES,
  periodModeSchema,
  PAYDAY_CYCLE_ANCHORS,
  paydayCycleAnchorSchema,
  DEFAULT_PAYDAY_CYCLE_ANCHOR,
  APP_THEMES,
  DEFAULT_APP_THEME,
  updateSettingsSchema,
  parsePeriodMode,
  parsePaydayCycleAnchor,
  parseAppTheme,
  isPaydayDayConfigured,
  describePaydayCycleBounds,
  effectivePaydayInMonth,
  getPaydayCycleStart,
  getPaydayCycleStartKey,
  getPaydayCycleEnd,
  getPaydayCycleEndFromStart,
  getPaydayCycleKey,
  getPaydayCycleBounds,
  getPaydayCycleRange,
  getPaydayCycleRangeByKey,
  getPaydayCycleRangeByEnd,
  getRecentPaydayCycles,
  getPaydayCycleEndOffset,
  paydayCyclesToDateRange,
  formatPaydayCycleLabel,
  formatPaydayCycleShortLabel,
  classifyIncome,
  type PeriodMode,
  type PaydayCycleAnchor,
  type AppTheme,
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
  paydayDay: z.number().int().min(1).max(31).nullable().optional(),
  paydayCycleAnchor: paydayCycleAnchorSchema.optional(),
});
export type PersonInput = z.infer<typeof personSchema>;

export const createConnectionSchema = z.object({
  personId: z.string().min(1),
  itemId: z.string().min(1),
});
export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;

export const chatMessageSchema = z.object({
  message: z.string().min(1, "Digite uma mensagem").max(4000, "Mensagem muito longa (máx. 4000 caracteres)"),
  threadId: z.string().min(1, "Informe a conversa"),
  personId: z.string().cuid().optional(),
  contextHint: z.string().max(2000).optional(),
  source: z.string().max(80).optional(),
});
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

export const createChatThreadSchema = z.object({
  title: z.string().min(1).max(80).optional(),
});
export type CreateChatThreadInput = z.infer<typeof createChatThreadSchema>;

export const resolveChatThreadSchema = z.object({
  contextKey: z.string().min(1).max(80),
  title: z.string().min(1).max(80).optional(),
});
export type ResolveChatThreadInput = z.infer<typeof resolveChatThreadSchema>;

export const updateChatThreadSchema = z.object({
  title: z.string().min(1, "Informe o título").max(80, "Título muito longo"),
});
export type UpdateChatThreadInput = z.infer<typeof updateChatThreadSchema>;

export const bulkDeleteChatThreadsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Selecione ao menos uma conversa"),
});
export type BulkDeleteChatThreadsInput = z.infer<typeof bulkDeleteChatThreadsSchema>;

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
  paydayDay: number | null;
  paydayCycleAnchor: PaydayCycleAnchor;
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
  /** Fatura já fechada (Pluggy Bills). */
  closedBillAmount?: number | null;
  closedBillDueDate?: string | null;
  /** Fatura em aberto — saldo Pluggy do ciclo atual. */
  openBillAmount?: number | null;
  openBillDueDate?: string | null;
  /** @deprecated Use openBillAmount */
  nextBillAmount?: number | null;
  /** @deprecated Use openBillDueDate */
  nextBillDueDate?: string | null;
}

export interface TransactionDTO {
  id: string;
  date: string;
  description: string;
  amount: number;
  currencyCode: string;
  category: string | null;
  userCategory?: string | null;
  categorySource?: string | null;
  categoryConfidence?: number | null;
  merchantName?: string | null;
  accountId: string;
  accountName: string;
  accountType: string | null;
  personId: string;
  personName: string;
  commitmentSummary?: TransactionCommitmentSummary | null;
}

export const updateTransactionCategorySchema = z.object({
  category: z.string().min(1, "Informe a categoria").max(80),
});
export type UpdateTransactionCategoryInput = z.infer<typeof updateTransactionCategorySchema>;

export interface RecategorizeTransactionsResponse {
  processed: number;
  updated: number;
  skipped: number;
}

export interface DashboardPeriodSummary {
  months: number;
  income: number;
  expenses: number;
  /** Saldo realizado: receitas − despesas já ocorridas no período/ciclo. */
  net: number;
  /** Compromissos futuros no ciclo (só em modo payday, ciclo em andamento). */
  committedExpenses?: number;
  /** Saldo disponível: net − committedExpenses. */
  availableNet?: number;
  /** Salário previsto no pagamento (âncora end, ainda não recebido). */
  pendingSalary?: number | null;
  /** true se salário ainda não recebido e sem estimativa histórica. */
  salaryPending?: boolean;
  /** Até agora incluindo salário previsto: net + pendingSalary. */
  balanceWithSalary?: number;
  /** Até o pagamento: availableNet + pendingSalary. */
  balanceAtPayday?: number;
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
  /** Parcelas/agendamentos com data futura dentro do ciclo (só em ciclo em andamento). */
  committedExpenses: number;
  /** Parcelas de compromissos manuais pendentes no ciclo. */
  committedExpensesManual?: number;
  /** Parcelas de cartão/banco com data futura no ciclo. */
  committedExpensesBank?: number;
  /** Saldo realizado: receitas − despesas já ocorridas. */
  net: number;
  /** Saldo disponível: net − committedExpenses. */
  availableNet: number;
  /** Salário previsto no pagamento (âncora end, ainda não recebido). */
  pendingSalary?: number | null;
  /** true se salário ainda não recebido e sem estimativa histórica. */
  salaryPending?: boolean;
  /** Até agora incluindo salário previsto: net + pendingSalary. */
  balanceWithSalary: number;
  /** Até o pagamento: availableNet + pendingSalary. */
  balanceAtPayday: number;
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
  investmentsIncluded: boolean;
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


export interface DashboardGrowthMetrics {
  savingsRate: number | null;
  expenseRatio: number | null;
  vsPrevious: {
    incomeChange: number | null;
    expenseChange: number | null;
    netChange: number | null;
  };
  incomeBreakdown: {
    salary: number;
    extra: number;
  } | null;
  projection: {
    dailyAvgExpense: number;
    /** Gasto real até hoje no ciclo/período. */
    expensesToDate: number;
    /** Cobranças já agendadas com data futura no ciclo (ex.: parcelas no cartão). */
    committedExpenses: number;
    committedExpensesManual?: number;
    committedExpensesBank?: number;
    projectedExpense: number;
    projectedIncome: number;
    projectedNet: number;
    pendingSalary: number | null;
    salaryPending: boolean;
    daysElapsed: number;
    daysTotal: number;
    daysRemaining: number;
    isPartialPeriod: boolean;
  } | null;
}

export interface DashboardSummary {
  totalBalance: number;
  netWorth: DashboardNetWorth;
  investments: DashboardInvestmentsSummary;
  currencyCode: string;
  periodMode: PeriodMode;
  paydayDay: number | null;
  paydayCycleAnchor: PaydayCycleAnchor;
  paydayConfigured: boolean;
  currentCycle: DashboardCurrentCycle | null;
  /** Últimos ciclos (mais recente por último), com detalhamento de renda. */
  recentCycles: DashboardCurrentCycle[] | null;
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
  growthMetrics: DashboardGrowthMetrics;
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
  contextKey?: string | null;
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
  impactSummary?: string;
}

export type ChatSuggestionIntent = "goal" | "plan" | "analyze" | "what_if";

export interface ChatSuggestionDTO {
  label: string;
  message: string;
  intent?: ChatSuggestionIntent;
}

export type ChatBlock =
  | { type: "markdown"; content: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "metric"; label: string; value: string; delta?: string }
  | {
      type: "chart";
      chartKind: "category_bar";
      data: { category: string; total: number; formattedTotal: string; percent: number }[];
    }
  | { type: "action_prompt"; message: string; intent: string };

export interface ChatMessageMetadata {
  followUps?: ChatSuggestionDTO[];
  blocks?: ChatBlock[];
  toolActivity?: string[];
  dataPeriod?: string;
  syncAt?: string | null;
  ai?: {
    provider: string;
    modelId: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cachedInputTokens?: number;
    promptCacheKey?: string;
    usedFallback?: boolean;
    steps?: number;
  };
}

export interface ChatAiQuotaDTO {
  used: number;
  limit: number;
  remaining: number;
  periodKey: string;
  resetsAt: string;
}

export interface ChatAlertDTO {
  id: string;
  message: string;
  severity: "info" | "warning" | "success";
  suggestionMessage: string;
  personId?: string;
  contextKey?: string;
}

export interface ChatContextSummaryDTO {
  balance?: string;
  monthlyExpenses?: string;
  monthlyNet?: string;
  activeGoalsCount?: number;
  hasAccounts: boolean;
}

export interface ChatRecapDTO {
  threadId: string;
  preview: string;
  content: string;
  createdAt: string;
  scope?: "household" | "person";
  personId?: string;
  personName?: string;
}

export type HouseholdArenaTone = "praise" | "roast" | "neutral";

export interface HouseholdArenaRankingDTO {
  personId: string;
  personName: string;
  rank: number;
  score: number;
  verdict: string;
  tone: HouseholdArenaTone;
  badges: string[];
  recapThreadId: string;
  net: number;
  expenses: number;
  income: number;
}

export interface HouseholdHeadToHeadDTO {
  id: string;
  message: string;
  personAId: string;
  personBId: string;
  metric: string;
}

export interface HouseholdArenaDTO {
  periodLabel: string;
  householdRecapThreadId: string;
  personCount: number;
  rankings: HouseholdArenaRankingDTO[];
  headToHead: HouseholdHeadToHeadDTO[];
}

export interface ChatMessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  proposal?: ChatActionProposalDTO;
  metadata?: ChatMessageMetadata;
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

export const SIMULATION_TYPES = [
  "single_purchase",
  "installments",
  "recurring_expense",
  "save_for_goal",
] as const;

export type SimulationType = (typeof SIMULATION_TYPES)[number];

export type SimulationVerdict = "affordable" | "caution" | "risky";

export const simulationInputSchema = z.object({
  type: z.enum(SIMULATION_TYPES),
  name: z.string().max(80).optional(),
  amount: z.number().positive("Informe um valor maior que zero"),
  installments: z.number().int().min(2).max(48).optional(),
  interestRate: z.number().min(0).max(100).optional(),
  durationMonths: z.number().int().min(1).max(120).optional(),
  targetDate: z.string().optional(),
  paymentMethod: z.enum(["cash", "credit"]).optional(),
  creditAccountId: z.string().optional(),
  categoryGroup: dashboardCategoryGroupSchema.optional(),
  personId: z.string().cuid().optional(),
});

export type SimulationInput = z.infer<typeof simulationInputSchema>;

export interface SimulatorCreditAccountDTO {
  id: string;
  name: string;
  personName: string;
  nextBillAmount: number | null;
  nextBillDueDate: string | null;
}

export interface SimulatorBaselineDTO {
  currencyCode: string;
  periodMode: PeriodMode;
  periodLabel: string;
  surplusLabel: string;
  averageSurplus: number;
  averageIncome: number;
  averageExpenses: number;
  bankBalance: number;
  monthlyContribution: number;
  projectedNet: number | null;
  creditAccounts: SimulatorCreditAccountDTO[];
  hasAccounts: boolean;
}

export interface SimulationMonthlyPoint {
  month: string;
  label?: string;
  baselineSurplus: number;
  scenarioSurplus: number;
}

export interface SimulationGoalImpactDTO {
  monthsDelayed: number | null;
  affectedGoals: { id: string; name: string; monthsDelayed: number }[];
}

export interface SimulationBudgetImpactDTO {
  category: string;
  spent: number;
  limit: number;
  ratioAfter: number;
  statusAfter: BudgetStatus;
}

export interface SimulationCreditImpactDTO {
  accountId: string;
  accountName: string;
  nextBillBefore: number;
  nextBillAfter: number;
  billIncrease: number;
}

export interface SimulationResultDTO {
  type: SimulationType;
  name?: string;
  verdict: SimulationVerdict;
  recommendation: string;
  disclaimer: string;
  baseline: {
    surplus: number;
    income: number;
    expenses: number;
    bankBalance: number;
  };
  projected: {
    surplusAfter: number;
    surplusDelta: number;
    bankBalanceAfter: number | null;
    monthlySeries: SimulationMonthlyPoint[];
    estimatedMonths: number | null;
    monthlyNeeded: number | null;
    installmentAmount: number | null;
  };
  goalImpact: SimulationGoalImpactDTO;
  budgetImpact: SimulationBudgetImpactDTO | null;
  creditImpact: SimulationCreditImpactDTO | null;
  warnings: string[];
}
