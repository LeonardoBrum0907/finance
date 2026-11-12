import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SYNC_INTERVAL_HOURS,
  isConnectionSyncDue,
  parseSyncIntervalHours,
} from "./syncSchedule.js";

const now = new Date("2026-01-15T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

describe("isConnectionSyncDue", () => {
  it("sincroniza conexão que nunca foi sincronizada", () => {
    assert.equal(isConnectionSyncDue({ lastSyncedAt: null, now, intervalHours: 6 }), true);
  });

  it("respeita o intervalo desde a última sync", () => {
    assert.equal(isConnectionSyncDue({ lastSyncedAt: hoursAgo(5), now, intervalHours: 6 }), false);
    assert.equal(isConnectionSyncDue({ lastSyncedAt: hoursAgo(6), now, intervalHours: 6 }), true);
    assert.equal(
      isConnectionSyncDue({ lastSyncedAt: hoursAgo(7).toISOString(), now, intervalHours: 6 }),
      true,
    );
  });

  it("espera um intervalo depois de uma falha", () => {
    assert.equal(
      isConnectionSyncDue({ lastSyncedAt: hoursAgo(30), lastFailedAt: hoursAgo(1), now, intervalHours: 6 }),
      false,
    );
    assert.equal(
      isConnectionSyncDue({ lastSyncedAt: hoursAgo(30), lastFailedAt: hoursAgo(6), now, intervalHours: 6 }),
      true,
    );
  });

  it("intervalo zero desliga", () => {
    assert.equal(isConnectionSyncDue({ lastSyncedAt: null, now, intervalHours: 0 }), false);
  });
});

describe("parseSyncIntervalHours", () => {
  it("usa o padrão quando vazio ou inválido", () => {
    assert.equal(parseSyncIntervalHours(undefined), DEFAULT_SYNC_INTERVAL_HOURS);
    assert.equal(parseSyncIntervalHours(""), DEFAULT_SYNC_INTERVAL_HOURS);
    assert.equal(parseSyncIntervalHours("abc"), DEFAULT_SYNC_INTERVAL_HOURS);
    assert.equal(parseSyncIntervalHours("-2"), DEFAULT_SYNC_INTERVAL_HOURS);
  });

  it("aceita zero e valores fracionários", () => {
    assert.equal(parseSyncIntervalHours("0"), 0);
    assert.equal(parseSyncIntervalHours("1.5"), 1.5);
  });
});
