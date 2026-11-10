import type { FastifyInstance } from "fastify";
import {
  updateSettingsSchema,
  isPaydayDayConfigured,
  mergeDashboardWidgetPatch,
} from "@finance/shared";
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
    const {
      paydayDay,
      defaultPeriodMode,
      includeInvestmentsInNetWorth,
      theme,
      dashboardWidgets,
    } = parsed.data;

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { paydayDay: true, dashboardWidgets: true },
    });

    if (defaultPeriodMode === "payday") {
      const people = await prisma.person.findMany({
        where: { userId },
        select: { paydayDay: true },
      });
      const effectivePayday =
        paydayDay !== undefined ? paydayDay : currentUser?.paydayDay;
      const anyPersonPayday = people.some((p) => isPaydayDayConfigured(p.paydayDay));
      if (!isPaydayDayConfigured(effectivePayday) && !anyPersonPayday) {
        return reply.code(400).send({
          error: "Configure o dia de recebimento de pelo menos uma pessoa antes de usar o modo de ciclo",
        });
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(paydayDay !== undefined ? { paydayDay } : {}),
        ...(defaultPeriodMode !== undefined ? { defaultPeriodMode } : {}),
        ...(includeInvestmentsInNetWorth !== undefined
          ? { includeInvestmentsInNetWorth }
          : {}),
        ...(theme !== undefined ? { theme } : {}),
        ...(dashboardWidgets !== undefined
          ? {
              dashboardWidgets: mergeDashboardWidgetPatch(
                currentUser?.dashboardWidgets,
                dashboardWidgets,
              ),
            }
          : {}),
      },
    });

    const settings = await loadUserSettings(userId);
    return reply.send(settings);
  });
}
