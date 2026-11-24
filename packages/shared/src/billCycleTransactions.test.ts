import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectByBillCycle } from "./billCycleTransactions.js";
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

describe("selectByBillCycle", () => {
  const cycle = { cycleKey: "2026-11", periodFrom: "2026-10-29", periodTo: "2026-11-28" };

  it("traz o salário do período e as compras da fatura do mês", () => {
    const txs = [
      tx("salario", "2026-11-25", 4424.92, "BANK"),
      tx("pix-antes", "2026-10-28", -50, "BANK"),
      tx("compra-nov", "2026-10-25", 100, "CREDIT", "cartao"),
      tx("compra-dez", "2026-11-23", 80, "CREDIT", "cartao"),
    ];
    const selected = selectByBillCycle(txs, [card], cycle);
    assert.deepEqual(selected.map((t) => t.id), ["salario", "compra-nov"]);
    assert.equal(selected[1]!.billDueDate, "2026-11-28");
    assert.equal(selected[0]!.billDueDate, null);
  });

  it("quando a fatura é paga antes, o período termina no pagamento", () => {
    const paidEarly = { ...cycle, periodTo: "2026-11-24" };
    const txs = [tx("salario", "2026-11-25", 4424.92, "BANK"), tx("compra-nov", "2026-11-10", 100, "CREDIT", "cartao")];
    assert.deepEqual(selectByBillCycle(txs, [card], paidEarly).map((t) => t.id), ["compra-nov"]);
  });
});
