import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleManagedAccountForBillCycles, type ManagedAccountForSimulation } from "./managedAccounts";

const today = "2026-11-26";
const cards = ["card-a", "card-b"];

function planned(payload: ManagedAccountForSimulation["simulationPayload"]): ManagedAccountForSimulation {
  return {
    id: "sim-1",
    title: "Compra planejada",
    kind: "simulation",
    simulationType: payload!.type,
    simulationPayload: payload,
    expectedAmount: payload!.amount,
    totalInstallments: null,
    entries: [],
  };
}

test("compra planejada no Pix para hoje sai do caixa", () => {
  const { cash, card } = scheduleManagedAccountForBillCycles(
    planned({ type: "single_purchase", amount: 300, paymentMethodDetail: "pix", purchaseDate: today }),
    { today, cardAccountIds: cards },
  );
  assert.equal(card.length, 0);
  assert.deepEqual(cash.map((c) => [c.date, c.amount]), [[today, 300]]);
});

test("compra planejada no cartão vai para a fatura do cartão escolhido", () => {
  const { cash, card } = scheduleManagedAccountForBillCycles(
    planned({
      type: "single_purchase",
      amount: 500,
      paymentMethodDetail: "credit_single",
      creditAccountId: "card-b",
      purchaseDate: today,
    }),
    { today, cardAccountIds: cards },
  );
  assert.equal(cash.length, 0);
  assert.equal(card.length, 1);
  assert.equal(card[0]!.cardAccountId, "card-b");
  assert.equal(card[0]!.billMonth, null);
});

test("parcelada no cartão gera uma cobrança por mês, no primeiro cartão se nenhum foi escolhido", () => {
  const { card } = scheduleManagedAccountForBillCycles(
    planned({
      type: "installments",
      amount: 1200,
      installments: 3,
      totalInstallments: 3,
      paymentMethodDetail: "credit_installments",
      purchaseDate: today,
      firstDueDate: today,
    }),
    { today, cardAccountIds: cards },
  );
  assert.equal(card.length, 3);
  assert.ok(card.every((c) => c.cardAccountId === "card-a"));
  assert.equal(Math.round(card.reduce((sum, c) => sum + c.amount, 0)), 1200);
  assert.deepEqual(card.map((c) => c.date.slice(0, 7)), ["2026-11", "2026-12", "2027-01"]);
});

test("conta fixa de hoje não entra no caixa (pode já ter saído)", () => {
  const { cash } = scheduleManagedAccountForBillCycles(
    {
      id: "fix-1",
      title: "Conta fixa",
      kind: "fixed_recurring",
      simulationType: null,
      simulationPayload: null,
      expectedAmount: 100,
      totalInstallments: null,
      entries: [
        { id: "e1", dueDate: today, amount: 100, status: "pending" },
        { id: "e2", dueDate: "2026-12-10", amount: 100, status: "pending" },
      ],
    },
    { today, cardAccountIds: cards },
  );
  assert.deepEqual(cash.map((c) => c.date), ["2026-12-10"]);
});
