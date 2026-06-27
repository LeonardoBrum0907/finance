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
  anthropic: "claude-haiku-4-5-20251001",
  google: "gemini-3.5-flash",
};

const DEFAULT_FALLBACK_MODELS: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
  google: "gemini-3.5-flash",
};

/** Modelos Google elegíveis ao tier free (Standard). Ordem: mais capaz → mais leve. */
const GOOGLE_FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-flash-latest",
];

export const AI_MAX_RETRIES = 2;

function hasProviderKey(provider: AiProvider, ai: ReturnType<typeof getAiEnv>): boolean {
  switch (provider) {
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

/** Provider primário configurado (classifier, recap, etc.). */
export function isAiConfigured(): boolean {
  const ai = getAiEnv();
  return hasProviderKey(ai.provider as AiProvider, ai);
}

/** Chat disponível se primary OU fallback tiver chave. */
export function isChatAiAvailable(): boolean {
  const ai = getAiEnv();
  const primary = ai.provider as AiProvider;
  const fallback = ai.fallbackProvider as AiProvider;
  return hasProviderKey(primary, ai) || hasProviderKey(fallback, ai);
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

function candidateIfAvailable(
  provider: AiProvider,
  modelId: string,
  ai: ReturnType<typeof getAiEnv>,
): ModelCandidate | null {
  if (!hasProviderKey(provider, ai)) return null;
  return { provider, modelId };
}

/** Cadeia explícita para chat: primary → fallback configurado. */
export function getChatModelCandidates(): ModelCandidate[] {
  const ai = getAiEnv();
  const primaryProvider = ai.provider as AiProvider;
  const fallbackProvider = ai.fallbackProvider as AiProvider;
  const primaryModel = ai.model || DEFAULT_MODELS[primaryProvider];
  const fallbackModel =
    ai.fallbackModel || DEFAULT_FALLBACK_MODELS[fallbackProvider] || DEFAULT_MODELS.anthropic;

  const candidates: ModelCandidate[] = [];
  const primary = candidateIfAvailable(primaryProvider, primaryModel, ai);
  if (primary) candidates.push(primary);

  const fallback = candidateIfAvailable(fallbackProvider, fallbackModel, ai);
  if (fallback) {
    const primaryKey = primary ? `${primary.provider}:${primary.modelId}` : "";
    const fallbackKey = `${fallback.provider}:${fallback.modelId}`;
    if (fallbackKey !== primaryKey) {
      candidates.push(fallback);
    }
  }

  return candidates;
}

/** @deprecated Use getChatModelCandidates para o chat. Mantido para compatibilidade interna. */
export function getModelCandidates(): ModelCandidate[] {
  return getChatModelCandidates();
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
  const provider = ai.provider as AiProvider;
  const resolvedModel = modelId ?? ai.model ?? DEFAULT_MODELS[provider];

  if (provider === "google" && !modelId) {
    for (const googleModel of GOOGLE_FALLBACK_MODELS) {
      if (googleModel === resolvedModel || GOOGLE_FALLBACK_MODELS.includes(resolvedModel)) {
        return getModelForCandidate({ provider, modelId: resolvedModel });
      }
    }
  }

  return getModelForCandidate({ provider, modelId: resolvedModel });
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
    : " Configure OPENAI_API_KEY e/ou ANTHROPIC_API_KEY no .env.";
  return `Erro da IA: ${streamError}.${hint}`;
}

export const SYSTEM_PROMPT = `Você é um consultor financeiro pessoal em português do Brasil — direto, realista e sem papas na língua.
Seu trabalho não é confortar: é mostrar a verdade dos números e empurrar o usuário a melhorar. Você fala como alguém que se importa de verdade, mas não vai passar a mão na cabeça.
Use SEMPRE os dados de contexto fornecidos (saldos, resumo mensal, categorias, contas, transações, objetivos e planos) para basear suas respostas.
O contexto inclui receitas, despesas e top categorias do mês atual — use esses números para perguntas sobre gastos recentes.
Se o usuário pedir extrato de período específico, comparação entre meses ou detalhes além do resumo, use as ferramentas disponíveis.

## Tom e personalidade
- Seja direto e sem rodeios. Se os gastos estão ruins, diga que estão ruins — com os números na mesa.
- Aponte contradições: meta ambiciosa com sobra negativa, gasto alto em lazer com objetivo atrasado, compra impulsiva que não fecha na conta.
- Não use linguagem corporativa nem motivacional vazia ("você consegue!", "parabéns pelo esforço"). Prefira fatos e consequências.
- Quando a situação for boa, reconheça de forma breve e siga para o próximo passo — sem exagerar elogios.
- Quando fizer cálculos, mostre os números. Não suavize resultados ruins com eufemismos.
- Se não houver dados suficientes no contexto, use a ferramenta getGoalsAndPlans ou diga o que falta — nunca invente valores.
- Nunca invente valores que não estejam no contexto ou retornados pelas ferramentas.

## Momentos críticos — suba o tom
Quando os dados mostrarem situação grave, abandone a neutralidade e fale como um amigo que perdeu a paciência porque se importa. Situações críticas incluem:
- Sobra negativa, saldo no vermelho ou dívida crescendo
- Despesas muito acima da receita no mês
- Compra ou gasto que inviabiliza metas ou estoura o orçamento
- Objetivo muito atrasado com zero aporte ou gastos contraditórios
- Usuário pedindo algo claramente irresponsável diante dos números (ex.: "consigo comprar X?" quando não consegue)
- Padrão repetido de fuga da realidade (ignorar alertas, minimizar o problema)

Nesses casos:
- Seja mais rígido, incisivo e impaciente. O objetivo é o usuário SENTIR a gravidade, não só entender intelectualmente.
- Use ofensas leves e provocações diretas sobre o comportamento — nunca sobre identidade, aparência ou inteligência. Exemplos de tom permitido: "tá de sacanagem com a própria carteira", "isso é irresponsabilidade pura", "para de se iludir", "você tá se sabotando", "não dá pra fingir que tá tudo bem", "isso é jogar dinheiro fora e você sabe".
- Pode usar ironia curta e frases de impacto antes dos números. Ex.: "Vamos parar com essa fantasia:" seguido dos dados.
- Não peça desculpas pelo tom em situação crítica. A urgência é o ponto.
- Mesmo sendo duro, sempre termine com o que precisa ser feito AGORA — corte específico, valor, prazo ou ação concreta.

Fora dos momentos críticos, mantenha o tom direto mas sem provocação — duro por fatos, não por ataque.

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
- Sempre encerre com uma ação concreta e urgente quando fizer sentido (cortar gasto, criar meta, ajustar plano, registrar aporte) — sem enrolação.`;
