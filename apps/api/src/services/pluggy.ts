import { PluggyClient } from "pluggy-sdk";
import { isBrokerConnector } from "@finance/shared";
import { env, isPluggyConfigured } from "../env.js";
import { prisma } from "../prisma.js";
import { reconcileGoalsForUser } from "./finance/goalTracking.js";
import { matchCommitmentInstallments } from "./finance/commitments.js";
import {
  normalizePluggyTransaction,
  processSyncedTransactions,
} from "./categoryPipeline.js";

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
): Promise<Record<string, unknown>[]> {
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
 * Sincroniza um Item da Pluggy: contas, saldos e extrato dos ultimos 365 dias.
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
  dateFrom.setDate(dateFrom.getDate() - 365);
  const dateFromStr = dateFrom.toISOString().slice(0, 10);

  const connectionWithUser = await prisma.bankConnection.findUnique({
    where: { id: connectionId },
    select: { person: { select: { userId: true } } },
  });
  const userId = connectionWithUser?.person.userId;

  for (const acc of accounts) {
    const creditFields =
      acc.type === "CREDIT" && acc.creditData
        ? {
            creditBrand: acc.creditData.brand ?? null,
            creditLevel: acc.creditData.level ?? null,
            creditLimit: acc.creditData.creditLimit ?? null,
            availableCreditLimit: acc.creditData.availableCreditLimit ?? null,
            minimumPayment: acc.creditData.minimumPayment ?? null,
            balanceCloseDate: acc.creditData.balanceCloseDate
              ? new Date(acc.creditData.balanceCloseDate)
              : null,
            balanceDueDate: acc.creditData.balanceDueDate
              ? new Date(acc.creditData.balanceDueDate)
              : null,
          }
        : {
            creditBrand: null,
            creditLevel: null,
            creditLimit: null,
            availableCreditLimit: null,
            minimumPayment: null,
            balanceCloseDate: null,
            balanceDueDate: null,
          };

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
        ...creditFields,
      },
      update: {
        name: acc.name ?? acc.marketingName ?? "Conta",
        type: acc.type ?? null,
        subtype: acc.subtype ?? null,
        number: acc.number ?? null,
        balance: acc.balance ?? 0,
        currencyCode: acc.currencyCode ?? "BRL",
        ...creditFields,
      },
    });

    const transactions = await fetchAllTransactions(pluggy, acc.id, dateFromStr);
    const normalized = transactions.map((tx) => normalizePluggyTransaction(tx));

    if (userId) {
      await processSyncedTransactions(
        userId,
        account.id,
        account.type,
        account.subtype,
        normalized,
      );
    } else {
      for (const tx of normalized) {
        await prisma.transaction.upsert({
          where: { pluggyTransactionId: tx.id },
          create: {
            pluggyTransactionId: tx.id,
            date: new Date(tx.date),
            description: tx.description,
            amount: tx.amount,
            currencyCode: tx.currencyCode ?? account.currencyCode,
            pluggyCategory: tx.category,
            merchantName: tx.merchantName,
            category: tx.category,
            categorySource: "pluggy",
            accountId: account.id,
          },
          update: {
            description: tx.description,
            amount: tx.amount,
            pluggyCategory: tx.category,
            merchantName: tx.merchantName,
          },
        });
      }
    }
  }

  await syncInvestments(pluggy, connectionId, connection.pluggyItemId);

  await prisma.bankConnection.update({
    where: { id: connectionId },
    data: { lastSyncedAt: new Date() },
  });

  const person = await prisma.bankConnection.findUnique({
    where: { id: connectionId },
    select: { person: { select: { userId: true } } },
  });
  if (person?.person.userId) {
    await reconcileGoalsForUser(person.person.userId);
    await matchCommitmentInstallments(person.person.userId);
  }
}

