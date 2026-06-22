import type { PersonDTO } from "@finance/shared";

interface SuggestionContext {
  people: PersonDTO[];
  selectedPersonId: string;
  selectedPersonName?: string;
}

export function getChatSuggestions({
  people,
  selectedPersonId,
  selectedPersonName,
}: SuggestionContext): string[] {
  const hasPeople = people.length > 0;
  const hasAccounts = people.some((p) => p.connections.some((c) => c.accounts.length > 0));

  if (!hasPeople) {
    return ["Como cadastrar uma pessoa?", "O que o assistente faz?"];
  }

  if (!hasAccounts) {
    return [
      "Como conectar uma conta bancária?",
      "Quais bancos posso conectar?",
      "O que o assistente consegue fazer?",
    ];
  }

  if (selectedPersonId && selectedPersonName) {
    return [
      `Como estão os gastos de ${selectedPersonName} este mês?`,
      `Liste as transações de entrada de ${selectedPersonName}`,
      `Qual o saldo de ${selectedPersonName}?`,
    ];
  }

  return [
    "Quanto gastei este mês?",
    "Quais são minhas maiores despesas?",
    "Qual meu saldo consolidado?",
    "Mostre gastos por categoria",
  ];
}
