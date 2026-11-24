import { ChevronLeft, ChevronRight } from "lucide-react";
import type { IntervalKind } from "@finance/shared";

const KIND_OPTIONS: { value: IntervalKind; label: string }[] = [
  { value: "bill", label: "Ciclo da fatura" },
  { value: "month", label: "Mês" },
];

interface Props {
  kind: IntervalKind;
  /** Nome do intervalo (ex.: "Fatura de novembro 2026"). */
  label: string;
  /** Datas do intervalo (ex.: "29 out – 28 nov"). */
  rangeLabel?: string;
  /** Sem cartão com fatura, só o mês aparece. */
  billAvailable: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onKindChange: (kind: IntervalKind) => void;
  onStep: (delta: -1 | 1) => void;
}

const stepButtonClass =
  "rounded-md p-2 text-muted-foreground-dark transition hover:bg-app-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30";

function KindToggle({ kind, billAvailable, onKindChange }: Pick<Props, "kind" | "billAvailable" | "onKindChange">) {
  const options = billAvailable ? KIND_OPTIONS : KIND_OPTIONS.filter((o) => o.value === "month");
  return (
    <div className="inline-flex rounded-lg border border-app-border bg-app-bg p-1" role="group" aria-label="Tipo de intervalo">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onKindChange(option.value)}
          aria-pressed={kind === option.value}
          className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${
            kind === option.value
              ? "bg-app-surface text-brand shadow-sm"
              : "text-muted-foreground-dark hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Seletor único do intervalo do painel: escolhe entre ciclo da fatura e mês e anda
 * para trás e para frente. Tudo na página segue o que estiver escolhido aqui.
 */
export function IntervalSelector(props: Props) {
  const { label, rangeLabel, canGoBack, canGoForward, onStep } = props;
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <KindToggle kind={props.kind} billAvailable={props.billAvailable} onKindChange={props.onKindChange} />
      <div
        className="flex items-center justify-between gap-1 rounded-lg border border-app-border bg-app-bg p-1"
        role="group"
        aria-label="Navegar entre intervalos"
      >
        <button type="button" disabled={!canGoBack} onClick={() => onStep(-1)} className={stepButtonClass} aria-label="Intervalo anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-[10rem] px-2 text-center">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {rangeLabel && <p className="text-[11px] text-muted-foreground">{rangeLabel}</p>}
        </div>
        <button type="button" disabled={!canGoForward} onClick={() => onStep(1)} className={stepButtonClass} aria-label="Próximo intervalo">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
