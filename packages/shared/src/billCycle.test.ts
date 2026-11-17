import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { billCycleKeyForPayment, buildBillCycles, type BillCycleInput } from "./billCycle.js";

function input(overrides: Partial<BillCycleInput> = {}): BillCycleInput {
  return {
    today: "2026-11-17",
    bankBalance: 500,
    paydayDay: 25,
    expectedSalary: 3000,
    salaryReceivedDates: ["2026-10-24"],
    cards: [
      {
        accountId: "cartao",
        accountName: "Cartão Exemplo",
        billDueDay: 28,
        billCloseDay: 21,
        balanceDueDate: null,
        balanceCloseDate: null,
        creditBrand: null,
        statements: [{ dueDate: "2026-10-28", closingDate: "2026-10-21", totalAmount: 2000 }],
        charges: [
          { date: "2026-10-30", amount: 1000, billMonth: "2026-11" },
          { date: "2026-11-10", amount: 1500, billMonth: "2026-11" },
          { date: "2026-12-11", amount: 100, billMonth: "2026-12" },
        ],
      },
    ],
    checkingPayments: [
      { date: "2026-10-28", amount: -2000, category: "Pagamento de fatura", accountType: "BANK" },
    ],
    scheduledCash: [{ id: "luz", title: "Luz", date: "2026-11-20", amount: 200 }],
    scheduledCard: [{ id: "streaming", title: "Streaming", date: "2026-11-19", amount: 50, cardAccountId: "cartao" }],
    ...overrides,
  };
}

describe("buildBillCycles", () => {
  it("o ciclo atual é a fatura aberta e mostra quanto ainda dá para gastar", () => {
    const result = buildBillCycles(input())!;
    assert.equal(result.currentCycleKey, "2026-11");
    const current = result.cycles.find((c) => c.cycleKey === "2026-11")!;
    assert.equal(current.status, "open");
    assert.equal(current.purchaseFrom, "2026-10-22");
    assert.equal(current.purchaseTo, "2026-11-21");
    assert.equal(current.dueDate, "2026-11-28");
    // Fatura: 1000 + 1500 lançados + 50 previstos.
    assert.equal(current.billTotal, 2550);
    // Dinheiro: 500 em conta + 3000 de salário (25/11) − 200 de luz.
    assert.equal(current.money!.salary, 3000);
    assert.equal(current.money!.salaryDate, "2026-11-25");
    assert.equal(current.money!.available, 3300);
    assert.equal(current.money!.leftover, 750);
  });

  it("a sobra de um ciclo é o ponto de partida do seguinte", () => {
    const result = buildBillCycles(input())!;
    const next = result.cycles.find((c) => c.cycleKey === "2026-12")!;
    assert.equal(next.status, "future");
    assert.equal(next.money!.startingBalance, 750);
    assert.equal(next.money!.salary, 3000);
    assert.equal(next.billTotal, 100);
    assert.equal(next.money!.leftover, 3650);
  });

  it("fatura já vencida aparece como paga, sem conta de dinheiro", () => {
    const result = buildBillCycles(input())!;
    const october = result.cycles.find((c) => c.cycleKey === "2026-10")!;
    assert.equal(october.status, "paid");
    assert.equal(october.billTotal, 2000);
    assert.equal(october.money, null);
  });

  it("avisa quando o salário cai depois do vencimento", () => {
    const result = buildBillCycles(input({ paydayDay: 30 }))!;
    const current = result.cycles.find((c) => c.cycleKey === "2026-11")!;
    assert.equal(current.money!.salary, 0);
    assert.equal(current.money!.salaryAfterDue, "2026-11-30");
  });

  it("diz em que fatura cai cada saída", () => {
    const result = buildBillCycles(input())!;
    // Cobrança no cartão em 19/11 cai na fatura de novembro; em 25/11, na de dezembro.
    assert.equal(billCycleKeyForPayment(result, { date: "2026-11-19", cardAccountId: "cartao" }), "2026-11");
    assert.equal(billCycleKeyForPayment(result, { date: "2026-11-25", cardAccountId: "cartao" }), "2026-12");
    // Parcela do cartão já sabe a fatura.
    assert.equal(
      billCycleKeyForPayment(result, { date: "2026-12-28", cardAccountId: "cartao", billMonth: "2026-12" }),
      "2026-12",
    );
    // Pix em 23/11 sai do dinheiro que paga a fatura de 28/11.
    assert.equal(billCycleKeyForPayment(result, { date: "2026-11-23" }), "2026-11");
    assert.equal(billCycleKeyForPayment(result, { date: "2026-11-29" }), "2026-12");
  });
});
