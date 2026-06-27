import type { ChartOptions, TooltipItem } from "chart.js";
import { formatCurrency, formatCurrencyCompact } from "./format";
import { readCssColor, readCssColors } from "./theme/applyTheme";

function parseColorChannels(color: string): [number, number, number] | null {
  const rgbMatch = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  }

  const normalized = color.replace("#", "");
  if (normalized.length === 6) {
    return [
      parseInt(normalized.slice(0, 2), 16),
      parseInt(normalized.slice(2, 4), 16),
      parseInt(normalized.slice(4, 6), 16),
    ];
  }

  return null;
}

export function chartColorWithAlpha(color: string, alpha: number): string {
  const channels = parseColorChannels(color);
  if (!channels) return color;
  const [r, g, b] = channels;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface ChartColors {
  income: string;
  expense: string;
  net: string;
  projection: string;
  target: string;
  grid: string;
  tick: string;
  tickMuted: string;
  categories: readonly string[];
}

export function getChartColors(): ChartColors {
  const categories = readCssColors([
    "--chart-cat-1",
    "--chart-cat-2",
    "--chart-cat-3",
    "--chart-cat-4",
    "--chart-cat-5",
  ]);

  return {
    income: readCssColor("--chart-income"),
    expense: readCssColor("--chart-expense"),
    net: readCssColor("--chart-net"),
    projection: readCssColor("--chart-projection"),
    target: readCssColor("--chart-target"),
    grid: readCssColor("--chart-grid"),
    tick: readCssColor("--chart-tick"),
    tickMuted: readCssColor("--chart-tick-muted"),
    categories,
  };
}

/** @deprecated Use getChartColors() for theme-aware colors */
export const CHART_COLORS = {
  income: "#10B981",
  expense: "#F43F5E",
  net: "#0EA5E9",
  grid: "#F1F5F9",
  tick: "#94A3B8",
  tickMuted: "#CBD5E1",
  categories: ["#10B981", "#F59E0B", "#0EA5E9", "#6366F1", "#94A3B8"] as const,
};

export function categoryColor(index: number, colors?: ChartColors): string {
  const palette = colors?.categories ?? getChartColors().categories;
  return palette[index % palette.length] ?? palette[0]!;
}

export function baseScaleOptions(currencyCode: string, colors?: ChartColors) {
  const chartColors = colors ?? getChartColors();
  return {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: chartColors.tick, font: { size: 11, weight: 600 as const } },
    },
    y: {
      grid: { color: chartColors.grid },
      border: { display: false },
      ticks: {
        color: chartColors.tickMuted,
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
