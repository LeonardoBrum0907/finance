import type { PersonDTO } from "@finance/shared";
import { formatDate } from "../../lib/format";

interface Props {
  people: PersonDTO[];
  streamingPhase: "thinking" | "streaming" | null;
}

export function ChatStatusBar({ people, streamingPhase }: Props) {
  const syncDates = people.flatMap((p) =>
    p.connections.map((c) => c.lastSyncedAt).filter((d): d is string => Boolean(d)),
  );

  const latestSync =
    syncDates.length > 0
      ? syncDates.reduce((a, b) => (a > b ? a : b))
      : null;

  const hasAccounts = people.some((p) =>
    p.connections.some((c) => c.accounts.length > 0),
  );

  const stale =
    latestSync &&
    Date.now() - new Date(latestSync).getTime() > 24 * 60 * 60 * 1000;

  let syncMessage: string;
  if (!hasAccounts) {
    syncMessage = "Nenhuma conta conectada — respostas limitadas.";
  } else if (latestSync) {
    syncMessage = `Dados sincronizados em ${formatDate(latestSync)}`;
    if (stale) syncMessage += " · podem estar desatualizados (sincronize em Pessoas)";
  } else {
    syncMessage = "Contas conectadas — aguardando primeira sincronização";
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
      <span>{syncMessage}</span>
      {streamingPhase === "thinking" && (
        <span className="animate-pulse text-brand-600">Pensando…</span>
      )}
      {streamingPhase === "streaming" && (
        <span className="text-brand-600">Respondendo…</span>
      )}
    </div>
  );
}
