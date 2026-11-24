import {
  previousIntervalKey,
  resolveBillInterval,
  resolveMonthInterval,
  type CardPaymentCalendar,
  type IntervalRef,
  type ResolvedInterval,
} from "@finance/shared";
import { buildBillCyclesForUser } from "./billCycles.js";

/** O intervalo escolhido, o anterior (para comparar) e o que é preciso para escolher as transações. */
export interface IntervalContext {
  current: ResolvedInterval;
  previous: ResolvedInterval | null;
  /** Calendário dos cartões: em que fatura cai cada compra (só o ciclo da fatura usa). */
  cards: CardPaymentCalendar[];
  /** Salário do intervalo que ainda não caiu na conta. */
  projectedSalary: number;
}

async function resolveBillContext(
  userId: string,
  personId: string | undefined,
  key: string,
): Promise<IntervalContext | null> {
  const result = await buildBillCyclesForUser(userId, personId);
  const current = result ? resolveBillInterval(result.cycles, key) : null;
  if (!result || !current) return null;
  const cycle = result.cycles.find((c) => c.cycleKey === key);
  return {
    current,
    previous: resolveBillInterval(result.cycles, previousIntervalKey(key)),
    cards: result.cards,
    projectedSalary: cycle?.money?.salary ?? 0,
  };
}

/**
 * Resolve o intervalo pedido por qualquer rota (painel, lista, categorias). Todas
 * passam por aqui para usar o mesmo início, fim e anterior. null quando o ciclo da
 * fatura não existe (sem cartão ou mês fora dos ciclos montados).
 *
 * @example await resolveIntervalForUser(userId, undefined, { kind: "bill", key: "2026-11" })
 */
export async function resolveIntervalForUser(
  userId: string,
  personId: string | undefined,
  ref: IntervalRef,
): Promise<IntervalContext | null> {
  if (ref.kind === "bill") return resolveBillContext(userId, personId, ref.key);
  return {
    current: resolveMonthInterval(ref.key),
    previous: resolveMonthInterval(previousIntervalKey(ref.key)),
    cards: [],
    projectedSalary: 0,
  };
}
