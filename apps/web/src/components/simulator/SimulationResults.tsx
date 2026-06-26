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
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  caution: {
    label: "Atenção",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  risky: {
    label: "Arriscado",
    className: "border-rose-200 bg-rose-50 text-rose-800",
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
            contextHint={contextHint}
            personId={personId}
            className="shrink-0 px-3 py-1.5 text-xs"
          />
        </div>
      </div>

      <div className={cardClass}>
        <h3 className="font-display text-sm font-semibold text-slate-800">Resumo do impacto</h3>
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
          <h3 className="font-display text-sm font-semibold text-slate-800">
            Projeção mês a mês
          </h3>
          <p className="mt-1 text-xs text-slate-500">Comparativo da sobra com e sem o cenário</p>
          <div className="mt-4">
            <ImpactChart data={result.projected.monthlySeries} currencyCode={currencyCode} />
          </div>
        </div>
      )}

      {(result.goalImpact.monthsDelayed !== null || result.goalImpact.affectedGoals.length > 0) && (
        <div className={cardClass}>
          <h3 className="font-display text-sm font-semibold text-slate-800">Impacto em metas</h3>
          {result.goalImpact.monthsDelayed !== null && (
            <p className="mt-2 text-sm text-slate-600">
              Suas metas podem atrasar cerca de{" "}
              <strong>{result.goalImpact.monthsDelayed} meses</strong>.
            </p>
          )}
          {result.goalImpact.affectedGoals.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {result.goalImpact.affectedGoals.slice(0, 5).map((goal) => (
                <li key={goal.id} className="text-xs text-slate-600">
                  {goal.name} — ~{goal.monthsDelayed} meses de atraso
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result.budgetImpact && (
        <div className={cardClass}>
          <h3 className="font-display text-sm font-semibold text-slate-800">Impacto no orçamento</h3>
          <p className="mt-2 text-sm text-slate-600">
            Categoria <strong>{result.budgetImpact.category}</strong>:{" "}
            {formatCurrency(result.budgetImpact.spent, currencyCode)} de{" "}
            {formatCurrency(result.budgetImpact.limit, currencyCode)} (
            {result.budgetImpact.ratioAfter.toFixed(0)}%)
          </p>
        </div>
      )}

      {result.creditImpact && (
        <div className={cardClass}>
          <h3 className="font-display text-sm font-semibold text-slate-800">Impacto no cartão</h3>
          <p className="mt-2 text-sm text-slate-600">
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
        <p className="text-[10px] text-slate-400">{result.disclaimer}</p>
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
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
      <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-slate-900">{value}</p>
      {delta && (
        <p
          className={`mt-0.5 text-xs font-medium ${deltaNegative ? "text-rose-600" : "text-emerald-600"}`}
        >
          {delta}
        </p>
      )}
    </div>
  );
}

export { TYPE_LABELS };
