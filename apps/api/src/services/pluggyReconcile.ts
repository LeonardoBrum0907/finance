/**
 * Lançamentos pendentes da Pluggy (ex.: salário que o banco mostra um dia antes)
 * ganham outro id quando são confirmados. Como a sincronização só fazia upsert por
 * id, o pendente antigo ficava no banco ao lado do confirmado, e o salário (e o 13º)
 * apareciam em dobro.
 */

export interface ReconcilableTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  status?: string | null;
}

/** Até quantos dias o pendente pode estar do confirmado para ser o mesmo lançamento. */
const PENDING_MATCH_DAYS = 3;

/** Só olha lançamentos recentes ao apagar o que a Pluggy não devolve mais. */
export const STALE_WINDOW_DAYS = 40;

function dayDiff(a: string, b: string): number {
  return Math.abs(Date.parse(a.slice(0, 10)) - Date.parse(b.slice(0, 10))) / 86_400_000;
}

function words(description: string): Set<string> {
  return new Set(
    description
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter((w) => w.length >= 3),
  );
}

function sameDescription(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return true;
  for (const w of wa) if (wb.has(w)) return true;
  return false;
}

/**
 * Tira os pendentes que já têm um confirmado equivalente (mesmo valor, data próxima,
 * descrição parecida). Cada confirmado cobre no máximo um pendente.
 */
export function dropSupersededPending<T extends ReconcilableTransaction>(txs: T[]): T[] {
  const posted = txs.filter((tx) => tx.status !== "PENDING");
  const used = new Set<string>();
  const dropped = new Set<string>();

  for (const pending of txs) {
    if (pending.status !== "PENDING") continue;
    const match = posted.find(
      (p) =>
        !used.has(p.id) &&
        Math.abs(p.amount - pending.amount) < 0.005 &&
        dayDiff(p.date, pending.date) <= PENDING_MATCH_DAYS &&
        sameDescription(p.description, pending.description),
    );
    if (match) {
      used.add(match.id);
      dropped.add(pending.id);
    }
  }

  return txs.filter((tx) => !dropped.has(tx.id));
}

/**
 * Ids guardados que a Pluggy não devolve mais e são recentes o bastante para serem
 * pendentes antigos. Não apaga nada se a Pluggy não devolveu lançamento nenhum.
 */
export function staleTransactionIds(
  stored: { id: string; pluggyTransactionId: string; date: Date }[],
  fetchedIds: Set<string>,
  now: Date = new Date(),
): string[] {
  if (fetchedIds.size === 0) return [];
  const since = now.getTime() - STALE_WINDOW_DAYS * 86_400_000;
  return stored
    .filter((tx) => tx.date.getTime() >= since && !fetchedIds.has(tx.pluggyTransactionId))
    .map((tx) => tx.id);
}
