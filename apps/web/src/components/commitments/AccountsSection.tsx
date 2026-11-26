import { useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import type {
  BillCyclesResult,
  ManagedAccountDTO,
  PersonDTO,
  RecurringBillDTO,
  SimulationScenarioDTO,
  UpdateRecurringBillInput,
} from "@finance/shared";
import {
  billCycleKeyForPayment,
  managedAccountKindLabel,
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
import { RecurringBillEditModal } from "./RecurringBillEditModal";
import { InfoTip } from "../InfoTip";
import { Switch } from "../Switch";
import { PlannedCard } from "./PlannedCard";
import type { PlannedCard as PlannedCardOption } from "./PlannedPurchaseModal";
import { commitmentNextPendingEntry, filterAccountsByPerson } from "./accounts";

interface Props {
  /** Contas ativas, desligadas e compras planejadas (ligadas ou não). */
  accounts: ManagedAccountDTO[];
  /** Encerradas (concluídas, canceladas, arquivadas), mostradas só quando pedidas. */
  closedAccounts?: ManagedAccountDTO[];
  showClosed: boolean;
  onShowClosedChange: (value: boolean) => void;
  people: PersonDTO[];
  cards: PlannedCardOption[];
  currencyCode: string;
  personId?: string;
  loading?: boolean;
  detecting?: boolean;
  savingBill?: boolean;
  busyPlannedId?: string | null;
  /** Fatura selecionada: o status das contas passa a ser dessa fatura. */
  billCycle?: BillCycleSelection;
  onDetect: () => void;
  onPlan: () => void;
  onUpdateBill: (id: string, body: UpdateRecurringBillInput) => void;
  onDeleteBill: (id: string) => void;
  onCancelCommitment: (id: string) => void;
  onToggleBill: (account: ManagedAccountDTO) => void;
  onTogglePlanned: (scenario: SimulationScenarioDTO) => void;
  onEditPlanned: (scenario: SimulationScenarioDTO) => void;
  onBoughtPlanned: (scenario: SimulationScenarioDTO) => void;
  onDeletePlanned: (scenario: SimulationScenarioDTO) => void;
}

function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-foreground">
        {title}
        {hint && <InfoTip>{hint}</InfoTip>}
      </h2>
      {action}
    </div>
  );
}

const sectionButtonClass =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10 disabled:opacity-60";

