import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeAggregateCycleImpact,
  payloadToSimulatedPurchase,
  scenariosToSimulatedPurchases,
  simulatedPurchaseInputToPayload,
  suggestTransactionMatches,
} from "./simulationScenario.js";

describe("simulatedPurchaseInputToPayload", () => {
  it("maps installment purchase to installments type", () => {
    const payload = simulatedPurchaseInputToPayload({
      title: "TV",
      paymentMethod: "credit_installments",
      totalAmount: 1200,
      purchaseDate: "2026-06-01",
      creditAccountId: "acc1",
      totalInstallments: 6,
      firstDueDate: "2026-07-01",
    });
    assert.equal(payload.type, "installments");
    assert.equal(payload.amount, 1200);
    assert.equal(payload.paymentMethodDetail, "credit_installments");
  });
});

describe("payloadToSimulatedPurchase", () => {
  it("creates recurring expense installments", () => {
    const purchase = payloadToSimulatedPurchase("s1", {
      type: "recurring_expense",
      name: "Assinatura",
      amount: 50,
      durationMonths: 3,
      purchaseDate: "2026-06-01",
    });
    assert.ok(purchase);
    assert.equal(purchase!.installments.length, 3);
    assert.equal(purchase!.installments[0]!.amount, 50);
  });

  it("creates monthly invest outflows", () => {
    const purchase = payloadToSimulatedPurchase("s2", {
      type: "invest",
      name: "Tesouro",
      amount: 200,
      investMode: "monthly",
      durationMonths: 2,
      purchaseDate: "2026-06-01",
    });
    assert.ok(purchase);
    assert.equal(purchase!.installments.length, 2);
  });
});

describe("computeAggregateCycleImpact", () => {
  it("aggregates multiple scenarios per cycle", () => {
    const scenarios = [
      {
        id: "a",
        name: "Compra A",
        type: "single_purchase" as const,
        payload: {
          type: "single_purchase" as const,
          amount: 100,
          purchaseDate: "2026-06-01",
          paymentMethodDetail: "pix" as const,
        },
      },
      {
        id: "b",
        name: "Compra B",
        type: "single_purchase" as const,
        payload: {
          type: "single_purchase" as const,
          amount: 50,
          purchaseDate: "2026-06-02",
          paymentMethodDetail: "pix" as const,
        },
      },
    ];

    const result = computeAggregateCycleImpact({
      scenarios,
      cycles: [{ cycleKey: "2026-06", from: "2026-06-01", to: "2026-06-30" }],
      today: "2026-06-15",
      baselineSurplus: 1000,
    });

    assert.equal(result.cycleImpacts[0]!.totalInPeriod, 150);
    assert.equal(result.monthlyPoints[0]!.scenarioSurplus, 850);
    assert.equal(result.scenarioBreakdown[0]!.length, 2);
  });
});

describe("suggestTransactionMatches", () => {
  it("ranks exact amount and date highest", () => {
    const matches = suggestTransactionMatches(
      {
        type: "single_purchase",
        amount: 500,
        name: "Notebook",
        purchaseDate: "2026-06-10",
      },
      [
        {
          id: "tx1",
          date: "2026-06-10",
          description: "Notebook Dell",
          amount: -500,
          accountName: "Nubank",
        },
        {
          id: "tx2",
          date: "2026-05-01",
          description: "Outro",
          amount: -500,
          accountName: "Itaú",
        },
      ],
    );

    assert.equal(matches[0]!.transactionId, "tx1");
    assert.ok(matches[0]!.score > 0);
    assert.ok(matches[0]!.reasons.length > 0);
  });
});

describe("scenariosToSimulatedPurchases", () => {
  it("builds purchases from scenario payloads", () => {
    const purchases = scenariosToSimulatedPurchases([
      {
        id: "x",
        payload: { type: "single_purchase", amount: 10, purchaseDate: "2026-06-01" },
      },
    ]);
    assert.equal(purchases.length, 1);
  });
});
