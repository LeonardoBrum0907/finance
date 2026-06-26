import type { ChatContextSummaryDTO, ChatSuggestionDTO } from "@finance/shared";
import {
  formatCurrency,
  formatMonthLabel,
  getMonthlySummary,
  getSpendingByCategory,
  toLocalMonthKey,
} from "./finance/aggregates.js";
import { flattenTransactions, loadUserFinancialData } from "./finance/queries.js";
import { loadGoalsSummaryForUser } from "./finance/goalsContext.js";

export async function buildChatSuggestions(
  userId: string,
  personId?: string,
): Promise<ChatSuggestionDTO[]> {
  const data = await loadUserFinancialData(userId, { personId });
  const people = data.people;

  if (people.length === 0) {
    return [
      { label: "Como cadastrar pessoa?", message: "Como cadastrar uma pessoa?", intent: "analyze" },
      { label: "O que você faz?", message: "O que o assistente consegue fazer?", intent: "analyze" },
    ];
  }

  const hasAccounts = people.some((p) => p.connections.some((c) => c.accounts.length > 0));
  if (!hasAccounts) {
    return [
      {
        label: "Conectar conta",
        message: "Como conectar uma conta bancária?",
        intent: "analyze",
      },
      {
        label: "Bancos suportados",
        message: "Quais bancos posso conectar?",
        intent: "analyze",
      },
      {
        label: "Capacidades",
        message: "O que o assistente consegue fazer?",
        intent: "analyze",
      },
    ];
  }

  const txs = flattenTransactions(data);
  const currentMonth = toLocalMonthKey(new Date());
  const monthRange = { from: `${currentMonth}-01`, to: `${currentMonth}-31` };
  const monthly = getMonthlySummary(txs);
  const categories = getSpendingByCategory(txs, monthRange);
  const goalsSummary = await loadGoalsSummaryForUser(userId);
  const activeGoals = goalsSummary.goals.filter((g) => g.status === "active");
  const activePlans = goalsSummary.plans.filter((p) => p.status === "active");

  const suggestions: ChatSuggestionDTO[] = [];

  if (monthly.net > 0) {
    suggestions.push({
      label: `Plano com sobra de ${formatCurrency(monthly.net)}`,
      message: `Tenho ${formatCurrency(monthly.net)} de sobra este mês — ajude a criar um plano de poupança`,
      intent: "plan",
    });
  } else if (monthly.net < 0) {
    suggestions.push({
      label: "Como melhorar a sobra?",
      message: "Meu saldo está negativo este mês. Onde posso cortar gastos?",
      intent: "analyze",
    });
  }

  if (activeGoals.length === 0) {
    suggestions.push({
      label: "Criar primeiro objetivo",
      message: "Quero criar meu primeiro objetivo financeiro. Me ajude a definir uma meta realista.",
      intent: "goal",
    });
  } else if (activePlans.length === 0) {
    const topGoal = activeGoals[0]!;
    suggestions.push({
      label: `Plano para "${topGoal.name}"`,
      message: `Monte um plano de poupança para o objetivo "${topGoal.name}"`,
      intent: "plan",
    });
  } else {
    const behind = activeGoals.find((g) => g.onTrack === false);
    if (behind) {
      suggestions.push({
        label: `Recuperar "${behind.name}"`,
        message: `O objetivo "${behind.name}" está atrasado. O que posso fazer para voltar ao trilho?`,
        intent: "goal",
      });
    }
  }

  if (categories.length > 0) {
    const top = categories[0]!;
    suggestions.push({
      label: `Gastos em ${top.category}`,
      message: `Analise meus gastos em ${top.category} este mês e sugira como reduzir`,
      intent: "analyze",
    });
  }

  suggestions.push({
    label: "Simular uma compra",
    message: "Quero simular uma compra — quanto posso gastar sem comprometer minhas metas?",
    intent: "what_if",
  });

  suggestions.push({
    label: "Resumo do mês",
    message: `Como estão minhas finanças em ${formatMonthLabel(currentMonth)}?`,
    intent: "analyze",
  });

  return suggestions.slice(0, 6);
}

export async function buildChatContextSummary(
  userId: string,
  personId?: string,
): Promise<ChatContextSummaryDTO> {
  const data = await loadUserFinancialData(userId, { personId });
  const people = data.people;
  const hasAccounts = people.some((p) => p.connections.some((c) => c.accounts.length > 0));

  if (!hasAccounts) {
    return { hasAccounts: false };
  }

  const txs = flattenTransactions(data);
  const currentMonth = toLocalMonthKey(new Date());
  const monthRange = { from: `${currentMonth}-01`, to: `${currentMonth}-31` };
  const monthly = getMonthlySummary(txs);

  let total = 0;
  for (const person of people) {
    const accounts = person.connections.flatMap((c) => c.accounts);
    total += accounts.reduce((sum, a) => sum + a.balance, 0);
  }

  const goalsSummary = await loadGoalsSummaryForUser(userId);
  const activeGoalsCount = goalsSummary.goals.filter((g) => g.status === "active").length;

  return {
    hasAccounts: true,
    balance: formatCurrency(total),
    monthlyExpenses: formatCurrency(monthly.expenses),
    monthlyNet: formatCurrency(monthly.net),
    activeGoalsCount,
  };
}
