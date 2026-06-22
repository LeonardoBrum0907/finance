import { motion } from "framer-motion";
import type { DashboardNetWorth, DashboardPeriodSummary } from "@finance/shared";
import { formatCurrency, formatPercent } from "../../lib/format";
import { AnimatedValue } from "./AnimatedValue";
import { cardClass, fadeUp } from "./motion";

interface Props {
  netWorth: DashboardNetWorth;
  currencyCode: string;
  period: DashboardPeriodSummary;
  previousPeriod: DashboardPeriodSummary;
}

function netWorthHint(netWorth: DashboardNetWorth, currencyCode: string): string {
  const parts: string[] = [];
  if (netWorth.bankBalance > 0) {
    parts.push(`${formatCurrency(netWorth.bankBalance, currencyCode)} em contas`);
  }
  if (netWorth.creditDebt > 0) {
    parts.push(`${formatCurrency(netWorth.creditDebt, currencyCode)} em cartões`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Sem contas conectadas";
}

function calcChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function ChangeBadge({
  change,
  invertColors = false,
}: {
  change: number | null;
  invertColors?: boolean;
}) {
  if (change === null || Math.abs(change) < 0.5) return null;

  const isPositive = change > 0;
  const isGood = invertColors ? !isPositive : isPositive;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isGood ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-600"
      }`}
    >
      {formatPercent(change)} vs período anterior
    </span>
  );
}

interface CardProps {
  label: string;
  value: number;
  currencyCode: string;
  change?: number | null;
  invertColors?: boolean;
  index: number;
  hint?: string;
}

function StatCard({ label, value, currencyCode, change, invertColors, index, hint }: CardProps) {
  const format = (n: number) => formatCurrency(n, currencyCode);

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cardClass}
    >
      <p className="text-sm text-slate-500">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      <p
        className={`mt-2 text-2xl font-semibold tracking-tight ${
          label === "Patrimônio líquido" && value < 0 ? "text-red-600" : "text-slate-800"
        }`}
      >
        <AnimatedValue value={value} format={format} />
      </p>
      {change !== undefined && (
        <div className="mt-2">
          <ChangeBadge change={change} invertColors={invertColors} />
        </div>
      )}
    </motion.div>
  );
}

export function StatCards({ netWorth, currencyCode, period, previousPeriod }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Patrimônio líquido"
        value={netWorth.total}
        currencyCode={currencyCode}
        hint={netWorthHint(netWorth, currencyCode)}
        index={0}
      />
      <StatCard
        label="Entradas"
        value={period.income}
        currencyCode={currencyCode}
        change={calcChange(period.income, previousPeriod.income)}
        index={1}
      />
      <StatCard
        label="Saídas"
        value={period.expenses}
        currencyCode={currencyCode}
        change={calcChange(period.expenses, previousPeriod.expenses)}
        invertColors
        index={2}
      />
      <StatCard
        label="Resultado"
        value={period.net}
        currencyCode={currencyCode}
        change={calcChange(period.net, previousPeriod.net)}
        index={3}
      />
    </div>
  );
}
