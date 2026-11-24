import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { intervalProgress, summarizeIntervalFlow } from "./intervalFlow.js";

function tx(amount: number, accountType: string, category: string | null, description = "") {
  return { date: new Date("2026-11-10T15:00:00.000Z"), amount, accountType, category, description };
}

describe("summarizeIntervalFlow", () => {
  it("separa salário de renda extra e soma as compras do cartão", () => {
    const flow = summarizeIntervalFlow([
      tx(3200, "BANK", "Salário"),
      tx(1224.92, "BANK", "Salário"),
      tx(350, "BANK", "Transferências", "PIX RECEBIDO CLIENTE"),
      tx(2806.79, "CREDIT", "Compras"),
      tx(-120, "BANK", "Alimentação"),
    ]);
    assert.deepEqual(flow, {
      income: 4774.92,
      expenses: 2926.79,
      net: 1848.13,
      salary: 4424.92,
      extra: 350,
    });
  });

  it("deixa de fora o pagamento da fatura e o estorno no cartão", () => {
    const flow = summarizeIntervalFlow([
      tx(-2806.79, "BANK", "Pagamento de cartão de crédito", "PAGAMENTO DE FATURA"),
      tx(-50, "CREDIT", "Compras"),
    ]);
    assert.deepEqual(flow, { income: 0, expenses: 0, net: 0, salary: 0, extra: 0 });
  });
});

describe("intervalProgress", () => {
  const period = { from: "2026-10-29", to: "2026-11-30" };

  it("conta o dia de hoje dentro do período", () => {
    assert.deepEqual(intervalProgress(period, "2026-11-24"), {
      daysElapsed: 27,
      daysTotal: 33,
      daysRemaining: 6,
      isPartialPeriod: true,
    });
  });

  it("fora do período não há progresso", () => {
    assert.equal(intervalProgress(period, "2026-12-01"), null);
    assert.equal(intervalProgress(period, "2026-10-28"), null);
  });
});
