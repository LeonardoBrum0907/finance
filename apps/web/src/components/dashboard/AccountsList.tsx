import { motion } from "framer-motion";
import type { DashboardSummary } from "@finance/shared";
import { isCreditAccount } from "@finance/shared";
import { formatCurrency } from "../../lib/format";
import { cardClass, fadeUp } from "./motion";

type Account = DashboardSummary["accounts"][number];

interface Props {
  accounts: Account[];
}

export function AccountsList({ accounts }: Props) {
  const bankAccounts = accounts.filter((acc) => !isCreditAccount(acc.type));

  if (bankAccounts.length === 0) return null;

  return (
    <motion.section
      custom={5}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cardClass}
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Contas bancárias</h2>
        <p className="text-sm text-muted-foreground-dark">
          {bankAccounts.length} conta(s) conectada(s)
        </p>
      </div>

      <div className="space-y-2">
        {bankAccounts.map((acc) => (
          <div
            key={acc.id}
            className="flex items-center justify-between rounded-lg border border-app-border/60 bg-app-bg/50 px-4 py-3 transition hover:border-app-border hover:bg-app-surface"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{acc.name}</p>
              <p className="text-xs text-muted-foreground-dark">
                {acc.personName} · {acc.type ?? "Conta"}
                {acc.number ? ` · ${acc.number}` : ""}
              </p>
            </div>
            <span className="ml-4 shrink-0 font-semibold text-foreground">
              {formatCurrency(acc.balance, acc.currencyCode)}
            </span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
