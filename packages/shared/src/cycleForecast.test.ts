import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCycleForecastBlock,
  buildCycleForecastPair,
  buildPendingExpensesFromPurchases,
  getNextPaydayCycle,
  summarizeForecastCashFlow,
} from "./cycleForecast.js";
import {
  estimateSalaryForCycle,
  getPaydayCycleBounds,
  getPaydayCycleKey,
  type TransactionLike,
} from "./payday.js";

function salaryTx(dateKey: string, amount: number): TransactionLike {
  const [y, m, d] = dateKey.split("-").map(Number);
  return {
    date: new Date(Date.UTC(y!, m! - 1, d!)),
    amount,
    accountType: "CHECKING",
    category: "Salário",
  };
}

function expenseTx(dateKey: string, amount: number): TransactionLike {
  const [y, m, d] = dateKey.split("-").map(Number);
  return {
    date: new Date(Date.UTC(y!, m! - 1, d!)),
    amount: -amount,
    accountType: "CHECKING",
    category: "Mercado",
  };
}

describe("estimateSalaryForCycle", () => {
  const paydayDay = 25;

  it("projects salary for next cycle from history", () => {
    const ref = new Date("2026-06-15T12:00:00Z");
    const currentKey = getPaydayCycleKey(paydayDay, "end", ref);
    const currentBounds = getPaydayCycleBounds(currentKey, paydayDay, "end");
    const nextCycle = getNextPaydayCycle(
      { cycleKey: currentKey, from: currentBounds.from, to: currentBounds.to },
      paydayDay,
      "end",
    );
    const txs: TransactionLike[] = [salaryTx("2026-05-25", 5000)];

    const projected = estimateSalaryForCycle(txs, paydayDay, "end", {
      cycleKey: nextCycle.cycleKey,
      from: nextCycle.from,
      to: nextCycle.to,
      isComplete: false,
    }, ref);

    assert.equal(projected, 5000);
  });
});

describe("buildCycleForecastBlock", () => {
  const paydayDay = 25;

  it("separates realized from closing balance", () => {
    const ref = new Date("2026-06-15T12:00:00Z");
    const cycleKey = getPaydayCycleKey(paydayDay, "end", ref);
    const bounds = getPaydayCycleBounds(cycleKey, paydayDay, "end");
    const txs: TransactionLike[] = [
      salaryTx("2026-05-25", 5000),
      expenseTx("2026-06-05", 800),
      expenseTx("2026-06-20", 200),
    ];

    const block = buildCycleForecastBlock({
      txs,
      cycle: { cycleKey, from: bounds.from, to: bounds.to, isComplete: false },
      paydayDay,
      anchor: "end",
      today: "2026-06-15",
      pending: { recurring: 300, installments: 100 },
    });

    assert.equal(block.realizedExpenses, 800);
    assert.equal(block.pendingIncome, 5000);
    assert.equal(block.pendingExpenses, 600);
    assert.equal(block.closingBalance, block.realizedNet + block.pendingIncome - block.pendingExpenses);
  });
});

describe("buildCycleForecastPair", () => {
  const paydayDay = 25;

  it("returns current and next cycle forecasts", () => {
    const ref = new Date("2026-06-15T12:00:00Z");
    const cycleKey = getPaydayCycleKey(paydayDay, "end", ref);
    const bounds = getPaydayCycleBounds(cycleKey, paydayDay, "end");
    const txs: TransactionLike[] = [salaryTx("2026-05-25", 5000)];

    const pair = buildCycleForecastPair({
      txs,
      currentCycle: { cycleKey, from: bounds.from, to: bounds.to, isComplete: false },
      paydayDay,
      anchor: "end",
      today: "2026-06-15",
      nextPending: { recurring: 1200 },
    });

    assert.notEqual(pair.current.cycleKey, pair.next.cycleKey);
    assert.equal(pair.next.pendingExpenses, 1200);
    assert.equal(pair.next.pendingIncome, 5000);
    assert.equal(pair.next.closingBalance, 3800);
  });
});

describe("summarizeForecastCashFlow", () => {
  it("splits realized and bank committed expenses", () => {
    const txs: TransactionLike[] = [
      expenseTx("2026-06-05", 100),
      expenseTx("2026-06-20", 50),
    ];

    const result = summarizeForecastCashFlow(
      txs,
      { from: "2026-06-01", to: "2026-06-30" },
      "2026-06-10",
    );

    assert.equal(result.expenses, 100);
    assert.equal(result.bankCommitted, 50);
  });
});

describe("buildPendingExpensesFromPurchases", () => {
  it("counts only future installments in range", () => {
    const { total, items } = buildPendingExpensesFromPurchases(
      [
        {
          id: "p1",
          title: "Aluguel",
          paymentMethod: "pix",
          totalAmount: 1500,
          purchaseDate: "2026-06-01",
          installments: [
            { id: "i1", dueDate: "2026-06-05", amount: 1500 },
            { id: "i2", dueDate: "2026-07-05", amount: 1500 },
          ],
          createdAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      { from: "2026-06-01", to: "2026-06-30" },
      "2026-06-10",
      "recurring",
    );

    assert.equal(total, 0);
    assert.equal(items.length, 0);

    const july = buildPendingExpensesFromPurchases(
      [
        {
          id: "p1",
          title: "Aluguel",
          paymentMethod: "pix",
          totalAmount: 1500,
          purchaseDate: "2026-06-01",
          installments: [{ id: "i2", dueDate: "2026-07-05", amount: 1500 }],
          createdAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      { from: "2026-07-01", to: "2026-07-31" },
      "2026-06-10",
      "recurring",
    );

    assert.equal(july.total, 1500);
    assert.equal(july.items[0]!.title, "Aluguel");
  });
});
