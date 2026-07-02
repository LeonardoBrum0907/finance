import { AlertTriangle, TrendingDown } from "lucide-react";
import type { AggregateSimulationImpactDTO } from "@finance/shared";
import { formatCurrency } from "../../lib/format";
import { cardClass } from "../dashboard/motion";
import { ImpactChart } from "./ImpactChart";

interface Props {
  impact: AggregateSimulationImpactDTO | undefined;
  loading?: boolean;
}

export function AggregateImpactPanel({ impact, loading }: Props) {
  if (loading) {
    return (
      <section className={`${cardClass} p-6 text-center text-sm text-muted-foreground`}>
        Calculando impacto agregado...
      </section>
    );
  }

  if (!impact) return null;

  const totalImpact = impact.cycleImpacts.reduce((s, c) => s + c.totalInPeriod, 0);

  return (
    <section className={`${cardClass} space-y-4 p-5`}>
      <div>
        <h2 className="font-display text-sm font-semibold text-foreground">
          Impacto agregado nos ciclos
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {impact.activeCount === 0
            ? "Ative cenários para ver a projeção combinada"
            : `${impact.activeCount} cenário(s) ativo(s) · +${formatCurrency(totalImpact, impact.currencyCode)} nos ciclos projetados`}
        </p>
      </div>

      {impact.activeCount > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric
              label="Sobra do ciclo atual"
              value={formatCurrency(impact.baselineSurplus, impact.currencyCode)}
            />
            <Metric
              label="Com cenários ativos"
              value={formatCurrency(
                impact.monthlyPoints[0]?.scenarioSurplus ?? impact.baselineSurplus,
                impact.currencyCode,
              )}
              negative={
                (impact.monthlyPoints[0]?.scenarioSurplus ?? impact.baselineSurplus) <
                impact.baselineSurplus
              }
            />
          </div>

          {impact.creditBillIncrease > 0 && (
            <p className="text-xs text-amber-800">
              +{formatCurrency(impact.creditBillIncrease, impact.currencyCode)} estimados na fatura
              aberta do cartão
            </p>
          )}

          {impact.alerts.length > 0 && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
              {impact.alerts.map((alert) => (
                <p key={alert} className="flex items-start gap-2 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {alert}
                </p>
              ))}
            </div>
          )}

          <ImpactChart data={impact.monthlyPoints} currencyCode={impact.currencyCode} />

          {impact.scenarioBreakdown[0]?.length ? (
            <div>
              <p className="mb-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                Detalhe no ciclo atual
              </p>
              <ul className="space-y-1.5">
                {impact.scenarioBreakdown[0]!.map((item) => (
                  <li
                    key={item.scenarioId}
                    className="flex items-center justify-between rounded-lg bg-app-bg/60 px-3 py-2 text-xs"
                  >
                    <span className="truncate text-foreground">{item.scenarioName}</span>
                    <span className="flex items-center gap-1 font-semibold text-negative">
                      <TrendingDown className="h-3 w-3" />
                      {formatCurrency(item.totalInPeriod, impact.currencyCode)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  negative,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-app-border/60 bg-app-bg/40 px-3 py-3">
      <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-lg font-bold ${negative ? "text-negative" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
