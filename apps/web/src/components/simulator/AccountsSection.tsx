import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Pencil,
  Plus,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import type {
  ManagedAccountDTO,
  PersonDTO,
  RecurringBillDTO,
  SimulationScenarioDTO,
  UpdateRecurringBillInput,
} from "@finance/shared";
import {
  managedAccountLegacyId,
  managedAccountToCommitmentDTO,
  managedAccountToRecurringBillDTO,
  managedAccountToScenarioDTO,
  recurringBillStatusLabel,
  todayDateKeyInTimeZone,
} from "@finance/shared";
import { formatCurrency } from "../../lib/format";
import { useConfirm } from "../../lib/confirm";
import { cardClass } from "../dashboard/motion";
import { SIMULATOR_TONE } from "./tokens";
import { RecurringBillEditModal } from "./RecurringBillEditModal";
import { ScenarioCard } from "./ScenarioCard";
import { AccountKindBadge } from "./AccountKindBadge";
import {
  type AccountsTab,
  type AccountTypeFilter,
  accountItemAmount,
  accountItemIsMonthly,
  accountItemSubtitle,
  accountPendingInCycle,
  accountsTabLabel,
  commitmentNextPendingEntry,
  countActiveAccountsByKind,
  filterAccountsByPerson,
  matchesAccountTypeFilter,
  sumActiveManagedAccountsMonthlyTotal,
} from "./accounts";

const TYPE_FILTERS: { key: AccountTypeFilter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "fixed_recurring", label: "Conta fixa" },
  { key: "simulation", label: "Simulação" },
  { key: "future_account", label: "Conta futura" },
  { key: "installment_plan", label: "Parcelamento manual" },
];

interface Props {
  accounts: ManagedAccountDTO[];
  people: PersonDTO[];
  currencyCode: string;
  personId?: string;
  tab: AccountsTab;
  highlightId?: string | null;
  loading?: boolean;
  detecting?: boolean;
  savingBill?: boolean;
  periodMode?: "payday" | "calendar";
  currentCycleFrom?: string;
  currentCycleTo?: string;
  onTabChange: (tab: AccountsTab) => void;
  onDetect: () => void;
  onNewSimulation: () => void;
  onUpdateBill: (id: string, body: UpdateRecurringBillInput) => void;
  onDeleteBill: (id: string) => void;
  onCancelCommitment: (id: string) => void;
  onRunScenario: (id: string) => void;
  onEditScenario: (scenario: SimulationScenarioDTO) => void;
  onToggleScenarioActive: (scenario: SimulationScenarioDTO, cycleImpact?: number) => void;
  onToggleBill?: (account: ManagedAccountDTO, cycleImpact: number) => void;
  showManageTabs?: boolean;
  onShowManageTabsChange?: (value: boolean) => void;
  onCompleteScenario: (scenario: SimulationScenarioDTO) => void;
  onConvertScenario: (scenario: SimulationScenarioDTO) => void;
  onArchiveScenario: (id: string) => void;
  onDeleteScenario: (id: string) => void;
}

