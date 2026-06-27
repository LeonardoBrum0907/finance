import { useCallback, useMemo, useState } from "react";
import type { TooltipItem } from "chart.js";
import { motion } from "framer-motion";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  ArrowLeftRight,
  Car,
  Church,
  Heart,
  Home,
  Layers,
  type LucideIcon,
  Receipt,
  ShoppingBag,
  Sparkles,
  Utensils,
  Wifi,
  Wrench,
} from "lucide-react";
import type { CategoryChartSelection, DashboardCategoryGroup, DashboardCategoryPoint } from "@finance/shared";
import { formatCurrency, formatPercent } from "../../lib/format";
import { ensureChartJsRegistered } from "../../lib/chart";
import {
  baseChartOptions,
  calcCategoryChange,
  categoryColor,
  categoryDoughnutTooltip,
  getChartColors,
} from "../../lib/chartTheme";
import { useTheme } from "../../lib/theme/useTheme";
import { ChartViewToggle } from "./ChartViewToggle";
import { cardLargeClass, fadeUp } from "./motion";

ensureChartJsRegistered();

type CategoryView = "doughnut" | "bars";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Alimentação: Utensils,
  Transporte: Car,
  Compras: ShoppingBag,
  Assinaturas: Wifi,
  Doações: Heart,
  Igreja: Church,
  "Saúde e bem-estar": Sparkles,
  "Contas fixas": Home,
  Serviços: Wrench,
  Transferências: ArrowLeftRight,
  "Tarifas e impostos": Receipt,
  Outros: Layers,
};

function categoryIcon(label: string): LucideIcon {
  return CATEGORY_ICONS[label] ?? Layers;
}

interface CategoryRow {
  category: string;
  total: number;
  count: number;
  percent: number;
  mergedGroups?: DashboardCategoryGroup[];
}

interface Props {
  data: DashboardCategoryPoint[];
  previousCategories?: DashboardCategoryPoint[];
  currencyCode: string;
  className?: string;
  onCategorySelect?: (selection: CategoryChartSelection) => void;
}

function buildChartRows(data: DashboardCategoryPoint[]): CategoryRow[] {
  const top = data.slice(0, 5);
  const others = data.slice(5);
  const othersTotal = others.reduce((sum, c) => sum + c.total, 0);
  const rows: CategoryRow[] =
    othersTotal > 0
      ? [
          ...top.map((c) => ({
            category: c.category,
            total: c.total,
            count: c.count,
            percent: 0,
          })),
          {
            category: "Outros",
            total: othersTotal,
            count: others.reduce((sum, c) => sum + c.count, 0),
            percent: 0,
            mergedGroups: others.map((c) => c.category as DashboardCategoryGroup),
          },
        ]
      : top.map((c) => ({
          category: c.category,
          total: c.total,
          count: c.count,
          percent: 0,
        }));

  const total = rows.reduce((sum, c) => sum + c.total, 0);
  return rows.map((c) => ({
    ...c,
    percent: total > 0 ? (c.total / total) * 100 : 0,
  }));
}

