import { tool } from "ai";
import { z } from "zod";
import {
  addContributionSchema,
  createGoalSchema,
  createPlanSchema,
  updateGoalSchema,
} from "@finance/shared";
import {
  filterByDateRange,
  formatCurrency,
  getSpendingByCategory as aggregateByCategory,
  toLocalDateKey,
} from "./aggregates.js";
import { flattenTransactions, loadUserFinancialData } from "./queries.js";
import { formatGoalsForTool, loadGoalsSummaryForUser } from "./goalsContext.js";
import { prisma } from "../../prisma.js";

const MAX_TRANSACTIONS = 50;
const TOOL_TRANSACTIONS_PER_ACCOUNT = 500;

const PROPOSAL_MARKER = { proposal: true as const };

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
      inputSchema: z.object({
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
      inputSchema: z.object({
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
      inputSchema: z.object({}),
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

    getGoalsAndPlans: tool({
      description:
        "Lista objetivos financeiros e planos de poupança do usuário, com ids, progresso, prazos e alocações. Use sempre que o usuário perguntar quais objetivos existem ou antes de propor um plano.",
      inputSchema: z.object({}),
      execute: async () => {
        const summary = await loadGoalsSummaryForUser(userId);
        return formatGoalsForTool(summary);
      },
    }),

    proposeCreateGoal: tool({
      description:
        "Propõe a criação de um objetivo financeiro. NÃO cria no banco — o usuário deve confirmar no chat.",
      inputSchema: createGoalSchema,
      execute: async (input) => {
        const parsed = createGoalSchema.safeParse(input);
        if (!parsed.success) {
          return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
        }
        return {
          ...PROPOSAL_MARKER,
          type: "create_goal" as const,
          payload: parsed.data,
        };
      },
    }),

    proposeUpdateGoal: tool({
      description:
        "Propõe a edição de um objetivo existente. NÃO altera o banco — o usuário deve confirmar no chat.",
      inputSchema: updateGoalSchema.extend({
        goalId: z.string().min(1, "Informe o ID do objetivo"),
      }),
      execute: async (input) => {
        const schema = updateGoalSchema.extend({ goalId: z.string().min(1) });
        const parsed = schema.safeParse(input);
        if (!parsed.success) {
          return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
        }
        const { goalId, ...payload } = parsed.data;
        return {
          ...PROPOSAL_MARKER,
          type: "update_goal" as const,
          payload: { goalId, ...payload },
        };
      },
    }),

    proposeAddContribution: tool({
      description:
        "Propõe registrar um aporte em um objetivo. NÃO altera o banco — o usuário deve confirmar no chat.",
      inputSchema: addContributionSchema.extend({
        goalId: z.string().min(1, "Informe o ID do objetivo"),
      }),
      execute: async (input) => {
        const schema = addContributionSchema.extend({ goalId: z.string().min(1) });
        const parsed = schema.safeParse(input);
        if (!parsed.success) {
          return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
        }
        return {
          ...PROPOSAL_MARKER,
          type: "add_contribution" as const,
          payload: parsed.data,
        };
      },
    }),

    proposeCreatePlan: tool({
      description:
        "Propõe a criação de um plano de poupança agrupando objetivos JÁ CADASTRADOS (use goalId de getGoalsAndPlans). NÃO cria no banco — o usuário deve confirmar no chat.",
      inputSchema: createPlanSchema,
      execute: async (input) => {
        const parsed = createPlanSchema.safeParse(input);
        if (!parsed.success) {
          return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
        }

        const goalIds = parsed.data.goals.map((g) => g.goalId);
        const activeGoals = await prisma.goal.findMany({
          where: {
            userId,
            id: { in: goalIds },
            status: { in: ["active", "paused"] },
          },
          select: { id: true, name: true },
        });

        if (activeGoals.length !== goalIds.length) {
          const found = new Set(activeGoals.map((g) => g.id));
          const missing = goalIds.filter((id) => !found.has(id));
          const available = await prisma.goal.findMany({
            where: { userId, status: "active" },
            select: { id: true, name: true },
            orderBy: { createdAt: "desc" },
          });

          return {
            error:
              "Um ou mais goalId não existem ou não estão ativos. Confirme objetivos pendentes no chat antes de criar o plano.",
            missingGoalIds: missing,
            availableGoals: available.map((g) => ({ id: g.id, name: g.name })),
          };
        }

        const allocationSum = parsed.data.goals.reduce(
          (sum, member) => sum + member.monthlyAllocation,
          0,
        );
        if (allocationSum > parsed.data.monthlyContribution + 0.01) {
          return {
            error: `A soma das alocações (${allocationSum}) excede o aporte mensal (${parsed.data.monthlyContribution}).`,
          };
        }

        return {
          ...PROPOSAL_MARKER,
          type: "create_plan" as const,
          payload: parsed.data,
        };
      },
    }),
  };
}
