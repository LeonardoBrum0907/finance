import { motion } from "framer-motion";
import { Calendar, ChevronDown, HelpCircle } from "lucide-react";
import type { DashboardCurrentCycle, PaydayCycleAnchor } from "@finance/shared";
import { formatPaydayCycleLabel } from "../../lib/format";
import {
  CYCLE_COPY,
  formatCycleBalance,
  formatPlainAmount,
  toneBorderClass,
  toneTextClass,
} from "../../lib/cycleLabels";
import { cardClass, fadeUp } from "./motion";

interface Props {
  cycle: DashboardCurrentCycle;
  cycles: DashboardCurrentCycle[];
  currencyCode: string;
  paydayDay: number;
  paydayCycleAnchor: PaydayCycleAnchor;
  selectedCycleKey: string;
  onSelectCycle: (cycleKey: string) => void;
  simulationOverlay?: {
    realizedExpenses: number;
    committedExpenses: number;
  };
  onClearSimulation?: () => void;
}

function BalanceHeroBox({
  title,
  balance,
  currencyCode,
  detailLines,
}: {
  title: string;
  balance: number;
  currencyCode: string;
  detailLines?: string[];
}) {
  const display = formatCycleBalance(balance, currencyCode);

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneBorderClass(display.tone)}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p
        className={`mt-1 text-[11px] font-bold uppercase tracking-wide ${toneTextClass(display.tone)}`}
      >
        {display.status}
      </p>
      <p className={`font-display text-xl font-bold ${toneTextClass(display.tone)}`}>
        {display.formattedAmount}
      </p>
      {detailLines && detailLines.length > 0 && (
        <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
          {detailLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function committedBreakdown(
  cycle: DashboardCurrentCycle,
  displayCommitted: number,
  hasSimulation: boolean,
  simCommitted: number,
  currencyCode: string,
): string | null {
  if (displayCommitted <= 0) return null;

  if (hasSimulation && simCommitted > 0) {
    return `${formatPlainAmount(simCommitted, currencyCode)} simulado`;
  }

  const bank = cycle.committedExpensesBank ?? 0;
  const manual = cycle.committedExpensesManual ?? 0;
  if (bank > 0 && manual > 0) {
    return `${formatPlainAmount(bank, currencyCode)} cartão · ${formatPlainAmount(manual, currencyCode)} manual`;
  }
  if (manual > 0) return `${formatPlainAmount(manual, currencyCode)} manual`;
  if (bank > 0) return `${formatPlainAmount(bank, currencyCode)} cartão`;
  return null;
}

function heroGridClass(showAfterScheduled: boolean, showAtPayday: boolean): string {
  if (showAtPayday) return "sm:grid-cols-3";
  if (showAfterScheduled) return "sm:grid-cols-2";
  return "max-w-md";
}

export function CycleProgressCard({
  cycle,
  cycles,
  currencyCode,
  paydayDay,
  paydayCycleAnchor,
  selectedCycleKey,
  onSelectCycle,
  simulationOverlay,
  onClearSimulation,
}: Props) {
  const progressPercent = Math.min(100, (cycle.dayIndex / cycle.totalDays) * 100);
  const periodLabel = formatPaydayCycleLabel(cycle.from, cycle.to);
  const isCurrentCycle = !cycle.isComplete;
  const sortedCycles = [...cycles].sort((a, b) => b.cycleKey.localeCompare(a.cycleKey));

  const hasSimulation =
    isCurrentCycle &&
    simulationOverlay &&
    (simulationOverlay.realizedExpenses > 0 || simulationOverlay.committedExpenses > 0);

  const simRealized = hasSimulation ? simulationOverlay!.realizedExpenses : 0;
  const simCommitted = hasSimulation ? simulationOverlay!.committedExpenses : 0;
  const displayIncome = cycle.income;
  const displayExpenses = cycle.expenses + simRealized;
  const displayCommitted = (cycle.committedExpenses ?? 0) + simCommitted;
  const pendingSalary = cycle.pendingSalary ?? 0;
  const displayBalanceWithSalary = cycle.balanceWithSalary - simRealized;
  const displayAvailableNet = cycle.availableNet - simRealized - simCommitted;
  const displayBalanceAtPayday = cycle.balanceAtPayday - simRealized - simCommitted;
  const showAfterScheduled = isCurrentCycle && displayCommitted > 0;
  const showAtPayday = pendingSalary > 0;
  const showSalaryPending =
    isCurrentCycle && paydayCycleAnchor === "end" && cycle.salaryPending === true;

  const dueBreakdown = committedBreakdown(
    cycle,
    displayCommitted,
    Boolean(hasSimulation),
    simCommitted,
    currencyCode,
  );

  const untilNowDetails = [
    `${CYCLE_COPY.income} ${formatPlainAmount(displayIncome, currencyCode)}`,
    ...(pendingSalary > 0
      ? [`${CYCLE_COPY.pendingSalary} ${formatPlainAmount(pendingSalary, currencyCode)}`]
      : []),
    `${CYCLE_COPY.spent} ${formatPlainAmount(displayExpenses, currencyCode)}`,
  ];

  const afterScheduledDetails = showAfterScheduled
    ? [`${CYCLE_COPY.dueInCycle} ${formatPlainAmount(displayCommitted, currencyCode)}`]
    : undefined;

  const atPaydayDetails = showAtPayday
    ? [`${CYCLE_COPY.dueInCycle} ${formatPlainAmount(displayCommitted, currencyCode)}`]
    : undefined;

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
            <Calendar className="h-4 w-4 shrink-0 text-brand" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {isCurrentCycle ? "Ciclo atual" : "Ciclo"}
            </span>
            {sortedCycles.length > 1 && (
              <div className="relative">
                <select
                  value={selectedCycleKey}
                  onChange={(e) => onSelectCycle(e.target.value)}
                  className="appearance-none rounded-lg border border-app-border bg-app-surface py-1 pl-2.5 pr-7 text-xs font-medium text-foreground/90 shadow-sm transition hover:border-app-border focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  aria-label="Selecionar ciclo"
                >
                  {sortedCycles.map((c) => (
                    <option key={c.cycleKey} value={c.cycleKey}>
                      {formatPaydayCycleLabel(c.from, c.to)}
                      {!c.isComplete ? " (atual)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            )}
          </div>
          <p className="font-display text-lg font-semibold text-foreground">{periodLabel}</p>
          <p className="mt-1 text-sm text-muted-foreground">
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
        <span
          className="inline-flex shrink-0 items-center gap-1 text-muted-foreground"
          title={CYCLE_COPY.heroTooltip}
        >
          <HelpCircle className="h-4 w-4" aria-hidden />
          <span className="sr-only">{CYCLE_COPY.heroTooltip}</span>
        </span>
      </div>

      {showSalaryPending && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          {CYCLE_COPY.salaryPendingHint}
        </p>
      )}

      <div className={`mb-4 grid gap-3 ${heroGridClass(showAfterScheduled, showAtPayday)}`}>
        <BalanceHeroBox
          title={CYCLE_COPY.untilNow}
          balance={displayBalanceWithSalary}
          currencyCode={currencyCode}
          detailLines={untilNowDetails}
        />
        {showAfterScheduled ? (
          <BalanceHeroBox
            title={CYCLE_COPY.afterScheduled}
            balance={displayAvailableNet}
            currencyCode={currencyCode}
            detailLines={afterScheduledDetails}
          />
        ) : null}
        {showAtPayday ? (
          <BalanceHeroBox
            title={CYCLE_COPY.atPayday}
            balance={displayBalanceAtPayday}
            currencyCode={currencyCode}
            detailLines={atPaydayDetails}
          />
        ) : null}
      </div>

      {hasSimulation && (
        <p className="mb-4 text-[11px] text-amber-700">
          Inclui simulação ·{" "}
          <button
            type="button"
            onClick={onClearSimulation}
            className="font-semibold underline hover:no-underline"
          >
            Limpar
          </button>
        </p>
      )}

      <div className="mb-4">
        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
          <span>{cycle.isComplete ? "Ciclo concluído" : "Progresso do ciclo"}</span>
          <span>{progressPercent.toFixed(0)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              cycle.isComplete ? "bg-slate-400" : "bg-brand"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-app-border/60 bg-app-bg/80 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {CYCLE_COPY.income}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {formatPlainAmount(displayIncome, currencyCode)}
          </p>
          <div className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
            {cycle.salaryIncome > 0 && (
              <p>
                {CYCLE_COPY.salary} {formatPlainAmount(cycle.salaryIncome, currencyCode)}
              </p>
            )}
            {cycle.extraIncome > 0 && (
              <p>
                {CYCLE_COPY.extraIncome}{" "}
                {formatPlainAmount(cycle.extraIncome, currencyCode)}
              </p>
            )}
            {pendingSalary > 0 && (
              <p>
                {CYCLE_COPY.pendingSalary}{" "}
                {formatPlainAmount(pendingSalary, currencyCode)}
              </p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-app-border/60 bg-app-bg/80 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {CYCLE_COPY.spent}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {formatPlainAmount(displayExpenses, currencyCode)}
          </p>
        </div>
        <div className="rounded-lg border border-app-border/60 bg-app-bg/80 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {CYCLE_COPY.dueInCycle}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {formatPlainAmount(displayCommitted, currencyCode)}
          </p>
          {dueBreakdown && (
            <p className="mt-1 text-[10px] text-muted-foreground">{dueBreakdown}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
