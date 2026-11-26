import type { FastifyInstance } from "fastify";
import {
  completeSimulationSchema,
  createSimulationScenarioSchema,
  updateSimulationScenarioSchema,
} from "@finance/shared";
import { authenticate } from "../auth.js";
import { prisma } from "../prisma.js";
import {
  completeScenario,
  createScenario,
  deleteScenario,
  listScenarios,
  ScenarioInvalidStateError,
  ScenarioNotFoundError,
  updateScenario,
} from "../services/finance/simulationScenarios.js";

export async function simulationsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  /** @deprecated Prefer GET /api/accounts?kind=simulation */
  app.get("/api/simulations", async (request) => {
    const query = request.query as { status?: string; personId?: string };
    const userId = request.user!.sub;
    return listScenarios(userId, {
      status: query.status?.trim() || undefined,
      personId: query.personId?.trim() || undefined,
    });
  });

  app.post("/api/simulations", async (request, reply) => {
    const parsed = createSimulationScenarioSchema.safeParse(request.body);
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

    const scenario = await createScenario(userId, parsed.data);
    return reply.status(201).send(scenario);
  });

  app.patch("/api/simulations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateSimulationScenarioSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      });
    }

    try {
      return await updateScenario(request.user!.sub, id, parsed.data);
    } catch (err) {
      if (err instanceof ScenarioNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      throw err;
    }
  });

  app.delete("/api/simulations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteScenario(request.user!.sub, id);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof ScenarioNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post("/api/simulations/:id/complete", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = completeSimulationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      });
    }

    try {
      return await completeScenario(request.user!.sub, id, parsed.data);
    } catch (err) {
      if (err instanceof ScenarioNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      if (err instanceof ScenarioInvalidStateError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });
}
