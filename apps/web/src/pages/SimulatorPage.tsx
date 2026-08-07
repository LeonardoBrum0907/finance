import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import type {
  CreateSimulationScenarioInput,
  DashboardCycleSummaryResponse,
  DetectRecurringBillsResponse,
  ManagedAccountDTO,
  PersonDTO,
  RecurringBillDTO,
  SimulationResultDTO,
  SimulationScenarioDTO,
  UpdateRecurringBillInput,
  UpdateSimulationScenarioInput,
} from "@finance/shared";
import { managedAccountToScenarioDTO, managedAccountLegacyId } from "@finance/shared";
import { api } from "../lib/api";
import { AssistantSpotlightButton } from "../components/chat/AssistantSpotlightButton";
import { CycleNavigator } from "../components/dashboard/CycleNavigator";
import { FinanceSummaryCard } from "../components/dashboard/FinanceSummaryCard";
import { PersonSelector, type PersonFilter } from "../components/dashboard/PersonSelector";
import { SimulationResults } from "../components/simulator/SimulationResults";
import { AccountsSection, type AccountsTab } from "../components/simulator/AccountsSection";
import { CompleteScenarioModal } from "../components/simulator/CompleteScenarioModal";
import { ScenarioEditorModal } from "../components/simulator/ScenarioEditorModal";

function summaryUrl(personId: PersonFilter, cycleKey?: string): string {
  const params = new URLSearchParams();
  if (personId !== "all") params.set("personId", personId);
  if (cycleKey) params.set("cycleKey", cycleKey);
  const qs = params.toString();
  return qs ? `/api/dashboard/summary?${qs}` : "/api/dashboard/summary";
}

function accountsUrl(personId: PersonFilter, tab: AccountsTab): string {
  const params = new URLSearchParams();
  if (personId !== "all") params.set("personId", personId);
  if (tab === "active") params.set("status", "active");
  else if (tab === "draft") params.set("status", "draft");
  else if (tab === "inactive") params.set("status", "inactive,cancelled");
  else if (tab === "history") params.set("status", "completed_history");
  const qs = params.toString();
  return qs ? `/api/accounts?${qs}` : "/api/accounts?status=active";
}

function detectRecurringBillsUrl(personId: PersonFilter): string {
  return personId === "all"
    ? "/api/recurring-bills/detect"
    : `/api/recurring-bills/detect?personId=${personId}`;
}

