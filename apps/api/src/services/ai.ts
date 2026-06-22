import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelV1 } from "ai";
import { getAiEnv } from "../env.js";
import { loadUserFinancialData } from "./finance/queries.js";

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

const currency = (value: number, code = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: code }).format(value);

/**
 * Monta um resumo financeiro do usuario (pessoas, contas, saldos e
 * transacoes recentes) para servir de contexto a IA.
 */
export async function buildFinancialContext(userId: string): Promise<string> {
  const { people } = await loadUserFinancialData(userId);

  if (people.length === 0) {
    return "O usuário ainda não cadastrou pessoas nem conectou contas bancárias.";
  }

  const lines: string[] = [];
  let total = 0;

  for (const person of people) {
    const accounts = person.connections.flatMap((c) => c.accounts);
    const personBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    total += personBalance;
    lines.push(
      `\n## Pessoa: ${person.name}${person.relationship ? ` (${person.relationship})` : ""}`,
    );
    lines.push(`Saldo total da pessoa: ${currency(personBalance)}`);

    if (accounts.length === 0) {
      lines.push("Sem contas conectadas.");
      continue;
    }

    for (const acc of accounts) {
      lines.push(
        `- Conta "${acc.name}" (${acc.type ?? "?"}): saldo ${currency(acc.balance, acc.currencyCode)}`,
      );
      const recent = acc.transactions.slice(0, 8);
      for (const tx of recent) {
        lines.push(
          `    ${tx.date.toISOString().slice(0, 10)} | ${currency(tx.amount, tx.currencyCode)} | ${tx.description}${tx.category ? ` [${tx.category}]` : ""}`,
        );
      }
    }
  }

  return [
    `Saldo consolidado de todas as pessoas: ${currency(total)}`,
    ...lines,
  ].join("\n");
}

export const SYSTEM_PROMPT = `Você é um assistente financeiro pessoal em português do Brasil.
Você ajuda o usuário e sua família a entender suas finanças, organizar gastos e fazer planejamentos.
Use SEMPRE os dados de contexto fornecidos (saldos, contas e transações) para basear suas respostas.
Seja claro, prático e objetivo. Quando fizer cálculos, mostre os números.
Se não houver dados suficientes no contexto, diga isso e oriente o usuário a conectar contas.
Nunca invente valores que não estejam no contexto.`;
