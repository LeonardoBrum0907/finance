import type { SimulatorBaselineDTO } from "@finance/shared";
import { CreditCard, PiggyBank, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { cardClass } from "../dashboard/motion";
import { SIMULATOR_TONE, type SimulatorTone } from "./tokens";

interface Props {
  baseline: SimulatorBaselineDTO;
}

interface MetricConfig {
  label: string;
  value: string;
  hint?: string;
  tone: SimulatorTone;
  icon?: LucideIcon;
  featured?: boolean;
}

export function BaselineCard({ baseline }: Props) {
  const metrics: MetricConfig[] = [
    {
      label: baseline.surplusLabel,
      value: formatCurrency(baseline.averageSurplus, baseline.currencyCode),
      hint: "Receita − despesa média",
      tone: baseline.averageSurplus >= 0 ? "positive" : "negative",
      icon: baseline.averageSurplus >= 0 ? TrendingUp : TrendingDown,
      featured: true,
    },
    {
      label: "Receita média",
      value: formatCurrency(baseline.averageIncome, baseline.currencyCode),
      tone: "positive",
      icon: TrendingUp,
    },
    {
      label: "Despesa média",
      value: formatCurrency(baseline.averageExpenses, baseline.currencyCode),
      tone: "negative",
      icon: TrendingDown,
    },
    {
      label: "Saldo em conta",
      value: formatCurrency(baseline.bankBalance, baseline.currencyCode),
      tone: "brand",
      icon: Wallet,
    },
    {
      label: "Aporte em metas",
      value: formatCurrency(baseline.monthlyContribution, baseline.currencyCode),
      hint: "Por mês",
      tone: "brand",
      icon: PiggyBank,
    },
  ];

  metrics.push({
    label: "Sobra atual",
    value: formatCurrency(baseline.currentSurplus, baseline.currencyCode),
    hint: baseline.periodLabel,
    tone: baseline.currentSurplus >= 0 ? "positive" : "negative",
    icon: baseline.currentSurplus >= 0 ? TrendingUp : TrendingDown,
  });

  return (
    <section className={cardClass}>
      <div className="mb-4 rounded-xl border border-positive/20 bg-positive/5 px-4 py-3">
        <h2 className="font-display text-sm font-semibold text-foreground">
          Sua saúde financeira hoje
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Baseado nos últimos 3 {baseline.periodMode === "payday" ? "ciclos" : "meses"} ·{" "}
          {baseline.periodLabel}
        </p>
      </div>

      {!baseline.hasAccounts && (
        <p className="mb-4 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          Conecte contas para simulações mais precisas.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => {
          const styles = SIMULATOR_TONE[metric.tone];
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className={`rounded-xl border px-4 py-3 ${styles.box} ${metric.featured ? "ring-1 " + styles.ring : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`text-[10px] font-bold tracking-wider uppercase ${styles.label}`}>
                  {metric.label}
                </p>
                {Icon && (
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-current/10 bg-app-surface/50`}>
                    <Icon className={`h-3.5 w-3.5 ${styles.value}`} />
                  </span>
                )}
              </div>
              <p className={`mt-1 font-display text-lg font-semibold ${styles.value}`}>
                {metric.value}
              </p>
              {metric.hint && (
                <p className={`mt-0.5 text-[10px] ${styles.label}`}>{metric.hint}</p>
              )}
            </div>
          );
        })}
      </div>

      {baseline.creditAccounts.length > 0 && (
        <div className="mt-4 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-brand uppercase">
            <CreditCard className="h-3.5 w-3.5" />
            Cartões de crédito
          </p>
          <ul className="mt-2 space-y-2">
            {baseline.creditAccounts.map((acc) => (
              <li
                key={acc.id}
                className="flex items-center justify-between text-xs text-muted-foreground"
              >
                <span>
                  {acc.name}
                  <span className="ml-1 opacity-70">({acc.personName})</span>
                </span>
                <span className="font-semibold text-brand">
                  {acc.nextBillAmount != null
                    ? formatCurrency(acc.nextBillAmount, baseline.currencyCode)
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
