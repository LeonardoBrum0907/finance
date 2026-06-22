import type { FastifyInstance } from "fastify";
import { personSchema } from "@finance/shared";
import { prisma } from "../prisma.js";
import { authenticate } from "../auth.js";

function serializePerson(person: {
  id: string;
  name: string;
  relationship: string | null;
  createdAt: Date;
  connections: {
    id: string;
    pluggyItemId: string;
    connectorName: string | null;
    connectorImageUrl: string | null;
    status: string;
    lastSyncedAt: Date | null;
    accounts: {
      id: string;
      name: string;
      type: string | null;
      subtype: string | null;
      number: string | null;
      balance: number;
      currencyCode: string;
    }[];
  }[];
}) {
  return {
    id: person.id,
    name: person.name,
    relationship: person.relationship,
    createdAt: person.createdAt.toISOString(),
    connections: person.connections.map((c) => ({
      id: c.id,
      pluggyItemId: c.pluggyItemId,
      connectorName: c.connectorName,
      connectorImageUrl: c.connectorImageUrl,
      status: c.status,
      lastSyncedAt: c.lastSyncedAt ? c.lastSyncedAt.toISOString() : null,
      accounts: c.accounts,
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
    return reply.send(people.map(serializePerson));
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
