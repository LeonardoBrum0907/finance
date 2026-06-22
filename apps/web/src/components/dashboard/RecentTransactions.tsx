import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Car,
  Filter,
  Home,
  Layers,
  Pencil,
  Search,
  Trash2,
  Utensils,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { TransactionDTO } from "@finance/shared";
import { isTransactionOutflow, toSignedDisplayAmount, translateCategory } from "@finance/shared";
import { formatCurrency } from "../../lib/format";
import { cardLargeClass, fadeUp } from "./motion";

interface Props {
  transactions: TransactionDTO[];
  className?: string;
}

type VisualStatus = "Completed" | "Pending";

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

function formatDateShort(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day} / ${month}`;
}

function visualStatus(index: number): VisualStatus {
  return index % 3 === 1 ? "Pending" : "Completed";
}

export function RecentTransactions({ transactions, className }: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) {
      const label = translateCategory(tx.category, tx.description) ?? tx.category ?? "Outros";
      set.add(label);
    }
    return Array.from(set).sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((tx, index) => {
      const categoryLabel =
        translateCategory(tx.category, tx.description) ?? tx.category ?? "Outros";
      const status = visualStatus(index);
      const matchesSearch =
        !search ||
        tx.description.toLowerCase().includes(search.toLowerCase()) ||
        categoryLabel.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "All" || categoryLabel === categoryFilter;
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Completed" && status === "Completed") ||
        (statusFilter === "Pending" && status === "Pending");
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [transactions, search, categoryFilter, statusFilter]);

  return (
    <motion.section
      custom={6}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={`${cardLargeClass} overflow-hidden p-0 ${className ?? ""}`}
    >
      <div className="flex flex-col gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Transações Recentes
          </h2>
          <p className="text-[11px] text-slate-400">
            Histórico de saídas de débito e créditos recebidos
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar tabela..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-28 bg-transparent text-[11px] outline-none sm:w-32"
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent text-[11px] font-medium text-slate-600 outline-none"
            >
              <option value="All">Todas Categorias</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-[11px] font-medium text-slate-600 outline-none"
            >
              <option value="All">Todos Status</option>
              <option value="Completed">Concluído</option>
              <option value="Pending">Pendente</option>
            </select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
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
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((tx) => {
                const originalIndex = transactions.indexOf(tx);
                const status = visualStatus(originalIndex);
                const categoryLabel =
                  translateCategory(tx.category, tx.description) ?? tx.category ?? "Outros";
                const Icon = categoryIcon(tx.category, tx.description);
                const isOutflow = isTransactionOutflow(tx.amount, tx.accountType);

                return (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs font-medium text-slate-500">
                      {formatDateShort(tx.date)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="block font-bold text-slate-900">{tx.description}</span>
                      <span className="text-[10px] text-slate-400">Via carteira digital</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-2 text-xs font-medium">
                        <span className="rounded-md border border-slate-200/50 bg-slate-100 p-1">
                          <Icon className="h-3.5 w-3.5 text-slate-500" />
                        </span>
                        {categoryLabel}
                      </span>
                    </td>
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
                        className={`inline-block w-20 rounded-full px-3 py-1 text-[10px] font-bold leading-none ${
                          status === "Completed"
                            ? "border border-emerald-200/50 bg-emerald-50 text-emerald-600"
                            : "border border-amber-200/50 bg-amber-50 text-amber-600"
                        }`}
                      >
                        {status === "Completed" ? "Concluído" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          disabled
                          title="Em breve"
                          className="rounded-lg p-1.5 text-slate-300"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled
                          title="Em breve"
                          className="rounded-lg p-1.5 text-slate-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </motion.section>
  );
}
