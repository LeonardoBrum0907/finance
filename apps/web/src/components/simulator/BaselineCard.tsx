import type { SimulatorBaselineDTO } from "@finance/shared";
import { formatCurrency } from "../../lib/format";
import { cardClass } from "../dashboard/motion";

interface Props {
  baseline: SimulatorBaselineDTO;
}

export function BaselineCard({ baseline }: Props) {
  const metrics = [
    {
      label: baseline.surplusLabel,
      value: formatCurrency(baseline.averageSurplus, baseline.currencyCode),
      hint: "Receita − despesa média",
    },
    {
      label: "Receita média",
      value: formatCurrency(baseline.averageIncome, baseline.currencyCode),
    },
    {
      label: "Despesa média",
      value: formatCurrency(baseline.averageExpenses, baseline.currencyCode),
    },
    {
      label: "Saldo em conta",
      value: formatCurrency(baseline.bankBalance, baseline.currencyCode),
    },
    {
      label: "Aporte em metas",
      value: formatCurrency(baseline.monthlyContribution, baseline.currencyCode),
      hint: "Por mês",
    },
  ];

  if (baseline.projectedNet !== null) {
    metrics.push({
      label: "Projeção do período",
      value: formatCurrency(baseline.projectedNet, baseline.currencyCode),
      hint: baseline.periodLabel,
    });
  }

  return (
    <section className={cardClass}>
      <h2 className="font-display text-sm font-semibold text-slate-800">
        Sua saúde financeira hoje
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Baseado nos últimos 3 {baseline.periodMode === "payday" ? "ciclos" : "meses"} ·{" "}
        {baseline.periodLabel}
      </p>

      {!baseline.hasAccounts && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Conecte contas para simulações mais precisas.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
          >
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              {metric.label}
            </p>
            <p className="mt-1 font-display text-lg font-semibold text-slate-900">
              {metric.value}
            </p>
            {metric.hint && <p className="mt-0.5 text-[10px] text-slate-400">{metric.hint}</p>}
          </div>
        ))}
      </div>

      {baseline.creditAccounts.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            Cartões de crédito
          </p>
          <ul className="mt-2 space-y-2">
            {baseline.creditAccounts.map((acc) => (
              <li
                key={acc.id}
                className="flex items-center justify-between text-xs text-slate-600"
              >
                <span>
                  {acc.name}
                  <span className="ml-1 text-slate-400">({acc.personName})</span>
                </span>
                <span className="font-medium text-slate-800">
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
