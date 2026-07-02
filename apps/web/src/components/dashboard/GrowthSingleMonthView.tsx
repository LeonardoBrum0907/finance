import { useMemo } from "react";
import type { TooltipItem } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import type {
  DashboardGrowthMetrics,
  DashboardMonthlyPoint,
  PeriodMode,
} from "@finance/shared";
import { formatCurrency, formatPercent } from "../../lib/format";
import { ensureChartJsRegistered } from "../../lib/chart";
import { CYCLE_COPY, formatCycleBalance, toneTextClass } from "../../lib/cycleLabels";
import { baseChartOptions, getChartColors } from "../../lib/chartTheme";
import { useTheme } from "../../lib/theme/useTheme";

ensureChartJsRegistered();

type GrowthView = "flow" | "balance";

interface Props {
  point: DashboardMonthlyPoint;
  growthMetrics: DashboardGrowthMetrics;
  currencyCode: string;
  view: GrowthView;
  periodMode?: PeriodMode;
  hideIncomeBreakdown?: boolean;
  /** Depois dos agendamentos (compromissos com data futura). */
  availableNet?: number;
}

function ChangeChip({
  label,
  change,
  invertTone = false,
}: {
  label: string;
  change: number | null;
  invertTone?: boolean;
}) {
  if (change === null || Math.abs(change) < 0.5) return null;
  const positive = change > 0;
  const good = invertTone ? !positive : positive;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        good ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"
      }`}
    >
      {formatPercent(change)} {label}
    </span>
  );
}

function HorizontalBar({
  label,
  value,
  max,
  color,
  currencyCode,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  currencyCode: string;
}) {
  const width = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-bold text-foreground">
          {formatCurrency(value, currencyCode)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function BalanceChip({
  label,
  balance,
}: {
  label: string;
  balance: ReturnType<typeof formatCycleBalance>;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-lg border border-app-border/60 bg-app-bg/80 px-3 py-2">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs font-semibold text-foreground">
        <span className={toneTextClass(balance.tone)}>{balance.status}</span>{" "}
        <span className={toneTextClass(balance.tone)}>{balance.formattedAmount}</span>
      </p>
    </div>
  );
}

export function GrowthSingleMonthView({
  point,
  growthMetrics,
  currencyCode,
  view,
  periodMode = "calendar",
  hideIncomeBreakdown = false,
  availableNet,
}: Props) {
  const { theme } = useTheme();
  const chartColors = useMemo(() => getChartColors(), [theme]);
  const { income, expenses, net: pointNet } = point;
  const displayUntilNow = pointNet;
  const untilNowBalance = formatCycleBalance(displayUntilNow, currencyCode);
  const afterScheduledBalance =
    availableNet !== undefined ? formatCycleBalance(availableNet, currencyCode) : null;
  const { savingsRate, expenseRatio, vsPrevious, incomeBreakdown, cycleProgress } =
    growthMetrics;
  const maxFlow = Math.max(income, expenses, 1);
  const compareLabel = periodMode === "payday" ? "vs ciclo anterior" : "vs mês anterior";
  const showAfterScheduled =
    availableNet !== undefined &&
    cycleProgress?.isPartialPeriod &&
    availableNet !== displayUntilNow;
  const balanceLabel =
    periodMode === "payday" && cycleProgress?.isPartialPeriod
      ? CYCLE_COPY.untilNow
      : "Saldo";

  const flowDoughnutData = useMemo(
    () => ({
      labels: ["Receitas", "Despesas"],
      datasets: [
        {
          data: [income, expenses],
          backgroundColor: [chartColors.income, chartColors.expense],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    }),
    [income, expenses, chartColors],
  );

  const balanceDoughnutData = useMemo(() => {
    if (displayUntilNow >= 0) {
      return {
        labels: ["Poupança", "Gasto"],
        datasets: [
          {
            data: [displayUntilNow, Math.max(0, expenses)],
            backgroundColor: [chartColors.income, chartColors.expense],
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      };
    }
    return {
      labels: ["Déficit"],
      datasets: [
        {
          data: [Math.abs(displayUntilNow)],
          backgroundColor: [chartColors.expense],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    };
  }, [displayUntilNow, expenses, chartColors]);

  const doughnutOptions = useMemo(
    () => ({
      ...baseChartOptions(),
      cutout: "78%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<"doughnut">) => {
              const value = ctx.parsed;
              if (value == null) return "";
              return `${ctx.label}: ${formatCurrency(value, currencyCode)}`;
            },
          },
        },
      },
    }),
    [currencyCode],
  );

  const heroCenter = (
    <>
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {balanceLabel}
      </span>
      <span
        className={`text-[11px] font-bold uppercase tracking-wide ${toneTextClass(untilNowBalance.tone)}`}
      >
        {untilNowBalance.status}
      </span>
      <span
        className={`font-display text-lg font-bold leading-tight ${toneTextClass(untilNowBalance.tone)}`}
      >
        {untilNowBalance.formattedAmount}
      </span>
    </>
  );

  const secondaryBalances =
    showAfterScheduled ? (
      <div className="flex flex-col gap-2 sm:col-span-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          {afterScheduledBalance && (
            <BalanceChip label={CYCLE_COPY.afterScheduled} balance={afterScheduledBalance} />
          )}
        </div>
        {savingsRate !== null && view === "flow" && (
          <p className="text-center text-[11px] font-medium text-muted-foreground sm:text-left">
            {savingsRate.toFixed(0)}% da renda poupada neste período
          </p>
        )}
      </div>
    ) : savingsRate !== null && view === "flow" ? (
      <p className="text-center text-[11px] font-medium text-muted-foreground sm:col-span-2 sm:text-left">
        {savingsRate.toFixed(0)}% da renda poupada neste período
      </p>
    ) : null;

  const hasVsPrevious =
    vsPrevious.incomeChange !== null ||
    vsPrevious.expenseChange !== null ||
    vsPrevious.netChange !== null;

  const showBreakdown = incomeBreakdown && !hideIncomeBreakdown;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative mx-auto aspect-square h-44 w-44 max-w-full sm:mx-0">
          <Doughnut
            data={view === "flow" ? flowDoughnutData : balanceDoughnutData}
            options={doughnutOptions}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            {heroCenter}
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3">
          {view === "flow" ? (
            <>
              <HorizontalBar
                label="Receitas"
                value={income}
                max={maxFlow}
                color={chartColors.income}
                currencyCode={currencyCode}
              />
              <HorizontalBar
                label="Despesas"
                value={expenses}
                max={maxFlow}
                color={chartColors.expense}
                currencyCode={currencyCode}
              />
            </>
          ) : (
            <>
              <HorizontalBar
                label="Receitas"
                value={income}
                max={Math.max(income, untilNowBalance.amount, 1)}
                color={chartColors.income}
                currencyCode={currencyCode}
              />
              <HorizontalBar
                label={untilNowBalance.status}
                value={untilNowBalance.amount}
                max={Math.max(income, untilNowBalance.amount, 1)}
                color={displayUntilNow >= 0 ? chartColors.net : chartColors.expense}
                currencyCode={currencyCode}
              />
            </>
          )}
        </div>
      </div>

      {secondaryBalances}

      <div
        className={`grid gap-2 ${showBreakdown ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
      >
        {showBreakdown && (
          <>
            <div className="rounded-lg border border-app-border/60 bg-app-bg/80 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Salário
              </p>
              <p className="mt-0.5 text-sm font-semibold text-positive">
                +{formatCurrency(incomeBreakdown.salary, currencyCode)}
              </p>
            </div>
            <div className="rounded-lg border border-app-border/60 bg-app-bg/80 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Renda extra
              </p>
              <p className="mt-0.5 text-sm font-semibold text-positive">
                +{formatCurrency(incomeBreakdown.extra, currencyCode)}
              </p>
            </div>
          </>
        )}
        {expenseRatio !== null && (
          <div className="rounded-lg border border-app-border/60 bg-app-bg/80 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Taxa de gasto
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {expenseRatio.toFixed(0)}% da renda
            </p>
          </div>
        )}
      </div>

      {(hasVsPrevious || cycleProgress?.isPartialPeriod) && (
        <div className="space-y-2 rounded-xl border border-app-border/60 bg-app-bg/60 px-3 py-2.5">
          {hasVsPrevious && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {compareLabel}
              </span>
              <ChangeChip label="receitas" change={vsPrevious.incomeChange} />
              <ChangeChip label="despesas" change={vsPrevious.expenseChange} invertTone />
              <ChangeChip label="saldo" change={vsPrevious.netChange} />
            </div>
          )}
          {cycleProgress?.isPartialPeriod && (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/90">
                {periodMode === "payday" ? "Ciclo em andamento" : "Período em andamento"}
              </span>
              {" · "}
              dia {cycleProgress.daysElapsed}/{cycleProgress.daysTotal}
              {cycleProgress.daysRemaining > 0 && (
                <>
                  {" "}
                  · faltam {cycleProgress.daysRemaining}{" "}
                  {cycleProgress.daysRemaining === 1 ? "dia" : "dias"}
                </>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
