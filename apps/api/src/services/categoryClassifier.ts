import { generateObject } from "ai";
import { z } from "zod";
import {
  FINE_GRAINED_CATEGORIES,
  sanitizeFineGrainedCategory,
  type CategorySource,
} from "@finance/shared";
import { getAiEnv } from "../env.js";
import { getModel, isAiConfigured, type AiProvider } from "./ai.js";
import {
  aiCallProviderOptions,
  buildSystemPrompt,
  extractCachedTokens,
  getCacheKey,
  isPromptCacheEnabled,
} from "./aiPromptCache.js";

const BATCH_SIZE = 20;

const batchResultSchema = z.object({
  results: z.array(
    z.object({
      index: z.number().int().min(0),
      category: z.string(),
      confidence: z.number().min(0).max(1),
      reasoning: z.string().optional(),
    }),
  ),
});

export interface ClassifyTransactionInput {
  id: string;
  pluggyCategory: string | null;
  description: string;
  merchantName: string | null;
  amount: number;
  date: string;
  accountType: string | null;
  accountSubtype: string | null;
}

export interface ClassifyTransactionResult {
  id: string;
  category: string;
  confidence: number;
  source: CategorySource;
}

const CLASSIFIER_PROMPT = `Você classifica transações financeiras brasileiras em categorias finas pré-definidas.
Use a categoria do banco (Pluggy), descrição, estabelecimento, valor, data e tipo de conta.
Prefira a categoria MAIS ESPECÍFICA da lista. Exemplos:
- "IFOOD" + Shopping → Delivery de comida
- "UBER" + Transport → Táxi e aplicativos
- "NETFLIX" + Digital services → Streaming de vídeo
- PIX genérico sem contexto → Transferências ou Transferência - PIX
- Pagamento de fatura de cartão → Pagamento de cartão de crédito
- Igreja, Lagoinha → Igreja
Se incerto, use "Outros" com confidence baixa (< 0.5).
A categoria DEVE ser exatamente um item da lista fornecida.`;

function buildClassifierStaticSystem(): string {
  return `${CLASSIFIER_PROMPT}

Categorias válidas:
${FINE_GRAINED_CATEGORIES.join(", ")}`;
}

function buildFewShotBlock(recentCategories: string[]): string {
  if (recentCategories.length === 0) return "";
  return `\nCategorias recentes deste usuário: ${recentCategories.join(", ")}`;
}

export async function categorizeTransactionsBatch(
  transactions: ClassifyTransactionInput[],
  recentCategories: string[] = [],
): Promise<ClassifyTransactionResult[]> {
  if (transactions.length === 0) return [];
  if (!isAiConfigured()) {
    return transactions.map((tx) => ({
      id: tx.id,
      category: sanitizeFineGrainedCategory(null),
      confidence: 0,
      source: "rules" as const,
    }));
  }

  const results: ClassifyTransactionResult[] = [];

  for (let offset = 0; offset < transactions.length; offset += BATCH_SIZE) {
    const batch = transactions.slice(offset, offset + BATCH_SIZE);
    const batchResults = await classifyBatch(batch, recentCategories);
    results.push(...batchResults);
  }

  return results;
}

async function classifyBatch(
  batch: ClassifyTransactionInput[],
  recentCategories: string[],
): Promise<ClassifyTransactionResult[]> {
  const txList = batch
    .map(
      (tx, index) =>
        `[${index}] data=${tx.date.slice(0, 10)} | valor=${tx.amount} | conta=${tx.accountType ?? "?"} | pluggy="${tx.pluggyCategory ?? ""}" | merchant="${tx.merchantName ?? ""}" | desc="${tx.description}"`,
    )
    .join("\n");

  try {
    const staticSystem = buildClassifierStaticSystem();
    const dynamicFewShot = buildFewShotBlock(recentCategories);
    const system = buildSystemPrompt(staticSystem, dynamicFewShot);
    const provider = getAiEnv().provider as AiProvider;

    const { object, usage, providerMetadata } = await generateObject({
      model: getModel(),
      schema: batchResultSchema,
      system,
      prompt: `Classifique cada transação pelo índice:\n${txList}`,
      ...aiCallProviderOptions({ provider }, "classifier", staticSystem),
    });

    if (isPromptCacheEnabled() && provider === "openai") {
      const cached = extractCachedTokens(
        usage,
        providerMetadata as Record<string, Record<string, unknown> | undefined>,
      );
      if (cached > 0) {
        console.debug("[categoryClassifier] prompt cache hit", {
          cacheKey: getCacheKey("classifier", staticSystem),
          inputTokens: usage?.inputTokens,
          cachedInputTokens: cached,
        });
      }
    }

    const byIndex = new Map(object.results.map((r) => [r.index, r]));

    return batch.map((tx, index) => {
      const match = byIndex.get(index);
      if (!match) {
        return {
          id: tx.id,
          category: "Outros",
          confidence: 0.3,
          source: "ai" as const,
        };
      }
      return {
        id: tx.id,
        category: sanitizeFineGrainedCategory(match.category),
        confidence: match.confidence,
        source: "ai" as const,
      };
    });
  } catch (err) {
    console.error("[categoryClassifier] batch failed:", err);
    return batch.map((tx) => ({
      id: tx.id,
      category: "Outros",
      confidence: 0,
      source: "rules" as const,
    }));
  }
}

export async function getRecentUserCategories(userId: string): Promise<string[]> {
  const { prisma } = await import("../prisma.js");
  const rows = await prisma.transaction.findMany({
    where: {
      account: { connection: { person: { userId } } },
      category: { not: null },
    },
    select: { category: true },
    orderBy: { date: "desc" },
    take: 200,
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    const cat = row.category?.trim();
    if (!cat || cat === "Outros") continue;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => cat);
}
