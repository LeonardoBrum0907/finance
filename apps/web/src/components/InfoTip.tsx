import type { ReactNode } from "react";
import { Info } from "lucide-react";

/** Ícone (i) que mostra uma explicação ao passar o mouse ou focar com o teclado. */
export function InfoTip({ children, label = "Mais detalhes" }: { children: ReactNode; label?: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="inline-flex cursor-help items-center text-muted-foreground/70 transition hover:text-foreground focus:text-foreground focus:outline-none"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-muted-foreground opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
