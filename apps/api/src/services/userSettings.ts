import type { PaydayCycleAnchor, PeriodMode, UserSettingsDTO } from "@finance/shared";
import {
  DEFAULT_PAYDAY_CYCLE_ANCHOR,
  isPaydayDayConfigured,
  parseAppTheme,
  parsePaydayCycleAnchor,
  parsePeriodMode,
} from "@finance/shared";
import { prisma } from "../prisma.js";

export interface ResolvedPaydayCycle {
  paydayDay: number | null;
  paydayCycleAnchor: PaydayCycleAnchor;
}

export async function loadUserSettings(userId: string): Promise<UserSettingsDTO> {
  const [user, people] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        paydayDay: true,
        defaultPeriodMode: true,
        includeInvestmentsInNetWorth: true,
        theme: true,
      },
    }),
    prisma.person.findMany({
      where: { userId },
      select: { paydayDay: true },
    }),
  ]);

  const paydayDay = user.paydayDay;
  const defaultPeriodMode = parsePeriodMode(user.defaultPeriodMode);
  const paydayConfigured =
    isPaydayDayConfigured(paydayDay) ||
    people.some((p) => isPaydayDayConfigured(p.paydayDay));

  return {
    paydayDay,
    defaultPeriodMode,
    paydayConfigured,
    includeInvestmentsInNetWorth: user.includeInvestmentsInNetWorth,
    theme: parseAppTheme(user.theme),
  };
}

/**
 * Resolve dia e âncora do ciclo para cálculos.
 * Com personId: usa a configuração da pessoa.
 * Sem personId: só retorna ciclo se todas as pessoas têm o mesmo dia e mesma âncora.
 */
export async function resolvePaydayCycle(
  userId: string,
  personId?: string,
): Promise<ResolvedPaydayCycle> {
  if (personId) {
    const person = await prisma.person.findFirst({
      where: { id: personId, userId },
      select: { paydayDay: true, paydayCycleAnchor: true },
    });
    if (isPaydayDayConfigured(person?.paydayDay)) {
      return {
        paydayDay: person!.paydayDay,
        paydayCycleAnchor: parsePaydayCycleAnchor(person!.paydayCycleAnchor),
      };
    }
  } else {
    const people = await prisma.person.findMany({
      where: { userId },
      select: { paydayDay: true, paydayCycleAnchor: true },
    });
    const configured = people.filter((p) => isPaydayDayConfigured(p.paydayDay));
    if (configured.length > 0) {
      const uniqueDays = new Set(configured.map((p) => p.paydayDay));
      const uniqueAnchors = new Set(
        configured.map((p) => parsePaydayCycleAnchor(p.paydayCycleAnchor)),
      );
      if (uniqueDays.size === 1 && uniqueAnchors.size === 1) {
        return {
          paydayDay: configured[0]!.paydayDay!,
          paydayCycleAnchor: [...uniqueAnchors][0]!,
        };
      }
      return { paydayDay: null, paydayCycleAnchor: DEFAULT_PAYDAY_CYCLE_ANCHOR };
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { paydayDay: true },
  });
  return {
    paydayDay: isPaydayDayConfigured(user?.paydayDay) ? user!.paydayDay : null,
    paydayCycleAnchor: DEFAULT_PAYDAY_CYCLE_ANCHOR,
  };
}

/** @deprecated Use resolvePaydayCycle */
export async function resolvePaydayDay(
  userId: string,
  personId?: string,
): Promise<number | null> {
  const { paydayDay } = await resolvePaydayCycle(userId, personId);
  return paydayDay;
}

export function resolvePeriodMode(
  queryMode: unknown,
  settings: UserSettingsDTO,
  paydayDay: number | null = settings.paydayDay,
): PeriodMode {
  const requested = queryMode === "payday" || queryMode === "calendar" ? queryMode : null;
  const paydayConfigured = isPaydayDayConfigured(paydayDay);
  if (requested === "payday" && !paydayConfigured) {
    return "calendar";
  }
  if (requested === "payday") return "payday";
  if (requested === "calendar") return "calendar";
  if (settings.defaultPeriodMode === "payday" && paydayConfigured) {
    return "payday";
  }
  return settings.defaultPeriodMode === "payday" && !paydayConfigured
    ? "calendar"
    : settings.defaultPeriodMode;
}
