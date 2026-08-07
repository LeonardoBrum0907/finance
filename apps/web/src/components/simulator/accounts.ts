import type { ManagedAccountDTO } from "@finance/shared";
import {
  managedAccountDisplayLabel,
  sumActiveManagedAccountsMonthlyTotal,
} from "@finance/shared";
import type { SimulatorTone } from "./tokens";

export type AccountsTab = "active" | "draft" | "inactive" | "history";

export type AccountTypeFilter =
  | "all"
  | "fixed_recurring"
  | "simulation"
  | "future_account"
  | "installment_plan";

export function accountsTabLabel(tab: AccountsTab): string {
  switch (tab) {
    case "active":
      return "Ativas";
    case "draft":
      return "Rascunhos";
    case "inactive":
      return "Inativas";
    case "history":
      return "Concluídas";
  }
}

export function accountKindTone(account: ManagedAccountDTO): SimulatorTone {
  if (account.kind === "fixed_recurring") {
    return account.status === "active" ? "brand" : "neutral";
  }
  if (account.kind === "installment_plan") {
    return account.status === "active" ? "negative" : "neutral";
  }

  switch (account.simulationType) {
    case "single_purchase":
      return "positive";
    case "installments":
      return "brand";
    case "recurring_expense":
      return "negative";
    case "save_for_goal":
      return "brand";
    case "invest":
      return "positive";
    default:
      return "neutral";
  }
}

export function accountItemSubtitle(account: ManagedAccountDTO): string {
  if (account.kind === "fixed_recurring") {
    const parts = [account.category, account.personName, account.bankAccountName].filter(Boolean);
    return parts.join(" · ");
  }

  if (account.kind === "installment_plan") {
    const parts = [
      account.payeeName,
      account.personName,
      `${account.paidCount}/${account.totalInstallments ?? account.entries.length} parcelas pagas`,
    ].filter(Boolean);
    return parts.join(" · ");
  }

  const parts = [managedAccountDisplayLabel(account), account.personName].filter(Boolean);
  return parts.join(" · ");
}

export function accountItemAmount(account: ManagedAccountDTO): number {
  return account.expectedAmount;
}

export function accountItemIsMonthly(account: ManagedAccountDTO): boolean {
  if (account.kind === "fixed_recurring" || account.kind === "installment_plan") return true;
  return (
    account.simulationType === "recurring_expense" ||
    account.simulationType === "invest" ||
    account.simulationType === "save_for_goal"
  );
}

export function commitmentNextPendingEntry(account: ManagedAccountDTO) {
  return account.entries.find((entry) => entry.status === "pending");
}

/** Soma das parcelas pendentes da conta dentro do intervalo do ciclo. */
export function accountPendingInCycle(
  account: ManagedAccountDTO,
  cycleFrom?: string,
  cycleTo?: string,
): number {
  if (!cycleFrom || !cycleTo) return 0;
  return account.entries
    .filter((entry) => {
      if (entry.status !== "pending") return false;
      const dueDateKey = entry.dueDate.slice(0, 10);
      return dueDateKey >= cycleFrom && dueDateKey <= cycleTo;
    })
    .reduce((sum, entry) => sum + entry.amount, 0);
}

export function filterAccountsByPerson(
  accounts: ManagedAccountDTO[],
  personId?: string,
): ManagedAccountDTO[] {
  if (!personId) return accounts;
  return accounts.filter((account) => account.personId == null || account.personId === personId);
}

export function matchesAccountTypeFilter(
  account: ManagedAccountDTO,
  filter: AccountTypeFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "fixed_recurring") return account.kind === "fixed_recurring";
  if (filter === "installment_plan") return account.kind === "installment_plan";
  if (filter === "future_account") {
    return account.kind === "simulation" && account.simulationType === "recurring_expense";
  }
  return account.kind === "simulation" && account.simulationType !== "recurring_expense";
}

export function countActiveAccountsByKind(
  accounts: ManagedAccountDTO[],
  personId?: string,
): { fixed: number; simulation: number; installment: number } {
  const scoped = filterAccountsByPerson(
    accounts.filter((account) => account.status === "active"),
    personId,
  );

  return {
    fixed: scoped.filter((account) => account.kind === "fixed_recurring").length,
    simulation: scoped.filter((account) => account.kind === "simulation").length,
    installment: scoped.filter((account) => account.kind === "installment_plan").length,
  };
}

export { sumActiveManagedAccountsMonthlyTotal, managedAccountDisplayLabel };
