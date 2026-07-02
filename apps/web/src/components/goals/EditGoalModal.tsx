import { useCallback, useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import type {
  AvailableGoalSourceDTO,
  GoalDTO,
  GoalStatus,
  GoalType,
} from "@finance/shared";
import {
  GoalSourceSelector,
  previewAllocatedTotal,
  type GoalSourceSelection,
} from "./GoalSourceSelector";
import { formatCurrency } from "../../lib/format";
import { useConfirm } from "../../lib/confirm";
import { Modal } from "../Modal";

interface Props {
  goal: GoalDTO | null;
  saving: boolean;
  deleting: boolean;
  availableSources: AvailableGoalSourceDTO[];
  currencyCode?: string;
  onClose: () => void;
  onSave: (data: {
    id: string;
    name?: string;
    description?: string | null;
    type?: GoalType;
    targetAmount?: number;
    targetDate?: string | null;
    status?: GoalStatus;
    sources?: GoalSourceSelection[] | null;
  }) => void;
  onDelete: (id: string) => void;
}

const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: "savings", label: "Poupança" },
  { value: "purchase", label: "Compra" },
  { value: "debt_payoff", label: "Quitar dívida" },
  { value: "emergency_fund", label: "Reserva de emergência" },
  { value: "custom", label: "Personalizado" },
];

const STATUSES: { value: GoalStatus; label: string }[] = [
  { value: "active", label: "Ativo" },
  { value: "paused", label: "Pausado" },
  { value: "completed", label: "Concluído" },
  { value: "archived", label: "Arquivado" },
];

export function EditGoalModal({
  goal,
  saving,
  deleting,
  availableSources,
  currencyCode = "BRL",
  onClose,
  onSave,
  onDelete,
}: Props) {
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<GoalType>("savings");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [status, setStatus] = useState<GoalStatus>("active");
  const [useAuto, setUseAuto] = useState(false);
  const [sources, setSources] = useState<GoalSourceSelection[]>([]);

  const handleSourcesChange = useCallback((next: GoalSourceSelection[]) => {
    setSources(next);
  }, []);

  useEffect(() => {
    if (goal) {
      setName(goal.name);
      setDescription(goal.description ?? "");
      setType(goal.type);
      setTargetAmount(String(goal.targetAmount));
      setTargetDate(goal.targetDate ? goal.targetDate.slice(0, 10) : "");
      setStatus(goal.status);
      setUseAuto(goal.trackingMode === "linked");
      setSources(
        goal.sources.map((s) => ({
          sourceType: s.sourceType,
          accountId: s.accountId ?? undefined,
          investmentId: s.investmentId ?? undefined,
          allocationPercent: s.allocationPercent,
        })),
      );
    }
  }, [goal]);

  if (!goal) return null;

  const previewTotal = previewAllocatedTotal(sources, availableSources);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(targetAmount);
    if (!name.trim() || isNaN(amount) || amount <= 0) return;
    if (useAuto && sources.length === 0) return;

    onSave({
      id: goal.id,
      name: name.trim(),
      description: description.trim() || null,
      type,
      targetAmount: amount,
      targetDate: targetDate || null,
      status,
      sources: useAuto ? sources : null,
    });
  };

  return (
    <Modal onClose={onClose} disableBackdropClose={saving || deleting}>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 cursor-pointer rounded-lg p-1 text-muted-foreground hover:text-muted-foreground"
          aria-label="Fechar"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <h3 className="mb-1 font-display text-lg font-bold text-foreground">Editar Objetivo</h3>
        <p className="mb-6 font-sans text-xs text-muted-foreground">{goal.name}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-goal-name" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Nome
            </label>
            <input
              id="edit-goal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-xs text-foreground"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-goal-type" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                Tipo
              </label>
              <select
                id="edit-goal-type"
                value={type}
                onChange={(e) => setType(e.target.value as GoalType)}
                className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-xs text-foreground"
              >
                {GOAL_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-goal-status" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                Status
              </label>
              <select
                id="edit-goal-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as GoalStatus)}
                className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-xs text-foreground"
              >
                {STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-goal-amount" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Valor alvo (R$)
            </label>
            <input
              id="edit-goal-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-xs text-foreground"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-goal-date" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Prazo
            </label>
            <input
              id="edit-goal-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-xs text-foreground"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-goal-desc" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Descrição
            </label>
            <textarea
              id="edit-goal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-xs text-foreground"
            />
          </div>

          <div className="rounded-xl border border-app-border bg-app-bg/40 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground/90">
              <input
                type="checkbox"
                checked={useAuto}
                onChange={(e) => setUseAuto(e.target.checked)}
              />
              Acompanhar automaticamente por saldo vinculado
            </label>
            {useAuto && (
              <div className="mt-3">
                <GoalSourceSelector
                  availableSources={availableSources}
                  initialSources={goal.sources}
                  currencyCode={currencyCode}
                  onChange={handleSourcesChange}
                />
                {sources.length > 0 && (
                  <p className="mt-2 text-xs text-positive">
                    Progresso atual:{" "}
                    <strong>{formatCurrency(previewTotal, currencyCode)}</strong>
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || (useAuto && sources.length === 0)}
            className="w-full cursor-pointer rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>

          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: "Excluir objetivo",
                message: `Excluir o objetivo "${goal.name}"?`,
                confirmLabel: "Excluir",
                variant: "danger",
              });
              if (ok) onDelete(goal.id);
            }}
            disabled={deleting}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-negative/20 py-3 text-xs font-bold text-negative hover:bg-negative/10 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? "Excluindo..." : "Excluir objetivo"}
          </button>
        </form>
    </Modal>
  );
}
