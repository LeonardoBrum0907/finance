import type { ChartOptions, TooltipItem } from "chart.js";
import { formatCurrency, formatCurrencyCompact } from "./format";

export const CHART_COLORS = {
  income: "#10B981",
  expense: "#F43F5E",
  net: "#0EA5E9",
  grid: "#F1F5F9",
  tick: "#94A3B8",
  tickMuted: "#CBD5E1",
  categories: ["#10B981", "#F59E0B", "#0EA5E9", "#6366F1", "#94A3B8"] as const,
};

export function categoryColor(index: number): string {
  return CHART_COLORS.categories[index % CHART_COLORS.categories.length];
}

export function baseScaleOptions(currencyCode: string) {
  return {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: CHART_COLORS.tick, font: { size: 11, weight: 600 as const } },
    },
    y: {
      grid: { color: CHART_COLORS.grid },
      border: { display: false },
      ticks: {
        color: CHART_COLORS.tickMuted,
        font: { size: 10 },
        callback: (value: string | number) =>
          formatCurrencyCompact(Number(value), currencyCode),
      },
    },
  };
}

export function flowTooltipLabel(
  ctx: TooltipItem<"line" | "bar">,
  currencyCode: string,
): string {
  const value = ctx.parsed.y;
  if (value == null) return "";
  return `${ctx.dataset.label}: ${formatCurrency(value, currencyCode)}`;
}

export function flowTooltipFooter(
  dataIndex: number,
  points: { income: number; expenses: number; net: number }[],
  currencyCode: string,
): string[] {
  const point = points[dataIndex];
  if (!point) return [];
  return [`Saldo: ${formatCurrency(point.net, currencyCode)}`];
}

export function categoryDoughnutTooltip(
  ctx: TooltipItem<"doughnut">,
  currencyCode: string,
  items: { total: number; count: number; percent: number }[],
): string[] {
  const value = ctx.parsed;
  if (value == null) return [];
  const item = items[ctx.dataIndex];
  const lines = [
    `${ctx.label}: ${formatCurrency(value, currencyCode)}`,
    `${item?.percent.toFixed(1) ?? "0.0"}% do total`,
  ];
  if (item && item.count > 0) {
    lines.push(`${item.count} transaç${item.count === 1 ? "ão" : "ões"}`);
  }
  return lines;
}

export function baseChartOptions(): Pick<ChartOptions, "responsive" | "maintainAspectRatio" | "interaction"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
  };
}

export function calcCategoryChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
