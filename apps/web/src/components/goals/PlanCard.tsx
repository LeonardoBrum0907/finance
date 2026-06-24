import { Layers, Trash2 } from "lucide-react";
import type { PlanDTO } from "@finance/shared";
import { formatCurrency } from "../../lib/format";
import { useConfirm } from "../../lib/confirm";

interface Props {
  plan: PlanDTO;
  currencyCode: string;
  onDelete: (id: string) => void;
  deleting: boolean;
}

export function PlanCard({ plan, currencyCode, onDelete, deleting }: Props) {
  const confirm = useConfirm();

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-500" />
            <h3 className="font-display text-base font-semibold text-slate-900">{plan.name}</h3>
          </div>
          {plan.description && (
            <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={async () => {
            const ok = await confirm({
              title: "Excluir plano",
              message: `Excluir o plano "${plan.name}"?`,
              confirmLabel: "Excluir",
              variant: "danger",
            });
            if (ok) onDelete(plan.id);
          }}
          disabled={deleting}
          className="cursor-pointer rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
          aria-label={`Excluir plano ${plan.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
          Aporte mensal do plano
        </p>
        <p className="font-mono text-sm font-bold text-indigo-800">
          {formatCurrency(plan.monthlyContribution, currencyCode)}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Objetivos incluídos
        </p>
        {plan.goals.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
          >
            <span className="text-xs font-medium text-slate-700">{member.goalName}</span>
            <span className="font-mono text-[11px] text-slate-500">
              {formatCurrency(member.monthlyAllocation, currencyCode)}/mês
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
