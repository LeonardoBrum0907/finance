import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cardChargeDueDateKey,
  selectByCycleDate,
  toBillPaymentDates,
  type CardPaymentCalendar,
} from "./cardPaymentDate.js";
import { getPaydayCycleKey } from "./payday.js";

const card: CardPaymentCalendar = {
  accountId: "cartao",
  billDueDay: 28,
  billCloseDay: 21,
  balanceDueDate: null,
  balanceCloseDate: null,
  statements: [{ dueDate: "2026-10-28", closingDate: "2026-10-21", totalAmount: 1000 }],
};

describe("cardChargeDueDateKey", () => {
  it("usa o mês da fatura informado pela Pluggy", () => {
    assert.equal(cardChargeDueDateKey(card, { date: "2026-11-06", billMonth: "2026-12" }), "2026-12-28");
  });

  it("usa o vencimento real da fatura quando ela já existe", () => {
    const moved = { ...card, statements: [{ dueDate: "2026-11-30", closingDate: null, totalAmount: 1 }] };
    assert.equal(cardChargeDueDateKey(moved, { date: "2026-11-10", billMonth: "2026-11" }), "2026-11-30");
  });

  it("sem mês da fatura, deduz pelo fechamento do cartão", () => {
    assert.equal(cardChargeDueDateKey(card, { date: "2026-11-21" }), "2026-11-28");
    assert.equal(cardChargeDueDateKey(card, { date: "2026-11-22" }), "2026-12-28");
  });
});

describe("toBillPaymentDates", () => {
  const tx = (id: string, date: string, amount: number, accountType: string, billForecastMonth?: string) => ({
    id,
    date: new Date(`${date}T15:00:00.000Z`),
    amount,
    accountId: accountType === "CREDIT" ? "cartao" : "conta",
    accountType,
    billForecastMonth: billForecastMonth ?? null,
  });

  it("move a compra do cartão para o ciclo em que a fatura vence", () => {
    const [compra, pix, estorno] = toBillPaymentDates(
      [
        tx("c", "2026-11-10", 100, "CREDIT", "2026-11"),
        tx("p", "2026-11-10", -50, "BANK"),
        tx("e", "2026-11-10", -20, "CREDIT", "2026-11"),
      ],
      [card],
    );
    assert.equal(compra!.date.toISOString().slice(0, 10), "2026-11-28");
    // Salário no dia 25: a fatura de 28/11 é paga no ciclo que começa em 25/11.
    assert.equal(getPaydayCycleKey(25, "start", compra!.date), "2026-11-25");
    assert.equal(pix!.date.toISOString().slice(0, 10), "2026-11-10");
    assert.equal(estorno!.date.toISOString().slice(0, 10), "2026-11-10");
  });
});

describe("selectByCycleDate", () => {
  const tx = (id: string, date: string, amount: number, accountType: string) => ({
    id,
    date: new Date(`${date}T15:00:00.000Z`),
    amount,
    accountId: accountType === "CREDIT" ? "cartao" : "conta",
    accountType,
    billForecastMonth: null,
  });
  // Período do salário de 25/11 a 24/12; a fatura de novembro vence em 28/11.
  const txs = [
    tx("compra-out", "2026-10-25", 80, "CREDIT"),
    tx("compra-nov", "2026-11-19", 50, "CREDIT"),
    tx("compra-dez", "2026-11-23", 30, "CREDIT"),
    tx("pix", "2026-11-26", -40, "CHECKING"),
    tx("pix-antigo", "2026-11-20", -10, "CHECKING"),
  ];

  it("keeps card purchases whose bill is due in the period, with the purchase date", () => {
    const ids = selectByCycleDate(txs, [card], "2026-11-25", "2026-12-24").map((t) => t.id);
    assert.deepEqual(ids, ["compra-out", "compra-nov", "pix"]);
  });

  it("tells the bill due date of card purchases only", () => {
    const [compra, , pix] = selectByCycleDate(txs, [card], "2026-11-25", "2026-12-24");
    assert.equal(compra!.billDueDate, "2026-11-28");
    assert.equal(compra!.date.toISOString(), "2026-10-25T15:00:00.000Z");
    assert.equal(pix!.billDueDate, null);
  });
});
