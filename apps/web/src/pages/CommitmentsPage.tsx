import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BillCyclesResult,
  CreateSimulationScenarioInput,
  ManagedAccountDTO,
  PersonDTO,
  SimulationScenarioDTO,
  UpdateRecurringBillInput,
} from "@finance/shared";
import { managedAccountLegacyId } from "@finance/shared";
import { api } from "../lib/api";
import { useConfirm } from "../lib/confirm";
import { BillCycleCard, billCycleLabel } from "../components/commitments/BillCycleCard";
import { PersonSelector, type PersonFilter } from "../components/dashboard/PersonSelector";
import { AccountsSection } from "../components/commitments/AccountsSection";
import {
  PlannedPurchaseModal,
  type PlannedCard,
  type PlannedPurchaseInput,
} from "../components/commitments/PlannedPurchaseModal";

const OPEN_STATUSES = "active,draft,inactive";
const CLOSED_STATUSES = "completed,archived,converted,cancelled";

function accountsUrl(personId: PersonFilter, status: string): string {
  const params = new URLSearchParams({ status });
  if (personId !== "all") params.set("personId", personId);
  return `/api/accounts?${params}`;
}

function withPerson(path: string, personId: PersonFilter): string {
  return personId === "all" ? path : `${path}?personId=${personId}`;
}

