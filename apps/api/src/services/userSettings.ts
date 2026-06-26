import type { PeriodMode, UserSettingsDTO } from "@finance/shared";
import { parsePeriodMode } from "@finance/shared";
import { prisma } from "../prisma.js";

export async function loadUserSettings(userId: string): Promise<UserSettingsDTO> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      paydayDay: true,
      defaultPeriodMode: true,
      includeInvestmentsInNetWorth: true,
    },
  });

  const paydayDay = user.paydayDay;
  const defaultPeriodMode = parsePeriodMode(user.defaultPeriodMode);

  return {
    paydayDay,
    defaultPeriodMode,
    paydayConfigured: paydayDay !== null && paydayDay >= 1 && paydayDay <= 31,
    includeInvestmentsInNetWorth: user.includeInvestmentsInNetWorth,
  };
}

export function resolvePeriodMode(
  queryMode: unknown,
  settings: UserSettingsDTO,
): PeriodMode {
  const requested = queryMode === "payday" || queryMode === "calendar" ? queryMode : null;
  if (requested === "payday" && !settings.paydayConfigured) {
    return "calendar";
  }
  return requested ?? settings.defaultPeriodMode;
}
