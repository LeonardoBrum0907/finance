import { motion } from "framer-motion";
import { Calendar, Wallet } from "lucide-react";
import type { DashboardCurrentCycle } from "@finance/shared";
import { formatCurrency, formatPaydayCycleLabel } from "../../lib/format";
import { cardClass, fadeUp } from "./motion";

interface Props {
  cycle: DashboardCurrentCycle;
  currencyCode: string;
  paydayDay: number;
}

export function CycleProgressCard({ cycle, currencyCode, paydayDay }: Props) {
  const progressPercent = Math.min(100, (cycle.dayIndex / cycle.totalDays) * 100);
  const periodLabel = formatPaydayCycleLabel(cycle.from, cycle.to);

  return (
    <motion.div
      custom={0}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cardClass}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Ciclo atual
            </span>
          </div>
          <p className="font-display text-lg font-semibold text-slate-900">{periodLabel}</p>
          <p className="mt-1 text-sm text-slate-500">
            Dia {cycle.dayIndex} de {cycle.totalDays}
            {cycle.daysRemaining > 0 && (
              <> · faltam {cycle.daysRemaining} dias para o pagamento (dia {paydayDay})</>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Saldo do ciclo
          </p>
          <p
            className={`font-display text-2xl font-bold ${
              cycle.net >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {cycle.net >= 0 ? "+" : ""}
            {formatCurrency(cycle.net, currencyCode)}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1.5 flex justify-between text-xs text-slate-500">
          <span>Progresso do ciclo</span>
          <span>{progressPercent.toFixed(0)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Salário
          </p>
          <p className="mt-0.5 text-sm font-semibold text-teal-600">
            +{formatCurrency(cycle.salaryIncome, currencyCode)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Renda extra
          </p>
          <p className="mt-0.5 text-sm font-semibold text-emerald-600">
            +{formatCurrency(cycle.extraIncome, currencyCode)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
          <div className="flex items-center gap-1">
            <Wallet className="h-3 w-3 text-slate-400" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Saídas
            </p>
          </div>
          <p className="mt-0.5 text-sm font-semibold text-rose-600">
            -{formatCurrency(cycle.expenses, currencyCode)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
