import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isThirteenthSalary, resolveExpectedSalary } from "./expectedSalary.js";

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

describe("13º salário", () => {
  it("recognizes common bank descriptions", () => {
    for (const d of ["PAGTO 13O SALARIO", "13º Salário 1ª parcela", "ADIANT 13", "Décimo terceiro", "SALARIO 13", "13 SAL"]) {
      assert.equal(isThirteenthSalary(d), true, d);
    }
    for (const d of ["SALARIO", "PIX RECEBIDO 13/11", "REMUNERACAO", "Mercado 13"]) {
      assert.equal(isThirteenthSalary(d), false, d);
    }
  });

  it("leaves the 13º out of the expected salary", () => {
    const result = resolveExpectedSalary(
      [
        { date: "2026-11-25", amount: 1000, description: "SALARIO" },
        { date: "2026-11-25", amount: 500, description: "PAGTO 13O SALARIO" },
      ],
      "2026-11-27",
    );
    assert.deepEqual(result, { amount: 1000, receivedDates: ["2026-11-25"] });
  });
});
