import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cyclePeriodEnd,
  dateBillGotCovered,
  resolveCardBillPaid,
  resolveCyclePaid,
  type CardBillPaymentInput,
} from "./billPaidDate.js";

function bill(overrides: Partial<CardBillPaymentInput> = {}): CardBillPaymentInput {
  return {
    amount: 2806.79,
    closingDate: "2026-11-21",
    dueDate: "2026-11-28",
    cardPayments: [],
    checkingPayments: [],
    manualPaidOn: null,
    today: "2026-11-24",
    ...overrides,
  };
}

describe("dateBillGotCovered", () => {
  it("soma pagamentos parciais até cobrir a fatura", () => {
    const payments = [
      { date: "2026-11-30", amount: 1806.79 },
      { date: "2026-11-25", amount: 1000 },
    ];
    assert.equal(dateBillGotCovered(2806.79, "2026-11-21", payments), "2026-11-30");
  });

  it("ignora pagamento de antes do fechamento e o da fatura seguinte", () => {
    const payments = [
      { date: "2026-11-20", amount: 2806.79 },
      { date: "2026-12-28", amount: 2806.79 },
    ];
    assert.equal(dateBillGotCovered(2806.79, "2026-11-21", payments), null);
  });
});

describe("resolveCardBillPaid", () => {
  it("fatura fechada sem pagamento continua aberta, mesmo depois do vencimento", () => {
    assert.equal(resolveCardBillPaid(bill({ today: "2026-11-30" })), null);
  });

  it("usa o crédito de pagamento no cartão", () => {
    const paid = resolveCardBillPaid(bill({ cardPayments: [{ date: "2026-11-26", amount: 2806.79 }] }));
    assert.deepEqual(paid, { paidOn: "2026-11-26", source: "card" });
  });

  it("sem crédito no cartão, usa o débito na conta", () => {
    const paid = resolveCardBillPaid(bill({ checkingPayments: [{ date: "2026-12-01", amount: 2806.79 }] }));
    assert.deepEqual(paid, { paidOn: "2026-12-01", source: "checking" });
  });

  it("a marcação manual vale mais que o extrato", () => {
    const paid = resolveCardBillPaid(
      bill({ manualPaidOn: "2026-11-24", cardPayments: [{ date: "2026-11-26", amount: 2806.79 }] }),
    );
    assert.deepEqual(paid, { paidOn: "2026-11-24", source: "manual" });
  });

  it("supõe paga no vencimento quando passaram dez dias e nada apareceu", () => {
    assert.deepEqual(resolveCardBillPaid(bill({ today: "2026-12-09" })), {
      paidOn: "2026-11-28",
      source: "assumed",
    });
  });
});

describe("resolveCyclePaid", () => {
  it("só fecha quando todas as faturas foram pagas, no dia da última", () => {
    const itau = { paidOn: "2026-11-26", source: "card" as const };
    const nubank = { paidOn: "2026-11-29", source: "checking" as const };
    assert.equal(resolveCyclePaid([itau, null], "2026-11-28", "2026-11-27"), null);
    assert.deepEqual(resolveCyclePaid([itau, nubank], "2026-11-28", "2026-11-30"), nubank);
  });

  it("mês sem fatura fecha no vencimento", () => {
    assert.deepEqual(resolveCyclePaid([], "2026-10-28", "2026-11-24"), {
      paidOn: "2026-10-28",
      source: "assumed",
    });
    assert.equal(resolveCyclePaid([], "2026-12-28", "2026-11-24"), null);
  });
});

describe("cyclePeriodEnd", () => {
  it("termina no pagamento; sem ele, no vencimento ou hoje se já venceu", () => {
    assert.equal(cyclePeriodEnd({ paidOn: "2026-11-26", source: "card" }, "2026-11-28", "2026-11-27"), "2026-11-26");
    assert.equal(cyclePeriodEnd(null, "2026-11-28", "2026-11-24"), "2026-11-28");
    assert.equal(cyclePeriodEnd(null, "2026-11-28", "2026-11-30"), "2026-11-30");
  });
});
