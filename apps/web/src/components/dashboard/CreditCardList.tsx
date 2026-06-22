import { motion } from "framer-motion";
import type { DashboardSummary } from "@finance/shared";
import { isCreditAccount } from "@finance/shared";
import { formatCurrency, formatDate } from "../../lib/format";
import { cardClass, fadeUp } from "./motion";

type Account = DashboardSummary["accounts"][number];

interface Props {
  accounts: Account[];
}

function usagePercent(creditLimit: number | null | undefined, available: number | null | undefined): number | null {
  if (creditLimit == null || creditLimit <= 0 || available == null) return null;
  const used = creditLimit - available;
  return Math.min(100, Math.max(0, (used / creditLimit) * 100));
}

export function CreditCardList({ accounts }: Props) {
  const cards = accounts.filter((acc) => isCreditAccount(acc.type));
  if (cards.length === 0) return null;

  return (
    <motion.section
      custom={5}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <div>
        <h2 className="text-base font-semibold text-slate-800">Cartões de crédito</h2>
        <p className="text-sm text-slate-500">Faturas e limites dos cartões conectados</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => {
          const usedPercent = usagePercent(card.creditLimit, card.availableCreditLimit);
          const usedAmount =
            card.creditLimit != null && card.availableCreditLimit != null
              ? card.creditLimit - card.availableCreditLimit
              : null;

          return (
            <div
              key={card.id}
              className={`${cardClass} border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 text-white`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{card.name}</p>
                  <p className="text-xs text-slate-300">
                    {card.personName}
                    {card.creditBrand ? ` · ${card.creditBrand}` : ""}
                    {card.number ? ` · ${card.number}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-200">
                  Fatura
                </span>
              </div>

              <div className="mt-5">
                <p className="text-xs text-slate-400">Fatura atual</p>
                <p className="mt-1 text-2xl font-semibold text-red-300">
                  {formatCurrency(card.balance, card.currencyCode)}
                </p>
                {card.nextBillDueDate != null && (
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-white/10 pt-3">
                    <p className="text-xs text-slate-500">Próxima fatura</p>
                    <p className="text-sm text-slate-400">
                      {formatCurrency(card.nextBillAmount ?? 0, card.currencyCode)}
                      <span className="ml-1.5 text-xs text-slate-500">
                        · vence {formatDate(card.nextBillDueDate)}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {card.balanceDueDate && (
                  <div>
                    <p className="text-xs text-slate-400">Vencimento</p>
                    <p className="font-medium">{formatDate(card.balanceDueDate)}</p>
                  </div>
                )}
                {card.balanceCloseDate && (
                  <div>
                    <p className="text-xs text-slate-400">Fechamento</p>
                    <p className="font-medium">{formatDate(card.balanceCloseDate)}</p>
                  </div>
                )}
                {card.minimumPayment != null && card.minimumPayment > 0 && (
                  <div>
                    <p className="text-xs text-slate-400">Pagamento mínimo</p>
                    <p className="font-medium">
                      {formatCurrency(card.minimumPayment, card.currencyCode)}
                    </p>
                  </div>
                )}
                {card.creditLimit != null && (
                  <div>
                    <p className="text-xs text-slate-400">Limite</p>
                    <p className="font-medium">
                      {formatCurrency(card.creditLimit, card.currencyCode)}
                    </p>
                  </div>
                )}
              </div>

              {usedPercent != null && (
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>Limite utilizado</span>
                    <span>{usedPercent.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${usedPercent}%` }}
                    />
                  </div>
                  {usedAmount != null && card.availableCreditLimit != null && (
                    <p className="mt-1 text-xs text-slate-400">
                      Disponível: {formatCurrency(card.availableCreditLimit, card.currencyCode)}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
