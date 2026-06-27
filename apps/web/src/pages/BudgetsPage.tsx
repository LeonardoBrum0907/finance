import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type {
  BudgetItem,
  BudgetsSummary,
  CreateBudgetInput,
  PersonDTO,
  UpdateBudgetInput,
} from "@finance/shared";
import { api } from "../lib/api";
import { BudgetCategoryCard } from "../components/budgets/BudgetCategoryCard";
import { BudgetOverviewCard } from "../components/budgets/BudgetOverviewCard";
import { BudgetsSkeleton } from "../components/budgets/BudgetsSkeleton";
import {
  BudgetToolbar,
  matchesBudgetSearch,
  type BudgetSortMode,
} from "../components/budgets/BudgetToolbar";
import { CreateBudgetModal } from "../components/budgets/CreateBudgetModal";
import { EditBudgetModal } from "../components/budgets/EditBudgetModal";
import { PersonSelector, type PersonFilter } from "../components/dashboard/PersonSelector";

function personQuerySuffix(personId: PersonFilter): string {
  return personId === "all" ? "" : `?personId=${personId}`;
}

export function BudgetsPage() {
  const [personId, setPersonId] = useState<PersonFilter>("all");
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<BudgetSortMode>("alphabetical");
  const queryClient = useQueryClient();

  const people = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<PersonDTO[]>("/api/people"),
  });

  const budgetsUrl =
    personId === "all" ? "/api/budgets" : `/api/budgets?personId=${personId}`;

  const budgets = useQuery({
    queryKey: ["budgets", personId],
    queryFn: () => api.get<BudgetsSummary>(budgetsUrl),
  });

  const invalidateBudgets = useCallback(
    (data: BudgetsSummary) => {
      queryClient.setQueryData(["budgets", personId], data);
    },
    [personId, queryClient],
  );

  const createBudget = useMutation({
    mutationFn: (body: CreateBudgetInput) =>
      api.post<BudgetsSummary>("/api/budgets", body),
    onSuccess: (data) => {
      invalidateBudgets(data);
      setCreateOpen(false);
    },
  });

  const updateBudget = useMutation({
    mutationFn: ({ id, ...body }: UpdateBudgetInput & { id: string }) =>
      api.put<BudgetsSummary>(`/api/budgets/${id}${personQuerySuffix(personId)}`, body),
    onSuccess: (data) => {
      invalidateBudgets(data);
      setEditingBudget(null);
    },
  });

  const deleteBudget = useMutation({
    mutationFn: (id: string) =>
      api.delete<BudgetsSummary>(`/api/budgets/${id}${personQuerySuffix(personId)}`),
    onSuccess: (data) => {
      invalidateBudgets(data);
      setEditingBudget(null);
    },
  });

  const data = budgets.data;

  const filteredBudgets = useMemo(() => {
    if (!data?.budgets) return [];
    const filtered = data.budgets.filter((item) =>
      matchesBudgetSearch(item.name, item.categories, search),
    );
    const sorted = [...filtered];
    if (sort === "alphabetical") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    } else {
      sorted.sort((a, b) => b.spent - a.spent);
    }
    return sorted;
  }, [data?.budgets, search, sort]);

  const hasBudgets = (data?.budgets.length ?? 0) > 0;
  const searchActive = search.trim().length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Orçamentos Mensais
          </h1>
          <p className="mt-1 text-sm text-muted-foreground-dark">
            Planeje seus tetos de consumo para evitar surpresas e acelerar a conquista de suas
            metas financeiras.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data?.hasAccounts && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Novo orçamento
            </button>
          )}
          {data?.hasAccounts && (
            <PersonSelector
              value={personId}
              people={people.data ?? []}
              onChange={setPersonId}
            />
          )}
        </div>
      </div>

      {budgets.isLoading ? (
        <BudgetsSkeleton />
      ) : budgets.isError ? (
        <div className="rounded-xl border border-danger-border bg-danger-muted p-6 text-sm text-danger">
          Não foi possível carregar os orçamentos. Tente novamente em instantes.
        </div>
      ) : !data?.hasAccounts ? (
        <div className="rounded-xl border border-dashed border-app-border bg-app-surface p-10 text-center">
          <p className="text-sm font-medium text-foreground/90">Nenhuma conta conectada ainda</p>
          <p className="mt-1 text-sm text-muted-foreground-dark">
            Cadastre em <strong>Pessoas</strong> e conecte em <strong>Contas</strong> para
            acompanhar seus orçamentos.
          </p>
        </div>
      ) : (
        <>
          <BudgetOverviewCard data={data} />

          {data.availableCategories.length > 0 && (
            <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3 text-sm text-amber-800">
              {data.availableCategories.length === 1
                ? "1 categoria ainda sem orçamento"
                : `${data.availableCategories.length} categorias ainda sem orçamento`}
              {": "}
              <span className="text-amber-700">{data.availableCategories.join(", ")}</span>
            </div>
          )}

          {!hasBudgets ? (
            <div className="rounded-xl border border-dashed border-app-border bg-app-surface p-10 text-center">
              <p className="text-sm font-medium text-foreground/90">Nenhum orçamento criado</p>
              <p className="mt-1 text-sm text-muted-foreground-dark">
                Monte seu primeiro orçamento agrupando categorias automáticas com um limite mensal.
              </p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Criar primeiro orçamento
              </button>
            </div>
          ) : (
            <>
              <BudgetToolbar
                search={search}
                sort={sort}
                onSearchChange={setSearch}
                onSortChange={setSort}
              />

              {filteredBudgets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-app-border bg-app-surface p-8 text-center">
                  <p className="text-sm font-medium text-foreground/90">Nenhum orçamento encontrado</p>
                  <p className="mt-1 text-sm text-muted-foreground-dark">
                    {searchActive
                      ? "Tente outro termo de busca."
                      : "Ajuste os filtros para ver seus orçamentos."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {filteredBudgets.map((item) => (
                    <BudgetCategoryCard
                      key={item.id}
                      item={item}
                      currencyCode={data.currencyCode}
                      onEdit={setEditingBudget}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <CreateBudgetModal
        open={createOpen}
        availableCategories={data?.availableCategories ?? []}
        saving={createBudget.isPending}
        onClose={() => setCreateOpen(false)}
        onSave={(payload) => createBudget.mutate(payload)}
      />

      <EditBudgetModal
        budget={editingBudget}
        availableCategories={data?.availableCategories ?? []}
        saving={updateBudget.isPending}
        deleting={deleteBudget.isPending}
        onClose={() => setEditingBudget(null)}
        onSave={(payload) => updateBudget.mutate(payload)}
        onDelete={(id) => deleteBudget.mutate(id)}
      />
    </div>
  );
}
