import { resolveTransactionCategory } from "@finance/shared";

export function effectiveTransactionCategory(tx: {
  category: string | null;
  userCategory?: string | null;
  pluggyCategory?: string | null;
  description: string;
}): string | null {
  return resolveTransactionCategory(tx);
}

export function toTransactionDtoFields(tx: {
  id: string;
  date: Date;
  description: string;
  amount: number;
  currencyCode: string;
  category: string | null;
  userCategory?: string | null;
  pluggyCategory?: string | null;
  categorySource?: string | null;
  categoryConfidence?: number | null;
  merchantName?: string | null;
  account: {
    id: string;
    name: string;
    type: string | null;
    connection: {
      person: { id: string; name: string };
    };
  };
}) {
  const resolvedCategory = effectiveTransactionCategory(tx);
  return {
    id: tx.id,
    date: tx.date.toISOString(),
    description: tx.description,
    amount: tx.amount,
    currencyCode: tx.currencyCode,
    category: resolvedCategory,
    userCategory: tx.userCategory ?? null,
    categorySource: tx.categorySource ?? null,
    categoryConfidence: tx.categoryConfidence ?? null,
    merchantName: tx.merchantName ?? null,
    accountId: tx.account.id,
    accountName: tx.account.name,
    accountType: tx.account.type,
    personId: tx.account.connection.person.id,
    personName: tx.account.connection.person.name,
  };
}
