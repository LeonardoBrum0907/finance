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
        <h2 className="text-base font-semibold text-slate-800">Contas bancárias</h2>
        <p className="text-sm text-slate-500">
          {bankAccounts.length} conta(s) conectada(s)
        </p>
      </div>

      <div className="space-y-2">
        {bankAccounts.map((acc) => (
          <div
            key={acc.id}
            className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3 transition hover:border-slate-200 hover:bg-white"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{acc.name}</p>
              <p className="text-xs text-slate-500">
                {acc.personName} · {acc.type ?? "Conta"}
                {acc.number ? ` · ${acc.number}` : ""}
              </p>
            </div>
            <span className="ml-4 shrink-0 font-semibold text-slate-800">
              {formatCurrency(acc.balance, acc.currencyCode)}
            </span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
