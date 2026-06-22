import { useMemo } from "react";
import type { TooltipItem } from "chart.js";
import { motion } from "framer-motion";
import { Doughnut } from "react-chartjs-2";
import {
  Car,
  Home,
  Layers,
  type LucideIcon,
  Utensils,
  Zap,
} from "lucide-react";
import type { DashboardCategoryPoint } from "@finance/shared";
import { translateCategory } from "@finance/shared";
import { formatCurrency } from "../../lib/format";
import { ensureChartJsRegistered } from "../../lib/chart";
import { cardLargeClass, fadeUp } from "./motion";

ensureChartJsRegistered();

const COLORS = ["#10B981", "#F59E0B", "#0EA5E9", "#6366F1", "#94A3B8"];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Moradia: Home,
  Housing: Home,
  Alimentação: Utensils,
  Food: Utensils,
  Transporte: Car,
  Transport: Car,
  Transportation: Car,
  Utilidades: Zap,
  Utilities: Zap,
  Outros: Layers,
  Other: Layers,
};

function categoryIcon(label: string): LucideIcon {
  return CATEGORY_ICONS[label] ?? Layers;
}

interface Props {
  data: DashboardCategoryPoint[];
  currencyCode: string;
  className?: string;
}

export function CategoryChart({ data, currencyCode, className }: Props) {
  const top = data.slice(0, 5).map((c) => ({
    ...c,
    category: translateCategory(c.category) ?? c.category,
  }));
  const othersTotal = data.slice(5).reduce((sum, c) => sum + c.total, 0);
  const chartData =
    othersTotal > 0
      ? [...top, { category: "Outros", total: othersTotal, count: 0, percent: 0 }]
      : top;

  const total = chartData.reduce((sum, c) => sum + c.total, 0);
  const withPercent = chartData.map((c) => ({
    ...c,
    percent: total > 0 ? (c.total / total) * 100 : 0,
  }));

  const doughnutData = useMemo(
    () => ({
      labels: withPercent.map((c) => c.category),
      datasets: [
        {
          data: withPercent.map((c) => c.total),
          backgroundColor: withPercent.map((_, i) => COLORS[i % COLORS.length]),
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    }),
    [withPercent],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<"doughnut">) => {
              const value = ctx.parsed;
              if (value == null) return "";
              return `${ctx.label}: ${formatCurrency(value, currencyCode)}`;
            },
          },
        },
      },
    }),
    [currencyCode],
  );

  return (
    <motion.section
      custom={3}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={`${cardLargeClass} flex flex-col ${className ?? ""}`}
    >
      <div className="mb-6">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Despesas por Categoria
        </h2>
        <p className="text-[11px] text-slate-400">
          Consumo mensal distribuído por segmento
        </p>
      </div>

      {withPercent.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">
          Nenhuma despesa categorizada no período.
        </p>
      ) : (
        <>
          <div className="relative mx-auto mb-6 h-44 w-full max-w-[180px]">
            <Doughnut data={doughnutData} options={options} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Total Gasto
              </span>
              <span className="font-display text-sm font-bold text-slate-900">
                {formatCurrency(total, currencyCode)}
              </span>
            </div>
          </div>

          <ul className="flex flex-col gap-2.5">
            {withPercent.map((cat, i) => {
              const Icon = categoryIcon(cat.category);
              return (
                <li
                  key={cat.category}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200/50 bg-white">
                      <Icon
                        className="h-3.5 w-3.5"
                        style={{ color: COLORS[i % COLORS.length] }}
                      />
                    </div>
                    <span className="truncate text-xs font-semibold text-slate-800">
                      {cat.category}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block text-xs font-bold text-slate-800">
                      {formatCurrency(cat.total, currencyCode)}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {cat.percent.toFixed(1)}%
                    </span>
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
