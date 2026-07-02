import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import type {
  SimulationScenarioDTO,
  TransactionMatchCandidate,
  TransactionMatchesResponse,
} from "@finance/shared";
import { formatCurrency } from "../../lib/format";
import { api } from "../../lib/api";
import { Modal } from "../Modal";

interface Props {
  open: boolean;
  scenario: SimulationScenarioDTO | null;
  currencyCode: string;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (params: {
    transactionId?: string;
    investmentTransactionId?: string;
    note?: string;
  }) => void;
}

function filterTransactions(
  items: TransactionMatchCandidate[],
  query: string,
): TransactionMatchCandidate[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter(
    (m) =>
      m.description.toLowerCase().includes(q) ||
      m.accountName.toLowerCase().includes(q) ||
      String(Math.abs(m.amount)).includes(q.replace(",", ".")),
  );
}

function TransactionOption({
  match,
  currencyCode,
  selected,
  onSelect,
}: {
  match: TransactionMatchCandidate;
  currencyCode: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(match.transactionId)}
      className={`w-full cursor-pointer rounded-xl border px-3 py-2.5 text-left transition ${
        selected
          ? "border-brand bg-brand/5"
          : "border-app-border hover:bg-app-bg"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{match.description}</p>
          <p className="text-[10px] text-muted-foreground">
            {new Date(match.date).toLocaleDateString("pt-BR")} · {match.accountName}
          </p>
          {match.reasons.length > 0 && (
            <p className="mt-1 text-[10px] text-brand">{match.reasons.join(" · ")}</p>
          )}
        </div>
        <span className="shrink-0 text-xs font-bold text-foreground">
          {formatCurrency(Math.abs(match.amount), currencyCode)}
        </span>
      </div>
    </button>
  );
}

export function CompleteScenarioModal({
  open,
  scenario,
  currencyCode,
  saving,
  onClose,
  onConfirm,
}: Props) {
  const [manualSearch, setManualSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const matches = useQuery({
    queryKey: ["simulation-matches", scenario?.id],
    queryFn: () =>
      api.get<TransactionMatchesResponse>(
        `/api/simulations/${scenario!.id}/transaction-matches`,
      ),
    enabled: open && !!scenario?.id,
  });

  useEffect(() => {
    if (!open) {
      setManualSearch("");
      setSelectedId(null);
      setNote("");
    }
  }, [open]);

  const suggestions = useMemo(
    () => filterTransactions(matches.data?.suggestions ?? [], manualSearch),
    [matches.data?.suggestions, manualSearch],
  );

  const recent = useMemo(
    () => filterTransactions(matches.data?.recent ?? [], manualSearch),
    [matches.data?.recent, manualSearch],
  );

  const hasTransactions = suggestions.length > 0 || recent.length > 0;

  if (!open || !scenario) return null;

  return (
    <Modal onClose={onClose} disableBackdropClose={saving}>
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 cursor-pointer rounded-lg p-1 text-muted-foreground hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="h-4.5 w-4.5" />
      </button>

      <h3 className="mb-1 font-display text-lg font-bold text-foreground">Marcar como realizada</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Vincule <strong className="text-foreground">{scenario.name}</strong> (
        {formatCurrency(scenario.payload.amount, currencyCode)}) a uma transação real.
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Buscar transação
          </label>
          <input
            type="search"
            value={manualSearch}
            onChange={(e) => setManualSearch(e.target.value)}
            placeholder="Descrição, conta ou valor..."
            className="mt-1.5 w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-xs outline-brand focus:border-brand"
          />
        </div>

        <div className="max-h-72 space-y-4 overflow-y-auto">
          {matches.isLoading && (
            <p className="text-xs text-muted-foreground">Buscando transações...</p>
          )}
          {matches.isError && (
            <p className="text-xs text-negative">Não foi possível carregar transações.</p>
          )}
          {!matches.isLoading && !hasTransactions && (
            <p className="text-xs text-muted-foreground">
              Nenhuma transação encontrada. Você pode concluir com uma nota abaixo.
            </p>
          )}

          {suggestions.length > 0 && (
            <section className="space-y-2">
              <p className="text-[10px] font-bold tracking-wider text-brand uppercase">
                Sugestões
              </p>
              {suggestions.map((match) => (
                <TransactionOption
                  key={match.transactionId}
                  match={match}
                  currencyCode={currencyCode}
                  selected={selectedId === match.transactionId}
                  onSelect={setSelectedId}
                />
              ))}
            </section>
          )}

          {recent.length > 0 && (
            <section className="space-y-2">
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                {suggestions.length > 0 ? "Outras transações recentes" : "Transações recentes"}
              </p>
              {suggestions.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  A sugestão pode estar errada — escolha outra transação abaixo.
                </p>
              )}
              {recent.map((match) => (
                <TransactionOption
                  key={match.transactionId}
                  match={match}
                  currencyCode={currencyCode}
                  selected={selectedId === match.transactionId}
                  onSelect={setSelectedId}
                />
              ))}
            </section>
          )}
        </div>

        <div>
          <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Nota (se não houver transação)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Ex.: paguei em dinheiro"
            className="mt-1.5 w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-xs outline-brand focus:border-brand"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-app-border px-4 py-2 text-xs font-semibold text-muted-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || (!selectedId && !note.trim())}
            onClick={() =>
              onConfirm({
                transactionId: selectedId ?? undefined,
                note: note.trim() || undefined,
              })
            }
            className="cursor-pointer rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
