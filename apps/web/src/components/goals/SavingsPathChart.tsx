import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import type { SavingsPathPoint } from "@finance/shared";
import { formatCurrency, formatMonthLabel } from "../../lib/format";
import { ensureChartJsRegistered } from "../../lib/chart";
import { baseScaleOptions, chartColorWithAlpha, getChartColors } from "../../lib/chartTheme";
import { useTheme } from "../../lib/theme/useTheme";

ensureChartJsRegistered();

interface Props {
  data: SavingsPathPoint[];
  currencyCode: string;
  monthlySurplus: number;
  monthlyContribution: number;
  surplusLabel?: string;
  totalCurrent: number;
  totalTarget: number;
  projectedCompletionMonth: string | null;
}

function pointLabel(point: SavingsPathPoint): string {
  return point.label ?? formatMonthLabel(point.month);
}

export function SavingsPathChart({
  data,
  currencyCode,
  monthlySurplus,
  monthlyContribution,
  surplusLabel = "sobra média",
  totalCurrent,
  totalTarget,
  projectedCompletionMonth,
}: Props) {
  const { theme } = useTheme();
  const chartColors = useMemo(() => getChartColors(), [theme]);
  const targetAmount = data[0]?.targetAmount ?? totalTarget;

  const chartData = useMemo(
    () => ({
      labels: data.map(pointLabel),
      datasets: [
        {
          label: "Projeção acumulada",
          data: data.map((point) => point.projectedAmount),
          borderColor: chartColors.projection,
          backgroundColor: chartColorWithAlpha(chartColors.projection, 0.14),
          fill: true,
          tension: 0.35,
          pointRadius: data.map((point) => (point.label ? 5 : 3)),
          pointHoverRadius: 6,
          pointBackgroundColor: data.map((point) =>
            point.label === "Meta atingida"
              ? chartColors.projection
              : chartColorWithAlpha(chartColors.projection, 0.85),
          ),
          pointBorderColor: chartColors.projection,
          borderWidth: 2.5,
        },
        ...(targetAmount > 0
          ? [
              {
                label: "Meta total",
                data: data.map(() => targetAmount),
                borderColor: chartColorWithAlpha(chartColors.target, 0.55),
                borderDash: [6, 4],
                pointRadius: 0,
                fill: false,
                tension: 0,
              },
            ]
          : []),
      ],
    }),
    [chartColors, data, targetAmount],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items: { dataIndex: number }[]) => {
              const point = data[items[0]?.dataIndex ?? 0];
              if (!point) return "";
              return point.label ?? formatMonthLabel(point.month);
            },
            label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
              const value = ctx.parsed.y ?? 0;
              if (ctx.dataset.label === "Meta total") {
                return `Meta total: ${formatCurrency(value, currencyCode)}`;
              }
              return `Projeção: ${formatCurrency(value, currencyCode)}`;
            },
          },
        },
      },
      scales: baseScaleOptions(currencyCode, chartColors),
    }),
    [chartColors, currencyCode, data],
  );

  const progressPercent =
    totalTarget > 0 ? Math.min(100, Math.round((totalCurrent / totalTarget) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-app-border/60 bg-app-surface p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Caminho de Poupança</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Projeção até atingir todas as metas com o aporte mensal do plano ou a sobra média.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-app-border/60 bg-app-bg/50 px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Poupança total
            </p>
            <p className="font-mono text-sm font-bold text-foreground">
              {formatCurrency(totalCurrent, currencyCode)}
            </p>
            <p className="text-[10px] text-muted-foreground">{progressPercent}% da meta</p>
          </div>
          <div className="rounded-xl border border-app-border/60 bg-app-bg/50 px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Meta total
            </p>
            <p className="font-mono text-sm font-bold text-foreground">
              {formatCurrency(totalTarget, currencyCode)}
            </p>
            {projectedCompletionMonth && (
              <p className="text-[10px] text-muted-foreground">
                Previsão: {formatMonthLabel(projectedCompletionMonth)}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-positive/20 bg-positive/10 px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-positive">
              Aporte estimado
            </p>
            <p className="font-mono text-sm font-bold text-positive">
              {formatCurrency(monthlyContribution, currencyCode)}
            </p>
            {monthlyContribution !== monthlySurplus && (
              <p className="text-[10px] text-positive">
                {surplusLabel}: {formatCurrency(monthlySurplus, currencyCode)}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="h-64">
        {data.length > 0 ? (
          <Line data={chartData} options={options} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Crie objetivos para ver a projeção.
          </div>
        )}
      </div>
    </div>
  );
}
