import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Chart as ChartJS, TooltipItem } from "chart.js";
import { Line } from "react-chartjs-2";
import type {
  CategoryChartSelection,
  DashboardCategoryPoint,
  DashboardGrowthMetrics,
  DashboardMonthlyPoint,
  DashboardMonths,
  PeriodMode,
} from "@finance/shared";
import { formatCurrency, formatSeriesLabel } from "../../lib/format";
import { createAreaGradient, ensureChartJsRegistered } from "../../lib/chart";
import {
  baseChartOptions,
  baseScaleOptions,
  CHART_COLORS,
  flowTooltipFooter,
  flowTooltipLabel,
} from "../../lib/chartTheme";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { ChartViewToggle } from "./ChartViewToggle";
import { GrowthSingleMonthView } from "./GrowthSingleMonthView";
import { AssistantSpotlightButton } from "../chat/AssistantSpotlightButton";
import { cardLargeClass, fadeUp } from "./motion";

ensureChartJsRegistered();

type GrowthView = "flow" | "balance";

interface Props {
  data: DashboardMonthlyPoint[];
  months: DashboardMonths;
  currencyCode: string;
  growthMetrics: DashboardGrowthMetrics;
  categories: DashboardCategoryPoint[];
  previousCategories?: DashboardCategoryPoint[];
  periodLabel?: string;
  periodMode?: PeriodMode;
  hideIncomeBreakdown?: boolean;
  onCategorySelect?: (selection: CategoryChartSelection) => void;
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

export function GrowthChart({
  data,
  months,
  currencyCode,
  growthMetrics,
  categories,
  previousCategories = [],
  periodLabel,
  periodMode = "calendar",
  hideIncomeBreakdown = false,
  onCategorySelect,
  className,
}: Props) {
  const [view, setView] = useState<GrowthView>("flow");
  const isSingleMonth = months === 1;

  const labels = useMemo(
    () => data.map((point) => formatSeriesLabel(point)),
    [data],
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

  const chartData = view === "balance" ? balanceLineData : flowLineData;

  const lineOptions = useMemo(
    () => ({
      ...baseChartOptions(),
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<"line">) => {
              if (view === "balance") {
                const value = ctx.parsed.y;
                if (value == null) return "";
                return `Saldo: ${formatCurrency(value, currencyCode)}`;
              }
              return flowTooltipLabel(ctx, currencyCode);
            },
            footer: (items: TooltipItem<"line">[]) => {
              if (view !== "flow" || items.length === 0) return [];
              const index = items[0]?.dataIndex ?? 0;
              return flowTooltipFooter(index, data, currencyCode);
            },
          },
        },
      },
      scales: baseScaleOptions(currencyCode),
    }),
    [currencyCode, data, view],
  );

  const subtitle =
    view === "balance"
      ? isSingleMonth
        ? "Saldo líquido do período selecionado"
        : "Saldo líquido (receitas − despesas) por mês"
      : isSingleMonth
        ? "Receitas vs despesas do período selecionado"
        : "Receitas e despesas por mês";

  const hasGrowthData = data.length > 0;

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
            Painel do Período
          </h2>
          <p className="text-[11px] text-slate-400">
            {periodLabel ? `${periodLabel} · ` : ""}
            {subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AssistantSpotlightButton
            label="Analisar período"
            message={`Analise meu desempenho financeiro no período: ${periodLabel ?? "atual"}`}
            contextHint={JSON.stringify({
              source: "growth_chart",
              periodLabel,
              months,
              view,
            })}
          />
          <ChartViewToggle
            value={view}
            onChange={setView}
            ariaLabel="Modo de exibição do crescimento"
            options={[
              { value: "flow", label: "Fluxo" },
              { value: "balance", label: "Saldo" },
            ]}
          />
          {!isSingleMonth && view === "flow" && (
            <div className="flex gap-4 text-xs font-medium">
              <LegendDot color={CHART_COLORS.income} label="Receitas" />
              <LegendDot color={CHART_COLORS.expense} label="Despesas" />
            </div>
          )}
          {!isSingleMonth && view === "balance" && (
            <div className="flex gap-4 text-xs font-medium">
              <LegendDot color={CHART_COLORS.net} label="Saldo" />
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0">
        {!hasGrowthData ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Sem transações no período selecionado.
          </p>
        ) : isSingleMonth ? (
          <GrowthSingleMonthView
            point={data[0]!}
            growthMetrics={growthMetrics}
            currencyCode={currencyCode}
            view={view}
            periodMode={periodMode}
            hideIncomeBreakdown={hideIncomeBreakdown}
          />
        ) : (
          <div className="h-56 w-full">
            <Line data={chartData as typeof flowLineData} options={lineOptions} />
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-slate-100 pt-8">
        <CategoryBreakdown
          data={categories}
          previousCategories={previousCategories}
          currencyCode={currencyCode}
          onCategorySelect={onCategorySelect}
          layout="row"
        />
      </div>
    </motion.section>
  );
}