export function CategoryChart({
  data,
  previousCategories = [],
  currencyCode,
  className,
  onCategorySelect,
}: Props) {
  const [view, setView] = useState<CategoryView>("doughnut");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { theme } = useTheme();
  const chartColors = useMemo(() => getChartColors(), [theme]);

  const withPercent = useMemo(() => buildChartRows(data), [data]);
  const total = withPercent.reduce((sum, c) => sum + c.total, 0);

  const prevMap = useMemo(
    () => new Map(previousCategories.map((c) => [c.category, c.total])),
    [previousCategories],
  );

  const colors = withPercent.map((_, i) => categoryColor(i, chartColors));

  const doughnutData = useMemo(
    () => ({
      labels: withPercent.map((c) => c.category),
      datasets: [
        {
          data: withPercent.map((c) => c.total),
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    }),
    [withPercent, colors],
  );

  const barData = useMemo(
    () => ({
      labels: withPercent.map((c) => c.category),
      datasets: [
        {
          label: "Despesas",
          data: withPercent.map((c) => c.total),
          backgroundColor: colors,
          borderRadius: 6,
          borderSkipped: false as const,
          maxBarThickness: 28,
        },
      ],
    }),
    [withPercent, colors],
  );

  const doughnutOptions = useMemo(
    () => ({
      ...baseChartOptions(),
      cutout: "72%",
      onHover: (_: unknown, elements: { index: number }[]) => {
        setActiveIndex(elements[0]?.index ?? null);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<"doughnut">) =>
              categoryDoughnutTooltip(ctx, currencyCode, withPercent),
          },
        },
      },
    }),
    [chartColors, currencyCode, withPercent],
  );

  const barOptions = useMemo(
    () => ({
      ...baseChartOptions(),
      indexAxis: "y" as const,
      onHover: (_: unknown, elements: { index: number }[]) => {
        setActiveIndex(elements[0]?.index ?? null);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<"bar">) => {
              const value = ctx.parsed.x;
              if (value == null) return "";
              const item = withPercent[ctx.dataIndex];
              if (!item) return "";
              const lines = [
                `${item.category}: ${formatCurrency(value, currencyCode)}`,
                `${item.percent.toFixed(1)}% do total`,
              ];
              if (item.count > 0) {
                lines.push(`${item.count} transaç${item.count === 1 ? "ão" : "ões"}`);
              }
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: chartColors.grid },
          border: { display: false },
          ticks: {
            color: chartColors.tickMuted,
            font: { size: 10 },
            callback: (value: string | number) =>
              formatCurrency(Number(value), currencyCode),
          },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: chartColors.tick,
            font: { size: 11, weight: 600 as const },
          },
        },
      },
    }),
    [chartColors, currencyCode, withPercent],
  );

  const handleCategoryClick = useCallback(
    (index: number | undefined) => {
      if (index == null) return;
      const row = withPercent[index];
      if (!row) return;

      setActiveIndex(index);

      if (!onCategorySelect) return;

      if (row.mergedGroups && row.mergedGroups.length > 0) {
        onCategorySelect({ kind: "merged", groups: row.mergedGroups });
      } else {
        onCategorySelect({ kind: "single", group: row.category as DashboardCategoryGroup });
      }
    },
    [withPercent, onCategorySelect],
  );

  const handleDoughnutClick = useCallback(
    (_: unknown, elements: { index: number }[]) => {
      handleCategoryClick(elements[0]?.index);
    },
    [handleCategoryClick],
  );

  const handleBarClick = useCallback(
    (_: unknown, elements: { index: number }[]) => {
      handleCategoryClick(elements[0]?.index);
    },
    [handleCategoryClick],
  );

  const handleListClick = useCallback(
    (index: number) => {
      handleCategoryClick(index);
    },
    [handleCategoryClick],
  );

  const handleListHover = useCallback((index: number | null) => {
    setActiveIndex(index);
  }, []);

  return (
    <motion.section
      custom={3}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={`${cardLargeClass} flex flex-col ${className ?? ""}`}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            Despesas por Categoria
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Distribuição de despesas no período selecionado
          </p>
        </div>
        <ChartViewToggle
          value={view}
          onChange={setView}
          ariaLabel="Modo de exibição por categoria"
          options={[
            { value: "doughnut", label: "Rosca" },
            { value: "bars", label: "Barras" },
          ]}
        />
      </div>

      {withPercent.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma despesa categorizada no período.
        </p>
      ) : (
        <>
          {view === "doughnut" ? (
            <div className="relative mx-auto mb-6 h-44 w-full max-w-[180px] cursor-pointer">
              <Doughnut
                data={doughnutData}
                options={{
                  ...doughnutOptions,
                  onClick: handleDoughnutClick,
                }}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Total Gasto
                </span>
                <span className="font-display text-sm font-bold text-foreground">
                  {formatCurrency(total, currencyCode)}
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-6 h-52 w-full cursor-pointer">
              <Bar
                data={barData}
                options={{
                  ...barOptions,
                  onClick: handleBarClick,
                }}
              />
            </div>
          )}

          <ul className="flex flex-col gap-2.5">
            {withPercent.map((cat, i) => {
              const Icon = categoryIcon(cat.category);
              const color = colors[i];
              const isActive = activeIndex === i;
              const prevTotal = prevMap.get(cat.category);
              const change =
                prevTotal !== undefined
                  ? calcCategoryChange(cat.total, prevTotal)
                  : null;

              return (
                <li
                  key={cat.category}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleListClick(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleListClick(i);
                    }
                  }}
                  onMouseEnter={() => handleListHover(i)}
                  onMouseLeave={() => handleListHover(null)}
                  className={`cursor-pointer rounded-xl border px-3 py-2 transition ${
                    isActive
                      ? "border-app-border bg-app-surface shadow-sm"
                      : "border-app-border/60 bg-app-bg"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-app-border/50 bg-app-surface">
                        <Icon className="h-3.5 w-3.5" style={{ color }} />
                      </div>
                      <span className="truncate text-xs font-semibold text-foreground">
                        {cat.category}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block text-xs font-bold text-foreground">
                        {formatCurrency(cat.total, currencyCode)}
                      </span>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {cat.percent.toFixed(1)}%
                        </span>
                        {change !== null && Math.abs(change) >= 1 && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              change > 0
                                ? "bg-negative/10 text-negative"
                                : "bg-positive/10 text-positive"
                            }`}
                          >
                            {formatPercent(change)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${cat.percent}%`,
                        backgroundColor: color,
                        opacity: isActive ? 1 : 0.75,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </motion.section>
  );
}
