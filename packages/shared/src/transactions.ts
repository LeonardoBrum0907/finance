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
