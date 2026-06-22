import { prisma } from "../../prisma.js";
import { translateCategory } from "@finance/shared";
import type { FinancialPerson, UserFinancialData } from "./types.js";

export class InvalidPersonError extends Error {
  constructor() {
    super("Pessoa não encontrada");
    this.name = "InvalidPersonError";
  }
}

export interface LoadUserFinancialDataOptions {
  personId?: string;
  transactionsPerAccount?: number;
}

const DEFAULT_TRANSACTIONS_PER_ACCOUNT = 15;

/**
 * Carrega pessoas, conexões, contas e transações do usuário.
 * Se personId for informado, filtra para essa pessoa (deve pertencer ao userId).
 */
export async function loadUserFinancialData(
  userId: string,
  options: LoadUserFinancialDataOptions = {},
): Promise<UserFinancialData> {
  const { personId, transactionsPerAccount = DEFAULT_TRANSACTIONS_PER_ACCOUNT } = options;

  if (personId) {
    const person = await prisma.person.findFirst({
      where: { id: personId, userId },
    });
    if (!person) {
      throw new InvalidPersonError();
    }
  }

  const people = await prisma.person.findMany({
    where: {
      userId,
      ...(personId ? { id: personId } : {}),
    },
    include: {
      connections: {
        include: {
          accounts: {
            include: {
              transactions: {
                orderBy: { date: "desc" },
                take: transactionsPerAccount,
              },
            },
          },
        },
      },
    },
  });

  return {
    people: people.map(
      (person): FinancialPerson => ({
        id: person.id,
        name: person.name,
        relationship: person.relationship,
        connections: person.connections.map((conn) => ({
          id: conn.id,
          connectorName: conn.connectorName,
          lastSyncedAt: conn.lastSyncedAt,
          accounts: conn.accounts.map((acc) => ({
            id: acc.id,
            name: acc.name,
            type: acc.type,
            subtype: acc.subtype,
            number: acc.number,
            balance: acc.balance,
            currencyCode: acc.currencyCode,
            transactions: acc.transactions.map((tx) => ({
              id: tx.id,
              date: tx.date,
              description: tx.description,
              amount: tx.amount,
              currencyCode: tx.currencyCode,
              category: translateCategory(tx.category),
              accountId: acc.id,
              accountName: acc.name,
              accountType: acc.type,
              personId: person.id,
              personName: person.name,
            })),
          })),
        })),
      }),
    ),
  };
}

/** Retorna todas as transações achatadas a partir dos dados carregados. */
export function flattenTransactions(data: UserFinancialData) {
  const txs = [];
  for (const person of data.people) {
    for (const conn of person.connections) {
      for (const acc of conn.accounts) {
        txs.push(...acc.transactions);
      }
    }
  }
  return txs.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** Retorna todas as conexões achatadas. */
export function flattenConnections(data: UserFinancialData) {
  return data.people.flatMap((p) => p.connections);
}
