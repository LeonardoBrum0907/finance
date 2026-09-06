import type { FastifyInstance } from "fastify";
import { createConnectionSchema, isCreditAccount, updateCreditAccountSchema } from "@finance/shared";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";
import { isPluggyConfigured } from "../env.js";
import { createConnectToken, syncConnection } from "../services/pluggy.js";
import { serializeAccount } from "../services/serializeAccount.js";

export async function connectionRoutes(app: FastifyInstance): Promise<void> {
  // Webhook publico da Pluggy (sem autenticacao de usuario)
  app.post("/api/pluggy/webhook", async (request, reply) => {
    const body = request.body as { event?: string; itemId?: string };
    if (body?.itemId) {
      const connection = await prisma.bankConnection.findUnique({
        where: { pluggyItemId: body.itemId },
      });
      if (connection) {
        syncConnection(connection.id).catch((err) =>
          app.log.error({ err }, "Falha ao sincronizar via webhook"),
        );
      }
    }
    return reply.send({ ok: true });
  });

  app.register(async (secured) => {
    secured.addHook("preHandler", authenticate);

    secured.get("/api/pluggy/status", async (_request, reply) => {
      return reply.send({ configured: isPluggyConfigured() });
    });

    secured.post("/api/pluggy/connect-token", async (request, reply) => {
      if (!isPluggyConfigured()) {
        return reply.code(503).send({ error: "Pluggy não configurado no servidor" });
      }
      try {
        const accessToken = await createConnectToken(request.user!.sub);
        return reply.send({ accessToken });
      } catch (err) {
        request.log.error({ err }, "Erro ao criar connect token");
        return reply.code(502).send({ error: "Falha ao gerar token da Pluggy" });
      }
    });

    secured.post("/api/connections", async (request, reply) => {
      const parsed = createConnectionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message });
      }
      const { personId, itemId } = parsed.data;

      const person = await prisma.person.findFirst({
        where: { id: personId, userId: request.user!.sub },
      });
      if (!person) return reply.code(404).send({ error: "Pessoa não encontrada" });

      const connection = await prisma.bankConnection.upsert({
        where: { pluggyItemId: itemId },
        create: { pluggyItemId: itemId, personId, status: "UPDATING" },
        update: { personId },
      });

      try {
        await syncConnection(connection.id);
      } catch (err) {
        request.log.error({ err }, "Erro ao sincronizar conexão");
      }

      const full = await prisma.bankConnection.findUnique({
        where: { id: connection.id },
        include: { accounts: true },
      });
      return reply.code(201).send(full);
    });

    secured.post("/api/connections/:id/sync", async (request, reply) => {
      const { id } = request.params as { id: string };
      const connection = await prisma.bankConnection.findFirst({
        where: { id, person: { userId: request.user!.sub } },
      });
      if (!connection) return reply.code(404).send({ error: "Conexão não encontrada" });
      try {
        await syncConnection(id);
      } catch (err) {
        request.log.error({ err }, "Erro ao sincronizar conexão");
        return reply.code(502).send({ error: "Falha ao sincronizar" });
      }
      return reply.send({ ok: true });
    });

    secured.delete("/api/connections/:id", async (request, reply) => {
      const { id } = request.params as { id: string };
      const connection = await prisma.bankConnection.findFirst({
        where: { id, person: { userId: request.user!.sub } },
      });
      if (!connection) return reply.code(404).send({ error: "Conexão não encontrada" });
      await prisma.bankConnection.delete({ where: { id } });
      return reply.send({ ok: true });
    });

    secured.patch("/api/accounts/:id", async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateCreditAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" });
      }

      const account = await prisma.account.findFirst({
        where: { id, connection: { person: { userId: request.user!.sub } } },
      });
      if (!account) return reply.code(404).send({ error: "Conta não encontrada" });
      if (!isCreditAccount(account.type)) {
        return reply.code(400).send({ error: "Calendário de fatura só vale para cartão de crédito" });
      }

      const updated = await prisma.account.update({
        where: { id },
        data: {
          ...(parsed.data.billDueDay !== undefined ? { billDueDay: parsed.data.billDueDay } : {}),
          ...(parsed.data.billCloseDay !== undefined ? { billCloseDay: parsed.data.billCloseDay } : {}),
        },
      });
      return reply.send(serializeAccount(updated));
    });
  });
}
