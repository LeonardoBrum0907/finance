import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dropSupersededPending, staleTransactionIds } from "./pluggyReconcile.js";

describe("dropSupersededPending", () => {
  it("drops a pending salary once the posted one arrives with another id", () => {
    const txs = [
      { id: "p1", date: "2026-11-25", description: "SALARIO EMPRESA X", amount: 1000, status: "PENDING" },
      { id: "c1", date: "2026-11-25", description: "SALARIO", amount: 1000, status: "POSTED" },
      { id: "p2", date: "2026-11-25", description: "13 SALARIO", amount: 500, status: "PENDING" },
      { id: "c2", date: "2026-11-26", description: "13 SALARIO", amount: 500, status: "POSTED" },
    ];
    assert.deepEqual(dropSupersededPending(txs).map((t) => t.id), ["c1", "c2"]);
  });

  it("keeps a pending entry with no posted match", () => {
    const txs = [
      { id: "p1", date: "2026-11-27", description: "MERCADO", amount: -50, status: "PENDING" },
      { id: "c1", date: "2026-11-20", description: "MERCADO", amount: -50, status: "POSTED" },
    ];
    assert.equal(dropSupersededPending(txs).length, 2);
  });

  it("matches each posted entry to one pending entry only", () => {
    const txs = [
      { id: "p1", date: "2026-11-25", description: "CAFE", amount: -10, status: "PENDING" },
      { id: "p2", date: "2026-11-25", description: "CAFE", amount: -10, status: "PENDING" },
      { id: "c1", date: "2026-11-25", description: "CAFE", amount: -10, status: "POSTED" },
    ];
    assert.deepEqual(dropSupersededPending(txs).map((t) => t.id), ["p2", "c1"]);
  });
});

describe("staleTransactionIds", () => {
  const now = new Date("2026-11-27T12:00:00Z");
  const stored = [
    { id: "a", pluggyTransactionId: "old-pending", date: new Date("2026-11-25T12:00:00Z") },
    { id: "b", pluggyTransactionId: "kept", date: new Date("2026-11-25T12:00:00Z") },
    { id: "c", pluggyTransactionId: "ancient", date: new Date("2026-03-01T12:00:00Z") },
  ];

  it("returns recent rows the bank no longer sends", () => {
    assert.deepEqual(staleTransactionIds(stored, new Set(["kept"]), now), ["a"]);
  });

  it("deletes nothing when the bank sent nothing", () => {
    assert.deepEqual(staleTransactionIds(stored, new Set(), now), []);
  });
});
