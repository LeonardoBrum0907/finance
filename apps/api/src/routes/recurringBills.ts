import type { FastifyInstance } from "fastify";
import { updateRecurringBillSchema } from "@finance/shared";
import { authenticate } from "../auth.js";
import {
  dismissRecurringBill,
  listRecurringBills,
  RecurringBillNotFoundError,
  runRecurringBillPipeline,
  updateRecurringBill,
} from "../services/finance/recurringBills.js";

export async function recurringBillRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  /** @deprecated Prefer GET /api/accounts?kind=fixed_recurring */
  app.get("/api/recurring-bills", async (request, reply) => {
    const query = request.query as { personId?: string; status?: string };
    const personId = query.personId?.trim() || undefined;
    const status = query.status?.trim() || "active,inactive";

    const items = await listRecurringBills(request.user!.sub, { personId, status });
    return reply.send({ items });
  });

  app.post("/api/recurring-bills/detect", async (request, reply) => {
    const query = request.query as { personId?: string };
    const personId = query.personId?.trim() || undefined;
    const result = await runRecurringBillPipeline(request.user!.sub, personId);
    return reply.send(result);
  });

  app.patch("/api/recurring-bills/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateRecurringBillSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      });
    }

    try {
      const bill = await updateRecurringBill(request.user!.sub, id, parsed.data);
      return reply.send(bill);
    } catch (err) {
      if (err instanceof RecurringBillNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      throw err;
    }
  });

  app.delete("/api/recurring-bills/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await dismissRecurringBill(request.user!.sub, id);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof RecurringBillNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      throw err;
    }
  });
}
