import { FlaskConical, Plus, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { AggregateSimulationImpactDTO, DashboardCurrentCycle } from "@finance/shared";
import { scenarioTypeLabel } from "@finance/shared";
import { cycleSurplusBaseline, formatCycleBalance, formatCycleImpactLabel } from "../../lib/cycleLabels";
import { formatCurrency } from "../../lib/format";

interface Props {
  impact: AggregateSimulationImpactDTO;
  cycle?: DashboardCurrentCycle;
  onAddAnother: () => void;
}

export function SimulationImpactPanel({ impact, cycle, onAddAnother }: Props) {
  if (impact.activeCount === 0) return null;

  const { currencyCode, cycleImpacts, scenarios, alerts } = impact;
  const visibleImpacts = cycleImpacts.filter((c) => c.totalInPeriod > 0).slice(0, 2);
  const totalCycleImpact = cycleImpacts.slice(0, 2).reduce((s, c) => s + c.totalInPeriod, 0);

  const panelAlerts = [...alerts];
  const simulationImpact = impact.simulationOnlyCycleImpacts[0];
  if (cycle && simulationImpact && simulationImpact.totalInPeriod > 0) {
    const { label, amount: surplusBefore } = cycleSurplusBaseline(cycle);
    const surplusAfter = surplusBefore - simulationImpact.totalInPeriod;
    const impactLabel = formatCurrency(simulationImpact.totalInPeriod, currencyCode);
    const beforeLabel = formatCycleBalance(surplusBefore, currencyCode).formattedAmount;
    const afterDisplay = formatCycleBalance(surplusAfter, currencyCode);

    if (surplusBefore >= 0 && surplusAfter < 0) {
      panelAlerts.push(
        `Em “${label}” (sobra ${beforeLabel}): esta simulação (${impactLabel}) deixaria ${afterDisplay.status.toLowerCase()} ${afterDisplay.formattedAmount}.`,
      );
    } else if (surplusBefore < 0) {
      panelAlerts.push(
        `Em “${label}” já faltam ${beforeLabel}. A simulação agrava em mais ${impactLabel}.`,
      );
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold text-amber-950">
              {impact.activeCount}{" "}
              {impact.activeCount === 1 ? "cenário ativo" : "cenários ativos"}
            </p>
            <p className="text-xs text-amber-800/80">
              +{formatCurrency(totalCycleImpact, currencyCode)} neste e no próximo ciclo
              {impact.creditBillIncrease > 0
                ? ` · +${formatCurrency(impact.creditBillIncrease, currencyCode)} na fatura`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddAnother}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Simular compra
          </button>
          <Link
            to="/simulador"
            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver no Simulador
          </Link>
        </div>
      </div>

      <ul className="mt-3 space-y-1 border-t border-amber-200/60 pt-3">
        {scenarios.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate">
              <span className="font-medium">{s.name}</span>
              <span className="text-amber-800/70">
                {" "}
                · {scenarioTypeLabel(s.type)} · {formatCurrency(s.payload.amount, currencyCode)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {visibleImpacts.length > 0 && (
        <div className="mt-3 border-t border-amber-200/60 pt-3">
          <p className="text-[10px] font-bold tracking-wider text-amber-800 uppercase">
            Impacto por ciclo
          </p>
          <ul className="mt-1.5 space-y-1">
            {visibleImpacts.map((cycleImpact, index) => (
              <li key={cycleImpact.cycleKey} className="flex flex-wrap justify-between gap-x-4 text-xs">
                <span>{formatCycleImpactLabel(cycleImpact.cycleKey, index)}</span>
                <span className="font-medium">
                  {cycleImpact.realizedExpenses > 0 && (
                    <span>−{formatCurrency(cycleImpact.realizedExpenses, currencyCode)} real.</span>
                  )}
                  {cycleImpact.realizedExpenses > 0 && cycleImpact.committedExpenses > 0 && " · "}
                  {cycleImpact.committedExpenses > 0 && (
                    <span>−{formatCurrency(cycleImpact.committedExpenses, currencyCode)} comp.</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {panelAlerts.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-amber-200/60 pt-3 text-xs text-amber-900">
          {panelAlerts.map((alert) => (
            <li key={alert}>{alert}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
