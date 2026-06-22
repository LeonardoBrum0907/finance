import { motion } from "framer-motion";
import type { TransactionDTO } from "@finance/shared";
import { isTransactionOutflow, toSignedDisplayAmount, translateCategory } from "@finance/shared";
import { formatCurrency, formatDate } from "../../lib/format";
import { cardClass, fadeUp } from "./motion";

interface Props {
  transactions: TransactionDTO[];
}

export function RecentTransactions({ transactions }: Props) {
  return (
    <motion.section
      custom={6}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={`${cardClass} overflow-hidden p-0`}
    >
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-800">Extrato recente</h2>
        <p className="text-sm text-slate-500">Últimas movimentações</p>
      </div>

      {transactions.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          Nenhuma transação recente.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2.5 font-medium">Data</th>
                <th className="px-5 py-2.5 font-medium">Descrição</th>
                <th className="hidden px-5 py-2.5 font-medium sm:table-cell">Pessoa</th>
                <th className="px-5 py-2.5 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-t border-slate-100 transition hover:bg-slate-50/60"
                >
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                    {formatDate(tx.date)}
                  </td>
                  <td className="max-w-[200px] truncate px-5 py-3 text-slate-800 sm:max-w-xs">
                    {tx.description}
                    {tx.category && (
                      <span className="mt-0.5 block truncate text-xs text-slate-400">
                        {translateCategory(tx.category)}
                      </span>
                    )}
                  </td>
                  <td className="hidden px-5 py-3 text-slate-500 sm:table-cell">
                    {tx.personName}
                  </td>
                  <td
                    className={`whitespace-nowrap px-5 py-3 text-right font-medium ${
                      isTransactionOutflow(tx.amount, tx.accountType)
                        ? "text-red-600"
                        : "text-brand-600"
                    }`}
                  >
                    {formatCurrency(
                      toSignedDisplayAmount(tx.amount, tx.accountType),
                      tx.currencyCode,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.section>
  );
}
