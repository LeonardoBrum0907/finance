import type { FastifyInstance } from "fastify";
import type { TransactionDTO, TransactionTypeFilter } from "@finance/shared";
import {
  countsTowardCashFlow,
  FINE_GRAINED_CATEGORIES,
  groupCategoryForDashboard,
  isTransactionOutflow,
  sanitizeFineGrainedCategory,
  parseIntervalRef,
  selectByCycleDate,
  selectIntervalTransactions,
  summarizeIntervalFlow,
  type IntervalRef,
  CARD_CHARGE_LOOKBACK_DAYS,
  updateTransactionCategorySchema,
} from "@finance/shared";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";
import {
  getRecentMonthKeys,
  monthKeysToDateRange,
  parseDashboardMonths,
  resolvePeriodRanges,
} from "../services/finance/aggregates.js";
import { loadUserSettings, resolvePaydayCycle, resolvePeriodMode } from "../services/userSettings.js";
import { toTransactionDtoFields } from "../services/transactionCategory.js";
import { loadCardsForUser } from "../services/finance/creditCardBills.js";
import { resolveIntervalForUser, type IntervalContext } from "../services/finance/interval.js";
import { upsertCategoryMapping } from "../services/categoryMapping.js";
import { recategorizeUserTransactions } from "../services/categoryPipeline.js";
import {
  loadCommitmentForTransaction,
  loadCommitmentSummariesForTransactions,
  toTransactionDetailFields,
} from "../services/finance/commitments.js";
import { findRecurringBillForTransaction } from "../services/finance/recurringBillFromTransaction.js";

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

/** Mesma soma do painel (`summarizeIntervalFlow`): lista e painel não divergem. */
function computeSummary(items: TransactionDTO[]): {
  income: number;
  expenses: number;
  net: number;
} {
  const { income, expenses, net } = summarizeIntervalFlow(items);
  return { income, expenses, net };
}

/**
 * Mesma regra do painel no modo ciclo: compra no cartão conta pelo vencimento da
 * fatura. Sem isso a lista mostrava só o que tinha data de compra no período e
 * não batia com os totais (24/11/2026: 2 parcelas contra R$ 3.955,58 de gastos).
 */
async function selectTransactionsForCycle<
  T extends { date: Date; amount: number; accountId: string; billForecastMonth: string | null; account: { type: string | null } },
>(userId: string, personId: string | undefined, txs: T[], from: string, to: string) {
  const cards = await loadCardsForUser(userId, personId, []);
  const withType = txs.map((tx) => ({ ...tx, accountType: tx.account.type }));
  return selectByCycleDate(withType, cards, from, to);
}

type CycleSelection =
  | { kind: "none" }
  | { kind: "payday"; from: string; to: string }
  | { kind: "interval"; context: IntervalContext };

/** `interval` (fonte única) ou, das telas antigas, `billCycle=AAAA-MM`. */
function requestedInterval(query: { interval?: string; billCycle?: string }): IntervalRef | null {
  const ref = parseIntervalRef(query.interval);
  if (ref) return ref;
  const billCycle = query.billCycle?.trim();
  return billCycle ? parseIntervalRef(`bill:${billCycle}`) : null;
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
      periodMode?: string;
      cycleKey?: string;
      /** Mês da fatura (AAAA-MM): a lista segue o ciclo da fatura do painel. */
      billCycle?: string;
      /** Intervalo único do app (`bill:AAAA-MM` ou `month:AAAA-MM`). */
      interval?: string;
    };

    const months = parseDashboardMonths(query.months);
    const personId = query.personId?.trim() || undefined;
    const cycleKey = query.cycleKey?.trim() || undefined;
    const page = parsePage(query.page);
    const pageSize = parsePageSize(query.pageSize);
    const search = query.search?.trim() || undefined;
    const category = query.category?.trim() || undefined;
    const categoryGroup = query.categoryGroup?.trim() || undefined;
    const categoryGroups = parseCategoryGroups(query.categoryGroups);
    const cashFlowOnly = parseCashFlowOnly(query.cashFlowOnly);
    const typeFilter = parseTypeFilter(query.type);

    const userId = request.user!.sub;
    const settings = await loadUserSettings(userId);
    const { paydayDay, paydayCycleAnchor } = await resolvePaydayCycle(userId, personId);
    const periodMode = resolvePeriodMode(query.periodMode, settings, paydayDay);

    const intervalRef = requestedInterval(query);
    const interval = intervalRef ? await resolveIntervalForUser(userId, personId, intervalRef) : null;

    let range: { from?: string; to?: string };
    if (interval) {
      range = { from: interval.current.from, to: interval.current.to };
    } else if (periodMode === "payday" && paydayDay !== null) {
      const periods = resolvePeriodRanges(
        months,
        periodMode,
        paydayDay,
        paydayCycleAnchor,
        cycleKey,
      );
      range = periods.currentRange;
    } else {
      const monthKeys = getRecentMonthKeys(months, 0);
      range = monthKeysToDateRange(monthKeys);
    }

    const selection: CycleSelection = interval
      ? { kind: "interval", context: interval }
      : periodMode === "payday" && paydayDay !== null && range.from && range.to
        ? { kind: "payday", from: range.from, to: range.to }
        : { kind: "none" };
    const byBillDue = selection.kind !== "none";
    const dateFrom = range.from ? new Date(`${range.from}T00:00:00.000Z`) : new Date(0);
    // No ciclo, a compra no cartão entra pelo vencimento da fatura: busca compras de antes do período.
    if (byBillDue) dateFrom.setUTCDate(dateFrom.getUTCDate() - CARD_CHARGE_LOOKBACK_DAYS);
    const dateTo = range.to ? new Date(`${range.to}T23:59:59.999Z`) : new Date();

    const fetched = await prisma.transaction.findMany({
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

    const transactions =
      selection.kind === "interval"
        ? selectIntervalTransactions(
            fetched.map((tx) => ({ ...tx, accountType: tx.account.type })),
            selection.context.cards,
            selection.context.current,
          )
        : selection.kind === "payday"
          ? await selectTransactionsForCycle(userId, personId, fetched, selection.from, selection.to)
          : fetched.map((tx) => ({ ...tx, billDueDate: null }));

    const allDtos: TransactionDTO[] = transactions.map((tx) => ({
      ...toTransactionDtoFields(tx),
      billDueDate: tx.billDueDate,
    }));

    const summaryMap = await loadCommitmentSummariesForTransactions(
      request.user!.sub,
      allDtos.map((tx) => tx.id),
    );
    for (const dto of allDtos) {
      dto.commitmentSummary = summaryMap.get(dto.id) ?? null;
    }

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
        !countsTowardCashFlow(tx.amount, tx.accountType, tx.category, tx.description, tx.personName)
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

  app.post("/api/transactions/recategorize", async (request, reply) => {
    const result = await recategorizeUserTransactions(request.user!.sub);
    return reply.send(result);
  });

  app.get("/api/transactions/category-options", async (_request, reply) => {
    return reply.send({ categories: FINE_GRAINED_CATEGORIES });
  });

  app.get("/api/transactions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.sub;

    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        account: { connection: { person: { userId } } },
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true,
            connection: {
              select: { person: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    if (!transaction) {
      return reply.status(404).send({ error: "Transação não encontrada" });
    }

    const dto = toTransactionDtoFields(transaction);
    const commitment = await loadCommitmentForTransaction(userId, id);
    const recurringBill = await findRecurringBillForTransaction(userId, transaction);

    return reply.send(
      toTransactionDetailFields(transaction, dto.category, commitment, recurringBill),
    );
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
}
