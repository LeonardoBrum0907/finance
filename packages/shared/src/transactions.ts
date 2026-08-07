/** Conta de cartão de crédito (convenção Pluggy: positivo = débito/cobrança). */
export function isCreditAccount(accountType: string | null | undefined): boolean {
  if (!accountType) return false;
  const t = accountType.toUpperCase();
  return t.includes("CREDIT");
}

/**
 * Indica se a transação é saída de dinheiro (despesa/cobrança).
 * Conta corrente: negativo = saída. Cartão: positivo = cobrança.
 */
export function isTransactionOutflow(
  amount: number,
  accountType: string | null | undefined,
): boolean {
  if (amount === 0) return false;
  if (isCreditAccount(accountType)) return amount > 0;
  return amount < 0;
}

/**
 * Valor com sinal para exibição: cartão mostra compras negativas e pagamentos positivos.
 */
export function toSignedDisplayAmount(
  amount: number,
  accountType: string | null | undefined,
): number {
  return isCreditAccount(accountType) ? -amount : amount;
}

/** Conta de investimento agregada no Open Finance (saldo já entra na carteira de posições). */
export function isInvestmentAccount(accountType: string | null | undefined): boolean {
  if (!accountType) return false;
  return accountType.toUpperCase() === "INVESTMENT";
}

/** Contribuição da conta para o patrimônio líquido (contas somam, faturas de cartão subtraem). */
export function accountNetWorthContribution(
  balance: number,
  accountType: string | null | undefined,
): number {
  if (isInvestmentAccount(accountType)) return 0;
  if (isCreditAccount(accountType)) return -Math.abs(balance);
  return balance;
}

const SAME_PERSON_TRANSFER_PREFIXES = [
  "Transferência mesma titularidade",
  "Same person transfer",
] as const;

const TRANSFER_DESCRIPTION_MARKERS = [
  "transferência recebida",
  "transferencia recebida",
  "transferência enviada",
  "transferencia enviada",
  "same person transfer",
  "mesma titularidade",
  "pix enviado",
  "pix recebido",
] as const;

const CREDIT_CARD_PAYMENT_PREFIXES = [
  "Pagamento de cartão de crédito",
  "Credit card payment",
] as const;

function normalizeForNameMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameMatchTokens(personName: string): string[] {
  return normalizeForNameMatch(personName)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function descriptionIndicatesTransfer(description: string): boolean {
  const lower = description.toLowerCase();
  return TRANSFER_DESCRIPTION_MARKERS.some((marker) => lower.includes(marker));
}

export function descriptionMatchesPersonName(description: string, personName: string): boolean {
  const normalizedDescription = normalizeForNameMatch(description);
  const normalizedPerson = normalizeForNameMatch(personName);
  if (!normalizedPerson) return false;

  if (normalizedPerson.length >= 6 && normalizedDescription.includes(normalizedPerson)) {
    return true;
  }

  const tokens = nameMatchTokens(personName);
  if (tokens.length === 0) return false;

  if (tokens.length === 1) {
    return normalizedDescription.includes(tokens[0]!);
  }

  const first = tokens[0]!;
  const last = tokens[tokens.length - 1]!;
  return normalizedDescription.includes(first) && normalizedDescription.includes(last);
}

/**
 * Indica transferência entre contas da mesma titularidade.
 * Usa categoria Pluggy e, quando disponível, o nome da pessoa na descrição
 * (ex.: Nubank registra "Transferência Recebida|DEBORA BRUM..." sem a categoria correta).
 */
export function isSamePersonTransfer(
  category: string | null | undefined,
  description?: string | null,
  personName?: string | null,
): boolean {
  if (category && SAME_PERSON_TRANSFER_PREFIXES.some((prefix) => category.startsWith(prefix))) {
    return true;
  }

  if (!personName || !description) return false;
  if (!descriptionIndicatesTransfer(description)) return false;
  return descriptionMatchesPersonName(description, personName);
}

export function isCreditCardBillPayment(
  category: string | null | undefined,
  description: string | null | undefined,
): boolean {
  if (category && CREDIT_CARD_PAYMENT_PREFIXES.some((prefix) => category.startsWith(prefix))) {
    return true;
  }
  const text = (description ?? "").toLowerCase();
  return (
    text.includes("pagamento de fatura") ||
    text.includes("fatura paga") ||
    text.includes("pagamento com saldo")
  );
}

/**
 * Indica se a transação entra no fluxo de caixa (entradas/saídas do painel).
 * Exclui pagamentos de fatura e transferências entre contas próprias, que
 * aparecem em banco e cartão e inflam receitas/despesas sem refletir gasto real.
 */
export function countsTowardCashFlow(
  amount: number,
  accountType: string | null | undefined,
  category: string | null | undefined,
  description?: string | null,
  personName?: string | null,
): boolean {
  if (amount === 0) return false;

  if (isCreditAccount(accountType)) {
    // Cartão: só compras (positivo) entram; pagamentos (negativo) são liquidação de dívida.
    return amount > 0;
  }

  if (isSamePersonTransfer(category, description, personName)) return false;
  if (isCreditCardBillPayment(category, description)) return false;

  return true;
}
