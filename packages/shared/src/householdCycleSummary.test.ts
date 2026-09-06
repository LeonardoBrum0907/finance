import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateHouseholdCycleSummary,
  buildNavigableCycles,
  computeNetWorth,
  cycleForecastToPersonSummary,
  cycleSaved,
  resolveSelectedCycleKey,
  savingsRate,
  stillMineThisPeriod,
} from "./householdCycleSummary.js";
import type { CycleForecastBlock } from "./cycleForecast.js";

function forecast(overrides: Partial<CycleForecastBlock> = {}): CycleForecastBlock {
  return {
    cycleKey: "2026-07-25",
    from: "2026-06-26",
    to: "2026-07-25",
    isComplete: false,
    realizedIncome: 5000,
    realizedExpenses: 2000,
    realizedNet: 3000,
    pendingIncome: 0,
    pendingExpenses: 500,
    closingBalance: 2500,
    expenseBreakdown: { recurring: 300, installments: 200, simulations: 0, bank: 0, creditBills: 0 },
    expenseItems: [],
    salaryKnown: true,
    ...overrides,
  };
}

describe("cycleForecastToPersonSummary", () => {
  it("maps forecast fields to person summary", () => {
    const summary = cycleForecastToPersonSummary("p1", "João", 12000, forecast());
    assert.equal(summary.personId, "p1");
    assert.equal(summary.bankBalance, 12000);
    assert.equal(summary.realizedNet, 3000);
    assert.equal(summary.closingBalance, 2500);
    assert.equal(summary.projectedSalaryIncome, 0);
    assert.equal(summary.pendingExpenses, 500);
    assert.equal(summary.realizedIncome, 5000);
    assert.equal(summary.realizedExpenses, 2000);
    assert.equal(summary.creditDebt, 0);
    assert.equal(summary.investmentBalance, 0);
    assert.equal(summary.netWorth, 12000);
  });

  it("computes net worth from caixa, cartão and investimentos", () => {
    const summary = cycleForecastToPersonSummary("p1", "João", 10000, forecast(), {
      creditDebt: 2000,
      investmentBalance: 8000,
      includeInvestments: true,
    });
    assert.equal(summary.netWorth, 16000);
    assert.equal(summary.creditDebt, 2000);
    assert.equal(summary.investmentBalance, 8000);
  });

  it("excludes investments from net worth when the setting is off", () => {
    const summary = cycleForecastToPersonSummary("p1", "João", 10000, forecast(), {
      creditDebt: 2000,
      investmentBalance: 8000,
      includeInvestments: false,
    });
    assert.equal(summary.netWorth, 8000);
    assert.equal(summary.investmentsIncluded, false);
    assert.equal(summary.investmentBalance, 8000);
  });
});

describe("stillMineThisPeriod", () => {
  it("is caixa + renda prevista − contas, not the cycle flow net", () => {
    const summary = cycleForecastToPersonSummary("p1", "João", 10000, forecast({
      realizedNet: 3000,
      pendingIncome: 5000,
      pendingExpenses: 3000,
      closingBalance: 5000,
    }));
    assert.equal(stillMineThisPeriod(summary), 12000);
    assert.equal(summary.closingBalance, 5000);
    assert.notEqual(stillMineThisPeriod(summary), summary.closingBalance);
  });
});

describe("savingsRate", () => {
  it("is (renda − gastos) / renda of the cycle", () => {
    const summary = cycleForecastToPersonSummary("p1", "João", 10000, forecast({
      realizedIncome: 5000,
      realizedExpenses: 2000,
      pendingIncome: 0,
      pendingExpenses: 500,
      closingBalance: 2500,
    }));
    assert.equal(cycleSaved(summary), 2500);
    assert.equal(savingsRate(summary), 0.5);
  });

  it("returns null when the cycle has no income", () => {
    const summary = cycleForecastToPersonSummary("p1", "João", 1000, forecast({
      realizedIncome: 0,
      realizedExpenses: 200,
      pendingIncome: 0,
      pendingExpenses: 0,
      realizedNet: -200,
      closingBalance: -200,
    }));
    assert.equal(savingsRate(summary), null);
    assert.equal(cycleSaved(summary), -200);
  });
});

describe("computeNetWorth", () => {
  it("subtracts credit and optionally adds investments", () => {
    assert.equal(
      computeNetWorth({
        bankBalance: 1000,
        creditDebt: 250,
        investmentBalance: 400,
        investmentsIncluded: true,
      }),
      1150,
    );
    assert.equal(
      computeNetWorth({
        bankBalance: 1000,
        creditDebt: 250,
        investmentBalance: 400,
        investmentsIncluded: false,
      }),
      750,
    );
  });
});

describe("aggregateHouseholdCycleSummary", () => {
  it("sums person metrics into household totals", () => {
    const persons = [
      cycleForecastToPersonSummary("p1", "João", 10000, forecast({ realizedNet: 1000, closingBalance: 800 }), {
        creditDebt: 1000,
        investmentBalance: 2000,
      }),
      cycleForecastToPersonSummary("p2", "Maria", 5000, forecast({ realizedNet: 2000, closingBalance: 1700 }), {
        creditDebt: 500,
        investmentBalance: 3000,
      }),
    ];
    const household = aggregateHouseholdCycleSummary(
      { cycleKey: "2026-07-25", from: "2026-06-26", to: "2026-07-25", isComplete: false },
      persons,
    );
    assert.equal(household.bankBalance, 15000);
    assert.equal(household.creditDebt, 1500);
    assert.equal(household.investmentBalance, 5000);
    assert.equal(household.netWorth, 18500);
    assert.equal(household.realizedNet, 3000);
    assert.equal(household.closingBalance, 2500);
    assert.equal(household.persons.length, 2);
    assert.equal(stillMineThisPeriod(household), 14000);
  });
});

describe("buildNavigableCycles", () => {
  it("includes past cycles, current and next", () => {
    const cycles = buildNavigableCycles(25, "end", 3);
    assert.ok(cycles.length >= 4);
    const current = cycles.find((c) => c.isCurrent);
    assert.ok(current);
    const future = cycles.filter((c) => c.isFuture);
    assert.equal(future.length, 1);
  });
});

describe("resolveSelectedCycleKey", () => {
  it("falls back to current cycle when key is missing", () => {
    const cycles = buildNavigableCycles(25, "end", 2);
    const key = resolveSelectedCycleKey(cycles);
    assert.ok(cycles.some((c) => c.cycleKey === key));
  });
});
