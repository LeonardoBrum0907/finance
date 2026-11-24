import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveUnpublishedBills,
  isCardBillPayment,
  summarizeCardBills,
  type CardChargeWithBill,
  type PublishedCardBill,
} from "./cardBillFromCharges.js";

const DAYS = { dueDay: 28, closeDay: 21 };
const TODAY = "2026-11-24";

// Recorte do Itaú em 24/11/2026: a fatura de 21/10 está publicada; a de 21/11 ainda não.
const october: PublishedCardBill = {
  id: "bill-oct",
  dueDate: "2026-10-28",
  closingDate: "2026-10-21",
  totalAmount: 3165.62,
};

function charge(date: string, amount: number, billId: string | null, description = "Compra"): CardChargeWithBill {
  return { date, amount, billId, description, category: null };
}

const charges: CardChargeWithBill[] = [
  charge("2026-10-15", 3165.62, "bill-oct"),
  charge("2026-10-28", -3165.62, "bill-nov", "PAGAMENTO"),
  charge("2026-11-04", 2000, "bill-nov"),
  charge("2026-11-19", 806.79, "bill-nov"),
  charge("2026-11-22", 200, null),
  charge("2026-11-23", 70.93, null),
  charge("2026-12-11", 150.34, null, "Parcela 2/5"),
];

describe("isCardBillPayment", () => {
  it("treats a credit equal to a known bill total as the bill payment", () => {
    assert.equal(isCardBillPayment({ amount: -741.24, description: "Crédito" }, [741.2366]), true);
  });

  it("keeps a refund that matches no bill", () => {
    assert.equal(isCardBillPayment({ amount: -18.49, description: "Estorno 99Food" }, [741.24]), false);
  });

  it("recognizes the Nubank payment description", () => {
    assert.equal(isCardBillPayment({ amount: -100, description: "Pagamento recebido" }, []), true);
  });
});

describe("deriveUnpublishedBills", () => {
  it("sums the closed bill without the previous bill payment", () => {
    const [bill] = deriveUnpublishedBills(charges, [october], DAYS, TODAY);
    assert.deepEqual(bill, {
      billId: "bill-nov",
      closingDate: "2026-11-21",
      dueDate: "2026-11-28",
      totalAmount: 2806.79,
    });
  });

  it("skips a bill group whose closing date has not arrived", () => {
    assert.deepEqual(deriveUnpublishedBills(charges, [october], DAYS, "2026-11-20"), []);
  });

  it("skips bills the Pluggy already published", () => {
    const published = [october, { ...october, id: "bill-nov", dueDate: "2026-11-28", closingDate: "2026-11-21" }];
    assert.deepEqual(deriveUnpublishedBills(charges, published, DAYS, TODAY), []);
  });
});

describe("summarizeCardBills", () => {
  const derived = deriveUnpublishedBills(charges, [october], DAYS, TODAY);

  it("returns the latest closed bill and the charges after it", () => {
    assert.deepEqual(summarizeCardBills([october, ...derived], charges, DAYS, TODAY), {
      closedBillAmount: 2806.79,
      closedBillDueDate: "2026-11-28",
      closedBillClosingDate: "2026-11-21",
      openBillAmount: 270.93,
      openBillDueDate: "2026-12-28",
    });
  });

  it("falls back to the published bill when nothing was derived", () => {
    const summary = summarizeCardBills([october], charges, DAYS, TODAY);
    assert.equal(summary.closedBillAmount, 3165.62);
  });

  it("returns nulls without any closed bill", () => {
    assert.equal(summarizeCardBills([], charges, DAYS, TODAY).closedBillAmount, null);
  });
});
