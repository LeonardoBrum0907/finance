import {
  classifyWithRules,
  hasHighCategoryConfidence,
  needsAiCategorization,
  normalizeCategoryPattern,
  sanitizeFineGrainedCategory,
  type CategorySource,
} from "@finance/shared";
import { prisma } from "../prisma.js";
import {
  categorizeTransactionsBatch,
  getRecentUserCategories,
  type ClassifyTransactionInput,
} from "./categoryClassifier.js";
import { isAiConfigured } from "./ai.js";
import { loadCategoryMappingMap, lookupCategoryMapping } from "./categoryMapping.js";

export interface PluggyTransactionPayload {
  id: string;
  date: string;
  description: string;
  amount: number;
  currencyCode: string | null;
  category: string | null;
  merchantName: string | null;
}

export interface ResolvedCategory {
  category: string | null;
  categorySource: CategorySource | null;
  categoryConfidence: number | null;
}

interface PendingAiTransaction {
  dbId: string;
  input: ClassifyTransactionInput;
}

export function extractMerchantName(tx: Record<string, unknown>): string | null {
  const merchant = tx.merchant as { name?: string } | null | undefined;
  if (merchant?.name?.trim()) return merchant.name.trim();

  const creditMeta = tx.creditCardMetadata as { payee?: string } | null | undefined;
  if (creditMeta?.payee?.trim()) return creditMeta.payee.trim();

  const paymentData = tx.paymentData as { receiver?: { name?: string } } | null | undefined;
  if (paymentData?.receiver?.name?.trim()) return paymentData.receiver.name.trim();

  return null;
}

export function normalizePluggyTransaction(tx: Record<string, unknown>): PluggyTransactionPayload {
  return {
    id: String(tx.id),
    date: String(tx.date),
    description: String(tx.description ?? "Transação"),
    amount: Number(tx.amount ?? 0),
    currencyCode: (tx.currencyCode as string | null) ?? null,
    category: (tx.category as string | null) ?? null,
    merchantName: extractMerchantName(tx),
  };
}

function resolveWithRules(
  pluggyCategory: string | null,
  description: string,
): ResolvedCategory {
  const { category, source } = classifyWithRules(pluggyCategory, description);
  const confident = hasHighCategoryConfidence(pluggyCategory, category);
  return {
    category,
    categorySource: confident ? source : "rules",
    categoryConfidence: confident ? null : 0.4,
  };
}

export async function processSyncedTransactions(
  userId: string,
  accountId: string,
  accountType: string | null,
  accountSubtype: string | null,
  transactions: PluggyTransactionPayload[],
): Promise<void> {
  const mappings = await loadCategoryMappingMap(userId);
  const pendingAi: PendingAiTransaction[] = [];

  for (const tx of transactions) {
    const description = tx.description || "Transação";
    const existing = await prisma.transaction.findUnique({
      where: { pluggyTransactionId: tx.id },
      select: { id: true, userCategory: true },
    });

    const baseData = {
      date: new Date(tx.date),
      description,
      amount: tx.amount,
      merchantName: tx.merchantName,
      pluggyCategory: tx.category,
    };

    if (existing?.userCategory) {
      await prisma.transaction.upsert({
        where: { pluggyTransactionId: tx.id },
        create: {
          pluggyTransactionId: tx.id,
          ...baseData,
          currencyCode: tx.currencyCode ?? "BRL",
          category: existing.userCategory,
          userCategory: existing.userCategory,
          categorySource: "user",
          categoryConfidence: null,
          accountId,
        },
        update: {
          description: baseData.description,
          amount: baseData.amount,
          merchantName: baseData.merchantName,
          pluggyCategory: baseData.pluggyCategory,
        },
      });
      continue;
    }

    const cached = lookupCategoryMapping(mappings, description, tx.merchantName);
    if (cached) {
      await prisma.transaction.upsert({
        where: { pluggyTransactionId: tx.id },
        create: {
          pluggyTransactionId: tx.id,
          ...baseData,
          currencyCode: tx.currencyCode ?? "BRL",
          category: cached,
          categorySource: "cache",
          categoryConfidence: 0.9,
          accountId,
        },
        update: {
          description: baseData.description,
          amount: baseData.amount,
          merchantName: baseData.merchantName,
          pluggyCategory: baseData.pluggyCategory,
          category: cached,
          categorySource: "cache",
          categoryConfidence: 0.9,
        },
      });
      continue;
    }

    const rulesResult = resolveWithRules(tx.category, description);

    if (
      !needsAiCategorization(tx.category, rulesResult.category) ||
      !isAiConfigured()
    ) {
      await prisma.transaction.upsert({
        where: { pluggyTransactionId: tx.id },
        create: {
          pluggyTransactionId: tx.id,
          ...baseData,
          currencyCode: tx.currencyCode ?? "BRL",
          category: rulesResult.category,
          categorySource: rulesResult.categorySource,
          categoryConfidence: rulesResult.categoryConfidence,
          accountId,
        },
        update: {
          description: baseData.description,
          amount: baseData.amount,
          merchantName: baseData.merchantName,
          pluggyCategory: baseData.pluggyCategory,
          category: rulesResult.category,
          categorySource: rulesResult.categorySource,
          categoryConfidence: rulesResult.categoryConfidence,
        },
      });
      continue;
    }

    const record = await prisma.transaction.upsert({
      where: { pluggyTransactionId: tx.id },
      create: {
        pluggyTransactionId: tx.id,
        ...baseData,
        currencyCode: tx.currencyCode ?? "BRL",
        category: rulesResult.category,
        categorySource: "rules",
        categoryConfidence: 0.3,
        accountId,
      },
      update: {
        description: baseData.description,
        amount: baseData.amount,
        merchantName: baseData.merchantName,
        pluggyCategory: baseData.pluggyCategory,
        category: rulesResult.category,
        categorySource: "rules",
        categoryConfidence: 0.3,
      },
      select: { id: true },
    });

    pendingAi.push({
      dbId: record.id,
      input: {
        id: record.id,
        pluggyCategory: tx.category,
        description,
        merchantName: tx.merchantName,
        amount: tx.amount,
        date: tx.date,
        accountType,
        accountSubtype,
      },
    });
  }

  if (pendingAi.length === 0) return;

  const recentCategories = await getRecentUserCategories(userId);
  const aiResults = await categorizeTransactionsBatch(
    pendingAi.map((p) => p.input),
    recentCategories,
  );

  for (const result of aiResults) {
    const safeCategory = sanitizeFineGrainedCategory(result.category);
    await prisma.transaction.update({
      where: { id: result.id },
      data: {
        category: safeCategory,
        categorySource: result.source,
        categoryConfidence: result.confidence,
      },
    });

    const pending = pendingAi.find((p) => p.dbId === result.id);
    if (pending && result.confidence >= 0.7) {
      const pattern = normalizeCategoryPattern(
        pending.input.description,
        pending.input.merchantName,
      );
      await prisma.categoryMapping.upsert({
        where: { userId_pattern: { userId, pattern } },
        create: {
          userId,
          pattern,
          category: safeCategory,
          source: "ai",
          hitCount: 1,
        },
        update: {
          category: safeCategory,
          source: "ai",
          hitCount: { increment: 1 },
        },
      });
      mappings.set(pattern, safeCategory);
    }
  }
}

