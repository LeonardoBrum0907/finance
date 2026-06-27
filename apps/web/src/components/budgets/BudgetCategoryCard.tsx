import { AlertCircle, AlertTriangle, CheckCircle, Settings2 } from "lucide-react";
import type { BudgetItem } from "@finance/shared";
import { formatCurrency } from "../../lib/format";

interface Props {
  item: BudgetItem;
  currencyCode: string;
  onEdit: (item: BudgetItem) => void;
}

function progressColor(status: BudgetItem["status"]): string {
  if (status === "critical") return "bg-negative";
  if (status === "warning") return "bg-amber-500";
  return "bg-positive";
}

function StatusBadge({ status }: { status: BudgetItem["status"] }) {
  if (status === "critical") {
    return (
      <>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-negative" />
        <span className="text-[10px] font-bold uppercase text-negative">
          Limite Estourado ou Crítico!
        </span>
      </>
    );
  }

  if (status === "warning") {
    return (
      <>
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="text-[10px] font-bold uppercase text-amber-600">
          Atenção, Próximo do Limite!
        </span>
      </>
    );
  }

  return (
    <>
      <CheckCircle className="h-3.5 w-3.5 shrink-0 text-positive" />
      <span className="text-[10px] font-bold uppercase text-positive">
        Consumo sob Controle Seguro
      </span>
    </>
  );
}

export function BudgetCategoryCard({ item, currencyCode, onEdit }: Props) {
  const barWidth = item.limit > 0 ? `${Math.min(100, item.ratio)}%` : "0%";
  const categorySubtitle = item.categories.join(" · ");

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-app-border/60 bg-app-surface p-6 transition-all duration-200 hover:shadow-md">
      <div>
        <div className="mb-1 flex items-start justify-between gap-2">
          <span className="block font-sans text-xs font-bold uppercase tracking-wide text-foreground">
            {item.name}
          </span>
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="shrink-0 cursor-pointer rounded-lg border border-app-border/30 bg-app-bg p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
            aria-label={`Editar orçamento ${item.name}`}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {categorySubtitle && (
          <p className="mb-4 line-clamp-2 text-[11px] text-muted-foreground">{categorySubtitle}</p>
        )}

        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">Saturação do orçamento</span>
          <span className="font-mono text-xs font-bold text-foreground">
            {item.limit <= 0 ? "—" : `${item.ratio.toFixed(1)}%`}
          </span>
        </div>

        <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor(item.status)}`}
            style={{ width: item.limit <= 0 ? "0%" : barWidth }}
          />
        </div>
      </div>

      <div className="flex justify-between border-t border-slate-50 pt-3">
        <span className="text-[10px] text-muted-foreground">
          Gasto:{" "}
          <strong className="mt-1 block text-xs font-bold text-foreground">
            {formatCurrency(item.spent, currencyCode)}
          </strong>
        </span>

        <span className="text-[10px] text-slate-300">/</span>

        <span className="text-right text-[10px] text-muted-foreground">
          Limite:{" "}
          <strong className="mt-1 block text-xs font-bold text-positive">
            {formatCurrency(item.limit, currencyCode)}
          </strong>
        </span>
      </div>

      <div className="mt-4 flex items-center gap-1.5 border-t border-app-border/60/50 pt-3.5">
        <StatusBadge status={item.status} />
      </div>
    </div>
  );
}
