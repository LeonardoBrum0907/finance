import { motion } from "framer-motion";
import { CreditCard } from "lucide-react";
import type { DashboardSummary } from "@finance/shared";
import { isCreditAccount } from "@finance/shared";
import { formatCurrency, formatDate } from "../../lib/format";
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
  const cards = accounts.filter(
    (acc) => isCreditAccount(acc.type) && (acc.creditLimit ?? 0) > 0,
  );
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
        <h2 className="font-display text-base font-semibold text-foreground">
          Cartões de Crédito
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Faturas fechada e aberta, uso do limite e vencimentos
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {cards.map((card, index) => {
          const openBill = card.openBillAmount ?? card.nextBillAmount;
          const openBillDue = card.openBillDueDate ?? card.nextBillDueDate;
          const closedBill = card.closedBillAmount;
          const closedBillDue = card.closedBillDueDate;
          const hasClosedBill = closedBill != null && closedBill > 0;
          const hasOpenBill = openBill != null && openBill > 0;
          const showClosedOnly = hasClosedBill && (!hasOpenBill || openBill === closedBill);
          const showBothBills = hasClosedBill && hasOpenBill && openBill !== closedBill;

          const hasLimitData =
            card.creditLimit != null &&
            card.creditLimit > 0 &&
            card.availableCreditLimit != null;
          const usedFromLimit = hasLimitData
            ? card.creditLimit! - card.availableCreditLimit!
            : null;
          const usedPercent = usagePercent(card.creditLimit, card.availableCreditLimit);
          const isEco = index % 2 === 1;

          return (
            <div
              key={card.id}
              className={isEco ? creditCardEcoClass : creditCardDarkClass}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <CreditCard className="h-5 w-5 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{card.name}</p>
                    <p className="font-mono text-[10px] opacity-60 tracking-wider">
                      {maskedNumber(card.number)}
                    </p>
                  </div>
                </div>
                <span className="h-5 w-9 shrink-0 rounded-full bg-accent/80" aria-hidden />
              </div>

              <div className="mt-3.5 space-y-2.5">
                {showBothBills ? (
                  <>
                    <div className="flex justify-between text-[11px]">
                      <span className="opacity-70">
                        Fatura fechada
                        {closedBillDue && (
                          <span className="opacity-60">
                            {" "}
                            · venceu {formatDate(closedBillDue)}
                          </span>
                        )}
                      </span>
                      <span className="font-bold">
                        {formatCurrency(closedBill!, card.currencyCode)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="opacity-70">
                        Fatura aberta
                        {openBillDue && (
                          <span className="opacity-60">
                            {" "}
                            · vence {formatDate(openBillDue)}
                          </span>
                        )}
                      </span>
                      <span className="font-bold">
                        {formatCurrency(openBill!, card.currencyCode)}
                      </span>
                    </div>
                  </>
                ) : showClosedOnly ? (
                  <div className="flex justify-between text-[11px]">
                    <span className="opacity-70">
                      Fatura fechada
                      {closedBillDue && (
                        <span className="opacity-60">
                          {" "}
                          · vence {formatDate(closedBillDue)}
                        </span>
                      )}
                    </span>
                    <span className="font-bold">
                      {formatCurrency(closedBill!, card.currencyCode)}
                    </span>
                  </div>
                ) : hasOpenBill ? (
                  <div className="flex justify-between text-[11px]">
                    <span className="opacity-70">
                      Fatura aberta
                      {openBillDue && (
                        <span className="opacity-60">
                          {" "}
                          · vence {formatDate(openBillDue)}
                        </span>
                      )}
                    </span>
                    <span className="font-bold">
                      {formatCurrency(openBill!, card.currencyCode)}
                    </span>
                  </div>
                ) : null}

                {hasLimitData && usedFromLimit != null && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="opacity-70">Uso do limite</span>
                      <span className="font-bold">
                        {formatCurrency(usedFromLimit, card.currencyCode)}
                        {` / ${formatCurrency(card.creditLimit!, card.currencyCode)}`}
                      </span>
                    </div>
                    {usedPercent != null && (
                      <div className="h-2 overflow-hidden rounded-full bg-app-surface/10">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${usedPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
