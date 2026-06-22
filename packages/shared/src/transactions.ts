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

/** Contribuição da conta para o patrimônio líquido (contas somam, faturas de cartão subtraem). */
export function accountNetWorthContribution(
  balance: number,
  accountType: string | null | undefined,
): number {
  if (isCreditAccount(accountType)) return -Math.abs(balance);
  return balance;
}

const SAME_PERSON_TRANSFER_PREFIXES = [
  "Transferência mesma titularidade",
  "Same person transfer",
] as const;

const CREDIT_CARD_PAYMENT_PREFIXES = [
  "Pagamento de cartão de crédito",
  "Credit card payment",
] as const;

function isSamePersonTransfer(category: string | null | undefined): boolean {
  if (!category) return false;
  return SAME_PERSON_TRANSFER_PREFIXES.some((prefix) => category.startsWith(prefix));
}

function isCreditCardBillPayment(
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
): boolean {
  if (amount === 0) return false;

  if (isCreditAccount(accountType)) {
    // Cartão: só compras (positivo) entram; pagamentos (negativo) são liquidação de dívida.
    return amount > 0;
  }

  if (isSamePersonTransfer(category)) return false;
  if (isCreditCardBillPayment(category, description)) return false;

  return true;
}
