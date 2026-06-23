import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { GoalDTO } from "@finance/shared";
import { formatCurrency } from "../../lib/format";

interface Props {
  open: boolean;
  goals: GoalDTO[];
  currencyCode: string;
  saving: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description?: string;
    monthlyContribution: number;
    goals: { goalId: string; monthlyAllocation: number }[];
  }) => void;
}

export function CreatePlanModal({ open, goals, currencyCode, saving, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setMonthlyContribution("");
      setSelectedGoals({});
    }
  }, [open]);

  if (!open) return null;

  const activeGoals = goals.filter((g) => g.status === "active");

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((prev) => {
      const next = { ...prev };
      if (goalId in next) {
        delete next[goalId];
      } else {
        next[goalId] = "";
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contribution = parseFloat(monthlyContribution);
    const members = Object.entries(selectedGoals).map(([goalId, allocation]) => ({
      goalId,
      monthlyAllocation: parseFloat(allocation) || 0,
    }));

    if (!name.trim() || isNaN(contribution) || contribution < 0 || members.length === 0) return;

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      monthlyContribution: contribution,
      goals: members,
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

        <h3 className="mb-1 font-display text-lg font-bold text-slate-900">Novo Plano</h3>
        <p className="mb-6 font-sans text-xs text-slate-400">
          Agrupe objetivos com um aporte mensal para gerar o caminho de poupança.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="plan-name" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Nome do plano
            </label>
            <input
              id="plan-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="plan-contribution" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Aporte mensal total (R$)
            </label>
            <input
              id="plan-contribution"
              type="number"
              step="0.01"
              min="0"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Objetivos e alocação mensal
            </span>
            {activeGoals.length === 0 ? (
              <p className="text-xs text-slate-500">Crie ao menos um objetivo ativo primeiro.</p>
            ) : (
              activeGoals.map((goal) => {
                const selected = goal.id in selectedGoals;
                return (
                  <div
                    key={goal.id}
                    className={`rounded-xl border p-3 ${selected ? "border-indigo-200 bg-indigo-50/40" : "border-slate-200"}`}
                  >
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleGoal(goal.id)}
                        className="rounded border-slate-300"
                      />
                      <span className="text-xs font-medium text-slate-700">{goal.name}</span>
                      <span className="ml-auto font-mono text-[10px] text-slate-400">
                        meta {formatCurrency(goal.targetAmount, currencyCode)}
                      </span>
                    </label>
                    {selected && (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Alocação mensal (R$)"
                        value={selectedGoals[goal.id]}
                        onChange={(e) =>
                          setSelectedGoals((prev) => ({ ...prev, [goal.id]: e.target.value }))
                        }
                        className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          <button
            type="submit"
            disabled={saving || activeGoals.length === 0}
            className="w-full cursor-pointer rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Criando..." : "Criar plano"}
          </button>
        </form>
      </div>
    </div>
  );
}
