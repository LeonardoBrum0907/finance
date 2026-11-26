import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BillCyclesResult,
  DashboardCycleSummaryResponse,
  DashboardSummary,
  PersonDTO,
  UserSettingsDTO,
} from "@finance/shared";
import {
  effectiveDashboardWidgets,
  isPaydayDayConfigured,
  needsDashboardDetails,
  parsePaydayCycleAnchor,
  resolveDashboardWidgets,
} from "@finance/shared";
import { api } from "../lib/api";
import { useAppModules } from "../lib/modules";
import { BillCycleCard } from "../components/commitments/BillCycleCard";
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

function detailsUrl(personId: PersonFilter, cycleKey: string, billKey: string | null): string {
  const params = new URLSearchParams({ months: "1", periodMode: "payday", cycleKey });
  if (personId !== "all") params.set("personId", personId);
  // Com fatura escolhida, o Painel do Período segue o mesmo ciclo da fatura da lista.
  if (billKey) params.set("interval", `bill:${billKey}`);
  return `/api/dashboard?${params}`;
}

export function DashboardPage() {
  const { setDashboardPersonFilter } = useAssistant();
  const queryClient = useQueryClient();
  const [personId, setPersonId] = useState<PersonFilter>("all");
  const [selectedCycleKey, setSelectedCycleKey] = useState<string | null>(null);
  const [selectedBillKey, setSelectedBillKey] = useState<string | null>(null);
  const { modules } = useAppModules();

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

  const billPaidMutation = useMutation({
    mutationFn: ({ cycleKey, paid }: { cycleKey: string; paid: boolean }) => {
      const qs = personId === "all" ? "" : `?personId=${personId}`;
      const url = `/api/bill-cycles/${cycleKey}/paid${qs}`;
      return paid ? api.post(url, {}) : api.delete(url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bill-cycles"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      // Pagar a fatura muda o fim do ciclo, e o Painel do Período segue esse ciclo.
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const billCycles = useQuery({
    queryKey: ["bill-cycles", personId],
    queryFn: () =>
      api.get<BillCyclesResult | { currentCycleKey: null; cycles: [] }>(
        personId === "all" ? "/api/bill-cycles" : `/api/bill-cycles?personId=${personId}`,
      ),
  });

  const data = summary.data;
  const dashboardWidgets = effectiveDashboardWidgets(
    resolveDashboardWidgets(settings.data?.dashboardWidgets),
    modules,
  );

  useEffect(() => {
    if (data?.selectedCycleKey && !selectedCycleKey) {
      setSelectedCycleKey(data.selectedCycleKey);
    }
  }, [data?.selectedCycleKey, selectedCycleKey]);

  useEffect(() => {
    setSelectedCycleKey(null);
    setSelectedBillKey(null);
  }, [personId]);

  // O painel segue o ciclo da fatura: cada fatura mostra o ciclo de salário em que ela vence.
  const billResult = billCycles.data?.currentCycleKey ? (billCycles.data as BillCyclesResult) : null;
  const navigableCycles = data?.navigableCycles;
  const paydayKeyForDue = useCallback(
    (dueDate: string) =>
      navigableCycles?.find((c) => c.from <= dueDate && dueDate <= c.to)?.cycleKey ?? null,
    [navigableCycles],
  );
  const painelBillCycles = useMemo(
    () => (billResult ? billResult.cycles.filter((c) => paydayKeyForDue(c.dueDate)) : []),
    [billResult, paydayKeyForDue],
  );
  // Abre no ciclo em andamento: o da primeira fatura ainda não paga.
  const openBillKey = billResult ? (billResult.openCycleKey ?? billResult.currentCycleKey) : null;
  const billKey = selectedBillKey ?? openBillKey;
  const selectedBill = painelBillCycles.find((c) => c.cycleKey === billKey);

  useEffect(() => {
    if (!selectedBill) return;
    const key = paydayKeyForDue(selectedBill.dueDate);
    if (key && key !== selectedCycleKey) setSelectedCycleKey(key);
  }, [selectedBill, paydayKeyForDue, selectedCycleKey]);

  useEffect(() => {
    setDashboardPersonFilter(personId);
  }, [personId, setDashboardPersonFilter]);

  const effectivePersonId = personId === "all" ? undefined : personId;
  const activeCycleKey = data?.selectedCycleKey ?? selectedCycleKey;

  const detailsBillKey = selectedBill ? billKey : null;
  const details = useQuery({
    queryKey: ["dashboard", personId, activeCycleKey, detailsBillKey],
    queryFn: () => api.get<DashboardSummary>(detailsUrl(personId, activeCycleKey!, detailsBillKey)),
    enabled: Boolean(data?.household && activeCycleKey) && needsDashboardDetails(dashboardWidgets),
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Início
          </h1>
        </div>
        {data && data.accounts.length > 0 && (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
            <PersonSelector
              value={personId}
              people={people.data ?? []}
              onChange={setPersonId}
            />
          </div>
        )}
      </div>

      {!paydayConfigured && settings.isSuccess && people.isSuccess && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {personId !== "all" ? (
            <>
              Configure o dia de recebimento desta pessoa em{" "}
              <a href="/configuracoes" className="font-medium underline">
                Ajustes
              </a>{" "}
              para ver o painel por ciclo.
            </>
          ) : people.data && people.data.length > 1 ? (
            <>
              Na visão de todas as pessoas, o ciclo só funciona quando todos têm o mesmo dia de
              pagamento. Selecione uma pessoa ou ajuste em{" "}
              <a href="/configuracoes" className="font-medium underline">
                Ajustes
              </a>
              .
            </>
          ) : (
            <>
              Configure o dia de recebimento em{" "}
              <a href="/configuracoes" className="font-medium underline">
                Ajustes
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
            Cadastre a família e conecte os bancos em <strong>Ajustes</strong>.
          </p>
        </div>
      ) : !data.household ? (
        <div className="rounded-xl border border-dashed border-app-border bg-app-surface p-10 text-center">
          <p className="text-sm font-medium text-foreground/90">
            Configure o ciclo de pagamento para ver o resumo financeiro.
          </p>
        </div>
      ) : (
        <>
        {billResult && painelBillCycles.length > 0 && (
          <BillCycleCard
            cycles={painelBillCycles}
            currentCycleKey={openBillKey ?? billResult.currentCycleKey}
            currencyCode={data.currencyCode}
            selectedKey={selectedBillKey}
            onSelect={setSelectedBillKey}
            onMarkPaid={(cycleKey) => billPaidMutation.mutate({ cycleKey, paid: true })}
            onUnmarkPaid={(cycleKey) => billPaidMutation.mutate({ cycleKey, paid: false })}
            markingPaid={billPaidMutation.isPending}
          />
        )}
        <DashboardWidgetList
          widgets={dashboardWidgets}
          household={data.household}
          currencyCode={data.currencyCode}
          personFilter={effectivePersonId}
          personId={personId}
          activeCycleKey={activeCycleKey}
          billCycleKey={selectedBill ? billKey : null}
          accounts={data.accounts}
          details={details.data}
          detailsFailed={details.isError}
        />
        </>
      )}
    </div>
  );
}
