import { motion } from "framer-motion";
import type { InvestmentPositionDTO } from "@finance/shared";
import { formatCurrency, formatDate, formatPercent } from "../../lib/format";
import { cardLargeClass, fadeUp } from "../dashboard/motion";
import { PositionStatusCell } from "./InvestmentStatusBadge";

interface Props {
  positions: InvestmentPositionDTO[];
  currencyCode: string;
}

function formatRate(position: InvestmentPositionDTO): string {
  if (position.lastTwelveMonthsRate != null) {
    return formatPercent(position.lastTwelveMonthsRate, 2);
  }
  if (position.annualRate != null) {
    return formatPercent(position.annualRate, 2);
  }
  return "—";
}

export function PositionsTable({ positions, currencyCode }: Props) {
  if (positions.length === 0) {
    return (
      <div className={cardLargeClass}>
        <h2 className="text-sm font-semibold text-foreground">Posições</h2>
        <p className="mt-4 text-sm text-muted-foreground-dark">Nenhuma posição encontrada.</p>
      </div>
    );
  }

  return (
    <motion.div
      custom={5}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cardLargeClass}
    >
      <h2 className="mb-4 text-sm font-semibold text-foreground">Posições</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-app-border/60 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground-dark">
              <th className="pb-3 pr-4">Ativo</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4">Tipo</th>
              <th className="pb-3 pr-4 text-right">Saldo</th>
              <th className="pb-3 pr-4 text-right">Aplicado</th>
              <th className="pb-3 pr-4 text-right">Lucro</th>
              <th className="pb-3 pr-4 text-right">Rentab.</th>
              <th className="pb-3 text-right">Vencimento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {positions.map((pos) => {
              const profitPositive = pos.profit >= 0;
              const typeLabel = pos.subtypeLabel
                ? `${pos.typeLabel} · ${pos.subtypeLabel}`
                : pos.typeLabel;

              return (
                <tr key={pos.id} className="text-foreground/90">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-foreground">{pos.name}</p>
                    {pos.code && (
                      <p className="text-xs text-muted-foreground-dark">{pos.code}</p>
                    )}
                    {pos.connectorName && (
                      <p className="text-[10px] text-muted-foreground-dark">{pos.connectorName}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <PositionStatusCell position={pos} />
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground-dark">{typeLabel}</td>
                  <td className="py-3 pr-4 text-right font-medium text-foreground">
                    {formatCurrency(pos.balance, currencyCode)}
                  </td>
                  <td className="py-3 pr-4 text-right text-muted-foreground-dark">
                    {pos.amountOriginal != null
                      ? formatCurrency(pos.amountOriginal, currencyCode)
                      : "—"}
                  </td>
                  <td
                    className={`py-3 pr-4 text-right font-medium ${
                      profitPositive ? "text-positive" : "text-negative"
                    }`}
                  >
                    {pos.profit >= 0 ? "+" : ""}
                    {formatCurrency(pos.profit, currencyCode)}
                  </td>
                  <td className="py-3 pr-4 text-right text-muted-foreground-dark">
                    {formatRate(pos)}
                  </td>
                  <td className="py-3 text-right text-muted-foreground-dark">
                    {pos.dueDate ? formatDate(pos.dueDate) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
