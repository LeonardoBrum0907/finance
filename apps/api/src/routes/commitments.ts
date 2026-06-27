import type { FastifyInstance } from "fastify";
import {
  createCommitmentSchema,
  updateCommitmentSchema,
} from "@finance/shared";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";
import {
  createCommitmentFromTransaction,
  listActiveCommitments,
  matchCommitmentInstallments,
  updateCommitment,
} from "../services/finance/commitments.js";

export async function commitmentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/commitments", async (request, reply) => {
    const items = await listActiveCommitments(request.user!.sub);
    return reply.send({ items });
  });

  app.post("/api/commitments", async (request, reply) => {
    const parsed = createCommitmentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" });
    }

    try {
      const commitment = await createCommitmentFromTransaction({
        userId: request.user!.sub,
        ...parsed.data,
      });
      return reply.status(201).send(commitment);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar compromisso";
      return reply.status(400).send({ error: message });
    }
  });

  app.patch("/api/commitments/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateCommitmentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" });
    }

    try {
      const commitment = await updateCommitment(request.user!.sub, id, parsed.data);
      return reply.send(commitment);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar compromisso";
      return reply.status(404).send({ error: message });
    }
  });

  app.post("/api/commitments/match", async (request, reply) => {
    const matched = await matchCommitmentInstallments(request.user!.sub);
    return reply.send({ matched });
  });
}
