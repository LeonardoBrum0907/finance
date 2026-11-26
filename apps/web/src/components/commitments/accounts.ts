import type { ManagedAccountDTO } from "@finance/shared";

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
