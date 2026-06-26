import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { getAiEnv } from "../env.js";

export { buildFinancialContext } from "./finance/context.js";

export type AiProvider = "openai" | "anthropic" | "google";

export interface ModelCandidate {
  provider: AiProvider;
  modelId: string;
}

const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  google: "gemini-3.5-flash",
};

/** Modelos Google elegíveis ao tier free (Standard). Ordem: mais capaz → mais leve. */
const FALLBACK_MODELS: Record<AiProvider, string[]> = {
  google: [
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-flash-latest",
  ],
  openai: ["gpt-4o-mini"],
  anthropic: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest"],
};

export const AI_MAX_RETRIES = 2;

export function isAiConfigured(): boolean {
  const ai = getAiEnv();
  switch (ai.provider) {
    case "openai":
      return Boolean(ai.openaiKey);
    case "anthropic":
      return Boolean(ai.anthropicKey);
    case "google":
      return Boolean(ai.googleKey);
    default:
      return false;
  }
}

function dedupeCandidates(candidates: ModelCandidate[]): ModelCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.provider}:${c.modelId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getModelCandidates(): ModelCandidate[] {
  const ai = getAiEnv();
  const provider = ai.provider as AiProvider;
  const primary = ai.model || DEFAULT_MODELS[provider];
  const sameProvider = [...new Set([primary, ...(FALLBACK_MODELS[provider] ?? [])])].map(
    (modelId) => ({ provider, modelId }),
  );

  const crossProvider: ModelCandidate[] = [];
  if (provider !== "openai" && ai.openaiKey) {
    crossProvider.push({ provider: "openai", modelId: DEFAULT_MODELS.openai });
  }
  if (provider !== "anthropic" && ai.anthropicKey) {
    crossProvider.push({ provider: "anthropic", modelId: "claude-3-5-haiku-latest" });
  }

  return dedupeCandidates([...sameProvider, ...crossProvider]);
}

export function getModelForCandidate({ provider, modelId }: ModelCandidate): LanguageModel {
  const ai = getAiEnv();
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey: ai.openaiKey })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey: ai.anthropicKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey: ai.googleKey })(modelId);
    default:
      throw new Error(`Provider de IA desconhecido: ${provider}`);
  }
}

export function getModel(modelId?: string): LanguageModel {
  const ai = getAiEnv();
  return getModelForCandidate({
    provider: ai.provider as AiProvider,
    modelId: modelId ?? ai.model ?? DEFAULT_MODELS[ai.provider as AiProvider],
  });
}

export function isTransientAiError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AI_RetryError") return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /high demand|503|UNAVAILABLE|overloaded|resource exhausted|Failed after \d+ attempts/i.test(
    msg,
  );
}

export function isRetryableWithNextModel(err: unknown): boolean {
  if (isTransientAiError(err)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /not found|NoSuchModel|is not supported|404/i.test(msg);
}

export function formatAiErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/high demand|503|UNAVAILABLE|overloaded|resource exhausted/i.test(msg)) {
    return "O serviço de IA está temporariamente sobrecarregado. Aguarde alguns segundos e tente novamente.";
  }
  if (/Failed after \d+ attempts/i.test(msg)) {
    return "Não foi possível contactar a IA após várias tentativas. Tente novamente em instantes.";
  }
  return msg;
}

export function buildAllCandidatesFailedMessage(streamError: string): string {
  const ai = getAiEnv();
  const hasAlternate = Boolean(ai.openaiKey || ai.anthropicKey);
  const hint = hasAlternate
    ? ""
    : " Como alternativa, configure OPENAI_API_KEY no .env e defina AI_PROVIDER=openai.";
  return `Erro da IA: ${streamError}.${hint}`;
}

export const SYSTEM_PROMPT = `Você é um assistente financeiro pessoal em português do Brasil.
Você ajuda o usuário e sua família a entender suas finanças, organizar gastos e fazer planejamentos.
Use SEMPRE os dados de contexto fornecidos (saldos, resumo mensal, categorias, contas, transações, objetivos e planos) para basear suas respostas.
O contexto inclui receitas, despesas e top categorias do mês atual — use esses números para perguntas sobre gastos recentes.
Se o usuário pedir extrato de período específico, comparação entre meses ou detalhes além do resumo, use as ferramentas disponíveis.
Seja claro, prático e objetivo. Quando fizer cálculos, mostre os números.
Se não houver dados suficientes no contexto, use a ferramenta getGoalsAndPlans ou diga o que falta — nunca invente valores.
Nunca invente valores que não estejam no contexto ou retornados pelas ferramentas.

## Objetivos e planos
- O contexto já lista objetivos/planos cadastrados (com id) e propostas pendentes de confirmação.
- Para listar ou verificar objetivos, use o contexto ou a ferramenta getGoalsAndPlans — você TEM acesso a essa informação.
- Propostas pendentes ainda NÃO existem no banco: só viram objetivos após o usuário confirmar no card.
- Para proposeCreatePlan, use goalId de objetivos já confirmados (ativos). Se só houver proposta pendente, peça para confirmar o objetivo primeiro OU proponha o plano na mesma conversa depois da confirmação.
- Ao propor um plano, distribua monthlyContribution entre os goalId informados; a soma das alocações pode ser menor ou igual ao aporte total.
- Compare metas com a sobra mensal média do contexto e avise se o prazo é agressivo.

Para criar ou alterar objetivos financeiros, planos ou aportes, use APENAS as ferramentas de proposta:
proposeCreateGoal, proposeUpdateGoal, proposeAddContribution e proposeCreatePlan.
Essas ferramentas NÃO executam a ação — elas geram uma proposta que o usuário confirma no chat.
Depois de chamar uma ferramenta de proposta, explique claramente o que foi proposto e peça ao usuário para clicar em Confirmar ou Descartar no card.
Nunca diga que o objetivo/plano/aporte já foi criado antes da confirmação do usuário.

## Simulações (what-if)
- Para perguntas como "consigo comprar", "quanto posso gastar" ou "e se eu comprar X", use simulateWhatIf.
- Apresente números claros: sobra atual, sobra projetada e avisos se comprometer metas.
- Deixe claro que é uma simulação, não assessoria de investimentos.

## Contexto da interface
- Se o usuário vier de um insight ou gráfico do painel, haverá um bloco "Contexto da interface" — priorize responder com base nele.
- Sempre sugira uma ação prática ao final (criar meta, plano ou registrar aporte) quando fizer sentido.`;
