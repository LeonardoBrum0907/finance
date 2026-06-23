import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { GoalType } from "@finance/shared";

interface Props {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description?: string;
    type: GoalType;
    targetAmount: number;
    targetDate?: string;
  }) => void;
}

const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: "savings", label: "Poupança" },
  { value: "purchase", label: "Compra" },
  { value: "debt_payoff", label: "Quitar dívida" },
  { value: "emergency_fund", label: "Reserva de emergência" },
  { value: "custom", label: "Personalizado" },
];

export function CreateGoalModal({ open, saving, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<GoalType>("savings");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setType("savings");
      setTargetAmount("");
      setTargetDate("");
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(targetAmount);
    if (!name.trim() || isNaN(amount) || amount <= 0) return;
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      targetAmount: amount,
      targetDate: targetDate || undefined,
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

        <h3 className="mb-1 font-display text-lg font-bold text-slate-900">Novo Objetivo</h3>
        <p className="mb-6 font-sans text-xs text-slate-400">
          Defina uma meta financeira com valor alvo e prazo opcional.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-name" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Nome
            </label>
            <input
              id="goal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Viagem para Europa"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-emerald-400 focus:border-emerald-400 focus:bg-white"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-type" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Tipo
            </label>
            <select
              id="goal-type"
              value={type}
              onChange={(e) => setType(e.target.value as GoalType)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-emerald-400 focus:border-emerald-400 focus:bg-white"
            >
              {GOAL_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-amount" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Valor alvo (R$)
            </label>
            <input
              id="goal-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-emerald-400 focus:border-emerald-400 focus:bg-white"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-date" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Prazo (opcional)
            </label>
            <input
              id="goal-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-emerald-400 focus:border-emerald-400 focus:bg-white"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-desc" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Descrição (opcional)
            </label>
            <textarea
              id="goal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-emerald-400 focus:border-emerald-400 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full cursor-pointer rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Criando..." : "Criar objetivo"}
          </button>
        </form>
      </div>
    </div>
  );
}
