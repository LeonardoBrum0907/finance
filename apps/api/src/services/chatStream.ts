import type { FastifyBaseLogger, FastifyReply } from "fastify";
import { streamText, stepCountIs, type CoreMessage } from "ai";
import type { ChatMessageMetadata } from "@finance/shared";
import { prisma } from "../prisma.js";
import {
  buildFinancialContext,
  getModelForCandidate,
  getModelCandidates,
  buildAllCandidatesFailedMessage,
  formatAiErrorMessage,
  isRetryableWithNextModel,
  AI_MAX_RETRIES,
  SYSTEM_PROMPT,
  type ModelCandidate,
} from "./ai.js";
import { InvalidPersonError } from "./finance/queries.js";
import { createFinanceTools } from "./finance/tools.js";
import { touchThread } from "./chatThread.js";
import { extractProposalFromSteps } from "./chatProposal.js";
import { buildGoalsContextBlock } from "./finance/goalsContext.js";
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

  const systemPrompt = `${SYSTEM_PROMPT}\n\n# Dados financeiros do usuário\n${context}${contextBlock}\n\n# ${goalsContext}`;
  const messages: CoreMessage[] = historyRows.map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  reply.raw.setHeader("Content-Type", "text/plain; charset=utf-8");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("X-Accel-Buffering", "no");

  const tools = createFinanceTools(userId, personId);
  let assistantText = "";
  let streamError: string | null = null;
  let streamErrorRaw: unknown = null;
  let streamResult: ReturnType<typeof streamText> | null = null;
  let usedCandidate: ModelCandidate | null = null;
  const candidates = getModelCandidates();

  try {
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      if (abortSignal?.aborted) break;

      assistantText = "";
      streamError = null;
      streamErrorRaw = null;
      usedCandidate = candidate;

      streamResult = streamText({
        model: getModelForCandidate(candidate),
        system: systemPrompt,
        messages,
        tools,
        maxRetries: AI_MAX_RETRIES,
        stopWhen: stepCountIs(8),
        abortSignal,
        onError({ error }) {
          streamErrorRaw = error;
          streamError = formatAiErrorMessage(error);
        },
      }) as unknown as ReturnType<typeof streamText>;

      for await (const part of streamResult!.fullStream) {
        if (abortSignal?.aborted) break;
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

      if (assistantText || abortSignal?.aborted) break;
      if (!canRetry) break;

      log.warn({ candidate, err: streamError }, "Modelo indisponível, tentando fallback");
    }

    if (!assistantText && !abortSignal?.aborted && streamError) {
      assistantText = buildAllCandidatesFailedMessage(streamError);
      reply.raw.write(assistantText);
    }
  } catch (err) {
    if (abortSignal?.aborted) {
      reply.raw.end();
      return;
    }
    const errMsg = formatAiErrorMessage(err);
    log.error({ err, candidate: usedCandidate }, "Erro no streaming da IA");
    if (!assistantText) {
      assistantText = `Erro da IA: ${errMsg}`;
      reply.raw.write(assistantText);
    }
  }

  if (assistantText && !abortSignal?.aborted) {
    const lastUser = [...historyRows].reverse().find((m) => m.role === "user");
    const metadata: ChatMessageMetadata = {
      dataPeriod: formatMonthLabel(currentMonth),
      syncAt,
    };

    if (streamResult && !streamError && !assistantText.startsWith("Erro da IA:")) {
      try {
        const steps = await streamResult.steps;
        metadata.toolActivity = extractToolActivityFromSteps(steps);
        metadata.blocks = extractBlocksFromSteps(steps);
        if (lastUser) {
          metadata.followUps = buildFollowUpSuggestions(lastUser.content, assistantText);
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

    if (streamResult && !streamError && !assistantText.startsWith("Erro da IA:")) {
      try {
        const steps = await streamResult.steps;
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
