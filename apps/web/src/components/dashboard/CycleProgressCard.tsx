import { motion } from "framer-motion";
import { Calendar, ChevronDown, HelpCircle } from "lucide-react";
import type { CycleForecastBlock, DashboardCurrentCycle, PaydayCycleAnchor } from "@finance/shared";
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
  nextCycleForecast?: CycleForecastBlock | null;
  simulationOverlay?: {
    realizedExpenses: number;
    committedExpenses: number;
  };
  includeSimulation?: boolean;
  onIncludeSimulationChange?: (value: boolean) => void;
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

function heroGridClass(showClosing: boolean): string {
  if (showClosing) return "sm:grid-cols-2";
  return "max-w-md";
}

function formatExpenseKind(kind: CycleForecastBlock["expenseItems"][number]["kind"]): string {
  switch (kind) {
    case "recurring":
      return "fixa";
    case "installments":
      return "parcela";
    case "simulations":
      return "simulação";
    case "bank":
      return "cartão";
    default:
      return kind;
  }
}

export function CycleProgressCard({
  cycle,
  cycles,
  currencyCode,
  paydayDay,
  paydayCycleAnchor,
  selectedCycleKey,
  onSelectCycle,
  nextCycleForecast,
  simulationOverlay,
  includeSimulation = true,
  onIncludeSimulationChange,
}: Props) {
  const progressPercent = Math.min(100, (cycle.dayIndex / cycle.totalDays) * 100);
  const periodLabel = formatPaydayCycleLabel(cycle.from, cycle.to);
  const isCurrentCycle = !cycle.isComplete;
  const sortedCycles = [...cycles].sort((a, b) => b.cycleKey.localeCompare(a.cycleKey));

  const simulationAvailable =
    isCurrentCycle &&
    simulationOverlay &&
    (simulationOverlay.realizedExpenses > 0 || simulationOverlay.committedExpenses > 0);

  const hasSimulation = simulationAvailable && includeSimulation;

  const simRealized = hasSimulation ? simulationOverlay!.realizedExpenses : 0;
  const simCommitted = hasSimulation ? simulationOverlay!.committedExpenses : 0;
  const realizedIncome = cycle.realizedIncome ?? cycle.income;
  const realizedExpenses = (cycle.realizedExpenses ?? cycle.expenses) + simRealized;
  const displayRealizedNet = (cycle.realizedNet ?? cycle.net) - simRealized;
  const displayCommitted = (cycle.committedExpenses ?? 0) + simCommitted;
  const displayClosing = cycle.availableNet - simRealized - simCommitted;
  const hasProjectedSalary = (cycle.projectedSalaryIncome ?? 0) > 0;
  const showClosing =
    isCurrentCycle &&
    (displayCommitted > 0 ||
      hasProjectedSalary ||
      Math.abs(displayClosing - displayRealizedNet) > 0.001);

  const dueBreakdown = committedBreakdown(
    cycle,
    displayCommitted,
    Boolean(hasSimulation),
    simCommitted,
    currencyCode,
  );

  const realizedDetails = [
    `${CYCLE_COPY.income} ${formatPlainAmount(realizedIncome, currencyCode)}`,
    `${CYCLE_COPY.spent} ${formatPlainAmount(realizedExpenses, currencyCode)}`,
  ];

  const closingDetails = showClosing
    ? [
        ...(hasProjectedSalary
          ? [
              `${CYCLE_COPY.projectedSalary} ${formatPlainAmount(cycle.projectedSalaryIncome!, currencyCode)}`,
            ]
          : []),
        ...(displayCommitted > 0
          ? [`${CYCLE_COPY.dueInCycle} ${formatPlainAmount(displayCommitted, currencyCode)}`]
          : []),
      ]
    : undefined;

  const topNextExpenses = nextCycleForecast?.expenseItems
    .slice()
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

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

      <div className={`mb-4 grid gap-3 ${heroGridClass(showClosing)}`}>
        <BalanceHeroBox
          title={CYCLE_COPY.realizedUntilNow}
          balance={displayRealizedNet}
          currencyCode={currencyCode}
          detailLines={realizedDetails}
        />
        {showClosing ? (
          <BalanceHeroBox
            title={CYCLE_COPY.closingThisCycle}
            balance={displayClosing}
            currencyCode={currencyCode}
            detailLines={closingDetails}
          />
        ) : null}
      </div>

      {isCurrentCycle && nextCycleForecast && (
        <div
          className="mb-4 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3"
          title={CYCLE_COPY.nextCycleTooltip}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {CYCLE_COPY.nextCycle}
          </p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {formatPaydayCycleLabel(nextCycleForecast.from, nextCycleForecast.to)}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <BalanceHeroBox
              title="Sobra prevista"
              balance={nextCycleForecast.closingBalance}
              currencyCode={currencyCode}
              detailLines={[
                nextCycleForecast.salaryKnown
                  ? `${CYCLE_COPY.expectedSalary} ${formatPlainAmount(nextCycleForecast.pendingIncome, currencyCode)}`
                  : CYCLE_COPY.salaryUnknown,
                `${CYCLE_COPY.dueNextCycle} ${formatPlainAmount(nextCycleForecast.pendingExpenses, currencyCode)}`,
              ]}
            />
          </div>
          {topNextExpenses && topNextExpenses.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-brand/15 pt-3 text-[11px] text-muted-foreground">
              {topNextExpenses.map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {item.title}
                    <span className="ml-1 opacity-70">({formatExpenseKind(item.kind)})</span>
                  </span>
                  <span className="shrink-0 font-medium text-foreground">
                    {formatPlainAmount(item.amount, currencyCode)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {simulationAvailable && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2">
          <span className="text-[11px] font-medium text-amber-900">
            Incluir simulação no ciclo
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={includeSimulation}
            onClick={() => onIncludeSimulationChange?.(!includeSimulation)}
            className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition ${
              includeSimulation ? "bg-amber-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition ${
                includeSimulation ? "translate-x-5" : "translate-x-1"
              }`}
            />
            <span className="sr-only">
              {includeSimulation
                ? "Simulação incluída nos valores do ciclo"
                : "Simulação excluída dos valores do ciclo"}
            </span>
          </button>
        </div>
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
            {formatPlainAmount(realizedIncome, currencyCode)}
          </p>
          <div className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
            {cycle.salaryIncome - (cycle.projectedSalaryIncome ?? 0) > 0 && (
              <p>
                {CYCLE_COPY.salary}{" "}
                {formatPlainAmount(
                  cycle.salaryIncome - (cycle.projectedSalaryIncome ?? 0),
                  currencyCode,
                )}
              </p>
            )}
            {hasProjectedSalary && (
              <p>
                {CYCLE_COPY.projectedSalary}{" "}
                {formatPlainAmount(cycle.projectedSalaryIncome!, currencyCode)}
              </p>
            )}
            {cycle.extraIncome > 0 && (
              <p>
                {CYCLE_COPY.extraIncome}{" "}
                {formatPlainAmount(cycle.extraIncome, currencyCode)}
              </p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-app-border/60 bg-app-bg/80 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {CYCLE_COPY.spent}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {formatPlainAmount(realizedExpenses, currencyCode)}
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
