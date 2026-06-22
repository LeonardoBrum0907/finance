import { AlertCircle, AlertTriangle, CheckCircle, Settings2 } from "lucide-react";
import type { BudgetCategoryItem } from "@finance/shared";
import { formatCurrency } from "../../lib/format";

interface Props {
  item: BudgetCategoryItem;
  currencyCode: string;
  onEdit: (item: BudgetCategoryItem) => void;
}

function progressColor(status: BudgetCategoryItem["status"]): string {
  if (status === "critical") return "bg-rose-500";
  if (status === "warning") return "bg-amber-500";
  return "bg-emerald-500";
}

function StatusBadge({ status }: { status: BudgetCategoryItem["status"] }) {
  if (status === "critical") {
    return (
      <>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
        <span className="text-[10px] font-bold uppercase text-rose-600">
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
      <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
      <span className="text-[10px] font-bold uppercase text-emerald-600">
        Consumo sob Controle Seguro
      </span>
    </>
  );
}

export function BudgetCategoryCard({ item, currencyCode, onEdit }: Props) {
  const barWidth = item.limit > 0 ? `${Math.min(100, item.ratio)}%` : "0%";
  const unconfigured = item.limit <= 0;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white p-6 transition-all duration-200 hover:shadow-md">
      <div>
        <div className="mb-4 flex items-start justify-between">
          <span className="block font-sans text-xs font-bold uppercase tracking-wide text-slate-800">
            {item.group}
          </span>
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="cursor-pointer rounded-lg border border-slate-200/30 bg-slate-50 p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
            aria-label={`Ajustar limite de ${item.group}`}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[11px] font-medium text-slate-400">Saturação da categoria</span>
          <span className="font-mono text-xs font-bold text-slate-800">
            {unconfigured ? "—" : `${item.ratio.toFixed(1)}%`}
          </span>
        </div>

        <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              unconfigured ? "bg-slate-200" : progressColor(item.status)
            }`}
            style={{ width: unconfigured ? "0%" : barWidth }}
          />
        </div>
      </div>

      <div className="flex justify-between border-t border-slate-50 pt-3">
        <span className="text-[10px] text-slate-400">
          Gasto:{" "}
          <strong className="mt-1 block text-xs font-bold text-slate-800">
            {formatCurrency(item.spent, currencyCode)}
          </strong>
        </span>

        <span className="text-[10px] text-slate-300">/</span>

        <span className="text-right text-[10px] text-slate-400">
          Limite:{" "}
          <strong className="mt-1 block text-xs font-bold text-emerald-600">
            {unconfigured
              ? "Não configurado"
              : formatCurrency(item.limit, currencyCode)}
          </strong>
        </span>
      </div>

      <div className="mt-4 flex items-center gap-1.5 border-t border-slate-100/50 pt-3.5">
        {unconfigured ? (
          <span className="text-[10px] font-bold uppercase text-slate-400">
            Configure um limite mensal
          </span>
        ) : (
          <StatusBadge status={item.status} />
        )}
      </div>
    </div>
  );
}
