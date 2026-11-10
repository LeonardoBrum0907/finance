import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectRecurringPatterns,
  isRecurringBillCandidateTransaction,
  normalizeBillSignature,
  parseInstallmentMarker,
  type RecurringPatternTransaction,
} from "./recurringBills.js";
import { groupCardInstallmentSeries } from "./cardInstallments.js";

function card(
  id: string,
  date: string,
  description: string,
  amount: number,
  category = "Serviços digitais",
): RecurringPatternTransaction {
  return { id, date, description, amount, accountId: "card1", accountType: "CREDIT", category };
}

function bank(
  id: string,
  date: string,
  description: string,
  amount: number,
  category = "Transferência - PIX",
): RecurringPatternTransaction {
  return { id, date, description, amount, accountId: "bank1", accountType: "BANK", category };
}

describe("normalizeBillSignature (descritores do mesmo serviço)", () => {
  it("drops payment processor prefixes", () => {
    assert.equal(normalizeBillSignature("Ppro *Streamy"), "STREAMY");
    assert.equal(normalizeBillSignature("DL          *RideAppSao PauloBRA"), "RIDEAPP");
  });

  it("collapses repeated words", () => {
    assert.equal(normalizeBillSignature("Streamy*Streamy"), "STREAMY");
  });

  it("ignores the city glued to a long card merchant name", () => {
    const a = normalizeBillSignature("SOFTWARE TOOLS ACME INCSAN FRANCISCOUSA");
    const b = normalizeBillSignature("SOFTWARE TOOLS ACME INCNEW YORKUSA");
    assert.equal(a, b);
    assert.equal(normalizeBillSignature("ACME CLOUD HOSTING LTDAPORTLANDUSA"), "ACME CLOUD HOSTING LTD");
  });

  it("keeps international IOF apart from the purchase", () => {
    assert.equal(
      normalizeBillSignature("IOF INTERNACIONAL - ACME* AI SUBSAN FRANCISCOUSA"),
      "IOF ACME AI SUB",
    );
  });
});

