import type { FastifyInstance } from "fastify";
import { streamText, generateText, stepCountIs, type CoreMessage } from "ai";
import { chatMessageSchema } from "@finance/shared";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";
import {
  buildFinancialContext,
  getModel,
  isAiConfigured,
  SYSTEM_PROMPT,
} from "../services/ai.js";
import { InvalidPersonError } from "../services/finance/queries.js";
import { createFinanceTools } from "../services/finance/tools.js";

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/chat/status", async (_request, reply) => {
    return reply.send({ configured: isAiConfigured() });
  });

  app.get("/api/chat/messages", async (request, reply) => {
    const messages = await prisma.chatMessage.findMany({
      where: { userId: request.user!.sub },
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
    const userText = parsed.data.message;
    const personId = parsed.data.personId;

    await prisma.chatMessage.create({
      data: { userId, role: "user", content: userText },
    });

    const history = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: 40,
    });

    let context: string;
    try {
      context = await buildFinancialContext(userId, { personId });
    } catch (err) {
      if (err instanceof InvalidPersonError) {
        return reply.code(400).send({ error: "Pessoa não encontrada" });
      }
      throw err;
    }

    const messages: CoreMessage[] = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\n# Dados financeiros do usuário\n${context}`,
      },
      ...history.map((m) => ({
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
    try {
      const result = streamText({
        model: getModel(),
        messages,
        tools,
        stopWhen: stepCountIs(5),
        onError({ error }) {
          streamError = error instanceof Error ? error.message : String(error);
        },
      });
      for await (const chunk of result.textStream) {
        assistantText += chunk;
        reply.raw.write(chunk);
      }

      if (!assistantText) {
        if (streamError) {
          assistantText = `Erro da IA: ${streamError}`;
          reply.raw.write(assistantText);
        } else {
          try {
            const { text } = await generateText({
              model: getModel(),
              messages,
              tools,
              stopWhen: stepCountIs(5),
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
      const errMsg = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "Erro no streaming da IA");
      if (!assistantText) {
        assistantText = `Erro da IA: ${errMsg}`;
        reply.raw.write(assistantText);
      }
    }

    if (assistantText) {
      await prisma.chatMessage.create({
        data: { userId, role: "assistant", content: assistantText },
      });
    }

    reply.raw.end();
    return reply;
  });
}
