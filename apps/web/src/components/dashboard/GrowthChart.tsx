import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Chart as ChartJS, TooltipItem } from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import type { DashboardMonthlyPoint, DashboardMonths } from "@finance/shared";
import { formatCurrency, formatSeriesLabel } from "../../lib/format";
import { createAreaGradient, ensureChartJsRegistered } from "../../lib/chart";
import {
  baseChartOptions,
  baseScaleOptions,
  CHART_COLORS,
  flowTooltipFooter,
  flowTooltipLabel,
} from "../../lib/chartTheme";
import { ChartViewToggle } from "./ChartViewToggle";
import { cardLargeClass, fadeUp } from "./motion";

ensureChartJsRegistered();

type GrowthView = "flow" | "balance";

interface Props {
  data: DashboardMonthlyPoint[];
  months: DashboardMonths;
  currencyCode: string;
  className?: string;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-slate-500">{label}</span>
    </div>
  );
}

export function GrowthChart({ data, months, currencyCode, className }: Props) {
  const [view, setView] = useState<GrowthView>("flow");
  const isSingleMonth = months === 1;
  const showBar = isSingleMonth && view === "flow";

  const labels = useMemo(
    () =>
      isSingleMonth && view === "flow"
        ? ["Receitas", "Despesas"]
        : data.map((point) => formatSeriesLabel(point)),
    [data, isSingleMonth, view],
  );

  const flowLineData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Receitas",
          data: data.map((p) => p.income),
          borderColor: CHART_COLORS.income,
          backgroundColor: (context: { chart: ChartJS }) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return "rgba(16, 185, 129, 0.15)";
            return createAreaGradient(ctx, chartArea, CHART_COLORS.income, 0.25);
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
          borderColor: CHART_COLORS.expense,
          backgroundColor: (context: { chart: ChartJS }) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return "rgba(244, 63, 94, 0.1)";
            return createAreaGradient(ctx, chartArea, CHART_COLORS.expense, 0.15);
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

  const balanceLineData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Saldo",
          data: data.map((p) => p.net),
          borderColor: CHART_COLORS.net,
          backgroundColor: (context: { chart: ChartJS }) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return "rgba(14, 165, 233, 0.12)";
            return createAreaGradient(ctx, chartArea, CHART_COLORS.net, 0.2);
          },
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          segment: {
            borderColor: (ctx: { p0: { parsed: { y: number } }; p1: { parsed: { y: number } } }) => {
              const y0 = ctx.p0.parsed.y;
              const y1 = ctx.p1.parsed.y;
              if (y0 < 0 || y1 < 0) return CHART_COLORS.expense;
              return CHART_COLORS.net;
            },
          },
        },
      ],
    }),
    [data, labels],
  );

  const barData = useMemo(() => {
    const point = data[0];
    if (!point) return { labels: ["Receitas", "Despesas"], datasets: [] };
    return {
      labels: ["Receitas", "Despesas"],
      datasets: [
        {
          label: "Valor",
          data: [point.income, point.expenses],
          backgroundColor: [CHART_COLORS.income, CHART_COLORS.expense],
          borderRadius: 8,
          borderSkipped: false as const,
          maxBarThickness: 72,
        },
      ],
    };
  }, [data]);

  const balanceBarData = useMemo(() => {
    const point = data[0];
    if (!point) return { labels: ["Saldo"], datasets: [] };
    const positive = point.net >= 0;
    return {
      labels: ["Saldo do mês"],
      datasets: [
        {
          label: "Saldo",
          data: [point.net],
          backgroundColor: positive ? CHART_COLORS.income : CHART_COLORS.expense,
          borderRadius: 8,
          borderSkipped: false as const,
          maxBarThickness: 72,
        },
      ],
    };
  }, [data]);

  const chartData =
    view === "balance"
      ? isSingleMonth
        ? balanceBarData
        : balanceLineData
      : showBar
        ? barData
        : flowLineData;

  const options = useMemo(
    () => ({
      ...baseChartOptions(),
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<"line" | "bar">) => {
              if (view === "balance" && !isSingleMonth) {
                const value = ctx.parsed.y;
                if (value == null) return "";
                return `Saldo: ${formatCurrency(value, currencyCode)}`;
              }
              if (showBar) {
                const value = ctx.parsed.y;
                if (value == null) return "";
                const label = ctx.label ?? ctx.dataset.label;
                return `${label}: ${formatCurrency(value, currencyCode)}`;
              }
              return flowTooltipLabel(ctx, currencyCode);
            },
            footer: (items: TooltipItem<"line" | "bar">[]) => {
              if (view !== "flow" || showBar || items.length === 0) {
                if (showBar && data[0]) {
                  return flowTooltipFooter(0, [data[0]], currencyCode);
                }
                return [];
              }
              const index = items[0]?.dataIndex ?? 0;
              return flowTooltipFooter(index, data, currencyCode);
            },
          },
        },
      },
      scales: baseScaleOptions(currencyCode),
    }),
    [currencyCode, data, isSingleMonth, showBar, view],
  );

  const subtitle =
    view === "balance"
      ? isSingleMonth
        ? "Saldo líquido do mês selecionado"
        : "Saldo líquido (receitas − despesas) por mês"
      : isSingleMonth
        ? "Receitas vs despesas do mês selecionado"
        : "Receitas e despesas por mês";

  const ChartComponent = showBar || (isSingleMonth && view === "balance") ? Bar : Line;

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
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ChartViewToggle
            value={view}
            onChange={setView}
            ariaLabel="Modo de exibição do crescimento"
            options={[
              { value: "flow", label: "Fluxo" },
              { value: "balance", label: "Saldo" },
            ]}
          />
          {view === "flow" && !showBar && (
            <div className="flex gap-4 text-xs font-medium">
              <LegendDot color={CHART_COLORS.income} label="Receitas" />
              <LegendDot color={CHART_COLORS.expense} label="Despesas" />
            </div>
          )}
          {view === "balance" && !isSingleMonth && (
            <div className="flex gap-4 text-xs font-medium">
              <LegendDot color={CHART_COLORS.net} label="Saldo" />
            </div>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">
          Sem transações no período selecionado.
        </p>
      ) : (
        <div className="h-64 w-full">
          <ChartComponent data={chartData} options={options} />
        </div>
      )}
    </motion.section>
  );
}
