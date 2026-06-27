import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle2, Circle, Loader2, X } from "lucide-react";
import type { CreateCommitmentInput, TransactionDetailDTO } from "@finance/shared";
import { FINE_GRAINED_CATEGORIES, isTransactionOutflow, toSignedDisplayAmount } from "@finance/shared";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { Modal } from "../Modal";

interface Props {
  transactionId: string | null;
  onClose: () => void;
}

function extractPayeeFromDescription(description: string): string {
  const upper = description.toUpperCase();
  const pixMatch = upper.match(/PIX\s+(?:ENVIADO|RECEBIDO)\s+(.+)/);
  if (pixMatch?.[1]) {
    return pixMatch[1].trim().replace(/\s*\|.*$/, "").trim();
  }
  const transferMatch = upper.match(/TRANSFER[EÊ]NCIA\s+(?:ENVIADA|RECEBIDA)\s*\|?\s*(.+)/);
  if (transferMatch?.[1]) return transferMatch[1].trim();
  return "";
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function TransactionDetailModal({ transactionId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [notes, setNotes] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("3");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editTitle, setEditTitle] = useState("");

  const detail = useQuery({
    queryKey: ["transaction-detail", transactionId],
    queryFn: () => api.get<TransactionDetailDTO>(`/api/transactions/${transactionId}`),
    enabled: transactionId != null,
  });

  const tx = detail.data;

  useEffect(() => {
    if (!tx) return;
    const absAmount = Math.abs(tx.amount);
    setInstallmentAmount(String(absAmount));
    setTotalAmount(String(absAmount * 3));
    setPayeeName(extractPayeeFromDescription(tx.description));
    const date = new Date(tx.date);
    setDayOfMonth(String(date.getUTCDate()));
    setEditNotes(tx.commitment?.notes ?? "");
    setEditTitle(tx.commitment?.title ?? "");
  }, [tx?.id]);

  const createCommitment = useMutation({
    mutationFn: (body: CreateCommitmentInput) =>
      api.post(`/api/commitments`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transaction-detail", transactionId] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const updateCommitment = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { title?: string; notes?: string | null; status?: "cancelled" } }) =>
      api.patch(`/api/commitments/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transaction-detail", transactionId] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const updateCategory = useMutation({
    mutationFn: (category: string) =>
      api.patch(`/api/transactions/${transactionId}`, { category }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transaction-detail", transactionId] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  if (!transactionId) return null;

  const isOutflow = tx ? isTransactionOutflow(tx.amount, tx.accountType) : false;
  const commitment = tx?.commitment;

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!transactionId) return;

    const parsedTotal = Number(totalAmount.replace(",", "."));
    const parsedInstallment = Number(installmentAmount.replace(",", "."));
    const parsedInstallments = Number(totalInstallments);
    const parsedDay = dayOfMonth ? Number(dayOfMonth) : undefined;

    if (!title.trim() || !parsedTotal || !parsedInstallment || parsedInstallments < 2) return;

    createCommitment.mutate({
      transactionId,
      title: title.trim(),
      payeeName: payeeName.trim() || undefined,
      notes: notes.trim() || undefined,
      totalAmount: parsedTotal,
      installmentAmount: parsedInstallment,
      totalInstallments: parsedInstallments,
      dayOfMonth: parsedDay,
    });
  }

  function handleSaveEdits() {
    if (!commitment) return;
    updateCommitment.mutate({
      id: commitment.id,
      body: { title: editTitle.trim(), notes: editNotes.trim() || null },
    });
  }

  function handleCancelCommitment() {
    if (!commitment) return;
    updateCommitment.mutate({ id: commitment.id, body: { status: "cancelled" } });
  }

  return (
    <Modal onClose={onClose} panelClassName="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-app-border bg-app-surface p-6 shadow-2xl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Detalhes da transação</h2>
          <p className="text-xs text-muted-foreground-dark">Informações do banco e compromissos de pagamento</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-muted-foreground-dark transition hover:bg-slate-100 hover:text-muted-foreground-dark"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {detail.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground-dark">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : detail.isError || !tx ? (
        <p className="py-8 text-center text-sm text-danger">
          Não foi possível carregar a transação.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-app-border/60 bg-app-bg/80 p-4">
            <p className="font-semibold text-foreground">{tx.description}</p>
            <p className="mt-1 text-xs text-muted-foreground-dark">
              {tx.accountName} · {tx.personName}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span
                className={`font-display text-xl font-bold ${
                  isOutflow ? "text-foreground" : "text-positive"
                }`}
              >
                {formatCurrency(
                  toSignedDisplayAmount(tx.amount, tx.accountType),
                  tx.currencyCode,
                )}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground-dark">
                <Calendar className="h-3.5 w-3.5" />
                {formatDateLong(tx.date)}
              </span>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground-dark">
                Categoria
              </label>
              <select
                value={tx.category ?? "Outros"}
                disabled={updateCategory.isPending}
                onChange={(e) => updateCategory.mutate(e.target.value)}
                className="w-full rounded-lg border border-app-border bg-app-surface px-2.5 py-1.5 text-sm outline-none focus:border-indigo-300"
              >
                {FINE_GRAINED_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {commitment && commitment.status !== "cancelled" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                  Compromisso de pagamento
                </p>
                <p className="mt-1 font-display text-base font-semibold text-foreground">
                  {commitment.title}
                </p>
                {commitment.payeeName && (
                  <p className="text-xs text-muted-foreground-dark">Para: {commitment.payeeName}</p>
                )}
                <p className="mt-2 text-sm text-muted-foreground-dark">
                  {commitment.paidCount} de {commitment.totalInstallments} parcelas pagas ·{" "}
                  {formatCurrency(commitment.installmentAmount, tx.currencyCode)} cada
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-indigo-100">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{
                      width: `${(commitment.paidCount / commitment.totalInstallments) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <ul className="space-y-2">
                {commitment.installments.map((inst) => (
                  <li
                    key={inst.id}
                    className="flex items-center justify-between rounded-xl border border-app-border/60 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {inst.status === "paid" ? (
                        <CheckCircle2 className="h-4 w-4 text-positive" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-300" />
                      )}
                      <span className="font-medium text-foreground/90">
                        Parcela {inst.sequence}/{commitment.totalInstallments}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {formatCurrency(inst.amount, tx.currencyCode)}
                      </p>
                      <p className="text-[10px] text-muted-foreground-dark">{formatShortDate(inst.dueDate)}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground-dark">Título</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-lg border border-app-border px-3 py-2 text-sm outline-none focus:border-indigo-300"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground-dark">Notas</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-app-border px-3 py-2 text-sm outline-none focus:border-indigo-300"
                    placeholder="Detalhes do acordo, contato, etc."
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSaveEdits}
                    disabled={updateCommitment.isPending}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Salvar alterações
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelCommitment}
                    disabled={updateCommitment.isPending}
                    className="rounded-xl border border-app-border px-4 py-2 text-sm font-medium text-muted-foreground-dark transition hover:bg-app-bg disabled:opacity-50"
                  >
                    Cancelar compromisso
                  </button>
                </div>
              </div>
            </div>
          ) : isOutflow ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Este pagamento faz parte de uma dívida?
                </p>
                <p className="text-xs text-muted-foreground-dark">
                  Registre parcelas informais (Pix, transferências) para acompanhar o que falta pagar.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground-dark">
                  O que foi comprado?
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Ex.: Computador"
                  className="w-full rounded-lg border border-app-border px-3 py-2 text-sm outline-none focus:border-indigo-300"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground-dark">
                  Beneficiário (para reconhecer próximos Pix)
                </label>
                <input
                  type="text"
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  placeholder="Nome na descrição do Pix"
                  className="w-full rounded-lg border border-app-border px-3 py-2 text-sm outline-none focus:border-indigo-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground-dark">Valor total</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    required
                    className="w-full rounded-lg border border-app-border px-3 py-2 text-sm outline-none focus:border-indigo-300"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground-dark">
                    Valor da parcela
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={installmentAmount}
                    onChange={(e) => setInstallmentAmount(e.target.value)}
                    required
                    className="w-full rounded-lg border border-app-border px-3 py-2 text-sm outline-none focus:border-indigo-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground-dark">
                    Total de parcelas
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={120}
                    value={totalInstallments}
                    onChange={(e) => setTotalInstallments(e.target.value)}
                    required
                    className="w-full rounded-lg border border-app-border px-3 py-2 text-sm outline-none focus:border-indigo-300"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground-dark">
                    Dia do mês
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                    className="w-full rounded-lg border border-app-border px-3 py-2 text-sm outline-none focus:border-indigo-300"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground-dark">Notas (opcional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-app-border px-3 py-2 text-sm outline-none focus:border-indigo-300"
                  placeholder="Combinado por WhatsApp, etc."
                />
              </div>

              {createCommitment.isError && (
                <p className="text-sm text-danger">Não foi possível criar o compromisso.</p>
              )}

              <button
                type="submit"
                disabled={createCommitment.isPending}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {createCommitment.isPending ? "Salvando…" : "Registrar compromisso"}
              </button>
            </form>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
