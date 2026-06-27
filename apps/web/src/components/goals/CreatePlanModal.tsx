import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { GoalDTO } from "@finance/shared";
import { formatCurrency } from "../../lib/format";
import { Modal } from "../Modal";

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
    <Modal onClose={onClose} disableBackdropClose={saving}>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 cursor-pointer rounded-lg p-1 text-muted-foreground-dark hover:text-muted-foreground-dark"
          aria-label="Fechar"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <h3 className="mb-1 font-display text-lg font-bold text-foreground">Novo Plano</h3>
        <p className="mb-6 font-sans text-xs text-muted-foreground-dark">
          Agrupe objetivos com um aporte mensal para gerar o caminho de poupança.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="plan-name" className="text-[10px] font-bold tracking-wider text-muted-foreground-dark uppercase">
              Nome do plano
            </label>
            <input
              id="plan-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-xs text-foreground"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="plan-contribution" className="text-[10px] font-bold tracking-wider text-muted-foreground-dark uppercase">
              Aporte mensal total (R$)
            </label>
            <input
              id="plan-contribution"
              type="number"
              step="0.01"
              min="0"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(e.target.value)}
              className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-xs text-foreground"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground-dark uppercase">
              Objetivos e alocação mensal
            </span>
            {activeGoals.length === 0 ? (
              <p className="text-xs text-muted-foreground-dark">Crie ao menos um objetivo ativo primeiro.</p>
            ) : (
              activeGoals.map((goal) => {
                const selected = goal.id in selectedGoals;
                return (
                  <div
                    key={goal.id}
                    className={`rounded-xl border p-3 ${selected ? "border-indigo-200 bg-indigo-50/40" : "border-app-border"}`}
                  >
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleGoal(goal.id)}
                        className="rounded border-app-border"
                      />
                      <span className="text-xs font-medium text-foreground/90">{goal.name}</span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground-dark">
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
                        className="mt-2 w-full rounded-lg border border-app-border px-2 py-1.5 text-xs"
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
    </Modal>
  );
}
