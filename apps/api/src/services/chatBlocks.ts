import type { ChatBlock } from "@finance/shared";

const TOOL_LABELS: Record<string, string> = {
  getTransactions: "Consultando transações",
  getSpendingByCategory: "Analisando gastos por categoria",
  getBalanceSummary: "Verificando saldos",
};

export function extractToolActivityFromSteps(
  steps: Array<{ toolCalls?: Array<{ toolName: string }> }>,
): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const step of steps) {
    for (const call of step.toolCalls ?? []) {
      const label = TOOL_LABELS[call.toolName] ?? `Usando ${call.toolName}`;
      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
  }
  return labels;
}

export function extractBlocksFromSteps(
  steps: Array<{ toolResults?: Array<{ toolName?: string; output?: unknown; result?: unknown }> }>,
): ChatBlock[] {
  const blocks: ChatBlock[] = [];

  for (const step of steps) {
    for (const toolResult of step.toolResults ?? []) {
      const output = toolResult.output ?? toolResult.result;
      if (!output || typeof output !== "object") continue;
      const record = output as Record<string, unknown>;

      if (Array.isArray(record.categories)) {
        const categories = record.categories as Array<{
          category: string;
          total: number;
          formattedTotal?: string;
          count?: number;
        }>;
        if (categories.length > 0) {
          const total = categories.reduce((s, c) => s + c.total, 0);
          blocks.push({
            type: "chart",
            chartKind: "category_bar",
            data: categories.slice(0, 8).map((c) => ({
              category: c.category,
              total: c.total,
              formattedTotal: c.formattedTotal ?? String(c.total),
              percent: total > 0 ? (c.total / total) * 100 : 0,
            })),
          });
          blocks.push({
            type: "table",
            headers: ["Categoria", "Total", "Transações"],
            rows: categories.slice(0, 10).map((c) => [
              c.category,
              c.formattedTotal ?? String(c.total),
              String(c.count ?? "—"),
            ]),
          });
        }
      }

      if (Array.isArray(record.transactions)) {
        const txs = record.transactions as Array<{
          date: string;
          description: string;
          formattedAmount?: string;
          category?: string;
        }>;
        if (txs.length > 0) {
          blocks.push({
            type: "table",
            headers: ["Data", "Descrição", "Valor", "Categoria"],
            rows: txs.slice(0, 10).map((tx) => [
              tx.date,
              tx.description.length > 40 ? `${tx.description.slice(0, 37)}…` : tx.description,
              tx.formattedAmount ?? "—",
              tx.category ?? "—",
            ]),
          });
        }
      }

      if (record.formattedTotalBalance != null) {
        blocks.push({
          type: "metric",
          label: "Saldo consolidado",
          value: String(record.formattedTotalBalance),
        });
      }
    }
  }

  return blocks.slice(0, 4);
}
