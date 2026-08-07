import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  CYCLE_COPY,
  formatCycleBalance,
  formatPlainAmount,
  toneBorderClass,
  toneTextClass,
} from "../../lib/cycleLabels";
import { cardClass } from "./motion";

export interface FinanceMetrics {
  bankBalance: number;
  closingBalance: number;
  realizedNet: number;
  isFuture?: boolean;
  isComplete?: boolean;
  /** Pagamentos de fatura projetados no ciclo. */
  pendingBillPayments?: number;
}

interface Props {
  metrics: FinanceMetrics;
  currencyCode: string;
  title?: string;
  closingDelta?: number;
}

interface MetricTile {
  label: string;
  value: string;
  hint?: string;
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

export function FinanceSummaryCard({
  metrics,
  currencyCode,
  title = "Resumo do ciclo",
  closingDelta,
}: Props) {
  const closingDisplay = formatCycleBalance(metrics.closingBalance, currencyCode);
  const flowDisplay = formatCycleBalance(metrics.realizedNet, currencyCode);

  const tiles: MetricTile[] = [
    {
      label: "Saldo em conta",
      value: formatPlainAmount(metrics.bankBalance, currencyCode),
      hint: "Contas correntes e poupança",
      tone: "brand",
      icon: Wallet,
    },
    {
      label: CYCLE_COPY.closingThisCycle,
      value: closingDisplay.formattedAmount,
      hint:
        metrics.isFuture
          ? "Projeção com salário e contas conhecidas"
          : metrics.isComplete
            ? "Ciclo encerrado"
            : "Salário previsto, contas e faturas pendentes",
      tone: toneForValue(metrics.closingBalance),
      icon: metrics.closingBalance >= 0 ? ArrowUpRight : ArrowDownLeft,
      featured: true,
    },
    {
      label: CYCLE_COPY.realizedUntilNow,
      value: flowDisplay.formattedAmount,
      hint: metrics.isFuture ? "Sem movimentação ainda" : "Entradas − saídas no ciclo",
      tone: toneForValue(metrics.realizedNet),
      icon: metrics.realizedNet >= 0 ? ArrowUpRight : ArrowDownLeft,
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
              key={tile.label}
              className={`rounded-xl border px-4 py-3 ${tileToneClass(tile.tone)} ${
                tile.featured ? "sm:col-span-1" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {tile.label}
                </p>
                <Icon className={`h-3.5 w-3.5 ${tileTextClass(tile.tone)}`} />
              </div>
              {tile.featured && tile.tone !== "brand" && (
                <p className={`mt-1 text-[11px] font-bold uppercase tracking-wide ${tileTextClass(tile.tone)}`}>
                  {closingDisplay.status}
                </p>
              )}
              <p className={`font-display text-xl font-bold ${tileTextClass(tile.tone)}`}>
                {tile.value}
              </p>
              {tile.label === CYCLE_COPY.closingThisCycle && closingDelta != null && closingDelta !== 0 && (
                <p className={`mt-1 text-xs font-medium ${closingDelta > 0 ? "text-positive" : "text-negative"}`}>
                  {closingDelta > 0 ? "+" : ""}
                  {formatPlainAmount(closingDelta, currencyCode)} ao desligar conta
                </p>
              )}
              {tile.label === CYCLE_COPY.closingThisCycle &&
                metrics.pendingBillPayments != null &&
                metrics.pendingBillPayments > 0 && (
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    Faturas a pagar neste ciclo:{" "}
                    {formatPlainAmount(metrics.pendingBillPayments, currencyCode)}
                  </p>
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
