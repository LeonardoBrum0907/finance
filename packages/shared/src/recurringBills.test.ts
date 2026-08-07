import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  amountsMatch,
  countMissedRecurringBillingCycles,
  detectRecurringPatterns,
  isRecurringBillCandidateTransaction,
  normalizeBillSignature,
  recurringBillToSimulatedPurchase,
  recurringBillsToSimulatedPurchases,
  shouldDeactivateStaleRecurringBill,
} from "./recurringBills.js";

describe("normalizeBillSignature", () => {
  it("normalizes description removing numbers and punctuation", () => {
    const sig = normalizeBillSignature("NETFLIX.COM 06/2026", null);
    assert.equal(sig, "NETFLIX COM");
  });

  it("prefers merchant name when provided", () => {
    const sig = normalizeBillSignature("COMPRA CARTAO", "Spotify");
    assert.equal(sig, "SPOTIFY");
  });
});

describe("amountsMatch", () => {
  it("matches within 15% tolerance", () => {
    assert.equal(amountsMatch(100, 110), true);
    assert.equal(amountsMatch(100, 120), false);
  });

  it("uses minimum R$5 tolerance for small amounts", () => {
    assert.equal(amountsMatch(10, 14), true);
    assert.equal(amountsMatch(10, 16), false);
  });
});

describe("detectRecurringPatterns", () => {
  it("detects monthly pattern with 2 occurrences", () => {
    const candidates = detectRecurringPatterns([
      {
        id: "t1",
        date: "2026-04-05",
        description: "NETFLIX.COM",
        amount: -55.9,
        accountId: "acc1",
        personId: "p1",
      },
      {
        id: "t2",
        date: "2026-05-05",
        description: "NETFLIX.COM",
        amount: -55.9,
        accountId: "acc1",
        personId: "p1",
      },
    ]);

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]!.matchSignature, "NETFLIX COM");
    assert.equal(candidates[0]!.expectedAmount, 55.9);
    assert.equal(candidates[0]!.transactions.length, 2);
  });

  it("ignores non-monthly intervals", () => {
    const candidates = detectRecurringPatterns([
      {
        id: "t1",
        date: "2026-04-05",
        description: "LOJA X",
        amount: -100,
        accountId: "acc1",
      },
      {
        id: "t2",
        date: "2026-04-20",
        description: "LOJA X",
        amount: -100,
        accountId: "acc1",
      },
    ]);
    assert.equal(candidates.length, 0);
  });

  it("ignores inflows on bank account", () => {
    const candidates = detectRecurringPatterns([
      {
        id: "t1",
        date: "2026-04-05",
        description: "SALARIO",
        amount: 5000,
        accountId: "acc1",
      },
      {
        id: "t2",
        date: "2026-05-05",
        description: "SALARIO",
        amount: 5000,
        accountId: "acc1",
      },
    ]);
    assert.equal(candidates.length, 0);
  });

  it("detects credit card subscription charges (positive amounts)", () => {
    const candidates = detectRecurringPatterns([
      {
        id: "t1",
        date: "2026-04-11",
        description: "Disney PlusSAO PAULOBRA",
        amount: 66.9,
        accountId: "card1",
        accountType: "CREDIT",
        category: "Serviços digitais",
      },
      {
        id: "t2",
        date: "2026-05-11",
        description: "Disney PlusSAO PAULOBRA",
        amount: 66.9,
        accountId: "card1",
        accountType: "CREDIT",
        category: "Serviços digitais",
      },
    ]);

    assert.equal(candidates.length, 1);
    assert.match(candidates[0]!.title, /Disney/i);
  });

  it("excludes credit card bill payments from bank account", () => {
    const candidates = detectRecurringPatterns([
      {
        id: "t1",
        date: "2026-04-05",
        description: "Pagamento de fatura",
        amount: -692.36,
        accountId: "bank1",
        accountType: "BANK",
        category: "Pagamento de cartão de crédito",
      },
      {
        id: "t2",
        date: "2026-05-05",
        description: "Pagamento de fatura FATURA PAGA ITAU",
        amount: -700,
        accountId: "bank1",
        accountType: "BANK",
        category: "Pagamento de cartão de crédito",
      },
    ]);
    assert.equal(candidates.length, 0);
  });

  it("excludes debit one-off purchases with only 2 occurrences", () => {
    const candidates = detectRecurringPatterns([
      {
        id: "t1",
        date: "2026-04-05",
        description: "Compra no débito|CANTINA NUTRIVIDA",
        amount: -9,
        accountId: "bank1",
        accountType: "BANK",
        category: "Alimentação e bebidas",
      },
      {
        id: "t2",
        date: "2026-05-05",
        description: "Compra no débito|CANTINA NUTRIVIDA",
        amount: -9,
        accountId: "bank1",
        accountType: "BANK",
        category: "Alimentação e bebidas",
      },
    ]);
    assert.equal(candidates.length, 0);
  });
});

