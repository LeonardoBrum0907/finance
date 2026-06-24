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
        <h2 className="text-sm font-semibold text-slate-900">Posições</h2>
        <p className="mt-4 text-sm text-slate-500">Nenhuma posição encontrada.</p>
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
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Posições</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
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
                <tr key={pos.id} className="text-slate-700">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-slate-900">{pos.name}</p>
                    {pos.code && (
                      <p className="text-xs text-slate-400">{pos.code}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <PositionStatusCell position={pos} />
                  </td>
                  <td className="py-3 pr-4 text-slate-600">{typeLabel}</td>
                  <td className="py-3 pr-4 text-right font-medium text-slate-900">
                    {formatCurrency(pos.balance, currencyCode)}
                  </td>
                  <td className="py-3 pr-4 text-right text-slate-600">
                    {pos.amountOriginal != null
                      ? formatCurrency(pos.amountOriginal, currencyCode)
                      : "—"}
                  </td>
                  <td
                    className={`py-3 pr-4 text-right font-medium ${
                      profitPositive ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {pos.profit >= 0 ? "+" : ""}
                    {formatCurrency(pos.profit, currencyCode)}
                  </td>
                  <td className="py-3 pr-4 text-right text-slate-600">
                    {formatRate(pos)}
                  </td>
                  <td className="py-3 text-right text-slate-600">
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
