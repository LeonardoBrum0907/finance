import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import type { SimulationMonthlyPoint } from "@finance/shared";
import { formatCurrency, formatSeriesLabel } from "../../lib/format";
import { ensureChartJsRegistered } from "../../lib/chart";
import { baseScaleOptions, CHART_COLORS } from "../../lib/chartTheme";

ensureChartJsRegistered();

interface Props {
  data: SimulationMonthlyPoint[];
  currencyCode: string;
}

export function ImpactChart({ data, currencyCode }: Props) {
  const chartData = useMemo(
    () => ({
      labels: data.map((p) => p.label ?? formatSeriesLabel(p)),
      datasets: [
        {
          label: "Sem cenário",
          data: data.map((p) => p.baselineSurplus),
          borderColor: CHART_COLORS.net,
          backgroundColor: "rgba(14, 165, 233, 0.08)",
          fill: false,
          tension: 0.3,
          pointRadius: 2,
          borderWidth: 2,
          borderDash: [4, 4],
        },
        {
          label: "Com cenário",
          data: data.map((p) => p.scenarioSurplus),
          borderColor: CHART_COLORS.income,
          backgroundColor: "rgba(16, 185, 129, 0.12)",
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          borderWidth: 2.5,
        },
      ],
    }),
    [data],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: {
          display: true,
          position: "bottom" as const,
          labels: { boxWidth: 12, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
              const value = ctx.parsed.y;
              if (value == null) return "";
              return `${ctx.dataset.label}: ${formatCurrency(value, currencyCode)}`;
            },
          },
        },
      },
      scales: baseScaleOptions(currencyCode),
    }),
    [currencyCode],
  );

  if (data.length === 0) return null;

  return (
    <div className="h-64 w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}
