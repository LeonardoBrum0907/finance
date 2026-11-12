/**
 * Regras do agendador de sincronização automática das conexões Pluggy.
 * A Pluggy atualiza os itens no banco cerca de uma vez por dia; o agendador
 * só traz esses dados para o nosso banco quando a última sync ficou velha.
 */

export const DEFAULT_SYNC_INTERVAL_HOURS = 6;

const HOUR_MS = 60 * 60 * 1000;

export interface SyncDueInput {
  lastSyncedAt: Date | string | null | undefined;
  /** Última falha registrada em memória pelo agendador, se houver. */
  lastFailedAt?: Date | null;
  now: Date;
  intervalHours: number;
}

function toTime(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const time = typeof value === "string" ? new Date(value).getTime() : value.getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * Diz se uma conexão deve ser sincronizada agora.
 * - intervalo <= 0 desliga o agendador;
 * - conexão nunca sincronizada é sempre devida;
 * - depois de uma falha, espera um intervalo inteiro antes de tentar de novo.
 */
export function isConnectionSyncDue({
  lastSyncedAt,
  lastFailedAt,
  now,
  intervalHours,
}: SyncDueInput): boolean {
  if (!Number.isFinite(intervalHours) || intervalHours <= 0) return false;
  const intervalMs = intervalHours * HOUR_MS;
  const nowMs = now.getTime();

  const failedMs = toTime(lastFailedAt);
  if (failedMs !== null && nowMs - failedMs < intervalMs) return false;

  const syncedMs = toTime(lastSyncedAt);
  if (syncedMs === null) return true;
  return nowMs - syncedMs >= intervalMs;
}

/** Lê SYNC_INTERVAL_HOURS; vazio ou inválido usa o padrão, 0 desliga. */
export function parseSyncIntervalHours(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_SYNC_INTERVAL_HOURS;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_SYNC_INTERVAL_HOURS;
  return value;
}
