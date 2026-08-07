import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
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
