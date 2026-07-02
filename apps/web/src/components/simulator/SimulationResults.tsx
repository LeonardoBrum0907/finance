import type {
  SimulationResultDTO,
  SimulationType,
  SimulatorBaselineDTO,
} from "@finance/shared";
import { Target } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { AssistantSpotlightButton } from "../chat/AssistantSpotlightButton";
import { cardClass } from "../dashboard/motion";
import { SIMULATOR_TONE, type SimulatorTone } from "./tokens";

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
  invest: "Investimento",
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
    result.type === "save_for_goal" ||
    result.type === "invest" ||
    result.type === "recurring_expense";

  const purchaseAddsToExistingDeficit =
    result.baseline.surplus < 0 &&
    result.projected.surplusAfter < 0 &&
    result.projected.surplusDelta < 0;

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
            label="Sobra atual do ciclo"
            value={formatCurrency(result.baseline.surplus, currencyCode)}
            tone={result.baseline.surplus >= 0 ? "positive" : "negative"}
          />
          <Metric
            label="Sobra após cenário"
            value={formatCurrency(result.projected.surplusAfter, currencyCode)}
            delta={`${result.projected.surplusDelta >= 0 ? "+" : ""}${formatCurrency(result.projected.surplusDelta, currencyCode)} (impacto da compra)`}
            deltaNegative={result.projected.surplusDelta < 0}
            tone={result.projected.surplusAfter >= 0 ? "positive" : "negative"}
          />
          {result.projected.bankBalanceAfter !== null && (
            <Metric
              label="Saldo após compra"
              value={formatCurrency(result.projected.bankBalanceAfter, currencyCode)}
              tone="brand"
            />
          )}
          {result.projected.installmentAmount !== null && (
            <Metric
              label="Valor da parcela"
              value={formatCurrency(result.projected.installmentAmount, currencyCode)}
              tone="brand"
            />
          )}
          {result.projected.monthlyNeeded !== null && (
            <Metric
              label="Aporte necessário/mês"
              value={formatCurrency(result.projected.monthlyNeeded, currencyCode)}
              tone="brand"
            />
          )}
        </div>

        {purchaseAddsToExistingDeficit && (
          <p className="mt-3 rounded-lg border border-app-border/60 bg-app-bg/50 px-3 py-2 text-xs text-muted-foreground">
            Você já estava{" "}
            <strong className="text-negative">
              {formatCurrency(Math.abs(result.baseline.surplus), currencyCode)}
            </strong>{" "}
            no vermelho neste ciclo. A compra adiciona{" "}
            <strong className="text-foreground">
              {formatCurrency(Math.abs(result.projected.surplusDelta), currencyCode)}
            </strong>
            , totalizando{" "}
            <strong className="text-negative">
              {formatCurrency(Math.abs(result.projected.surplusAfter), currencyCode)}
            </strong>{" "}
            de déficit.
          </p>
        )}

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

      {(result.goalImpact.monthsDelayed !== null || result.goalImpact.affectedGoals.length > 0) && (
        <div className={`${cardClass} border-brand/20 bg-brand/5`}>
          <h3 className="font-display text-sm font-semibold text-brand">Impacto em metas</h3>
          {result.goalImpact.monthsDelayed !== null && (
            <p className="mt-2 text-sm text-muted-foreground">
              Suas metas podem atrasar cerca de{" "}
              <strong className="text-brand">{result.goalImpact.monthsDelayed} meses</strong>.
            </p>
          )}
          {result.goalImpact.affectedGoals.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {result.goalImpact.affectedGoals.slice(0, 5).map((goal) => (
                <li key={goal.id} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{goal.name}</span>
                  {" — "}
                  <span className="text-negative">~{goal.monthsDelayed} meses de atraso</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result.budgetImpact && (
        <div className={`${cardClass} ${
          result.budgetImpact.ratioAfter > 90
            ? "border-negative/20 bg-negative/5"
            : result.budgetImpact.ratioAfter > 75
              ? "border-amber-200/80 bg-amber-50/60"
              : "border-positive/20 bg-positive/5"
        }`}>
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
        <div className={`${cardClass} border-brand/20 bg-brand/5`}>
          <h3 className="font-display text-sm font-semibold text-brand">Impacto no cartão</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{result.creditImpact.accountName}</span>
            : fatura de{" "}
            {formatCurrency(result.creditImpact.nextBillBefore, currencyCode)} para{" "}
            <span className="font-semibold text-negative">
              {formatCurrency(result.creditImpact.nextBillAfter, currencyCode)}
            </span>{" "}
            (
            <span className="text-negative">
              +{formatCurrency(result.creditImpact.billIncrease, currencyCode)}
            </span>
            )
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {showConvertButton && (
          <button
            type="button"
            onClick={onConvertToGoal}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand/90"
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
  tone = "neutral",
}: {
  label: string;
  value: string;
  delta?: string;
  deltaNegative?: boolean;
  tone?: SimulatorTone;
}) {
  const styles = SIMULATOR_TONE[tone];
  return (
    <div className={`rounded-xl border px-4 py-3 ${styles.box}`}>
      <p className={`text-[10px] font-bold tracking-wider uppercase ${styles.label}`}>{label}</p>
      <p className={`mt-1 font-display text-lg font-semibold ${styles.value}`}>{value}</p>
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
