import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Chart as ChartJS, TooltipItem } from "chart.js";
import { Line } from "react-chartjs-2";
import type { DashboardMonthlyPoint } from "@finance/shared";
import { formatCurrency, formatCurrencyCompact, formatMonthLabel } from "../../lib/format";
import { createAreaGradient, ensureChartJsRegistered } from "../../lib/chart";
import { cardLargeClass, fadeUp } from "./motion";

ensureChartJsRegistered();

interface Props {
  data: DashboardMonthlyPoint[];
  currencyCode: string;
  className?: string;
}

export function GrowthChart({ data, currencyCode, className }: Props) {
  const labels = useMemo(
    () => data.map((point) => formatMonthLabel(point.month)),
    [data],
  );

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Receitas",
          data: data.map((p) => p.income),
          borderColor: "#10B981",
          backgroundColor: (context: { chart: ChartJS }) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return "rgba(16, 185, 129, 0.15)";
            return createAreaGradient(ctx, chartArea, "#10B981", 0.25);
          },
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: "Despesas",
          data: data.map((p) => p.expenses),
          borderColor: "#94A3B8",
          backgroundColor: (context: { chart: ChartJS }) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return "rgba(148, 163, 184, 0.1)";
            return createAreaGradient(ctx, chartArea, "#94A3B8", 0.15);
          },
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    }),
    [data, labels],
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
            label: (ctx: TooltipItem<"line">) => {
              const value = ctx.parsed.y;
              if (value == null) return "";
              return `${ctx.dataset.label}: ${formatCurrency(value, currencyCode)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: "#94A3B8", font: { size: 11, weight: 600 as const } },
        },
        y: {
          grid: { color: "#F1F5F9" },
          border: { display: false },
          ticks: {
            color: "#CBD5E1",
            font: { size: 10 },
            callback: (value: string | number) =>
              formatCurrencyCompact(Number(value), currencyCode),
          },
        },
      },
    }),
    [currencyCode],
  );

  return (
    <motion.section
      custom={2}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={`${cardLargeClass} ${className ?? ""}`}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Crescimento Financeiro
          </h2>
          <p className="text-[11px] text-slate-400">
            Entradas acumuladas vs Despesas por período
          </p>
        </div>
        <div className="flex gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-500">Receitas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            <span className="text-slate-500">Despesas</span>
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">
          Sem transações no período selecionado.
        </p>
      ) : (
        <div className="h-64 w-full">
          <Line data={chartData} options={options} />
        </div>
      )}
    </motion.section>
  );
}
