import type { FastifyInstance } from "fastify";
import type { TransactionDTO, TransactionTypeFilter } from "@finance/shared";
import {
  countsTowardCashFlow,
  FINE_GRAINED_CATEGORIES,
  groupCategoryForDashboard,
  isTransactionOutflow,
  sanitizeFineGrainedCategory,
  updateTransactionCategorySchema,
} from "@finance/shared";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";
import {
  getRecentMonthKeys,
  monthKeysToDateRange,
  parseDashboardMonths,
} from "../services/finance/aggregates.js";
import { toTransactionDtoFields } from "../services/transactionCategory.js";
import { upsertCategoryMapping } from "../services/categoryMapping.js";
import { recategorizeUserTransactions } from "../services/categoryPipeline.js";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function parsePage(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parsePageSize(value: unknown): number {
  const n = Number(value);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : 20;
}

function parseTypeFilter(value: unknown): TransactionTypeFilter {
  if (value === "inflow" || value === "outflow") return value;
  return "all";
}

function parseCashFlowOnly(value: unknown): boolean {
  return value === "true" || value === "1";
}

function parseCategoryGroups(value: unknown): string[] | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const groups = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return groups.length > 0 ? groups : undefined;
}

function categoryLabel(tx: Pick<TransactionDTO, "category" | "description">): string {
  return tx.category ?? "Outros";
}

function computeSummary(items: TransactionDTO[]): {
  income: number;
  expenses: number;
  net: number;
} {
  let income = 0;
  let expenses = 0;
  for (const tx of items) {
    if (!countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description)) {
      continue;
    }
    const abs = Math.abs(tx.amount);
    if (isTransactionOutflow(tx.amount, tx.accountType)) expenses += abs;
    else income += abs;
  }
  return { income, expenses, net: income - expenses };
}

export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/transactions", async (request, reply) => {
    const query = request.query as {
      months?: string;
      personId?: string;
      page?: string;
      pageSize?: string;
      search?: string;
      category?: string;
      categoryGroup?: string;
      categoryGroups?: string;
      cashFlowOnly?: string;
      type?: string;
    };

    const months = parseDashboardMonths(query.months);
    const personId = query.personId?.trim() || undefined;
    const page = parsePage(query.page);
    const pageSize = parsePageSize(query.pageSize);
    const search = query.search?.trim() || undefined;
    const category = query.category?.trim() || undefined;
    const categoryGroup = query.categoryGroup?.trim() || undefined;
    const categoryGroups = parseCategoryGroups(query.categoryGroups);
    const cashFlowOnly = parseCashFlowOnly(query.cashFlowOnly);
    const typeFilter = parseTypeFilter(query.type);

    const monthKeys = getRecentMonthKeys(months, 0);
    const range = monthKeysToDateRange(monthKeys);
    const dateFrom = range.from ? new Date(`${range.from}T00:00:00.000Z`) : new Date(0);
    const dateTo = range.to ? new Date(`${range.to}T23:59:59.999Z`) : new Date();

    const transactions = await prisma.transaction.findMany({
      where: {
        date: { gte: dateFrom, lte: dateTo },
        account: {
          connection: {
            person: {
              userId: request.user!.sub,
              ...(personId ? { id: personId } : {}),
            },
          },
        },
        ...(search
          ? { description: { contains: search, mode: "insensitive" as const } }
          : {}),
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true,
            connection: {
              select: {
                person: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    const allDtos: TransactionDTO[] = transactions.map((tx) => toTransactionDtoFields(tx));

    const categories = Array.from(
      new Set(allDtos.map((tx) => categoryLabel(tx))),
    ).sort();

    const filtered = allDtos.filter((tx) => {
      if (categoryGroups) {
        const group = groupCategoryForDashboard(tx.category, tx.description);
        if (!categoryGroups.includes(group)) return false;
      } else if (categoryGroup) {
        const group = groupCategoryForDashboard(tx.category, tx.description);
        if (group !== categoryGroup) return false;
      } else if (category && categoryLabel(tx) !== category) {
        return false;
      }

      if (
        cashFlowOnly &&
        !countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description)
      ) {
        return false;
      }

      if (typeFilter !== "all") {
        const outflow = isTransactionOutflow(tx.amount, tx.accountType);
        if (typeFilter === "outflow" && !outflow) return false;
        if (typeFilter === "inflow" && outflow) return false;
      }
      return true;
    });

    const total = filtered.length;
    const summary = computeSummary(filtered);
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return reply.send({
      items,
      total,
      page,
      pageSize,
      period: {
        months,
        from: range.from ?? "",
        to: range.to ?? "",
      },
      summary,
      categories,
    });
  });

  app.patch("/api/transactions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateTransactionCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" });
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        account: { connection: { person: { userId: request.user!.sub } } },
      },
    });
    if (!transaction) {
      return reply.status(404).send({ error: "Transação não encontrada" });
    }

    const category = sanitizeFineGrainedCategory(parsed.data.category);
    await prisma.transaction.update({
      where: { id },
      data: {
        userCategory: category,
        categorySource: "user",
        categoryConfidence: 1,
      },
    });

    await upsertCategoryMapping(
      request.user!.sub,
      transaction.description,
      category,
      "user",
      transaction.merchantName,
    );

    return reply.send({ ok: true, category });
  });

  app.post("/api/transactions/recategorize", async (request, reply) => {
    const result = await recategorizeUserTransactions(request.user!.sub);
    return reply.send(result);
  });

  app.get("/api/transactions/category-options", async (_request, reply) => {
    return reply.send({ categories: FINE_GRAINED_CATEGORIES });
  });
}
