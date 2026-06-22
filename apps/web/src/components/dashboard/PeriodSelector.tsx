import type { DashboardMonths } from "@finance/shared";

const OPTIONS: { value: DashboardMonths; label: string }[] = [
  { value: 1, label: "1 mês" },
  { value: 3, label: "3 meses" },
  { value: 6, label: "6 meses" },
  { value: 12, label: "12 meses" },
];

interface Props {
  value: DashboardMonths;
  onChange: (months: DashboardMonths) => void;
}

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
      role="group"
      aria-label="Período do painel"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            value === opt.value
              ? "bg-white text-brand-700 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
