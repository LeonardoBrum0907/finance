import type {
  SimulationResultDTO,
  SimulationType,
  SimulatorBaselineDTO,
} from "@finance/shared";
import { Target } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { AssistantSpotlightButton } from "../chat/AssistantSpotlightButton";
import { cardClass } from "../dashboard/motion";
import { ImpactChart } from "./ImpactChart";

interface Props {
  result: SimulationResultDTO;
  baseline: SimulatorBaselineDTO;
  onConvertToGoal: () => void;
  personId?: string;
}

const VERDICT_STYLES = {
  affordable: {
    label: "Viável",
    className: "border-positive/20 bg-positive/10 text-positive",
  },
  caution: {
    label: "Atenção",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  risky: {
    label: "Arriscado",
    className: "border-negative/20 bg-negative/10 text-negative",
  },
} as const;

const TYPE_LABELS: Record<SimulationType, string> = {
  single_purchase: "Compra pontual",
  installments: "Compra parcelada",
  recurring_expense: "Despesa recorrente",
  save_for_goal: "Poupar para objetivo",
};

function buildAssistantMessage(result: SimulationResultDTO): string {
  const name = result.name ? `"${result.name}"` : "este cenário";
  return `Analise a simulação de ${name} (${TYPE_LABELS[result.type]}). Veredicto: ${VERDICT_STYLES[result.verdict].label}. ${result.recommendation}`;
}

export function SimulationResults({
  result,
  baseline,
  onConvertToGoal,
  personId,
}: Props) {
  const verdictStyle = VERDICT_STYLES[result.verdict];
  const currencyCode = baseline.currencyCode;

  const contextHint = JSON.stringify({
    source: "simulator_page",
    type: result.type,
    name: result.name,
    verdict: result.verdict,
    amount: result.type === "save_for_goal" ? result.projected.monthlyNeeded : undefined,
  });

  const showConvertButton =
    result.type === "single_purchase" ||
    result.type === "installments" ||
    result.type === "save_for_goal";

  return (
    <section className="space-y-4">
      <div className={`rounded-2xl border px-5 py-4 ${verdictStyle.className}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-wider uppercase opacity-70">
              {TYPE_LABELS[result.type]}
              {result.name ? ` · ${result.name}` : ""}
            </p>
            <p className="mt-1 font-display text-xl font-bold">{verdictStyle.label}</p>
            <p className="mt-2 text-sm opacity-90">{result.recommendation}</p>
          </div>
          <AssistantSpotlightButton
            label="Continuar no assistente"
            message={buildAssistantMessage(result)}
            contextKey={`simulator:${result.type}`}
            title="Simulação"
            contextHint={contextHint}
            personId={personId}
            className="shrink-0 px-3 py-1.5 text-xs"
          />
        </div>
      </div>

      <div className={cardClass}>
        <h3 className="font-display text-sm font-semibold text-foreground">Resumo do impacto</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Sobra antes"
            value={formatCurrency(result.baseline.surplus, currencyCode)}
          />
          <Metric
            label="Sobra depois"
            value={formatCurrency(result.projected.surplusAfter, currencyCode)}
            delta={formatCurrency(result.projected.surplusDelta, currencyCode)}
            deltaNegative={result.projected.surplusDelta < 0}
          />
          {result.projected.bankBalanceAfter !== null && (
            <Metric
              label="Saldo após compra"
              value={formatCurrency(result.projected.bankBalanceAfter, currencyCode)}
            />
          )}
          {result.projected.installmentAmount !== null && (
            <Metric
              label="Valor da parcela"
              value={formatCurrency(result.projected.installmentAmount, currencyCode)}
            />
          )}
          {result.projected.monthlyNeeded !== null && (
            <Metric
              label="Aporte necessário/mês"
              value={formatCurrency(result.projected.monthlyNeeded, currencyCode)}
            />
          )}
          {result.projected.estimatedMonths !== null && (
            <Metric
              label="Tempo estimado"
              value={`${result.projected.estimatedMonths} meses`}
            />
          )}
        </div>

        {result.warnings.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {result.warnings.map((warning) => (
              <li
                key={warning}
                className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-amber-900"
              >
                {warning}
              </li>
            ))}
          </ul>
        )}
      </div>

      {result.projected.monthlySeries.length > 0 && (
        <div className={cardClass}>
          <h3 className="font-display text-sm font-semibold text-foreground">
            Projeção mês a mês
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Comparativo da sobra com e sem o cenário</p>
          <div className="mt-4">
            <ImpactChart data={result.projected.monthlySeries} currencyCode={currencyCode} />
          </div>
        </div>
      )}

      {(result.goalImpact.monthsDelayed !== null || result.goalImpact.affectedGoals.length > 0) && (
        <div className={cardClass}>
          <h3 className="font-display text-sm font-semibold text-foreground">Impacto em metas</h3>
          {result.goalImpact.monthsDelayed !== null && (
            <p className="mt-2 text-sm text-muted-foreground">
              Suas metas podem atrasar cerca de{" "}
              <strong>{result.goalImpact.monthsDelayed} meses</strong>.
            </p>
          )}
          {result.goalImpact.affectedGoals.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {result.goalImpact.affectedGoals.slice(0, 5).map((goal) => (
                <li key={goal.id} className="text-xs text-muted-foreground">
                  {goal.name} — ~{goal.monthsDelayed} meses de atraso
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result.budgetImpact && (
        <div className={cardClass}>
          <h3 className="font-display text-sm font-semibold text-foreground">Impacto no orçamento</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Categoria <strong>{result.budgetImpact.category}</strong>:{" "}
            {formatCurrency(result.budgetImpact.spent, currencyCode)} de{" "}
            {formatCurrency(result.budgetImpact.limit, currencyCode)} (
            {result.budgetImpact.ratioAfter.toFixed(0)}%)
          </p>
        </div>
      )}

      {result.creditImpact && (
        <div className={cardClass}>
          <h3 className="font-display text-sm font-semibold text-foreground">Impacto no cartão</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {result.creditImpact.accountName}: fatura de{" "}
            {formatCurrency(result.creditImpact.nextBillBefore, currencyCode)} para{" "}
            {formatCurrency(result.creditImpact.nextBillAfter, currencyCode)} (+{" "}
            {formatCurrency(result.creditImpact.billIncrease, currencyCode)})
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {showConvertButton && (
          <button
            type="button"
            onClick={onConvertToGoal}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Target className="h-4 w-4" />
            Transformar em objetivo
          </button>
        )}
        <p className="text-[10px] text-muted-foreground">{result.disclaimer}</p>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  delta,
  deltaNegative,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaNegative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-app-border/60 bg-app-bg/60 px-4 py-3">
      <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-foreground">{value}</p>
      {delta && (
        <p
          className={`mt-0.5 text-xs font-medium ${deltaNegative ? "text-negative" : "text-positive"}`}
        >
          {delta}
        </p>
      )}
    </div>
  );
}

export { TYPE_LABELS };
