import { z } from "zod";

export { translateCategory } from "./categories";
export {
  groupCategoryForDashboard,
  DASHBOARD_CATEGORY_GROUPS,
  type DashboardCategoryGroup,
} from "./categoryGroups";
export {
  isCreditAccount,
  isTransactionOutflow,
  toSignedDisplayAmount,
  accountNetWorthContribution,
  countsTowardCashFlow,
} from "./transactions";

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
}

export type DashboardMonths = 1 | 3 | 6 | 12;

export interface DashboardMonthlyPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
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
}

export interface DashboardSummary {
  totalBalance: number;
  netWorth: DashboardNetWorth;
  currencyCode: string;
  perPerson: {
    personId: string;
    personName: string;
    balance: number;
  }[];
  accounts: (AccountDTO & { personName: string })[];
  recentTransactions: TransactionDTO[];
  period: DashboardPeriodSummary;
  previousPeriod: DashboardPeriodSummary;
  monthlySeries: DashboardMonthlyPoint[];
  categories: DashboardCategoryPoint[];
  previousCategories: DashboardCategoryPoint[];
  insights: string[];
}

export interface ChatThreadDTO {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
