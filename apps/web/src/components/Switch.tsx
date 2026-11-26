interface Props {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}

/** Interruptor liga/desliga. */
export function Switch({ checked, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? "bg-brand" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-app-surface shadow-sm transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