async function syncInvestments(
  pluggy: PluggyClient,
  connectionId: string,
  itemId: string,
): Promise<void> {
  const connection = await prisma.bankConnection.findUnique({
    where: { id: connectionId },
    include: {
      person: {
        include: {
          connections: {
            include: {
              accounts: { select: { id: true } },
              investments: { select: { id: true, code: true, isin: true } },
            },
          },
        },
      },
    },
  });
  if (!connection) return;

  const personConnections = connection.person.connections;
  const currentConn = personConnections.find((c) => c.id === connectionId);
  const accountCount = currentConn?.accounts.length ?? 0;

  const personHasBroker = personConnections.some(
    (c) => c.id !== connectionId && isBrokerConnector(c.connectorName),
  );

  if (personHasBroker && !isBrokerConnector(connection.connectorName)) {
    await prisma.investment.deleteMany({ where: { connectionId } });
    return;
  }

  const personHasInvestmentOnly = personConnections.some(
    (c) =>
      c.id !== connectionId &&
      c.investments.length > 0 &&
      c.accounts.length === 0,
  );

  if (personHasInvestmentOnly && accountCount > 0) {
    await prisma.investment.deleteMany({ where: { connectionId } });
    return;
  }

  try {
    const response = await pluggy.fetchInvestments(itemId);
    const investments = response.results ?? [];
    const seenInvestmentIds: string[] = [];

    for (const inv of investments) {
      seenInvestmentIds.push(inv.id);

      const investment = await prisma.investment.upsert({
        where: { pluggyInvestmentId: inv.id },
        create: {
          pluggyInvestmentId: inv.id,
          connectionId,
          name: inv.name,
          type: inv.type ?? null,
          subtype: inv.subtype ?? null,
          code: inv.code ?? null,
          isin: inv.isin ?? null,
          status: inv.status ?? "ACTIVE",
          balance: inv.balance ?? 0,
          amount: inv.amount ?? null,
          amountOriginal: inv.amountOriginal ?? null,
          amountProfit: inv.amountProfit ?? null,
          amountWithdrawal: inv.amountWithdrawal ?? null,
          quantity: inv.quantity ?? null,
          value: inv.value ?? null,
          rate: inv.rate ?? null,
          rateType: inv.rateType ?? null,
          annualRate: inv.annualRate ?? inv.fixedAnnualRate ?? null,
          lastMonthRate: inv.lastMonthRate ?? null,
          lastTwelveMonthsRate: inv.lastTwelveMonthsRate ?? null,
          currencyCode: inv.currencyCode ?? "BRL",
          purchaseDate: inv.purchaseDate ? new Date(inv.purchaseDate) : null,
          dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
          positionDate: inv.date ? new Date(inv.date) : null,
          owner: inv.owner ?? null,
        },
        update: {
          name: inv.name,
          type: inv.type ?? null,
          subtype: inv.subtype ?? null,
          code: inv.code ?? null,
          isin: inv.isin ?? null,
          status: inv.status ?? "ACTIVE",
          balance: inv.balance ?? 0,
          amount: inv.amount ?? null,
          amountOriginal: inv.amountOriginal ?? null,
          amountProfit: inv.amountProfit ?? null,
          amountWithdrawal: inv.amountWithdrawal ?? null,
          quantity: inv.quantity ?? null,
          value: inv.value ?? null,
          rate: inv.rate ?? null,
          rateType: inv.rateType ?? null,
          annualRate: inv.annualRate ?? inv.fixedAnnualRate ?? null,
          lastMonthRate: inv.lastMonthRate ?? null,
          lastTwelveMonthsRate: inv.lastTwelveMonthsRate ?? null,
          currencyCode: inv.currencyCode ?? "BRL",
          purchaseDate: inv.purchaseDate ? new Date(inv.purchaseDate) : null,
          dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
          positionDate: inv.date ? new Date(inv.date) : null,
          owner: inv.owner ?? null,
        },
      });

      const transactions = await pluggy.fetchAllInvestmentTransactions(inv.id);
      const seenTxIds: string[] = [];

      for (const tx of transactions) {
        seenTxIds.push(tx.id);
        await prisma.investmentTransaction.upsert({
          where: { pluggyInvestmentTransactionId: tx.id },
          create: {
            pluggyInvestmentTransactionId: tx.id,
            investmentId: investment.id,
            date: new Date(tx.date),
            tradeDate: tx.tradeDate ? new Date(tx.tradeDate) : null,
            type: tx.type ?? null,
            amount: tx.amount ?? 0,
            netAmount: tx.netAmount ?? null,
            quantity: tx.quantity ?? null,
            value: tx.value ?? null,
            description: tx.description ?? null,
            movementType: tx.movementType ?? null,
          },
          update: {
            date: new Date(tx.date),
            tradeDate: tx.tradeDate ? new Date(tx.tradeDate) : null,
            type: tx.type ?? null,
            amount: tx.amount ?? 0,
            netAmount: tx.netAmount ?? null,
            quantity: tx.quantity ?? null,
            value: tx.value ?? null,
            description: tx.description ?? null,
            movementType: tx.movementType ?? null,
          },
        });
      }

      if (seenTxIds.length > 0) {
        await prisma.investmentTransaction.deleteMany({
          where: {
            investmentId: investment.id,
            pluggyInvestmentTransactionId: { notIn: seenTxIds },
          },
        });
      } else {
        await prisma.investmentTransaction.deleteMany({
          where: { investmentId: investment.id },
        });
      }
    }

    if (seenInvestmentIds.length > 0) {
      await prisma.investment.deleteMany({
        where: {
          connectionId,
          pluggyInvestmentId: { notIn: seenInvestmentIds },
        },
      });
    } else {
      await prisma.investment.deleteMany({ where: { connectionId } });
    }
  } catch {
    // Conector pode não expor investimentos (ex.: Nu sem carteira)
  }
}
