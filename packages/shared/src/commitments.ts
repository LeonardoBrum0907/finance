import { z } from "zod";

export const COMMITMENT_STATUSES = ["active", "completed", "cancelled"] as const;
export type CommitmentStatus = (typeof COMMITMENT_STATUSES)[number];

export const INSTALLMENT_STATUSES = ["pending", "paid", "skipped"] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export interface TransactionCommitmentSummary {
  commitmentId: string;
  title: string;
  sequence: number;
  totalInstallments: number;
  paidCount: number;
  pendingCount: number;
}

export interface PaymentInstallmentDTO {
  id: string;
  sequence: number;
  dueDate: string;
  amount: number;
  status: InstallmentStatus;
  transactionId: string | null;
  paidAt: string | null;
}

export interface PaymentCommitmentDTO {
  id: string;
  title: string;
  payeeName: string | null;
  notes: string | null;
  totalAmount: number;
  installmentAmount: number;
  totalInstallments: number;
  dayOfMonth: number | null;
  status: CommitmentStatus;
  anchorTransactionId: string | null;
  paidCount: number;
  pendingCount: number;
  installments: PaymentInstallmentDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface TransactionDetailDTO {
  id: string;
  date: string;
  description: string;
  amount: number;
  currencyCode: string;
  category: string | null;
  userCategory: string | null;
  categorySource: string | null;
  merchantName: string | null;
  accountId: string;
  accountName: string;
  accountType: string | null;
  personId: string;
  personName: string;
  commitment: PaymentCommitmentDTO | null;
  commitmentSummary: TransactionCommitmentSummary | null;
}

export const createCommitmentSchema = z.object({
  transactionId: z.string().min(1, "Informe a transação"),
  title: z.string().min(1, "Informe o que foi comprado").max(120),
  payeeName: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
  totalAmount: z.number().positive("Valor total deve ser positivo"),
  installmentAmount: z.number().positive("Valor da parcela deve ser positivo"),
  totalInstallments: z.number().int().min(2, "Mínimo 2 parcelas").max(120),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
});

export type CreateCommitmentInput = z.infer<typeof createCommitmentSchema>;

export const updateCommitmentSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  payeeName: z.string().max(120).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  status: z.enum(["active", "cancelled"]).optional(),
});

export type UpdateCommitmentInput = z.infer<typeof updateCommitmentSchema>;
