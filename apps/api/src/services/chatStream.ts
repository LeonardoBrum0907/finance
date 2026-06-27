import type { FastifyBaseLogger, FastifyReply } from "fastify";
import { streamText, stepCountIs, type CoreMessage } from "ai";
import type { ChatMessageMetadata } from "@finance/shared";
import { prisma } from "../prisma.js";
import { getAiEnv } from "../env.js";
import {
  buildFinancialContext,
  getModelForCandidate,
  getChatModelCandidates,
  buildAllCandidatesFailedMessage,
  formatAiErrorMessage,
  isRetryableWithNextModel,
  AI_MAX_RETRIES,
  SYSTEM_PROMPT,
  type ModelCandidate,
} from "./ai.js";
import { wrapToolsWithGuards } from "./aiGuards.js";
import {
  aiCallProviderOptions,
  buildSystemPrompt,
  extractCachedTokens,
  getCacheKey,
  isPromptCacheEnabled,
  logPromptCacheStats,
} from "./aiPromptCache.js";
import { combineAbortSignals, recordAiUsage } from "./aiUsage.js";
import { InvalidPersonError } from "./finance/queries.js";
import { createFinanceTools } from "./finance/tools.js";
import { touchThread } from "./chatThread.js";
import { extractProposalFromSteps } from "./chatProposal.js";
import { buildGoalsContextBlock } from "./finance/goalsContext.js";
import {
  buildHouseholdArena,
  buildHouseholdComparisonContext,
} from "./finance/householdComparison.js";
import { buildFollowUpSuggestions } from "./chatFollowUps.js";
import { extractBlocksFromSteps, extractToolActivityFromSteps } from "./chatBlocks.js";
import {
  formatMonthLabel,
  getLastSyncInfo,
  toLocalMonthKey,
} from "./finance/aggregates.js";
import { flattenConnections, loadUserFinancialData } from "./finance/queries.js";

export interface RunChatStreamOptions {
  userId: string;
  threadId: string;
  personId?: string;
  contextHint?: string;
  historyRows: { role: string; content: string }[];
  reply: FastifyReply;
  abortSignal?: AbortSignal;
  log: FastifyBaseLogger;
}

async function extractStreamUsage(
  streamResult: Awaited<ReturnType<typeof streamText>>,
): Promise<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  providerMetadata?: Record<string, Record<string, unknown> | undefined>;
}> {
  try {
    const usage =
      (await streamResult.totalUsage) ??
      (await streamResult.usage);
    const providerMetadata = (await streamResult.providerMetadata) as
      | Record<string, Record<string, unknown> | undefined>
      | undefined;
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    return {
      inputTokens,
      outputTokens,
      totalTokens: usage?.totalTokens ?? inputTokens + outputTokens,
      cachedInputTokens: extractCachedTokens(usage, providerMetadata),
      providerMetadata,
    };
  } catch {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedInputTokens: 0 };
  }
}

