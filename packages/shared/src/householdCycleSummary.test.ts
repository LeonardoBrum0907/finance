import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateHouseholdCycleSummary,
  buildNavigableCycles,
  cycleForecastToPersonSummary,
  resolveSelectedCycleKey,
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
  });
});

describe("aggregateHouseholdCycleSummary", () => {
  it("sums person metrics into household totals", () => {
    const persons = [
      cycleForecastToPersonSummary("p1", "João", 10000, forecast({ realizedNet: 1000, closingBalance: 800 })),
      cycleForecastToPersonSummary("p2", "Maria", 5000, forecast({ realizedNet: 2000, closingBalance: 1700 })),
    ];
    const household = aggregateHouseholdCycleSummary(
      { cycleKey: "2026-07-25", from: "2026-06-26", to: "2026-07-25", isComplete: false },
      persons,
    );
    assert.equal(household.bankBalance, 15000);
    assert.equal(household.realizedNet, 3000);
    assert.equal(household.closingBalance, 2500);
    assert.equal(household.persons.length, 2);
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
