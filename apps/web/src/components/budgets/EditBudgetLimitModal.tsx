import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { BudgetCategoryItem } from "@finance/shared";

interface Props {
  category: BudgetCategoryItem | null;
  currencyCode: string;
  saving: boolean;
  onClose: () => void;
  onSave: (group: string, limit: number) => void;
}

export function EditBudgetLimitModal({ category, currencyCode, saving, onClose, onSave }: Props) {
  const [limit, setLimit] = useState("");

  useEffect(() => {
    if (category) {
      setLimit(category.limit > 0 ? String(category.limit) : "");
    }
  }, [category]);

  if (!category) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = parseFloat(limit);
    if (isNaN(limitNum) || limitNum <= 0) return;
    onSave(category.group, limitNum);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 cursor-pointer rounded-lg p-1 text-slate-400 hover:text-slate-600"
          aria-label="Fechar"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <h3 className="mb-1 font-display text-lg font-bold text-slate-900">
          Ajustar Teto de Consumo
        </h3>
        <p className="mb-6 font-sans text-xs text-slate-400">
          Alterar limite mensal para a categoria{" "}
          <strong className="text-slate-700">{category.group}</strong>.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="budget-limit"
              className="text-[10px] font-bold tracking-wider text-slate-400 uppercase"
            >
              Novo Limite ({currencyCode === "BRL" ? "R$" : currencyCode})
            </label>
            <input
              id="budget-limit"
              type="number"
              step="0.01"
              min="0.01"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-emerald-400 transition-colors focus:border-emerald-400 focus:bg-white"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full cursor-pointer rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Atualizar Limite"}
          </button>
        </form>
      </div>
    </div>
  );
}
