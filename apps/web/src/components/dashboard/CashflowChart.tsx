import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardMonthlyPoint } from "@finance/shared";
import { formatCurrency, formatCurrencyCompact, formatMonthLabel } from "../../lib/format";
import { cardClass, fadeUp } from "./motion";

interface Props {
  data: DashboardMonthlyPoint[];
  currencyCode: string;
}

export function CashflowChart({ data, currencyCode }: Props) {
  const chartData = data.map((point) => ({
    ...point,
    label: formatMonthLabel(point.month),
  }));

  return (
    <motion.section
      custom={2}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cardClass}
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-800">Fluxo de caixa</h2>
        <p className="text-sm text-slate-500">Receitas e despesas por mês</p>
      </div>

      {chartData.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">
          Sem transações no período selecionado.
        </p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCurrencyCompact(v, currencyCode)}
                width={72}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatCurrency(Number(value ?? 0), currencyCode),
                  name === "income" ? "Entradas" : "Saídas",
                ]}
                labelFormatter={(label) => String(label)}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                }}
              />
              <Legend
                formatter={(value) => (value === "income" ? "Entradas" : "Saídas")}
              />
              <Bar
                dataKey="income"
                name="income"
                fill="#059669"
                radius={[4, 4, 0, 0]}
                animationDuration={600}
              />
              <Bar
                dataKey="expenses"
                name="expenses"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                animationDuration={600}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.section>
  );
}
