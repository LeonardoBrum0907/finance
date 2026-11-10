import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  alignSalaryDatesToPayday,
  classifyIncome,
  estimateSalaryForCycle,
  estimateUpcomingCycleSalary,
  getPaydayCycleBounds,
  getPaydayCycleKey,
  resolveCycleSalaryProjection,
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

describe("estimateUpcomingCycleSalary", () => {
  const paydayDay = 25;

  it("projects salary mid-cycle with end anchor when history exists", () => {
    const ref = new Date("2026-06-15T12:00:00Z");
    const cycleKey = getPaydayCycleKey(paydayDay, "end", ref);
    const bounds = getPaydayCycleBounds(cycleKey, paydayDay, "end");
    const txs: TransactionLike[] = [salaryTx("2026-05-25", 5000)];

    const projected = estimateUpcomingCycleSalary(txs, paydayDay, "end", {
      cycleKey,
      from: bounds.from,
      to: bounds.to,
      isComplete: false,
    }, ref);

    assert.equal(projected, 5000);
  });

  it("projects salary with start anchor when history exists", () => {
    const ref = new Date("2026-06-15T12:00:00Z");
    const cycleKey = getPaydayCycleKey(paydayDay, "start", ref);
    const bounds = getPaydayCycleBounds(cycleKey, paydayDay, "start");
    const txs: TransactionLike[] = [salaryTx("2026-05-25", 5000)];

    const projected = estimateUpcomingCycleSalary(txs, paydayDay, "start", {
      cycleKey,
      from: bounds.from,
      to: bounds.to,
      isComplete: false,
    }, ref);

    assert.equal(projected, 5000);
  });

  it("does not project when salary already received in cycle", () => {
    const ref = new Date("2026-06-25T12:00:00Z");
    const cycleKey = getPaydayCycleKey(paydayDay, "end", ref);
    const bounds = getPaydayCycleBounds(cycleKey, paydayDay, "end");
    const txs: TransactionLike[] = [
      salaryTx("2026-05-25", 5000),
      salaryTx("2026-06-25", 5200),
    ];

    const projected = estimateUpcomingCycleSalary(txs, paydayDay, "end", {
      cycleKey,
      from: bounds.from,
      to: bounds.to,
      isComplete: false,
    }, ref);

    assert.equal(projected, 0);
  });

  it("returns 0 without salary history", () => {
    const ref = new Date("2026-06-15T12:00:00Z");
    const cycleKey = getPaydayCycleKey(paydayDay, "end", ref);
    const bounds = getPaydayCycleBounds(cycleKey, paydayDay, "end");

    const projected = estimateUpcomingCycleSalary([], paydayDay, "end", {
      cycleKey,
      from: bounds.from,
      to: bounds.to,
      isComplete: false,
    }, ref);

    assert.equal(projected, 0);
  });

  it("does not project for completed cycles", () => {
    const ref = new Date("2026-07-01T12:00:00Z");
    const cycleKey = getPaydayCycleKey(paydayDay, "end", ref);
    const bounds = getPaydayCycleBounds(cycleKey, paydayDay, "end");
    const txs: TransactionLike[] = [salaryTx("2026-05-25", 5000)];

    const projected = estimateUpcomingCycleSalary(txs, paydayDay, "end", {
      cycleKey,
      from: bounds.from,
      to: bounds.to,
      isComplete: true,
    }, ref);

    assert.equal(projected, 0);
  });
});

describe("resolveCycleSalaryProjection", () => {
  it("returns projected and realized salary separately", () => {
    const ref = new Date("2026-06-15T12:00:00Z");
    const paydayDay = 25;
    const cycleKey = getPaydayCycleKey(paydayDay, "end", ref);
    const bounds = getPaydayCycleBounds(cycleKey, paydayDay, "end");
    const txs: TransactionLike[] = [salaryTx("2026-05-25", 4800)];

    const result = resolveCycleSalaryProjection(
      txs,
      paydayDay,
      "end",
      { cycleKey, from: bounds.from, to: bounds.to, isComplete: false },
      ref,
    );

    assert.equal(result.realizedSalary, 0);
    assert.equal(result.projectedSalary, 4800);
  });
});

describe("alignSalaryDatesToPayday", () => {
  const salary = (date: string, amount: number): TransactionLike => ({
    date: new Date(`${date}T12:00:00-03:00`),
    amount,
    accountType: "BANK",
    category: "Salário",
    description: "Salário",
  });

  it("keeps an early salary in the cycle it pays and projects one salary", () => {
    const txs = alignSalaryDatesToPayday(
      [salary("2026-09-25", 4000), salary("2026-10-23", 4200)],
      25,
    );
    const september = classifyIncome(txs, { from: "2026-09-25", to: "2026-10-24" }, 25);
    assert.equal(september.salary, 4000);

    const today = new Date("2026-11-10T12:00:00-03:00");
    assert.equal(
      estimateSalaryForCycle(txs, 25, "start", {
        cycleKey: "2026-10-25",
        from: "2026-10-25",
        to: "2026-11-24",
        isComplete: false,
      }, today),
      0,
    );
    assert.equal(
      estimateSalaryForCycle(txs, 25, "start", {
        cycleKey: "2026-11-25",
        from: "2026-11-25",
        to: "2026-12-24",
        isComplete: false,
      }, today),
      4200,
    );
  });
});
