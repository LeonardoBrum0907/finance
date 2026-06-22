export interface FinancialTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  currencyCode: string;
  category: string | null;
  accountId: string;
  accountName: string;
  personId: string;
  personName: string;
}

export interface FinancialAccount {
  id: string;
  name: string;
  type: string | null;
  subtype: string | null;
  number: string | null;
  balance: number;
  currencyCode: string;
  transactions: FinancialTransaction[];
}

export interface FinancialConnection {
  id: string;
  connectorName: string | null;
  lastSyncedAt: Date | null;
  accounts: FinancialAccount[];
}

export interface FinancialPerson {
  id: string;
  name: string;
  relationship: string | null;
  connections: FinancialConnection[];
}

export interface UserFinancialData {
  people: FinancialPerson[];
}
