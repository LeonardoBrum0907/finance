import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import type {
  AggregateSimulationImpactDTO,
  CreateSimulationScenarioInput,
  PersonDTO,
  SimulationResultDTO,
  SimulationScenarioDTO,
  SimulatorBaselineDTO,
  UpdateSimulationScenarioInput,
} from "@finance/shared";
import { api } from "../lib/api";
import { AssistantSpotlightButton } from "../components/chat/AssistantSpotlightButton";
import { PersonSelector, type PersonFilter } from "../components/dashboard/PersonSelector";
import { BaselineCard } from "../components/simulator/BaselineCard";
import { SimulationResults } from "../components/simulator/SimulationResults";
import { ScenarioList, type ScenarioListTab } from "../components/simulator/ScenarioList";
import { AggregateImpactPanel } from "../components/simulator/AggregateImpactPanel";
import { CompleteScenarioModal } from "../components/simulator/CompleteScenarioModal";
import { ScenarioEditorModal } from "../components/simulator/ScenarioEditorModal";

function baselineUrl(personId: PersonFilter): string {
  return personId === "all" ? "/api/simulator/baseline" : `/api/simulator/baseline?personId=${personId}`;
}

function scenariosUrl(personId: PersonFilter, tab: ScenarioListTab): string {
  const params = new URLSearchParams();
  if (personId !== "all") params.set("personId", personId);
  if (tab === "active") params.set("status", "active");
  else if (tab === "draft") params.set("status", "draft");
  else params.set("status", "completed_history");
  const qs = params.toString();
  return qs ? `/api/simulations?${qs}` : "/api/simulations";
}

function impactUrl(personId: PersonFilter): string {
  return personId === "all" ? "/api/simulations/impact" : `/api/simulations/impact?personId=${personId}`;
}

