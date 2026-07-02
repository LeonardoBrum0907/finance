import { useEffect, useState, type Ref, type RefObject } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Car,
  ChevronLeft,
  ChevronRight,
  Filter,
  FlaskConical,
  Home,
  Layers,
  Search,
  Utensils,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type {
  CategoryChartSelection,
  CreditAccountSnapshot,
  DashboardMonths,
  DashboardPeriodSummary,
  PeriodMode,
  SimulatedPurchaseInput,
  TransactionTypeFilter,
  TransactionsListResponse,
} from "@finance/shared";
import {
  FINE_GRAINED_CATEGORIES,
  isTransactionOutflow,
  toSignedDisplayAmount,
} from "@finance/shared";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { CYCLE_COPY, formatCycleBalance, formatPlainAmount } from "../../lib/cycleLabels";
import { cardLargeClass, fadeUp } from "./motion";
import { PeriodSelector } from "./PeriodSelector";
import type { PersonFilter } from "./PersonSelector";
import { SimulatePurchaseModal } from "./SimulatePurchaseModal";
import { TransactionDetailModal } from "./TransactionDetailModal";

interface Props {
  personId: PersonFilter;
  dashboardMonths: DashboardMonths;
  periodMode?: PeriodMode;
  cycleKey?: string;
  /** Resumo alinhado ao ciclo (modo payday); usado no rodapé sem filtros ativos. */
  periodSummary?: DashboardPeriodSummary;
  categorySelection?: CategoryChartSelection | null;
  onClearCategorySelection?: () => void;
  sectionRef?: RefObject<HTMLElement | null>;
  simulationEnabled?: boolean;
  onSaveSimulations?: (inputs: SimulatedPurchaseInput[]) => Promise<void>;
  savingSimulation?: boolean;
  simulateModalOpen?: boolean;
  onSimulateModalOpenChange?: (open: boolean) => void;
  creditAccounts?: CreditAccountSnapshot[];
  bankBalance?: number;
  currentCycle?: { from: string; to: string; cycleKey: string };
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

function categoryIcon(category: string | null): LucideIcon {
  const label = category ?? "Outros";
  return CATEGORY_ICONS[label] ?? Layers;
}

function categoryLabel(category: string | null): string {
  return category ?? "Outros";
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

function categorySelectionLabel(selection: CategoryChartSelection): string {
  if (selection.kind === "single") return selection.group;
  return selection.groups.join(", ");
}

function buildTransactionsUrl(
  periodMonths: DashboardMonths,
  personId: PersonFilter,
  page: number,
  pageSize: number,
  search: string,
  category: string,
  typeFilter: TransactionTypeFilter,
  categorySelection: CategoryChartSelection | null | undefined,
  periodMode?: PeriodMode,
  cycleKey?: string,
): string {
  const params = new URLSearchParams({
    months: String(periodMonths),
    page: String(page),
    pageSize: String(pageSize),
    type: typeFilter,
  });
  if (personId !== "all") params.set("personId", personId);
  if (search) params.set("search", search);
  if (periodMode === "payday") {
    params.set("periodMode", "payday");
    if (cycleKey) params.set("cycleKey", cycleKey);
  }

  if (categorySelection?.kind === "merged") {
    params.set("categoryGroups", categorySelection.groups.join(","));
    params.set("cashFlowOnly", "true");
  } else if (categorySelection?.kind === "single") {
    params.set("categoryGroup", categorySelection.group);
    params.set("cashFlowOnly", "true");
  } else if (category !== "all") {
    params.set("category", category);
  }

  return `/api/transactions?${params.toString()}`;
}

export function RecentTransactions({
  personId,
  dashboardMonths,
  periodMode = "calendar",
  cycleKey,
  periodSummary,
  categorySelection = null,
  onClearCategorySelection,
  sectionRef,
  simulationEnabled = false,
  onSaveSimulations,
  savingSimulation = false,
  simulateModalOpen: simulateModalOpenProp,
  onSimulateModalOpenChange,
  creditAccounts = [],
  bankBalance,
  currentCycle,
}: Props) {
  const [periodMonths, setPeriodMonths] = useState<DashboardMonths>(dashboardMonths);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailTxId, setDetailTxId] = useState<string | null>(null);
  const [simulateModalOpenLocal, setSimulateModalOpenLocal] = useState(false);
  const simulateModalOpen = simulateModalOpenProp ?? simulateModalOpenLocal;
  const setSimulateModalOpen = onSimulateModalOpenChange ?? setSimulateModalOpenLocal;

  const queryClient = useQueryClient();

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    setPeriodMonths(dashboardMonths);
  }, [dashboardMonths]);

  useEffect(() => {
    if (!categorySelection) return;
    setPage(1);
    setTypeFilter("outflow");
    setCategoryFilter("all");
    setPeriodMonths(dashboardMonths);
  }, [categorySelection, dashboardMonths]);

  useEffect(() => {
    setPage(1);
  }, [periodMonths, personId, debouncedSearch, categoryFilter, typeFilter, pageSize, categorySelection, periodMode, cycleKey]);

  const showPersonColumn = personId === "all";
  const syncedWithDashboard = periodMonths === dashboardMonths;
  const hidePeriodSelector = periodMode === "payday" && cycleKey != null && syncedWithDashboard;
  const hasChartCategoryFilter = categorySelection != null;

  const handleClearChartFilter = () => {
    setTypeFilter("all");
    onClearCategorySelection?.();
  };

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, category }: { id: string; category: string }) =>
      api.patch<{ ok: boolean; category: string }>(`/api/transactions/${id}`, { category }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditingId(null);
    },
  });

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
      categorySelection,
      periodMode,
      cycleKey,
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
          categorySelection,
          periodMode,
          cycleKey,
        ),
      ),
  });

  const data = query.data;
  const items = data?.items ?? [];
  const categories = data?.categories ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currencyCode = items[0]?.currencyCode ?? "BRL";

  const useCyclePeriodSummary = Boolean(
    periodSummary &&
      periodMode === "payday" &&
      syncedWithDashboard &&
      !debouncedSearch &&
      categoryFilter === "all" &&
      !hasChartCategoryFilter &&
      typeFilter === "all",
  );

  const footerSummary = useCyclePeriodSummary
    ? {
        income: periodSummary!.income,
        expenses: periodSummary!.expenses,
        net: periodSummary!.net,
        availableNet: periodSummary!.availableNet,
        committedExpenses: periodSummary!.committedExpenses ?? 0,
      }
    : data?.summary
      ? {
          income: data.summary.income,
          expenses: data.summary.expenses,
          net: data.summary.net,
        }
      : null;

  const showEmptyState = !query.isLoading && !query.isError && items.length === 0;

  return (
    <section ref={sectionRef as Ref<HTMLElement>} className="scroll-mt-6">
      <motion.section
        custom={6}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className={`${cardLargeClass} overflow-hidden p-0`}
      >
      <div className="flex flex-col gap-4 border-b border-app-border/60 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Transações Recentes
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Histórico de saídas de débito e créditos recebidos
              {syncedWithDashboard && (
                <span className="ml-1.5 text-slate-300">
                  · {cycleKey ? "Mesmo ciclo do painel" : "Mesmo período do painel"}
                </span>
              )}
            </p>
            {hasChartCategoryFilter && categorySelection && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700">
                <span>
                  {categorySelectionLabel(categorySelection)} · Saídas
                  {syncedWithDashboard && " · Período do painel"}
                </span>
                <button
                  type="button"
                  onClick={handleClearChartFilter}
                  className="rounded-full p-0.5 text-indigo-500 transition hover:bg-indigo-100 hover:text-indigo-800"
                  aria-label="Limpar filtro de categoria"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
          {!hidePeriodSelector && (
            <PeriodSelector value={periodMonths} onChange={setPeriodMonths} showModeToggle={false} />
          )}
          {simulationEnabled && onSaveSimulations && (
            <button
              type="button"
              onClick={() => setSimulateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Simular compra
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5">
          <div className="flex items-center gap-1.5 rounded-xl border border-app-border bg-app-bg px-2.5 py-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-32 bg-transparent text-[11px] outline-none sm:w-40"
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-app-border bg-app-bg px-2.5 py-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              disabled={hasChartCategoryFilter}
              className="bg-transparent text-[11px] font-medium text-muted-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="all">Todas Categorias</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center rounded-xl border border-app-border bg-app-bg px-2.5 py-1">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TransactionTypeFilter)}
              className="bg-transparent text-[11px] font-medium text-muted-foreground outline-none"
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
        <p className="px-6 py-8 text-center text-sm text-danger">
          Não foi possível carregar as transações. Tente novamente.
        </p>
      ) : showEmptyState ? (
        <p className="px-6 py-8 text-center text-sm text-muted-foreground">
          Nenhuma transação encontrada com os filtros selecionados.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-app-bg/50 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
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
                const label = categoryLabel(tx.category);
                const Icon = categoryIcon(tx.category);
                const isOutflow = isTransactionOutflow(tx.amount, tx.accountType);
                const isEditing = editingId === tx.id;

                return (
                  <tr
                    key={tx.id}
                    className="cursor-pointer hover:bg-app-bg/70"
                    onClick={() => setDetailTxId(tx.id)}
                  >
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs font-medium text-muted-foreground">
                      {formatDateShort(tx.date)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="block font-bold text-foreground">{tx.description}</span>
                      <span className="text-[10px] text-muted-foreground">{tx.accountName}</span>
                      {tx.commitmentSummary && (
                        <span className="mt-1 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                          {tx.commitmentSummary.title} · {tx.commitmentSummary.sequence}/
                          {tx.commitmentSummary.totalInstallments}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      {isEditing ? (
                        <select
                          autoFocus
                          defaultValue={label}
                          disabled={updateCategoryMutation.isPending}
                          onChange={(e) => {
                            updateCategoryMutation.mutate({ id: tx.id, category: e.target.value });
                          }}
                          onBlur={() => setEditingId(null)}
                          className="max-w-[12rem] rounded-lg border border-indigo-200 bg-app-surface px-2 py-1 text-xs outline-none"
                        >
                          {FINE_GRAINED_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingId(tx.id)}
                          className="inline-flex text-start gap-2 text-xs font-medium transition hover:text-indigo-600"
                          title="Clique para corrigir a categoria"
                        >
                          <span className="rounded-md border border-app-border/50 bg-slate-100 p-1">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </span>
                          {label}
                          {tx.categorySource === "user" && (
                            <span className="text-[9px] text-indigo-500">(editada)</span>
                          )}
                        </button>
                      )}
                    </td>
                    {showPersonColumn && (
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">{tx.personName}</td>
                    )}
                    <td
                      className={`whitespace-nowrap px-4 py-3.5 text-right text-sm font-bold ${
                        isOutflow ? "text-foreground" : "text-positive"
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
                            ? "border border-app-border bg-app-bg text-muted-foreground"
                            : "border border-positive/20 bg-positive/10 text-positive"
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

      <div className="flex flex-col gap-4 border-t border-app-border/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {footerSummary && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              {total} transação{total !== 1 ? "ões" : ""}
            </span>
            <span>
              {CYCLE_COPY.income}:{" "}
              <strong className="text-foreground/90">
                {formatPlainAmount(footerSummary.income, currencyCode)}
              </strong>
            </span>
            <span>
              {CYCLE_COPY.spent}:{" "}
              <strong className="text-foreground/90">
                {formatPlainAmount(footerSummary.expenses, currencyCode)}
              </strong>
            </span>
            <span>
              {useCyclePeriodSummary ? CYCLE_COPY.untilNow : "Líquido"}:{" "}
              <strong
                className={
                  footerSummary.net >= 0 ? "text-positive" : "text-negative"
                }
              >
                {useCyclePeriodSummary
                  ? (() => {
                      const display = formatCycleBalance(footerSummary.net, currencyCode);
                      return `${display.status} ${formatPlainAmount(display.amount, currencyCode)}`;
                    })()
                  : formatCurrency(footerSummary.net, currencyCode)}
              </strong>
            </span>
            {useCyclePeriodSummary &&
              (footerSummary.committedExpenses ?? 0) > 0 &&
              footerSummary.availableNet != null && (
                <span>
                  {CYCLE_COPY.afterScheduled}:{" "}
                  <strong
                    className={
                      footerSummary.availableNet >= 0 ? "text-positive" : "text-negative"
                    }
                  >
                    {formatCycleBalance(footerSummary.availableNet, currencyCode).status}{" "}
                    {formatPlainAmount(Math.abs(footerSummary.availableNet), currencyCode)}
                  </strong>
                </span>
              )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Por página</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-[11px] font-medium text-foreground/90 outline-none"
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
              className="rounded-lg border border-app-border p-1.5 text-muted-foreground transition hover:bg-app-bg disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[4.5rem] text-center text-[11px] font-medium text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || query.isLoading}
              className="rounded-lg border border-app-border p-1.5 text-muted-foreground transition hover:bg-app-bg disabled:opacity-40"
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      </motion.section>

      <TransactionDetailModal
        transactionId={detailTxId}
        onClose={() => setDetailTxId(null)}
      />

      {simulationEnabled && onSaveSimulations && currentCycle && (
        <SimulatePurchaseModal
          open={simulateModalOpen}
          currencyCode={currencyCode}
          creditAccounts={creditAccounts}
          bankBalance={bankBalance}
          currentCycle={currentCycle}
          onClose={() => setSimulateModalOpen(false)}
          onSave={onSaveSimulations}
          saving={savingSimulation}
        />
      )}
    </section>
  );
}
