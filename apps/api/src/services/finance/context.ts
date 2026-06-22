import {
  formatCurrency,
  formatLocalDate,
  formatMonthLabel,
  getLastSyncInfo,
  getMonthlySummary,
  getSpendingByCategory,
  getTopExpenses,
  toLocalDateKey,
  toLocalMonthKey,
} from "./aggregates.js";
import {
  flattenConnections,
  flattenTransactions,
  loadUserFinancialData,
} from "./queries.js";

const RECENT_TXS_PER_ACCOUNT = 3;

/**
 * Monta um resumo financeiro enriquecido do usuário para servir de contexto à IA.
 */
export async function buildFinancialContext(userId: string): Promise<string> {
  const data = await loadUserFinancialData(userId);
  const { people } = data;

  if (people.length === 0) {
    return "O usuário ainda não cadastrou pessoas nem conectou contas bancárias.";
  }

  const allTransactions = flattenTransactions(data);
  const connections = flattenConnections(data);
  const currentMonth = toLocalMonthKey(new Date());
  const monthly = getMonthlySummary(allTransactions);
  const categories = getSpendingByCategory(allTransactions, {
    from: `${currentMonth}-01`,
    to: `${currentMonth}-31`,
  });
  const topExpenses = getTopExpenses(allTransactions, {
    from: `${currentMonth}-01`,
    to: `${currentMonth}-31`,
  });
  const syncInfo = getLastSyncInfo(connections);

  let total = 0;
  const lines: string[] = [];

  lines.push(`Saldo consolidado de todas as pessoas: ${formatCurrency(total)}`);

  if (syncInfo.length > 0) {
    lines.push("\n## Última sincronização");
    for (const sync of syncInfo) {
      const when = sync.lastSyncedAt
        ? formatLocalDate(new Date(sync.lastSyncedAt))
        : "nunca sincronizado";
      lines.push(`- ${sync.connectorName}: ${when}`);
    }
  }

  lines.push(`\n## Resumo do mês atual (${formatMonthLabel(currentMonth)})`);
  lines.push(
    `Receitas: ${formatCurrency(monthly.income)} | Despesas: ${formatCurrency(monthly.expenses)} | Saldo: ${formatCurrency(monthly.net)}`,
  );

  if (categories.length > 0) {
    lines.push("\n## Top categorias (mês atual)");
    for (const cat of categories.slice(0, 5)) {
      lines.push(
        `- ${cat.category}: ${formatCurrency(cat.total)} (${cat.count} transações)`,
      );
    }
  }

  if (topExpenses.length > 0) {
    lines.push("\n## Maiores despesas (mês atual)");
    for (const tx of topExpenses) {
      lines.push(
        `- ${formatLocalDate(tx.date)} | ${formatCurrency(tx.amount, tx.currencyCode)} | ${tx.description}${tx.category ? ` [${tx.category}]` : ""}`,
      );
    }
  }

  lines.push("\n## Pessoas e contas");

  for (const person of people) {
    const accounts = person.connections.flatMap((c) => c.accounts);
    const personBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    total += personBalance;
    lines.push(
      `\n### Pessoa: ${person.name}${person.relationship ? ` (${person.relationship})` : ""}`,
    );
    lines.push(`Saldo total da pessoa: ${formatCurrency(personBalance)}`);

    if (accounts.length === 0) {
      lines.push("Sem contas conectadas.");
      continue;
    }

    for (const acc of accounts) {
      lines.push(
        `- Conta "${acc.name}" (${acc.type ?? "?"}): saldo ${formatCurrency(acc.balance, acc.currencyCode)}`,
      );
      const recent = acc.transactions.slice(0, RECENT_TXS_PER_ACCOUNT);
      for (const tx of recent) {
        lines.push(
          `    ${toLocalDateKey(tx.date)} | ${formatCurrency(tx.amount, tx.currencyCode)} | ${tx.description}${tx.category ? ` [${tx.category}]` : ""}`,
        );
      }
    }
  }

  // Corrige saldo consolidado no topo
  lines[0] = `Saldo consolidado de todas as pessoas: ${formatCurrency(total)}`;

  return lines.join("\n");
}
