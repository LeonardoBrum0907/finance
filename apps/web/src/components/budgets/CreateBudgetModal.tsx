import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { DashboardCategoryGroup } from "@finance/shared";

interface Props {
  open: boolean;
  availableCategories: DashboardCategoryGroup[];
  saving: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    limit: number;
    categories: DashboardCategoryGroup[];
  }) => void;
}

export function CreateBudgetModal({
  open,
  availableCategories,
  saving,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("");
  const [selected, setSelected] = useState<DashboardCategoryGroup[]>([]);

  useEffect(() => {
    if (open) {
      setName("");
      setLimit("");
      setSelected([]);
    }
  }, [open]);

  if (!open) return null;

  const toggleCategory = (category: DashboardCategoryGroup) => {
    setSelected((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = parseFloat(limit);
    if (!name.trim() || isNaN(limitNum) || limitNum <= 0 || selected.length === 0) return;
    onSave({ name: name.trim(), limit: limitNum, categories: selected });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 cursor-pointer rounded-lg p-1 text-slate-400 hover:text-slate-600"
          aria-label="Fechar"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <h3 className="mb-1 font-display text-lg font-bold text-slate-900">Novo Orçamento</h3>
        <p className="mb-6 font-sans text-xs text-slate-400">
          Agrupe categorias automáticas em um teto de consumo personalizado.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="budget-name"
              className="text-[10px] font-bold tracking-wider text-slate-400 uppercase"
            >
              Nome do orçamento
            </label>
            <input
              id="budget-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Gastos Desnecessários"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-emerald-400 focus:border-emerald-400 focus:bg-white"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="create-budget-limit"
              className="text-[10px] font-bold tracking-wider text-slate-400 uppercase"
            >
              Limite mensal (R$)
            </label>
            <input
              id="create-budget-limit"
              type="number"
              step="0.01"
              min="0.01"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-emerald-400 focus:border-emerald-400 focus:bg-white"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Categorias incluídas
            </span>
            {availableCategories.length === 0 ? (
              <p className="text-xs text-slate-500">
                Todas as categorias já estão em outros orçamentos.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableCategories.map((category) => {
                  const active = selected.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                        active
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || selected.length === 0 || availableCategories.length === 0}
            className="w-full cursor-pointer rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Criando..." : "Criar orçamento"}
          </button>
        </form>
      </div>
    </div>
  );
}
