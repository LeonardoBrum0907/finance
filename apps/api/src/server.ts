import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { peopleRoutes } from "./routes/people.js";
import { connectionRoutes } from "./routes/connections.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { transactionRoutes } from "./routes/transactions.js";
import { chatRoutes } from "./routes/chat.js";

async function main() {
  const app = Fastify({
    logger: {
      transport:
        env.nodeEnv === "development"
          ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss" } }
          : undefined,
    },
  });

  await app.register(cors, {
    origin: env.webOrigin,
    credentials: true,
  });
  await app.register(cookie);

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes);
  await app.register(peopleRoutes);
  await app.register(connectionRoutes);
  await app.register(dashboardRoutes);
  await app.register(transactionRoutes);
  await app.register(chatRoutes);

  await app.listen({ port: env.port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
