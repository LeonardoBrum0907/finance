import type { BankConnectionDTO } from "@finance/shared";
import { formatCurrency } from "../../lib/format";

interface Props {
  connection: BankConnectionDTO;
  onSync: (connectionId: string) => void;
  onDisconnect: (connectionId: string) => void;
  syncing?: boolean;
  disconnecting?: boolean;
}

export function ConnectionCard({
  connection,
  onSync,
  onDisconnect,
  syncing,
  disconnecting,
}: Props) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {connection.connectorImageUrl && (
            <img
              src={connection.connectorImageUrl}
              alt=""
              className="h-6 w-6 rounded"
            />
          )}
          <span className="text-sm font-medium text-slate-700">
            {connection.connectorName ?? "Instituição"}
          </span>
          <span className="text-xs text-slate-400">{connection.status}</span>
        </div>
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => onSync(connection.id)}
            disabled={syncing}
            className="text-brand-600 hover:underline disabled:opacity-60"
          >
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </button>
          <button
            type="button"
            onClick={() => onDisconnect(connection.id)}
            disabled={disconnecting}
            className="text-red-600 hover:underline disabled:opacity-60"
          >
            Desconectar
          </button>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {connection.accounts.map((acc) => (
          <div
            key={acc.id}
            className="flex justify-between text-sm text-slate-600"
          >
            <span>{acc.name}</span>
            <span>{formatCurrency(acc.balance, acc.currencyCode)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
