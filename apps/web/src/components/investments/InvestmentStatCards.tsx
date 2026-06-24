import { motion } from "framer-motion";
import { Briefcase, Layers, TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { AnimatedValue } from "../dashboard/AnimatedValue";
import { cardClass, cardHighlightClass, fadeUp } from "../dashboard/motion";

interface Props {
  totalBalance: number;
  unrealizedProfit: number;
  positionCount: number;
  currencyCode: string;
}

export function InvestmentStatCards({
  totalBalance,
  unrealizedProfit,
  positionCount,
  currencyCode,
}: Props) {
  const profitPositive = unrealizedProfit >= 0;

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <motion.div
        custom={0}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className={cardHighlightClass}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Carteira total
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/10 bg-emerald-500/10">
            <Briefcase className="h-4 w-4 text-emerald-600" />
          </div>
        </div>
        <p className="font-display text-2xl font-bold text-slate-900 md:text-3xl">
          <AnimatedValue
            value={totalBalance}
            format={(n) => formatCurrency(n, currencyCode)}
          />
        </p>
      </motion.div>

      <motion.div
        custom={1}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className={cardClass}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Lucro acumulado
          </span>
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
              profitPositive
                ? "border-emerald-500/10 bg-emerald-500/10"
                : "border-rose-500/10 bg-rose-500/10"
            }`}
          >
            {profitPositive ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-rose-600" />
            )}
          </div>
        </div>
        <p
          className={`font-display text-2xl font-bold md:text-3xl ${
            profitPositive ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          <AnimatedValue
            value={unrealizedProfit}
            format={(n) => `${n >= 0 ? "+" : ""}${formatCurrency(n, currencyCode)}`}
          />
        </p>
      </motion.div>

      <motion.div
        custom={2}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className={cardClass}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Posições ativas
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
            <Layers className="h-4 w-4 text-slate-600" />
          </div>
        </div>
        <p className="font-display text-2xl font-bold text-slate-900 md:text-3xl">
          <AnimatedValue value={positionCount} format={(n) => String(n)} />
        </p>
      </motion.div>
    </div>
  );
}
