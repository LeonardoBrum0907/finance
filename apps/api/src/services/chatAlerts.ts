import type { ChatAlertDTO } from "@finance/shared";
import {
  buildDashboardInsights,
  formatCurrency,
  getMonthlySummary,
  getSpendingByCategory,
  getTopExpenses,
  toLocalMonthKey,
} from "./finance/aggregates.js";
import { buildHouseholdArena } from "./finance/householdComparison.js";
import { flattenTransactions, loadUserFinancialData } from "./finance/queries.js";
import { prisma } from "../prisma.js";

export async function buildChatAlerts(userId: string): Promise<ChatAlertDTO[]> {
  const data = await loadUserFinancialData(userId);
  const people = data.people;
  const hasAccounts = people.some((p) => p.connections.some((c) => c.accounts.length > 0));

  if (!hasAccounts) return [];

  const alerts: ChatAlertDTO[] = [];

  const arena = await buildHouseholdArena(userId);
  if (arena && arena.personCount >= 2) {
    for (const h of arena.headToHead.slice(0, 2)) {
      alerts.push({
        id: h.id,
        message: h.message,
        severity: "info",
        suggestionMessage: `Analise esta comparação e diga quem precisa ajustar o comportamento: "${h.message}"`,
        contextKey: `alert:${h.id}`,
      });
    }

    for (const r of arena.rankings) {
      if (r.tone === "roast" || r.net < 0) {
        alerts.push({
          id: `arena-person-${r.personId}`,
          message: r.verdict,
          severity: "warning",
          suggestionMessage: `Me dê feedback direto sobre as finanças de ${r.personName} esta semana.`,
          personId: r.personId,
          contextKey: `arena:person:${r.personId}`,
        });
      }
    }
  }

  const txs = flattenTransactions(data);
  const now = new Date();
  const currentMonth = toLocalMonthKey(now);
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = toLocalMonthKey(prevMonth);
  const monthRange = { from: `${currentMonth}-01`, to: `${currentMonth}-31` };

  const period = { months: 1, ...getMonthlySummary(txs, currentMonth) };
  const previousPeriod = { months: 1, ...getMonthlySummary(txs, prevKey) };
  const categories = getSpendingByCategory(txs, monthRange);
  const previousCategories = getSpendingByCategory(txs, {
    from: `${prevKey}-01`,
    to: `${prevKey}-31`,
  });
  const topExpenses = getTopExpenses(txs, monthRange);
  const topExpense = topExpenses[0];

  const totalCat = categories.reduce((s, c) => s + c.total, 0);
  const categoriesWithPercent = categories.map((c) => ({
    ...c,
    percent: totalCat > 0 ? (c.total / totalCat) * 100 : 0,
  }));

  const insights = buildDashboardInsights({
    period,
    previousPeriod,
    categories: categoriesWithPercent,
    previousCategories,
    topExpense,
    currencyCode: "BRL",
  });

  for (let i = 0; i < insights.length; i++) {
    const text = insights[i]!;
    const lower = text.toLowerCase();
    let severity: ChatAlertDTO["severity"] = "info";
    if (lower.includes("mais") || lower.includes("déficit") || lower.includes("cresceu")) {
      severity = "warning";
    } else if (lower.includes("menos") || lower.includes("positivo")) {
      severity = "success";
    }
    alerts.push({
      id: `insight-${i}`,
      message: text,
      severity,
      suggestionMessage: `Explique este insight e sugira uma ação prática: "${text}"`,
      contextKey: `insight:${severity}`,
    });
  }

  if (period.net < 0) {
    alerts.push({
      id: "negative-net",
      message: `Déficit de ${formatCurrency(Math.abs(period.net))} no mês atual.`,
      severity: "warning",
      suggestionMessage:
        "Meu saldo está negativo este mês. Onde posso cortar gastos e como recuperar?",
      contextKey: "alert:negative-net",
    });
  }

  const budgets = await prisma.budgetGroup.findMany({
    where: { userId },
    include: { members: true },
  });
  for (const budget of budgets) {
    const budgetCategories = budget.members.map((m) => m.categoryGroup);
    const spent = categories
      .filter((c) => budgetCategories.includes(c.category))
      .reduce((s, c) => s + c.total, 0);
    const ratio = budget.limit > 0 ? spent / budget.limit : 0;
    if (ratio >= 0.9) {
      alerts.push({
        id: `budget-${budget.id}`,
        message: `Orçamento "${budget.name}" em ${Math.round(ratio * 100)}% do limite.`,
        severity: ratio >= 1 ? "warning" : "info",
        suggestionMessage: `Meu orçamento "${budget.name}" está quase estourando. O que fazer?`,
        contextKey: `alert:budget-${budget.id}`,
      });
    }
  }

  const syncDates = people.flatMap((p) =>
    p.connections
      .map((c) => c.lastSyncedAt)
      .filter((d): d is Date => d instanceof Date),
  );
  if (syncDates.length > 0) {
    const latest = syncDates.reduce((a, b) => (a > b ? a : b));
    const staleMs = Date.now() - latest.getTime();
    if (staleMs > 24 * 60 * 60 * 1000) {
      alerts.push({
        id: "stale-sync",
        message: "Seus dados bancários podem estar desatualizados.",
        severity: "info",
        suggestionMessage:
          "Quais dados financeiros você está usando? Meus dados podem estar desatualizados?",
        contextKey: "alert:stale-sync",
      });
    }
  }

  return alerts.slice(0, 6);
}
