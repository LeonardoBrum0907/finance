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
  realizedUntilNow: "Realizado até hoje",
  closingThisCycle: "Fechamento deste ciclo",
  nextCycle: "Próximo ciclo",
  /** @deprecated use realizedUntilNow */
  untilNow: "Realizado até hoje",
  /** @deprecated use closingThisCycle */
  afterScheduled: "Fechamento deste ciclo",
  income: "Já entrou",
  spent: "Já gastei",
  dueInCycle: "A pagar neste ciclo",
  dueNextCycle: "A pagar no próximo ciclo",
  salary: "Salário",
  projectedSalary: "Salário previsto",
  expectedSalary: "Salário esperado",
  extraIncome: "Renda extra",
  salaryUnknown: "Salário desconhecido",
  heroTooltip:
    "Realizado até hoje: só entradas e saídas que já aconteceram. Fechamento deste ciclo: inclui salário previsto e contas com vencimento neste ciclo. Próximo ciclo: projeção com salário e contas conhecidas.",
  nextCycleTooltip:
    "Projeção do próximo ciclo com salário esperado (último recebido) e contas com vencimento definido.",
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

/** Referência de fechamento do ciclo atual (salário previsto + contas pendentes). */
export function cycleSurplusBaseline(cycle: {
  net: number;
  availableNet: number;
  realizedNet?: number;
  committedExpenses?: number;
  projectedSalaryIncome?: number;
}): { label: string; amount: number } {
  return { label: CYCLE_COPY.closingThisCycle, amount: cycle.availableNet };
}

export function formatCycleImpactLabel(cycleKey: string, index: number): string {
  if (index === 0) return `Este ciclo (${cycleKey})`;
  if (index === 1) return `Próximo ciclo (${cycleKey})`;
  return cycleKey;
}