describe("isRecurringBillCandidateTransaction", () => {
  it("rejects bill payment", () => {
    assert.equal(
      isRecurringBillCandidateTransaction({
        id: "1",
        date: "2026-05-01",
        description: "Pagamento de fatura",
        amount: -100,
        accountId: "a",
        accountType: "BANK",
        category: "Pagamento de cartão de crédito",
      }),
      false,
    );
  });
});

describe("countMissedRecurringBillingCycles", () => {
  it("returns 0 before the next due date", () => {
    assert.equal(countMissedRecurringBillingCycles("2026-02-11", 11, "2026-03-10"), 0);
  });

  it("counts one missed cycle after due date passes", () => {
    assert.equal(countMissedRecurringBillingCycles("2026-02-11", 11, "2026-03-12"), 1);
  });

  it("counts multiple missed cycles for cancelled subscriptions", () => {
    assert.equal(countMissedRecurringBillingCycles("2026-02-11", 11, "2026-07-12"), 5);
  });
});

describe("shouldDeactivateStaleRecurringBill", () => {
  it("deactivates auto-detected bills after 2 missed cycles", () => {
    assert.equal(
      shouldDeactivateStaleRecurringBill({
        status: "active",
        source: "auto_detected",
        dayOfMonth: 11,
        lastPaidDateKey: "2026-02-11",
        today: "2026-04-12",
      }),
      true,
    );
  });

  it("keeps active bills with only one missed cycle", () => {
    assert.equal(
      shouldDeactivateStaleRecurringBill({
        status: "active",
        source: "auto_detected",
        dayOfMonth: 11,
        lastPaidDateKey: "2026-02-11",
        today: "2026-03-12",
      }),
      false,
    );
  });

  it("does not auto-deactivate manual bills", () => {
    assert.equal(
      shouldDeactivateStaleRecurringBill({
        status: "active",
        source: "manual",
        dayOfMonth: 11,
        lastPaidDateKey: "2026-02-11",
        today: "2026-07-12",
      }),
      false,
    );
  });
});

describe("recurringBillToSimulatedPurchase", () => {
  it("converts bill occurrences to simulated purchase", () => {
    const purchase = recurringBillToSimulatedPurchase({
      id: "bill1",
      title: "Netflix",
      expectedAmount: 55.9,
      dayOfMonth: 5,
      occurrences: [
        { id: "o1", dueDate: "2026-06-05", amount: 55.9, status: "paid" },
        { id: "o2", dueDate: "2026-07-05", amount: 55.9, status: "pending" },
      ],
    });

    assert.equal(purchase.id, "bill1");
    assert.equal(purchase.installments.length, 2);
    assert.equal(purchase.paymentMethod, "pix");
  });

  it("aggregates multiple bills", () => {
    const purchases = recurringBillsToSimulatedPurchases([
      {
        id: "b1",
        title: "Netflix",
        expectedAmount: 50,
        dayOfMonth: 5,
        occurrences: [{ id: "o1", dueDate: "2026-06-05", amount: 50, status: "pending" }],
      },
      {
        id: "b2",
        title: "Spotify",
        expectedAmount: 30,
        dayOfMonth: 10,
        occurrences: [{ id: "o2", dueDate: "2026-06-10", amount: 30, status: "pending" }],
      },
    ]);
    assert.equal(purchases.length, 2);
  });
});
