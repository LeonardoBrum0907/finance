import type { DashboardMonths, PeriodMode } from "@finance/shared";

const MONTH_OPTIONS: { value: DashboardMonths; label: string }[] = [
  { value: 1, label: "1 mês" },
  { value: 3, label: "3 meses" },
  { value: 6, label: "6 meses" },
  { value: 12, label: "12 meses" },
];

const CYCLE_OPTIONS: { value: DashboardMonths; label: string }[] = [
  { value: 1, label: "1 ciclo" },
  { value: 3, label: "3 ciclos" },
  { value: 6, label: "6 ciclos" },
  { value: 12, label: "12 ciclos" },
];

interface Props {
  value: DashboardMonths;
  onChange: (months: DashboardMonths) => void;
  periodMode?: PeriodMode;
  onPeriodModeChange?: (mode: PeriodMode) => void;
  paydayConfigured?: boolean;
  showModeToggle?: boolean;
}

export function PeriodSelector({
  value,
  onChange,
  periodMode = "calendar",
  onPeriodModeChange,
  paydayConfigured = false,
  showModeToggle = true,
}: Props) {
  const options = periodMode === "payday" ? CYCLE_OPTIONS : MONTH_OPTIONS;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showModeToggle && paydayConfigured && onPeriodModeChange && (
        <div
          className="inline-flex rounded-lg border border-app-border bg-app-bg p-1"
          role="group"
          aria-label="Tipo de período"
        >
          <button
            type="button"
            onClick={() => onPeriodModeChange("calendar")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              periodMode === "calendar"
                ? "bg-app-surface text-brand shadow-sm"
                : "text-muted-foreground-dark hover:text-foreground"
            }`}
          >
            Calendário
          </button>
          <button
            type="button"
            onClick={() => onPeriodModeChange("payday")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              periodMode === "payday"
                ? "bg-app-surface text-brand shadow-sm"
                : "text-muted-foreground-dark hover:text-foreground"
            }`}
          >
            Meu ciclo
          </button>
        </div>
      )}

      <div
        className="inline-flex rounded-lg border border-app-border bg-app-bg p-1"
        role="group"
        aria-label="Período do painel"
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              value === opt.value
                ? "bg-app-surface text-brand shadow-sm"
                : "text-muted-foreground-dark hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
