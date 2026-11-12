import type { FastifyBaseLogger } from "fastify";
import { isConnectionSyncDue } from "@finance/shared";
import { env, isPluggyConfigured } from "../env.js";
import { prisma } from "../prisma.js";
import { syncConnection } from "./pluggy.js";

/** Espera depois de a API subir, para não competir com o boot. */
const STARTUP_DELAY_MS = 30_000;
/** De quanto em quanto tempo o agendador confere se há conexões vencidas. */
const CHECK_EVERY_MS = 15 * 60 * 1000;

/**
 * Sincroniza automaticamente as conexões Pluggy cuja última sync passou de
 * SYNC_INTERVAL_HOURS (padrão 6h). Roda ao subir a API e depois confere a
 * cada 15 minutos, então recupera o atraso quando o PC volta a ligar.
 * Devolve uma função que para o agendador.
 */
export function startSyncScheduler(log: FastifyBaseLogger): () => void {
  const intervalHours = env.syncIntervalHours;
  if (intervalHours <= 0) {
    log.info("Sincronização automática desligada (SYNC_INTERVAL_HOURS=0)");
    return () => {};
  }
  if (!isPluggyConfigured()) {
    log.info("Sincronização automática inativa: Pluggy não configurado");
    return () => {};
  }

  const failures = new Map<string, Date>();
  let running = false;
  let stopped = false;

  async function tick(): Promise<void> {
    if (running || stopped) return;
    running = true;
    try {
      const connections = await prisma.bankConnection.findMany({
        select: { id: true, connectorName: true, lastSyncedAt: true },
        orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } },
      });
      const now = new Date();
      const due = connections.filter((c) =>
        isConnectionSyncDue({
          lastSyncedAt: c.lastSyncedAt,
          lastFailedAt: failures.get(c.id) ?? null,
          now,
          intervalHours,
        }),
      );
      if (due.length === 0) return;

      log.info({ count: due.length }, "Sincronização automática: iniciando");
      for (const conn of due) {
        if (stopped) break;
        try {
          await syncConnection(conn.id);
          failures.delete(conn.id);
          log.info({ connectionId: conn.id, connector: conn.connectorName }, "Sincronização automática concluída");
        } catch (err) {
          failures.set(conn.id, new Date());
          log.error({ err, connectionId: conn.id }, "Falha na sincronização automática");
        }
      }
    } catch (err) {
      log.error({ err }, "Falha ao listar conexões para sincronização automática");
    } finally {
      running = false;
    }
  }

  log.info({ intervalHours }, "Sincronização automática ativa");
  const startup = setTimeout(() => void tick(), STARTUP_DELAY_MS);
  const interval = setInterval(() => void tick(), CHECK_EVERY_MS);
  startup.unref();
  interval.unref();

  return () => {
    stopped = true;
    clearTimeout(startup);
    clearInterval(interval);
  };
}
