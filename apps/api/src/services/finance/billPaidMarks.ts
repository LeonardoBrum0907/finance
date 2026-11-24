import { dateKeyToNoonUtc, todayDateKeyInTimeZone } from "@finance/shared";
import { prisma } from "../../prisma.js";
import { buildBillCyclesForUser } from "./billCycles.js";

const BILL_MONTH = /^\d{4}-\d{2}$/;

export class BillMonthFormatError extends Error {
  constructor(received: string) {
    super(`Mês da fatura inválido: "${received}". Use AAAA-MM, por exemplo 2026-11.`);
  }
}

/**
 * Marca como pagas hoje as faturas do mês que o app ainda não viu pagas (pagamento
 * parcial, feito por outro banco ou que a Pluggy ainda não trouxe). Devolve quantas
 * faturas marcou.
 *
 * @example await markBillCyclePaid(userId, "2026-11") // 1
 */
export async function markBillCyclePaid(
  userId: string,
  billMonth: string,
  personId?: string,
): Promise<number> {
  if (!BILL_MONTH.test(billMonth)) throw new BillMonthFormatError(billMonth);
  const result = await buildBillCyclesForUser(userId, personId);
  const cycle = result?.cycles.find((c) => c.cycleKey === billMonth);
  if (!cycle) return 0;
  const unpaid = cycle.bills.filter((bill) => !bill.paidOn || bill.paidSource === "assumed");
  const paidOn = dateKeyToNoonUtc(todayDateKeyInTimeZone());
  for (const bill of unpaid) {
    await prisma.cardBillPaidMark.upsert({
      where: { accountId_billMonth: { accountId: bill.accountId, billMonth } },
      create: { accountId: bill.accountId, billMonth, paidOn },
      update: { paidOn },
    });
  }
  return unpaid.length;
}

/**
 * Desfaz a marcação manual das faturas do mês nos cartões da pessoa (ou do usuário).
 *
 * @example await unmarkBillCyclePaid(userId, "2026-11") // 1
 */
export async function unmarkBillCyclePaid(
  userId: string,
  billMonth: string,
  personId?: string,
): Promise<number> {
  if (!BILL_MONTH.test(billMonth)) throw new BillMonthFormatError(billMonth);
  const deleted = await prisma.cardBillPaidMark.deleteMany({
    where: {
      billMonth,
      account: { connection: { person: { userId, ...(personId ? { id: personId } : {}) } } },
    },
  });
  return deleted.count;
}
