import type { ManagedAccountDTO } from "@finance/shared";
import { managedAccountDisplayLabel } from "@finance/shared";

export function accountItemSubtitle(account: ManagedAccountDTO): string {
  if (account.kind === "fixed_recurring") {
    return [account.category, account.personName, account.bankAccountName].filter(Boolean).join(" · ");
  }

  if (account.kind === "installment_plan") {
    return [
      account.payeeName,
      account.personName,
      `${account.paidCount}/${account.totalInstallments ?? account.entries.length} parcelas pagas`,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return [managedAccountDisplayLabel(account), account.personName].filter(Boolean).join(" · ");
}

export function commitmentNextPendingEntry(account: ManagedAccountDTO) {
  return account.entries.find((entry) => entry.status === "pending");
}

export function filterAccountsByPerson(
  accounts: ManagedAccountDTO[],
  personId?: string,
): ManagedAccountDTO[] {
  if (!personId) return accounts;
  return accounts.filter((account) => account.personId == null || account.personId === personId);
}
