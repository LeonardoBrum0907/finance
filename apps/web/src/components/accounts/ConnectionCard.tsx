import { useEffect, useState } from "react";
import type { AccountDTO, BankConnectionDTO, UpdateCreditAccountInput } from "@finance/shared";
import { isCreditAccount } from "@finance/shared";
import { formatCurrency } from "../../lib/format";

interface Props {
  connection: BankConnectionDTO;
  onSync: (connectionId: string) => void;
  onDisconnect: (connectionId: string) => void;
  onSaveBillCalendar?: (accountId: string, body: UpdateCreditAccountInput) => void;
  syncing?: boolean;
  disconnecting?: boolean;
  savingAccountId?: string | null;
}

const inputClass =
  "w-16 rounded-md border border-app-border bg-app-surface px-2 py-1 text-sm text-foreground outline-none focus:border-brand focus:ring-1 focus:ring-brand/20";

function parseBillDay(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.min(31, Math.max(1, Math.round(n)));
}

function CreditBillCalendarForm({
  account,
  onSave,
  saving,
}: {
  account: AccountDTO;
  onSave: (accountId: string, body: UpdateCreditAccountInput) => void;
  saving: boolean;
}) {
  const [dueDay, setDueDay] = useState(account.billDueDay?.toString() ?? "");
  const [closeDay, setCloseDay] = useState(account.billCloseDay?.toString() ?? "");

  useEffect(() => {
    setDueDay(account.billDueDay?.toString() ?? "");
    setCloseDay(account.billCloseDay?.toString() ?? "");
  }, [account.billDueDay, account.billCloseDay]);

  const nextDue = parseBillDay(dueDay);
  const nextClose = parseBillDay(closeDay);
  const dirty =
    nextDue !== (account.billDueDay ?? null) || nextClose !== (account.billCloseDay ?? null);

  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(account.id, { billDueDay: nextDue, billCloseDay: nextClose });
      }}
    >
      <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        Fecha dia
        <input
          type="number"
          min={1}
          max={31}
          placeholder="—"
          value={closeDay}
          onChange={(event) => setCloseDay(event.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        Vence dia
        <input
          type="number"
          min={1}
          max={31}
          placeholder="—"
          value={dueDay}
          onChange={(event) => setDueDay(event.target.value)}
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        disabled={saving || !dirty}
        className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}

export function ConnectionCard({
  connection,
  onSync,
  onDisconnect,
  onSaveBillCalendar,
  syncing,
  disconnecting,
  savingAccountId,
}: Props) {
  return (
    <div className="rounded-md border border-app-border/60 bg-app-bg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {connection.connectorImageUrl && (
            <img
              src={connection.connectorImageUrl}
              alt=""
              className="h-6 w-6 rounded"
            />
          )}
          <span className="text-sm font-medium text-foreground/90">
            {connection.connectorName ?? "Instituição"}
          </span>
          <span className="text-xs text-muted-foreground-dark">{connection.status}</span>
        </div>
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => onSync(connection.id)}
            disabled={syncing}
            className="text-brand hover:underline disabled:opacity-60"
          >
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </button>
          <button
            type="button"
            onClick={() => onDisconnect(connection.id)}
            disabled={disconnecting}
            className="text-danger hover:underline disabled:opacity-60"
          >
            Desconectar
          </button>
        </div>
      </div>
      <div className="mt-2 space-y-2">
        {connection.accounts.map((acc) => (
          <div key={acc.id} className="text-sm text-muted-foreground-dark">
            <div className="flex justify-between">
              <span>{acc.name}</span>
              <span>{formatCurrency(acc.balance, acc.currencyCode)}</span>
            </div>
            {isCreditAccount(acc.type) && onSaveBillCalendar && (
              <CreditBillCalendarForm
                account={acc}
                onSave={onSaveBillCalendar}
                saving={savingAccountId === acc.id}
              />
            )}
          </div>
        ))}
        {onSaveBillCalendar && connection.accounts.some((acc) => isCreditAccount(acc.type)) && (
          <p className="text-[11px] text-muted-foreground">
            A Pluggy só envia fatura já fechada. Informe o vencimento atual se o banco mudou o dia.
          </p>
        )}
      </div>
    </div>
  );
}
