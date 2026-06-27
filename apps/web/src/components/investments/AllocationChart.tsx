import { useMemo } from "react";
import { motion } from "framer-motion";
import { Doughnut } from "react-chartjs-2";
import type { InvestmentAllocationPoint } from "@finance/shared";
import { formatCurrency, formatPercent } from "../../lib/format";
import { ensureChartJsRegistered } from "../../lib/chart";
import { baseChartOptions, categoryColor, categoryDoughnutTooltip, getChartColors } from "../../lib/chartTheme";
import { useTheme } from "../../lib/theme/useTheme";
import { cardLargeClass, fadeUp } from "../dashboard/motion";

ensureChartJsRegistered();

interface Props {
  allocation: InvestmentAllocationPoint[];
  currencyCode: string;
  className?: string;
}

export function AllocationChart({ allocation, currencyCode, className }: Props) {
  const { theme } = useTheme();
  const chartColors = useMemo(() => getChartColors(), [theme]);

  const chartData = useMemo(() => {
    const labels = allocation.map((a) => a.label);
    const values = allocation.map((a) => a.total);
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, i) => categoryColor(i, chartColors)),
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    };
  }, [allocation, chartColors]);

  const options = useMemo(
    () => ({
      ...baseChartOptions(),
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: { parsed: number; label: string; dataIndex: number }) =>
              categoryDoughnutTooltip(
                ctx as never,
                currencyCode,
                allocation.map((a) => ({
                  total: a.total,
                  count: 0,
                  percent: a.percent,
                })),
              ).join(" · "),
          },
        },
      },
    }),
    [allocation, currencyCode],
  );

  if (allocation.length === 0) {
    return (
      <div className={`${cardLargeClass} ${className ?? ""}`}>
        <h2 className="text-sm font-semibold text-foreground">Alocação por tipo</h2>
        <p className="mt-4 text-sm text-muted-foreground">Nenhuma posição ativa.</p>
      </div>
    );
  }

  return (
    <motion.div
      custom={3}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={`${cardLargeClass} ${className ?? ""}`}
    >
      <h2 className="mb-4 text-sm font-semibold text-foreground">Alocação por tipo</h2>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="mx-auto h-44 w-44 shrink-0 sm:mx-0">
          <Doughnut data={chartData} options={options} />
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {allocation.map((item, i) => (
            <li key={item.type} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: categoryColor(i) }}
                />
                <span className="truncate text-foreground/90">{item.label}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="font-medium text-foreground">
                  {formatCurrency(item.total, currencyCode)}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {formatPercent(item.percent, 1)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
