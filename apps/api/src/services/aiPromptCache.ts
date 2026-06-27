import { createHash } from "node:crypto";
import type { LanguageModelUsage } from "ai";
import type { AiProvider, ModelCandidate } from "./ai.js";

const STATIC_DYNAMIC_SEPARATOR = "\n\n---\n\n# Contexto dinâmico\n\n";

export type PromptCacheScope =
  | "chat"
  | "classifier"
  | "recap-household"
  | "recap-person"
  | "recap-single";

function parsePromptCacheEnabled(): boolean {
  const raw = process.env.AI_PROMPT_CACHE_ENABLED;
  if (raw === undefined || raw === "") return true;
  return !/^(0|false|no|off)$/i.test(raw.trim());
}

export function isPromptCacheEnabled(): boolean {
  return parsePromptCacheEnabled();
}

export function buildSystemPrompt(staticContent: string, dynamicContent: string): string {
  const staticBlock = staticContent.trim();
  const dynamicBlock = dynamicContent.trim();
  if (!dynamicBlock) return staticBlock;
  return `${staticBlock}${STATIC_DYNAMIC_SEPARATOR}${dynamicBlock}`;
}

export function getCacheKey(scope: PromptCacheScope, staticContent: string): string {
  const prefix = process.env.AI_PROMPT_CACHE_KEY_PREFIX?.trim() || "finance";
  const hash = createHash("sha256").update(staticContent).digest("hex").slice(0, 8);
  return `${prefix}-${scope}-v${hash}`;
}

export function openAiProviderOptions(cacheKey: string): {
  openai: { promptCacheKey: string };
} {
  return { openai: { promptCacheKey: cacheKey } };
}

export function aiCallProviderOptions(
  candidate: ModelCandidate | { provider: AiProvider },
  scope: PromptCacheScope,
  staticContent: string,
): { providerOptions?: { openai: { promptCacheKey: string } } } {
  if (candidate.provider !== "openai" || !isPromptCacheEnabled()) {
    return {};
  }
  return { providerOptions: openAiProviderOptions(getCacheKey(scope, staticContent)) };
}

export function extractCachedTokens(
  usage: LanguageModelUsage | undefined,
  providerMetadata?: Record<string, Record<string, unknown> | undefined>,
): number {
  const fromUsage = usage?.cachedInputTokens;
  if (typeof fromUsage === "number" && fromUsage > 0) return fromUsage;

  const openaiMeta = providerMetadata?.openai;
  const fromMeta = openaiMeta?.cachedPromptTokens;
  if (typeof fromMeta === "number" && fromMeta > 0) return fromMeta;

  return 0;
}

export function logPromptCacheStats(
  log: { debug: (obj: object, msg?: string) => void },
  scope: PromptCacheScope,
  cacheKey: string | undefined,
  inputTokens: number,
  cachedInputTokens: number,
): void {
  if (!isPromptCacheEnabled() || !cacheKey) return;
  log.debug(
    {
      scope,
      cacheKey,
      inputTokens,
      cachedInputTokens,
      cacheHitRate: inputTokens > 0 ? cachedInputTokens / inputTokens : 0,
    },
    "Prompt cache stats",
  );
}