export function SimulatorPage() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [personId, setPersonId] = useState<PersonFilter>("all");
  const [tab, setTab] = useState<ScenarioListTab>("active");
  const [analysisResult, setAnalysisResult] = useState<SimulationResultDTO | null>(null);
  const [detailScenarioId, setDetailScenarioId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<SimulationScenarioDTO | null>(null);
  const [completeScenario, setCompleteScenario] = useState<SimulationScenarioDTO | null>(null);
  const [convertScenarioId, setConvertScenarioId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const people = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<PersonDTO[]>("/api/people"),
  });

  const baseline = useQuery({
    queryKey: ["simulator-baseline", personId],
    queryFn: () => api.get<SimulatorBaselineDTO>(baselineUrl(personId)),
  });

  const scenarios = useQuery({
    queryKey: ["simulations", personId, tab],
    queryFn: () => api.get<SimulationScenarioDTO[]>(scenariosUrl(personId, tab)),
  });

  const impact = useQuery({
    queryKey: ["simulations-impact", personId],
    queryFn: () => api.get<AggregateSimulationImpactDTO>(impactUrl(personId)),
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["simulations"] });
    queryClient.invalidateQueries({ queryKey: ["simulations-impact"] });
  }, [queryClient]);

  const runScenario = useMutation({
    mutationFn: (id: string) => api.post<SimulationResultDTO>(`/api/simulations/${id}/run`),
    onSuccess: (data, id) => {
      setAnalysisResult(data);
      setDetailScenarioId(id);
      invalidateAll();
    },
  });

  const createScenario = useMutation({
    mutationFn: (body: CreateSimulationScenarioInput) =>
      api.post<SimulationScenarioDTO>("/api/simulations", body),
    onSuccess: (created) => {
      invalidateAll();
      setEditorOpen(false);
      setEditingScenario(null);
      setTab("active");
      setDetailScenarioId(created.id);
      runScenario.mutate(created.id);
    },
  });

  const updateScenario = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSimulationScenarioInput }) =>
      api.patch<SimulationScenarioDTO>(`/api/simulations/${id}`, body),
    onSuccess: (updated) => {
      invalidateAll();
      setEditorOpen(false);
      setEditingScenario(null);
      runScenario.mutate(updated.id);
    },
  });

  const completeScenarioMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { transactionId?: string; note?: string };
    }) => api.post<SimulationScenarioDTO>(`/api/simulations/${id}/complete`, body),
    onSuccess: () => {
      invalidateAll();
      setCompleteScenario(null);
      setAnalysisResult(null);
      setDetailScenarioId(null);
      setTab("history");
    },
  });

  const convertToGoal = useMutation({
    mutationFn: (id: string) =>
      api.post<{ scenario: SimulationScenarioDTO; goalId: string }>(
        `/api/simulations/${id}/convert-to-goal`,
        {},
      ),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setConvertScenarioId(null);
      setAnalysisResult(null);
      setDetailScenarioId(null);
      setTab("history");
    },
  });

  const archiveScenario = useMutation({
    mutationFn: (id: string) =>
      api.patch<SimulationScenarioDTO>(`/api/simulations/${id}`, { status: "archived" }),
    onSuccess: invalidateAll,
  });

  const deleteScenario = useMutation({
    mutationFn: (id: string) => api.delete(`/api/simulations/${id}`),
    onSuccess: invalidateAll,
  });

  const detailScenario = useMemo(
    () => scenarios.data?.find((s) => s.id === detailScenarioId) ?? null,
    [scenarios.data, detailScenarioId],
  );

  const handleConvertScenario = useCallback(
    (scenario: SimulationScenarioDTO) => {
      setConvertScenarioId(scenario.id);
      convertToGoal.mutate(scenario.id);
    },
    [convertToGoal],
  );

  const handleToggleActive = useCallback(
    (scenario: SimulationScenarioDTO) => {
      const nextStatus = scenario.status === "active" ? "draft" : "active";
      updateScenario.mutate({ id: scenario.id, body: { status: nextStatus } });
    },
    [updateScenario],
  );

  const effectivePersonId = personId === "all" ? undefined : personId;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="h-6 w-6 text-positive" />
            <h1 className="font-display text-2xl font-bold text-foreground">Simulador</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Planeje compras, despesas, poupança e investimentos — veja o impacto nos ciclos
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {people.data && (
            <PersonSelector
              value={personId}
              people={people.data}
              onChange={(next) => {
                setPersonId(next);
                setAnalysisResult(null);
                setDetailScenarioId(null);
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
        <div className="rounded-2xl border border-app-border/60 bg-app-surface p-8 text-center text-sm text-muted-foreground">
          Carregando sua situação financeira...
        </div>
      )}

      {baseline.isError && (
        <div className="rounded-2xl border border-negative/20 bg-negative/10 p-4 text-sm text-negative">
          Não foi possível carregar os dados. Tente novamente.
        </div>
      )}

      {baseline.data && (
        <>
          <BaselineCard baseline={baseline.data} />

          <div className="grid gap-6 lg:grid-cols-2">
            <ScenarioList
              scenarios={scenarios.data ?? []}
              currencyCode={baseline.data.currencyCode}
              tab={tab}
              highlightId={highlightId}
              onTabChange={setTab}
              onNew={() => {
                setEditingScenario(null);
                setEditorOpen(true);
              }}
              onRun={(id) => runScenario.mutate(id)}
              onEdit={(scenario) => {
                setEditingScenario(scenario);
                setEditorOpen(true);
              }}
              onToggleActive={handleToggleActive}
              onComplete={setCompleteScenario}
              onConvert={handleConvertScenario}
              onArchive={(id) => archiveScenario.mutate(id)}
              onDelete={(id) => deleteScenario.mutate(id)}
            />

            <AggregateImpactPanel impact={impact.data} loading={impact.isLoading} />
          </div>

          {runScenario.isError && (
            <div className="rounded-2xl border border-negative/20 bg-negative/10 p-4 text-sm text-negative">
              Erro ao analisar cenário. Tente novamente.
            </div>
          )}

          {analysisResult && detailScenario && baseline.data && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Análise: <span className="text-brand">{detailScenario.name}</span>
              </p>
              <SimulationResults
                result={analysisResult}
                baseline={baseline.data}
                onConvertToGoal={() => handleConvertScenario(detailScenario)}
                personId={effectivePersonId}
              />
            </div>
          )}
        </>
      )}

      {baseline.data && editorOpen && (
        <ScenarioEditorModal
          open={editorOpen}
          baseline={baseline.data}
          editing={editingScenario}
          saving={createScenario.isPending || updateScenario.isPending}
          onClose={() => {
            setEditorOpen(false);
            setEditingScenario(null);
          }}
          onCreate={(input) => createScenario.mutate({ ...input, personId: effectivePersonId })}
          onUpdate={(id, body) => updateScenario.mutate({ id, body })}
        />
      )}

      <CompleteScenarioModal
        open={!!completeScenario}
        scenario={completeScenario}
        currencyCode={baseline.data?.currencyCode ?? "BRL"}
        saving={completeScenarioMutation.isPending}
        onClose={() => setCompleteScenario(null)}
        onConfirm={(params) => {
          if (!completeScenario) return;
          completeScenarioMutation.mutate({ id: completeScenario.id, body: params });
        }}
      />

      {convertToGoal.isPending && convertScenarioId && (
        <p className="text-xs text-muted-foreground">Convertendo cenário em meta...</p>
      )}
    </div>
  );
}
