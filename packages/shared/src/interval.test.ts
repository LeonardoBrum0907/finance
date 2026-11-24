import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatIntervalRef,
  parseIntervalRef,
  previousIntervalKey,
  resolveBillInterval,
  resolveMonthInterval,
  selectIntervalTransactions,
} from "./interval.js";
import type { CardPaymentCalendar } from "./cardPaymentDate.js";

const card: CardPaymentCalendar = {
  accountId: "cartao",
  billDueDay: 28,
  billCloseDay: 21,
  balanceDueDate: null,
  balanceCloseDate: null,
  statements: [],
};

function tx(id: string, date: string, amount: number, accountType: string, accountId = "conta") {
  return { id, date: new Date(`${date}T15:00:00.000Z`), amount, accountId, accountType };
}

describe("parseIntervalRef", () => {
  it("lê fatura e mês e volta ao mesmo texto", () => {
    assert.deepEqual(parseIntervalRef("bill:2026-11"), { kind: "bill", key: "2026-11" });
    assert.equal(formatIntervalRef(parseIntervalRef("month:2026-02")!), "month:2026-02");
  });

  it("recusa formato desconhecido", () => {
    for (const value of ["", "bill", "ciclo:2026-11", "month:2026-13", "month:26-11", 42]) {
      assert.equal(parseIntervalRef(value), null);
    }
  });
});

describe("resolução do intervalo", () => {
  it("mês do calendário vai do dia 1 ao último dia", () => {
    assert.deepEqual(resolveMonthInterval("2026-02"), {
      kind: "month",
      key: "2026-02",
      from: "2026-02-01",
      to: "2026-02-28",
      label: "fevereiro de 2026",
    });
  });

  it("ciclo da fatura usa o período do ciclo", () => {
    const cycles = [{ cycleKey: "2026-11", periodFrom: "2026-10-29", periodTo: "2026-11-30" }];
    assert.deepEqual(resolveBillInterval(cycles, "2026-11"), {
      kind: "bill",
      key: "2026-11",
      from: "2026-10-29",
      to: "2026-11-30",
      label: "29 out – 30 nov",
    });
    assert.equal(resolveBillInterval(cycles, "2026-12"), null);
  });

  it("mês anterior atravessa o ano", () => {
    assert.equal(previousIntervalKey("2026-01"), "2025-12");
    assert.equal(previousIntervalKey("2026-11"), "2026-10");
  });
});

describe("selectIntervalTransactions", () => {
  const txs = [
    tx("salario", "2026-11-25", 4424.92, "BANK"),
    tx("compra-out", "2026-10-25", 100, "CREDIT", "cartao"),
    tx("compra-nov-23", "2026-11-23", 80, "CREDIT", "cartao"),
  ];

  it("no ciclo da fatura, a compra entra pela fatura", () => {
    const interval = resolveBillInterval(
      [{ cycleKey: "2026-11", periodFrom: "2026-10-29", periodTo: "2026-11-28" }],
      "2026-11",
    )!;
    const ids = selectIntervalTransactions(txs, [card], interval).map((t) => t.id);
    assert.deepEqual(ids, ["salario", "compra-out"]);
  });

  it("no mês, a compra entra pela data da compra", () => {
    const ids = selectIntervalTransactions(txs, [card], resolveMonthInterval("2026-11")).map((t) => t.id);
    assert.deepEqual(ids, ["salario", "compra-nov-23"]);
  });
});
