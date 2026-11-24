import type { AccountDTO } from "@finance/shared";
import { formatCurrency } from "../../lib/format";

/** "2026-11-28T12:00:00.000Z" → "28/11". Datas de fatura vêm ao meio-dia UTC. */
function formatDayMonth(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function BillLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="shrink-0 tabular-nums text-foreground/90">{value}</span>
    </div>
  );
}

function limitUsedLabel(account: AccountDTO): string {
  const used = formatCurrency(Math.abs(account.balance), account.currencyCode);
  if (!account.creditLimit) return used;
  return `${used} de ${formatCurrency(account.creditLimit, account.currencyCode)}`;
}

/**
 * Linhas do cartão na tela de contas. O "saldo" que a Pluggy manda para cartão
 * é o limite usado (fatura fechada + compras depois do fechamento + parcelas),
 * por isso ele não aparece mais como se fosse a fatura.
 */
export function CreditAccountBills({ account }: { account: AccountDTO }) {
  const hasClosed = account.closedBillAmount != null && account.closedBillDueDate != null;
  return (
    <div className="mt-1 space-y-1 border-l-2 border-app-border/60 pl-2">
      {hasClosed && (
        <BillLine
          label={`Fatura fechada · vence ${formatDayMonth(account.closedBillDueDate!)}`}
          value={formatCurrency(account.closedBillAmount!, account.currencyCode)}
        />
      )}
      {hasClosed && (
        <BillLine
          label="Compras depois do fechamento"
          value={formatCurrency(account.openBillAmount ?? 0, account.currencyCode)}
        />
      )}
      <BillLine label="Limite usado" value={limitUsedLabel(account)} />
    </div>
  );
}
