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
  chartColorWithAlpha,
  getChartColors,
  flowTooltipFooter,
  flowTooltipLabel,
} from "../../lib/chartTheme";
import { useTheme } from "../../lib/theme/useTheme";
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
  personId?: string;
  /** Depois dos agendamentos (compromissos com data futura). */
  availableNet?: number;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground">{label}</span>
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
  personId,
  availableNet,
}: Props) {
  const [view, setView] = useState<GrowthView>("flow");
  const isSingleMonth = months === 1;
  const { theme } = useTheme();
  const chartColors = useMemo(() => getChartColors(), [theme]);

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
          borderColor: chartColors.income,
          backgroundColor: (context: { chart: ChartJS }) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return chartColorWithAlpha(chartColors.income, 0.15);
            return createAreaGradient(ctx, chartArea, chartColors.income, 0.25);
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
          borderColor: chartColors.expense,
          backgroundColor: (context: { chart: ChartJS }) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return chartColorWithAlpha(chartColors.expense, 0.1);
            return createAreaGradient(ctx, chartArea, chartColors.expense, 0.15);
          },
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    }),
    [data, labels, chartColors],
  );

  const balanceLineData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Saldo",
          data: data.map((p) => p.net),
          borderColor: chartColors.net,
          backgroundColor: (context: { chart: ChartJS }) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return chartColorWithAlpha(chartColors.net, 0.12);
            return createAreaGradient(ctx, chartArea, chartColors.net, 0.2);
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
              if (y0 < 0 || y1 < 0) return chartColors.expense;
              return chartColors.net;
            },
          },
        },
      ],
    }),
    [data, labels, chartColors],
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
      scales: baseScaleOptions(currencyCode, chartColors),
    }),
    [chartColors, currencyCode, data, view],
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
          <h2 className="font-display text-base font-semibold text-foreground">
            Painel do Período
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {periodLabel ? `${periodLabel} · ` : ""}
            {subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AssistantSpotlightButton
            label="Analisar período"
            message={`Analise meu desempenho financeiro no período: ${periodLabel ?? "atual"}`}
            contextKey="growth_chart"
            title="Painel do período"
            contextHint={JSON.stringify({
              source: "growth_chart",
              periodLabel,
              months,
              view,
            })}
            personId={personId}
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
              <LegendDot color={chartColors.income} label="Receitas" />
              <LegendDot color={chartColors.expense} label="Despesas" />
            </div>
          )}
          {!isSingleMonth && view === "balance" && (
            <div className="flex gap-4 text-xs font-medium">
              <LegendDot color={chartColors.net} label="Saldo" />
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0">
        {!hasGrowthData ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
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
            availableNet={availableNet}
          />
        ) : (
          <div className="h-56 w-full">
            <Line data={chartData as typeof flowLineData} options={lineOptions} />
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-app-border/60 pt-8">
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
