import { motion } from "framer-motion";
import { CreditCard } from "lucide-react";
import type { DashboardSummary } from "@finance/shared";
import { isCreditAccount } from "@finance/shared";
import { formatCurrency } from "../../lib/format";
import { cardLargeClass, creditCardDarkClass, creditCardEcoClass, fadeUp } from "./motion";

type Account = DashboardSummary["accounts"][number];

interface Props {
  accounts: Account[];
}

function usagePercent(
  creditLimit: number | null | undefined,
  available: number | null | undefined,
): number | null {
  if (creditLimit == null || creditLimit <= 0 || available == null) return null;
  const used = creditLimit - available;
  return Math.min(100, Math.max(0, (used / creditLimit) * 100));
}

function maskedNumber(number: string | null): string {
  const digits = number?.replace(/\D/g, "") ?? "";
  const last4 = digits.slice(-4) || "0000";
  return `**** **** **** ${last4}`;
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
      className={cardLargeClass}
    >
      <div className="mb-5">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Cartões de Crédito
        </h2>
        <p className="text-[11px] text-slate-400">Limite de crédito e status de vencimento</p>
      </div>

      <div className="flex flex-col gap-4">
        {cards.map((card, index) => {
          const usedPercent = usagePercent(card.creditLimit, card.availableCreditLimit);
          const usedAmount =
            card.creditLimit != null && card.availableCreditLimit != null
              ? card.creditLimit - card.availableCreditLimit
              : Math.abs(card.balance);
          const isEco = index % 2 === 1;

          return (
            <div
              key={card.id}
              className={isEco ? creditCardEcoClass : creditCardDarkClass}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <CreditCard className="h-5 w-5 shrink-0 text-emerald-400" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{card.name}</p>
                    <p className="font-mono text-[10px] opacity-60 tracking-wider">
                      {maskedNumber(card.number)}
                    </p>
                  </div>
                </div>
                <span className="h-5 w-9 shrink-0 rounded-full bg-emerald-400/80" aria-hidden />
              </div>

              <div className="mt-3.5 flex flex-col gap-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="opacity-70">Uso do limite</span>
                  <span className="font-bold">
                    {formatCurrency(usedAmount, card.currencyCode)}
                    {card.creditLimit != null &&
                      ` / ${formatCurrency(card.creditLimit, card.currencyCode)}`}
                  </span>
                </div>
                {usedPercent != null && (
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all"
                      style={{ width: `${usedPercent}%` }}
                    />
                  </div>
                )}
              </div>

              {usedAmount > 0 && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled
                    title="Em breve"
                    className="rounded-lg border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white opacity-80"
                  >
                    Pagar Fatura
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
