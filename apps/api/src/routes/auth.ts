import type { FastifyInstance } from "fastify";
import { loginSchema, registerSchema } from "@finance/shared";
import { prisma } from "../prisma.js";
import {
  authenticate,
  clearAuthCookie,
  hashPassword,
  setAuthCookie,
  signToken,
  verifyPassword,
} from "../auth.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }
    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "E-mail já cadastrado" });
    }

    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
    });

    const token = signToken({ sub: user.id, email: user.email, name: user.name });
    setAuthCookie(reply, token);
    return reply.code(201).send({ id: user.id, name: user.name, email: user.email });
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      return reply.code(401).send({ error: "Credenciais inválidas" });
    }

    const token = signToken({ sub: user.id, email: user.email, name: user.name });
    setAuthCookie(reply, token);
    return reply.send({ id: user.id, name: user.name, email: user.email });
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    clearAuthCookie(reply);
    return reply.send({ ok: true });
  });

  app.get("/api/auth/me", { preHandler: authenticate }, async (request, reply) => {
    const user = request.user!;
    return reply.send({ id: user.sub, name: user.name, email: user.email });
  });
}
