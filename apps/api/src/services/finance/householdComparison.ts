import type {
  HouseholdArenaDTO,
  HouseholdArenaRankingDTO,
  HouseholdArenaTone,
  HouseholdHeadToHeadDTO,
} from "@finance/shared";
import { prisma } from "../../prisma.js";
import { findOrCreateThread } from "../chatThread.js";
import {
  addDaysToDateKey,
  formatCurrency,
  getSpendingByCategory,
  summarizeTransactions,
  toLocalDateKey,
} from "./aggregates.js";
import type { FinancialTransaction } from "./types.js";
import { flattenTransactions, loadUserFinancialData } from "./queries.js";

const ARENA_TX_LIMIT = 120;
const HOUSEHOLD_RECAP_KEY = "recap:weekly:household";
const LEGACY_RECAP_KEY = "recap:weekly";

interface PersonWeekMetrics {
  personId: string;
  personName: string;
  income: number;
  expenses: number;
  net: number;
  prevNet: number;
  prevExpenses: number;
  budgetOverruns: number;
  topCategory: string | null;
}

function getWeekRange(): { from: string; to: string } {
  const to = toLocalDateKey(new Date());
  const from = addDaysToDateKey(to, -6);
  return { from, to };
}

function getPreviousWeekRange(): { from: string; to: string } {
  const to = addDaysToDateKey(toLocalDateKey(new Date()), -7);
  const from = addDaysToDateKey(to, -6);
  return { from, to };
}

function personTxs(txs: FinancialTransaction[], personId: string) {
  return txs.filter((tx) => tx.personId === personId);
}

function normalizeScores(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((v) => ((v - min) / (max - min)) * 100);
}

function buildVerdict(
  metrics: PersonWeekMetrics,
  rank: number,
  totalPeople: number,
): { verdict: string; tone: HouseholdArenaTone; badges: string[] } {
  const badges: string[] = [];
  const name = metrics.personName;

  if (totalPeople === 1) {
    if (metrics.net >= 0) {
      return {
        verdict: `Sobra de ${formatCurrency(metrics.net)} na semana. Continue assim.`,
        tone: "praise",
        badges: metrics.net > 0 ? ["Sobra positiva"] : [],
      };
    }
    return {
      verdict: `Déficit de ${formatCurrency(Math.abs(metrics.net))} na semana. Hora de revisar os gastos.`,
      tone: "roast",
      badges: [],
    };
  }

  if (rank === 1) {
    badges.push("Líder da semana");
    if (metrics.net > 0) badges.push("Maior sobra");
    const verdict =
      metrics.net >= 0
        ? `${rank}º lugar — sobra de ${formatCurrency(metrics.net)}. O plano agradece.`
        : `${rank}º lugar — menos pior, mas ainda no vermelho (${formatCurrency(metrics.net)}).`;
    return { verdict, tone: metrics.net >= 0 ? "praise" : "neutral", badges };
  }

  const expenseGrowth =
    metrics.prevExpenses > 0
      ? ((metrics.expenses - metrics.prevExpenses) / metrics.prevExpenses) * 100
      : 0;

  if (metrics.net < 0) {
    return {
      verdict: `${rank}º lugar — déficit de ${formatCurrency(Math.abs(metrics.net))}. O bolso pediu arrego.`,
      tone: "roast",
      badges,
    };
  }

  if (expenseGrowth > 15 && metrics.topCategory) {
    return {
      verdict: `${rank}º lugar — gastos em ${metrics.topCategory} subiram ${Math.round(expenseGrowth)}% vs. semana passada.`,
      tone: "roast",
      badges,
    };
  }

  if (metrics.budgetOverruns > 0) {
    return {
      verdict: `${rank}º lugar — ${metrics.budgetOverruns} categoria(s) estouraram o orçamento da casa.`,
      tone: "roast",
      badges,
    };
  }

  return {
    verdict: `${rank}º lugar — sobra de ${formatCurrency(metrics.net)}, mas ${name} pode subir no ranking.`,
    tone: "neutral",
    badges,
  };
}

