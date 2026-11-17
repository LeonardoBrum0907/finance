import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cardChargeDueDateKey, toBillPaymentDates, type CardPaymentCalendar } from "./cardPaymentDate.js";
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
