import { useCallback, useMemo, useState } from "react";
import type { TooltipItem } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import {
  ArrowLeftRight, Car, Church, Heart, Home, Layers, type LucideIcon,
  Receipt, ShoppingBag, Sparkles, Utensils, Wifi, Wrench,
} from "lucide-react";
import type { CategoryChartSelection, DashboardCategoryGroup, DashboardCategoryPoint } from "@finance/shared";
import { formatCurrency, formatPercent } from "../../lib/format";
import { ensureChartJsRegistered } from "../../lib/chart";
import { baseChartOptions, calcCategoryChange, categoryColor, categoryDoughnutTooltip } from "../../lib/chartTheme";

ensureChartJsRegistered();

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Alimentação: Utensils, Transporte: Car, Compras: ShoppingBag, Assinaturas: Wifi,
  Doações: Heart, Igreja: Church, "Saúde e bem-estar": Sparkles, "Contas fixas": Home,
  Serviços: Wrench, Transferências: ArrowLeftRight, "Tarifas e impostos": Receipt, Outros: Layers,
};

function categoryIcon(label: string): LucideIcon { return CATEGORY_ICONS[label] ?? Layers; }

interface CategoryRow {
  category: string; total: number; count: number; percent: number;
  mergedGroups?: DashboardCategoryGroup[];
}

interface Props {
  data: DashboardCategoryPoint[];
  previousCategories?: DashboardCategoryPoint[];
  currencyCode: string;
  onCategorySelect?: (selection: CategoryChartSelection) => void;
  compact?: boolean;
  layout?: "stack" | "row";
}

function buildChartRows(data: DashboardCategoryPoint[]): CategoryRow[] {
  const top = data.slice(0, 5);
  const others = data.slice(5);
  const othersTotal = others.reduce((sum, c) => sum + c.total, 0);
  const rows: CategoryRow[] = othersTotal > 0
    ? [
        ...top.map((c) => ({ category: c.category, total: c.total, count: c.count, percent: 0 })),
        { category: "Outros", total: othersTotal, count: others.reduce((s, c) => s + c.count, 0), percent: 0,
          mergedGroups: others.map((c) => c.category as DashboardCategoryGroup) },
      ]
    : top.map((c) => ({ category: c.category, total: c.total, count: c.count, percent: 0 }));
  const total = rows.reduce((sum, c) => sum + c.total, 0);
  return rows.map((c) => ({ ...c, percent: total > 0 ? (c.total / total) * 100 : 0 }));
}

export function CategoryBreakdown({
  data,
  previousCategories = [],
  currencyCode,
  onCategorySelect,
  compact = false,
  layout = "stack",
}: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const withPercent = useMemo(() => buildChartRows(data), [data]);
  const total = withPercent.reduce((sum, c) => sum + c.total, 0);
  const prevMap = useMemo(() => new Map(previousCategories.map((c) => [c.category, c.total])), [previousCategories]);
  const colors = withPercent.map((_, i) => categoryColor(i));

  const doughnutData = useMemo(() => ({
    labels: withPercent.map((c) => c.category),
    datasets: [{ data: withPercent.map((c) => c.total), backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }],
  }), [withPercent, colors]);

  const doughnutOptions = useMemo(() => ({
    ...baseChartOptions(), cutout: "72%",
    onHover: (_: unknown, elements: { index: number }[]) => { setActiveIndex(elements[0]?.index ?? null); },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: TooltipItem<"doughnut">) => categoryDoughnutTooltip(ctx, currencyCode, withPercent) } } },
  }), [currencyCode, withPercent]);

  const handleCategoryClick = useCallback((index: number | undefined) => {
    if (index == null) return;
    const row = withPercent[index];
    if (!row) return;
    setActiveIndex(index);
    if (!onCategorySelect) return;
    if (row.mergedGroups?.length) onCategorySelect({ kind: "merged", groups: row.mergedGroups });
    else onCategorySelect({ kind: "single", group: row.category as DashboardCategoryGroup });
  }, [withPercent, onCategorySelect]);

  if (withPercent.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Nenhuma despesa categorizada no período.</p>;
  }

  const isRow = layout === "row";
  const doughnutClass = isRow
    ? "h-44 w-full max-w-[180px] shrink-0"
    : compact
      ? "h-36 max-w-[140px]"
      : "h-44 max-w-[180px]";

  const list = (
    <ul className={`flex flex-col gap-2 ${isRow ? "min-w-0 flex-1" : "flex-1"}`}>
        {withPercent.map((cat, i) => {
          const Icon = categoryIcon(cat.category);
          const color = colors[i];
          const isActive = activeIndex === i;
          const prevTotal = prevMap.get(cat.category);
          const change = prevTotal !== undefined ? calcCategoryChange(cat.total, prevTotal) : null;
          return (
            <li key={cat.category} role="button" tabIndex={0}
              onClick={() => handleCategoryClick(i)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCategoryClick(i); } }}
              onMouseEnter={() => setActiveIndex(i)} onMouseLeave={() => setActiveIndex(null)}
              className={`cursor-pointer rounded-xl border px-3 py-2 transition ${isActive ? "border-slate-200 bg-white shadow-sm" : "border-slate-100 bg-slate-50"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-200/50 bg-white">
                    <Icon className="h-3 w-3" style={{ color }} />
                  </div>
                  <span className="truncate text-xs font-semibold text-slate-800">{cat.category}</span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block text-xs font-bold text-slate-800">{formatCurrency(cat.total, currencyCode)}</span>
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="font-mono text-[10px] text-slate-400">{cat.percent.toFixed(1)}%</span>
                    {change !== null && Math.abs(change) >= 1 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${change > 0 ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600"}`}>{formatPercent(change)}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${cat.percent}%`, backgroundColor: color, opacity: isActive ? 1 : 0.75 }} />
              </div>
            </li>
          );
        })}
    </ul>
  );

  const doughnut = (
    <div className={`relative mx-auto w-full cursor-pointer ${doughnutClass} ${isRow ? "" : "mb-4"}`}>
      <Doughnut
        data={doughnutData}
        options={{
          ...doughnutOptions,
          onClick: (_: unknown, els: { index: number }[]) => handleCategoryClick(els[0]?.index),
        }}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Total Gasto
        </span>
        <span className="font-display text-sm font-bold text-slate-900">
          {formatCurrency(total, currencyCode)}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <div className={isRow ? "mb-4" : "mb-1"}>
        <h3 className="font-display text-sm font-semibold text-slate-900">Despesas por Categoria</h3>
        <p className="text-[11px] text-slate-400">Clique para filtrar transações</p>
      </div>

      {isRow ? (
        <div className="grid items-start gap-6 sm:grid-cols-[auto_1fr]">
          {doughnut}
          {list}
        </div>
      ) : (
        <>
          {doughnut}
          {list}
        </>
      )}
    </div>
  );
}
