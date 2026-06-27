import { useMemo } from "react";
import type { TooltipItem } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import type {
  DashboardGrowthMetrics,
  DashboardMonthlyPoint,
  PeriodMode,
} from "@finance/shared";
import { formatCurrency, formatPercent } from "../../lib/format";
import { ensureChartJsRegistered } from "../../lib/chart";
import { baseChartOptions, getChartColors } from "../../lib/chartTheme";
import { useTheme } from "../../lib/theme/useTheme";

ensureChartJsRegistered();

type GrowthView = "flow" | "balance";

interface Props {
  point: DashboardMonthlyPoint;
  growthMetrics: DashboardGrowthMetrics;
  currencyCode: string;
  view: GrowthView;
  periodMode?: PeriodMode;
  hideIncomeBreakdown?: boolean;
}

function ChangeChip({
  label,
  change,
  invertTone = false,
}: {
  label: string;
  change: number | null;
  invertTone?: boolean;
}) {
  if (change === null || Math.abs(change) < 0.5) return null;
  const positive = change > 0;
  const good = invertTone ? !positive : positive;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        good ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"
      }`}
    >
      {formatPercent(change)} {label}
    </span>
  );
}

function HorizontalBar({
  label,
  value,
  max,
  color,
  currencyCode,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  currencyCode: string;
}) {
  const width = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-bold text-foreground">
          {formatCurrency(value, currencyCode)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function GrowthSingleMonthView({
  point,
  growthMetrics,
  currencyCode,
  view,
  periodMode = "calendar",
  hideIncomeBreakdown = false,
}: Props) {
  const { theme } = useTheme();
  const chartColors = useMemo(() => getChartColors(), [theme]);
  const { income, expenses, net } = point;
  const { savingsRate, expenseRatio, vsPrevious, incomeBreakdown, projection } = growthMetrics;
  const maxFlow = Math.max(income, expenses, 1);
  const compareLabel = periodMode === "payday" ? "vs ciclo anterior" : "vs mês anterior";

  const flowDoughnutData = useMemo(
    () => ({
      labels: ["Receitas", "Despesas"],
      datasets: [
        {
          data: [income, expenses],
          backgroundColor: [chartColors.income, chartColors.expense],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    }),
    [income, expenses, chartColors],
  );

  const balanceDoughnutData = useMemo(() => {
    if (net >= 0) {
      return {
        labels: ["Poupança", "Gasto"],
        datasets: [
          {
            data: [net, Math.max(0, expenses)],
            backgroundColor: [chartColors.income, chartColors.expense],
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      };
    }
    return {
      labels: ["Déficit"],
      datasets: [
        {
          data: [Math.abs(net)],
          backgroundColor: [chartColors.expense],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    };
  }, [net, expenses, chartColors]);

  const doughnutOptions = useMemo(
    () => ({
      ...baseChartOptions(),
      cutout: "72%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<"doughnut">) => {
              const value = ctx.parsed;
              if (value == null) return "";
              return `${ctx.label}: ${formatCurrency(value, currencyCode)}`;
            },
          },
        },
      },
    }),
    [currencyCode],
  );

  const hasVsPrevious =
    vsPrevious.incomeChange !== null ||
    vsPrevious.expenseChange !== null ||
    vsPrevious.netChange !== null;

  const showBreakdown = incomeBreakdown && !hideIncomeBreakdown;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative mx-auto h-40 w-full max-w-[180px]">
          <Doughnut
            data={view === "flow" ? flowDoughnutData : balanceDoughnutData}
            options={doughnutOptions}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
            {view === "flow" ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Saldo
                </span>
                <span
                  className={`font-display text-sm font-bold ${
                    net >= 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {net >= 0 ? "+" : ""}
                  {formatCurrency(net, currencyCode)}
                </span>
                {savingsRate !== null && (
                  <span className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                    {savingsRate.toFixed(0)}% poupança
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Saldo líquido
                </span>
                <span
                  className={`font-display text-sm font-bold ${
                    net >= 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {net >= 0 ? "+" : ""}
                  {formatCurrency(net, currencyCode)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3">
          {view === "flow" ? (
            <>
              <HorizontalBar
                label="Receitas"
                value={income}
                max={maxFlow}
                color={chartColors.income}
                currencyCode={currencyCode}
              />
              <HorizontalBar
                label="Despesas"
                value={expenses}
                max={maxFlow}
                color={chartColors.expense}
                currencyCode={currencyCode}
              />
            </>
          ) : (
            <>
              <HorizontalBar
                label="Receitas"
                value={income}
                max={Math.max(income, Math.abs(net), 1)}
                color={chartColors.income}
                currencyCode={currencyCode}
              />
              <HorizontalBar
                label={net >= 0 ? "Sobra" : "Déficit"}
                value={Math.abs(net)}
                max={Math.max(income, Math.abs(net), 1)}
                color={net >= 0 ? chartColors.net : chartColors.expense}
                currencyCode={currencyCode}
              />
            </>
          )}
        </div>
      </div>

      <div
        className={`grid gap-2 ${showBreakdown ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
      >
        {showBreakdown && (
          <>
            <div className="rounded-lg border border-app-border/60 bg-app-bg/80 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Salário
              </p>
              <p className="mt-0.5 text-sm font-semibold text-positive">
                +{formatCurrency(incomeBreakdown.salary, currencyCode)}
              </p>
            </div>
            <div className="rounded-lg border border-app-border/60 bg-app-bg/80 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Renda extra
              </p>
              <p className="mt-0.5 text-sm font-semibold text-positive">
                +{formatCurrency(incomeBreakdown.extra, currencyCode)}
              </p>
            </div>
          </>
        )}
        {expenseRatio !== null && (
          <div className="rounded-lg border border-app-border/60 bg-app-bg/80 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Taxa de gasto
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {expenseRatio.toFixed(0)}% da renda
            </p>
          </div>
        )}
      </div>

      {(hasVsPrevious || projection?.isPartialPeriod) && (
        <div className="space-y-2 rounded-xl border border-app-border/60 bg-app-bg/60 px-3 py-2.5">
          {hasVsPrevious && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {compareLabel}
              </span>
              <ChangeChip label="receitas" change={vsPrevious.incomeChange} />
              <ChangeChip label="despesas" change={vsPrevious.expenseChange} invertTone />
              <ChangeChip label="saldo" change={vsPrevious.netChange} />
            </div>
          )}
          {projection?.isPartialPeriod && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {periodMode === "payday" ? (
                <>
                  <p>
                    <span className="font-semibold text-foreground/90">
                      Fechamento do ciclo
                    </span>{" "}
                    <span className="text-muted-foreground">
                      (faltam {projection.daysRemaining}{" "}
                      {projection.daysRemaining === 1 ? "dia" : "dias"} ·{" "}
                      {projection.daysElapsed}/{projection.daysTotal})
                    </span>
                  </p>
                  <p>
                    Despesas estimadas no ciclo:{" "}
                    <span className="font-semibold text-foreground">
                      ~{formatCurrency(projection.projectedExpense, currencyCode)}
                    </span>
                  </p>
                  {((projection.expensesToDate ?? 0) > 0 || (projection.committedExpenses ?? 0) > 0) && (
                    <p className="text-muted-foreground">
                      {(projection.expensesToDate ?? 0) > 0 && (
                        <>
                          Já gasto:{" "}
                          <span className="font-medium text-foreground/90">
                            {formatCurrency(projection.expensesToDate ?? 0, currencyCode)}
                          </span>
                        </>
                      )}
                      {(projection.expensesToDate ?? 0) > 0 &&
                        (projection.committedExpenses ?? 0) > 0 &&
                        " · "}
                      {(projection.committedExpenses ?? 0) > 0 && (
                        <>
                          Comprometido:{" "}
                          <span className="font-medium text-foreground/90">
                            {formatCurrency(projection.committedExpenses ?? 0, currencyCode)}
                          </span>
                          {(projection.committedExpensesManual ?? 0) > 0 &&
                            (projection.committedExpensesBank ?? 0) > 0 && (
                              <span className="text-muted-foreground">
                                {" "}
                                (cartão{" "}
                                {formatCurrency(projection.committedExpensesBank ?? 0, currencyCode)}{" "}
                                · manual{" "}
                                {formatCurrency(
                                  projection.committedExpensesManual ?? 0,
                                  currencyCode,
                                )}
                                )
                              </span>
                            )}
                        </>
                      )}
                    </p>
                  )}
                  {projection.pendingSalary != null && projection.pendingSalary > 0 && (
                    <p>
                      Salário previsto:{" "}
                      <span className="font-semibold text-positive">
                        ~{formatCurrency(projection.pendingSalary, currencyCode)}
                      </span>
                    </p>
                  )}
                  {projection.pendingSalary != null && projection.pendingSalary > 0 ? (
                    <p>
                      Sobra estimada após pagamento:{" "}
                      <span
                        className={`font-semibold ${
                          projection.projectedNet >= 0 ? "text-positive" : "text-negative"
                        }`}
                      >
                        {projection.projectedNet >= 0 ? "+" : ""}
                        {formatCurrency(projection.projectedNet, currencyCode)}
                      </span>
                    </p>
                  ) : projection.salaryPending ? (
                    <p className="text-amber-700">
                      Salário ainda não recebido neste ciclo. Marque a entrada como
                      categoria &quot;Salário&quot; (ou aguarde o pagamento) para ver a
                      sobra estimada.
                    </p>
                  ) : (
                    <p>
                      Sobra estimada:{" "}
                      <span
                        className={`font-semibold ${
                          projection.projectedNet >= 0 ? "text-positive" : "text-negative"
                        }`}
                      >
                        {projection.projectedNet >= 0 ? "+" : ""}
                        {formatCurrency(projection.projectedNet, currencyCode)}
                      </span>
                    </p>
                  )}
                </>
              ) : (
                <p>
                  Projeção até fim do período:{" "}
                  <span className="font-semibold text-foreground">
                    ~{formatCurrency(projection.projectedExpense, currencyCode)} em despesas
                  </span>
                  {" · "}
                  saldo estimado{" "}
                  <span
                    className={`font-semibold ${
                      projection.projectedNet >= 0 ? "text-positive" : "text-negative"
                    }`}
                  >
                    {projection.projectedNet >= 0 ? "+" : ""}
                    {formatCurrency(projection.projectedNet, currencyCode)}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    (dia {projection.daysElapsed}/{projection.daysTotal})
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
