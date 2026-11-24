import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth.js";
import {
  BillMonthFormatError,
  markBillCyclePaid,
  unmarkBillCyclePaid,
} from "../services/finance/billPaidMarks.js";

type BillCycleParams = { cycleKey: string };
type PersonQuery = { personId?: string };

/** "Marcar fatura como paga": fecha o ciclo quando o app não reconhece o pagamento. */
export async function billCyclePaymentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.post("/api/bill-cycles/:cycleKey/paid", async (request, reply) => {
    const { cycleKey } = request.params as BillCycleParams;
    const personId = (request.query as PersonQuery).personId?.trim() || undefined;
    try {
      const marked = await markBillCyclePaid(request.user!.sub, cycleKey, personId);
      return reply.send({ marked });
    } catch (error) {
      if (error instanceof BillMonthFormatError) return reply.code(400).send({ error: error.message });
      throw error;
    }
  });

  app.delete("/api/bill-cycles/:cycleKey/paid", async (request, reply) => {
    const { cycleKey } = request.params as BillCycleParams;
    const personId = (request.query as PersonQuery).personId?.trim() || undefined;
    try {
      const removed = await unmarkBillCyclePaid(request.user!.sub, cycleKey, personId);
      return reply.send({ removed });
    } catch (error) {
      if (error instanceof BillMonthFormatError) return reply.code(400).send({ error: error.message });
      throw error;
    }
  });
}
