import { ArrowDownAZ, TrendingDown, Search } from "lucide-react";

export type BudgetSortMode = "alphabetical" | "highest_spending";

interface Props {
  search: string;
  sort: BudgetSortMode;
  onSearchChange: (value: string) => void;
  onSortChange: (value: BudgetSortMode) => void;
}

export function BudgetToolbar({ search, sort, onSearchChange, onSortChange }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar orçamentos ou categorias..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3 pl-9 text-sm text-slate-800 outline-emerald-400 placeholder:text-slate-400 focus:border-emerald-400"
        />
      </div>

      <div
        className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
        role="group"
        aria-label="Ordenar orçamentos"
      >
        <button
          type="button"
          onClick={() => onSortChange("alphabetical")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            sort === "alphabetical"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <ArrowDownAZ className="h-4 w-4" />
          A–Z
        </button>
        <button
          type="button"
          onClick={() => onSortChange("highest_spending")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            sort === "highest_spending"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <TrendingDown className="h-4 w-4" />
          Maiores gastos
        </button>
      </div>
    </div>
  );
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesBudgetSearch(
  name: string,
  categories: string[],
  query: string,
): boolean {
  if (!query) return true;
  const normalized = normalizeSearchText(query);
  if (normalizeSearchText(name).includes(normalized)) return true;
  return categories.some((cat) => normalizeSearchText(cat).includes(normalized));
}
