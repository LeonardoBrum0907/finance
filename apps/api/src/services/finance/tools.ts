import { tool } from "ai";
import { z } from "zod";
import {
  filterByDateRange,
  formatCurrency,
  getSpendingByCategory as aggregateByCategory,
  toLocalDateKey,
} from "./aggregates.js";
import { flattenTransactions, loadUserFinancialData } from "./queries.js";

const MAX_TRANSACTIONS = 50;
const TOOL_TRANSACTIONS_PER_ACCOUNT = 500;

export function createFinanceTools(userId: string, personId?: string) {
  async function loadScopedData() {
    return loadUserFinancialData(userId, {
      personId,
      transactionsPerAccount: TOOL_TRANSACTIONS_PER_ACCOUNT,
    });
  }

  return {
    getTransactions: tool({
      description:
        "Lista transações do usuário com filtros opcionais de período, categoria e limite. Valores negativos são despesas; positivos são receitas.",
      parameters: z.object({
        from: z
          .string()
          .optional()
          .describe("Data inicial inclusive no formato YYYY-MM-DD"),
        to: z
          .string()
          .optional()
          .describe("Data final inclusive no formato YYYY-MM-DD"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_TRANSACTIONS)
          .optional()
          .describe(`Número máximo de transações (até ${MAX_TRANSACTIONS})`),
        category: z
          .string()
          .optional()
          .describe("Filtrar por categoria (correspondência parcial, case-insensitive)"),
      }),
      execute: async ({ from, to, limit = 20, category }) => {
        const data = await loadScopedData();
        let txs = flattenTransactions(data);
        txs = filterByDateRange(txs, { from, to });

        if (category) {
          const needle = category.toLowerCase();
          txs = txs.filter((tx) =>
            (tx.category ?? "Sem categoria").toLowerCase().includes(needle),
          );
        }

        const capped = txs.slice(0, Math.min(limit, MAX_TRANSACTIONS));

        return {
          count: capped.length,
          transactions: capped.map((tx) => ({
            date: toLocalDateKey(tx.date),
            description: tx.description,
            amount: tx.amount,
            formattedAmount: formatCurrency(tx.amount, tx.currencyCode),
            category: tx.category ?? "Sem categoria",
            accountName: tx.accountName,
            personName: tx.personName,
          })),
        };
      },
    }),

    getSpendingByCategory: tool({
      description:
        "Retorna gastos agregados por categoria em um período. Considera apenas despesas (valores negativos).",
      parameters: z.object({
        from: z
          .string()
          .optional()
          .describe("Data inicial inclusive no formato YYYY-MM-DD"),
        to: z
          .string()
          .optional()
          .describe("Data final inclusive no formato YYYY-MM-DD"),
      }),
      execute: async ({ from, to }) => {
        const data = await loadScopedData();
        const txs = flattenTransactions(data);
        const categories = aggregateByCategory(txs, { from, to });

        return {
          categories: categories.map((cat) => ({
            category: cat.category,
            total: cat.total,
            formattedTotal: formatCurrency(cat.total),
            count: cat.count,
          })),
        };
      },
    }),

    getBalanceSummary: tool({
      description:
        "Retorna saldo consolidado e saldo por conta no escopo atual (todas as pessoas ou pessoa selecionada).",
      parameters: z.object({}),
      execute: async () => {
        const data = await loadScopedData();
        let total = 0;
        const people = data.people.map((person) => {
          const accounts = person.connections.flatMap((c) => c.accounts);
          const personBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
          total += personBalance;
          return {
            personName: person.name,
            balance: personBalance,
            formattedBalance: formatCurrency(personBalance),
            accounts: accounts.map((acc) => ({
              name: acc.name,
              type: acc.type,
              balance: acc.balance,
              formattedBalance: formatCurrency(acc.balance, acc.currencyCode),
              currencyCode: acc.currencyCode,
            })),
          };
        });

        return {
          totalBalance: total,
          formattedTotalBalance: formatCurrency(total),
          people,
        };
      },
    }),
  };
}