export async function runChatStream({
  userId,
  threadId,
  personId,
  contextHint,
  historyRows,
  reply,
  abortSignal,
  log,
}: RunChatStreamOptions): Promise<void> {
  const aiEnv = getAiEnv();
  const maxSteps = Number.isFinite(aiEnv.maxSteps) && aiEnv.maxSteps > 0 ? aiEnv.maxSteps : 6;
  const maxToolCalls =
    Number.isFinite(aiEnv.maxToolCalls) && aiEnv.maxToolCalls > 0 ? aiEnv.maxToolCalls : 6;

  let context: string;
  let goalsContext: string;
  let syncAt: string | null = null;
  try {
    const data = await loadUserFinancialData(userId, { personId });
    const connections = flattenConnections(data);
    const syncInfo = getLastSyncInfo(connections);
    if (syncInfo.length > 0) {
      const latest = syncInfo.reduce((a, b) =>
        (a.lastSyncedAt ?? "") > (b.lastSyncedAt ?? "") ? a : b,
      );
      syncAt = latest.lastSyncedAt ?? null;
    }

    [context, goalsContext] = await Promise.all([
      buildFinancialContext(userId, { personId }),
      buildGoalsContextBlock(userId, threadId),
    ]);
  } catch (err) {
    if (err instanceof InvalidPersonError) {
      reply.code(400).send({ error: "Pessoa não encontrada" });
      return;
    }
    throw err;
  }

  const currentMonth = toLocalMonthKey(new Date());
  const contextBlock = contextHint
    ? `\n\n## Contexto da interface\nO usuário veio de uma ação no app. Contexto adicional:\n${contextHint}`
    : "";

  let arenaBlock = "";
  if (!personId) {
    const arena = await buildHouseholdArena(userId);
    if (arena && arena.personCount >= 2) {
      arenaBlock = `\n\n# Arena financeira da casa\n${buildHouseholdComparisonContext(arena)}`;
    }
  }

  const dynamicContext = `# Dados financeiros do usuário\n${context}${arenaBlock}${contextBlock}\n\n# ${goalsContext}`;
  const systemPrompt = buildSystemPrompt(SYSTEM_PROMPT, dynamicContext);
  const chatCacheKey = isPromptCacheEnabled() ? getCacheKey("chat", SYSTEM_PROMPT) : undefined;
  const messages: CoreMessage[] = historyRows.map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  reply.raw.setHeader("Content-Type", "text/plain; charset=utf-8");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("X-Accel-Buffering", "no");

  const timeoutController = new AbortController();
  const timeoutMs =
    Number.isFinite(aiEnv.requestTimeoutMs) && aiEnv.requestTimeoutMs > 0
      ? aiEnv.requestTimeoutMs
      : 90_000;
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const streamAbortSignal = abortSignal
    ? combineAbortSignals([abortSignal, timeoutController.signal])
    : timeoutController.signal;

  const tools = wrapToolsWithGuards(createFinanceTools(userId, personId), maxToolCalls);
  let assistantText = "";
  let streamError: string | null = null;
  let streamErrorRaw: unknown = null;
  let streamResult: ReturnType<typeof streamText> | null = null;
  let usedCandidate: ModelCandidate | null = null;
  let stepCount = 0;
  const candidates = getChatModelCandidates();
  const primaryCandidate = candidates[0] ?? null;

  try {
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      if (streamAbortSignal.aborted) break;

      assistantText = "";
      streamError = null;
      streamErrorRaw = null;
      usedCandidate = candidate;
      stepCount = 0;

      streamResult = streamText({
        model: getModelForCandidate(candidate),
        system: systemPrompt,
        messages,
        tools,
        maxRetries: AI_MAX_RETRIES,
        stopWhen: stepCountIs(maxSteps),
        abortSignal: streamAbortSignal,
        ...aiCallProviderOptions(candidate, "chat", SYSTEM_PROMPT),
        onStepFinish: () => {
          stepCount += 1;
        },
        onError({ error }) {
          streamErrorRaw = error;
          streamError = formatAiErrorMessage(error);
        },
      }) as unknown as ReturnType<typeof streamText>;

      for await (const part of streamResult!.fullStream) {
        if (streamAbortSignal.aborted) break;
        if (part.type === "text-delta") {
          assistantText += part.text;
          reply.raw.write(part.text);
        } else if (part.type === "error") {
          streamErrorRaw = part.error;
          streamError = formatAiErrorMessage(part.error);
        }
      }

      const canRetry =
        streamErrorRaw != null &&
        isRetryableWithNextModel(streamErrorRaw) &&
        i < candidates.length - 1;

      if (assistantText || streamAbortSignal.aborted) break;
      if (!canRetry) break;

      log.warn({ candidate, err: streamError }, "Modelo indisponível, tentando fallback");
    }

    if (!assistantText && !streamAbortSignal.aborted && streamError) {
      assistantText = buildAllCandidatesFailedMessage(streamError);
      reply.raw.write(assistantText);
    }
  } catch (err) {
    if (streamAbortSignal.aborted) {
      reply.raw.end();
      return;
    }
    const errMsg = formatAiErrorMessage(err);
    log.error({ err, candidate: usedCandidate }, "Erro no streaming da IA");
    if (!assistantText) {
      assistantText = `Erro da IA: ${errMsg}`;
      reply.raw.write(assistantText);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  if (assistantText && !streamAbortSignal.aborted) {
    const lastUser = [...historyRows].reverse().find((m) => m.role === "user");
    const metadata: ChatMessageMetadata = {
      dataPeriod: formatMonthLabel(currentMonth),
      syncAt,
    };

    const successResponse =
      streamResult && !streamError && !assistantText.startsWith("Erro da IA:");

    if (successResponse) {
      try {
        const steps = await streamResult!.steps;
        metadata.toolActivity = extractToolActivityFromSteps(steps);
        metadata.blocks = extractBlocksFromSteps(steps);
        if (lastUser) {
          metadata.followUps = buildFollowUpSuggestions(lastUser.content, assistantText);
        }

        const usage = await extractStreamUsage(streamResult!);
        if (usedCandidate) {
          logPromptCacheStats(
            log,
            "chat",
            usedCandidate.provider === "openai" ? chatCacheKey : undefined,
            usage.inputTokens,
            usage.cachedInputTokens,
          );

          metadata.ai = {
            provider: usedCandidate.provider,
            modelId: usedCandidate.modelId,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
            cachedInputTokens: usage.cachedInputTokens || undefined,
            promptCacheKey:
              usedCandidate.provider === "openai" ? chatCacheKey : undefined,
            usedFallback: primaryCandidate
              ? `${usedCandidate.provider}:${usedCandidate.modelId}` !==
                `${primaryCandidate.provider}:${primaryCandidate.modelId}`
              : false,
            steps: steps.length || stepCount,
          };

          await recordAiUsage(userId, {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            provider: usedCandidate.provider,
            modelId: usedCandidate.modelId,
          });
        }
      } catch (metaErr) {
        log.warn({ err: metaErr }, "Falha ao extrair metadata da resposta");
      }
    } else if (lastUser) {
      metadata.followUps = buildFollowUpSuggestions(lastUser.content, assistantText);
    }

    const message = await prisma.chatMessage.create({
      data: {
        userId,
        threadId,
        role: "assistant",
        content: assistantText,
        metadata: metadata as object,
      } as Parameters<typeof prisma.chatMessage.create>[0]["data"],
    });

    if (successResponse) {
      try {
        const steps = await streamResult!.steps;
        const extracted = extractProposalFromSteps(steps);
        if (extracted) {
          await prisma.chatActionProposal.create({
            data: {
              userId,
              threadId,
              messageId: message.id,
              type: extracted.type,
              payload: extracted.payload as object,
              status: "pending",
            },
          });
        }
      } catch (proposalErr) {
        log.warn({ err: proposalErr }, "Falha ao persistir proposta da IA");
      }
    }

    await touchThread(threadId);
  }

  reply.raw.end();
}
