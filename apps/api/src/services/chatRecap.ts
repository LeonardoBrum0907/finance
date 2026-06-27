import { generateText } from "ai";
import { prisma } from "../prisma.js";
import { getAiEnv } from "../env.js";
import { buildFinancialContext, getModel, SYSTEM_PROMPT, type AiProvider } from "./ai.js";
import {
  aiCallProviderOptions,
  buildSystemPrompt,
  extractCachedTokens,
  getCacheKey,
  isPromptCacheEnabled,
  type PromptCacheScope,
} from "./aiPromptCache.js";
import { buildGoalsContextBlock } from "./finance/goalsContext.js";
import {
  buildHouseholdArena,
  buildHouseholdComparisonContext,
  householdRecapContextKey,
  personRecapContextKey,
} from "./finance/householdComparison.js";
import { findOrCreateThread } from "./chatThread.js";

const ARENA_TONE = `Tom competitivo leve: elogie quem foi bem e provoque (com humor) comportamentos ruins.
Ataque comportamentos, nunca a pessoa. Nunca ironize renda, saúde ou família.`;

const HOUSEHOLD_RECAP_PROMPT = `Gere um resumo semanal da CASA (todas as pessoas) em português do Brasil.
Use markdown leve (títulos ## e listas). Inclua:
1. Ranking e dinâmica entre as pessoas
2. Destaques de receitas e despesas consolidadas
3. Comparações diretas mais relevantes
4. Status dos objetivos compartilhados (se houver)
5. Uma ação prática para a próxima semana
${ARENA_TONE}
Baseie-se APENAS nos dados fornecidos. Máximo 350 palavras.`;

const PERSON_RECAP_PROMPT = `Gere um resumo semanal INDIVIDUAL em português do Brasil para a pessoa em foco.
Use markdown leve (títulos ## e listas). Inclua:
1. Desempenho da pessoa na semana (sobra/déficit)
2. Categorias que mais pesaram
3. Posição no ranking da casa (se houver outras pessoas)
4. Um elogio ou provocação leve sobre o comportamento financeiro
5. Uma ação prática para a próxima semana
${ARENA_TONE}
Baseie-se APENAS nos dados fornecidos. Máximo 300 palavras.`;

const SINGLE_PERSON_RECAP_PROMPT = `Gere um resumo semanal conciso das finanças do usuário em português do Brasil.
Use markdown leve (títulos ## e listas). Inclua destaques, categorias, sobra/saldo, objetivos e uma ação prática.
Seja direto. Baseie-se APENAS nos dados fornecidos. Máximo 300 palavras.`;

export type RecapScope = "household" | "person";

export interface CreateWeeklyRecapOptions {
  scope?: RecapScope;
  personId?: string;
}

function recapFromMessage(
  threadId: string,
  content: string,
  createdAt: string,
  extra?: Partial<{
    scope: RecapScope;
    personId: string;
    personName: string;
  }>,
) {
  const preview = content.slice(0, 160);
  return {
    threadId,
    content,
    preview: preview.length < content.length ? `${preview}…` : preview,
    createdAt,
    ...extra,
  };
}

async function generateRecapText(
  staticSystem: string,
  dynamicContext: string,
  scope: PromptCacheScope,
): Promise<string> {
  const provider = getAiEnv().provider as AiProvider;
  const system = buildSystemPrompt(staticSystem, dynamicContext);

  const { text, usage, providerMetadata } = await generateText({
    model: getModel(),
    system,
    prompt: "Gere o resumo semanal com base no contexto fornecido.",
    ...aiCallProviderOptions({ provider }, scope, staticSystem),
  });

  if (isPromptCacheEnabled() && provider === "openai") {
    const cached = extractCachedTokens(
      usage,
      providerMetadata as Record<string, Record<string, unknown> | undefined>,
    );
    if (cached > 0) {
      console.debug("[chatRecap] prompt cache hit", {
        scope,
        cacheKey: getCacheKey(scope, staticSystem),
        inputTokens: usage?.inputTokens,
        cachedInputTokens: cached,
      });
    }
  }

  return text;
}

