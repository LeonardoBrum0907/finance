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
import {
  autoTitleFromFirstMessage,
  findUserThread,
  resetThreadTitle,
  touchThread,
} from "../services/chatThread.js";

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/chat/status", async (_request, reply) => {
    return reply.send({ configured: isAiConfigured() });
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
    });
    return reply.send(
      messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    );
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
    const { message: userText, threadId, personId } = parsed.data;

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
}
