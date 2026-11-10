import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSimulationScenarioInput,
  DashboardCycleSummaryResponse,
  PersonDTO,
  SimulatedPurchaseInput,
  UserSettingsDTO,
} from "@finance/shared";
import {
  hasAnyEnabledDashboardWidget,
  isCreditAccount,
  isPaydayDayConfigured,
  parsePaydayCycleAnchor,
  resolveDashboardWidgets,
  simulatedPurchaseInputToPayload,
} from "@finance/shared";
import { api } from "../lib/api";
import { CycleNavigator } from "../components/dashboard/CycleNavigator";
import { DashboardSkeleton } from "../components/dashboard/DashboardSkeleton";
import { DashboardWidgetList } from "../components/dashboard/DashboardWidgetList";
import { PersonSelector, type PersonFilter } from "../components/dashboard/PersonSelector";
import { useAssistant } from "../lib/assistantContext";

function summaryUrl(personId: PersonFilter, cycleKey?: string): string {
  const params = new URLSearchParams();
  if (personId !== "all") params.set("personId", personId);
  if (cycleKey) params.set("cycleKey", cycleKey);
  const qs = params.toString();
  return qs ? `/api/dashboard/summary?${qs}` : "/api/dashboard/summary";
}

export function DashboardPage() {
  const { setDashboardPersonFilter } = useAssistant();
  const queryClient = useQueryClient();
  const [personId, setPersonId] = useState<PersonFilter>("all");
  const [selectedCycleKey, setSelectedCycleKey] = useState<string | null>(null);
  const [simulateModalOpen, setSimulateModalOpen] = useState(false);
  const transactionsRef = useRef<HTMLElement>(null);

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<UserSettingsDTO>("/api/settings"),
  });

  const people = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<PersonDTO[]>("/api/people"),
  });

  const paydayConfigured = useMemo(() => {
    const list = people.data ?? [];
    if (personId !== "all") {
      const person = list.find((p) => p.id === personId);
      return (
        isPaydayDayConfigured(person?.paydayDay) ||
        isPaydayDayConfigured(settings.data?.paydayDay)
      );
    }
    const configured = list.filter((p) => isPaydayDayConfigured(p.paydayDay));
    if (configured.length === 0) {
      return isPaydayDayConfigured(settings.data?.paydayDay);
    }
    const uniqueDays = new Set(configured.map((p) => p.paydayDay));
    const uniqueAnchors = new Set(
      configured.map((p) => parsePaydayCycleAnchor(p.paydayCycleAnchor)),
    );
    return uniqueDays.size === 1 && uniqueAnchors.size === 1;
  }, [people.data, personId, settings.data?.paydayDay]);

  const cycleKeyForApi = selectedCycleKey ?? undefined;

  const summary = useQuery({
    queryKey: ["dashboard-summary", personId, cycleKeyForApi ?? "current"],
    queryFn: () => api.get<DashboardCycleSummaryResponse>(summaryUrl(personId, cycleKeyForApi)),
  });

  const saveSimulations = useMutation({
    mutationFn: async (inputs: SimulatedPurchaseInput[]) => {
      const effectivePersonId = personId === "all" ? undefined : personId;
      for (const input of inputs) {
        const payload = simulatedPurchaseInputToPayload(input, effectivePersonId);
        const body: CreateSimulationScenarioInput = {
          name: input.title,
          type: payload.type,
          status: "active",
          payload,
          personId: effectivePersonId,
        };
        await api.post("/api/simulations", body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["simulations-impact"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const data = summary.data;
  const dashboardWidgets = resolveDashboardWidgets(settings.data?.dashboardWidgets);
  const anyWidgetEnabled = hasAnyEnabledDashboardWidget(dashboardWidgets);

  useEffect(() => {
    if (data?.selectedCycleKey && !selectedCycleKey) {
      setSelectedCycleKey(data.selectedCycleKey);
    }
  }, [data?.selectedCycleKey, selectedCycleKey]);

  useEffect(() => {
    setSelectedCycleKey(null);
  }, [personId]);

  useEffect(() => {
    setDashboardPersonFilter(personId);
  }, [personId, setDashboardPersonFilter]);

  const effectivePersonId = personId === "all" ? undefined : personId;
  const activeCycleKey = data?.selectedCycleKey ?? selectedCycleKey;
  const selectedCycle = data?.navigableCycles.find((c) => c.cycleKey === activeCycleKey);
  const simulationEnabled = Boolean(selectedCycle?.isCurrent);

  const creditAccountsForSimulation = useMemo(() => {
    if (!data) return [];
    return data.accounts
      .filter((acc) => isCreditAccount(acc.type))
      .map((acc) => ({
        id: acc.id,
        name: acc.name,
        balanceCloseDate: acc.balanceCloseDate,
        balanceDueDate: acc.balanceDueDate,
        openBillAmount: acc.openBillAmount ?? acc.nextBillAmount,
        closedBillAmount: acc.closedBillAmount,
        creditLimit: acc.creditLimit,
        availableCreditLimit: acc.availableCreditLimit,
      }));
  }, [data]);

  const handleSaveSimulations = useCallback(
    async (inputs: SimulatedPurchaseInput[]) => {
      await saveSimulations.mutateAsync(inputs);
    },
    [saveSimulations],
  );

  const periodSummaryForTransactions = data?.household
    ? {
        months: 1 as const,
        income: data.household.realizedNet > 0 ? data.household.realizedNet : 0,
        expenses: data.household.realizedNet < 0 ? Math.abs(data.household.realizedNet) : 0,
        net: data.household.realizedNet,
        availableNet: data.household.closingBalance,
        from: data.household.from,
        to: data.household.to,
        label: selectedCycle?.label,
        periodMode: "payday" as const,
      }
    : undefined;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Painel
          </h1>
          <p className="mt-1 text-sm text-muted-foreground-dark">
            Patrimônio, o que ainda é seu neste período e quanto ficou guardado.
          </p>
        </div>
        {data && data.accounts.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <PersonSelector
              value={personId}
              people={people.data ?? []}
              onChange={setPersonId}
            />
            {data.navigableCycles.length > 0 && activeCycleKey && (
              <CycleNavigator
                cycles={data.navigableCycles}
                selectedCycleKey={activeCycleKey}
                onSelectCycle={setSelectedCycleKey}
              />
            )}
          </div>
        )}
      </div>

      {!paydayConfigured && settings.isSuccess && people.isSuccess && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {personId !== "all" ? (
            <>
              Configure o dia de recebimento desta pessoa em{" "}
              <a href="/configuracoes" className="font-medium underline">
                Configurações
              </a>{" "}
              para ver o painel por ciclo.
            </>
          ) : people.data && people.data.length > 1 ? (
            <>
              Na visão de todas as pessoas, o ciclo só funciona quando todos têm o mesmo dia de
              pagamento. Selecione uma pessoa ou ajuste em{" "}
              <a href="/configuracoes" className="font-medium underline">
                Configurações
              </a>
              .
            </>
          ) : (
            <>
              Configure o dia de recebimento em{" "}
              <a href="/configuracoes" className="font-medium underline">
                Configurações
              </a>{" "}
              para ver o painel por ciclo.
            </>
          )}
        </div>
      )}

      {summary.isLoading || settings.isLoading ? (
        <DashboardSkeleton />
      ) : summary.isError ? (
        <div className="rounded-xl border border-danger-border bg-danger-muted p-6 text-sm text-danger">
          Não foi possível carregar o painel. Tente novamente em instantes.
        </div>
      ) : !data || data.accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-app-border bg-app-surface p-10 text-center">
          <p className="text-sm font-medium text-foreground/90">
            Nenhuma conta conectada ainda
          </p>
          <p className="mt-1 text-sm text-muted-foreground-dark">
            Cadastre em <strong>Pessoas</strong> e conecte em <strong>Contas</strong>.
          </p>
        </div>
      ) : !data.household ? (
        <div className="rounded-xl border border-dashed border-app-border bg-app-surface p-10 text-center">
          <p className="text-sm font-medium text-foreground/90">
            Configure o ciclo de pagamento para ver o resumo financeiro.
          </p>
        </div>
      ) : (
        <DashboardWidgetList
          widgets={dashboardWidgets}
          anyWidgetEnabled={anyWidgetEnabled}
          household={data.household}
          currencyCode={data.currencyCode}
          householdPaydayAligned={data.householdPaydayAligned}
          personFilter={effectivePersonId}
          personId={personId}
          activeCycleKey={activeCycleKey}
          periodSummary={periodSummaryForTransactions}
          transactionsRef={transactionsRef}
          simulationEnabled={simulationEnabled}
          simulateModalOpen={simulateModalOpen}
          onSimulateModalOpenChange={setSimulateModalOpen}
          onSaveSimulations={handleSaveSimulations}
          savingSimulation={saveSimulations.isPending}
          creditAccounts={creditAccountsForSimulation}
          selectedCycle={selectedCycle}
        />
      )}
    </div>
  );
}
