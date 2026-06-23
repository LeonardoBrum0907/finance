import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import type { SavingsPathPoint } from "@finance/shared";
import { formatCurrency, formatMonthLabel } from "../../lib/format";
import { ensureChartJsRegistered } from "../../lib/chart";
import { baseScaleOptions, CHART_COLORS } from "../../lib/chartTheme";

ensureChartJsRegistered();

interface Props {
  data: SavingsPathPoint[];
  currencyCode: string;
  monthlySurplus: number;
  monthlyContribution: number;
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
  totalCurrent,
  totalTarget,
  projectedCompletionMonth,
}: Props) {
  const targetAmount = data[0]?.targetAmount ?? totalTarget;

  const chartData = useMemo(
    () => ({
      labels: data.map(pointLabel),
      datasets: [
        {
          label: "Projeção acumulada",
          data: data.map((point) => point.projectedAmount),
          borderColor: CHART_COLORS.income,
          backgroundColor: "rgba(16, 185, 129, 0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: data.map((point) => (point.label ? 5 : 3)),
          pointHoverRadius: 6,
          pointBackgroundColor: data.map((point) =>
            point.label === "Meta atingida" ? "#059669" : CHART_COLORS.income,
          ),
          borderWidth: 2.5,
        },
        ...(targetAmount > 0
          ? [
              {
                label: "Meta total",
                data: data.map(() => targetAmount),
                borderColor: "rgba(100, 116, 139, 0.45)",
                borderDash: [6, 4],
                pointRadius: 0,
                fill: false,
                tension: 0,
              },
            ]
          : []),
      ],
    }),
    [data, targetAmount],
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
      scales: baseScaleOptions(currencyCode),
    }),
    [currencyCode, data],
  );

  const progressPercent =
    totalTarget > 0 ? Math.min(100, Math.round((totalCurrent / totalTarget) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">Caminho de Poupança</h2>
          <p className="mt-1 text-sm text-slate-500">
            Projeção até atingir todas as metas com o aporte mensal do plano ou a sobra média.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Poupança total
            </p>
            <p className="font-mono text-sm font-bold text-slate-900">
              {formatCurrency(totalCurrent, currencyCode)}
            </p>
            <p className="text-[10px] text-slate-400">{progressPercent}% da meta</p>
          </div>
          <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Meta total
            </p>
            <p className="font-mono text-sm font-bold text-slate-900">
              {formatCurrency(totalTarget, currencyCode)}
            </p>
            {projectedCompletionMonth && (
              <p className="text-[10px] text-slate-400">
                Previsão: {formatMonthLabel(projectedCompletionMonth)}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Aporte/mês
            </p>
            <p className="font-mono text-sm font-bold text-emerald-700">
              {formatCurrency(monthlyContribution, currencyCode)}
            </p>
            {monthlyContribution !== monthlySurplus && (
              <p className="text-[10px] text-emerald-600">
                Sobra média: {formatCurrency(monthlySurplus, currencyCode)}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="h-64">
        {data.length > 0 ? (
          <Line data={chartData} options={options} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Crie objetivos para ver a projeção.
          </div>
        )}
      </div>
    </div>
  );
}