export function CommitmentsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [personId, setPersonId] = useState<PersonFilter>("all");
  const [selectedBillKey, setSelectedBillKey] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SimulationScenarioDTO | null>(null);
  // Quanto o "ainda posso gastar" mudou com a última ação, para mostrar o impacto.
  const [baseline, setBaseline] = useState<{ cycleKey: string; leftover: number } | null>(null);
  const [lastDelta, setLastDelta] = useState<number | null>(null);

  const people = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<PersonDTO[]>("/api/people"),
  });

  const billCycles = useQuery({
    queryKey: ["bill-cycles", personId],
    queryFn: () =>
      api.get<BillCyclesResult | { currentCycleKey: null; cycles: [] }>(
        withPerson("/api/bill-cycles", personId),
      ),
  });

  const openAccounts = useQuery({
    queryKey: ["accounts", personId, "open"],
    queryFn: async () =>
      (await api.get<{ items: ManagedAccountDTO[] }>(accountsUrl(personId, OPEN_STATUSES))).items,
  });

  const closedAccounts = useQuery({
    queryKey: ["accounts", personId, "closed"],
    queryFn: async () =>
      (await api.get<{ items: ManagedAccountDTO[] }>(accountsUrl(personId, CLOSED_STATUSES))).items,
    enabled: showClosed,
  });

  useEffect(() => {
    setSelectedBillKey(null);
    setBaseline(null);
    setLastDelta(null);
  }, [personId]);

  const billResult = billCycles.data?.currentCycleKey ? (billCycles.data as BillCyclesResult) : null;
  const billKey = selectedBillKey ?? billResult?.openCycleKey ?? billResult?.currentCycleKey ?? null;
  const billSelection =
    billResult && billKey
      ? { cycleKey: billKey, label: billCycleLabel(billKey), result: billResult }
      : undefined;

  const leftoverOf = useCallback(
    (key: string | null) =>
      billResult?.cycles.find((cycle) => cycle.cycleKey === key)?.money?.leftover ?? null,
    [billResult],
  );

  // Depois de uma mudança, compara o "ainda posso gastar" com o de antes.
  useEffect(() => {
    if (!baseline || billCycles.isFetching) return;
    const now = leftoverOf(baseline.cycleKey);
    if (now === null) return;
    setLastDelta(Math.round((now - baseline.leftover) * 100) / 100);
    setBaseline(null);
  }, [baseline, billCycles.isFetching, leftoverOf]);

  const cards = useMemo<PlannedCard[]>(() => {
    if (!billResult) return [];
    const known = new Set(billResult.cards.map((card) => card.accountId));
    const byId = new Map<string, string>();
    for (const cycle of billResult.cycles) {
      for (const bill of cycle.bills) {
        if (known.has(bill.accountId)) byId.set(bill.accountId, bill.accountName);
      }
    }
    return [...byId].map(([id, name]) => ({ id, name }));
  }, [billResult]);

  /** Guarda o valor atual antes de mudar algo, e recarrega o que depende dele. */
  const beforeChange = () => {
    const leftover = leftoverOf(billKey);
    setLastDelta(null);
    setBaseline(billKey && leftover !== null ? { cycleKey: billKey, leftover } : null);
  };
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["bill-cycles"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  };
  const onError = () => setBaseline(null);

  const effectivePersonId = personId === "all" ? undefined : personId;

  const savePlanned = useMutation({
    mutationFn: (input: PlannedPurchaseInput) => {
      if (editing) {
        return api.patch(`/api/simulations/${editing.id}`, { name: input.name, payload: input.payload });
      }
      const body: CreateSimulationScenarioInput = {
        name: input.name,
        type: input.type,
        status: "active",
        payload: input.payload,
        personId: effectivePersonId,
      };
      return api.post("/api/simulations", body);
    },
    onMutate: beforeChange,
    onSuccess: () => {
      setEditorOpen(false);
      setEditing(null);
      refresh();
    },
    onError,
  });

  const togglePlanned = useMutation({
    mutationFn: (scenario: SimulationScenarioDTO) =>
      api.patch(`/api/simulations/${scenario.id}`, {
        status: scenario.status === "active" ? "draft" : "active",
      }),
    onMutate: beforeChange,
    onSuccess: refresh,
    onError,
  });

  const boughtPlanned = useMutation({
    mutationFn: (id: string) => api.post(`/api/simulations/${id}/complete`, {}),
    onMutate: beforeChange,
    onSuccess: refresh,
    onError,
  });

  const deletePlanned = useMutation({
    mutationFn: (id: string) => api.delete(`/api/simulations/${id}`),
    onMutate: beforeChange,
    onSuccess: refresh,
    onError,
  });

  const detectBills = useMutation({
    mutationFn: () => api.post(withPerson("/api/recurring-bills/detect", personId)),
    onMutate: beforeChange,
    onSuccess: refresh,
    onError,
  });

  const updateBill = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateRecurringBillInput }) =>
      api.patch(`/api/recurring-bills/${id}`, body),
    onMutate: beforeChange,
    onSuccess: refresh,
    onError,
  });

  const deleteBill = useMutation({
    mutationFn: (id: string) => api.delete(`/api/recurring-bills/${id}`),
    onMutate: beforeChange,
    onSuccess: refresh,
    onError,
  });

  const cancelCommitment = useMutation({
    mutationFn: (id: string) => api.patch(`/api/commitments/${id}`, { status: "cancelled" }),
    onMutate: beforeChange,
    onSuccess: refresh,
    onError,
  });

  async function handleBought(scenario: SimulationScenarioDTO) {
    const ok = await confirm({
      title: "Já comprei",
      message: `"${scenario.name}" sai do Planejado. A compra de verdade entra pela sincronização do banco.`,
      confirmLabel: "Confirmar",
    });
    if (ok) boughtPlanned.mutate(scenario.id);
  }

  async function handleDeletePlanned(scenario: SimulationScenarioDTO) {
    const ok = await confirm({
      title: "Excluir compra planejada",
      message: `Excluir "${scenario.name}"?`,
      confirmLabel: "Excluir",
      variant: "danger",
    });
    if (ok) deletePlanned.mutate(scenario.id);
  }

  const busyPlannedId = togglePlanned.isPending ? (togglePlanned.variables?.id ?? null) : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Compromissos
        </h1>
        {people.data && people.data.length > 1 && (
          <PersonSelector value={personId} people={people.data} onChange={setPersonId} />
        )}
      </div>

      {billCycles.isError && (
        <div className="rounded-2xl border border-negative/20 bg-negative/10 p-4 text-sm text-negative">
          Não foi possível carregar o ciclo da fatura. Tente novamente.
        </div>
      )}

      {billResult && billResult.cycles.length > 0 && (
        <BillCycleCard
          cycles={billResult.cycles}
          currentCycleKey={billResult.openCycleKey ?? billResult.currentCycleKey}
          currencyCode="BRL"
          closingDelta={lastDelta}
          selectedKey={selectedBillKey}
          onSelect={(key) => {
            setSelectedBillKey(key);
            setLastDelta(null);
          }}
        />
      )}

      <AccountsSection
        accounts={openAccounts.data ?? []}
        closedAccounts={closedAccounts.data ?? []}
        showClosed={showClosed}
        onShowClosedChange={setShowClosed}
        people={people.data ?? []}
        cards={cards}
        currencyCode="BRL"
        personId={effectivePersonId}
        loading={openAccounts.isLoading}
        detecting={detectBills.isPending}
        savingBill={updateBill.isPending}
        busyPlannedId={busyPlannedId}
        billCycle={billSelection}
        onDetect={() => detectBills.mutate()}
        onPlan={() => {
          setEditing(null);
          setEditorOpen(true);
        }}
        onUpdateBill={(id, body) => updateBill.mutate({ id, body })}
        onDeleteBill={(id) => deleteBill.mutate(id)}
        onCancelCommitment={(id) => cancelCommitment.mutate(id)}
        onToggleBill={(account) =>
          updateBill.mutate({
            id: managedAccountLegacyId(account),
            body: { status: account.status === "active" ? "inactive" : "active" },
          })
        }
        onTogglePlanned={(scenario) => togglePlanned.mutate(scenario)}
        onEditPlanned={(scenario) => {
          setEditing(scenario);
          setEditorOpen(true);
        }}
        onBoughtPlanned={(scenario) => void handleBought(scenario)}
        onDeletePlanned={(scenario) => void handleDeletePlanned(scenario)}
      />

      <PlannedPurchaseModal
        open={editorOpen}
        cards={cards}
        editing={editing}
        saving={savePlanned.isPending}
        error={savePlanned.isError ? (savePlanned.error as Error).message : null}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSave={(input) => savePlanned.mutate(input)}
      />
    </div>
  );
}