export function AccountsSection({
  accounts,
  people,
  currencyCode,
  personId,
  tab,
  highlightId,
  loading,
  detecting,
  savingBill,
  periodMode = "calendar",
  currentCycleFrom,
  currentCycleTo,
  onTabChange,
  onDetect,
  onNewSimulation,
  onUpdateBill,
  onDeleteBill,
  onCancelCommitment,
  onRunScenario,
  onEditScenario,
  onToggleScenarioActive,
  onToggleBill,
  showManageTabs = false,
  onShowManageTabsChange,
  onCompleteScenario,
  onConvertScenario,
  onArchiveScenario,
  onDeleteScenario,
}: Props) {
  const confirm = useConfirm();
  const [editingBill, setEditingBill] = useState<RecurringBillDTO | null>(null);
  const [typeFilter, setTypeFilter] = useState<AccountTypeFilter>("all");

  useEffect(() => {
    setTypeFilter("all");
  }, [tab]);

  const scopedAccounts = useMemo(
    () => filterAccountsByPerson(accounts, personId),
    [accounts, personId],
  );

  const filteredItems = useMemo(
    () => scopedAccounts.filter((account) => matchesAccountTypeFilter(account, typeFilter)),
    [scopedAccounts, typeFilter],
  );

  const activeCounts = useMemo(
    () => countActiveAccountsByKind(accounts, personId),
    [accounts, personId],
  );

  const activeMonthlyTotal = useMemo(
    () =>
      sumActiveManagedAccountsMonthlyTotal(
        filterAccountsByPerson(
          accounts.filter((account) => account.status === "active"),
          personId,
        ),
      ),
    [accounts, personId],
  );

  const summaryTone = SIMULATOR_TONE.brand;

  async function handleDeleteBill(account: ManagedAccountDTO) {
    const ok = await confirm({
      title: "Excluir conta fixa",
      message: `Excluir "${account.title}"? Ela não será detectada novamente automaticamente.`,
      confirmLabel: "Excluir",
      variant: "danger",
    });
    if (ok) onDeleteBill(managedAccountLegacyId(account));
  }

  const emptyMessage =
    tab === "active"
      ? "Nenhuma conta ativa"
      : tab === "draft"
        ? "Nenhum rascunho salvo"
        : tab === "inactive"
          ? "Nenhuma conta inativa"
          : "Nenhuma conta concluída ainda";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-brand" />
            <h2 className="font-display text-lg font-bold text-foreground">Contas</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Contas fixas, parcelamentos manuais, simulações e despesas futuras em um só lugar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDetect}
            disabled={detecting}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/5 px-4 py-2 text-xs font-bold text-brand hover:bg-brand/10 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${detecting ? "animate-spin" : ""}`} />
            {detecting ? "Atualizando..." : "Atualizar contas fixas"}
          </button>
          <button
            type="button"
            onClick={onNewSimulation}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova simulação
          </button>
        </div>
      </div>

      {!loading && tab === "active" && (
        <article className={`${cardClass} rounded-xl border px-4 py-4 ${summaryTone.box}`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p
                className={`text-[10px] font-bold tracking-wider uppercase ${summaryTone.label}`}
              >
                Contas ativas
              </p>
              <p className={`mt-1 font-display text-3xl font-bold ${summaryTone.value}`}>
                {activeCounts.fixed + activeCounts.simulation + activeCounts.installment}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeCounts.fixed} fixa(s) · {activeCounts.simulation} simulação(ões) ·{" "}
                {activeCounts.installment} parcela(s) manual(is)
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                Total mensal
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">
                {formatCurrency(activeMonthlyTotal, currencyCode)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                soma de todas as contas ativas
              </p>
            </div>
          </div>
        </article>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-xl border border-app-border bg-app-bg/50 p-1">
            <button
              type="button"
              onClick={() => onTabChange("active")}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === "active"
                  ? "bg-app-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ativas
            </button>
          </div>
          {onShowManageTabsChange && (
            <button
              type="button"
              onClick={() => onShowManageTabsChange(!showManageTabs)}
              className="cursor-pointer rounded-lg border border-app-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {showManageTabs ? "Ocultar gerenciamento" : "Gerenciar rascunhos e histórico"}
            </button>
          )}
        </div>

        {showManageTabs && (
          <div className="flex flex-wrap gap-1 rounded-xl border border-app-border bg-app-bg/50 p-1">
            {(["draft", "inactive", "history"] as AccountsTab[]).map((tabKey) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => onTabChange(tabKey)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  tab === tabKey
                    ? "bg-app-surface text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {accountsTabLabel(tabKey)}
              </button>
            ))}
          </div>
        )}

        {tab === "active" && (
          <div className="flex flex-wrap gap-1 rounded-xl border border-app-border/60 bg-app-bg/30 p-1">
            {TYPE_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setTypeFilter(filter.key)}
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-[10px] font-semibold transition ${
                  typeFilter === filter.key
                    ? "bg-app-surface text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className={`${cardClass} p-6 text-center text-sm text-muted-foreground`}>
          Carregando contas...
        </div>
      )}

      {!loading && filteredItems.length === 0 && (
        <div className="rounded-2xl border border-dashed border-app-border/80 bg-app-surface/50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tab === "active"
              ? "Atualize as contas fixas do extrato ou crie uma simulação para planejar gastos."
              : tab === "inactive"
                ? "Contas fixas canceladas ou pausadas aparecem aqui."
                : tab === "draft"
                  ? "Salve rascunhos de simulações para revisar depois."
                  : "Contas realizadas ou arquivadas ficam registradas aqui."}
          </p>
          {tab === "active" && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={onDetect}
                className="cursor-pointer rounded-xl border border-brand/30 bg-brand/5 px-4 py-2 text-xs font-semibold text-brand hover:bg-brand/10"
              >
                Atualizar contas fixas
              </button>
              <button
                type="button"
                onClick={onNewSimulation}
                className="cursor-pointer rounded-xl border border-app-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-app-bg"
              >
                Nova simulação
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && filteredItems.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredItems.map((account) => {
            if (account.kind === "fixed_recurring") {
              const cycleImpact = accountPendingInCycle(
                account,
                currentCycleFrom,
                currentCycleTo,
              );
              return (
                <RecurringBillAccountCard
                  key={account.id}
                  account={account}
                  currencyCode={currencyCode}
                  periodMode={periodMode}
                  currentCycleFrom={currentCycleFrom}
                  currentCycleTo={currentCycleTo}
                  cycleImpact={cycleImpact}
                  onToggle={() =>
                    onToggleBill
                      ? onToggleBill(account, cycleImpact)
                      : onUpdateBill(managedAccountLegacyId(account), {
                          status: account.status === "active" ? "inactive" : "active",
                        })
                  }
                  onEdit={() => {
                    const bill = managedAccountToRecurringBillDTO(account);
                    if (bill) setEditingBill(bill);
                  }}
                  onDelete={() => handleDeleteBill(account)}
                />
              );
            }

            if (account.kind === "installment_plan") {
              return (
                <CommitmentAccountCard
                  key={account.id}
                  account={account}
                  currencyCode={currencyCode}
                  onCancel={() => onCancelCommitment(managedAccountLegacyId(account))}
                />
              );
            }

            const scenario = managedAccountToScenarioDTO(account);
            if (!scenario) return null;

            const cycleImpact = accountPendingInCycle(
              account,
              currentCycleFrom,
              currentCycleTo,
            );

            return (
              <ScenarioCard
                key={account.id}
                scenario={scenario}
                currencyCode={currencyCode}
                highlighted={highlightId === managedAccountLegacyId(account)}
                kindBadge={<AccountKindBadge account={account} />}
                onRun={onRunScenario}
                onEdit={onEditScenario}
                onToggleActive={(s) => onToggleScenarioActive(s, cycleImpact)}
                onComplete={onCompleteScenario}
                onConvert={onConvertScenario}
                onArchive={onArchiveScenario}
                onDelete={onDeleteScenario}
              />
            );
          })}
        </div>
      )}

      <RecurringBillEditModal
        open={!!editingBill}
        bill={editingBill}
        people={people}
        saving={savingBill}
        onClose={() => setEditingBill(null)}
        onSave={(id, body) => {
          onUpdateBill(id, body);
          setEditingBill(null);
        }}
      />
    </section>
  );
}

function formatCurrentMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function findCurrentPeriodEntry(
  account: ManagedAccountDTO,
  periodMode: "payday" | "calendar",
  currentCycleFrom?: string,
  currentCycleTo?: string,
) {
  if (periodMode === "payday" && currentCycleFrom && currentCycleTo) {
    return account.entries.find((entry) => {
      const dueDateKey = entry.dueDate.slice(0, 10);
      return dueDateKey >= currentCycleFrom && dueDateKey <= currentCycleTo;
    });
  }

  const monthKey = todayDateKeyInTimeZone().slice(0, 7);
  return account.entries.find(
    (entry) =>
      entry.cycleKey === monthKey || entry.dueDate.slice(0, 7) === monthKey,
  );
}

function RecurringBillAccountCard({
  account,
  currencyCode,
  periodMode = "calendar",
  currentCycleFrom,
  currentCycleTo,
  cycleImpact = 0,
  onToggle,
  onEdit,
  onDelete,
}: {
  account: ManagedAccountDTO;
  currencyCode: string;
  periodMode?: "payday" | "calendar";
  currentCycleFrom?: string;
  currentCycleTo?: string;
  cycleImpact?: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const today = todayDateKeyInTimeZone();
  const monthKey = today.slice(0, 7);
  const currentEntry = findCurrentPeriodEntry(
    account,
    periodMode,
    currentCycleFrom,
    currentCycleTo,
  );
  const periodLabel =
    periodMode === "payday" && currentCycleFrom && currentCycleTo
      ? `${currentCycleFrom} – ${currentCycleTo}`
      : formatCurrentMonthLabel(monthKey);
  const periodPrefix = periodMode === "payday" ? "Neste ciclo" : "Este mês";

  let monthStatusLabel = "Sem cobrança";
  let monthStatusClass = "border-app-border bg-app-bg/60 text-muted-foreground";

  if (currentEntry?.status === "paid") {
    monthStatusLabel = "Pago";
    monthStatusClass = "border-positive/30 bg-positive/10 text-positive";
  } else if (currentEntry?.status === "skipped") {
    monthStatusLabel = "Ignorado";
    monthStatusClass = "border-app-border bg-app-bg/60 text-muted-foreground";
  } else if (currentEntry?.status === "pending") {
    const dueDateKey = currentEntry.dueDate.slice(0, 10);
    monthStatusLabel = dueDateKey < today ? "Pendente · atrasado" : "Pendente";
    monthStatusClass = "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  }

  return (
    <article className={`${cardClass} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <AccountKindBadge account={account} />
            {account.source === "auto_detected" && (
              <span className="rounded-full border border-app-border bg-app-bg/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Auto
              </span>
            )}
          </div>
          <p className="mt-2 truncate font-display text-sm font-semibold text-foreground">
            {account.title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {recurringBillStatusLabel(account.status as "active" | "inactive" | "dismissed")}
            {account.category ? ` · ${account.category}` : ""}
            {account.personName ? ` · ${account.personName}` : ""}
            {account.bankAccountName ? ` · ${account.bankAccountName}` : ""}
          </p>
          <p className="mt-2 font-display text-lg font-bold text-foreground">
            {formatCurrency(accountItemAmount(account), currencyCode)}
            {accountItemIsMonthly(account) && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">/ mês</span>
            )}
          </p>
          {account.status === "active" && cycleImpact > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Impacto no ciclo: {formatCurrency(cycleImpact, currencyCode)}
            </p>
          )}
          {account.status === "active" && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {periodPrefix} · {periodLabel}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${monthStatusClass}`}
              >
                {monthStatusLabel}
              </span>
              {currentEntry && (
                <span className="text-[10px] text-muted-foreground">
                  Venc.{" "}
                  {new Date(currentEntry.dueDate).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-app-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-app-bg"
        >
          {account.status === "active" ? (
            <>
              <ToggleLeft className="h-3.5 w-3.5" /> Desativar
            </>
          ) : (
            <>
              <ToggleRight className="h-3.5 w-3.5" /> Ativar
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-app-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-app-bg"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-negative/20 px-3 py-1.5 text-xs font-semibold text-negative hover:bg-negative/5"
        >
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </button>
      </div>
    </article>
  );
}

function CommitmentAccountCard({
  account,
  currencyCode,
  onCancel,
}: {
  account: ManagedAccountDTO;
  currencyCode: string;
  onCancel: () => void;
}) {
  const commitment = managedAccountToCommitmentDTO(account);
  if (!commitment) return null;

  const today = todayDateKeyInTimeZone();
  const nextPending = commitmentNextPendingEntry(account);

  let statusLabel = "Concluído";
  let statusClass = "border-positive/30 bg-positive/10 text-positive";

  if (account.status === "cancelled") {
    statusLabel = "Cancelado";
    statusClass = "border-app-border bg-app-bg/60 text-muted-foreground";
  } else if (account.status === "active" && nextPending) {
    const dueDateKey = nextPending.dueDate.slice(0, 10);
    statusLabel = dueDateKey < today ? "Pendente · atrasado" : "Pendente";
    statusClass = "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  } else if (account.status === "active") {
    statusLabel = "Em dia";
    statusClass = "border-positive/30 bg-positive/10 text-positive";
  }

  const totalInstallments = account.totalInstallments ?? account.entries.length;

  return (
    <article className={`${cardClass} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <AccountKindBadge account={account} />
          </div>
          <p className="mt-2 truncate font-display text-sm font-semibold text-foreground">
            {account.title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{accountItemSubtitle(account)}</p>
          <p className="mt-2 font-display text-lg font-bold text-foreground">
            {formatCurrency(account.expectedAmount, currencyCode)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">/ parcela</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Total {formatCurrency(commitment.totalAmount, currencyCode)} · {totalInstallments}{" "}
            parcelas
          </p>
          {account.status === "active" && nextPending && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                Próxima · {nextPending.sequence}/{totalInstallments}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}
              >
                {statusLabel}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Venc.{" "}
                {new Date(nextPending.dueDate).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {account.status === "active" && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-app-bg">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{
                width: `${(account.paidCount / totalInstallments) * 100}%`,
              }}
            />
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-negative/20 px-3 py-1.5 text-xs font-semibold text-negative hover:bg-negative/5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Cancelar parcelamento
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export type { AccountsTab };
