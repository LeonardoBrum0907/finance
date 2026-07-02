import { PiggyBank } from "lucide-react";
import type { BudgetsSummary } from "@finance/shared";
import { formatCurrency } from "../../lib/format";

interface Props {
  data: Pick<
    BudgetsSummary,
    | "totalSpent"
    | "totalLimit"
    | "overallRatio"
    | "potentialSavings"
    | "currencyCode"
    | "periodMode"
    | "periodLabel"
    | "cycleDayIndex"
    | "cycleTotalDays"
  >;
}

function progressColor(ratio: number): string {
  if (ratio > 90) return "bg-negative";
  if (ratio > 75) return "bg-amber-500";
  return "bg-positive";
}

export function BudgetOverviewCard({ data }: Props) {
  const barWidth = data.totalLimit > 0 ? `${Math.min(100, data.overallRatio)}%` : "0%";
  const periodTitle =
    data.periodMode === "payday" ? "Consumo do Ciclo Atual" : "Consumo Mensal Agregado";
  const cycleHint =
    data.periodMode === "payday" &&
    data.cycleDayIndex !== null &&
    data.cycleTotalDays !== null
      ? ` · Dia ${data.cycleDayIndex} de ${data.cycleTotalDays} (${data.periodLabel})`
      : "";

  return (
    <div className="grid grid-cols-1 items-center gap-8 rounded-3xl border border-app-border/60 bg-app-surface p-6 shadow-xs md:grid-cols-3">
      <div className="flex flex-col gap-4 md:col-span-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-sans text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {periodTitle}
            {cycleHint && (
              <span className="ml-1 normal-case font-normal text-muted-foreground">{cycleHint}</span>
            )}
          </span>
          <span className="text-base font-bold text-foreground">
            {data.overallRatio.toFixed(1)}% do teto global
          </span>
        </div>

        <div className="relative h-4 w-full overflow-hidden rounded-full border border-app-border/10 bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-700 ${progressColor(data.overallRatio)}`}
            style={{ width: barWidth }}
          />
        </div>

        <div className="flex justify-between text-xs font-semibold text-muted-foreground">
          <span>
            Total Gasto:{" "}
            <strong className="text-foreground">
              {formatCurrency(data.totalSpent, data.currencyCode)}
            </strong>
          </span>
          <span>
            Teto Configurado:{" "}
            <strong className="text-foreground">
              {formatCurrency(data.totalLimit, data.currencyCode)}
            </strong>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-2xl border border-app-border/60 bg-app-bg p-5">
        <div className="rounded-xl bg-positive/10 p-3 text-positive">
          <PiggyBank className="h-6 w-6" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase leading-none tracking-wider text-muted-foreground">
            Economia Potencial
          </span>
          <span className="mt-1 font-display text-lg font-bold text-positive">
            {formatCurrency(data.potentialSavings, data.currencyCode)}
          </span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">Margem restante</span>
        </div>
      </div>
    </div>
  );
}
