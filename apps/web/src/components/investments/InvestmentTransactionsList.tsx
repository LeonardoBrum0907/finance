import { motion } from "framer-motion";
import type { InvestmentTransactionDTO } from "@finance/shared";
import { formatCurrency, formatDate } from "../../lib/format";
import { cardLargeClass, fadeUp } from "../dashboard/motion";

interface Props {
  transactions: InvestmentTransactionDTO[];
  currencyCode: string;
}

export function InvestmentTransactionsList({ transactions, currencyCode }: Props) {
  if (transactions.length === 0) {
    return (
      <div className={cardLargeClass}>
        <h2 className="text-sm font-semibold text-foreground">Movimentações recentes</h2>
        <p className="mt-4 text-sm text-muted-foreground-dark">Nenhuma movimentação registrada.</p>
      </div>
    );
  }

  return (
    <motion.div
      custom={6}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cardLargeClass}
    >
      <h2 className="mb-4 text-sm font-semibold text-foreground">Movimentações recentes</h2>
      <ul className="divide-y divide-slate-100">
        {transactions.map((tx) => {
          const isSell = tx.type === "SELL";
          const isBuy = tx.type === "BUY";

          return (
            <li key={tx.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {tx.investmentName}
                </p>
                <p className="text-xs text-muted-foreground-dark">
                  {formatDate(tx.date)} · {tx.typeLabel}
                  {tx.description ? ` · ${tx.description}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`font-medium ${
                    isSell ? "text-positive" : isBuy ? "text-negative" : "text-foreground/90"
                  }`}
                >
                  {isBuy ? "−" : isSell ? "+" : ""}
                  {formatCurrency(tx.netAmount ?? tx.amount, currencyCode)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
