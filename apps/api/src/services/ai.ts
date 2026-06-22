import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelV1 } from "ai";
import { getAiEnv } from "../env.js";

export { buildFinancialContext } from "./finance/context.js";

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  google: "gemini-flash-latest",
};

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

export function getModel(): LanguageModelV1 {
  const ai = getAiEnv();
  const modelId = ai.model || DEFAULT_MODELS[ai.provider];
  switch (ai.provider) {
    case "openai":
      return createOpenAI({ apiKey: ai.openaiKey })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey: ai.anthropicKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey: ai.googleKey })(modelId);
    default:
      throw new Error(`Provider de IA desconhecido: ${ai.provider}`);
  }
}

export const SYSTEM_PROMPT = `Você é um assistente financeiro pessoal em português do Brasil.
Você ajuda o usuário e sua família a entender suas finanças, organizar gastos e fazer planejamentos.
Use SEMPRE os dados de contexto fornecidos (saldos, resumo mensal, categorias, contas e transações) para basear suas respostas.
O contexto inclui receitas, despesas e top categorias do mês atual — use esses números para perguntas sobre gastos recentes.
Se o usuário pedir extrato de período específico, comparação entre meses ou detalhes além do resumo, use as ferramentas disponíveis.
Seja claro, prático e objetivo. Quando fizer cálculos, mostre os números.
Se não houver dados suficientes no contexto, diga isso e oriente o usuário a conectar contas.
Nunca invente valores que não estejam no contexto ou retornados pelas ferramentas.`;
