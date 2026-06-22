import { PluggyClient } from "pluggy-sdk";
import { env, isPluggyConfigured } from "../env.js";
import { prisma } from "../prisma.js";

let client: PluggyClient | null = null;

export function getPluggyClient(): PluggyClient {
  if (!isPluggyConfigured()) {
    throw new Error(
      "Pluggy não configurado. Defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.",
    );
  }
  if (!client) {
    client = new PluggyClient({
      clientId: env.pluggy.clientId,
      clientSecret: env.pluggy.clientSecret,
    });
  }
  return client;
}

export async function createConnectToken(clientUserId: string): Promise<string> {
  const pluggy = getPluggyClient();
  const result = await pluggy.createConnectToken(undefined, { clientUserId });
  return result.accessToken;
}

/**
 * Busca todas as transacoes de uma conta usando paginacao por cursor,
 * com fallback para a API antiga caso o SDK nao exponha o metodo novo.
 */
async function fetchAllTransactions(
  pluggy: PluggyClient,
  accountId: string,
  dateFrom: string,
): Promise<Array<{ id: string; date: string; description: string; amount: number; currencyCode: string | null; category: string | null }>> {
  const anyClient = pluggy as unknown as Record<string, unknown>;
  if (typeof anyClient.fetchAllTransactions === "function") {
    const all = await (anyClient.fetchAllTransactions as (
      accountId: string,
      options: { dateFrom: string },
    ) => Promise<{ results?: unknown[] } | unknown[]>)(accountId, { dateFrom });
    const list = Array.isArray(all) ? all : (all.results ?? []);
    return list as never;
  }

  // Fallback: paginacao por pagina
  const results: unknown[] = [];
  let page = 1;
  for (;;) {
    const response = (await (pluggy as unknown as {
      fetchTransactions: (
        accountId: string,
        options: { page: number; pageSize: number; from?: string },
      ) => Promise<{ results: unknown[]; totalPages: number }>;
    }).fetchTransactions(accountId, { page, pageSize: 200, from: dateFrom }));
    results.push(...response.results);
    if (page >= response.totalPages) break;
    page += 1;
  }
  return results as never;
}

/**
 * Sincroniza um Item da Pluggy: contas, saldos e extrato dos ultimos 90 dias.
 */
export async function syncConnection(connectionId: string): Promise<void> {
  const connection = await prisma.bankConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection) throw new Error("Conexão não encontrada");

  const pluggy = getPluggyClient();

  const item = await pluggy.fetchItem(connection.pluggyItemId);
  await prisma.bankConnection.update({
    where: { id: connectionId },
    data: {
      connectorName: item.connector?.name ?? connection.connectorName,
      connectorImageUrl: item.connector?.imageUrl ?? connection.connectorImageUrl,
      status: item.status ?? connection.status,
    },
  });

  const accountsResponse = await pluggy.fetchAccounts(connection.pluggyItemId);
  const accounts = accountsResponse.results ?? [];

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 90);
  const dateFromStr = dateFrom.toISOString().slice(0, 10);

  for (const acc of accounts) {
    const account = await prisma.account.upsert({
      where: { pluggyAccountId: acc.id },
      create: {
        pluggyAccountId: acc.id,
        name: acc.name ?? acc.marketingName ?? "Conta",
        type: acc.type ?? null,
        subtype: acc.subtype ?? null,
        number: acc.number ?? null,
        balance: acc.balance ?? 0,
        currencyCode: acc.currencyCode ?? "BRL",
        connectionId,
      },
      update: {
        name: acc.name ?? acc.marketingName ?? "Conta",
        type: acc.type ?? null,
        subtype: acc.subtype ?? null,
        number: acc.number ?? null,
        balance: acc.balance ?? 0,
        currencyCode: acc.currencyCode ?? "BRL",
      },
    });

    const transactions = await fetchAllTransactions(pluggy, acc.id, dateFromStr);
    for (const tx of transactions) {
      await prisma.transaction.upsert({
        where: { pluggyTransactionId: tx.id },
        create: {
          pluggyTransactionId: tx.id,
          date: new Date(tx.date),
          description: tx.description ?? "Transação",
          amount: tx.amount ?? 0,
          currencyCode: tx.currencyCode ?? account.currencyCode,
          category: tx.category ?? null,
          accountId: account.id,
        },
        update: {
          description: tx.description ?? "Transação",
          amount: tx.amount ?? 0,
          category: tx.category ?? null,
        },
      });
    }
  }

  await prisma.bankConnection.update({
    where: { id: connectionId },
    data: { lastSyncedAt: new Date() },
  });
}