function buildHeadToHead(
  people: PersonWeekMetrics[],
  txs: FinancialTransaction[],
  weekRange: { from: string; to: string },
): HouseholdHeadToHeadDTO[] {
  if (people.length < 2) return [];

  const results: HouseholdHeadToHeadDTO[] = [];

  const netSorted = [...people].sort((a, b) => b.net - a.net);
  const leader = netSorted[0]!;
  const trailer = netSorted[netSorted.length - 1]!;
  if (leader.net > trailer.net && leader.personId !== trailer.personId) {
    results.push({
      id: `headtohead:net:${leader.personId}:${trailer.personId}`,
      message: `${leader.personName} teve ${formatCurrency(leader.net)} de sobra; ${trailer.personName} ficou em ${formatCurrency(trailer.net)}.`,
      personAId: leader.personId,
      personBId: trailer.personId,
      metric: "net",
    });
  }

  const categoryMap = new Map<string, Map<string, number>>();
  for (const person of people) {
    const cats = getSpendingByCategory(personTxs(txs, person.personId), weekRange);
    for (const cat of cats) {
      if (!categoryMap.has(cat.category)) categoryMap.set(cat.category, new Map());
      categoryMap.get(cat.category)!.set(person.personId, cat.total);
    }
  }

  for (const [category, byPerson] of categoryMap) {
    if (byPerson.size < 2) continue;
    const entries = [...byPerson.entries()].sort((a, b) => b[1] - a[1]);
    const [topId, topVal] = entries[0]!;
    const [bottomId, bottomVal] = entries[entries.length - 1]!;
    if (topId === bottomId || bottomVal <= 0) continue;
    const ratio = topVal / bottomVal;
    if (ratio < 1.5) continue;
    const topName = people.find((p) => p.personId === topId)?.personName ?? "Alguém";
    const bottomName = people.find((p) => p.personId === bottomId)?.personName ?? "outro";
    results.push({
      id: `headtohead:${category}:${topId}:${bottomId}`,
      message: `${topName} gastou ${ratio.toFixed(1)}x mais em ${category} que ${bottomName}.`,
      personAId: topId,
      personBId: bottomId,
      metric: category,
    });
  }

  return results.slice(0, 4);
}

async function computePersonMetrics(
  userId: string,
  people: { id: string; name: string }[],
  txs: FinancialTransaction[],
  weekRange: { from: string; to: string },
  prevWeekRange: { from: string; to: string },
): Promise<PersonWeekMetrics[]> {
  const budgets = await prisma.budgetGroup.findMany({
    where: { userId },
    include: { members: true },
  });

  const householdCats = getSpendingByCategory(txs, weekRange);
  const budgetLimits = new Map<string, number>();
  for (const budget of budgets) {
    const cats = budget.members.map((m) => m.categoryGroup);
    const spent = householdCats
      .filter((c) => cats.includes(c.category))
      .reduce((s, c) => s + c.total, 0);
    if (budget.limit > 0 && spent / budget.limit >= 1) {
      for (const cat of cats) budgetLimits.set(cat, budget.limit);
    }
  }

  return people.map((person) => {
    const ptxs = personTxs(txs, person.id);
    const current = summarizeTransactions(ptxs, weekRange);
    const previous = summarizeTransactions(ptxs, prevWeekRange);
    const cats = getSpendingByCategory(ptxs, weekRange);
    const topCategory = cats[0]?.category ?? null;

    let budgetOverruns = 0;
    for (const cat of cats) {
      if (budgetLimits.has(cat.category) && cat.total > 0) budgetOverruns++;
    }

    return {
      personId: person.id,
      personName: person.name,
      income: current.income,
      expenses: current.expenses,
      net: current.net,
      prevNet: previous.net,
      prevExpenses: previous.expenses,
      budgetOverruns,
      topCategory,
    };
  });
}

