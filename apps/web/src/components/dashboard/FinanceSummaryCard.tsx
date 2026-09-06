import { Landmark, PiggyBank, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { HouseholdCycleSummary, PersonCycleSummary } from "@finance/shared";
import { savingsRate, stillMineThisPeriod, cycleSaved } from "@finance/shared";
import {
  CYCLE_COPY,
  formatCycleBalance,
  formatPlainAmount,
  formatSavingsPercent,
  toneBorderClass,
  toneTextClass,
} from "../../lib/cycleLabels";
import { cardClass } from "./motion";

export type FinanceMetrics = Pick<
  PersonCycleSummary,
  | "bankBalance"
  | "creditDebt"
  | "investmentBalance"
  | "investmentsIncluded"
  | "netWorth"
  | "realizedIncome"
  | "realizedExpenses"
  | "realizedNet"
  | "closingBalance"
  | "projectedSalaryIncome"
  | "pendingExpenses"
  | "pendingBillPayments"
> & {
  isFuture?: boolean;
  isComplete?: boolean;
};

interface Props {
  metrics: FinanceMetrics;
  currencyCode: string;
  title?: string;
  closingDelta?: number;
}

interface MetricTile {
  key: "netWorth" | "stillMine" | "saved";
  label: string;
  value: string;
  status?: string;
  hint?: string;
  extra?: string;
  tone: "positive" | "negative" | "neutral" | "brand";
  icon: LucideIcon;
  featured?: boolean;
}

function toneForValue(value: number): "positive" | "negative" | "neutral" {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function tileToneClass(tone: MetricTile["tone"]): string {
  if (tone === "positive") return toneBorderClass("positive");
  if (tone === "negative") return toneBorderClass("negative");
  if (tone === "brand") return "border-brand/20 bg-brand/5";
  return toneBorderClass("neutral");
}

function tileTextClass(tone: MetricTile["tone"]): string {
  if (tone === "brand") return "text-brand";
  return toneTextClass(tone);
}

function netWorthHint(metrics: FinanceMetrics, currencyCode: string): string {
  const parts = [
    `Caixa ${formatPlainAmount(metrics.bankBalance, currencyCode)}`,
    `Cartão −${formatPlainAmount(metrics.creditDebt, currencyCode)}`,
  ];
  if (metrics.investmentsIncluded) {
    parts.push(`Invest. ${formatPlainAmount(metrics.investmentBalance, currencyCode)}`);
  } else if (metrics.investmentBalance !== 0) {
    parts.push(`Invest. fora (${formatPlainAmount(metrics.investmentBalance, currencyCode)})`);
  }
  return parts.join(" · ");
}

function stillMineHint(metrics: FinanceMetrics): string {
  if (metrics.isComplete) return "Ciclo encerrado · caixa atual";
  if (metrics.isFuture) return "Caixa atual + salário esperado − contas do ciclo";
  return "Caixa + renda prevista − contas e faturas";
}

export function toFinanceMetrics(
  summary: PersonCycleSummary | HouseholdCycleSummary,
  flags: { isFuture?: boolean; isComplete?: boolean } = {},
): FinanceMetrics {
  return {
    bankBalance: summary.bankBalance,
    creditDebt: summary.creditDebt,
    investmentBalance: summary.investmentBalance,
    investmentsIncluded: summary.investmentsIncluded,
    netWorth: summary.netWorth,
    realizedIncome: summary.realizedIncome,
    realizedExpenses: summary.realizedExpenses,
    realizedNet: summary.realizedNet,
    closingBalance: summary.closingBalance,
    projectedSalaryIncome: summary.projectedSalaryIncome,
    pendingExpenses: summary.pendingExpenses,
    pendingBillPayments: summary.pendingBillPayments,
    isFuture: flags.isFuture,
    isComplete: flags.isComplete,
  };
}

export function FinanceSummaryCard({
  metrics,
  currencyCode,
  title = "Resumo do ciclo",
  closingDelta,
}: Props) {
  const stillMine = stillMineThisPeriod(metrics);
  const stillMineDisplay = formatCycleBalance(stillMine, currencyCode);
  const saved = cycleSaved(metrics);
  const savedDisplay = formatCycleBalance(saved, currencyCode);
  const rate = savingsRate(metrics);

  const tiles: MetricTile[] = [
    {
      key: "netWorth",
      label: CYCLE_COPY.netWorth,
      value: formatPlainAmount(metrics.netWorth, currencyCode),
      hint: netWorthHint(metrics, currencyCode),
      tone: "brand",
      icon: Landmark,
    },
    {
      key: "stillMine",
      label: CYCLE_COPY.stillMineThisPeriod,
      value: stillMineDisplay.formattedAmount,
      status: stillMineDisplay.status,
      hint: stillMineHint(metrics),
      extra:
        metrics.pendingBillPayments > 0
          ? `Faturas a pagar neste ciclo: ${formatPlainAmount(metrics.pendingBillPayments, currencyCode)}`
          : undefined,
      tone: toneForValue(stillMine),
      icon: Wallet,
      featured: true,
    },
    {
      key: "saved",
      label: CYCLE_COPY.savedThisCycle,
      value: formatSavingsPercent(rate),
      status: rate == null ? CYCLE_COPY.noCycleIncome : savedDisplay.status,
      hint:
        rate == null
          ? saved === 0
            ? CYCLE_COPY.noCycleIncome
            : `${savedDisplay.status} ${savedDisplay.formattedAmount}`
          : `${savedDisplay.status} ${savedDisplay.formattedAmount} neste ciclo`,
      tone: rate == null && saved === 0 ? "neutral" : toneForValue(saved),
      icon: PiggyBank,
    },
  ];

  return (
    <section className={cardClass}>
      <h2 className="font-display text-sm font-semibold text-foreground">{title}</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.key}
              className={`rounded-xl border px-4 py-3 ${tileToneClass(tile.tone)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
                  {tile.label}
                </p>
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tileTextClass(tile.tone)}`} />
              </div>
              {tile.featured && tile.status && tile.tone !== "brand" && (
                <p className={`mt-1 text-[11px] font-bold uppercase tracking-wide ${tileTextClass(tile.tone)}`}>
                  {tile.status}
                </p>
              )}
              <p className={`font-display text-xl font-bold ${tileTextClass(tile.tone)}`}>
                {tile.value}
              </p>
              {tile.key === "stillMine" && closingDelta != null && closingDelta !== 0 && (
                <p className={`mt-1 text-xs font-medium ${closingDelta > 0 ? "text-positive" : "text-negative"}`}>
                  {closingDelta > 0 ? "+" : ""}
                  {formatPlainAmount(closingDelta, currencyCode)} ao desligar conta
                </p>
              )}
              {tile.extra && (
                <p className="mt-1 text-xs font-medium text-muted-foreground">{tile.extra}</p>
              )}
              {tile.hint && (
                <p className="mt-1 text-[11px] text-muted-foreground">{tile.hint}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