export function SimulatorPage() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [personId, setPersonId] = useState<PersonFilter>("all");
  const [selectedCycleKey, setSelectedCycleKey] = useState<string | null>(null);
  const [accountsTab, setAccountsTab] = useState<AccountsTab>("active");
  const [showManageTabs, setShowManageTabs] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SimulationResultDTO | null>(null);
  const [detailScenarioId, setDetailScenarioId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<SimulationScenarioDTO | null>(null);
  const [completeScenario, setCompleteScenario] = useState<SimulationScenarioDTO | null>(null);
  const [convertScenarioId, setConvertScenarioId] = useState<string | null>(null);
  const [lastToggleDelta, setLastToggleDelta] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const people = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<PersonDTO[]>("/api/people"),
  });

  const cycleKeyForApi = selectedCycleKey ?? undefined;

  const summary = useQuery({
    queryKey: ["dashboard-summary", personId, cycleKeyForApi ?? "current"],
    queryFn: () => api.get<DashboardCycleSummaryResponse>(summaryUrl(personId, cycleKeyForApi)),
  });

  const accounts = useQuery({
    queryKey: ["accounts", personId, accountsTab],
    queryFn: async () => {
      const res = await api.get<{ items: ManagedAccountDTO[] }>(
        accountsUrl(personId, accountsTab),
      );
      return res.items;
    },
  });

  useEffect(() => {
    if (summary.data?.selectedCycleKey && !selectedCycleKey) {
      setSelectedCycleKey(summary.data.selectedCycleKey);
    }
  }, [summary.data?.selectedCycleKey, selectedCycleKey]);

  useEffect(() => {
    setSelectedCycleKey(null);
  }, [personId]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
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

  const detailScenario = useMemo(() => {
    if (!detailScenarioId || !accounts.data) return null;
    const account = accounts.data.find(
      (item) =>
        item.legacySimulationScenarioId === detailScenarioId || item.id === detailScenarioId,
    );
    return account ? managedAccountToScenarioDTO(account) : null;
  }, [accounts.data, detailScenarioId]);

  const createScenario = useMutation({
    mutationFn: (body: CreateSimulationScenarioInput) =>
      api.post<SimulationScenarioDTO>("/api/simulations", body),
    onSuccess: (created) => {
      invalidateAll();
      setEditorOpen(false);
      setEditingScenario(null);
      setAccountsTab("active");
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
      setAccountsTab("history");
      setShowManageTabs(true);
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
      setAccountsTab("history");
      setShowManageTabs(true);
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

  const detectRecurringBills = useMutation({
    mutationFn: () => api.post<DetectRecurringBillsResponse>(detectRecurringBillsUrl(personId)),
    onSuccess: invalidateAll,
  });

  const updateRecurringBill = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateRecurringBillInput }) =>
      api.patch<RecurringBillDTO>(`/api/recurring-bills/${id}`, body),
    onSuccess: invalidateAll,
  });

  const deleteRecurringBill = useMutation({
    mutationFn: (id: string) => api.delete(`/api/recurring-bills/${id}`),
    onSuccess: invalidateAll,
  });

  const cancelCommitment = useMutation({
    mutationFn: (id: string) => api.patch(`/api/commitments/${id}`, { status: "cancelled" }),
    onSuccess: invalidateAll,
  });

  const handleConvertScenario = useCallback(
    (scenario: SimulationScenarioDTO) => {
      setConvertScenarioId(scenario.id);
      convertToGoal.mutate(scenario.id);
    },
    [convertToGoal],
  );

  const handleToggleActive = useCallback(
    (scenario: SimulationScenarioDTO, cycleImpact?: number) => {
      const nextStatus = scenario.status === "active" ? "draft" : "active";
      if (cycleImpact && nextStatus === "draft") {
        setLastToggleDelta(cycleImpact);
      } else {
        setLastToggleDelta(null);
      }
      updateScenario.mutate({ id: scenario.id, body: { status: nextStatus } });
    },
    [updateScenario],
  );

  const handleToggleBill = useCallback(
    (account: ManagedAccountDTO, cycleImpact: number) => {
      const activating = account.status !== "active";
      setLastToggleDelta(activating ? -cycleImpact : cycleImpact);
      updateRecurringBill.mutate({
        id: managedAccountLegacyId(account),
        body: { status: account.status === "active" ? "inactive" : "active" },
      });
    },
    [updateRecurringBill],
  );

  const effectivePersonId = personId === "all" ? undefined : personId;
  const data = summary.data;
  const activeCycleKey = data?.selectedCycleKey ?? selectedCycleKey;
  const selectedCycle = data?.navigableCycles.find((c) => c.cycleKey === activeCycleKey);
  const displayMetrics = data?.household
    ? effectivePersonId
      ? data.household.persons.find((p) => p.personId === effectivePersonId) ?? data.household
      : data.household
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="h-6 w-6 text-positive" />
            <h1 className="font-display text-2xl font-bold text-foreground">Compromissos</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Ligue ou desligue compromissos e veja o impacto no ciclo
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
                setLastToggleDelta(null);
              }}
            />
          )}
          {data && data.navigableCycles.length > 0 && activeCycleKey && (
            <CycleNavigator
              cycles={data.navigableCycles}
              selectedCycleKey={activeCycleKey}
              onSelectCycle={setSelectedCycleKey}
            />
          )}
          <AssistantSpotlightButton
            label="Analisar com IA"
            message="Quero simular uma compra — quanto posso gastar sem comprometer minhas metas?"
            contextKey="simulator:page"
            title="Compromissos"
            personId={effectivePersonId}
          />
        </div>
      </div>

      {summary.isLoading && (
        <div className="rounded-2xl border border-app-border/60 bg-app-surface p-8 text-center text-sm text-muted-foreground">
          Carregando sua situação financeira...
        </div>
      )}

      {summary.isError && (
        <div className="rounded-2xl border border-negative/20 bg-negative/10 p-4 text-sm text-negative">
          Não foi possível carregar os dados. Tente novamente.
        </div>
      )}

      {data?.household && displayMetrics && (
        <FinanceSummaryCard
          title="Impacto no ciclo"
          metrics={{
            bankBalance: displayMetrics.bankBalance,
            closingBalance: displayMetrics.closingBalance,
            realizedNet: displayMetrics.realizedNet,
            isFuture: data.household.isFuture,
            isComplete: data.household.isComplete,
            pendingBillPayments: displayMetrics.pendingBillPayments,
          }}
          currencyCode={data.currencyCode}
          closingDelta={lastToggleDelta ?? undefined}
        />
      )}

      {data && (
        <AccountsSection
          accounts={accounts.data ?? []}
          people={people.data ?? []}
          currencyCode={data.currencyCode}
          personId={effectivePersonId}
          tab={accountsTab}
          highlightId={highlightId}
          loading={accounts.isLoading}
          detecting={detectRecurringBills.isPending}
          savingBill={updateRecurringBill.isPending}
          periodMode="payday"
          currentCycleFrom={selectedCycle?.from}
          currentCycleTo={selectedCycle?.to}
          showManageTabs={showManageTabs}
          onShowManageTabsChange={setShowManageTabs}
          onTabChange={setAccountsTab}
          onDetect={() => detectRecurringBills.mutate()}
          onNewSimulation={() => {
            setEditingScenario(null);
            setEditorOpen(true);
          }}
          onUpdateBill={(id, body) => updateRecurringBill.mutate({ id, body })}
          onDeleteBill={(id) => deleteRecurringBill.mutate(id)}
          onCancelCommitment={(id) => cancelCommitment.mutate(id)}
          onRunScenario={(id) => runScenario.mutate(id)}
          onEditScenario={(scenario) => {
            setEditingScenario(scenario);
            setEditorOpen(true);
          }}
          onToggleScenarioActive={handleToggleActive}
          onToggleBill={handleToggleBill}
          onCompleteScenario={setCompleteScenario}
          onConvertScenario={handleConvertScenario}
          onArchiveScenario={(id) => archiveScenario.mutate(id)}
          onDeleteScenario={(id) => deleteScenario.mutate(id)}
        />
      )}

      {runScenario.isError && (
        <div className="rounded-2xl border border-negative/20 bg-negative/10 p-4 text-sm text-negative">
          Erro ao analisar cenário. Tente novamente.
        </div>
      )}

      {analysisResult && detailScenario && data?.household && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            Análise: <span className="text-brand">{detailScenario.name}</span>
          </p>
          <SimulationResults
            result={analysisResult}
            baseline={{
              currencyCode: data.currencyCode,
              periodMode: "payday",
              periodLabel: selectedCycle?.label ?? "",
              surplusLabel: "Média",
              averageSurplus: 0,
              averageIncome: 0,
              averageExpenses: 0,
              bankBalance: displayMetrics?.bankBalance ?? 0,
              monthlyContribution: 0,
              currentSurplus: displayMetrics?.closingBalance ?? 0,
              includesProjectedSalary: true,
              creditAccounts: [],
              hasAccounts: data.accounts.length > 0,
            }}
            onConvertToGoal={() => handleConvertScenario(detailScenario)}
            personId={effectivePersonId}
          />
        </div>
      )}

      {data && editorOpen && (
        <ScenarioEditorModal
          open={editorOpen}
          baseline={{
            currencyCode: data.currencyCode,
            periodMode: "payday",
            periodLabel: selectedCycle?.label ?? "",
            surplusLabel: "Média",
            averageSurplus: 0,
            averageIncome: 0,
            averageExpenses: 0,
            bankBalance: displayMetrics?.bankBalance ?? 0,
            monthlyContribution: 0,
            currentSurplus: displayMetrics?.closingBalance ?? 0,
            includesProjectedSalary: true,
            creditAccounts: [],
            hasAccounts: data.accounts.length > 0,
          }}
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
        currencyCode={data?.currencyCode ?? "BRL"}
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
