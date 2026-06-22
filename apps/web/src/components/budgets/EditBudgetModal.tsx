import { useEffect, useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import type { BudgetItem, DashboardCategoryGroup } from "@finance/shared";

interface Props {
  budget: BudgetItem | null;
  availableCategories: DashboardCategoryGroup[];
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onSave: (data: {
    id: string;
    name: string;
    limit: number;
    categories: DashboardCategoryGroup[];
  }) => void;
  onDelete: (id: string) => void;
}

export function EditBudgetModal({
  budget,
  availableCategories,
  saving,
  deleting,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("");
  const [selected, setSelected] = useState<DashboardCategoryGroup[]>([]);

  const selectableCategories = useMemo(() => {
    if (!budget) return availableCategories;
    const combined = new Set<DashboardCategoryGroup>([
      ...budget.categories,
      ...availableCategories,
    ]);
    return [...combined].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [budget, availableCategories]);

  useEffect(() => {
    if (budget) {
      setName(budget.name);
      setLimit(budget.limit > 0 ? String(budget.limit) : "");
      setSelected(budget.categories);
    }
  }, [budget]);

  if (!budget) return null;

  const toggleCategory = (category: DashboardCategoryGroup) => {
    setSelected((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = parseFloat(limit);
    if (!name.trim() || isNaN(limitNum) || limitNum <= 0 || selected.length === 0) return;
    onSave({
      id: budget.id,
      name: name.trim(),
      limit: limitNum,
      categories: selected,
    });
  };

  const handleDelete = () => {
    if (confirm(`Excluir o orçamento "${budget.name}"?`)) {
      onDelete(budget.id);
    }
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

        <h3 className="mb-1 font-display text-lg font-bold text-slate-900">
          Editar Orçamento
        </h3>
        <p className="mb-6 font-sans text-xs text-slate-400">
          Ajuste o nome, limite ou categorias vinculadas.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="edit-budget-name"
              className="text-[10px] font-bold tracking-wider text-slate-400 uppercase"
            >
              Nome do orçamento
            </label>
            <input
              id="edit-budget-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-emerald-400 focus:border-emerald-400 focus:bg-white"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="edit-budget-limit"
              className="text-[10px] font-bold tracking-wider text-slate-400 uppercase"
            >
              Limite mensal (R$)
            </label>
            <input
              id="edit-budget-limit"
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
            <div className="flex flex-wrap gap-2">
              {selectableCategories.map((category) => {
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
          </div>

          <button
            type="submit"
            disabled={saving || selected.length === 0}
            className="w-full cursor-pointer rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-3 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? "Excluindo..." : "Excluir orçamento"}
          </button>
        </form>
      </div>
    </div>
  );
}
