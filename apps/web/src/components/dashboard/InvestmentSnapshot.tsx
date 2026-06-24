import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import type { DashboardInvestmentsSummary } from "@finance/shared";
import { formatCurrency, formatPercent } from "../../lib/format";
import { AnimatedValue } from "./AnimatedValue";
import { cardClass, fadeUp } from "./motion";

interface Props {
  investments: DashboardInvestmentsSummary;
  currencyCode: string;
}

function calcChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function InvestmentSnapshot({ investments, currencyCode }: Props) {
  if (investments.positionCount === 0) return null;

  const profitPositive = investments.unrealizedProfit >= 0;
  const periodProfit = investments.periodProfit;
  const periodPositive = periodProfit !== null && periodProfit >= 0;
  const periodChange = calcChange(periodProfit, investments.previousPeriodProfit);

  return (
    <motion.div
      custom={4}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cardClass}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Investimentos</h2>
          <p className="text-xs text-slate-500">
            Carteira sincronizada via Open Finance
          </p>
        </div>
        <Link
          to="/investimentos"
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
        >
          Ver detalhes
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Carteira investida
          </p>
          <p className="mt-1 font-display text-xl font-bold text-slate-900">
            <AnimatedValue
              value={investments.totalBalance}
              format={(n) => formatCurrency(n, currencyCode)}
            />
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Lucro acumulado
          </p>
          <p
            className={`mt-1 flex items-center gap-1.5 font-display text-xl font-bold ${
              profitPositive ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {profitPositive ? (
              <TrendingUp className="h-4 w-4 shrink-0" />
            ) : (
              <TrendingDown className="h-4 w-4 shrink-0" />
            )}
            <AnimatedValue
              value={investments.unrealizedProfit}
              format={(n) =>
                `${n >= 0 ? "+" : ""}${formatCurrency(n, currencyCode)}`
              }
            />
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Resultado no período
          </p>
          {periodProfit === null ? (
            <p
              className="mt-1 text-sm text-slate-400"
              title="Sem movimentações suficientes para calcular o resultado no período"
            >
              —
            </p>
          ) : (
            <div className="mt-1">
              <p
                className={`font-display text-xl font-bold ${
                  periodPositive ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                <AnimatedValue
                  value={periodProfit}
                  format={(n) =>
                    `${n >= 0 ? "+" : ""}${formatCurrency(n, currencyCode)}`
                  }
                />
              </p>
              {periodChange !== null && Math.abs(periodChange) >= 0.5 && (
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    periodChange >= 0
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-rose-500/10 text-rose-600"
                  }`}
                >
                  {formatPercent(periodChange)} vs período anterior
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
