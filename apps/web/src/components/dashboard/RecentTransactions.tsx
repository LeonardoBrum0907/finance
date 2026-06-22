import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Car,
  ChevronLeft,
  ChevronRight,
  Filter,
  Home,
  Layers,
  Search,
  Utensils,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type {
  DashboardMonths,
  TransactionTypeFilter,
  TransactionsListResponse,
} from "@finance/shared";
import { isTransactionOutflow, toSignedDisplayAmount, translateCategory } from "@finance/shared";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { cardLargeClass, fadeUp } from "./motion";
import { PeriodSelector } from "./PeriodSelector";
import type { PersonFilter } from "./PersonSelector";

interface Props {
  personId: PersonFilter;
  dashboardMonths: DashboardMonths;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Moradia: Home,
  Housing: Home,
  Alimentação: Utensils,
  Food: Utensils,
  Transporte: Car,
  Transport: Car,
  Transportation: Car,
  Utilidades: Zap,
  Utilities: Zap,
};

function categoryIcon(category: string | null, description: string): LucideIcon {
  const label = translateCategory(category, description) ?? category ?? "Outros";
  return CATEGORY_ICONS[label] ?? Layers;
}

function categoryLabel(category: string | null, description: string): string {
  return translateCategory(category, description) ?? category ?? "Outros";
}

function formatDateShort(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day} / ${month}`;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function buildTransactionsUrl(
  periodMonths: DashboardMonths,
  personId: PersonFilter,
  page: number,
  pageSize: number,
  search: string,
  category: string,
  typeFilter: TransactionTypeFilter,
): string {
  const params = new URLSearchParams({
    months: String(periodMonths),
    page: String(page),
    pageSize: String(pageSize),
    type: typeFilter,
  });
  if (personId !== "all") params.set("personId", personId);
  if (search) params.set("search", search);
  if (category !== "all") params.set("category", category);
  return `/api/transactions?${params.toString()}`;
}

export function RecentTransactions({ personId, dashboardMonths }: Props) {
  const [periodMonths, setPeriodMonths] = useState<DashboardMonths>(dashboardMonths);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("all");

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    setPeriodMonths(dashboardMonths);
  }, [dashboardMonths]);

  useEffect(() => {
    setPage(1);
  }, [periodMonths, personId, debouncedSearch, categoryFilter, typeFilter, pageSize]);

  const showPersonColumn = personId === "all";
  const syncedWithDashboard = periodMonths === dashboardMonths;

  const query = useQuery({
    queryKey: [
      "transactions",
      periodMonths,
      personId,
      page,
      pageSize,
      debouncedSearch,
      categoryFilter,
      typeFilter,
    ],
    queryFn: () =>
      api.get<TransactionsListResponse>(
        buildTransactionsUrl(
          periodMonths,
          personId,
          page,
          pageSize,
          debouncedSearch,
          categoryFilter,
          typeFilter,
        ),
      ),
  });

  const data = query.data;
  const items = data?.items ?? [];
  const categories = data?.categories ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currencyCode = items[0]?.currencyCode ?? "BRL";

  return (
    <motion.section
      custom={6}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={`${cardLargeClass} overflow-hidden p-0`}
    >
      <div className="flex flex-col gap-4 border-b border-slate-100 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Transações Recentes
            </h2>
            <p className="text-[11px] text-slate-400">
              Histórico de saídas de débito e créditos recebidos
              {syncedWithDashboard && (
                <span className="ml-1.5 text-slate-300">· Mesmo período do painel</span>
              )}
            </p>
          </div>
          <PeriodSelector value={periodMonths} onChange={setPeriodMonths} />
        </div>

        <div className="flex flex-wrap gap-2.5">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-32 bg-transparent text-[11px] outline-none sm:w-40"
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent text-[11px] font-medium text-slate-600 outline-none"
            >
              <option value="all">Todas Categorias</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TransactionTypeFilter)}
              className="bg-transparent text-[11px] font-medium text-slate-600 outline-none"
            >
              <option value="all">Todos Tipos</option>
              <option value="outflow">Saída</option>
              <option value="inflow">Entrada</option>
            </select>
          </div>
        </div>
      </div>

      {query.isLoading ? (
        <div className="space-y-3 p-6" aria-busy>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="px-6 py-8 text-center text-sm text-red-600">
          Não foi possível carregar as transações. Tente novamente.
        </p>
      ) : items.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-slate-500">
          Nenhuma transação encontrada com os filtros selecionados.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Categoria</th>
                {showPersonColumn && <th className="px-4 py-3">Pessoa</th>}
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((tx) => {
                const label = categoryLabel(tx.category, tx.description);
                const Icon = categoryIcon(tx.category, tx.description);
                const isOutflow = isTransactionOutflow(tx.amount, tx.accountType);

                return (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs font-medium text-slate-500">
                      {formatDateShort(tx.date)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="block font-bold text-slate-900">{tx.description}</span>
                      <span className="text-[10px] text-slate-400">{tx.accountName}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-2 text-xs font-medium">
                        <span className="rounded-md border border-slate-200/50 bg-slate-100 p-1">
                          <Icon className="h-3.5 w-3.5 text-slate-500" />
                        </span>
                        {label}
                      </span>
                    </td>
                    {showPersonColumn && (
                      <td className="px-4 py-3.5 text-xs text-slate-600">{tx.personName}</td>
                    )}
                    <td
                      className={`whitespace-nowrap px-4 py-3.5 text-right text-sm font-bold ${
                        isOutflow ? "text-slate-800" : "text-emerald-600"
                      }`}
                    >
                      {formatCurrency(
                        toSignedDisplayAmount(tx.amount, tx.accountType),
                        tx.currencyCode,
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-[10px] font-bold leading-none ${
                          isOutflow
                            ? "border border-slate-200 bg-slate-50 text-slate-600"
                            : "border border-emerald-200/50 bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        {isOutflow ? "Saída" : "Entrada"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-4 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {data && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span>
              {total} transação{total !== 1 ? "ões" : ""}
            </span>
            <span>
              Entradas:{" "}
              <strong className="text-emerald-600">
                {formatCurrency(data.summary.income, currencyCode)}
              </strong>
            </span>
            <span>
              Saídas:{" "}
              <strong className="text-slate-700">
                {formatCurrency(data.summary.expenses, currencyCode)}
              </strong>
            </span>
            <span>
              Líquido:{" "}
              <strong className={data.summary.net >= 0 ? "text-emerald-600" : "text-red-600"}>
                {formatCurrency(data.summary.net, currencyCode)}
              </strong>
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span>Por página</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || query.isLoading}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[4.5rem] text-center text-[11px] font-medium text-slate-600">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || query.isLoading}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
