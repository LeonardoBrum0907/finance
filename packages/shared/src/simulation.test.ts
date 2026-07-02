import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildInstallmentSchedule,
  buildSimulationPaydayCycles,
  computeCreditBillImpacts,
  computePaydayCycleImpacts,
  createSimulatedPurchase,
  normalizeSimulatedPurchase,
} from "./simulation.js";
import { resolveBillForChargeDate, resolveBillingCloseDate, toDateKey } from "./creditBill.js";

describe("createSimulatedPurchase", () => {
  it("creates PIX purchase with single installment on purchase date", () => {
    const purchase = createSimulatedPurchase({
      title: "Mercado",
      paymentMethod: "pix",
      totalAmount: 150,
      purchaseDate: "2026-06-15",
    });

    assert.equal(purchase.paymentMethod, "pix");
    assert.equal(purchase.installments.length, 1);
    assert.equal(purchase.installments[0]!.dueDate, "2026-06-15");
    assert.equal(purchase.installments[0]!.amount, 150);
  });

  it("creates credit single purchase", () => {
    const purchase = createSimulatedPurchase({
      title: "Tênis",
      paymentMethod: "credit_single",
      totalAmount: 300,
      purchaseDate: "2026-06-10",
      creditAccountId: "card-1",
    });

    assert.equal(purchase.paymentMethod, "credit_single");
    assert.equal(purchase.creditAccountId, "card-1");
    assert.equal(purchase.installments.length, 1);
  });

  it("creates credit installments purchase", () => {
    const purchase = createSimulatedPurchase({
      title: "Notebook",
      paymentMethod: "credit_installments",
      totalAmount: 1200,
      purchaseDate: "2026-06-10",
      creditAccountId: "card-1",
      totalInstallments: 3,
      firstDueDate: "2026-07-10",
    });

    assert.equal(purchase.installments.length, 3);
    assert.equal(
      purchase.installments.reduce((s, i) => s + i.amount, 0),
      1200,
    );
  });
});

describe("normalizeSimulatedPurchase", () => {
  it("migrates legacy purchase without paymentMethod", () => {
    const legacy = {
      id: "sim-old",
      title: "Legacy",
      installments: buildInstallmentSchedule({
        totalAmount: 600,
        totalInstallments: 3,
        firstDueDate: "2026-07-01",
        idPrefix: "sim-old",
      }),
      createdAt: "2026-06-01T00:00:00.000Z",
    };

    const normalized = normalizeSimulatedPurchase(legacy);
    assert.equal(normalized.paymentMethod, "credit_installments");
    assert.equal(normalized.totalAmount, 600);
  });
});

describe("computePaydayCycleImpacts", () => {
  it("attributes PIX to realized when due date is today or past", () => {
    const purchase = createSimulatedPurchase({
      title: "PIX",
      paymentMethod: "pix",
      totalAmount: 100,
      purchaseDate: "2026-06-01",
    });

    const impacts = computePaydayCycleImpacts(
      [purchase],
      [{ cycleKey: "2026-06-15", from: "2026-05-16", to: "2026-06-15" }],
      "2026-06-10",
    );

    assert.equal(impacts[0]!.realizedExpenses, 100);
    assert.equal(impacts[0]!.committedExpenses, 0);
  });

  it("attributes future installment to committed expenses", () => {
    const purchase = createSimulatedPurchase({
      title: "Parcelado",
      paymentMethod: "credit_installments",
      totalAmount: 300,
      purchaseDate: "2026-06-01",
      creditAccountId: "card-1",
      totalInstallments: 3,
      firstDueDate: "2026-06-12",
    });

    const impacts = computePaydayCycleImpacts(
      [purchase],
      [{ cycleKey: "2026-06-15", from: "2026-05-16", to: "2026-06-15" }],
      "2026-06-10",
    );

    assert.equal(impacts[0]!.realizedExpenses, 0);
    assert.equal(impacts[0]!.committedExpenses, 100);
  });

  it("projects installments across future cycles", () => {
    const purchase = createSimulatedPurchase({
      title: "Parcelado",
      paymentMethod: "credit_installments",
      totalAmount: 300,
      purchaseDate: "2026-06-01",
      creditAccountId: "card-1",
      totalInstallments: 3,
      firstDueDate: "2026-06-12",
    });

    const cycles = buildSimulationPaydayCycles(
      { cycleKey: "2026-06-15", from: "2026-05-16", to: "2026-06-15" },
      15,
      "end",
      4,
    );

    const impacts = computePaydayCycleImpacts([purchase], cycles, "2026-06-10");
    const withImpact = impacts.filter((c) => c.totalInPeriod > 0);

    assert.ok(withImpact.length >= 2);
    assert.equal(
      withImpact.reduce((s, c) => s + c.totalInPeriod, 0),
      300,
    );
  });
});

describe("computeCreditBillImpacts", () => {
  it("adds credit purchase to open bill", () => {
    const dueDate = new Date("2026-06-20T12:00:00");
    const closeDate = resolveBillingCloseDate(null, dueDate, new Date("2026-06-10T12:00:00"));

    const purchase = createSimulatedPurchase({
      title: "Compra",
      paymentMethod: "credit_single",
      totalAmount: 250,
      purchaseDate: "2026-06-12",
      creditAccountId: "card-1",
    });

    const impacts = computeCreditBillImpacts(
      [purchase],
      [
        {
          id: "card-1",
          name: "Nubank",
          balanceDueDate: toDateKey(dueDate),
          balanceCloseDate: closeDate ? toDateKey(closeDate) : null,
          openBillAmount: 500,
        },
      ],
      "2026-06-12",
    );

    assert.equal(impacts.length, 1);
    assert.equal(impacts[0]!.openBillBefore, 500);
    assert.equal(impacts[0]!.openBillAfter, 750);
  });
});

describe("resolveBillForChargeDate", () => {
  it("assigns charge after close date to open bill", () => {
    const dueDate = new Date("2026-06-20T12:00:00");
    const closeDate = resolveBillingCloseDate(null, dueDate, new Date("2026-06-10T12:00:00"));

    const assignment = resolveBillForChargeDate(
      closeDate ? toDateKey(closeDate) : null,
      toDateKey(dueDate),
      "2026-06-12",
      "2026-06-12",
    );

    assert.equal(assignment.bucket, "open");
  });
});