/** Compromissos em três listas: o que você planeja, as contas fixas e os parcelamentos. */
export function AccountsSection({
  accounts,
  closedAccounts = [],
  showClosed,
  onShowClosedChange,
  people,
  cards,
  currencyCode,
  personId,
  loading,
  detecting,
  savingBill,
  busyPlannedId,
  billCycle,
  onDetect,
  onPlan,
  onUpdateBill,
  onDeleteBill,
  onCancelCommitment,
  onToggleBill,
  onTogglePlanned,
  onEditPlanned,
  onBoughtPlanned,
  onDeletePlanned,
}: Props) {
  const confirm = useConfirm();
  const [editingBill, setEditingBill] = useState<RecurringBillDTO | null>(null);

  const scoped = useMemo(() => filterAccountsByPerson(accounts, personId), [accounts, personId]);
  // Ligados primeiro.
  const byActive = (a: ManagedAccountDTO, b: ManagedAccountDTO) =>
    Number(b.status === "active") - Number(a.status === "active");
  const planned = scoped.filter((a) => a.kind === "simulation").sort(byActive);
  const fixed = scoped.filter((a) => a.kind === "fixed_recurring").sort(byActive);
  const installments = scoped.filter((a) => a.kind === "installment_plan" && a.status === "active");
  const closed = filterAccountsByPerson(closedAccounts, personId);

  async function handleDeleteBill(account: ManagedAccountDTO) {
    const ok = await confirm({
      title: "Excluir conta fixa",
      message: `Excluir "${account.title}"? Ela não será detectada novamente automaticamente.`,
      confirmLabel: "Excluir",
      variant: "danger",
    });
    if (ok) onDeleteBill(managedAccountLegacyId(account));
  }

  if (loading) {
    return (
      <div className={`${cardClass} p-6 text-center text-sm text-muted-foreground`}>
        Carregando compromissos...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeader
          title="Planejado"
          hint="Compras que você ainda vai fazer. Ligada, ela já pesa no ciclo da fatura acima."
          action={
            <button type="button" onClick={onPlan} className={sectionButtonClass}>
              <Plus className="h-3.5 w-3.5" /> Planejar compra
            </button>
          }
        />
        {planned.length === 0 ? (
          <p className="rounded-xl border border-dashed border-app-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nada planejado.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {planned.map((account) => {
              const scenario = managedAccountToScenarioDTO(account);
              if (!scenario) return null;
              return (
                <PlannedCard
                  key={account.id}
                  scenario={scenario}
                  cards={cards}
                  currencyCode={currencyCode}
                  busy={busyPlannedId === scenario.id}
                  onToggle={() => onTogglePlanned(scenario)}
                  onEdit={() => onEditPlanned(scenario)}
                  onBought={() => onBoughtPlanned(scenario)}
                  onDelete={() => onDeletePlanned(scenario)}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Contas fixas"
          hint="Detectadas no extrato. Desligue uma conta que não vai se repetir."
          action={
            <button type="button" onClick={onDetect} disabled={detecting} className={sectionButtonClass}>
              <RefreshCw className={`h-3.5 w-3.5 ${detecting ? "animate-spin" : ""}`} />
              {detecting ? "Atualizando..." : "Atualizar do extrato"}
            </button>
          }
        />
        {fixed.length === 0 ? (
          <p className="rounded-xl border border-dashed border-app-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhuma conta fixa.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {fixed.map((account) => (
              <RecurringBillAccountCard
                key={account.id}
                account={account}
                currencyCode={currencyCode}
                billCycle={billCycle}
                onToggle={() => onToggleBill(account)}
                onEdit={() => {
                  const bill = managedAccountToRecurringBillDTO(account);
                  if (bill) setEditingBill(bill);
                }}
                onDelete={() => handleDeleteBill(account)}
              />
            ))}
          </div>
        )}
      </section>

      {installments.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Parcelamentos" hint="Compras parceladas no cartão, até a última parcela." />
          <div className="grid gap-3 lg:grid-cols-2">
            {installments.map((account) => (
              <CommitmentAccountCard
                key={account.id}
                account={account}
                currencyCode={currencyCode}
                onCancel={() => onCancelCommitment(managedAccountLegacyId(account))}
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => onShowClosedChange(!showClosed)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {showClosed ? "Esconder encerrados" : "Ver encerrados"}
        </button>
        {showClosed &&
          (closed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada encerrado ainda.</p>
          ) : (
            <ul className="divide-y divide-app-border/60 rounded-xl border border-app-border bg-app-surface">
              {closed.map((account) => (
                <li key={account.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="truncate text-foreground">{account.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {managedAccountKindLabel(account.kind)} · {closedStatusLabel(account.status)} ·{" "}
                    {formatCurrency(account.expectedAmount, currencyCode)}
                  </span>
                </li>
              ))}
            </ul>
          ))}
      </section>

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
    </div>
  );
}

function closedStatusLabel(status: ManagedAccountDTO["status"]): string {
  switch (status) {
    case "completed":
      return "concluída";
    case "cancelled":
      return "cancelada";
    case "converted":
      return "convertida";
    default:
      return "arquivada";
  }
}

export interface BillCycleSelection {
  cycleKey: string;
  label: string;
  result: BillCyclesResult;
}

function entryInBillCycle(
  account: ManagedAccountDTO,
  entry: ManagedAccountDTO["entries"][number],
  billCycle: BillCycleSelection,
): boolean {
  const date = entry.dueDate.slice(0, 10);
  const key = billCycleKeyForPayment(billCycle.result, {
    date,
    cardAccountId: account.bankAccountId,
    // Parcelas do cartão já vencem com a fatura.
    billMonth: account.kind === "installment_plan" ? date.slice(0, 7) : null,
  });
  return key === billCycle.cycleKey;
}

function RecurringBillAccountCard({
  account,
  currencyCode,
  billCycle,
  onToggle,
  onEdit,
  onDelete,
}: {
  account: ManagedAccountDTO;
  currencyCode: string;
  billCycle?: BillCycleSelection;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const today = todayDateKeyInTimeZone();
  const currentEntry = billCycle
    ? account.entries.find((entry) => entryInBillCycle(account, entry, billCycle))
    : undefined;
  // Cobrada no cartão: vence junto com a fatura.
  const paidByCard =
    !!billCycle && billCycle.result.cards.some((card) => card.accountId === account.bankAccountId);
  const billDueDate = paidByCard
    ? billCycle!.result.cycles.find((cycle) => cycle.cycleKey === billCycle!.cycleKey)?.dueDate
    : undefined;
  const entryDueKey = billDueDate ?? currentEntry?.dueDate.slice(0, 10);

  let monthStatusLabel = "Sem cobrança";
  let monthStatusClass = "border-app-border bg-app-bg/60 text-muted-foreground";

  if (currentEntry?.status === "paid") {
    monthStatusLabel = "Pago";
    monthStatusClass = "border-positive/30 bg-positive/10 text-positive";
  } else if (currentEntry?.status === "skipped") {
    monthStatusLabel = "Ignorado";
    monthStatusClass = "border-app-border bg-app-bg/60 text-muted-foreground";
  } else if (currentEntry?.status === "pending") {
    const dueDateKey = entryDueKey ?? currentEntry.dueDate.slice(0, 10);
    monthStatusLabel = dueDateKey < today ? "Pendente · atrasado" : "Pendente";
    monthStatusClass = "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  }

  return (
    <article className={`${cardClass} p-4 ${account.status === "active" ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
            <span className="truncate">{account.title}</span>
            <InfoTip>{[recurringBillStatusLabel(account.status as "active" | "inactive" | "dismissed"), account.category, account.personName, account.bankAccountName].filter(Boolean).join(" · ")}</InfoTip>
          </p>
          <p className="mt-2 font-display text-lg font-bold text-foreground">
            {formatCurrency(account.expectedAmount, currencyCode)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">/ mês</span>
          </p>
          {account.status === "active" && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${monthStatusClass}`}
              >
                {monthStatusLabel}
              </span>
              {currentEntry && entryDueKey && (
                <span className="text-[10px] text-muted-foreground">
                  {paidByCard ? "Na fatura de" : "Venc."}{" "}
                  {new Date(`${entryDueKey}T12:00:00`).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              )}
            </div>
          )}
        </div>
        <Switch
          checked={account.status === "active"}
          onChange={onToggle}
          label={account.status === "active" ? "Desligar conta" : "Ligar conta"}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
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
          <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
            <span className="truncate">{account.title}</span>
            <InfoTip>{[account.payeeName, account.personName, `Total ${formatCurrency(commitment.totalAmount, currencyCode)} em ${totalInstallments} parcelas`].filter(Boolean).join(" · ")}</InfoTip>
          </p>
          <p className="mt-2 font-display text-lg font-bold text-foreground">
            {formatCurrency(account.expectedAmount, currencyCode)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">/ parcela</span>
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

