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
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground-dark">
            Carteira total
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-positive/10 bg-positive/10">
            <Briefcase className="h-4 w-4 text-positive" />
          </div>
        </div>
        <p className="font-display text-2xl font-bold text-foreground md:text-3xl">
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
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground-dark">
            Lucro acumulado
          </span>
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
              profitPositive
                ? "border-positive/10 bg-positive/10"
                : "border-negative/10 bg-negative/10"
            }`}
          >
            {profitPositive ? (
              <TrendingUp className="h-4 w-4 text-positive" />
            ) : (
              <TrendingDown className="h-4 w-4 text-negative" />
            )}
          </div>
        </div>
        <p
          className={`font-display text-2xl font-bold md:text-3xl ${
            profitPositive ? "text-positive" : "text-negative"
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
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground-dark">
            Posições ativas
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-app-border bg-app-bg">
            <Layers className="h-4 w-4 text-muted-foreground-dark" />
          </div>
        </div>
        <p className="font-display text-2xl font-bold text-foreground md:text-3xl">
          <AnimatedValue value={positionCount} format={(n) => String(n)} />
        </p>
      </motion.div>
    </div>
  );
}
