import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { peopleRoutes } from "./routes/people.js";
import { connectionRoutes } from "./routes/connections.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { transactionRoutes } from "./routes/transactions.js";
import { commitmentRoutes } from "./routes/commitments.js";
import { chatRoutes } from "./routes/chat.js";
import { budgetRoutes } from "./routes/budgets.js";
import { goalRoutes } from "./routes/goals.js";
import { investmentRoutes } from "./routes/investments.js";
import { settingsRoutes } from "./routes/settings.js";
import { simulatorRoutes } from "./routes/simulator.js";
import { simulationsRoutes } from "./routes/simulations.js";
import { recurringBillRoutes } from "./routes/recurringBills.js";
import { managedAccountRoutes } from "./routes/managedAccounts.js";

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
  await app.register(commitmentRoutes);
  await app.register(chatRoutes);
  await app.register(budgetRoutes);
  await app.register(goalRoutes);
  await app.register(investmentRoutes);
  await app.register(settingsRoutes);
  await app.register(simulatorRoutes);
  await app.register(simulationsRoutes);
  await app.register(recurringBillRoutes);
  await app.register(managedAccountRoutes);

  await app.listen({ port: env.port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
