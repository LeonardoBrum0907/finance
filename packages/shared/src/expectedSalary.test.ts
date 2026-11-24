import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveExpectedSalary } from "./expectedSalary.js";

describe("resolveExpectedSalary", () => {
  const october = [
    { date: "2026-10-25", amount: 3200 },
    { date: "2026-10-25", amount: 1224.92 },
  ];

  it("sums the entries of the last payment", () => {
    assert.deepEqual(resolveExpectedSalary(october, "2026-11-10"), {
      amount: 4424.92,
      receivedDates: ["2026-10-25", "2026-10-25"],
    });
  });

  it("does not count a salary dated in the future as received", () => {
    const withNovember = [...october, { date: "2026-11-25", amount: 3200 }, { date: "2026-11-25", amount: 1224.92 }];
    const result = resolveExpectedSalary(withNovember, "2026-11-24");
    assert.equal(result.amount, 4424.92);
    assert.equal(result.receivedDates.includes("2026-11-25"), false);
  });

  it("returns zero without any salary", () => {
    assert.deepEqual(resolveExpectedSalary([], "2026-11-24"), { amount: 0, receivedDates: [] });
  });
});
