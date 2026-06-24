import { AlertTriangle, Info } from "lucide-react";
import { formatDate, formatDateTime } from "../../lib/format";

interface StalePosition {
  name: string;
  referenceDate: string | null;
  staleDays: number | null;
}

interface Props {
  lastSyncedAt: string | null;
  investmentSource?: string | null;
  stalePositionCount?: number;
  stalePositions?: StalePosition[];
  className?: string;
}

export function InvestmentDataNotice({
  lastSyncedAt,
  investmentSource,
  stalePositionCount = 0,
  stalePositions = [],
  className = "",
}: Props) {
  const hasStale = stalePositionCount > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {hasStale && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <div>
            <p className="font-medium">
              {stalePositionCount === 1
                ? "1 posição pode estar desatualizada"
                : `${stalePositionCount} posições podem estar desatualizadas`}
            </p>
            <p className="mt-1 text-amber-800">
              A data da posição na instituição está muito atrás da última sincronização.
              O saldo exibido pode não refletir sua carteira real — confira na corretora
              antes de tomar decisões.
            </p>
            {stalePositions.length > 0 && (
              <ul className="mt-2 space-y-1 text-amber-800">
                {stalePositions.map((pos) => (
                  <li key={pos.name}>
                    <strong>{pos.name}</strong>
                    {pos.referenceDate ? (
                      <>
                        {" "}
                        — posição reportada em{" "}
                        <strong>{formatDate(pos.referenceDate)}</strong>
                      </>
                    ) : null}
                    {pos.staleDays != null && pos.staleDays > 0 ? (
                      <> ({pos.staleDays} dias atrás)</>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3 rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <div>
          <p>
            Dados obtidos via <strong>Open Finance</strong> (Pluggy)
            {investmentSource ? (
              <>
                {" "}
                da <strong>{investmentSource}</strong>
              </>
            ) : null}
            . Quando uma corretora está conectada (ex.: Íon), a carteira do banco não é usada
            para evitar duplicidade.
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
    </div>
  );
}