export async function recategorizeUserTransactions(userId: string): Promise<{
  processed: number;
  updated: number;
  skipped: number;
}> {
  const transactions = await prisma.transaction.findMany({
    where: {
      userCategory: null,
      account: { connection: { person: { userId } } },
      OR: [
        { category: null },
        { category: "Outros" },
        { category: "Sem categoria" },
        { categoryConfidence: { lt: 0.7 } },
        { categorySource: { in: ["rules", "pluggy"] } },
      ],
    },
    include: {
      account: { select: { type: true, subtype: true } },
    },
    orderBy: { date: "desc" },
    take: 500,
  });

  if (transactions.length === 0) {
    return { processed: 0, updated: 0, skipped: 0 };
  }

  const mappings = await loadCategoryMappingMap(userId);
  const pendingAi: ClassifyTransactionInput[] = [];
  let updated = 0;
  let skipped = 0;

  for (const tx of transactions) {
    const cached = lookupCategoryMapping(mappings, tx.description, tx.merchantName);
    if (cached) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          category: cached,
          categorySource: "cache",
          categoryConfidence: 0.9,
        },
      });
      updated += 1;
      continue;
    }

    const rulesResult = resolveWithRules(tx.pluggyCategory, tx.description);
    if (hasHighCategoryConfidence(tx.pluggyCategory, rulesResult.category) || !isAiConfigured()) {
      if (rulesResult.category !== tx.category) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            category: rulesResult.category,
            categorySource: rulesResult.categorySource,
            categoryConfidence: rulesResult.categoryConfidence,
          },
        });
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    pendingAi.push({
      id: tx.id,
      pluggyCategory: tx.pluggyCategory,
      description: tx.description,
      merchantName: tx.merchantName,
      amount: tx.amount,
      date: tx.date.toISOString(),
      accountType: tx.account.type,
      accountSubtype: tx.account.subtype,
    });
  }

  if (pendingAi.length > 0 && isAiConfigured()) {
    const recentCategories = await getRecentUserCategories(userId);
    const aiResults = await categorizeTransactionsBatch(pendingAi, recentCategories);

    for (const result of aiResults) {
      const safeCategory = sanitizeFineGrainedCategory(result.category);
      await prisma.transaction.update({
        where: { id: result.id },
        data: {
          category: safeCategory,
          categorySource: result.source,
          categoryConfidence: result.confidence,
        },
      });
      updated += 1;

      const tx = transactions.find((t) => t.id === result.id);
      if (tx && result.confidence >= 0.7) {
        await prisma.categoryMapping.upsert({
          where: {
            userId_pattern: {
              userId,
              pattern: normalizeCategoryPattern(tx.description, tx.merchantName),
            },
          },
          create: {
            userId,
            pattern: normalizeCategoryPattern(tx.description, tx.merchantName),
            category: safeCategory,
            source: "ai",
            hitCount: 1,
          },
          update: {
            category: safeCategory,
            source: "ai",
            hitCount: { increment: 1 },
          },
        });
      }
    }
  }

  return {
    processed: transactions.length,
    updated,
    skipped,
  };
}
