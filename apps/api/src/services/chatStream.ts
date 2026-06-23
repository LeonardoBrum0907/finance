import type { FastifyBaseLogger, FastifyReply } from "fastify";
import { streamText, generateText, stepCountIs, type CoreMessage } from "ai";
import { prisma } from "../prisma.js";
import {
  buildFinancialContext,
  getModel,
  SYSTEM_PROMPT,
} from "./ai.js";
import { InvalidPersonError } from "./finance/queries.js";
import { createFinanceTools } from "./finance/tools.js";
import { touchThread } from "./chatThread.js";
import { extractProposalFromSteps } from "./chatProposal.js";
import { buildGoalsContextBlock } from "./finance/goalsContext.js";

export interface RunChatStreamOptions {
  userId: string;
  threadId: string;
  personId?: string;
  historyRows: { role: string; content: string }[];
  reply: FastifyReply;
  abortSignal?: AbortSignal;
  log: FastifyBaseLogger;
}

export async function runChatStream({
  userId,
  threadId,
  personId,
  historyRows,
  reply,
  abortSignal,
  log,
}: RunChatStreamOptions): Promise<void> {
  let context: string;
  let goalsContext: string;
  try {
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

  const messages: CoreMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\n# Dados financeiros do usuário\n${context}\n\n# ${goalsContext}`,
    },
    ...historyRows.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),
  ];

  reply.raw.setHeader("Content-Type", "text/plain; charset=utf-8");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("X-Accel-Buffering", "no");

  let assistantText = "";
  let streamError: string | null = null;
  const tools = createFinanceTools(userId, personId);
  let pendingSteps: Promise<Parameters<typeof extractProposalFromSteps>[0]> | null = null;

  try {
    const streamResult = streamText({
      model: getModel(),
      messages,
      tools,
      stopWhen: stepCountIs(8),
      abortSignal,
      onError({ error }) {
        streamError = error instanceof Error ? error.message : String(error);
      },
    });
    pendingSteps = streamResult.steps as Promise<Parameters<typeof extractProposalFromSteps>[0]>;

    for await (const chunk of streamResult.textStream) {
      if (abortSignal?.aborted) break;
      assistantText += chunk;
      reply.raw.write(chunk);
    }

    if (!assistantText && !abortSignal?.aborted) {
      if (streamError) {
        assistantText = `Erro da IA: ${streamError}`;
        reply.raw.write(assistantText);
      } else {
        try {
          const { text } = await generateText({
            model: getModel(),
            messages,
            tools,
            stopWhen: stepCountIs(8),
            abortSignal,
          });
          assistantText = text;
          reply.raw.write(text);
        } catch (fallbackErr) {
          const errMsg =
            fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          assistantText = `Erro da IA: ${errMsg}`;
          reply.raw.write(assistantText);
        }
      }
    }
  } catch (err) {
    if (abortSignal?.aborted) {
      reply.raw.end();
      return;
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error({ err }, "Erro no streaming da IA");
    if (!assistantText) {
      assistantText = `Erro da IA: ${errMsg}`;
      reply.raw.write(assistantText);
    }
  }

  if (assistantText && !abortSignal?.aborted) {
    const message = await prisma.chatMessage.create({
      data: { userId, threadId, role: "assistant", content: assistantText },
    });

    if (pendingSteps) {
      try {
        const steps = await pendingSteps;
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
