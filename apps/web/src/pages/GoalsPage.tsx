import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Target } from "lucide-react";
import { AssistantSpotlightButton } from "../components/chat/AssistantSpotlightButton";
import type { GoalSourceSelection } from "../components/goals/GoalSourceSelector";
import type {
  CreateGoalInput,
  CreatePlanInput,
  GoalDTO,
  GoalsSummaryDTO,
  UpdateGoalInput,
} from "@finance/shared";
import { api } from "../lib/api";
import { AddFundsModal } from "../components/goals/AddFundsModal";
import { CreateGoalModal } from "../components/goals/CreateGoalModal";
import { CreatePlanModal } from "../components/goals/CreatePlanModal";
import { EditGoalModal } from "../components/goals/EditGoalModal";
import { GoalCard } from "../components/goals/GoalCard";
import { PlanCard } from "../components/goals/PlanCard";
import { SavingsPathChart } from "../components/goals/SavingsPathChart";

export function GoalsPage() {
  const [createGoalOpen, setCreateGoalOpen] = useState(false);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalDTO | null>(null);
  const [fundingGoal, setFundingGoal] = useState<GoalDTO | null>(null);
  const queryClient = useQueryClient();

  const goalsQuery = useQuery({
    queryKey: ["goals"],
    queryFn: () => api.get<GoalsSummaryDTO>("/api/goals"),
  });

  const invalidateGoals = useCallback(
    (data: GoalsSummaryDTO) => {
      queryClient.setQueryData(["goals"], data);
    },
    [queryClient],
  );

  const createGoal = useMutation({
    mutationFn: (body: CreateGoalInput) => api.post<GoalsSummaryDTO>("/api/goals", body),
  });

  const updateGoal = useMutation({
    mutationFn: ({ id, ...body }: UpdateGoalInput & { id: string }) =>
      api.put<GoalsSummaryDTO>(`/api/goals/${id}`, body),
  });

  const handleCreateGoal = async (
    payload: CreateGoalInput & { sources?: GoalSourceSelection[] },
  ) => {
    const summary = await createGoal.mutateAsync(payload);
    if (payload.sources && payload.sources.length > 0) {
      const created = summary.goals.find((g) => g.name === payload.name);
      if (created) {
        const linked = await api.put<GoalsSummaryDTO>(`/api/goals/${created.id}/sources`, {
          sources: payload.sources,
        });
        invalidateGoals(linked);
        setCreateGoalOpen(false);
        return;
      }
    }
    invalidateGoals(summary);
    setCreateGoalOpen(false);
  };

  const handleUpdateGoal = async (
    payload: UpdateGoalInput & { id: string; sources?: GoalSourceSelection[] | null },
  ) => {
    const { id, sources, ...body } = payload;
    await updateGoal.mutateAsync({ id, ...body });

    if (sources === null) {
      const cleared = await api.delete<GoalsSummaryDTO>(`/api/goals/${id}/sources`);
      invalidateGoals(cleared);
    } else if (sources && sources.length > 0) {
      const linked = await api.put<GoalsSummaryDTO>(`/api/goals/${id}/sources`, { sources });
      invalidateGoals(linked);
    } else {
      const summary = await api.get<GoalsSummaryDTO>("/api/goals");
      invalidateGoals(summary);
    }
    setEditingGoal(null);
  };

  const deleteGoal = useMutation({
    mutationFn: (id: string) => api.delete<GoalsSummaryDTO>(`/api/goals/${id}`),
    onSuccess: (data) => {
      invalidateGoals(data);
      setEditingGoal(null);
    },
  });

  const addContribution = useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note?: string }) =>
      api.post<GoalsSummaryDTO>(`/api/goals/${id}/contributions`, { amount, note }),
    onSuccess: (data) => {
      invalidateGoals(data);
      setFundingGoal(null);
    },
  });

  const createPlan = useMutation({
    mutationFn: (body: CreatePlanInput) => api.post<GoalsSummaryDTO>("/api/plans", body),
    onSuccess: (data) => {
      invalidateGoals(data);
      setCreatePlanOpen(false);
    },
  });

  const deletePlan = useMutation({
    mutationFn: (id: string) => api.delete<GoalsSummaryDTO>(`/api/plans/${id}`),
    onSuccess: invalidateGoals,
  });

  const data = goalsQuery.data;
  const activeGoals = data?.goals.filter((g) => g.status !== "archived") ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
            Objetivos e Planos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Acompanhe suas metas financeiras e veja como a{" "}
            {data?.surplusLabel ?? "sobra média"} impacta cada objetivo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeGoals.length > 0 && (
            <AssistantSpotlightButton
              label="Montar plano com IA"
              message={`Monte um plano de poupança para meus objetivos: ${activeGoals.map((g) => g.name).join(", ")}`}
              contextKey="goals:plan"
              title="Plano de objetivos"
              contextHint={JSON.stringify({
                source: "goals_page",
                goalIds: activeGoals.map((g) => g.id),
              })}
              className="px-3 py-2.5 text-sm"
            />
          )}
          <button
            type="button"
            onClick={() => setCreateGoalOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Novo objetivo
          </button>
          <button
            type="button"
            onClick={() => setCreatePlanOpen(true)}
            disabled={(activeGoals.length ?? 0) === 0}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <Target className="h-4 w-4" />
            Novo plano
          </button>
        </div>
      </div>

      {goalsQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Carregando objetivos...
        </div>
      ) : goalsQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Não foi possível carregar os objetivos. Tente novamente em instantes.
        </div>
      ) : (
        <>
          <SavingsPathChart
            data={data?.savingsPath ?? []}
            currencyCode={data?.currencyCode ?? "BRL"}
            monthlySurplus={data?.monthlySurplus ?? 0}
            monthlyContribution={data?.monthlyContribution ?? data?.monthlySurplus ?? 0}
            surplusLabel={data?.surplusLabel}
            totalCurrent={data?.totalCurrent ?? 0}
            totalTarget={data?.totalTarget ?? 0}
            projectedCompletionMonth={data?.projectedCompletionMonth ?? null}
          />

          {!data?.hasAccounts && (
            <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3 text-sm text-amber-800">
              Conecte contas bancárias em{" "}
              <Link to="/contas" className="font-medium text-amber-900 underline">
                Contas
              </Link>{" "}
              para calcular a sobra mensal e projeções mais precisas.
            </div>
          )}

          <section>
            <h2 className="mb-4 font-display text-lg font-semibold text-slate-900">
              Seus objetivos
            </h2>
            {activeGoals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-sm font-medium text-slate-700">Nenhum objetivo criado</p>
                <p className="mt-1 text-sm text-slate-500">
                  Crie sua primeira meta ou peça ajuda ao assistente no chat.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {activeGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    currencyCode={data?.currencyCode ?? "BRL"}
                    onEdit={setEditingGoal}
                    onAddFunds={setFundingGoal}
                  />
                ))}
              </div>
            )}
          </section>

          {(data?.plans.length ?? 0) > 0 && (
            <section>
              <h2 className="mb-4 font-display text-lg font-semibold text-slate-900">
                Planos de poupança
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {data!.plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    currencyCode={data?.currencyCode ?? "BRL"}
                    onDelete={(id) => deletePlan.mutate(id)}
                    deleting={deletePlan.isPending}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <CreateGoalModal
        open={createGoalOpen}
        saving={createGoal.isPending}
        availableSources={data?.availableSources ?? []}
        currencyCode={data?.currencyCode ?? "BRL"}
        onClose={() => setCreateGoalOpen(false)}
        onSave={(payload) => handleCreateGoal(payload)}
      />

      <CreatePlanModal
        open={createPlanOpen}
        goals={activeGoals}
        currencyCode={data?.currencyCode ?? "BRL"}
        saving={createPlan.isPending}
        onClose={() => setCreatePlanOpen(false)}
        onSave={(payload) => createPlan.mutate(payload)}
      />

      <EditGoalModal
        goal={editingGoal}
        saving={updateGoal.isPending}
        deleting={deleteGoal.isPending}
        availableSources={data?.availableSources ?? []}
        currencyCode={data?.currencyCode ?? "BRL"}
        onClose={() => setEditingGoal(null)}
        onSave={(payload) => handleUpdateGoal(payload)}
        onDelete={(id) => deleteGoal.mutate(id)}
      />

      <AddFundsModal
        goal={fundingGoal}
        currencyCode={data?.currencyCode ?? "BRL"}
        saving={addContribution.isPending}
        onClose={() => setFundingGoal(null)}
        onSave={({ id, amount, note }) => addContribution.mutate({ id, amount, note })}
      />
    </div>
  );
}
