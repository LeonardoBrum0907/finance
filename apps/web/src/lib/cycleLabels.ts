import { formatCurrency } from "./format";

export type CycleBalanceTone = "positive" | "negative" | "neutral";

export interface CycleBalanceDisplay {
  status: "Sobra" | "Faltando" | "Equilibrado";
  tone: CycleBalanceTone;
  /** Valor absoluto formatado, sem prefixo +/− ambíguo. */
  formattedAmount: string;
  amount: number;
}

export const CYCLE_COPY = {
  untilNow: "Até agora",
  afterScheduled: "Depois dos agendamentos",
  income: "Já entrou",
  spent: "Já gastei",
  dueInCycle: "A pagar neste ciclo",
  salary: "Salário",
  extraIncome: "Renda extra",
  heroTooltip:
    "Até agora: entradas realizadas menos o que já saiu. Depois dos agendamentos: desconta contas e parcelas com data futura já registradas.",
} as const;

export function formatCycleBalance(
  balance: number,
  currencyCode = "BRL",
): CycleBalanceDisplay {
  const amount = Math.abs(balance);
  const formattedAmount = formatCurrency(amount, currencyCode);

  if (balance > 0) {
    return { status: "Sobra", tone: "positive", formattedAmount, amount };
  }
  if (balance < 0) {
    return { status: "Faltando", tone: "negative", formattedAmount, amount };
  }
  return { status: "Equilibrado", tone: "neutral", formattedAmount, amount };
}

export function formatPlainAmount(value: number, currencyCode = "BRL"): string {
  return formatCurrency(value, currencyCode);
}

export function toneTextClass(tone: CycleBalanceTone): string {
  if (tone === "positive") return "text-positive";
  if (tone === "negative") return "text-negative";
  return "text-foreground";
}

export function toneBorderClass(tone: CycleBalanceTone): string {
  if (tone === "positive") return "border-positive/20 bg-positive/5";
  if (tone === "negative") return "border-negative/20 bg-negative/5";
  return "border-app-border/60 bg-app-bg/80";
}

/** Mesma referência de “sobra” usada no hero principal do card de ciclo. */
export function cycleSurplusBaseline(cycle: {
  net: number;
  availableNet: number;
  committedExpenses?: number;
}): { label: string; amount: number } {
  if ((cycle.committedExpenses ?? 0) > 0) {
    return { label: CYCLE_COPY.afterScheduled, amount: cycle.availableNet };
  }
  return { label: CYCLE_COPY.untilNow, amount: cycle.net };
}
