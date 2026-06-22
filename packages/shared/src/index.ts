import { z } from "zod";

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
});
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

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
  personId: string;
  personName: string;
}

export interface DashboardSummary {
  totalBalance: number;
  currencyCode: string;
  perPerson: {
    personId: string;
    personName: string;
    balance: number;
  }[];
  accounts: (AccountDTO & { personName: string })[];
  recentTransactions: TransactionDTO[];
}

export interface ChatMessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
