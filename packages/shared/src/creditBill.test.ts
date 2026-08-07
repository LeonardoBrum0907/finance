import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCreditBillSnapshot,
  buildPendingBillPayments,
  isCreditBillAlreadyPaid,
  type CreditBillSnapshot,
} from "./creditBill.js";
import { buildCycleForecastBlock } from "./cycleForecast.js";
import type { TransactionLike } from "./payday.js";

function expenseTx(dateKey: string, amount: number, accountType = "CHECKING"): TransactionLike {
  const [y, m, d] = dateKey.split("-").map(Number);
  return {
    date: new Date(Date.UTC(y!, m! - 1, d!)),
    amount: accountType === "CREDIT" ? amount : -amount,
    accountType,
    category: accountType === "CREDIT" ? "Alimentação" : "Mercado",
    description: "Compra",
  };
}

function salaryTx(dateKey: string, amount: number): TransactionLike {
  const [y, m, d] = dateKey.split("-").map(Number);
  return {
    date: new Date(Date.UTC(y!, m! - 1, d!)),
    amount,
    accountType: "CHECKING",
    category: "Salário",
  };
}

function billPaymentTx(dateKey: string, amount: number): TransactionLike {
  const [y, m, d] = dateKey.split("-").map(Number);
  return {
    date: new Date(Date.UTC(y!, m! - 1, d!)),
    amount: -amount,
    accountType: "CHECKING",
    category: "Pagamento de fatura",
    description: "Pagamento de fatura Nubank",
  };
}

const snapshot: CreditBillSnapshot = {
  accountId: "card-1",
  accountName: "Nubank",
  closedBillAmount: 1200,
  closedBillDueDate: "2026-07-10",
  openBillAmount: 350,
  openBillDueDate: "2026-08-10",
};

describe("buildPendingBillPayments", () => {
  it("includes closed bill when due date is inside the cycle", () => {
    const result = buildPendingBillPayments(
      [snapshot],
      { from: "2026-06-26", to: "2026-07-25" },
      "2026-07-01",
      [],
    );
    assert.equal(result.total, 1200);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]!.kind, "creditBills");
    assert.equal(result.items[0]!.dueDate, "2026-07-10");
  });

  it("excludes bill when due date is outside the cycle", () => {
    const result = buildPendingBillPayments(
      [snapshot],
      { from: "2026-05-26", to: "2026-06-25" },
      "2026-06-01",
      [],
    );
    assert.equal(result.total, 0);
    assert.equal(result.items.length, 0);
  });

  it("includes open bill when its due date falls in the cycle", () => {
    const result = buildPendingBillPayments(
      [snapshot],
      { from: "2026-07-26", to: "2026-08-25" },
      "2026-07-28",
      [],
    );
    assert.equal(result.total, 350);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]!.dueDate, "2026-08-10");
  });

  it("skips bill already paid on checking account", () => {
    const result = buildPendingBillPayments(
      [snapshot],
      { from: "2026-06-26", to: "2026-07-25" },
      "2026-07-12",
      [billPaymentTx("2026-07-10", 1200)],
    );
    assert.equal(result.total, 0);
    assert.equal(result.items.length, 0);
  });
});

describe("isCreditBillAlreadyPaid", () => {
  it("matches payment near due date within tolerance", () => {
    assert.equal(
      isCreditBillAlreadyPaid(1000, "2026-07-10", [billPaymentTx("2026-07-08", 1000)]),
      true,
    );
  });

  it("rejects payment far from due date", () => {
    assert.equal(
      isCreditBillAlreadyPaid(1000, "2026-07-10", [billPaymentTx("2026-06-01", 1000)]),
      false,
    );
  });
});

describe("buildCreditBillSnapshot", () => {
  it("falls back to balance when no closed bill", () => {
    const snap = buildCreditBillSnapshot({
      accountId: "c1",
      accountName: "Inter",
      balance: 800,
      balanceDueDate: "2026-07-15",
      closedBill: null,
    });
    assert.equal(snap.closedBillAmount, 800);
    assert.equal(snap.openBillAmount, null);
  });

  it("keeps open and closed separate when different", () => {
    const snap = buildCreditBillSnapshot({
      accountId: "c1",
      accountName: "Inter",
      balance: 200,
      balanceDueDate: "2026-08-15",
      closedBill: { totalAmount: 900, dueDate: "2026-07-15" },
    });
    assert.equal(snap.closedBillAmount, 900);
    assert.equal(snap.closedBillDueDate, "2026-07-15");
    assert.equal(snap.openBillAmount, 200);
  });
});

describe("creditBills in cycle forecast closing balance", () => {
  it("reduces closingBalance by bill payment without doubling card purchases", () => {
    const paydayDay = 25;
    const txs: TransactionLike[] = [
      salaryTx("2026-05-25", 5000),
      expenseTx("2026-06-05", 800),
      // Compra no cartão já entra em realizedExpenses
      expenseTx("2026-06-20", 150, "CREDIT"),
    ];

    const withoutBill = buildCycleForecastBlock({
      txs,
      cycle: {
        cycleKey: "2026-07-25",
        from: "2026-06-26",
        to: "2026-07-25",
        isComplete: false,
      },
      paydayDay,
      anchor: "end",
      today: "2026-07-01",
      pending: { recurring: 0, installments: 0, simulations: 0 },
    });

    const withBill = buildCycleForecastBlock({
      txs,
      cycle: {
        cycleKey: "2026-07-25",
        from: "2026-06-26",
        to: "2026-07-25",
        isComplete: false,
      },
      paydayDay,
      anchor: "end",
      today: "2026-07-01",
      pending: { recurring: 0, installments: 0, simulations: 0, creditBills: 1200 },
    });

    assert.equal(withBill.expenseBreakdown.creditBills, 1200);
    assert.equal(
      withBill.closingBalance,
      Math.round((withoutBill.closingBalance - 1200) * 100) / 100,
    );
    // Compras no cartão permanecem só em realized — não somam de novo via creditBills
    assert.equal(withBill.realizedExpenses, withoutBill.realizedExpenses);
  });
});