function scorePeople(metrics: PersonWeekMetrics[]): Map<string, number> {
  const netScores = normalizeScores(metrics.map((m) => m.net));
  const trendScores = normalizeScores(
    metrics.map((m) => m.net - m.prevNet),
  );
  const disciplineScores = normalizeScores(
    metrics.map((m) => -m.budgetOverruns * 10 - m.expenses),
  );
  const consistencyScores = normalizeScores(
    metrics.map((m) => {
      const growth =
        m.prevExpenses > 0 ? (m.expenses - m.prevExpenses) / m.prevExpenses : 0;
      return -Math.abs(growth) * 100;
    }),
  );

  const scores = new Map<string, number>();
  metrics.forEach((m, i) => {
    const composite =
      netScores[i]! * 0.3 +
      disciplineScores[i]! * 0.25 +
      trendScores[i]! * 0.2 +
      50 * 0.15 +
      consistencyScores[i]! * 0.1;
    scores.set(m.personId, Math.round(composite * 10) / 10);
  });
  return scores;
}

export async function buildHouseholdArena(userId: string): Promise<HouseholdArenaDTO | null> {
  const data = await loadUserFinancialData(userId, { transactionsPerAccount: ARENA_TX_LIMIT });
  const peopleWithAccounts = data.people.filter((p) =>
    p.connections.some((c) => c.accounts.length > 0),
  );

  if (peopleWithAccounts.length === 0) return null;

  const weekRange = getWeekRange();
  const prevWeekRange = getPreviousWeekRange();
  const txs = flattenTransactions(data);

  const metrics = await computePersonMetrics(
    userId,
    peopleWithAccounts.map((p) => ({ id: p.id, name: p.name })),
    txs,
    weekRange,
    prevWeekRange,
  );

  const scores = scorePeople(metrics);
  const sorted = [...metrics].sort(
    (a, b) => (scores.get(b.personId) ?? 0) - (scores.get(a.personId) ?? 0),
  );

  const householdThread = await findOrCreateThread(userId, {
    contextKey: HOUSEHOLD_RECAP_KEY,
    title: "Resumo da casa",
  });

  const rankings: HouseholdArenaRankingDTO[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i]!;
    const rank = peopleWithAccounts.length === 1 ? 1 : i + 1;
    const personThread = await findOrCreateThread(userId, {
      contextKey: `recap:weekly:person:${m.personId}`,
      title: `Semana — ${m.personName}`,
    });
    const { verdict, tone, badges } = buildVerdict(m, rank, peopleWithAccounts.length);
    rankings.push({
      personId: m.personId,
      personName: m.personName,
      rank,
      score: scores.get(m.personId) ?? 0,
      verdict,
      tone,
      badges,
      recapThreadId: personThread.id,
      net: m.net,
      expenses: m.expenses,
      income: m.income,
    });
  }

  const headToHead = buildHeadToHead(metrics, txs, weekRange);

  return {
    periodLabel: `Semana ${weekRange.from} a ${weekRange.to}`,
    householdRecapThreadId: householdThread.id,
    personCount: peopleWithAccounts.length,
    rankings,
    headToHead,
  };
}

export function buildHouseholdComparisonContext(arena: HouseholdArenaDTO): string {
  const lines: string[] = [
    "## Arena financeira da casa",
    `Período: ${arena.periodLabel}`,
    "",
    "### Ranking da semana",
  ];

  for (const r of arena.rankings) {
    const badgeStr = r.badges.length > 0 ? ` [${r.badges.join(", ")}]` : "";
    lines.push(
      `${r.rank}º — ${r.personName} (score ${r.score}) — sobra ${formatCurrency(r.net)} — ${r.verdict}${badgeStr}`,
    );
  }

  if (arena.headToHead.length > 0) {
    lines.push("", "### Comparações diretas");
    for (const h of arena.headToHead) {
      lines.push(`- ${h.message}`);
    }
  }

  lines.push(
    "",
    "### Tom da arena",
    "Use tom competitivo leve: elogie comportamentos bons e provoque (com humor) hábitos ruins.",
    "Ataque comportamentos, nunca a pessoa. Nunca ironize renda, saúde ou família.",
  );

  return lines.join("\n");
}

export function personRecapContextKey(personId: string): string {
  return `recap:weekly:person:${personId}`;
}

export function householdRecapContextKey(): string {
  return HOUSEHOLD_RECAP_KEY;
}

export { HOUSEHOLD_RECAP_KEY, LEGACY_RECAP_KEY };