describe("detectRecurringPatterns (falsos negativos corrigidos)", () => {
  it("bridges one missing month and keeps the latest charge", () => {
    const candidates = detectRecurringPatterns([
      card("t1", "2026-06-08", "Dl*Streamy Video", 19.9),
      card("t2", "2026-07-08", "Dl*Streamy Video", 19.9),
      card("t3", "2026-09-08", "Dl*Streamy Video", 19.9),
      card("t4", "2026-10-08", "Dl*Streamy Video", 19.9),
    ]);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]!.transactions.length, 4);
    assert.equal(candidates[0]!.transactions.at(-1)!.id, "t4");
    assert.equal(candidates[0]!.dayOfMonth, 8);
  });

  it("prefers the most recent chain when two chains tie", () => {
    const candidates = detectRecurringPatterns([
      card("a1", "2026-03-10", "Streamy", 12),
      card("a2", "2026-04-10", "Streamy", 12),
      card("b1", "2026-08-10", "Streamy", 12),
      card("b2", "2026-09-10", "Streamy", 12),
    ]);
    assert.equal(candidates.length, 1);
    assert.deepEqual(candidates[0]!.transactions.map((t) => t.id), ["b1", "b2"]);
  });

  it("merges descriptor variants of the same service", () => {
    const candidates = detectRecurringPatterns([
      card("t1", "2026-05-10", "Streamy*Streamy", 12),
      card("t2", "2026-06-10", "Streamy*Streamy", 12),
      card("t3", "2026-07-10", "Streamy*Streamy", 12),
      card("t4", "2026-08-10", "Ppro *Streamy", 12),
      card("t5", "2026-09-10", "Streamy*Store", 12),
      card("t6", "2026-09-20", "Streamy*Store", 59.9),
    ]);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]!.matchSignature, "STREAMY");
    assert.deepEqual(candidates[0]!.transactions.map((t) => t.id), ["t1", "t2", "t3", "t4", "t5"]);
  });

  it("does not merge a different product of the same brand", () => {
    const candidates = detectRecurringPatterns([
      card("g1", "2026-05-22", "Dl*Brand Brand", 9.99),
      card("g2", "2026-06-22", "Dl*Brand Brand", 9.99),
      card("m1", "2026-05-20", "Brand Maps", 5.99),
      card("m2", "2026-06-20", "Brand Maps", 5.99),
    ]);
    assert.equal(candidates.length, 2);
  });

  it("accepts a card charge 37 days after the previous one", () => {
    const candidates = detectRecurringPatterns([
      card("t1", "2026-10-01", "ACME* AI SUBSAN FRANCISCOUSA", 116.9, "Transferências"),
      card("t2", "2026-11-07", "ACME* AI SUBSAN FRANCISCOUSA", 116.2, "Transferências"),
    ]);
    assert.equal(candidates.length, 1);
  });

  it("detects the card plan fee and international IOF", () => {
    const fee = [
      card("f1", "2026-06-08", "Mensalidade - Plano do cartão", 19.9, "Pagamento de cartão de crédito"),
      card("f2", "2026-07-08", "Mensalidade - Plano do cartão", 19.9, "Pagamento de cartão de crédito"),
    ];
    const iof = [
      card("i1", "2026-06-19", "IOF INTERNACIONAL - ACME* AI SUBSAN FRANCISCOUSA", 4.02, "IOF"),
      card("i2", "2026-07-19", "IOF INTERNACIONAL - ACME* AI SUBSAN FRANCISCOUSA", 4.04, "IOF"),
    ];
    const candidates = detectRecurringPatterns([...fee, ...iof]);
    assert.equal(candidates.length, 2);
    assert.ok(candidates.some((c) => c.title.startsWith("IOF - ")));
  });

  it("still ignores revolving-credit interest and generic IOF", () => {
    for (const description of ["JUROS DE MORA", "ENCARGOS REFINANCIAMENTO", "IOF"]) {
      assert.equal(
        isRecurringBillCandidateTransaction(
          card("x", "2026-06-08", description, 10, "Custos de atraso e cheque especial"),
        ),
        false,
      );
    }
  });

  it("detects a stable monthly PIX to a third party after 3 months", () => {
    const candidates = detectRecurringPatterns([
      bank("p1", "2026-06-25", "Pix enviado FULANO DE TAL", -1100),
      bank("p2", "2026-07-24", "Pix enviado FULANO DE TAL", -1000),
      bank("p3", "2026-08-25", "Pix enviado FULANO DE TAL", -1000),
    ]);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]!.expectedAmount, 1000);
  });

  it("keeps a fee whose billing date moved 44 days", () => {
    const candidates = detectRecurringPatterns([
      card("f1", "2026-06-08", "Mensalidade - Plano do cartão", 19.9, "Pagamento de cartão de crédito"),
      card("f2", "2026-07-08", "Mensalidade - Plano do cartão", 19.9, "Pagamento de cartão de crédito"),
      card("f3", "2026-08-08", "Mensalidade - Plano do cartão", 19.9, "Pagamento de cartão de crédito"),
      card("f4", "2026-09-21", "Mensalidade - Plano do cartão", 19.9, "Pagamento de cartão de crédito"),
      card("f5", "2026-10-21", "Mensalidade - Plano do cartão", 19.9, "Pagamento de cartão de crédito"),
    ]);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]!.transactions.at(-1)!.id, "f5");
  });

  it("does not bridge a gap for everyday spending", () => {
    const candidates = detectRecurringPatterns([
      card("g1", "2026-08-08", "POSTO EXEMPLO", 50, "Postos de gasolina"),
      card("g2", "2026-09-12", "POSTO EXEMPLO", 50, "Postos de gasolina"),
      card("g3", "2026-11-08", "POSTO EXEMPLO", 50, "Postos de gasolina"),
    ]);
    assert.equal(candidates.length, 0);
  });

  it("needs 3 stable months before a PIX becomes a fixed bill", () => {
    assert.equal(
      detectRecurringPatterns([
        bank("p1", "2026-06-25", "Pix enviado FULANO DE TAL", -1000),
        bank("p2", "2026-07-24", "Pix enviado FULANO DE TAL", -1000),
      ]).length,
      0,
    );
    assert.equal(
      detectRecurringPatterns([
        bank("p1", "2026-07-08", "Pix enviado CICLANO", -1100),
        bank("p2", "2026-08-08", "Pix enviado CICLANO", -600),
        bank("p3", "2026-09-08", "Pix enviado CICLANO", -865),
      ]).length,
      0,
    );
  });

  it("keeps own-account transfers and card-paid PIX legs out", () => {
    assert.equal(
      isRecurringBillCandidateTransaction(
        bank("s", "2026-06-25", "Pix enviado FULANO", -100, "Transferência mesma titularidade"),
      ),
      false,
    );
    assert.equal(
      isRecurringBillCandidateTransaction(
        bank("c", "2026-06-25", "Pix enviado com cartão LOJA X", -100),
      ),
      false,
    );
    assert.equal(
      isRecurringBillCandidateTransaction(
        bank("i", "2026-06-25", "Transferência interna", -100, "Transferência - Interna"),
      ),
      false,
    );
  });
});

