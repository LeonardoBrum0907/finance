interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function ChartViewToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: Props<T>) {
  return (
    <div
      className="inline-flex rounded-lg border border-app-border bg-app-bg p-0.5"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
            value === opt.value
              ? "bg-app-surface text-brand shadow-sm"
              : "text-muted-foreground-dark hover:text-foreground/90"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
