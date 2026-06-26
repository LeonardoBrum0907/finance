import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator } from "lucide-react";
import type {
  CreateGoalInput,
  GoalsSummaryDTO,
  PersonDTO,
  SimulationInput,
  SimulationResultDTO,
  SimulatorBaselineDTO,
} from "@finance/shared";
import { api } from "../lib/api";
import { AssistantSpotlightButton } from "../components/chat/AssistantSpotlightButton";
import { PersonSelector, type PersonFilter } from "../components/dashboard/PersonSelector";
import { CreateGoalModal } from "../components/goals/CreateGoalModal";
import { BaselineCard } from "../components/simulator/BaselineCard";
import { ScenarioForm } from "../components/simulator/ScenarioForm";
import { SimulationResults } from "../components/simulator/SimulationResults";

function baselineUrl(personId: PersonFilter): string {
  return personId === "all" ? "/api/simulator/baseline" : `/api/simulator/baseline?personId=${personId}`;
}

function addMonthsToDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function SimulatorPage() {
  const [personId, setPersonId] = useState<PersonFilter>("all");
  const [result, setResult] = useState<SimulationResultDTO | null>(null);
  const [createGoalOpen, setCreateGoalOpen] = useState(false);
  const [goalInitial, setGoalInitial] = useState<{
    name?: string;
    type?: CreateGoalInput["type"];
    targetAmount?: number;
    targetDate?: string;
  }>();
  const queryClient = useQueryClient();

  const people = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<PersonDTO[]>("/api/people"),
  });

  const baseline = useQuery({
    queryKey: ["simulator-baseline", personId],
    queryFn: () => api.get<SimulatorBaselineDTO>(baselineUrl(personId)),
  });

  const goals = useQuery({
    queryKey: ["goals"],
    queryFn: () => api.get<GoalsSummaryDTO>("/api/goals"),
  });

  const simulate = useMutation({
    mutationFn: (input: SimulationInput) => {
      const body: SimulationInput = {
        ...input,
        personId: personId === "all" ? undefined : personId,
      };
      return api.post<SimulationResultDTO>("/api/simulator/run", body);
    },
    onSuccess: (data) => setResult(data),
  });

  const createGoal = useMutation({
    mutationFn: (body: CreateGoalInput) => api.post<GoalsSummaryDTO>("/api/goals", body),
    onSuccess: (data) => {
      queryClient.setQueryData(["goals"], data);
      setCreateGoalOpen(false);
    },
  });

  const handleConvertFixed = useCallback(() => {
    if (!result) return;
    const lastInput = simulate.variables;
    const amount = lastInput?.amount ?? 0;

    setGoalInitial({
      name: result.name ?? "Nova compra",
      type: result.type === "save_for_goal" ? "savings" : "purchase",
      targetAmount: amount,
      targetDate:
        result.projected.estimatedMonths != null
          ? addMonthsToDate(result.projected.estimatedMonths)
          : result.goalImpact.monthsDelayed
            ? addMonthsToDate(result.goalImpact.monthsDelayed + 3)
            : undefined,
    });
    setCreateGoalOpen(true);
  }, [result, simulate.variables]);

  const handleCreateGoal = async (payload: {
    name: string;
    description?: string;
    type: CreateGoalInput["type"];
    targetAmount: number;
    targetDate?: string;
  }) => {
    await createGoal.mutateAsync(payload);
  };

  const handleClearSimulation = useCallback(() => {
    setResult(null);
    simulate.reset();
  }, [simulate]);

  const effectivePersonId = personId === "all" ? undefined : personId;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="h-6 w-6 text-emerald-600" />
            <h1 className="font-display text-2xl font-bold text-slate-900">Simulador</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Simule compras e objetivos considerando sua saúde financeira atual
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {people.data && (
            <PersonSelector
              value={personId}
              people={people.data}
              onChange={(next) => {
                setPersonId(next);
                setResult(null);
              }}
            />
          )}
          <AssistantSpotlightButton
            label="Analisar com IA"
            message="Quero simular uma compra — quanto posso gastar sem comprometer minhas metas?"
            contextKey="simulator:page"
            title="Simulador"
            personId={effectivePersonId}
          />
        </div>
      </div>

      {baseline.isLoading && (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-8 text-center text-sm text-slate-500">
          Carregando sua situação financeira...
        </div>
      )}

      {baseline.isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Não foi possível carregar os dados. Tente novamente.
        </div>
      )}

      {baseline.data && (
        <>
          <BaselineCard baseline={baseline.data} />
          <ScenarioForm
            baseline={baseline.data}
            loading={simulate.isPending}
            hasResult={result !== null}
            onSubmit={(input) => simulate.mutate(input)}
            onClear={handleClearSimulation}
          />
        </>
      )}

      {simulate.isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Erro ao simular. Verifique os dados e tente novamente.
        </div>
      )}

      {result && baseline.data && (
        <SimulationResults
          result={result}
          baseline={baseline.data}
          onConvertToGoal={handleConvertFixed}
          personId={effectivePersonId}
        />
      )}

      <CreateGoalModal
        open={createGoalOpen}
        saving={createGoal.isPending}
        availableSources={goals.data?.availableSources ?? []}
        currencyCode={goals.data?.currencyCode ?? baseline.data?.currencyCode}
        initialValues={goalInitial}
        onClose={() => setCreateGoalOpen(false)}
        onSave={handleCreateGoal}
      />
    </div>
  );
}
