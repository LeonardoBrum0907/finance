import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectRecurringPatterns, type RecurringPatternTransaction } from "./recurringBills.js";
import { findMonthlyTotalChain } from "./variableRecurringBills.js";

function card(
  id: string,
  date: string,
  description: string,
  amount: number,
  category: string,
): RecurringPatternTransaction {
  return { id, date, description, amount, accountId: "itau", accountType: "CREDIT", category };
}

const SUB = "ANTHROPIC* CLAUDE SUBSAN FRANCISCOUSA";
const IOF = "IOF INTERNACIONAL - ANTHROPIC";

/** Cobranças reais do cartão Itaú do Léo (out e nov/2026), dois planos alternando. */
const ANTHROPIC_CHARGES: RecurringPatternTransaction[] = [
  card("s1", "2026-10-01", SUB, 116.9, "Transfers"),
  card("i1", "2026-10-01", IOF, 4.09, "Impostos"),
  card("s2", "2026-10-06", SUB, 483.55, "Transfers"),
  card("i2", "2026-10-06", IOF, 16.92, "Impostos"),
  card("s3", "2026-11-06", SUB, 116.2, "Transfers"),
  card("i3", "2026-11-06", IOF, 4.07, "Impostos"),
  card("s4", "2026-11-18", SUB, 514.73, "Transfers"),
  card("i4", "2026-11-18", IOF, 18.02, "Impostos"),
];

function summarize(txs: RecurringPatternTransaction[]) {
  return detectRecurringPatterns(txs)
    .map((c) => ({ signature: c.matchSignature, amount: c.expectedAmount, day: c.dayOfMonth, months: c.monthTotals }))
    .sort((a, b) => a.signature.localeCompare(b.signature));
}

describe("assinatura de valor variável", () => {
  it("soma os dois planos da Anthropic no mês e separa o IOF", () => {
    assert.deepEqual(summarize(ANTHROPIC_CHARGES), [
      {
        signature: "ANTHROPIC CLAUDE SUB",
        amount: 630.93,
        day: 18,
        months: { "2026-10": 600.45, "2026-11": 630.93 },
      },
      {
        signature: "IOF ANTHROPIC",
        amount: 22.09,
        day: 18,
        months: { "2026-10": 21.01, "2026-11": 22.09 },
      },
    ]);
  });

  it("dá o mesmo resultado em qualquer ordem das transações", () => {
    const reversed = [...ANTHROPIC_CHARGES].reverse();
    assert.deepEqual(summarize(reversed), summarize(ANTHROPIC_CHARGES));
  });

  it("acompanha o mês em que só um plano foi cobrado", () => {
    const txs = [
      card("a", "2026-09-05", SUB, 116.9, "Transfers"),
      card("b", "2026-10-05", SUB, 514.73, "Transfers"),
      card("c", "2026-11-05", SUB, 116.2, "Transfers"),
    ];
    const [bill] = detectRecurringPatterns(txs);
    assert.equal(bill?.expectedAmount, 116.2);
    assert.deepEqual(bill?.monthTotals, { "2026-09": 116.9, "2026-10": 514.73, "2026-11": 116.2 });
  });

  it("mantém a conta de valor estável sem total por mês", () => {
    const txs = [
      card("a", "2026-09-10", "NETFLIX.COM", 55.9, "Serviços digitais"),
      card("b", "2026-10-10", "NETFLIX.COM", 55.9, "Serviços digitais"),
      card("c", "2026-11-10", "NETFLIX.COM", 55.9, "Serviços digitais"),
    ];
    const [bill] = detectRecurringPatterns(txs);
    assert.equal(bill?.expectedAmount, 55.9);
    assert.equal(bill?.monthTotals, undefined);
  });
});

describe("findMonthlyTotalChain", () => {
  it("recusa mercado, mesmo com poucas compras por mês", () => {
    const txs = [
      card("a", "2026-10-03", "SUPERMERCADO X", 80, "Mercado"),
      card("b", "2026-11-04", "SUPERMERCADO X", 310, "Mercado"),
    ];
    assert.equal(findMonthlyTotalChain(txs), null);
  });

  it("recusa PIX da conta corrente para pessoas", () => {
    const txs = [
      { ...card("a", "2026-10-03", "PIX ENVIADO FULANO", 80, "Transferência - PIX"), accountType: "BANK" },
      { ...card("b", "2026-11-04", "PIX ENVIADO FULANO", 310, "Transferência - PIX"), accountType: "BANK" },
    ];
    assert.equal(findMonthlyTotalChain(txs), null);
  });

  it("quebra a sequência num mês com mais de duas cobranças", () => {
    const txs = [
      card("a", "2026-09-01", "APP STORE", 10, "Assinaturas"),
      card("b", "2026-10-01", "APP STORE", 10, "Assinaturas"),
      card("c", "2026-10-09", "APP STORE", 20, "Assinaturas"),
      card("d", "2026-10-20", "APP STORE", 30, "Assinaturas"),
      card("e", "2026-11-01", "APP STORE", 10, "Assinaturas"),
    ];
    assert.equal(findMonthlyTotalChain(txs), null);
  });

  it("exige meses seguidos", () => {
    const txs = [
      card("a", "2026-08-01", SUB, 116.9, "Transfers"),
      card("b", "2026-10-01", SUB, 514.73, "Transfers"),
    ];
    assert.equal(findMonthlyTotalChain(txs), null);
  });
});
