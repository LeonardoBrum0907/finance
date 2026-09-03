import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Garante que o .env da API seja carregado mesmo quando o processo
// é iniciado a partir da raiz do monorepo (pnpm dev).
// Em desenvolvimento, override=true para que apps/api/.env (preenchido pelo
// sync das secrets do Cloud) prevaleça sobre um DATABASE_URL=localhost residual
// no ambiente do processo.
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(apiRoot, ".env");
const isProd = (process.env.NODE_ENV ?? "development") === "production";
config({ path: envPath, override: !isProd });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  port: Number(process.env.PORT ?? 3333),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  nodeEnv: process.env.NODE_ENV ?? "development",
  pluggy: {
    clientId: process.env.PLUGGY_CLIENT_ID ?? "",
    clientSecret: process.env.PLUGGY_CLIENT_SECRET ?? "",
  },
  ai: {
    provider: (process.env.AI_PROVIDER ?? "openai").toLowerCase(),
    model: process.env.AI_MODEL ?? "",
    fallbackProvider: (process.env.AI_FALLBACK_PROVIDER ?? "anthropic").toLowerCase(),
    fallbackModel: process.env.AI_FALLBACK_MODEL ?? "",
    openaiKey: process.env.OPENAI_API_KEY ?? "",
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
    googleKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
    monthlyTokenBudget: Number(process.env.AI_MONTHLY_TOKEN_BUDGET ?? 300_000),
    maxSteps: Number(process.env.AI_MAX_STEPS ?? 6),
    maxToolCalls: Number(process.env.AI_MAX_TOOL_CALLS ?? 6),
    requestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 90_000),
    regenerateCooldownMs: Number(process.env.AI_REGENERATE_COOLDOWN_MS ?? 5_000),
  },
};

export const isPluggyConfigured = () =>
  Boolean(env.pluggy.clientId && env.pluggy.clientSecret);

/** Re-lê variáveis de IA do .env (útil em dev após editar o arquivo sem reiniciar). */
export function getAiEnv() {
  if ((process.env.NODE_ENV ?? "development") !== "production") {
    config({ path: envPath, override: true });
  }
  return {
    provider: (process.env.AI_PROVIDER ?? "openai").toLowerCase(),
    model: process.env.AI_MODEL ?? "",
    fallbackProvider: (process.env.AI_FALLBACK_PROVIDER ?? "anthropic").toLowerCase(),
    fallbackModel: process.env.AI_FALLBACK_MODEL ?? "",
    openaiKey: process.env.OPENAI_API_KEY ?? "",
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
    googleKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
    monthlyTokenBudget: Number(process.env.AI_MONTHLY_TOKEN_BUDGET ?? 300_000),
    maxSteps: Number(process.env.AI_MAX_STEPS ?? 6),
    maxToolCalls: Number(process.env.AI_MAX_TOOL_CALLS ?? 6),
    requestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 90_000),
    regenerateCooldownMs: Number(process.env.AI_REGENERATE_COOLDOWN_MS ?? 5_000),
  };
}