describe("parseInstallmentMarker (marcador colado)", () => {
  it("reads a marker glued to letters", () => {
    assert.deepEqual(parseInstallmentMarker("LOJA EXEMPLO BA01/03"), { current: 1, total: 3 });
  });
});

describe("groupCardInstallmentSeries", () => {
  const tx = (id: string, date: string, description: string, amount: number) => ({
    id,
    date,
    description,
    amount,
    accountId: "card1",
    accountType: "CREDIT",
  });

  it("groups the installments of one purchase", () => {
    const series = groupCardInstallmentSeries([
      tx("h1", "2026-09-05", "Loja Exemplo 1/3", 463.87),
      tx("h2", "2026-10-04", "Loja Exemplo 2/3", 463.85),
      tx("h3", "2026-11-06", "Loja Exemplo 3/3", 463.85),
      tx("x", "2026-09-05", "Outra Loja", 50),
    ]);
    assert.equal(series.length, 1);
    assert.equal(series[0]!.totalInstallments, 3);
    assert.deepEqual([...series[0]!.slots.keys()], [1, 2, 3]);
    assert.equal(series[0]!.title, "Loja Exemplo");
  });

  it("keeps two identical purchases on the same day apart", () => {
    const series = groupCardInstallmentSeries([
      tx("a1", "2026-04-21", "EVENTO EXEMPLO BA01/03", 283.34),
      tx("b1", "2026-04-21", "EVENTO EXEMPLO BA01/03", 283.34),
      tx("a3", "2026-07-15", "EVENTO EXEMPLO BA03/03", 283.33),
      tx("b3", "2026-07-15", "EVENTO EXEMPLO BA03/03", 283.33),
    ]);
    assert.equal(series.length, 2);
    for (const plan of series) assert.deepEqual([...plan.slots.keys()], [1, 3]);
  });

  it("joins installments whose posting dates drift", () => {
    const series = groupCardInstallmentSeries([
      tx("a2", "2026-04-21", "EVENTO EXEMPLO BA02/03", 283.33),
      tx("a1", "2026-04-21", "EVENTO EXEMPLO BA01/03", 283.34),
      tx("a3", "2026-07-15", "EVENTO EXEMPLO BA03/03", 283.33),
    ]);
    assert.equal(series.length, 1);
    assert.deepEqual([...series[0]!.slots.keys()].sort(), [1, 2, 3]);
  });

  it("starts a new series for a later purchase of the same item", () => {
    const series = groupCardInstallmentSeries([
      tx("a1", "2026-01-10", "Loja Exemplo 1/2", 100),
      tx("a2", "2026-02-10", "Loja Exemplo 2/2", 100),
      tx("b1", "2026-06-10", "Loja Exemplo 1/2", 100),
    ]);
    assert.equal(series.length, 2);
  });

  it("ignores bank-account dates that look like n/m", () => {
    const series = groupCardInstallmentSeries([
      { ...tx("d", "2026-08-05", "PIX ALUGUEL 05/08", -1500), accountType: "BANK" },
    ]);
    assert.equal(series.length, 0);
  });
});
