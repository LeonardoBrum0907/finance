import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveBillInterval,
  resolveMonthInterval,
  selectIntervalTransactions,
  summarizeIntervalFlow,
  type CardPaymentCalendar,
} from "@finance/shared";
import { buildIntervalDashboard } from "./intervalDashboard.js";
import type { IntervalContext } from "./interval.js";
import type { FinancialTransaction } from "./types.js";

const card: CardPaymentCalendar = {
  accountId: "itau-cartao",
  billDueDay: 28,
  billCloseDay: 21,
  balanceDueDate: null,
  balanceCloseDate: null,
  statements: [],
};

function tx(
  id: string,
  date: string,
  amount: number,
  account: "conta" | "itau-cartao",
  category: string,
  description = id,
): FinancialTransaction {
  return {
    id,
    date: new Date(`${date}T15:00:00.000Z`),
    description,
    amount,
    currencyCode: "BRL",
    category,
    accountId: account,
    accountName: account,
    accountType: account === "conta" ? "BANK" : "CREDIT",
    personId: "leo",
    personName: "Léo",
  };
}

// Caso de 24/11/2026: salário em 25/11, um Pix recebido e a fatura de novembro.
const txs: FinancialTransaction[] = [
  tx("salario-out", "2026-10-24", 4424.92, "conta", "Salário"),
  tx("mercado-out", "2026-10-02", 300, "itau-cartao", "Supermercado"),
  tx("salario-nov", "2026-11-25", 4424.92, "conta", "Salário"),
  tx("pix-recebido", "2026-11-10", 350, "conta", "Transferências", "PIX RECEBIDO CLIENTE"),
  tx("mercado-nov", "2026-11-03", 500, "itau-cartao", "Supermercado"),
  tx("farmacia-nov", "2026-11-15", 80, "itau-cartao", "Farmácia"),
  tx("luz", "2026-11-12", -150, "conta", "Contas de casa"),
  tx("pagou-fatura-out", "2026-10-28", -300, "conta", "Pagamento de cartão", "PAGAMENTO DE FATURA"),
];

const cycles = [
  { cycleKey: "2026-10", periodFrom: "2026-09-29", periodTo: "2026-10-28" },
  { cycleKey: "2026-11", periodFrom: "2026-10-29", periodTo: "2026-11-30" },
];

function billContext(): IntervalContext {
  return {
    current: resolveBillInterval(cycles, "2026-11")!,
    previous: resolveBillInterval(cycles, "2026-10"),
    cards: [card],
    projectedSalary: 0,
  };
}

function monthContext(): IntervalContext {
  return {
    current: resolveMonthInterval("2026-11"),
    previous: resolveMonthInterval("2026-10"),
    cards: [card],
    projectedSalary: 0,
  };
}

function sum(values: number[]): number {
  return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
}

describe("buildIntervalDashboard", () => {
  it("no ciclo da fatura de novembro, vê o salário de 25/11 e a renda extra", () => {
    const view = buildIntervalDashboard(txs, billContext(), "BRL");
    assert.equal(view.period.income, 4774.92);
    assert.equal(view.period.expenses, 730);
    assert.deepEqual(view.growthMetrics.incomeBreakdown, { salary: 4424.92, extra: 350 });
    assert.equal(view.period.label, "29 out – 30 nov");
  });

  it("compara com o ciclo anterior de verdade, sem -100%", () => {
    const view = buildIntervalDashboard(txs, billContext(), "BRL");
    assert.equal(view.previousPeriod.income, 4424.92);
    assert.equal(view.previousPeriod.expenses, 300);
    assert.notEqual(view.growthMetrics.vsPrevious.incomeChange, -100);
  });

  it("salário que ainda vai cair entra só no card de salário e no disponível", () => {
    const view = buildIntervalDashboard(txs, { ...billContext(), projectedSalary: 1000 }, "BRL");
    assert.equal(view.period.income, 4774.92);
    assert.equal(view.growthMetrics.incomeBreakdown!.salary, 5424.92);
    assert.equal(view.period.availableNet, view.period.net + 1000);
  });
});

// Contrato: no mesmo intervalo, painel, lista e categorias somam o mesmo valor.
// Se a regra do intervalo mudar e um deles ficar para trás, este teste quebra.
describe("contrato do intervalo", () => {
  for (const [name, context] of [["fatura", billContext()], ["mês", monthContext()]] as const) {
    it(`painel = lista = categorias (${name})`, () => {
      const view = buildIntervalDashboard(txs, context, "BRL");
      const list = summarizeIntervalFlow(selectIntervalTransactions(txs, context.cards, context.current));
      assert.equal(view.period.income, list.income);
      assert.equal(view.period.expenses, list.expenses);
      assert.equal(view.monthlySeries[0]!.expenses, list.expenses);
      assert.equal(sum(view.categories.map((c) => c.total)), list.expenses);
      const breakdown = view.growthMetrics.incomeBreakdown!;
      assert.equal(sum([breakdown.salary, breakdown.extra]), list.income);
    });
  }
});
