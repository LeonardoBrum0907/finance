import type { ChatAiQuotaDTO } from "@finance/shared";
import { prisma } from "../prisma.js";
import { env, getAiEnv } from "../env.js";

export class AiQuotaExceededError extends Error {
  readonly quota: ChatAiQuotaDTO;

  constructor(quota: ChatAiQuotaDTO) {
    super("Limite mensal de IA atingido.");
    this.name = "AiQuotaExceededError";
    this.quota = quota;
  }
}

export class AiStreamBusyError extends Error {
  constructor() {
    super("Aguarde a resposta anterior terminar antes de enviar outra mensagem.");
    this.name = "AiStreamBusyError";
  }
}

export class RegenerateCooldownError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super("Aguarde alguns segundos antes de regenerar a resposta.");
    this.name = "RegenerateCooldownError";
    this.retryAfterMs = retryAfterMs;
  }
}

const activeStreams = new Set<string>();

function currentPeriodKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function nextPeriodStart(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
}

function getMonthlyLimit(): number {
  const limit = getAiEnv().monthlyTokenBudget;
  return Number.isFinite(limit) && limit > 0 ? limit : env.ai.monthlyTokenBudget;
}

async function ensureUsagePeriod(userId: string): Promise<{ used: number; periodKey: string }> {
  const periodKey = currentPeriodKey();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiTokensUsedThisMonth: true, aiUsagePeriod: true },
  });
  if (!user) {
    throw new Error("Usuário não encontrado");
  }

  if (user.aiUsagePeriod !== periodKey) {
    await prisma.user.update({
      where: { id: userId },
      data: { aiTokensUsedThisMonth: 0, aiUsagePeriod: periodKey },
    });
    return { used: 0, periodKey };
  }

  return { used: user.aiTokensUsedThisMonth, periodKey };
}

export async function getAiQuota(userId: string): Promise<ChatAiQuotaDTO> {
  const limit = getMonthlyLimit();
  const { used, periodKey } = await ensureUsagePeriod(userId);
  const remaining = Math.max(0, limit - used);

  return {
    used,
    limit,
    remaining,
    periodKey,
    resetsAt: nextPeriodStart().toISOString(),
  };
}

export async function assertAiQuota(userId: string): Promise<ChatAiQuotaDTO> {
  const quota = await getAiQuota(userId);
  if (quota.remaining <= 0) {
    throw new AiQuotaExceededError(quota);
  }
  return quota;
}

export interface RecordAiUsageInput {
  inputTokens: number;
  outputTokens: number;
  provider: string;
  modelId: string;
}

export async function recordAiUsage(
  userId: string,
  { inputTokens, outputTokens }: RecordAiUsageInput,
): Promise<void> {
  const total = Math.max(0, inputTokens) + Math.max(0, outputTokens);
  if (total <= 0) return;

  await ensureUsagePeriod(userId);
  const periodKey = currentPeriodKey();

  await prisma.user.update({
    where: { id: userId },
    data: {
      aiUsagePeriod: periodKey,
      aiTokensUsedThisMonth: {
        increment: total,
      },
    },
  });
}

export function tryAcquireStreamLock(userId: string): boolean {
  if (activeStreams.has(userId)) return false;
  activeStreams.add(userId);
  return true;
}

export function releaseStreamLock(userId: string): void {
  activeStreams.delete(userId);
}

export async function assertRegenerateCooldown(userId: string, threadId: string): Promise<void> {
  const cooldownMs = getAiEnv().regenerateCooldownMs;
  if (!Number.isFinite(cooldownMs) || cooldownMs <= 0) return;

  const last = await prisma.chatMessage.findFirst({
    where: { userId, threadId, role: "assistant" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!last) return;

  const elapsed = Date.now() - last.createdAt.getTime();
  if (elapsed < cooldownMs) {
    throw new RegenerateCooldownError(cooldownMs - elapsed);
  }
}

export function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const onAbort = () => controller.abort();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }

  return controller.signal;
}
