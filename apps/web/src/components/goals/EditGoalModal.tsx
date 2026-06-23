import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import type { GoalDTO, GoalStatus, GoalType } from "@finance/shared";

interface Props {
  goal: GoalDTO | null;
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onSave: (data: {
    id: string;
    name?: string;
    description?: string | null;
    type?: GoalType;
    targetAmount?: number;
    targetDate?: string | null;
    status?: GoalStatus;
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

export function EditGoalModal({ goal, saving, deleting, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<GoalType>("savings");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [status, setStatus] = useState<GoalStatus>("active");

  useEffect(() => {
    if (goal) {
      setName(goal.name);
      setDescription(goal.description ?? "");
      setType(goal.type);
      setTargetAmount(String(goal.targetAmount));
      setTargetDate(goal.targetDate ? goal.targetDate.slice(0, 10) : "");
      setStatus(goal.status);
    }
  }, [goal]);

  if (!goal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(targetAmount);
    if (!name.trim() || isNaN(amount) || amount <= 0) return;
    onSave({
      id: goal.id,
      name: name.trim(),
      description: description.trim() || null,
      type,
      targetAmount: amount,
      targetDate: targetDate || null,
      status,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 cursor-pointer rounded-lg p-1 text-slate-400 hover:text-slate-600"
          aria-label="Fechar"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <h3 className="mb-1 font-display text-lg font-bold text-slate-900">Editar Objetivo</h3>
        <p className="mb-6 font-sans text-xs text-slate-400">{goal.name}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-goal-name" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Nome
            </label>
            <input
              id="edit-goal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-emerald-400 focus:border-emerald-400 focus:bg-white"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-goal-type" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Tipo
              </label>
              <select
                id="edit-goal-type"
                value={type}
                onChange={(e) => setType(e.target.value as GoalType)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800"
              >
                {GOAL_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-goal-status" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Status
              </label>
              <select
                id="edit-goal-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as GoalStatus)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800"
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
            <label htmlFor="edit-goal-amount" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Valor alvo (R$)
            </label>
            <input
              id="edit-goal-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-goal-date" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Prazo
            </label>
            <input
              id="edit-goal-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-goal-desc" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Descrição
            </label>
            <textarea
              id="edit-goal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full cursor-pointer rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirm(`Excluir o objetivo "${goal.name}"?`)) {
                onDelete(goal.id);
              }
            }}
            disabled={deleting}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-rose-200 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? "Excluindo..." : "Excluir objetivo"}
          </button>
        </form>
      </div>
    </div>
  );
}
