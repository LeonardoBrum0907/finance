import { motion } from "framer-motion";
import { Calendar, ChevronDown, Wallet } from "lucide-react";
import type { DashboardCurrentCycle, PaydayCycleAnchor } from "@finance/shared";
import { formatCurrency, formatPaydayCycleLabel } from "../../lib/format";
import { cardClass, fadeUp } from "./motion";

interface Props {
  cycle: DashboardCurrentCycle;
  cycles: DashboardCurrentCycle[];
  currencyCode: string;
  paydayDay: number;
  paydayCycleAnchor: PaydayCycleAnchor;
  selectedCycleKey: string;
  onSelectCycle: (cycleKey: string) => void;
}

export function CycleProgressCard({
  cycle,
  cycles,
  currencyCode,
  paydayDay,
  paydayCycleAnchor,
  selectedCycleKey,
  onSelectCycle,
}: Props) {
  const progressPercent = Math.min(100, (cycle.dayIndex / cycle.totalDays) * 100);
  const periodLabel = formatPaydayCycleLabel(cycle.from, cycle.to);
  const isCurrentCycle = !cycle.isComplete;
  const sortedCycles = [...cycles].sort((a, b) => b.cycleKey.localeCompare(a.cycleKey));

  return (
    <motion.div
      custom={0}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cardClass}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-brand-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {isCurrentCycle ? "Ciclo atual" : "Ciclo"}
            </span>
            {sortedCycles.length > 1 && (
              <div className="relative">
                <select
                  value={selectedCycleKey}
                  onChange={(e) => onSelectCycle(e.target.value)}
                  className="appearance-none rounded-lg border border-slate-200 bg-white py-1 pl-2.5 pr-7 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  aria-label="Selecionar ciclo"
                >
                  {sortedCycles.map((c) => (
                    <option key={c.cycleKey} value={c.cycleKey}>
                      {formatPaydayCycleLabel(c.from, c.to)}
                      {!c.isComplete ? " (atual)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            )}
          </div>
          <p className="font-display text-lg font-semibold text-slate-900">{periodLabel}</p>
          <p className="mt-1 text-sm text-slate-500">
            {cycle.isComplete ? (
              <>Ciclo encerrado · {cycle.totalDays} dias</>
            ) : (
              <>
                Dia {cycle.dayIndex} de {cycle.totalDays}
                {cycle.daysRemaining > 0 && (
                  <>
                    {" "}
                    · faltam {cycle.daysRemaining} dias
                    {paydayCycleAnchor === "start"
                      ? " para o fim do ciclo"
                      : ` para o pagamento (dia ${paydayDay})`}
                  </>
                )}
              </>
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
          <span>{cycle.isComplete ? "Ciclo concluído" : "Progresso do ciclo"}</span>
          <span>{progressPercent.toFixed(0)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              cycle.isComplete ? "bg-slate-400" : "bg-brand-500"
            }`}
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
          {!cycle.isComplete && (cycle.committedExpenses ?? 0) > 0 && (
            <p className="mt-1 text-[10px] text-slate-500">
              +{formatCurrency(cycle.committedExpenses, currencyCode)} em parcelas agendadas
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
