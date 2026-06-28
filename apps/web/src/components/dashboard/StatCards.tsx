import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import type { DashboardNetWorth, DashboardPeriodSummary, PeriodMode } from "@finance/shared";
import { formatCurrency, formatPercent } from "../../lib/format";
import { formatCycleBalance } from "../../lib/cycleLabels";
import { AssistantSpotlightButton } from "../chat/AssistantSpotlightButton";
import { AnimatedValue } from "./AnimatedValue";
import { cardClass, cardHighlightClass, fadeUp } from "./motion";

function calcChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function ChangeBadge({
  change,
  tone = "positive",
  periodMode = "calendar",
}: {
  change: number | null;
  tone?: "positive" | "negative";
  periodMode?: PeriodMode;
}) {
  if (change === null || Math.abs(change) < 0.5) return null;

  const colors = {
    positive: "bg-positive/10 text-positive",
    negative: "bg-negative/10 text-negative",
  };

  const compareLabel = periodMode === "payday" ? "vs ciclo anterior" : "vs último mês";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${colors[tone]}`}
    >
      {formatPercent(change)} {compareLabel}
    </span>
  );
}

interface CardProps {
  label: string;
  value: number;
  currencyCode: string;
  change?: number | null;
  index: number;
  variant?: "highlight" | "default";
  valueClassName?: string;
  prefix?: string;
  icon: LucideIcon;
  iconClassName: string;
  iconBoxClassName: string;
  badgeTone?: "positive" | "negative";
  subtitle?: string;
  periodMode?: PeriodMode;
  spotlightMessage?: string;
  spotlightContext?: string;
  spotlightPersonId?: string;
}

function StatCard({
  label,
  value,
  currencyCode,
  change,
  index,
  variant = "default",
  valueClassName = "text-foreground",
  prefix = "",
  icon: Icon,
  iconClassName,
  iconBoxClassName,
  badgeTone = "positive",
  subtitle,
  periodMode = "calendar",
  spotlightMessage,
  spotlightContext,
  spotlightPersonId,
}: CardProps) {
  const format = (n: number) => `${prefix}${formatCurrency(n, currencyCode)}`;

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={variant === "highlight" ? cardHighlightClass : cardClass}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBoxClassName}`}
        >
          <Icon className={`h-4 w-4 ${iconClassName}`} />
        </div>
      </div>
      <p className={`font-display text-2xl font-bold tracking-tight md:text-3xl ${valueClassName}`}>
        <AnimatedValue value={value} format={format} />
      </p>
      {subtitle && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground" title={subtitle}>
          {subtitle}
        </p>
      )}
      {change !== undefined && (
        <div className="mt-2">
          <ChangeBadge change={change} tone={badgeTone} periodMode={periodMode} />
        </div>
      )}
      {spotlightMessage && (
        <div className="mt-2">
          <AssistantSpotlightButton
            message={spotlightMessage}
            contextKey="stat_card:net"
            title="Saldo negativo"
            contextHint={spotlightContext}
            personId={spotlightPersonId}
            label="Analisar"
          />
        </div>
      )}
    </motion.div>
  );
}

interface StatCardsProps {
  netWorth: DashboardNetWorth;
  currencyCode: string;
  period: DashboardPeriodSummary;
  previousPeriod: DashboardPeriodSummary;
  periodMode?: PeriodMode;
  personId?: string;
  simulationDelta?: { expenses: number; net: number; committedExpenses?: number };
  /** Modo ciclo: exibe só Patrimônio Líquido (demais métricas no card de ciclo). */
  compactCycleMode?: boolean;
}

export function StatCards({
  netWorth,
  currencyCode,
  period,
  previousPeriod,
  periodMode = "calendar",
  personId,
  simulationDelta,
  compactCycleMode = false,
}: StatCardsProps) {
  const simExpenses = simulationDelta?.expenses ?? 0;
  const simNet = simulationDelta?.net ?? 0;
  const hasSimulation = simExpenses > 0 || (simulationDelta?.committedExpenses ?? 0) > 0;

  const displayExpenses = period.expenses + simExpenses;
  const displayNet = period.net + simNet;
  const netBalance = formatCycleBalance(displayNet, currencyCode);
  const netPositive = displayNet >= 0;

  const netWorthBreakdown = netWorth.investmentsIncluded
    ? `Contas ${formatCurrency(netWorth.bankBalance, currencyCode)} · Invest. ${formatCurrency(netWorth.investmentBalance, currencyCode)} · Cartão −${formatCurrency(netWorth.creditDebt, currencyCode)}`
    : `Contas ${formatCurrency(netWorth.bankBalance, currencyCode)} · Cartão −${formatCurrency(netWorth.creditDebt, currencyCode)} · Invest. excluído (${formatCurrency(netWorth.investmentBalance, currencyCode)})`;

  return (
    <div
      className={
        compactCycleMode
          ? "grid gap-6 max-w-md"
          : "grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
      }
    >
      <StatCard
        label="Patrimônio Líquido"
        value={netWorth.total}
        currencyCode={currencyCode}
        index={0}
        variant="highlight"
        icon={ArrowUpRight}
        iconClassName="text-positive"
        iconBoxClassName="border border-positive/10 bg-positive/10"
        subtitle={netWorthBreakdown}
      />
      {!compactCycleMode && (
        <>
      <StatCard
        label="Já entrou"
        value={period.income}
        currencyCode={currencyCode}
        change={calcChange(period.income, previousPeriod.income)}
        index={1}
        valueClassName="text-foreground"
        icon={ArrowUpRight}
        iconClassName="text-positive"
        iconBoxClassName="border border-positive/10 bg-positive/10"
        badgeTone="positive"
        periodMode={periodMode}
      />
      <StatCard
        label="Já gastei"
        value={displayExpenses}
        currencyCode={currencyCode}
        change={calcChange(period.expenses, previousPeriod.expenses)}
        index={2}
        valueClassName="text-foreground"
        icon={ArrowDownRight}
        iconClassName="text-negative"
        iconBoxClassName="border border-negative/10 bg-negative/10"
        badgeTone="negative"
        periodMode={periodMode}
        subtitle={hasSimulation ? "com simulação" : undefined}
      />
      <StatCard
        label={netBalance.status}
        value={netBalance.amount}
        currencyCode={currencyCode}
        change={calcChange(period.net, previousPeriod.net)}
        index={3}
        valueClassName={netPositive ? "text-positive" : "text-negative"}
        icon={netPositive ? ArrowUpRight : ArrowDownRight}
        iconClassName={netPositive ? "text-positive" : "text-negative"}
        iconBoxClassName={
          netPositive
            ? "border border-positive/10 bg-positive/10"
            : "border border-negative/10 bg-negative/10"
        }
        badgeTone={netPositive ? "positive" : "negative"}
        periodMode={periodMode}
        subtitle={hasSimulation ? "com simulação" : undefined}
        spotlightMessage={
          !netPositive
            ? "Meu saldo está negativo neste período. Onde posso cortar gastos?"
            : undefined
        }
        spotlightContext={
          !netPositive
            ? JSON.stringify({ source: "stat_card", metric: "net", value: displayNet })
            : undefined
        }
        spotlightPersonId={personId}
      />
        </>
      )}
    </div>
  );
}
