import { formatCurrency } from "../../lib/format";

interface Props {
  currencyCode: string;
  totalCurrent: number;
  totalTarget: number;
  monthlySurplus: number;
  monthlyContribution: number;
  surplusLabel?: string;
}

export function GoalsProgressSummary({
  currencyCode,
  totalCurrent,
  totalTarget,
  monthlySurplus,
  monthlyContribution,
  surplusLabel = "sobra média",
}: Props) {
  const progress = totalTarget > 0 ? Math.min(100, (totalCurrent / totalTarget) * 100) : 0;
  const remaining = Math.max(0, totalTarget - totalCurrent);

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            Progresso geral
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Valores reais acumulados nas metas ativas
          </p>
        </div>
        <p className="font-display text-2xl font-bold text-foreground">
          {progress.toFixed(0)}%
        </p>
      </div>

      <div className="mb-4 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-app-border/60 bg-app-bg/80 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Acumulado
          </p>
          <p className="mt-0.5 text-sm font-semibold text-positive">
            {formatCurrency(totalCurrent, currencyCode)}
          </p>
        </div>
        <div className="rounded-lg border border-app-border/60 bg-app-bg/80 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Meta total
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {formatCurrency(totalTarget, currencyCode)}
          </p>
        </div>
        <div className="rounded-lg border border-app-border/60 bg-app-bg/80 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Faltam
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {formatCurrency(remaining, currencyCode)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {surplusLabel}: {formatCurrency(monthlySurplus, currencyCode)}
        {monthlyContribution !== monthlySurplus && (
          <>
            {" "}
            · aporte dos planos: {formatCurrency(monthlyContribution, currencyCode)}/mês
          </>
        )}
      </p>
    </div>
  );
}
