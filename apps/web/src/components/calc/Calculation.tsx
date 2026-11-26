import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { formatPlainAmount } from "../../lib/cycleLabels";
import { Modal } from "../Modal";

/** Uma linha da conta. `op` é como ela entra no resultado; `items` abre o detalhe da linha. */
export interface CalcLine {
  label: string;
  amount: number;
  op?: "+" | "-";
  /** Texto curto ao lado do nome (ex.: uma data). */
  detail?: string;
  items?: CalcLine[];
}

/** Como um total foi calculado: as linhas e o resultado. */
export interface Calculation {
  title: string;
  lines: CalcLine[];
  result: number;
  /** Observação curta no rodapé (período, premissa). */
  note?: string;
}

function LineRow({ line, currencyCode, depth = 0 }: { line: CalcLine; currencyCode: string; depth?: number }) {
  const [open, setOpen] = useState(false);
  const expandable = !!line.items?.length;
  const sign = line.op === "-" ? "−" : line.op === "+" ? "+" : "";
  const amountClass = line.op === "-" ? "text-negative" : "text-foreground";

  return (
    <li>
      <button
        type="button"
        disabled={!expandable}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-baseline gap-2 py-1.5 text-left ${depth > 0 ? "text-xs" : "text-sm"} ${
          expandable ? "cursor-pointer hover:text-brand" : "cursor-default"
        }`}
        style={{ paddingLeft: depth * 16 }}
      >
        <span className="w-3 shrink-0 text-center font-mono text-muted-foreground">{sign}</span>
        <span className={`min-w-0 flex-1 truncate ${depth > 0 ? "text-muted-foreground" : "text-foreground"}`}>
          {line.label}
          {line.detail && <span className="ml-1.5 text-xs text-muted-foreground">{line.detail}</span>}
        </span>
        {expandable &&
          (open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground" />
          ))}
        <span className={`shrink-0 tabular-nums ${depth > 0 ? "text-muted-foreground" : amountClass}`}>
          {formatPlainAmount(line.amount, currencyCode)}
        </span>
      </button>
      {expandable && open && (
        <ul className="mb-1 border-l border-app-border/60" style={{ marginLeft: depth * 16 + 6 }}>
          {line.items!.map((item, index) => (
            <LineRow key={`${item.label}-${index}`} line={item} currencyCode={currencyCode} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Janela com a conta de um total, linha a linha. */
export function CalculationModal({
  calc,
  currencyCode,
  onClose,
}: {
  calc: Calculation;
  currencyCode: string;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
      <h2 className="mb-3 pr-8 font-display text-base font-semibold text-foreground">{calc.title}</h2>
      <ul className="divide-y divide-app-border/40">
        {calc.lines.map((line, index) => (
          <LineRow key={`${line.label}-${index}`} line={line} currencyCode={currencyCode} />
        ))}
      </ul>
      <div className="mt-2 flex items-baseline gap-2 border-t-2 border-foreground/20 pt-2 text-sm font-semibold">
        <span className="w-3 shrink-0 text-center font-mono text-muted-foreground">=</span>
        <span className="flex-1 text-foreground">{calc.title}</span>
        <span className={`tabular-nums ${calc.result < 0 ? "text-negative" : "text-foreground"}`}>
          {formatPlainAmount(calc.result, currencyCode)}
        </span>
      </div>
      {calc.note && <p className="mt-3 text-xs text-muted-foreground">{calc.note}</p>}
    </Modal>
  );
}

/** Um total clicável: abre a conta que chegou nele. */
export function CalcValue({
  calc,
  currencyCode,
  className = "",
  children,
}: {
  calc: Calculation;
  currencyCode: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ver o cálculo"
        className={`cursor-pointer rounded-md text-left underline decoration-current/30 decoration-dotted underline-offset-4 transition hover:decoration-current ${className}`}
      >
        {children}
      </button>
      {open && <CalculationModal calc={calc} currencyCode={currencyCode} onClose={() => setOpen(false)} />}
    </>
  );
}
