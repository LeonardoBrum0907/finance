import { PiggyBank } from "lucide-react";
import type { BudgetsSummary } from "@finance/shared";
import { formatCurrency } from "../../lib/format";

interface Props {
  data: Pick<
    BudgetsSummary,
    "totalSpent" | "totalLimit" | "overallRatio" | "potentialSavings" | "currencyCode"
  >;
}

function progressColor(ratio: number): string {
  if (ratio > 90) return "bg-rose-500";
  if (ratio > 75) return "bg-amber-500";
  return "bg-emerald-500";
}

export function BudgetOverviewCard({ data }: Props) {
  const barWidth = data.totalLimit > 0 ? `${Math.min(100, data.overallRatio)}%` : "0%";

  return (
    <div className="grid grid-cols-1 items-center gap-8 rounded-3xl border border-slate-200/60 bg-white p-6 shadow-xs md:grid-cols-3">
      <div className="flex flex-col gap-4 md:col-span-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-sans text-sm font-semibold uppercase tracking-wider text-slate-500">
            Consumo Mensal Agregado
          </span>
          <span className="text-base font-bold text-slate-800">
            {data.overallRatio.toFixed(1)}% do teto global
          </span>
        </div>

        <div className="relative h-4 w-full overflow-hidden rounded-full border border-slate-200/10 bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-700 ${progressColor(data.overallRatio)}`}
            style={{ width: barWidth }}
          />
        </div>

        <div className="flex justify-between text-xs font-semibold text-slate-500">
          <span>
            Total Gasto:{" "}
            <strong className="text-slate-800">
              {formatCurrency(data.totalSpent, data.currencyCode)}
            </strong>
          </span>
          <span>
            Teto Configurado:{" "}
            <strong className="text-slate-800">
              {formatCurrency(data.totalLimit, data.currencyCode)}
            </strong>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5">
        <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600">
          <PiggyBank className="h-6 w-6" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase leading-none tracking-wider text-slate-400">
            Economia Potencial
          </span>
          <span className="mt-1 font-display text-lg font-bold text-emerald-600">
            {formatCurrency(data.potentialSavings, data.currencyCode)}
          </span>
          <span className="mt-0.5 text-[10px] text-slate-400">Sobra projetada restante</span>
        </div>
      </div>
    </div>
  );
}
