import { Info } from "lucide-react";
import { formatDateTime } from "../../lib/format";

interface Props {
  lastSyncedAt: string | null;
  className?: string;
}

export function InvestmentDataNotice({ lastSyncedAt, className = "" }: Props) {
  return (
    <div
      className={`flex gap-3 rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600 ${className}`}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <div>
        <p>
          Dados obtidos via <strong>Open Finance</strong> (Pluggy) e podem ter
          defasagem em relação ao app do banco ou corretora.
        </p>
        {lastSyncedAt ? (
          <p className="mt-1 text-slate-500">
            Última sincronização: {formatDateTime(lastSyncedAt)}. Posições
            resgatadas ou com saldo zerado não entram na carteira.
          </p>
        ) : (
          <p className="mt-1 text-slate-500">
            Sincronize em <strong>Contas</strong> para atualizar. Posições
            resgatadas ou com saldo zerado não entram na carteira.
          </p>
        )}
      </div>
    </div>
  );
}
