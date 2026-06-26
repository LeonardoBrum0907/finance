import type { FastifyInstance } from "fastify";
import {
  chatMessageSchema,
  createChatThreadSchema,
  regenerateChatSchema,
  updateChatThreadSchema,
} from "@finance/shared";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";
import { isAiConfigured } from "../services/ai.js";
import { runChatStream } from "../services/chatStream.js";
import { applyChatProposal, serializeProposal, computeProposalImpact } from "../services/chatProposal.js";
import {
  autoTitleFromFirstMessage,
  findUserThread,
  resetThreadTitle,
  touchThread,
} from "../services/chatThread.js";
import { buildChatSuggestions, buildChatContextSummary } from "../services/chatSuggestions.js";
import { buildChatAlerts } from "../services/chatAlerts.js";
import { createWeeklyRecap } from "../services/chatRecap.js";
import { serializeMessage } from "../services/chatMessage.js";

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/chat/status", async (_request, reply) => {
    return reply.send({ configured: isAiConfigured() });
  });

  app.get("/api/chat/suggestions", async (request, reply) => {
    const personId = (request.query as { personId?: string }).personId;
    const suggestions = await buildChatSuggestions(request.user!.sub, personId);
    return reply.send(suggestions);
  });

  app.get("/api/chat/context-summary", async (request, reply) => {
    const personId = (request.query as { personId?: string }).personId;
    const summary = await buildChatContextSummary(request.user!.sub, personId);
    return reply.send(summary);
  });

  app.get("/api/chat/alerts", async (request, reply) => {
    const alerts = await buildChatAlerts(request.user!.sub);
    return reply.send(alerts);
  });

  app.post("/api/chat/recap", async (request, reply) => {
    if (!isAiConfigured()) {
      return reply.code(503).send({ error: "IA não configurada no servidor" });
    }
    const recap = await createWeeklyRecap(request.user!.sub);
    return reply.send(recap);
  });

  app.get("/api/chat/threads", async (request, reply) => {
    const threads = await prisma.chatThread.findMany({
      where: { userId: request.user!.sub },
      orderBy: { updatedAt: "desc" },
    });
    return reply.send(
      threads.map((t) => ({
        id: t.id,
        title: t.title,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    );
  });

  app.post("/api/chat/threads", async (request, reply) => {
    const parsed = createChatThreadSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }
    const thread = await prisma.chatThread.create({
      data: {
        userId: request.user!.sub,
        title: parsed.data.title ?? "Nova conversa",
      },
    });
    return reply.code(201).send({
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    });
  });

  app.patch("/api/chat/threads/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateChatThreadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }
    const thread = await findUserThread(request.user!.sub, id);
    if (!thread) return reply.code(404).send({ error: "Conversa não encontrada" });

    const updated = await prisma.chatThread.update({
      where: { id },
      data: { title: parsed.data.title },
    });
    return reply.send({
      id: updated.id,
      title: updated.title,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  });

  app.delete("/api/chat/threads/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const thread = await findUserThread(request.user!.sub, id);
    if (!thread) return reply.code(404).send({ error: "Conversa não encontrada" });

    await prisma.chatThread.delete({ where: { id } });
    return reply.code(204).send();
  });

  app.delete("/api/chat/threads/:threadId/messages", async (request, reply) => {
    const { threadId } = request.params as { threadId: string };
    const thread = await findUserThread(request.user!.sub, threadId);
    if (!thread) return reply.code(404).send({ error: "Conversa não encontrada" });

    await prisma.chatMessage.deleteMany({ where: { threadId } });
    await resetThreadTitle(threadId);
    return reply.code(204).send();
  });

  app.get("/api/chat/messages", async (request, reply) => {
    const threadId = (request.query as { threadId?: string }).threadId;
    if (!threadId) {
      return reply.code(400).send({ error: "Informe threadId" });
    }
    const thread = await findUserThread(request.user!.sub, threadId);
    if (!thread) return reply.code(404).send({ error: "Conversa não encontrada" });

    const messages = await prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: { proposal: true },
    });
    return reply.send(messages.map((m) => serializeMessage(m)));
  });

  app.post("/api/chat", async (request, reply) => {
    const parsed = chatMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }
    if (!isAiConfigured()) {
      return reply.code(503).send({ error: "IA não configurada no servidor" });
    }

    const userId = request.user!.sub;
    const { message: userText, threadId, personId, contextHint } = parsed.data;

    const thread = await findUserThread(userId, threadId);
    if (!thread) return reply.code(404).send({ error: "Conversa não encontrada" });

    await prisma.chatMessage.create({
      data: { userId, threadId, role: "user", content: userText },
    });
    await autoTitleFromFirstMessage(threadId, userText);
    await touchThread(threadId);

    const history = await prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      take: 40,
    });

    await runChatStream({
      userId,
      threadId,
      personId,
      contextHint,
      historyRows: history,
      reply,
      abortSignal: request.signal,
      log: request.log,
    });
    return reply;
  });

  app.post("/api/chat/regenerate", async (request, reply) => {
    const parsed = regenerateChatSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }
    if (!isAiConfigured()) {
      return reply.code(503).send({ error: "IA não configurada no servidor" });
    }

    const userId = request.user!.sub;
    const { threadId, personId } = parsed.data;

    const thread = await findUserThread(userId, threadId);
    if (!thread) return reply.code(404).send({ error: "Conversa não encontrada" });

    const last = await prisma.chatMessage.findFirst({
      where: { threadId },
      orderBy: { createdAt: "desc" },
    });
    if (!last || last.role !== "assistant") {
      return reply.code(400).send({ error: "Nenhuma resposta para regenerar" });
    }

    await prisma.chatMessage.delete({ where: { id: last.id } });

    const history = await prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      take: 40,
    });

    await runChatStream({
      userId,
      threadId,
      personId,
      historyRows: history,
      reply,
      abortSignal: request.signal,
      log: request.log,
    });
    return reply;
  });

  app.post("/api/chat/proposals/:id/confirm", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.sub;

    const proposal = await prisma.chatActionProposal.findFirst({
      where: { id, userId, status: "pending" },
    });
    if (!proposal) {
      return reply.code(404).send({ error: "Proposta não encontrada ou já resolvida" });
    }

    try {
      await applyChatProposal(
        userId,
        proposal.type as Parameters<typeof applyChatProposal>[1],
        proposal.payload as Record<string, unknown>,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao aplicar proposta";
      return reply.code(400).send({ error: message });
    }

    const updated = await prisma.chatActionProposal.update({
      where: { id },
      data: { status: "confirmed", resolvedAt: new Date() },
    });

    return reply.send({
      proposal: {
        ...serializeProposal(updated),
        impactSummary: computeProposalImpact(updated.type, updated.payload),
      },
    });
  });

  app.post("/api/chat/proposals/:id/discard", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.sub;

    const proposal = await prisma.chatActionProposal.findFirst({
      where: { id, userId, status: "pending" },
    });
    if (!proposal) {
      return reply.code(404).send({ error: "Proposta não encontrada ou já resolvida" });
    }

    const updated = await prisma.chatActionProposal.update({
      where: { id },
      data: { status: "discarded", resolvedAt: new Date() },
    });

    return reply.send({
      proposal: {
        ...serializeProposal(updated),
        impactSummary: computeProposalImpact(updated.type, updated.payload),
      },
    });
  });
}
