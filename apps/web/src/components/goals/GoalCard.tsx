import {
  AlertCircle,
  CheckCircle2,
  Link2,
  Pencil,
  PiggyBank,
  Plus,
  Target,
} from "lucide-react";
import type { GoalDTO } from "@finance/shared";
import { formatCurrency, formatDate } from "../../lib/format";

interface Props {
  goal: GoalDTO;
  currencyCode: string;
  onEdit: (goal: GoalDTO) => void;
  onAddFunds: (goal: GoalDTO) => void;
}

const TYPE_LABELS: Record<GoalDTO["type"], string> = {
  savings: "Poupança",
  purchase: "Compra",
  debt_payoff: "Quitar dívida",
  emergency_fund: "Reserva de emergência",
  custom: "Personalizado",
};

function ProgressRing({ progress }: { progress: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, progress) / 100) * circumference;

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#10B981"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-sm font-bold text-slate-800">{progress.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export function GoalCard({ goal, currencyCode, onEdit, onAddFunds }: Props) {
  const isLinked = goal.trackingMode === "linked";
  const displayAmount = goal.computedAmount ?? goal.currentAmount;
  const remaining = Math.max(0, goal.targetAmount - displayAmount);
  const hasStaleSource = goal.sources.some((s) => s.isStale);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white p-6 transition-all duration-200 hover:shadow-md">
      <div className="flex gap-4">
        <ProgressRing progress={goal.progress} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-2">
            <div>
              <span className="block font-sans text-xs font-bold uppercase tracking-wide text-slate-800">
                {goal.name}
              </span>
              <span className="text-[11px] text-slate-400">{TYPE_LABELS[goal.type]}</span>
            </div>
            <Target className="h-4 w-4 shrink-0 text-emerald-500" />
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {isLinked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <Link2 className="h-3 w-3" />
                Automático
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Manual
              </span>
            )}
            {hasStaleSource && (
              <span className="inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Fonte desatualizada
              </span>
            )}
          </div>

          <div className="mt-3 space-y-1">
            <p className="font-mono text-lg font-bold text-slate-900">
              {formatCurrency(displayAmount, currencyCode)}
            </p>
            <p className="text-xs text-slate-500">
              de {formatCurrency(goal.targetAmount, currencyCode)} · faltam{" "}
              {formatCurrency(remaining, currencyCode)}
            </p>
          </div>

          {isLinked && goal.sources.length > 0 && (
            <ul className="mt-3 space-y-1">
              {goal.sources.map((src) => (
                <li key={src.id} className="text-[10px] text-slate-500">
                  {src.name} · {src.allocationPercent.toFixed(0)}% ·{" "}
                  {formatCurrency(src.allocatedAmount, currencyCode)}
                </li>
              ))}
            </ul>
          )}

          {goal.targetDate && (
            <p className="mt-2 text-[11px] text-slate-400">
              Meta: {formatDate(goal.targetDate)}
            </p>
          )}

          {goal.onTrack !== null && (
            <div className="mt-3 flex items-center gap-1.5">
              {goal.onTrack ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-[10px] font-bold uppercase text-emerald-600">
                    No caminho certo
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-[10px] font-bold uppercase text-amber-600">
                    Atrasado na projeção
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        {!isLinked && (
          <button
            type="button"
            onClick={() => onAddFunds(goal)}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar fundos
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(goal)}
          className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 ${isLinked ? "flex-1" : ""}`}
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </button>
      </div>

      {goal.status === "completed" && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2">
          <PiggyBank className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-[11px] font-medium text-emerald-700">Objetivo concluído!</span>
        </div>
      )}
    </div>
  );
}