export async function createWeeklyRecap(
  userId: string,
  options: CreateWeeklyRecapOptions = {},
) {
  const scope = options.scope ?? "household";
  const arena = await buildHouseholdArena(userId);

  if (!arena) {
    throw new Error("Sem dados financeiros para gerar resumo");
  }

  if (scope === "person") {
    if (!options.personId) {
      throw new Error("Informe personId para resumo individual");
    }
    const ranking = arena.rankings.find((r) => r.personId === options.personId);
    if (!ranking) {
      throw new Error("Pessoa não encontrada");
    }

    const thread = await findOrCreateThread(userId, {
      contextKey: personRecapContextKey(options.personId),
      title: `Semana — ${ranking.personName}`,
    });

    const lastMessage = await prisma.chatMessage.findFirst({
      where: { threadId: thread.id },
      orderBy: { createdAt: "desc" },
    });

    if (lastMessage) {
      return recapFromMessage(thread.id, lastMessage.content, lastMessage.createdAt.toISOString(), {
        scope: "person",
        personId: ranking.personId,
        personName: ranking.personName,
      });
    }

    const [context, goalsContext] = await Promise.all([
      buildFinancialContext(userId, { personId: options.personId }),
      buildGoalsContextBlock(userId),
    ]);
    const arenaBlock = buildHouseholdComparisonContext(arena);
    const staticSystem = `${SYSTEM_PROMPT}\n\n${PERSON_RECAP_PROMPT}`;
    const dynamicContext = `# Dados financeiros (${ranking.personName})\n${context}\n\n# ${goalsContext}\n\n${arenaBlock}`;

    const text = await generateRecapText(staticSystem, dynamicContext, "recap-person");

    const message = await prisma.chatMessage.create({
      data: {
        userId,
        threadId: thread.id,
        role: "assistant",
        content: text,
        metadata: { dataPeriod: "semana", personId: options.personId },
      } as Parameters<typeof prisma.chatMessage.create>[0]["data"],
    });

    return recapFromMessage(thread.id, text, message.createdAt.toISOString(), {
      scope: "person",
      personId: ranking.personId,
      personName: ranking.personName,
    });
  }

  const thread = await findOrCreateThread(userId, {
    contextKey: householdRecapContextKey(),
    title: arena.personCount > 1 ? "Resumo da casa" : "Resumo da semana",
  });

  const lastMessage = await prisma.chatMessage.findFirst({
    where: { threadId: thread.id },
    orderBy: { createdAt: "desc" },
  });

  if (lastMessage) {
    return recapFromMessage(thread.id, lastMessage.content, lastMessage.createdAt.toISOString(), {
      scope: "household",
    });
  }

  const recapScope: PromptCacheScope =
    arena.personCount > 1 ? "recap-household" : "recap-single";
  const staticSystem = `${SYSTEM_PROMPT}\n\n${
    arena.personCount > 1 ? HOUSEHOLD_RECAP_PROMPT : SINGLE_PERSON_RECAP_PROMPT
  }`;

  const [context, goalsContext] = await Promise.all([
    buildFinancialContext(userId),
    buildGoalsContextBlock(userId),
  ]);

  const dynamicParts = [`# Dados financeiros\n${context}`, `# ${goalsContext}`];
  if (arena.personCount > 1) {
    dynamicParts.push(buildHouseholdComparisonContext(arena));
  }
  const dynamicContext = dynamicParts.join("\n\n");

  const text = await generateRecapText(staticSystem, dynamicContext, recapScope);

  const message = await prisma.chatMessage.create({
    data: {
      userId,
      threadId: thread.id,
      role: "assistant",
      content: text,
      metadata: { dataPeriod: "semana" },
    } as Parameters<typeof prisma.chatMessage.create>[0]["data"],
  });

  return recapFromMessage(thread.id, text, message.createdAt.toISOString(), {
    scope: "household",
  });
}
