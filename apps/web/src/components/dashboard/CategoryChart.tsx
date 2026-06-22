import { motion } from "framer-motion";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DashboardCategoryPoint } from "@finance/shared";
import { translateCategory } from "@finance/shared";
import { formatCurrency } from "../../lib/format";
import { cardClass, fadeUp } from "./motion";

const COLORS = [
  "#059669",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#64748b",
];

interface Props {
  data: DashboardCategoryPoint[];
  currencyCode: string;
}

export function CategoryChart({ data, currencyCode }: Props) {
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

  return (
    <motion.section
      custom={3}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cardClass}
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-800">Gastos por categoria</h2>
        <p className="text-sm text-slate-500">Distribuição das saídas no período</p>
      </div>

      {withPercent.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">
          Nenhuma despesa categorizada no período.
        </p>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="mx-auto h-56 w-full max-w-xs">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={withPercent}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                  animationDuration={600}
                >
                  {withPercent.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, item) => [
                    formatCurrency(Number(value ?? 0), currencyCode),
                    (item?.payload as { category?: string })?.category ?? "",
                  ]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="flex-1 space-y-2">
            {withPercent.map((cat, i) => (
              <li
                key={cat.category}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="truncate text-slate-700">{cat.category}</span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-medium text-slate-800">
                    {formatCurrency(cat.total, currencyCode)}
                  </span>
                  <span className="ml-2 text-slate-400">
                    {cat.percent.toFixed(0)}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.section>
  );
}
