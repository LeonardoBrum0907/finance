import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  amountsMatch,
  countMissedRecurringBillingCycles,
  detectRecurringPatterns,
  descriptionLooksLikeInstallment,
  isRecurringBillCandidateTransaction,
  normalizeBillSignature,
  parseInstallmentMarker,
  recurringBillToSimulatedPurchase,
  recurringBillsToSimulatedPurchases,
  shouldDeactivateStaleRecurringBill,
  shouldDismissAutoDetectedBill,
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

  it("does not treat card installments (n/m) as infinite recurring bills", () => {
    const candidates = detectRecurringPatterns([
      {
        id: "t1",
        date: "2026-06-04",
        description: "Nat*Natura Pagamentos 2/3",
        amount: 102.26,
        accountId: "card1",
        accountType: "CREDIT",
        category: "Compras parceladas",
      },
      {
        id: "t2",
        date: "2026-07-04",
        description: "Nat*Natura Pagamentos 3/3",
        amount: 102.26,
        accountId: "card1",
        accountType: "CREDIT",
        category: "Compras parceladas",
      },
    ]);
    assert.equal(candidates.length, 0);
  });

  it("does not collapse irregular church offerings into one monthly bill", () => {
    const candidates = detectRecurringPatterns([
      { id: "a", date: "2026-05-03", description: "Pix enviado PRIMEIRA IGREJA BATISTA DA LAGOINHA EM PAULINIA", amount: -10, accountId: "itau", accountType: "BANK", merchantName: "PRIMEIRA IGREJA BATISTA DA LAGOINHA PAULINIA", category: "Igreja" },
      { id: "b", date: "2026-06-07", description: "Pix enviado PRIMEIRA IGREJA BATISTA DA LAGOINHA EM PAULINIA", amount: -428, accountId: "itau", accountType: "BANK", merchantName: "PRIMEIRA IGREJA BATISTA DA LAGOINHA PAULINIA", category: "Igreja" },
      { id: "c", date: "2026-06-28", description: "Pix enviado PRIMEIRA IGREJA BATISTA DA LAGOINHA EM PAULINIA", amount: -300, accountId: "itau", accountType: "BANK", merchantName: "PRIMEIRA IGREJA BATISTA DA LAGOINHA PAULINIA", category: "Igreja" },
      { id: "d", date: "2026-07-09", description: "Pix enviado PRIMEIRA IGREJA BATISTA DA LAGOINHA EM PAULINIA", amount: -420, accountId: "itau", accountType: "BANK", merchantName: "PRIMEIRA IGREJA BATISTA DA LAGOINHA PAULINIA", category: "Igreja" },
      { id: "e", date: "2026-07-15", description: "Pix enviado PRIMEIRA IGREJA BATISTA DA LAGOINHA EM PAULINIA", amount: -20, accountId: "itau", accountType: "BANK", merchantName: "PRIMEIRA IGREJA BATISTA DA LAGOINHA PAULINIA", category: "Igreja" },
      { id: "f", date: "2026-07-19", description: "Pix enviado PRIMEIRA IGREJA BATISTA DA LAGOINHA EM PAULINIA", amount: -20, accountId: "itau", accountType: "BANK", merchantName: "PRIMEIRA IGREJA BATISTA DA LAGOINHA PAULINIA", category: "Igreja" },
      { id: "g", date: "2026-07-26", description: "Pix enviado PRIMEIRA IGREJA BATISTA DA LAGOINHA EM PAULINIA", amount: -20, accountId: "itau", accountType: "BANK", merchantName: "PRIMEIRA IGREJA BATISTA DA LAGOINHA PAULINIA", category: "Igreja" },
      { id: "h", date: "2026-08-09", description: "Pix enviado PRIMEIRA IGREJA BATISTA DA LAGOINHA EM PAULINIA", amount: -140, accountId: "itau", accountType: "BANK", merchantName: "PRIMEIRA IGREJA BATISTA DA LAGOINHA PAULINIA", category: "Igreja" },
    ]);
    assert.equal(candidates.length, 0);
  });

  it("detects a stable monthly dízimo after 3 similar charges", () => {
    const candidates = detectRecurringPatterns([
      { id: "t1", date: "2026-04-09", description: "Pix enviado IGREJA X", amount: -420, accountId: "itau", accountType: "BANK", category: "Igreja" },
      { id: "t2", date: "2026-05-09", description: "Pix enviado IGREJA X", amount: -420, accountId: "itau", accountType: "BANK", category: "Igreja" },
      { id: "t3", date: "2026-06-09", description: "Pix enviado IGREJA X", amount: -420, accountId: "itau", accountType: "BANK", category: "Igreja" },
    ]);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]!.expectedAmount, 420);
  });

  it("still detects a utility bill with small amount drift", () => {
    const candidates = detectRecurringPatterns([
      { id: "t1", date: "2026-03-17", description: "Conta Vivo", amount: 59, accountId: "card1", accountType: "CREDIT", category: "Telecomunicações" },
      { id: "t2", date: "2026-04-17", description: "Conta Vivo", amount: 64, accountId: "card1", accountType: "CREDIT", category: "Telecomunicações" },
      { id: "t3", date: "2026-05-17", description: "Conta Vivo", amount: 64, accountId: "card1", accountType: "CREDIT", category: "Telecomunicações" },
      { id: "t4", date: "2026-06-18", description: "Conta Vivo", amount: 64, accountId: "card1", accountType: "CREDIT", category: "Telecomunicações" },
    ]);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]!.matchSignature, "CONTA VIVO");
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

describe("parseInstallmentMarker", () => {
  it("parses n/m on merchant strings", () => {
    assert.deepEqual(parseInstallmentMarker("Nat*Natura Pagamentos 2/3"), { current: 2, total: 3 });
    assert.equal(descriptionLooksLikeInstallment("parcela 11/12 Netflix"), true);
  });

  it("ignores calendar dates", () => {
    assert.equal(parseInstallmentMarker("NETFLIX.COM 06/2026"), null);
    assert.equal(parseInstallmentMarker("SPOTIFY 08/06/2026"), null);
  });
});

describe("shouldDismissAutoDetectedBill", () => {
  it("dismisses orphan auto bills whose bank account vanished", () => {
    assert.equal(
      shouldDismissAutoDetectedBill({
        source: "auto_detected",
        accountId: null,
        title: "Dl*Google Google",
      }),
      true,
    );
  });

  it("dismisses installment titles even when an account remains", () => {
    assert.equal(
      shouldDismissAutoDetectedBill({
        source: "auto_detected",
        accountId: "acc1",
        title: "Nat*Natura Pagamentos 2/3",
      }),
      true,
    );
  });

  it("keeps manual bills and ordinary auto bills", () => {
    assert.equal(
      shouldDismissAutoDetectedBill({
        source: "manual",
        accountId: null,
        title: "Aluguel",
      }),
      false,
    );
    assert.equal(
      shouldDismissAutoDetectedBill({
        source: "auto_detected",
        accountId: "acc1",
        title: "NETFLIX.COM",
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
