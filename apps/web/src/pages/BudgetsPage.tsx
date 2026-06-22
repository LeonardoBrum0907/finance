import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BudgetCategoryItem, BudgetsSummary, PersonDTO } from "@finance/shared";
import { api } from "../lib/api";
import { BudgetCategoryCard } from "../components/budgets/BudgetCategoryCard";
import { BudgetOverviewCard } from "../components/budgets/BudgetOverviewCard";
import { BudgetsSkeleton } from "../components/budgets/BudgetsSkeleton";
import { EditBudgetLimitModal } from "../components/budgets/EditBudgetLimitModal";
import { PersonSelector, type PersonFilter } from "../components/dashboard/PersonSelector";

export function BudgetsPage() {
  const [personId, setPersonId] = useState<PersonFilter>("all");
  const [editingCategory, setEditingCategory] = useState<BudgetCategoryItem | null>(null);
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

  const updateLimit = useMutation({
    mutationFn: ({ group, limit }: { group: string; limit: number }) => {
      const url =
        personId === "all"
          ? `/api/budgets/${encodeURIComponent(group)}`
          : `/api/budgets/${encodeURIComponent(group)}?personId=${personId}`;
      return api.put<BudgetsSummary>(url, { limit });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["budgets", personId], data);
      setEditingCategory(null);
    },
  });

  const handleSaveLimit = useCallback(
    (group: string, limit: number) => {
      updateLimit.mutate({ group, limit });
    },
    [updateLimit],
  );

  const data = budgets.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
            Orçamentos Mensais
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Planeje seus tetos de consumo para evitar surpresas e acelerar a conquista de suas
            metas financeiras.
          </p>
        </div>
        {data?.hasAccounts && (
          <PersonSelector
            value={personId}
            people={people.data ?? []}
            onChange={setPersonId}
          />
        )}
      </div>

      {budgets.isLoading ? (
        <BudgetsSkeleton />
      ) : budgets.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Não foi possível carregar os orçamentos. Tente novamente em instantes.
        </div>
      ) : !data?.hasAccounts ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Nenhuma conta conectada ainda</p>
          <p className="mt-1 text-sm text-slate-500">
            Cadastre uma pessoa e conecte uma conta bancária na aba{" "}
            <strong>Pessoas</strong> para acompanhar seus orçamentos.
          </p>
        </div>
      ) : (
        <>
          <BudgetOverviewCard data={data} />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {data.categories.map((item) => (
              <BudgetCategoryCard
                key={item.group}
                item={item}
                currencyCode={data.currencyCode}
                onEdit={setEditingCategory}
              />
            ))}
          </div>
        </>
      )}

      <EditBudgetLimitModal
        category={editingCategory}
        currencyCode={data?.currencyCode ?? "BRL"}
        saving={updateLimit.isPending}
        onClose={() => setEditingCategory(null)}
        onSave={handleSaveLimit}
      />
    </div>
  );
}
