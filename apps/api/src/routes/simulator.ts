import type { FastifyInstance } from "fastify";
import { simulationInputSchema } from "@finance/shared";
import { authenticate } from "../auth.js";
import {
  fetchSimulatorBaseline,
  runSimulation,
} from "../services/finance/purchaseSimulation.js";
import { InvalidPersonError } from "../services/finance/queries.js";
import { prisma } from "../prisma.js";

export async function simulatorRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/simulator/baseline", async (request, reply) => {
    const query = request.query as { personId?: string };
    const personId = query.personId?.trim() || undefined;
    const userId = request.user!.sub;

    if (personId) {
      const person = await prisma.person.findFirst({
        where: { id: personId, userId },
      });
      if (!person) {
        return reply.status(404).send({ error: "Pessoa não encontrada" });
      }
    }

    const baseline = await fetchSimulatorBaseline(userId, personId);
    return baseline;
  });

  app.post("/api/simulator/run", async (request, reply) => {
    const parsed = simulationInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      });
    }

    const userId = request.user!.sub;

    if (parsed.data.personId) {
      const person = await prisma.person.findFirst({
        where: { id: parsed.data.personId, userId },
      });
      if (!person) {
        return reply.status(404).send({ error: "Pessoa não encontrada" });
      }
    }

    try {
      const result = await runSimulation(userId, parsed.data);
      return result;
    } catch (err) {
      if (err instanceof InvalidPersonError) {
        return reply.status(404).send({ error: err.message });
      }
      throw err;
    }
  });
}
