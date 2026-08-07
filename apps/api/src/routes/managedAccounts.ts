import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth.js";
import { listManagedAccounts } from "../services/finance/managedAccounts.js";

export async function managedAccountRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/accounts", async (request, reply) => {
    const query = request.query as { personId?: string; status?: string; kind?: string };
    const personId = query.personId?.trim() || undefined;
    const status = query.status?.trim() || undefined;
    const kind = query.kind?.trim() || undefined;

    const items = await listManagedAccounts(request.user!.sub, { personId, status, kind });
    return reply.send({ items });
  });
}
