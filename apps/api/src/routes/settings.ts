import type { FastifyInstance } from "fastify";
import { updateSettingsSchema } from "@finance/shared";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";
import { loadUserSettings } from "../services/userSettings.js";

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/settings", async (request, reply) => {
    const settings = await loadUserSettings(request.user!.sub);
    return reply.send(settings);
  });

  app.patch("/api/settings", async (request, reply) => {
    const parsed = updateSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }

    const userId = request.user!.sub;
    const { paydayDay, defaultPeriodMode } = parsed.data;

    if (defaultPeriodMode === "payday") {
      const current = await prisma.user.findUnique({
        where: { id: userId },
        select: { paydayDay: true },
      });
      const effectivePayday = paydayDay !== undefined ? paydayDay : current?.paydayDay;
      if (effectivePayday === null || effectivePayday === undefined) {
        return reply.code(400).send({
          error: "Configure o dia de recebimento antes de usar o modo de ciclo",
        });
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(paydayDay !== undefined ? { paydayDay } : {}),
        ...(defaultPeriodMode !== undefined ? { defaultPeriodMode } : {}),
      },
    });

    const settings = await loadUserSettings(userId);
    return reply.send(settings);
  });
}
