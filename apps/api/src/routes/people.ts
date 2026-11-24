import type { FastifyInstance } from "fastify";
import { personSchema, parsePaydayCycleAnchor } from "@finance/shared";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";
import { serializeAccount } from "../services/serializeAccount.js";
import { loadCardBillSummaries, toAccountBillFields } from "../services/finance/derivedCardBills.js";
import type { CardBillSummary } from "@finance/shared";

type CardBillsByAccount = Map<string, CardBillSummary>;

/** Junta a fatura fechada e as compras depois do fechamento ao cartão (sem cartão, nada muda). */
function withCardBill<T extends { id: string }>(account: T, cardBills: CardBillsByAccount) {
  const bill = cardBills.get(account.id);
  return bill ? { ...account, ...toAccountBillFields(bill) } : account;
}

function serializePerson(
  person: {
    id: string;
    name: string;
    relationship: string | null;
    paydayDay: number | null;
    paydayCycleAnchor: string;
    createdAt: Date;
    connections: {
      id: string;
      pluggyItemId: string;
      connectorName: string | null;
      connectorImageUrl: string | null;
      status: string;
      lastSyncedAt: Date | null;
      pluggyUpdatedAt: Date | null;
      accounts: {
        id: string;
        name: string;
        type: string | null;
        subtype: string | null;
        number: string | null;
        balance: number;
        currencyCode: string;
        creditBrand: string | null;
        creditLevel: string | null;
        creditLimit: number | null;
        availableCreditLimit: number | null;
        minimumPayment: number | null;
        balanceCloseDate: Date | null;
        balanceDueDate: Date | null;
        billDueDay: number | null;
        billCloseDay: number | null;
      }[];
    }[];
  },
  cardBills: CardBillsByAccount = new Map(),
) {
  return {
    id: person.id,
    name: person.name,
    relationship: person.relationship,
    paydayDay: person.paydayDay,
    paydayCycleAnchor: parsePaydayCycleAnchor(person.paydayCycleAnchor),
    createdAt: person.createdAt.toISOString(),
    connections: person.connections.map((c) => ({
      id: c.id,
      pluggyItemId: c.pluggyItemId,
      connectorName: c.connectorName,
      connectorImageUrl: c.connectorImageUrl,
      status: c.status,
      lastSyncedAt: c.lastSyncedAt ? c.lastSyncedAt.toISOString() : null,
      pluggyUpdatedAt: c.pluggyUpdatedAt ? c.pluggyUpdatedAt.toISOString() : null,
      accounts: c.accounts.map((acc) => serializeAccount(withCardBill(acc, cardBills))),
    })),
  };
}

export async function peopleRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/people", async (request, reply) => {
    const people = await prisma.person.findMany({
      where: { userId: request.user!.sub },
      orderBy: { createdAt: "asc" },
      include: { connections: { include: { accounts: true } } },
    });
    const cardBills = await loadCardBillSummaries(
      people.flatMap((p) => p.connections.flatMap((c) => c.accounts.filter((a) => a.type === "CREDIT"))),
    );
    return reply.send(people.map((person) => serializePerson(person, cardBills)));
  });

  app.post("/api/people", async (request, reply) => {
    const parsed = personSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }
    const person = await prisma.person.create({
      data: {
        name: parsed.data.name,
        relationship: parsed.data.relationship ?? null,
        paydayDay: parsed.data.paydayDay ?? null,
        paydayCycleAnchor: parsed.data.paydayCycleAnchor ?? "end",
        userId: request.user!.sub,
      },
      include: { connections: { include: { accounts: true } } },
    });
    return reply.code(201).send(serializePerson(person));
  });

  app.put("/api/people/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = personSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }
    const existing = await prisma.person.findFirst({
      where: { id, userId: request.user!.sub },
    });
    if (!existing) return reply.code(404).send({ error: "Pessoa não encontrada" });

    const person = await prisma.person.update({
      where: { id },
      data: {
        name: parsed.data.name,
        relationship: parsed.data.relationship ?? null,
        ...(parsed.data.paydayDay !== undefined ? { paydayDay: parsed.data.paydayDay } : {}),
        ...(parsed.data.paydayCycleAnchor !== undefined
          ? { paydayCycleAnchor: parsed.data.paydayCycleAnchor }
          : {}),
      },
      include: { connections: { include: { accounts: true } } },
    });
    return reply.send(serializePerson(person));
  });

  app.delete("/api/people/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.person.findFirst({
      where: { id, userId: request.user!.sub },
    });
    if (!existing) return reply.code(404).send({ error: "Pessoa não encontrada" });
    await prisma.person.delete({ where: { id } });
    return reply.send({ ok: true });
  });
}
